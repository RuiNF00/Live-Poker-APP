// Cloud backup panel: turn it on (shows the recovery code), back up now,
// restore on a new phone with the code, or turn it off.

import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Share, View } from 'react-native';

import { t } from '@/i18n';
import { copyWaiting, download, formatCode, loadCloud, newCloud, onCloudChange, parseCode, rememberedCode, onCopyWaiting, removeRemote, saveCloud, upload, type CloudState } from '@/lib/cloud-backup';
import { autoBackup, backupHealth, changeBackupIn, cloudAhead, countsOf, uploadBlock, type Health } from '@/lib/cloud-guard';
import { syncCloudExpiry } from '@/lib/cloud-expiry';
import { useOnline } from '@/lib/sync';
import { shortDate } from '@/poker/format';
import { buildBackup, importSummary, type BackupData } from '@/store/backup';
import { useStore } from '@/store/store';
import { C, F, R, S } from '@/theme';

import { Banner, Button, Card, Field, Row, T, tap } from './ui';

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

const ERR: Record<string, string> = {
  network: 'Sem ligação. Tenta outra vez quando tiveres rede.',
  offline: 'Sem ligação. Tenta outra vez quando tiveres rede.',
  not_found: 'Não encontrámos nenhuma cópia com esse código.',
  forbidden: 'Este código não dá acesso a esta cópia.',
  too_big: 'A cópia passou o limite da nuvem. A última que coube continua lá; exporta para ficheiro para guardar tudo.',
  quota: 'O servidor está cheio de momento. As tuas mãos estão seguras neste telemóvel; tentamos outra vez mais tarde.',
  disabled: 'A cópia na nuvem ainda não está disponível. Por agora, exporta para ficheiro.',
  would_shrink: 'A cópia na nuvem tem mais do que este telemóvel. Não a substituímos.',
};
/** A copy asked for with no signal: true until it goes out. */
function useCopyWaiting(): boolean {
  const [w, setW] = useState(copyWaiting);
  useEffect(() => onCopyWaiting(setW), []);
  return w;
}

const errText = (e: unknown) => t(ERR[(e as Error)?.message] ?? ERR.network);

/** Yes/no before something the player should read first. */
function ask(title: string, body: string, yes: string, onYes: () => void, no = t('Cancelar')) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: no, style: 'cancel' },
    { text: yes, onPress: onYes },
  ]);
}

/**
 * Brings the cloud copy in (newer copy of each item wins, nothing local is
 * deleted) and makes this phone keep it up to date from now on.
 */
async function restoreFrom(c: CloudState, importData: ImportData): Promise<CloudState> {
  const remote = await download(c);
  const n = importData(remote);
  // It was just downloaded, so the launch auto-backup has nothing new to send,
  // and no upload may send less than it holds (counts), even if the app is
  // closed before the restored hands reach the phone's storage. Whoever has
  // the code to restore has it saved somewhere.
  const next: CloudState = { ...c, lastAt: Date.now(), counts: countsOf(remote), sent: remote.exportedAt, saved: true };
  await saveCloud(next);
  note(t('Cópia recuperada'), importSummary(n));
  return next;
}

type ImportData = (b: BackupData) => Parameters<typeof importSummary>[0];

/**
 * For upload(): another phone with this code copied things this one doesn't
 * have. They come here too, and the player is told (never joined in silence).
 */
const joinRemote = (importData: ImportData) => (remote: BackupData) => {
  const n = importData(remote);
  if (Object.values(n).some((v) => v > 0)) note(t('Juntámos o que o outro telemóvel copiou'), importSummary(n));
};

function confirmTurnOn(onYes: () => void) {
  ask(
    t('Antes de ativar'),
    t('Vais receber um código. É a única chave da tua cópia: sem ele, ninguém (nem nós) a consegue abrir. Guarda-o fora deste telemóvel.'),
    t('Ativar'),
    onYes,
  );
}

/** A new random code: there is no server copy to protect yet. Says so when it fails. */
async function activate(data: BackupData): Promise<CloudState> {
  tap('medium');
  try {
    return await upload(newCloud(), data, { force: true });
  } catch (e) {
    note(t('Não deu para ativar'), errText(e));
    throw e;
  }
}

/** The share sheet with the code: Notes, Passwords, a password manager, a message to yourself. */
function shareCode(c: CloudState) {
  Share.share({ message: t('Código da cópia Sweatbook: {code}', { code: formatCode(c) }) }).catch(() => {});
}

/** `onExport`: the «Exportar tudo» of the screen it sits on, offered when the copy outgrew the server limit. */
export function CloudBackup({ onExport }: { onExport?: () => void } = {}) {
  const store = useStore();
  const [cloud, setCloud] = useState<CloudState | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [code, setCode] = useState('');
  const [now] = useState(Date.now);
  const waiting = useCopyWaiting();

  useEffect(() => {
    loadCloud().then(setCloud);
    return onCloudChange(setCloud);
  }, []);

  const data = () => buildBackup(store);

  const turnOn = () =>
    confirmTurnOn(async () => {
      setBusy(true);
      try {
        setCloud(await activate(data()));
      } catch {
        // Already said.
      } finally {
        setBusy(false);
      }
    });
  const backupNow = async (force = false) => {
    if (!cloud) return;
    tap();
    setBusy(true);
    try {
      setCloud(await upload(cloud, data(), { force, onRemote: joinRemote(store.importData) }));
    } catch (e) {
      // No signal: the card says it waits and copies when the signal is back.
      if ((e as Error)?.message === 'offline') return;
      if ((e as Error)?.message !== 'would_shrink' || Platform.OS === 'web') note(t('Não deu para fazer a cópia'), errText(e));
      else
        Alert.alert(t('Substituir a cópia na nuvem?'), t('A cópia na nuvem tem mais mãos, sessões ou jogadores do que este telemóvel. Se apagaste de propósito, substitui. Se não, recupera primeiro com o código.'), [
          { text: t('Cancelar'), style: 'cancel' },
          { text: t('Substituir'), style: 'destructive', onPress: () => backupNow(true) },
        ]);
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    const c = parseCode(code);
    if (!c) return note(t('Código inválido'), t('O código tem 26 letras e números, como aparece no outro telemóvel.'));
    tap('medium');
    setBusy(true);
    try {
      setCloud(await restoreFrom(c, store.importData));
      setRestoring(false);
      setCode('');
    } catch (e) {
      note(t('Não deu para recuperar'), errText(e));
    } finally {
      setBusy(false);
    }
  };
  const turnOff = () => {
    const doIt = async () => {
      try {
        if (cloud) await removeRemote(cloud);
      } catch (e) {
        return note(t('Não deu para desligar'), errText(e));
      }
      await saveCloud(null);
      setCloud(null);
    };
    if (Platform.OS === 'web') doIt();
    else
      Alert.alert(t('Desligar a cópia na nuvem?'), t('A cópia é apagada do servidor. As mãos ficam neste telemóvel.'), [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Desligar'), style: 'destructive', onPress: doIt },
      ]);
  };

  if (cloud === undefined) return null;
  // The auto-backup is holding back: say so, «Copiar agora» lets the player decide.
  const stalled = !!cloud && cloudAhead(countsOf(buildBackup(store)), cloud);
  const health = backupHealth(cloud, now);
  const warn = waiting || stalled || health.level !== 'ok';
  const overLimit = health.level === 'failed' && health.reason === 'too_big';

  return (
    <Card style={{ gap: S.md }}>
      <Row gap={12}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: warn ? C.warnSoft : cloud ? C.goodSoft : C.surface3, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={warn ? 'cloud-offline-outline' : cloud ? 'cloud-done' : 'cloud-outline'} size={19} color={warn ? C.warn : cloud ? C.good : C.textDim} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="h3">{t('Cópia na nuvem')}</T>
          {waiting ? (
            <T v="tiny" color={C.warn}>
              {t('Sem rede: copia quando voltar')}
            </T>
          ) : stalled ? (
            <T v="tiny" color={C.warn}>
              {t('Cópia parada: tens menos do que a nuvem')}
            </T>
          ) : health.level !== 'ok' ? (
            <T v="tiny" color={C.warn}>
              {healthTitle(health)}
            </T>
          ) : (
            <T v="tiny">{cloud ? (cloud.lastAt ? t('Ligada · última {date}', { date: shortDate(cloud.lastAt) }) : t('Ligada')) : t('Sem conta e sem email')}</T>
          )}
        </View>
      </Row>
      {overLimit && onExport ? (
        // The last copy that fit stays on the server; the file keeps everything.
        <Button size="sm" icon="download-outline" title={t('Exportar tudo (ficheiro)')} onPress={onExport} />
      ) : null}
      {cloud ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Copiar código')}
            onPress={async () => {
              await Clipboard.setStringAsync(formatCode(cloud));
              note(t('Código copiado'));
            }}
            style={({ pressed }) => ({ backgroundColor: C.bgDeep, borderRadius: R.md, borderWidth: 1, borderColor: C.borderStrong, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}>
            <T selectable style={{ flex: 1, fontFamily: F.mono, fontSize: 15, letterSpacing: 1, color: C.text }}>
              {formatCode(cloud)}
            </T>
            <Ionicons name="copy-outline" size={18} color={C.accent} />
          </Pressable>
          <T v="small">{t('Guarda este código: é a única chave da tua cópia. Num telemóvel novo, usa «Recuperar com código».')}</T>
          <T v="tiny">{t('Se não abrires a app durante 18 meses, a cópia é apagada do servidor. Com as notificações ligadas, avisamos um mês antes.')}</T>
          {cloud.saved ? null : (
            // Until the player says the code is kept somewhere else, the card keeps asking.
            <View style={{ gap: S.sm, padding: 12, borderRadius: R.md, backgroundColor: C.warnSoft }}>
              <T v="small" color={C.warn}>
                {t('Ainda não guardaste o código fora deste telemóvel. Sem ele, ninguém (nem nós) consegue abrir a cópia.')}
              </T>
              <Row gap={S.sm}>
                <Button size="sm" icon="share-outline" title={t('Guardar código')} style={{ flex: 1 }} onPress={() => shareCode(cloud)} />
                <Button size="sm" kind="ghost" title={t('Já guardei')} onPress={() => saveCloud({ ...cloud, saved: true })} />
              </Row>
            </View>
          )}
          <Row gap={S.sm}>
            <Button size="sm" kind="secondary" icon="refresh" title={busy ? t('A copiar…') : t('Copiar agora')} style={{ flex: 1 }} disabled={busy} onPress={() => backupNow()} />
            <Button size="sm" kind="ghost" title={t('Desligar')} onPress={turnOff} />
          </Row>
        </>
      ) : (
        <>
          <T v="small">{t('Recebes um código e as mãos, sessões e notas ficam guardadas. Se perderes o telemóvel, não perdes nada, desde que guardes o código. Sem ele, ninguém (nem nós) consegue abrir a cópia.')}</T>
          <Button size="md" icon="cloud-upload-outline" title={busy ? t('A ativar…') : t('Ativar cópia na nuvem')} disabled={busy} onPress={turnOn} />
        </>
      )}
      {restoring ? (
        <View style={{ gap: S.sm }}>
          <Field value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="XXXXX-XXXXX-XXXXXXXXXXXXXXXX" inputStyle={{ fontFamily: F.mono }} />
          <Row gap={S.sm}>
            <Button size="sm" title={busy ? t('A recuperar…') : t('Recuperar')} style={{ flex: 1 }} disabled={busy} onPress={restore} />
            <Button size="sm" kind="ghost" title={t('Cancelar')} onPress={() => setRestoring(false)} />
          </Row>
        </View>
      ) : (
        <Button size="sm" kind="plain" icon="key-outline" title={t('Recuperar com código')} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => setRestoring(true)} />
      )}
    </Card>
  );
}

const OFFER_KEY = 'rl.cloud.offer.v1';

/** Keeps the cloud copy fresh: once the store is loaded, at most every 6 hours. Offers the copy back after a reinstall. */
export function AutoCloudBackup() {
  const store = useStore();
  const { ready } = store;
  // The timer reads the store as it is when it fires, not as it was at launch:
  // a restore in the meantime must not be overwritten by the empty first render.
  const latest = useRef(store);
  latest.current = store;
  // Also when the signal comes back: a backup due while offline goes out then.
  const online = useOnline();
  const empty = ready && store.hands.length === 0 && store.sessions.length === 0;
  // The notice a month before the server deletes an unused copy, moved on after every copy.
  // Off the launch path, and only for players with a copy (it loads the notifications module).
  useEffect(() => {
    const id = setTimeout(() => loadCloud().then((c) => c && syncCloudExpiry(c)), 8000);
    const off = onCloudChange((c) => void syncCloudExpiry(c));
    return () => {
      clearTimeout(id);
      off();
    };
  }, []);
  useEffect(() => {
    // App deleted and installed again: the keychain still has the code. Offer
    // the copy back once, before the player starts over on an empty app.
    if (!empty || !online) return;
    let live = true;
    (async () => {
      const c = await rememberedCode();
      if (!live || !c || (await AsyncStorage.getItem(OFFER_KEY).catch(() => null))) return;
      await AsyncStorage.setItem(OFFER_KEY, '1').catch(() => {});
      ask(
        t('Encontrámos a tua cópia na nuvem'),
        t('Este telemóvel guardou o código da tua cópia. Recuperar as mãos, sessões e notas?'),
        t('Recuperar'),
        () => restoreFrom(c, latest.current.importData).catch((e) => note(t('Não deu para recuperar'), errText(e))),
        t('Agora não'),
      );
    })();
    return () => {
      live = false;
    };
  }, [empty, online]);
  useEffect(() => {
    if (!ready || !online) return;
    const id = setTimeout(async () => {
      const c = await loadCloud();
      const data = buildBackup(latest.current);
      // Never replaces a cloud copy with an empty or smaller phone (see cloud-guard).
      // Due, or asked for while there was no signal.
      if (c && (copyWaiting() || autoBackup(c, countsOf(data), Date.now()) === 'upload')) upload(c, data, { onRemote: joinRemote(latest.current.importData) }).catch(() => {});
    }, 4000);
    return () => clearTimeout(id);
    // On launch and on reconnect only (the store is read through the ref).
  }, [ready, online]);
  // And after a hand is saved or a session closed: once things settle, at most every 10 minutes.
  const closed = useMemo(() => store.sessions.reduce((n, s) => n + (s.endedAt ? 1 : 0), 0), [store.sessions]);
  const changes = useRef(0);
  useEffect(() => {
    // The first run is the store loading, not a change (the launch copy above covers it).
    if (!ready || changes.current++ === 0 || !online) return;
    let live = true;
    let id: ReturnType<typeof setTimeout> | undefined;
    loadCloud().then((c) => {
      const ms = live ? changeBackupIn(c, countsOf(buildBackup(latest.current)), Date.now()) : null;
      if (ms === null) return;
      id = setTimeout(async () => {
        const now = await loadCloud();
        const data = buildBackup(latest.current);
        if (now && !uploadBlock(countsOf(data), now)) upload(now, data, { onRemote: joinRemote(latest.current.importData) }).catch(() => {});
      }, ms);
    });
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [ready, online, store.hands, closed]);
  return null;
}

function healthTitle(h: Exclude<Health, { level: 'ok' }>): string {
  if (h.level === 'failed') return h.reason === 'too_big' ? t('A cópia passou o limite: exporta para guardar tudo') : t('A última cópia na nuvem falhou');
  return !Number.isFinite(h.days) ? t('Ainda não há cópia na nuvem') : t('Última cópia na nuvem há {n} dias', { n: h.days });
}

const SUGGEST_KEY = 'rl.cloud.suggest.v1';

/**
 * Once, after the first saved hand or closed session, for players without a
 * cloud copy: one card in the home chain. Never turns it on by itself; gone
 * for good once tapped or dismissed (or once the copy is on).
 */
export function useBackupSuggestion(due: boolean): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!due) return;
    let live = true;
    Promise.all([loadCloud(), AsyncStorage.getItem(SUGGEST_KEY).catch(() => '1')]).then(([c, seen]) => live && setShow(!c && !seen));
    const off = onCloudChange((c) => c && setShow(false));
    return () => {
      live = false;
      off();
    };
  }, [due]);
  const dismiss = useCallback(() => {
    setShow(false);
    AsyncStorage.setItem(SUGGEST_KEY, '1').catch(() => {});
  }, []);
  return { show, dismiss };
}

/** «Ativar» asks first (the code is the only key), turns it on, then opens Settings with the code to keep. */
export function BackupSuggestion({ onDone }: { onDone: () => void }) {
  const store = useStore();
  return (
    <Banner
      icon="cloud-upload-outline"
      title={t('Guarda uma cópia na nuvem')}
      body={t('Se trocares ou perderes o telemóvel, não perdes nada. Sem conta nem email.')}
      action={t('Ativar')}
      onPress={() =>
        confirmTurnOn(async () => {
          onDone();
          await activate(buildBackup(store)).then(
            () => router.push('/settings'),
            () => {},
          );
        })
      }
      dismissLabel={t('Agora não')}
      onDismiss={onDone}
    />
  );
}

const SNOOZE_KEY = 'rl.backup.snooze.v1';
const SNOOZE_MS = 24 * 3600000;

/**
 * For the hands list: the warning to show, or null. Only when the cloud copy
 * is on and the last one failed or is a week old; the cross hides it for a day.
 * Kept current as copies are made or fail.
 */
export function useBackupWarning(): { health: Exclude<Health, { level: 'ok' }> | null; snooze: () => void } {
  const [health, setHealth] = useState<Health | null>(null);
  const [snoozed, setSnoozed] = useState(true);
  useEffect(() => {
    const update = (c: CloudState | null) => setHealth(backupHealth(c, Date.now()));
    loadCloud().then(update);
    AsyncStorage.getItem(SNOOZE_KEY)
      .then((v) => setSnoozed(!!v && Date.now() - Number(v) < SNOOZE_MS))
      .catch(() => setSnoozed(false));
    return onCloudChange(update);
  }, []);
  const snooze = useCallback(() => {
    setSnoozed(true);
    AsyncStorage.setItem(SNOOZE_KEY, String(Date.now())).catch(() => {});
  }, []);
  return { health: health && health.level !== 'ok' && !snoozed ? health : null, snooze };
}

/** Quiet warning card: what is wrong with the cloud copy; a tap («Fazer cópia agora») copies on the spot. */
export function BackupHealthBanner({ health, onSnooze }: { health: Exclude<Health, { level: 'ok' }>; onSnooze: () => void }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const waiting = useCopyWaiting();

  // Over the limit another try fails the same way: the export is in Settings.
  const overLimit = health.level === 'failed' && health.reason === 'too_big';
  const copyNow = async () => {
    if (overLimit) return router.push('/settings');
    const c = await loadCloud();
    if (!c || busy) return;
    tap();
    setBusy(true);
    try {
      await upload(c, buildBackup(store), { onRemote: joinRemote(store.importData) });
    } catch (e) {
      // Fewer things here than in the cloud: the choice (replace or restore) is in Settings.
      if ((e as Error)?.message === 'offline') return;
      if ((e as Error)?.message === 'would_shrink') router.push('/settings');
      else note(t('Não deu para fazer a cópia'), errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Banner
      tone="warn"
      icon="cloud-offline-outline"
      title={healthTitle(health)}
      // Same shape as the unfinished-hand card: what's wrong, then what a tap does.
      body={overLimit ? t('Exportar tudo') : busy ? t('A copiar…') : waiting ? t('Sem rede: copia quando voltar') : t('Fazer cópia agora')}
      onPress={copyNow}
      dismissLabel={t('Agora não')}
      onDismiss={onSnooze}
    />
  );
}
