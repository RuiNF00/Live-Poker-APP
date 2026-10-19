// iPhone, first run: the friend came from an invite page, which copied the invite link when
// they tapped the App Store button. Apple's paste button reads it on one tap, with no
// "allow paste" prompt and nothing read without the tap. No account, no device id.

import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Card, Row, T } from '@/components/ui';
import { t } from '@/i18n';
import { inviteCodeFrom } from '@/lib/invite-code';
import { notice } from '@/lib/notice';
import { canEnterCode, claimInvite } from '@/lib/referrals';
import { C, S } from '@/theme';

/** Shown only on iOS 16+, in the first 7 days, until an invite is accepted, and when there's text to paste. */
export function InvitePaste({ onClaimed }: { onClaimed: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !Clipboard.isPasteButtonAvailable) return;
    let live = true;
    Promise.all([canEnterCode(), Clipboard.hasStringAsync()])
      .then(([open, text]) => live && setShow(open && text))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!show) return null;
  const paste = async (data: Clipboard.PasteEventPayload) => {
    const code = data.type === 'text' ? inviteCodeFrom(data.text) : null;
    if (!code) return notice(t('Não encontrámos este convite.'), t('Abre outra vez o link que o teu amigo te mandou.'));
    const r = await claimInvite(code, 'manual');
    if (r === 'ok' || r === 'already' || r === 'queued' || r === 'queued_busy') {
      setShow(false);
      onClaimed();
    } else if (r === 'too_late') notice(t('Os convites só contam nos 7 dias depois de instalar.'));
    else notice(t('Não deu para ativar o convite agora. Podes escrever o código nas Definições.'));
  };
  return (
    <Card tone="raised" style={{ gap: S.sm }}>
      <Row gap={S.md}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3">{t('Vens por convite?')}</T>
          <T v="small">{t('Cola o link do convite: tu e o teu amigo recebem 50% no primeiro mês do Pro com a tua primeira mão.')}</T>
        </View>
        <Clipboard.ClipboardPasteButton
          onPress={paste}
          acceptedContentTypes={['plain-text']}
          displayMode="iconAndLabel"
          backgroundColor={C.accent}
          foregroundColor={C.bg}
          cornerStyle="medium"
          style={{ width: 100, height: 44 }}
        />
      </Row>
    </Card>
  );
}
