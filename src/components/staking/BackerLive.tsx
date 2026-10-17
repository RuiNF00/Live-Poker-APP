// The live link for backers: the card on the session screen that creates,
// shares and removes it, and the background sync that keeps the page current.

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';

import { Button, Card, Pill, Row, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { createLive, deleteLive, liveSnapshot, liveUrl, snapshotKey, updateLive } from '@/lib/live-link';
import { shareRef } from '@/lib/referrals';
import { useOnline } from '@/lib/sync';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, S } from '@/theme';

function note(title: string, body: string) {
  if (Platform.OS === 'web') console.warn(title, body);
  else Alert.alert(title, body);
}

async function shareLink(s: Session, id: string) {
  const ref = await shareRef().catch(() => '');
  const url = `${liveUrl(id)}?utm_source=app&utm_medium=backer_live${ref ? `&r=${encodeURIComponent(ref)}` : ''}`;
  const msg = t('Segue a minha sessão em direto: {name}{url}', { name: s.name ? s.name + '\n' : '', url });
  track('link_shared', { channel: 'backer_live' });
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(url);
    note(t('Link copiado'), url);
  } else await Share.share({ message: msg });
}

export function BackerLiveCard({ s }: { s: Session }) {
  const { saveSession, hands, settings } = useStore();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    tap('medium');
    setBusy(true);
    try {
      const n = hands.filter((h) => h.sessionId === s.id).length;
      const live = await createLive(liveSnapshot(s, settings.nickname, n));
      saveSession({ ...s, live });
      await shareLink(s, live.id);
    } catch {
      note(t('Sem ligação'), t('Não deu para criar o link. Tenta outra vez quando tiveres rede.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const go = async () => {
      if (!s.live) return;
      setBusy(true);
      try {
        await deleteLive(s.live);
        saveSession({ ...s, live: undefined });
      } catch {
        note(t('Sem ligação'), t('O link continua ativo. Tenta outra vez quando tiveres rede.'));
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') go();
    else
      Alert.alert(t('Desligar o link?'), t('A página deixa de existir para quem a tiver.'), [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Desligar'), style: 'destructive', onPress: go },
      ]);
  };

  return (
    <Card tone={s.live ? 'good' : 'default'} style={{ gap: S.md }}>
      <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: s.live ? C.goodSoft : C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="radio-outline" size={22} color={s.live ? C.good : C.accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Row gap={S.sm}>
            <T v="h3" style={{ flexShrink: 1 }}>
              {t('Link para os backers')}
            </T>
            {s.live ? <Pill label={t('Em direto')} color={C.good} icon="ellipse" /> : null}
          </Row>
          <T v="small">
            {s.live
              ? t('Quem tem o link vê o stack, o nível e o resultado, atualizados sempre que mexes na sessão.')
              : t('Os teus backers seguem a sessão no browser: stack, nível e resultado. Sem notas, mãos nem nomes de backers.')}
          </T>
        </View>
      </Row>
      {s.live ? (
        <ToggleItem
          icon="location-outline"
          title={t('Mostrar a sala')}
          subtitle={s.venue ? t('{venue} aparece no link. Desligado, ninguém sabe onde estás.', { venue: s.venue }) : t('Desligado, ninguém sabe onde estás.')}
          value={!!s.live.showVenue}
          onChange={(showVenue) => saveSession({ ...s, live: { ...s.live!, showVenue } })}
        />
      ) : null}
      {s.live ? (
        <Row gap={S.sm}>
          <Button size="md" kind="ghost" style={{ flex: 1 }} title={t('Desligar')} disabled={busy} onPress={remove} />
          <Button size="md" style={{ flex: 1.4 }} icon="share-outline" title={t('Partilhar')} disabled={busy} onPress={() => shareLink(s, s.live!.id)} />
        </Row>
      ) : (
        <Button size="md" kind="outline" icon="radio-outline" title={busy ? t('A criar…') : t('Criar link em direto')} disabled={busy} onPress={create} />
      )}
    </Card>
  );
}

const RETRY_MS = 60000;
/** Sessions keep updating their page for a while after they end (late cash-out or place). */
const AFTER_END_MS = 12 * 3600000;

/**
 * Mounted once at the root. Sends a session's snapshot to its live page whenever something a
 * backer sees changes (not the clock), a couple of seconds after the last edit. Offline, it
 * tries again a minute later; a page that is gone is forgotten.
 */
export function BackerLiveSync() {
  const { sessions, hands, settings, saveSession } = useStore();
  const sent = useRef(new Map<string, string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [retry, setRetry] = useState(0);
  // Back online: send what's pending now instead of at the next minute.
  const online = useOnline();
  const latest = useRef(sessions);
  latest.current = sessions;

  useEffect(() => {
    const now = Date.now();
    if (!online) return;
    for (const s of sessions) {
      if (!s.live || (s.endedAt && now - s.endedAt > AFTER_END_MS)) continue;
      const snap = liveSnapshot(s, settings.nickname, hands.filter((h) => h.sessionId === s.id).length);
      const key = snapshotKey(snap);
      if (sent.current.get(s.live.id) === key) continue;
      const live = s.live;
      clearTimeout(timers.current.get(live.id));
      timers.current.set(
        live.id,
        setTimeout(async () => {
          timers.current.delete(live.id);
          try {
            const ok = await updateLive(live, { ...snap, updatedAt: Date.now() });
            if (ok) sent.current.set(live.id, key);
            else {
              const cur = latest.current.find((x) => x.id === s.id);
              if (cur?.live?.id === live.id) saveSession({ ...cur, live: undefined });
            }
          } catch {
            setTimeout(() => setRetry((r) => r + 1), RETRY_MS);
          }
        }, 2000),
      );
    }
  }, [sessions, hands, settings.nickname, saveSession, retry, online]);

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((x) => clearTimeout(x));
  }, []);
  return null;
}
