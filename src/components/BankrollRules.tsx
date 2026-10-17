// Bankroll rules: buy-ins per stake, a stop-loss and a target. The card on
// Bankroll says which stakes the money allows; the banner on the live session
// says, gently, when the stop-loss is close or reached.

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { money } from '@/poker/format';
import { balanceOf, bankrollOf, sessionsIn } from '@/store/bankroll-math';
import { buyIn, shotState, withdrawable } from '@/store/moveup-math';
import { aboveRules, allowedStakes, DEFAULT_RULES, goalReachedLive, stopLoss, targetProgress } from '@/store/rules-math';
import { useStore } from '@/store/store';
import type { Bankroll, BankrollRules, Session } from '@/store/types';
import { C, R, S } from '@/theme';

import { Banner, Button, Card, IconButton, NumField, Row, Section, Segmented, T } from './ui';

const DAY = 86400000;

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <View style={{ height: 6, borderRadius: R.pill, backgroundColor: C.surface3, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(2, Math.min(1, value) * 100)}%`, height: 6, borderRadius: R.pill, backgroundColor: color }} />
    </View>
  );
}

/** On Bankroll, for one bankroll: what its rules allow today. */
export function RulesCard({ bankroll, sessions, balance, hidden, onEdit, onMoveUp, onWithdraw }: { bankroll: Bankroll; sessions: Session[]; balance: number; hidden: boolean; onEdit: () => void; onMoveUp?: () => void; onWithdraw?: (amount: number) => void }) {
  const cur = bankroll.currency;
  const fmt = (n: number) => (hidden ? '•••' : money(Math.round(n), cur));
  const r = bankroll.rules;
  const [now] = useState(() => Date.now());
  const info = useMemo(() => {
    if (!r) return null;
    return { a: allowedStakes(balance, r), over: aboveRules(sessions, balance, r, now - 30 * DAY, fmt), sl: r.stopLossPer === 'day' ? stopLoss(r, sessions, sessions.find((s) => !s.endedAt) ?? null, now) : null, goal: targetProgress(r, balance), keep: withdrawable(balance, sessions, r, now) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fmt changes with `hidden` and the currency only
  }, [r, sessions, balance, now, hidden, cur]);

  if (!r || !info) {
    return (
      <Card tone="inset" onPress={onEdit} style={{ gap: S.xs }} accessibilityLabel={t('Definir regras de bankroll')}>
        <T v="h3">{t('Regras de bankroll')}</T>
        <T v="small">{t('Diz quantos buy-ins queres ter por stake, um stop-loss e um objetivo. Mostramos o que o teu saldo permite jogar.')}</T>
        <T v="small" color={C.accent} style={{ marginTop: S.xs }}>
          {t('Definir regras ›')}
        </T>
      </Card>
    );
  }
  const { a, over, sl, goal, keep } = info;
  return (
    <Section title={t('Regras de bankroll')}>
      <Card style={{ gap: S.md }}>
        <Row>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">{a.cash ? t('Podes jogar até {stake}', { stake: `${a.cash.sb}/${a.cash.bb}` }) : t('Ainda não chega para {stake}', { stake: `${a.next!.sb}/${a.next!.bb}` })}</T>
            <T v="small">{t('Torneios até {amount} · {cash} buy-ins em cash, {mtt} em torneios', { amount: fmt(a.mttMax), cash: r.cashBuyIns, mtt: r.mttBuyIns })}</T>
          </View>
          <IconButton name="create-outline" size={36} label={t('Editar regras')} onPress={onEdit} />
        </Row>
        {a.next ? (
          <View style={{ gap: 6 }}>
            <Bar value={balance / a.next.need} color={C.accent} />
            <T v="tiny">{t('Para {stake} precisas de {need}: faltam {missing}.', { stake: `${a.next.sb}/${a.next.bb}`, need: fmt(a.next.need), missing: fmt(a.next.missing) })}</T>
          </View>
        ) : null}
        {over.length ? (
          <T v="small" color={C.warn}>
            {t('Nos últimos 30 dias jogaste acima das tuas regras: {list}.', { list: over.join(', ') })}
          </T>
        ) : null}
        {r.stopLoss > 0 ? (
          sl ? (
            <View style={{ gap: 6 }}>
              <T v="small">{sl.lost > 0 ? t('Stop-loss de hoje: perdeste {lost} de {limit}.', { lost: fmt(sl.lost), limit: fmt(sl.limit) }) : t('Stop-loss de {limit} por dia: hoje ainda não perdeste.', { limit: fmt(sl.limit) })}</T>
              {sl.lost > 0 ? <Bar value={sl.lost / sl.limit} color={sl.near ? C.bad : C.warn} /> : null}
            </View>
          ) : (
            <T v="small">{t('Stop-loss de {limit} por sessão: avisamos-te durante a sessão.', { limit: fmt(r.stopLoss) })}</T>
          )
        ) : null}
        {onWithdraw && keep && keep.free > 0 ? (
          <T v="small" color={C.accent} onPress={() => onWithdraw(keep.free)} accessibilityRole="link">
            {t('Podes levantar até {amount} e manter as regras ›', { amount: fmt(keep.free) })}
          </T>
        ) : null}
        {onMoveUp ? (
          <T v="small" color={C.accent} onPress={onMoveUp} accessibilityRole="link">
            {t('Posso subir de stake? ›')}
          </T>
        ) : null}
        {goal !== null ? (
          <View style={{ gap: 6 }}>
            <T v="small">{goal >= 1 ? t('Objetivo de {target} atingido.', { target: fmt(r.target) }) : t('Objetivo {target}: faltam {missing}.', { target: fmt(r.target), missing: fmt(r.target - Math.max(0, balance)) })}</T>
            <Bar value={goal} color={C.good} />
          </View>
        ) : null}
      </Card>
    </Section>
  );
}

/** Sheet body to set or change a bankroll's rules. */
export function RulesForm({ bankroll, balance, onSave, onRemove }: { bankroll: Bankroll; balance: number; onSave: (r: BankrollRules) => void; onRemove?: () => void }) {
  const [r, setR] = useState<BankrollRules>(bankroll.rules ?? DEFAULT_RULES);
  const set = (p: Partial<BankrollRules>) => setR((x) => ({ ...x, ...p }));
  const cur = bankroll.currency;
  const a = allowedStakes(balance, { ...r, cashBuyIns: Math.max(1, r.cashBuyIns), mttBuyIns: Math.max(1, r.mttBuyIns) });
  return (
    <View style={{ gap: S.lg }}>
      <Section title={t('Buy-ins que queres ter')} hint={t('Um buy-in de cash são 100 big blinds: 30 buy-ins para 2/5 são {amount}.', { amount: money(30 * 500, cur) })}>
        <Row>
          <NumField label={t('Cash')} value={r.cashBuyIns} onChange={(v) => set({ cashBuyIns: Math.min(500, v) })} />
          <NumField label={t('Torneios')} value={r.mttBuyIns} onChange={(v) => set({ mttBuyIns: Math.min(1000, v) })} />
        </Row>
        <T v="small">
          {a.cash
            ? t('Com {balance} podes jogar até {stake} e torneios até {mtt}.', { balance: money(Math.round(balance), cur), stake: `${a.cash.sb}/${a.cash.bb}`, mtt: money(a.mttMax, cur) })
            : t('Com {balance} ainda não chega para {stake}.', { balance: money(Math.round(balance), cur), stake: `${a.next!.sb}/${a.next!.bb}` })}
        </T>
      </Section>
      <Section title={t('Stop-loss')} hint={t('Quando perderes isto, avisamos-te na sessão. 0 desliga.')}>
        <Row>
          <NumField label={t('Limite ({currency})', { currency: cur })} value={r.stopLoss} onChange={(v) => set({ stopLoss: v })} />
        </Row>
        <Segmented
          options={[
            { key: 'session', label: t('Por sessão') },
            { key: 'day', label: t('Por dia') },
          ]}
          value={r.stopLossPer}
          onChange={(stopLossPer) => set({ stopLossPer })}
        />
      </Section>
      <Section title={t('Objetivo')} hint={t('O saldo que queres atingir. 0 desliga.')}>
        <Row>
          <NumField label={t('Saldo ({currency})', { currency: cur })} value={r.target} onChange={(v) => set({ target: v })} />
        </Row>
      </Section>
      <Button title={t('Guardar regras')} icon="checkmark" disabled={!(r.cashBuyIns > 0 && r.mttBuyIns > 0)} onPress={() => onSave(r)} />
      {onRemove ? <Button title={t('Tirar regras')} kind="secondary" size="md" onPress={onRemove} /> : null}
    </View>
  );
}

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
