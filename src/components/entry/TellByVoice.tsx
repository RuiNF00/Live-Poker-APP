// «Contar por voz» on a hand saved half-done: after the hand (or the session) the player tells it
// and it goes on the felt. Opens the entry screen with the voice sheet up; locked, the tap opens the
// voice's paywall instead. Small and voice-free, so it stays out of the voice chunk.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { usePro } from '@/billing/pro';
import { voiceLocked, voicePlanName } from '@/billing/voice-access';
import { t } from '@/i18n';
import { C, R, ff } from '@/theme';

import { T, tap } from '../ui';

/** Where «Contar por voz» goes: the hand's entry screen, with the voice sheet open. */
export function tellRoute(handId: string, replace = false) {
  const to = { pathname: '/hand/new' as const, params: { edit: handId, tell: '1' } };
  return replace ? router.replace(to) : router.push(to);
}

// `first`: the summary has several hands left and this opens the oldest, so the label says so.
// No fill or border: it sits under the «por completar» banner as its second way out.
export function TellByVoice({ handId, replace, first }: { handId: string; replace?: boolean; first?: boolean }) {
  const pro = usePro();
  const locked = voiceLocked(pro);
  const label = first ? t('Contar a primeira por voz') : t('Contar por voz');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}, ${voicePlanName()}` : label}
      accessibilityHint={t('Contas a mão e ela fica na mesa')}
      onPress={() => {
        tap();
        if (locked) return pro.paywall('voiceHand', () => tellRoute(handId, replace));
        tellRoute(handId, replace);
      }}
      style={({ pressed }) => ({ minHeight: 44, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.8 : 1 })}>
      <Ionicons name="mic" size={16} color={C.accent} />
      <T v="body" color={C.accent} style={{ fontWeight: '700', fontFamily: ff(700) }}>
        {label}
      </T>
      {locked ? <Ionicons name="lock-closed" size={13} color={C.accent} /> : null}
    </Pressable>
  );
}
