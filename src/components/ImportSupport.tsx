// "Enviar ao suporte" when an import doesn't work: the player sees exactly
// what goes (the file they picked and a short note on why it failed),
// says yes, and their own mail app sends it to SUPPORT_EMAIL. Nothing leaves
// the phone without that yes, and nothing else from Sweatbook goes with it.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { attachmentName, supportEmail, type SupportCase } from '@/import/support';
import { versionLabel } from '@/lib/ota';
import { useSheetAnimation } from '@/lib/motion';
import { mailSupport } from '@/lib/support-mail';
import { C, R, S } from '@/theme';

import { SUPPORT_EMAIL } from './DataRecovery';
import { Button, Card, ListGroup, ListItem, Row, SheetHeader, T, ToggleItem } from './ui';

export type SupportFile = Omit<SupportCase, 'version' | 'platform'> & { uri?: string };

export function ImportSupport({ file, visible, onClose }: { file: SupportFile; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const animation = useSheetAnimation();
  const name = attachmentName(file);
  const kb = Math.max(1, Math.round(file.text.length / 1024));
  const close = () => {
    setOk(false);
    setSent(false);
    onClose();
  };
  const send = async () => {
    setBusy(true);
    try {
      const mail = supportEmail({ ...file, version: versionLabel(), platform: Platform.OS });
      const mime = name.endsWith('.json') ? 'application/json' : name.endsWith('.csv') ? 'text/csv' : 'application/octet-stream';
      const via = await mailSupport({ to: SUPPORT_EMAIL, ...mail, attachment: { name, uri: file.uri, text: file.text, mime } });
      if (via !== 'cancelled') setSent(true);
    } catch {
      // Mail app closed or missing: nothing was sent, the sheet stays open.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType={animation} onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={close} accessibilityLabel={t('Fechar')} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingTop: S.lg + 4, paddingHorizontal: S.gutter, paddingBottom: insets.bottom + S.md, gap: S.md }}>
        <SheetHeader title={t('Enviar ao suporte')} onClose={close} closeLabel={t('Fechar')} />
        {sent ? (
          <>
            <Row gap={S.sm}>
              <Ionicons name="checkmark-circle" size={22} color={C.good} />
              <T v="h3" style={{ flex: 1 }}>
                {t('Obrigado. Respondemos para o teu email.')}
              </T>
            </Row>
            <T v="small">{t('Se o ficheiro não entrar sozinho, importamo-lo nós e dizemos-te quando estiver pronto.')}</T>
            <Button title={t('Fechar')} onPress={close} />
          </>
        ) : (
          <>
            <T v="body" style={{ color: C.textDim }}>
              {t('Vemos o ficheiro e, se for preciso, fazemos a importação por ti. Respondemos por email em até 2 dias úteis.')}
            </T>
            <ListGroup>
              <ListItem icon="document-attach-outline" iconColor={C.accent} title={name} numberOfLines={3} subtitle={t('O ficheiro que escolheste, tal como está · {kb} KB', { kb })} chevron={false} />
              <ListItem icon="information-circle-outline" iconColor={C.accent} title={t('Uma nota sobre o que falhou')} numberOfLines={3} subtitle={t('Versão da app, tipo de telemóvel e as linhas que ficaram de fora')} chevron={false} />
            </ListGroup>
            <Card tone="inset" style={{ gap: S.xs }}>
              <Row gap={S.sm}>
                <Ionicons name="lock-closed-outline" size={16} color={C.info} />
                <T v="h3" color={C.info} style={{ flex: 1 }}>
                  {t('Só vai este ficheiro')}
                </T>
              </Row>
              <T v="small">{t('Tem as datas, salas e resultados que estão nele. Nada do que já tens no Sweatbook vai junto. Envias tu, da tua app de email.')}</T>
            </Card>
            <ListGroup>
              <ToggleItem lines={6} title={t('Aceito enviar este ficheiro ao suporte')} subtitle={SUPPORT_EMAIL} value={ok} onChange={setOk} />
            </ListGroup>
            <Button icon="mail-outline" title={busy ? t('A preparar…') : t('Abrir o email')} disabled={!ok || busy} onPress={send} />
          </>
        )}
      </View>
    </Modal>
  );
}
