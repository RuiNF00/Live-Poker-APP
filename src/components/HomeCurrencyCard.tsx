// Net worth and this year's results across every currency, in the player's
// own one. Only shown when their money is in more than one currency.

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { usePro } from '@/billing/pro';
import { useLocked } from '@/components/ProGate';
import { locale, t } from '@/i18n';
import { useRates } from '@/lib/fx';
import { money } from '@/poker/format';
import { CURRENCY_INFO, isoOf, symbolOf } from '@/store/currencies';
import { homeTotals, latestDay } from '@/store/fx-math';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

import { CURRENCIES, Sheet } from './BankrollSheets';
import { Button, Card, Chip, ChipRow, Field, IconButton, Row, T } from './ui';

export function HomeCurrencyCard({ hidden }: { hidden: boolean }) {
  const { sessions, transfers, bankrolls, settings, setSettings } = useStore();
  const [pick, setPick] = useState(false);
  const [typing, setTyping] = useState(false);
  const manual = useMemo(() => settings.fxManual ?? {}, [settings.fxManual]);
  const locked = useLocked('homeTotal');
  const { paywall } = usePro();
  const home = settings.currency;
  const currencies = useMemo(() => new Set([...sessions.filter((s) => s.endedAt).map((s) => s.currency), ...transfers.map((x) => bankrolls.find((b) => b.id === x.bankrollId)?.currency ?? home)]), [sessions, transfers, bankrolls, home]);
  const foreign = currencies.size > 1 || (currencies.size === 1 && !currencies.has(home));
  // Rates back to the oldest session in another currency.
  const since = useMemo(() => {
    if (!foreign) return null;
    const ts = [...sessions.filter((s) => s.currency !== home).map((s) => s.startedAt), ...transfers.map((x) => x.at)];
    return ts.length ? Math.min(...ts) : null;
  }, [foreign, sessions, transfers, home]);
  // Locked: no rates to fetch.
  const rates = useRates(locked ? null : since);
  const [year] = useState(() => new Date().getFullYear());
  const h = useMemo(() => homeTotals({ sessions, transfers, bankrolls }, home, rates, { from: new Date(year, 0, 1).getTime() }, undefined, manual), [sessions, transfers, bankrolls, home, rates, year, manual]);
  if (!foreign) return null;
  if (locked)
    return (
      <Card tone="inset" style={{ gap: S.xs }}>
        <T v="label">{t('Património · tudo em {cur}', { cur: home })}</T>
        <T v="monoL" color={C.muted}>
          •••
        </T>
        <Button kind="secondary" size="sm" icon="lock-closed" title={t('Juntar as moedas com Pro')} onPress={() => paywall('homeTotal')} style={{ alignSelf: 'flex-start' }} />
      </Card>
    );

  const latest = latestDay(rates);
  const show = (n: number, signed = false) => (hidden ? '•••' : (signed && n > 0 ? '+' : '') + money(Math.round(n), home));
  const noRates = !latest && !Object.keys(manual).length;
  // Currencies the ECB doesn't cover, in use here: the player types their rate.
  const typed = [...currencies].filter((c) => CURRENCY_INFO[c] && !CURRENCY_INFO[c].ecb);
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
              {latest ? t('Câmbio do BCE de {date}. Cada sessão conta ao câmbio do seu dia.', { date: new Date(latest + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }) }) : ''}
              {h.missing.length ? ' ' + t('Sem câmbio para {list}: fica de fora.', { list: h.missing.join(', ') }) : ''}
            </T>
          </>
        )}
        {typed.length ? (
          <T v="small" color={C.accent} onPress={() => setTyping(true)} accessibilityRole="button">
            {t('O BCE não publica {list}: escreve o teu câmbio ›', { list: typed.join(', ') })}
          </T>
        ) : null}
      </Card>
      <Sheet visible={typing} title={t('Câmbio escrito por ti')} onClose={() => setTyping(false)}>
        <ManualRatesForm
          codes={typed}
          initial={manual}
          onSave={(fxManual) => {
            setSettings({ fxManual });
            setTyping(false);
          }}
        />
      </Sheet>
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

/** One field per currency: how many of it make 1 €, as the player saw at the cage or the exchange. */
function ManualRatesForm({ codes, initial, onSave }: { codes: string[]; initial: Record<string, number>; onSave: (r: Record<string, number>) => void }) {
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(codes.map((c) => [c, initial[isoOf(c) ?? c] ? String(initial[isoOf(c) ?? c]).replace('.', ',') : ''])));
  const parse = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'));
  return (
    <View style={{ gap: S.md }}>
      <T v="small">{t('Estas moedas não têm câmbio diário do BCE. Usamos o teu para todas as datas; muda-o quando quiseres.')}</T>
      {codes.map((c) => (
        <Field
          key={c}
          label={t('1 € = quantos {code}?', { code: symbolOf(c) === c ? c : `${c} (${symbolOf(c)})` })}
          value={text[c] ?? ''}
          onChangeText={(v) => setText((x) => ({ ...x, [c]: v.slice(0, 12) }))}
          keyboardType="decimal-pad"
          placeholder="0"
        />
      ))}
      <Button
        title={t('Guardar câmbio')}
        icon="checkmark"
        onPress={() => {
          const out = { ...initial };
          for (const c of codes) {
            const iso = isoOf(c) ?? c;
            const n = parse(text[c] ?? '');
            if (n > 0 && Number.isFinite(n)) out[iso] = n;
            else delete out[iso];
          }
          onSave(out);
        }}
      />
    </View>
  );
}
