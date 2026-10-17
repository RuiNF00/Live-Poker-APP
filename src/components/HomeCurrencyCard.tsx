// Net worth and this year's results across every currency, in the player's
// own one. Only shown when their money is in more than one currency.

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { locale, t } from '@/i18n';
import { useRates } from '@/lib/fx';
import { money } from '@/poker/format';
import { homeTotals, latestDay } from '@/store/fx-math';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

import { CURRENCIES, Sheet } from './BankrollSheets';
import { Card, Chip, ChipRow, IconButton, Row, T } from './ui';

export function HomeCurrencyCard({ hidden }: { hidden: boolean }) {
  const { sessions, transfers, bankrolls, settings, setSettings } = useStore();
  const [pick, setPick] = useState(false);
  const home = settings.currency;
  const currencies = useMemo(() => new Set([...sessions.filter((s) => s.endedAt).map((s) => s.currency), ...transfers.map((x) => bankrolls.find((b) => b.id === x.bankrollId)?.currency ?? home)]), [sessions, transfers, bankrolls, home]);
  const foreign = currencies.size > 1 || (currencies.size === 1 && !currencies.has(home));
  // Rates back to the oldest session in another currency.
  const since = useMemo(() => {
    if (!foreign) return null;
    const ts = [...sessions.filter((s) => s.currency !== home).map((s) => s.startedAt), ...transfers.map((x) => x.at)];
    return ts.length ? Math.min(...ts) : null;
  }, [foreign, sessions, transfers, home]);
  const rates = useRates(since);
  const [year] = useState(() => new Date().getFullYear());
  const h = useMemo(() => homeTotals({ sessions, transfers, bankrolls }, home, rates, { from: new Date(year, 0, 1).getTime() }), [sessions, transfers, bankrolls, home, rates, year]);
  if (!foreign) return null;

  const latest = latestDay(rates);
  const show = (n: number, signed = false) => (hidden ? '•••' : (signed && n > 0 ? '+' : '') + money(Math.round(n), home));
  const noRates = !latest;
  return (
    <>
      <Card tone="inset" style={{ gap: S.xs }}>
        <Row>
          <T v="label" style={{ flex: 1 }}>
            {t('Património · tudo em {cur}', { cur: home })}
          </T>
          <IconButton name="swap-horizontal" size={32} label={t('Mudar a moeda')} onPress={() => setPick(true)} />
        </Row>
        {noRates ? (
          <T v="small">{t('Para juntar as tuas moedas precisamos do câmbio do dia. Liga-te à internet uma vez e fica guardado no telemóvel.')}</T>
        ) : (
          <>
            <T v="monoL" color={h.netWorth < 0 ? C.bad : C.text} numberOfLines={1} adjustsFontSizeToFit>
              {show(h.netWorth)}
            </T>
            <T v="small">
              {[t('Póquer em {year}: {amount}', { year, amount: show(h.profit, true) }), h.roi !== null ? t('ROI {pct}%', { pct: Math.round(h.roi) }) : ''].filter(Boolean).join(' · ')}
            </T>
            <T v="tiny">
              {t('Câmbio do BCE de {date}. Cada sessão conta ao câmbio do seu dia.', { date: new Date(latest + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}
              {h.missing.length ? ' ' + t('Sem câmbio para {list}: fica de fora.', { list: h.missing.join(', ') }) : ''}
            </T>
          </>
        )}
      </Card>
      <Sheet visible={pick} title={t('A tua moeda')} onClose={() => setPick(false)}>
        <View style={{ gap: S.md }}>
          <T v="small">{t('Os totais de todas as bankrolls aparecem nesta moeda. As sessões novas também começam nela.')}</T>
          <ChipRow>
            {CURRENCIES.map((c) => (
              <Chip
                key={c}
                label={c}
                active={home === c}
                onPress={() => {
                  setSettings({ currency: c });
                  setPick(false);
                }}
                style={{ minWidth: 48 }}
              />
            ))}
          </ChipRow>
        </View>
      </Sheet>
    </>
  );
}
