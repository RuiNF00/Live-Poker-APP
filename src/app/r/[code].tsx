// Invite link opened in the app (sweatbook.poker/r/<code> or sweatbook://r/<code>):
// claim it, then send the friend straight to their first hand.

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, T, Wordmark } from '@/components/ui';
import { t } from '@/i18n';
import { claimInvite, type ClaimResult } from '@/lib/referrals';
import { C } from '@/theme';

const COPY: Partial<Record<ClaimResult, string>> = {
  ok: 'Convite ativado. Guarda a tua primeira mão e ganham os dois 7 dias de Pro.',
  already: 'Já tens um convite ativo. Guarda uma mão para o usares.',
  self: 'Este é o teu próprio convite. Partilha-o com amigos.',
  too_late: 'Este convite já não conta: passaram mais de 7 dias desde que instalaste a app.',
  unknown_code: 'Não encontrámos este convite.',
};

export default function InviteLanding() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const [res, setRes] = useState<ClaimResult | null>(null);
  useEffect(() => {
    if (code) claimInvite(String(code), 'link').then(setRes);
  }, [code]);
  const msg = res ? COPY[res] : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: insets.top + 40, gap: 18, alignItems: 'center' }}>
      <Wordmark />
      <T v="h1" style={{ textAlign: 'center' }}>
        {t('Vens por convite')}
      </T>
      <T v="body" style={{ textAlign: 'center', color: C.textDim }}>
        {msg ? t(msg) : res ? t('Não deu para ativar o convite agora. Podes escrever o código nas Definições.') : t('A ativar o convite…')}
      </T>
      <Button title={t('Registar a minha primeira mão')} style={{ alignSelf: 'stretch' }} onPress={() => router.replace('/hand/new')} />
      <Button kind="ghost" title={t('Ver uma mão de exemplo')} onPress={() => router.replace('/hand/sample')} />
    </View>
  );
}
