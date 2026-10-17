// Send hands to a coach: a private link (sweatbook.poker/c/<token>) the coach opens in the browser,
// without an account. Comes from a folder ("Rever com coach") or from hands picked in the list.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { CardRow } from '@/components/PlayingCard';
import { Button, Card, Empty, Field, ListGroup, Row, Section, Segmented, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { canCreateLink, EXPIRY_CHOICES, MAX_COACH_HANDS, type ExpiryChoice } from '@/lib/coach-core';
import { createCoachLink, freeLinkUsed } from '@/lib/coach-api';
import { track } from '@/lib/events';
import { isComplete } from '@/poker/engine';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

export default function NewCoachLink() {
  const { ids, folder } = useLocalSearchParams<{ ids?: string; folder?: string }>();
  const { hands, settings } = useStore();
  const pro = usePro();
  const [title, setTitle] = useState(folder || t('Rever com coach'));
  const [days, setDays] = useState<ExpiryChoice>(30);
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [softAsk, askNotify] = useNotifySoftAsk();
  const [freeUsed, setFreeUsed] = useState<boolean | null>(null);
  useEffect(() => {
    freeLinkUsed().then(setFreeUsed);
  }, []);

  const { send, left, extra } = useMemo(() => {
    const want = new Set((ids ?? '').split(',').filter(Boolean));
    const list = [...hands]
      .filter((h) => (folder ? h.folders?.includes(folder) : want.has(h.id)))
      .sort((a, b) => a.createdAt - b.createdAt);
    const done = list.filter((h) => isComplete(h));
    return { send: done.slice(-MAX_COACH_HANDS), left: list.length - done.length, extra: Math.max(0, done.length - MAX_COACH_HANDS) };
  }, [hands, ids, folder]);

  if (!send.length)
    return (
      <Empty
        icon="school-outline"
        title={t('Sem mãos para enviar')}
        body={left ? t('As mãos por completar não seguem para o coach. Acaba-as primeiro.') : t('Escolhe uma pasta ou seleciona mãos na lista.')}
      />
    );

  const create = async () => {
    tap('medium');
    if (!canCreateLink(pro.isPro, !!freeUsed)) {
      pro.paywall('coach');
      return;
    }
    setBusy(true);
    const r = await createCoachLink({ hands: send, title: title.trim().slice(0, 80) || t('Rever com coach'), days, player: settings.nickname ?? '', names: settings.shareNames, notes, isPro: pro.isPro });
    setBusy(false);
    if (!r.ok) {
      note(
        t('Link não criado'),
        r.error === 'offline' ? t('Sem rede. Tenta outra vez quando tiveres sinal.') : r.error === 'rate_limited' ? t('Criaste muitos links seguidos. Tenta daqui a pouco.') : t('Não deu para criar o link. Tenta outra vez.'),
      );
      return;
    }
    track('share_created', { kind: 'coach', hands: send.length, days: days ?? 0 });
    const msg = t('Podes rever estas {n} mãos? Comenta no próprio replay, sem criar conta: {url}', { n: send.length, url: r.link.url });
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      note(t('Link copiado'), t('Envia-o ao teu coach.'));
    } else await Share.share({ message: msg }).catch(() => {});
    // The moment it makes sense to ask: we tell the player when the coach answers.
    await askNotify({
      title: t('Avisamos-te quando o coach comentar'),
      preview: { title: t('Comentários do coach'), body: send.length === 1 ? t('O teu coach comentou 1 mão') : t('O teu coach comentou {n} mãos', { n: send.length }) },
    }).catch(() => false);
    router.replace('/coach');
  };

  const expiryLabel = (d: ExpiryChoice) => (d === null ? t('Sem prazo') : t('{n} dias', { n: d }));

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, gap: S.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: S.md, paddingVertical: S.lg }}>
        <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="school" size={22} color={C.accent} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="h2">{send.length === 1 ? t('1 mão para o coach') : t('{n} mãos para o coach', { n: send.length })}</T>
            <T v="small">{t('O coach abre o link no browser, comenta cada jogada e tu recebes tudo aqui, na mão.')}</T>
          </View>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {send.slice(-8).map((h) => (
            <View key={h.id} style={{ paddingVertical: 4, paddingHorizontal: 5, borderRadius: R.sm, backgroundColor: C.surface2 }}>
              {h.players[h.hero].cards?.length === 2 ? <CardRow cards={h.players[h.hero].cards!} size="xs" gap={1} /> : <T v="tiny">—</T>}
            </View>
          ))}
          {send.length > 8 ? (
            <View style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: R.sm, backgroundColor: C.surface2, justifyContent: 'center' }}>
              <T v="tiny">+{send.length - 8}</T>
            </View>
          ) : null}
        </View>
        {left || extra ? (
          <T v="tiny" color={C.warn}>
            {[left ? (left === 1 ? t('1 mão por completar fica de fora.') : t('{n} mãos por completar ficam de fora.', { n: left })) : '', extra ? t('Seguem as {max} mais recentes.', { max: MAX_COACH_HANDS }) : '']
              .filter(Boolean)
              .join(' ')}
          </T>
        ) : null}
      </Card>

      <Field label={t('Título')} value={title} onChangeText={setTitle} maxLength={80} placeholder={t('Rever com coach')} />

      <Section title={t('O link funciona durante')}>
        <Segmented options={EXPIRY_CHOICES.map((d) => ({ key: d ?? 0, label: expiryLabel(d) }))} value={days ?? 0} onChange={(k) => setDays(k === 0 ? null : (k as ExpiryChoice))} />
      </Section>

      <ListGroup>
        <ToggleItem icon="document-text-outline" title={t('Incluir as minhas notas')} subtitle={t('Ajudam o coach a perceber o que viste na mesa.')} value={notes} onChange={setNotes} />
      </ListGroup>

      <Card tone="inset" style={{ gap: 8 }}>
        <Row gap={8}>
          <Ionicons name="lock-closed" size={15} color={C.textDim} />
          <T v="h3" style={{ fontSize: 14 }}>
            {t('Link privado')}
          </T>
        </Row>
        <T v="small">{t('Só quem tiver o link abre as mãos. Não aparece no Google nem no teu perfil, e podes desligá-lo quando quiseres.')}</T>
        <T v="small">{settings.shareNames ? t('Os nomes dos adversários vão com as mãos.') : t('Os adversários aparecem só pela posição.')}</T>
      </Card>

      <Button title={busy ? t('A criar link…') : t('Criar link e enviar')} icon="paper-plane" disabled={busy || freeUsed === null} onPress={create} />
      {!pro.isPro ? (
        <T v="tiny" style={{ textAlign: 'center' }}>
          {freeUsed ? t('Já usaste o link grátis. Com Pro, envias as pastas que quiseres.') : t('O primeiro link é grátis. Depois, é Pro.')}
        </T>
      ) : null}
      {softAsk}
    </ScrollView>
  );
}
