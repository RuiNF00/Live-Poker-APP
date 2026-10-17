// Settings: values the app set aside at launch because they couldn't be read
// (see store/boot.ts). They stay on the phone and in the cloud copy; this card
// lets the player send them to support as a file they share themselves.
// Nothing goes to a server.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { t } from '@/i18n';
import { saveTextFile } from '@/lib/files';
import { versionLabel } from '@/lib/ota';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

import { Button, Card, Row, T } from './ui';

export const SUPPORT_EMAIL = 'support@sweatbook.poker';

/** The file for support: the raw values exactly as they were, and which version set them aside. */
export function quarantineFile(quarantine: [string, string][], now = Date.now()) {
  return JSON.stringify({ app: 'sweatbook', kind: 'quarantine', version: versionLabel(), platform: Platform.OS, exportedAt: now, records: quarantine.map(([key, raw]) => ({ key, raw })) }, null, 2);
}

export function DataRecovery() {
  const { quarantine } = useStore();
  const [busy, setBusy] = useState(false);
  if (!quarantine.length) return null;
  const send = async () => {
    setBusy(true);
    try {
      await saveTextFile('sweatbook-dados-a-parte.json', quarantineFile(quarantine), 'application/json');
    } catch {
      // Share sheet closed or not available: nothing to undo.
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ gap: S.md }}>
      <Row gap={12}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.warnSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="medkit-outline" size={19} color={C.warn} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="h3">{t('Dados guardados à parte')}</T>
          <T v="tiny">{(quarantine.length === 1 ? t('1 registo não abriu nesta versão') : t('{n} registos não abriram nesta versão', { n: quarantine.length }))}</T>
        </View>
      </Row>
      <T v="small">{t('Estão guardados neste telemóvel (e na cópia na nuvem, se a tiveres) e voltam sozinhos quando uma versão nova os conseguir ler. Para ajudarmos já, envia o ficheiro por email para {email}. Leva só esses registos.', { email: SUPPORT_EMAIL })}</T>
      <Button size="sm" kind="secondary" icon="mail-outline" title={busy ? t('A preparar…') : t('Enviar ao suporte')} disabled={busy} onPress={send} />
    </Card>
  );
}
