// "Posso subir de stake?": bankroll management, not a push to play bigger.
// Free: the bankroll in buy-ins for the stake played and the next one, against
// the player's own rule. Pro: risk of ruin from their win rate and spread, and
// a shot plan with the point where they go back down (reminded on the session
// screen). Staying, or stopping, is always on the table.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ProBlur, useLocked } from '@/components/ProGate';
import { Button, Card, Chip, ChipRow, Empty, Row, Section, T, tap } from '@/components/ui';
import { WinRateSample } from '@/components/WinRate';
import { locale, t } from '@/i18n';
import { money } from '@/poker/format';
import { balanceOf, sessionsIn } from '@/store/bankroll-math';
import { buyIn, buyInsForRisk, currentStake, moveUp, riskOfRuin, shotState, type Stake } from '@/store/moveup-math';
import { DEFAULT_RULES } from '@/store/rules-math';
import { useStore } from '@/store/store';
import type { Bankroll, ShotPlan } from '@/store/types';
import { cashDone, winRate, type WinRate } from '@/store/winrate-math';
import { C, R, S } from '@/theme';

const RULES = [20, 30, 40, 50, 100];
const name = (s: Stake) => `${s.sb}/${s.bb}`;
const one = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: n < 10 ? 1 : 0 });
const pct = (p: number) => (p < 0.001 ? t('menos de 0,1%') : p > 0.99 ? t('quase 100%') : `${(p * 100).toLocaleString(locale, { maximumFractionDigits: p < 0.1 ? 1 : 0 })}%`);

export default function MoveUpScreen() {
  const { sessions, bankrolls, transfers, defaultBankroll, settings, saveBankroll } = useStore();
  const locked = useLocked('moveUpPlan');
  const params = useLocalSearchParams<{ bankroll?: string }>();
  const b: Bankroll = bankrolls.find((x) => x.id === params.bankroll) ?? defaultBankroll;
  const cur = b.currency;
  const hidden = !!settings.hideAmounts;
  const fmt = (n: number) => (hidden ? '•••' : money(Math.round(n), cur));
  const list = useMemo(() => sessionsIn({ bankrollId: b.id }, sessions, bankrolls), [b.id, sessions, bankrolls]);
  const balance = useMemo(() => balanceOf({ bankrollId: b.id }, sessions, transfers, bankrolls).balance, [b.id, sessions, transfers, bankrolls]);
  const stake = useMemo(() => currentStake(list), [list]);
  const w = useMemo(() => winRate(cashDone(list, cur)), [list, cur]);
  const rules = b.rules ?? DEFAULT_RULES;
  const m = stake ? moveUp(balance, stake, rules) : null;
  const setRule = (cashBuyIns: number) => {
    tap('select');
    saveBankroll({ ...b, rules: { ...rules, cashBuyIns } });
  };

  if (!stake || !m) {
    return (
      <>
        <Stack.Screen options={{ title: t('Posso subir de stake?') }} />
        <View style={{ flex: 1, backgroundColor: C.bg, padding: S.gutter }}>
          <Empty icon="layers-outline" title={t('Ainda sem sessões de cash')} body={t('Com sessões de cash neste bankroll mostramos quantos buy-ins tens para a tua stake e para a de cima.')} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('Posso subir de stake?') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}>
        <Card tone="raised" style={{ gap: S.md }}>
          <T v="label">{t('{bankroll} · {amount}', { bankroll: b.name, amount: fmt(balance) })}</T>
          <T v="h2">
            {!m.next
              ? t('Já jogas a stake mais alta da lista.')
              : m.ready
                ? t('Pela tua regra, o bankroll chega para {stake}.', { stake: name(m.next) })
                : t('Ainda não, pela tua regra de {n} buy-ins.', { n: m.rule })}
          </T>
          <Row gap={S.sm}>
            <Tile label={name(m.cur)} sub={t('A tua stake')} value={one(m.curBuyIns)} ok={m.curBuyIns >= m.rule} rule={m.rule} />
            {m.next ? <Tile label={name(m.next)} sub={t('A de cima')} value={one(m.nextBuyIns!)} ok={m.ready} rule={m.rule} /> : null}
          </Row>
          {m.next ? (
            <T v="small">
              {m.ready
                ? t('Para {stake} a tua regra pede {need}, e tens {amount}.', { stake: name(m.next), need: fmt(m.need!), amount: fmt(balance) })
                : t('Para {stake} a tua regra pede {need}: faltam {missing}.', { stake: name(m.next), need: fmt(m.need!), missing: fmt(m.missing) })}
            </T>
          ) : null}
          <Row gap={6} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="information-circle-outline" size={15} color={C.muted} style={{ marginTop: 2 }} />
            <T v="tiny" style={{ flex: 1 }}>
              {t('Subir é uma opção, não um objetivo. Ficar na tua stake, ou parar, também são boas decisões.')}
            </T>
          </Row>
        </Card>

        <Section title={t('A tua regra')} hint={t('Buy-ins de 100 big blinds que queres ter para jogar uma stake de cash. Mais buy-ins, menos risco.')}>
          <ChipRow>
            {RULES.map((r) => (
              <Chip key={r} label={t('{n} buy-ins', { n: r })} active={rules.cashBuyIns === r} onPress={() => setRule(r)} />
            ))}
          </ChipRow>
        </Section>

        <Section title={t('Risco de ruína')}>
          <ProBlur feature="moveUpPlan" locked={locked} title={t('Vê o teu risco de ruína com os teus números')}>
            {w ? <Risk w={w} m={m} balance={balance} masked={locked} /> : <Card tone="inset"><T v="small">{t('Com 3 sessões de cash terminadas calculamos o teu risco de ruína.')}</T></Card>}
          </ProBlur>
        </Section>

        {m.next ? (
          <Section title={t('Plano de tentativa')} hint={t('Não é um conselho para jogar mais: é um limite que defines antes de te sentares.')}>
            <ProBlur feature="moveUpPlan" locked={locked} title={t('Define quanto arriscas antes de tentar a stake de cima')}>
              <Shot b={b} list={list} cur={m.cur} next={m.next} fmt={locked ? () => '•••' : fmt} onSave={(shot) => saveBankroll({ ...b, shot })} />
            </ProBlur>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}

function Tile({ label, sub, value, ok, rule }: { label: string; sub: string; value: string; ok: boolean; rule: number }) {
  return (
    <View style={{ flex: 1, gap: 4, padding: S.md, borderRadius: R.md, backgroundColor: C.surface2 }}>
      <T v="label">{`${label} · ${sub}`}</T>
      <T v="monoL" color={ok ? C.good : C.text}>
        {value}
      </T>
      <T v="tiny">{t('buy-ins (regra: {n})', { n: rule })}</T>
    </View>
  );
}

function Risk({ w, m, balance, masked }: { w: WinRate; m: ReturnType<typeof moveUp>; balance: number; masked: boolean }) {
  const show = (p: number) => (masked ? '•••' : pct(p));
  // The prudent count: the bottom of the 95% range, not the average win rate.
  const low = { bbHourly: w.bbLo, sdBb: w.sdBb };
  const winning = low.bbHourly > 0;
  const need = m.next ? buyInsForRisk(0.05, low) : null;
  const rows: [Stake, number][] = [[m.cur, riskOfRuin(balance, m.cur, low)], ...(m.next ? [[m.next, riskOfRuin(balance, m.next, low)] as [Stake, number]] : [])];
  return (
    <Card style={{ gap: S.md }}>
      <T v="small">
        {t('A probabilidade de perderes o bankroll todo. Usamos o limite de baixo do teu win rate ({lo} BB/h, a média é {bb}) e o teu desvio padrão de {sd} BB/h: é a conta prudente.', {
          lo: (w.bbLo > 0 ? '+' : '') + one(w.bbLo),
          bb: (w.bbHourly > 0 ? '+' : '') + one(w.bbHourly),
          sd: one(w.sdBb),
        })}
      </T>
      {rows.map(([s, p]) => (
        <Row key={name(s)}>
          <T v="body" style={{ flex: 1 }}>
            {name(s)}
          </T>
          <T v="mono" color={p >= 0.2 ? C.bad : p >= 0.05 ? C.warn : C.good}>
            {show(p)}
          </T>
        </Row>
      ))}
      {winning && need !== null && m.next ? (
        <T v="small">{t('Para um risco de 5% em {stake} precisarias de cerca de {n} buy-ins.', { stake: name(m.next), n: masked ? '•••' : Math.ceil(need) })}</T>
      ) : null}
      <WinRateSample w={w} />
      <T v="tiny">
        {winning
          ? t('Conta com o mesmo win rate em BB/h na stake de cima, o que é otimista: as mesas maiores costumam ser mais difíceis.')
          : w.bbHourly > 0
            ? t('O teu win rate ainda pode ser zero ou negativo: com esta incerteza, o risco não fica limitado em nenhuma stake. Mais horas na tua stake tornam a conta mais firme.')
            : t('Com um win rate que não é positivo, o risco de perder o bankroll é alto em qualquer stake, e maior nas de cima.')}
      </T>
    </Card>
  );
}

function Shot({ b, list, cur, next, fmt, onSave }: { b: Bankroll; list: ReturnType<typeof sessionsIn>; cur: Stake; next: Stake; fmt: (n: number) => string; onSave: (s: ShotPlan | undefined) => void }) {
  const [size, setSize] = useState(5);
  const [stop, setStop] = useState(2);
  const plan = b.shot;
  if (plan) {
    const st = shotState(plan, list);
    const at = name(plan);
    const back = name(plan.back);
    return (
      <Card style={{ gap: S.md }}>
        <T v="h3">{t('Tentativa em {stake}', { stake: at })}</T>
        <T v="small">{t('Levaste {n} buy-ins ({amount}) para {stake}; se perderes {k}, voltas a {back}.', { n: plan.buyIns, amount: fmt(plan.buyIns * buyIn(plan)), stake: at, k: plan.stopAfter, back })}</T>
        <View style={{ height: 6, borderRadius: R.pill, backgroundColor: C.surface3, overflow: 'hidden' }}>
          <View style={{ width: `${Math.max(2, Math.min(1, st.lostBuyIns / plan.stopAfter) * 100)}%`, height: 6, borderRadius: R.pill, backgroundColor: st.over ? C.bad : C.warn }} />
        </View>
        <T v="body" color={st.over ? C.warn : C.text}>
          {st.over
            ? t('Chegaste ao limite que definiste: o combinado era voltar a {back}.', { back })
            : st.sessions
              ? st.sessions === 1
                ? t('1 sessão em {stake}, resultado {amount}. Ainda podes perder {left} buy-ins antes de voltares.', { stake: at, amount: fmt(st.net), left: one(st.left) })
                : t('{n} sessões em {stake}, resultado {amount}. Ainda podes perder {left} buy-ins antes de voltares.', { n: st.sessions, stake: at, amount: fmt(st.net), left: one(st.left) })
              : t('Ainda sem sessões em {stake}. Quando começares uma, lembramos-te do limite.', { stake: at })}
        </T>
        <Button kind="secondary" size="md" title={t('Terminar a tentativa')} onPress={() => onSave(undefined)} />
      </Card>
    );
  }
  return (
    <Card style={{ gap: S.md }}>
      <T v="label">{t('Buy-ins que levas para {stake}', { stake: name(next) })}</T>
      <ChipRow>
        {[3, 5, 10].map((n) => (
          <Chip key={n} label={String(n)} active={size === n} onPress={() => setSize(n)} />
        ))}
      </ChipRow>
      <T v="label">{t('Voltas a {stake} se perderes', { stake: name(cur) })}</T>
      <ChipRow>
        {[1, 2, 3].map((n) => (
          <Chip key={n} label={n === 1 ? t('1 buy-in') : t('{n} buy-ins', { n })} active={stop === n} onPress={() => setStop(Math.min(n, size))} />
        ))}
      </ChipRow>
      <T v="body">{t('Levas {n} buy-ins ({amount}) para {stake}; se perderes {k}, voltas a {back}.', { n: size, amount: fmt(size * buyIn(next)), stake: name(next), k: stop, back: name(cur) })}</T>
      <Button
        title={t('Guardar plano')}
        icon="flag-outline"
        onPress={() => {
          tap('success');
          onSave({ sb: next.sb, bb: next.bb, buyIns: size, stopAfter: stop, back: { sb: cur.sb, bb: cur.bb }, startedAt: Date.now() });
        }}
      />
    </Card>
  );
}
