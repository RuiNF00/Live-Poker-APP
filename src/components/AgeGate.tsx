// The US age-range check at launch (lib/age-gate). Where Apple says the law applies and the person
// isn't a confirmed adult, a calm full screen explains why and asks again; it never closes the app
// and never locks anyone out for good. Everywhere else it renders nothing.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { askAge, checkAge } from '@/lib/age-gate';
import { opens, type AgeVerdict } from '@/lib/age-gate-core';
import { C, S } from '@/theme';

import { Button, T, Wordmark } from './ui';

/** Apple's page on sharing an age range. */
const LEARN_MORE = 'https://support.apple.com/en-us/122770';

export function AgeGate() {
  const [v, setV] = useState<AgeVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let live = true;
    checkAge().then((r) => live && setV(r), () => live && setV('unavailable'));
    return () => {
      live = false;
    };
  }, []);

  const retry = useCallback(() => {
    if (busy) return;
    setBusy(true);
    askAge()
      .then(setV, () => setV('unavailable'))
      .finally(() => setBusy(false));
  }, [busy]);

  // Back from Settings (signed in to the Apple account, changed the sharing): try again by itself.
  // Only from the background: the system sheet itself makes the app inactive and active again.
  const prev = useRef(AppState.currentState);
  useEffect(() => {
    if (!v || opens(v)) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && prev.current === 'background') retry();
      prev.current = st;
    });
    return () => sub.remove();
  }, [v, retry]);

  if (!v || opens(v)) return null;
  const body =
    v === 'minor'
      ? t('A tua conta Apple indica menos de 18 anos. Onde a lei o exige, a app só abre a quem tem 18 ou mais.')
      : v === 'declined'
        ? t('Onde a lei o exige, a app pede à Apple a tua faixa etária antes de abrir. Não guardamos a tua idade.')
        : t('Não foi possível confirmar a tua idade. Confirma que tens sessão iniciada com a tua conta Apple e tenta de novo.');
  return (
    <Modal visible animationType="none" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => {}}>
      <View
        accessibilityViewIsModal
        style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 56, paddingBottom: insets.bottom + S.xl, paddingHorizontal: S.xl, alignItems: 'center', gap: S.xl }}>
        <Wordmark size={30} />
        <Ionicons name="person-circle-outline" size={32} color={C.textDim} />
        <T v="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
          {t('A Sweatbook é só para maiores de 18')}
        </T>
        <T color={C.textDim} style={{ textAlign: 'center' }}>
          {body}
        </T>
        <Button title={t('Tentar de novo')} onPress={retry} disabled={busy} style={{ alignSelf: 'stretch' }} />
        <Button kind="ghost" size="md" title={t('Saber mais')} onPress={() => void Linking.openURL(LEARN_MORE).catch(() => {})} />
      </View>
    </Modal>
  );
}
