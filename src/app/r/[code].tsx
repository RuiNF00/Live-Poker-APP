// Invite link opened in the app (sweatbook.poker/r/<code> or sweatbook://r/<code>):
// claim it, then send the friend straight to their first hand.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, T, Wordmark } from '@/components/ui';
import { t } from '@/i18n';
import { linkSource, noteSource } from '@/lib/attribution';
import { claimInvite, type ClaimResult } from '@/lib/referrals';
import { C, S } from '@/theme';

const COPY: Partial<Record<ClaimResult, string>> = {
  queued: 'Sem rede agora: o convite fica guardado e é ativado sozinho quando houver sinal.',
  queued_busy: 'O servidor está ocupado: o convite fica guardado e é ativado sozinho daqui a pouco.',
  ok: 'Convite ativado. Guarda a tua primeira mão e recebem os dois 50% no primeiro mês do Pro.',
  already: 'Já tens um convite ativo. Guarda uma mão para o usares.',
  self: 'Este é o teu próprio convite. Partilha-o com amigos.',
  too_late: 'Este convite já não conta: passaram mais de 7 dias desde que instalaste a app.',
  unknown_code: 'Não encontrámos este convite.',
};

export default function InviteLanding() {
  const { code, utm_campaign } = useLocalSearchParams<{ code: string; utm_campaign?: string }>();
  const insets = useSafeAreaInsets();
  const [res, setRes] = useState<ClaimResult | null>(null);
  useEffect(() => {
    if (!code) return;
    const campaign = utm_campaign ? String(utm_campaign) : undefined;
    noteSource(linkSource('invite', { utm_campaign: campaign }), campaign);
    claimInvite(String(code), 'link').then(setRes);
  }, [code, utm_campaign]);
  const msg = res ? COPY[res] : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: S.xl, paddingTop: insets.top + 48, paddingBottom: insets.bottom + S.xl, gap: S.lg }}>
      <Wordmark size={26} />
      <View style={{ flex: 1, justifyContent: 'center', gap: S.md }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="gift" size={30} color={C.accent} />
        </View>
        <T v="title">{t('Vens por convite')}</T>
        <T v="callout">{msg ? t(msg) : res ? t('Não deu para ativar o convite agora. Podes escrever o código nas Definições.') : t('A ativar o convite…')}</T>
      </View>
      <Button title={t('Registar a minha primeira mão')} icon="add" onPress={() => router.replace('/hand/new')} />
      <Button kind="ghost" size="md" title={t('Ver uma mão de exemplo')} onPress={() => router.replace('/hand/sample')} />
    </View>
  );
}
