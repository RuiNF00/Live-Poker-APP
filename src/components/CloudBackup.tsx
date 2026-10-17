// Cloud backup panel: turn it on (shows the recovery code), back up now,
// restore on a new phone with the code, or turn it off.

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { download, formatCode, loadCloud, newCloud, parseCode, removeRemote, saveCloud, upload, type CloudState } from '@/lib/cloud-backup';
import { shortDate } from '@/poker/format';
import { buildBackup, importSummary } from '@/store/backup';
import { useStore } from '@/store/store';
import { C, F, R, S } from '@/theme';

import { Button, Card, Field, Row, T, tap } from './ui';

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

const ERR: Record<string, string> = {
  network: 'Sem ligação. Tenta outra vez quando tiveres rede.',
  not_found: 'Não encontrámos nenhuma cópia com esse código.',
  forbidden: 'Este código não dá acesso a esta cópia.',
  too_big: 'A cópia é grande demais para a nuvem. Exporta para ficheiro.',
  quota: 'O servidor está cheio de momento. As tuas mãos estão seguras neste telemóvel; tentamos outra vez mais tarde.',
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
      note(t('Cópia recuperada'), importSummary(n));
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

  return (
    <Card style={{ gap: S.md }}>
      <Row gap={12}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: cloud ? C.goodSoft : C.surface3, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={cloud ? 'cloud-done' : 'cloud-outline'} size={19} color={cloud ? C.good : C.textDim} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="h3">{t('Cópia na nuvem')}</T>
          <T v="tiny">{cloud ? (cloud.lastAt ? t('Ligada · última {date}', { date: shortDate(cloud.lastAt) }) : t('Ligada')) : t('Sem conta e sem email')}</T>
        </View>
      </Row>
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
          <Row gap={S.sm}>
            <Button size="sm" kind="secondary" icon="refresh" title={busy ? t('A copiar…') : t('Copiar agora')} style={{ flex: 1 }} disabled={busy} onPress={backupNow} />
            <Button size="sm" kind="ghost" title={t('Desligar')} onPress={turnOff} />
          </Row>
        </>
      ) : (
        <>
          <T v="small">{t('Recebes um código e as mãos, sessões e notas ficam guardadas. Se perderes o telemóvel, não perdes nada.')}</T>
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
