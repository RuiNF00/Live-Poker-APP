// Cloud backup panel: turn it on (shows the recovery code), back up now,
// restore on a new phone with the code, or turn it off.

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { download, formatCode, loadCloud, newCloud, parseCode, removeRemote, saveCloud, upload, type CloudState } from '@/lib/cloud-backup';
import { shortDate } from '@/poker/format';
import { buildBackup } from '@/store/backup';
import { useStore } from '@/store/store';
import { C, F, R } from '@/theme';

import { inputStyle } from './entry/ContextSheet';
import { Button, Panel, Row, T, tap } from './ui';

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

const ERR: Record<string, string> = {
  network: 'Sem ligação. Tenta outra vez quando tiveres rede.',
  not_found: 'Não encontrámos nenhuma cópia com esse código.',
  forbidden: 'Este código não dá acesso a esta cópia.',
  too_big: 'A cópia é grande demais para a nuvem. Exporta para ficheiro.',
  disabled: 'A cópia na nuvem ainda não está disponível. Por agora, exporta para ficheiro.',
};
const errText = (e: unknown) => t(ERR[(e as Error)?.message] ?? ERR.network);

export function CloudBackup() {
  const store = useStore();
  const [cloud, setCloud] = useState<CloudState | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    loadCloud().then(setCloud);
  }, []);

  const data = () => buildBackup(store);

  const turnOn = async () => {
    tap('medium');
    setBusy(true);
    try {
      setCloud(await upload(newCloud(), data()));
    } catch (e) {
      note(t('Não deu para ativar'), errText(e));
    } finally {
      setBusy(false);
    }
  };
  const backupNow = async () => {
    if (!cloud) return;
    tap();
    setBusy(true);
    try {
      setCloud(await upload(cloud, data()));
    } catch (e) {
      note(t('Não deu para fazer a cópia'), errText(e));
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
      const n = store.importData(await download(c));
      // From now on this phone keeps the same cloud copy up to date.
      await saveCloud(c);
      setCloud(c);
      setRestoring(false);
      setCode('');
      note(t('Cópia recuperada'), t('Novos: {h} mãos · {s} sessões · {p} jogadores. O que já tinhas ficou.', { h: n.hands, s: n.sessions, p: n.players }));
    } catch (e) {
      note(t('Não deu para recuperar'), errText(e));
    } finally {
      setBusy(false);
    }
  };
  const turnOff = () => {
    const doIt = async () => {
      if (cloud) await removeRemote(cloud);
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

  return (
    <Panel style={{ gap: 10 }}>
      <Row gap={8}>
        <Ionicons name="cloud-done-outline" size={20} color={cloud ? C.good : C.textDim} />
        <T v="h2" style={{ flex: 1 }}>
          {t('Cópia na nuvem')}
        </T>
        {cloud?.lastAt ? <T v="tiny">{t('última {date}', { date: shortDate(cloud.lastAt) })}</T> : null}
      </Row>
      {cloud ? (
        <>
          <T v="small">{t('Guarda este código. Num telemóvel novo, abre Definições › Recuperar com código. É a única chave da tua cópia.')}</T>
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(formatCode(cloud));
              note(t('Código copiado'));
            }}
            style={{ backgroundColor: C.bg, borderRadius: R.md, borderWidth: 1, borderColor: C.borderStrong, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T selectable style={{ flex: 1, fontFamily: F.mono, fontSize: 15, letterSpacing: 1, color: C.text }}>
              {formatCode(cloud)}
            </T>
            <Ionicons name="copy-outline" size={18} color={C.textDim} />
          </Pressable>
          <T v="tiny">{t('A cópia atualiza-se sozinha quando abres a app. Usa o código num telemóvel de cada vez: o último a copiar substitui a cópia.')}</T>
          <Row gap={8}>
            <Button small title={busy ? t('A copiar…') : t('Fazer cópia agora')} style={{ flex: 1 }} disabled={busy} onPress={backupNow} />
            <Button small kind="ghost" title={t('Desligar')} onPress={turnOff} />
          </Row>
        </>
      ) : (
        <>
          <T v="small">{t('Sem conta e sem email: recebes um código e as tuas mãos, sessões e notas ficam guardadas no nosso servidor.')}</T>
          <Button small title={busy ? t('A ativar…') : t('Ativar cópia na nuvem')} disabled={busy} onPress={turnOn} />
        </>
      )}
      {restoring ? (
        <View style={{ gap: 8 }}>
          <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="XXXXX-XXXXX-XXXXXXXXXXXXXXXX" placeholderTextColor={C.muted} style={[inputStyle, { fontFamily: F.mono }]} />
          <Row gap={8}>
            <Button small title={busy ? t('A recuperar…') : t('Recuperar')} style={{ flex: 1 }} disabled={busy} onPress={restore} />
            <Button small kind="ghost" title={t('Cancelar')} onPress={() => setRestoring(false)} />
          </Row>
        </View>
      ) : (
        <Pressable onPress={() => setRestoring(true)} hitSlop={6}>
          <T v="small" color={C.accent}>
            {t('Recuperar com código')}
          </T>
        </Pressable>
      )}
    </Panel>
  );
}

/** Keeps the cloud copy fresh: once the store is loaded, at most every 6 hours. */
export function AutoCloudBackup() {
  const store = useStore();
  const { ready } = store;
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(async () => {
      const c = await loadCloud();
      if (!c || (c.lastAt && Date.now() - c.lastAt < 6 * 3600000)) return;
      upload(c, buildBackup(store)).catch(() => {});
    }, 4000);
    return () => clearTimeout(id);
    // Only on launch: the store object changes on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}
