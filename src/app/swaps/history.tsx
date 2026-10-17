// Swap history: what swaps won or cost, per partner and per series, and how much they evened
// out results. One number and a verdict first; the detail after. Only once there's enough data.

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { withPro } from '@/components/ProGate';
import { Avatar } from '@/components/Avatar';
import { Card, Empty, ListGroup, ListItem, Row, Screen, Section, T } from '@/components/ui';
import { t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { MIN_PRIZES, MIN_SESSIONS, swapHistory, type HistoryLine } from '@/store/swap-history';
import { useGroups } from '@/store/swap-groups-store';
import { useSwaps } from '@/store/swaps-store';
import { C, R, S } from '@/theme';

const signed = (n: number, cur: string) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n), cur);

function SwapHistoryScreen() {
  const { swaps } = useSwaps();
  const { groups } = useGroups();
  const { sessions, settings } = useStore();
  const h = useMemo(() => swapHistory(swaps, groups, sessions), [swaps, groups, sessions]);
  const hidden = !!settings.hideAmounts;
  const show = (n: number, cur: string) => (hidden ? '•••' : signed(n, cur));

  if (!h.enough) {
    return (
      <>
        <Stack.Screen options={{ title: t('Histórico de swaps'), headerBackTitle: t('Voltar') }} />
        <Screen>
          <Empty
            icon="analytics-outline"
            title={t('Ainda poucos dados')}
            body={t('O histórico aparece quando houver pelo menos {min} prémios registados nos teus swaps. Tens {n}.', { min: MIN_PRIZES, n: h.prizes })}
          />
        </Screen>
      </>
    );
  }

  const main = h.total[0];
  return (
    <>
      <Stack.Screen options={{ title: t('Histórico de swaps'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <Card tone="raised" style={{ gap: S.xs, paddingVertical: S.xl }}>
          <T v="label">{main.net >= 0 ? t('Com swaps, ganhaste') : t('Os swaps custaram-te')}</T>
          <T v="monoXL" color={main.net >= 0 ? C.good : C.warn} numberOfLines={1} adjustsFontSizeToFit>
            {hidden ? '•••' : money(Math.abs(main.net), main.currency)}
          </T>
          <T v="small">
            {main.net >= 0
              ? t('Os outros cobraram mais do que tu nos teus swaps. {deals} acordos, {prizes} prémios.', { deals: main.deals, prizes: main.prizes })
              : t('Cobraste mais do que os teus parceiros: é o preço de reduzir o risco. {deals} acordos, {prizes} prémios.', { deals: main.deals, prizes: main.prizes })}
          </T>
          {h.total.slice(1).map((x) => (
            <T key={x.currency} v="small">
              {t('Em {cur}: {amount}', { cur: x.currency, amount: show(x.net, x.currency) })}
            </T>
          ))}
        </Card>

        {h.variance ? (
          <Card style={{ gap: S.md }}>
            <Row gap={S.sm} style={{ alignItems: 'center' }}>
              <Ionicons name="pulse-outline" size={20} color={C.accent} />
              <T v="h3" style={{ flex: 1 }}>
                {h.variance.reduction > 0
                  ? t('Os swaps reduziram a tua variância em {pct}%', { pct: Math.round(h.variance.reduction * 100) })
                  : t('Os swaps ainda não reduziram a tua variância')}
              </T>
            </Row>
            <SpreadBar label={t('Sem swaps')} value={h.variance.sdWithout} max={h.variance.sdWithout} cur={h.variance.currency} hidden={hidden} color={C.muted} />
            <SpreadBar label={t('Com swaps')} value={h.variance.sdWith} max={h.variance.sdWithout} cur={h.variance.currency} hidden={hidden} color={C.accent} />
            <T v="tiny" color={C.muted}>
              {t('Desvio padrão do resultado por torneio, em {n} torneios com swaps.', { n: h.variance.sessions })}
            </T>
          </Card>
        ) : (
          <Card tone="inset">
            <T v="small">{t('A redução da variância aparece com pelo menos {min} torneios terminados com swaps.', { min: MIN_SESSIONS })}</T>
          </Card>
        )}

        <Section title={t('Por parceiro')}>
          <ListGroup>
            {h.byPartner.map((x) => (
              <Line key={x.key + x.currency} x={x} show={show} group={x.key.startsWith('group:')} />
            ))}
          </ListGroup>
        </Section>

        <Section title={t('Por série')}>
          <ListGroup>
            {h.bySeries.map((x) => (
              <Line key={x.key + x.currency} x={x} show={show} series />
            ))}
          </ListGroup>
        </Section>

        <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }} color={C.muted}>
          {t('Conta a tua parte dos prémios dos outros menos o que deste dos teus. Os pagamentos só acertam contas.')}
        </T>
      </Screen>
    </>
  );
}

function Line({ x, show, group, series }: { x: HistoryLine; show: (n: number, cur: string) => string; group?: boolean; series?: boolean }) {
  return (
    <ListItem
      left={
        series || group ? (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={group ? 'people' : 'calendar-outline'} size={19} color={C.accent} />
          </View>
        ) : (
          <Avatar name={x.label} />
        )
      }
      title={x.label}
      subtitle={
        <T v="small" numberOfLines={1}>
          {[x.deals === 1 ? t('1 acordo') : t('{n} acordos', { n: x.deals }), x.prizes === 1 ? t('1 prémio') : t('{n} prémios', { n: x.prizes })].join(' · ')}
        </T>
      }
      right={
        <T v="mono" color={x.net > 0.5 ? C.good : x.net < -0.5 ? C.warn : C.textDim} style={{ fontSize: 15 }}>
          {show(x.net, x.currency)}
        </T>
      }
    />
  );
}

function SpreadBar({ label, value, max, cur, hidden, color }: { label: string; value: number; max: number; cur: string; hidden: boolean; color: string }) {
  const w = max > 0 ? Math.max(0.04, Math.min(1, value / max)) : 0;
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="small">{label}</T>
        <T v="mono" color={C.textDim}>
          ±{hidden ? '•••' : money(value, cur)}
        </T>
      </Row>
      <View style={{ height: 8, borderRadius: R.sm, backgroundColor: C.hairline, overflow: 'hidden' }}>
        <View style={{ width: `${w * 100}%`, height: 8, borderRadius: R.sm, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default withPro('swaps', t('Histórico de swaps'), SwapHistoryScreen);
