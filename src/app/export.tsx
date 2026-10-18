// Take your history out: a PDF report of a year or any dates (for an
// accountant or a backer), sessions and hands as CSV, or the full backup.

import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { PRO_ONLY } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { Chip, ChipRow, Field, ListGroup, ListItem, Pill, Row, Section, Stat, StatGrid, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { csvSep } from '@/export/csv';
import { buildReport, handsCsv } from '@/export/report';
import { reportHtml } from '@/export/report-html';
import { saveTextFile } from '@/lib/files';
import { sharePdf } from '@/lib/pdf';
import { money } from '@/poker/format';
import { endOfDay, inRange, scopeIds, scopeOptions, sameScope, type DateRange, type Scope } from '@/store/bankroll-math';
import { buildBackup, sessionsCsv } from '@/store/backup';
import { parseDay } from '@/store/session-math';
import { useStore } from '@/store/store';
import { taxReport } from '@/tax/tax-math';
import { BRAND, C, S } from '@/theme';

type Period = 'year' | 'lastYear' | '12m' | 'all' | 'custom';

function rangeOf(p: Period, now: number, custom: DateRange): DateRange {
  const y = new Date(now).getFullYear();
  if (p === 'year') return { from: new Date(y, 0, 1).getTime(), to: endOfDay(now) };
  if (p === 'lastYear') return { from: new Date(y - 1, 0, 1).getTime(), to: new Date(y, 0, 1).getTime() - 1 };
  if (p === '12m') return { from: new Date(y - 1, new Date(now).getMonth(), new Date(now).getDate() + 1).getTime(), to: endOfDay(now) };
  if (p === 'custom') return custom;
  return {};
}

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

const day = (ts: number) => new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function ExportScreen() {
  const store = useStore();
  const { sessions, transfers, bankrolls, trips, hands, settings } = store;
  const pro = usePro();
  const [now] = useState(() => Date.now());
  const [period, setPeriod] = useState<Period>('year');
  const [scope, setScope] = useState<Scope | undefined>(undefined);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const y = new Date(now).getFullYear();

  const custom = useMemo<DateRange>(() => {
    const f = parseDay(fromText, now);
    const to = parseDay(toText, now);
    return { from: f ?? undefined, to: to !== null ? endOfDay(to) : undefined };
  }, [fromText, toText, now]);
  const range = useMemo(() => rangeOf(period, now, custom), [period, now, custom]);
  const report = useMemo(() => buildReport({ sessions, transfers, bankrolls, scope, range, trips, home: settings.currency }), [sessions, transfers, bankrolls, scope, range, trips, settings.currency]);
  const tax = useMemo(() => taxReport(report.currencies.flatMap((c) => c.sessions), range, report.trips), [report, range]);
  const main = report.currencies[0];
  const ids = scope ? scopeIds(scope, bankrolls) : null;
  const handsIn = hands.filter((h) => inRange(h.createdAt, range)).length;
  const stamp = period === 'year' ? String(y) : period === 'lastYear' ? String(y - 1) : new Date(now).toISOString().slice(0, 10);

  const run = async (key: string, pro_: boolean, fn: () => Promise<void>) => {
    const go = async () => {
      setBusy(key);
      try {
        await fn();
      } catch {
        note(t('Não deu para exportar'), t('Tenta outra vez.'));
      } finally {
        setBusy(null);
      }
    };
    // After paying, the export that was tapped starts by itself.
    if (pro_ && !pro.isPro) return pro.paywall(key === 'pdf' && PRO_ONLY.taxReport ? 'taxReport' : 'stats', () => void go());
    await go();
  };

  const pdf = () =>
    run('pdf', true, () => sharePdf(`sweatbook-relatorio-${stamp}.pdf`, reportHtml(report, { player: settings.nickname || undefined, tax })));
  // The whole history as CSV is free (the same file Definições exports); a period or one bankroll is Pro.
  const fullHistory = period === 'all' && !scope;
  const sessionsFile = () =>
    run('sessions', !fullHistory, () => {
      const list = report.currencies.flatMap((c) => c.sessions);
      const tx = transfers.filter((x) => (!ids || ids.has(x.bankrollId)) && inRange(x.at, range));
      const spent = trips.flatMap((trip) => trip.expenses.filter((x) => inRange(x.at, range)).map((x) => ({ trip, x })));
      return saveTextFile(`sweatbook-sessoes-${stamp}.csv`, sessionsCsv(list, bankrolls, tx, spent, csvSep()), 'text/csv');
    });
  const handsFile = () => run('hands', true, () => saveTextFile(`sweatbook-maos-${stamp}.csv`, handsCsv(hands, sessions, range, BRAND.webUrl, csvSep()), 'text/csv'));
  const backup = () => run('json', false, () => saveTextFile(`sweatbook-${new Date(now).toISOString().slice(0, 10)}.json`, JSON.stringify(buildBackup(store)), 'application/json'));

  const lock = pro.isPro ? undefined : <Pill label="Pro" color={C.accent} />;
  const periods: [Period, string][] = [
    ['year', String(y)],
    ['lastYear', String(y - 1)],
    ['12m', t('12 meses')],
    ['all', t('Sempre')],
    ['custom', t('Datas')],
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('Exportar') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ gap: S.sm }}>
          <T v="h1">{t('Leva o teu histórico contigo')}</T>
          <T v="callout">{t('Um relatório em PDF para o contabilista ou o teu backer, ou os dados em CSV para o Excel.')}</T>
        </View>

        <Section title={t('Período')}>
          <ChipRow>
            {periods.map(([k, l]) => (
              <Chip key={k} label={l} active={period === k} onPress={() => setPeriod(k)} />
            ))}
          </ChipRow>
          {period === 'custom' ? (
            <Row gap={S.sm}>
              <Field label={t('De')} value={fromText} onChangeText={setFromText} placeholder={`01/01/${y}`} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
              <Field label={t('Até')} value={toText} onChangeText={setToText} placeholder={day(now)} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
            </Row>
          ) : null}
        </Section>

        {bankrolls.length > 1 ? (
          <Section title="Bankroll">
            <ChipRow>
              <Chip label={t('Todas')} active={!scope} onPress={() => setScope(undefined)} />
              {scopeOptions(bankrolls).map((o) => (
                <Chip key={'bankrollId' in o.scope ? o.scope.bankrollId : 'all' + o.currency} label={o.label} active={!!scope && sameScope(o.scope, scope)} onPress={() => setScope(o.scope)} />
              ))}
            </ChipRow>
          </Section>
        ) : null}

        <Section title={t('No relatório')} hint={report.currencies.length > 1 ? report.currencies.length === 2 ? t('Mais 1 moeda, com o seu resumo.') : t('Mais {n} moedas, cada uma com o seu resumo.', { n: report.currencies.length - 1 }) : undefined}>
          <StatGrid cols={3}>
            <Stat label={t('Resultado')} value={main ? (main.totals.profit > 0 ? '+' : '') + money(main.totals.profit, main.currency) : '—'} tone={main ? (main.totals.profit >= 0 ? 'good' : 'bad') : undefined} />
            <Stat label={t('Sessões')} value={String(main?.totals.sessions ?? 0)} />
            <Stat label={t('Mãos')} value={String(handsIn)} />
          </StatGrid>
          {tax.pending.length ? (
            <T v="small" color={C.warn} style={{ paddingHorizontal: 4 }}>
              {t('Imposto retido a recuperar: {amount}', { amount: tax.pending.map((p) => money(p.amount, p.currency)).join(' + ') })}
            </T>
          ) : null}
        </Section>

        <Section title={t('Exportar')}>
          <ListGroup>
            <ListItem icon="document-text" iconColor={C.accent} title={busy === 'pdf' ? t('A preparar…') : t('Relatório PDF')} subtitle={<T v="small">{t('Resultados por bankroll, jogo, sala, mês e país, viagens e todas as sessões')}</T>} right={lock} onPress={pdf} />
            <ListItem icon="grid-outline" iconColor={C.info} title={t('Sessões em CSV')} subtitle={<T v="small">{t('Com depósitos, levantamentos e despesas de viagem, para Excel ou Google Sheets')}</T>} right={fullHistory ? undefined : lock} onPress={sessionsFile} />
            <ListItem icon="albums-outline" iconColor={C.good} title={t('Mãos em CSV')} subtitle={<T v="small">{t('Posição, cartas, board, resultado, tags e notas')}</T>} right={lock} onPress={handsFile} />
            <ListItem icon="download-outline" title={t('Cópia completa (.json)')} subtitle={<T v="small">{t('Tudo, sempre grátis. Para mudar de telemóvel ou de app.')}</T>} onPress={backup} />
          </ListGroup>
        </Section>
      </ScrollView>
    </>
  );
}
