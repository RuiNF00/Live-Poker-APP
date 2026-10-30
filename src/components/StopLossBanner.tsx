// The live session's stop-loss, move-up and goal notices. Apart from BankrollRules.tsx (the rules card
// and form, only on the bankroll tab) so the session tab doesn't put those in the launch bundle.

import React, { useMemo, useState } from 'react';

import { t } from '@/i18n';
import { money } from '@/poker/format';
import { balanceOf, bankrollOf, sessionsIn } from '@/store/bankroll-math';
import { buyIn, shotState } from '@/store/moveup-math';
import { goalReachedLive, stopLoss } from '@/store/rules-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';

import { Banner } from './ui';

/**
 * For the live session screen: a quiet warning near the stop-loss, a clear
 * one once it is reached, and a calm note when the session takes the bankroll
 * past its target. Each can be closed; amounts follow privacy mode. Nothing
 * when the bankroll has no rules.
 */
export function StopLossBanner({ s }: { s: Session }) {
  const { sessions, bankrolls, transfers, settings } = useStore();
  const b = bankrollOf(s, bankrolls);
  const sl = useMemo(() => stopLoss(b?.rules, b ? sessionsIn({ bankrollId: b.id }, sessions, bankrolls) : [], s), [b, sessions, bankrolls, s]);
  const goal = useMemo(() => (b?.rules?.target ? goalReachedLive(b.rules, balanceOf({ bankrollId: b.id }, sessions, transfers, bankrolls).balance, s) : false), [b, sessions, transfers, bankrolls, s]);
  const shot = useMemo(() => {
    const p = b?.shot;
    if (!p || s.kind !== 'cash' || s.sb !== p.sb || s.bb !== p.bb) return null;
    return shotState(p, sessionsIn({ bankrollId: b!.id }, sessions, bankrolls));
  }, [b, s, sessions, bankrolls]);
  const [dismissed, setDismissed] = useState<'near' | 'hit' | 'goal' | 'shot' | null>(null);
  const fmt = (n: number) => (settings.hideAmounts ? '•••' : money(Math.round(n), s.currency));
  if (sl?.near) {
    const level = sl.hit ? 'hit' : 'near';
    if (dismissed === level || (dismissed === 'hit' && level === 'near')) return null;
    const scope = sl.per === 'day' ? t('hoje') : t('nesta sessão');
    return (
      <Banner
        tone="warn"
        icon={sl.hit ? 'hand-left-outline' : 'alert-circle-outline'}
        title={sl.hit ? t('Chegaste ao teu stop-loss') : t('Estás perto do teu stop-loss')}
        body={sl.hit ? t('Perdeste {lost} {scope}; o teu limite é {limit}. Pode ser boa altura para parar.', { lost: fmt(sl.lost), scope, limit: fmt(sl.limit) }) : t('Faltam {left} para o limite de {limit} {scope}.', { left: fmt(sl.left), limit: fmt(sl.limit), scope })}
        onDismiss={() => setDismissed(level)}
        dismissLabel={t('Fechar aviso')}
      />
    );
  }
  if (shot && dismissed !== 'shot') {
    const p = shot.plan;
    const back = `${p.back.sb}/${p.back.bb}`;
    return (
      <Banner
        tone={shot.over ? 'warn' : 'info'}
        icon="flag-outline"
        title={shot.over ? t('Combinaste voltar a {back}', { back }) : t('Tentativa em {stake}', { stake: `${p.sb}/${p.bb}` })}
        body={
          shot.over
            ? t('Já perdeste {n} buy-ins nesta stake desde o início da tentativa. Parar ou voltar a {back} era o teu plano.', { n: Math.round(shot.lostBuyIns * 10) / 10, back })
            : t('Ainda podes perder {amount} antes de voltares a {back}, como definiste.', { amount: fmt(shot.left * buyIn(p)), back })
        }
        onDismiss={() => setDismissed('shot')}
        dismissLabel={t('Fechar aviso')}
      />
    );
  }
  if (goal && b?.rules && dismissed !== 'goal') {
    return (
      <Banner
        tone="good"
        icon="flag-outline"
        title={t('Objetivo de bankroll atingido')}
        body={t('Com esta sessão passas os {target}. Boa altura para decidir se paras ou se sobes de stake.', { target: fmt(b.rules.target) })}
        onDismiss={() => setDismissed('goal')}
        dismissLabel={t('Fechar aviso')}
      />
    );
  }
  return null;
}
