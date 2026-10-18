// The session summary's Pro card: the hands the free limit kept out of this
// session, or this session's hourly rate. Opens the one paywall. See
// sessionEndCard in src/billing/session-limit.ts.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { blockedIn, sessionEndCard } from '@/billing/session-limit';
import { T } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

export function SessionEndPro({ sessionId, profit, hours, game, currency, hideMoney }: { sessionId: string; profit: number; hours: number; game: 'mtt' | 'cash'; currency: string; hideMoney: boolean }) {
  const { isPro, paywall } = usePro();
  const { hands } = useStore();
  const [blocked, setBlocked] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const saved = new Set(hands.map((h) => h.id));
    blockedIn(sessionId, (id) => saved.has(id)).then((n) => live && setBlocked(n));
    return () => {
      live = false;
    };
  }, [sessionId, hands]);
  if (blocked === null) return null;
  const card = sessionEndCard({ isPro, profit, blocked, hours, game });
  if (!card) return null;

  const rate = hideMoney ? '•••' : money(profit / hours, currency);
  const title = card.kind === 'blocked' ? (card.n === 1 ? t('1 mão desta sessão ficou por guardar') : t('{n} mãos desta sessão ficaram por guardar', { n: card.n })) : t('Esta sessão: {rate}/h', { rate });
  const body = card.kind === 'blocked' ? t('Com Pro guardas todas, sem limite por dia.') : t('Com Pro vês em que sala e stake ganhas mais.');
  return (
    <Pressable accessibilityRole="button" accessibilityHint={t('Abre o Sweatbook Pro')} onPress={() => paywall('sessionEnd')}>
      {({ pressed }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: R.lg, borderWidth: 1, borderColor: C.accent, backgroundColor: C.accentSoft, opacity: pressed ? 0.8 : 1 }}>
          <Ionicons name={card.kind === 'blocked' ? 'albums' : 'flash'} size={20} color={C.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">{title}</T>
            <T v="small">{body}</T>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.accent} />
        </View>
      )}
    </Pressable>
  );
}
