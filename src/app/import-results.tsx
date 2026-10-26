// Past live tournament results in one go: copy the results table from a results page (the
// player's page on a tournament database, a series' results) or type one line per
// tournament, paste, check, import. Those pages list only the cashes, so the sessions come
// in marked (Session.cashList) and out of the results until the player counts them.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, Button, Card, Chip, ChipRow, Field, ListGroup, ListItem, NumField, Row, Section, Segmented, SheetHeader, T, ToggleItem } from '@/components/ui';
import { locale, t } from '@/i18n';
import { defaultPlacement, NEW, place } from '@/import/bankrolls';
import type { DateOrder } from '@/import/convert';
import { likelyDuplicates } from '@/import/duplicates';
import type { ParsedResults, ResultRow, SkipReason } from '@/import/results';
import { track } from '@/lib/events';
import { useSheetAnimation } from '@/lib/motion';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, R, S } from '@/theme';

/** The reader is loaded when the player taps Ler, like the receipt readers: it never weighs on the app's start. */
type Reader = typeof import('@/import/results');
const loadReader = () => import('@/import/results');

type Step = { at: 'paste' } | { at: 'review'; parsed: ParsedResults; reader: Reader } | { at: 'done'; added: number; left: number; counted: boolean };

/** Same as the CSV import: a narrow screen or big text stacks what sits side by side. */
function useTight() {
  const { width, fontScale } = useWindowDimensions();
  return width / Math.max(1, fontScale) < 320;
}

const SKIP_TEXT: Record<SkipReason, string> = {
  noDate: t('Sem data completa (dia, mês e ano)'),
  noPrize: t('Sem prémio'),
  repeat: t('Repetida no texto'),
};

export default function ImportResultsScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useStore();
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>({ at: 'paste' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const read = async (order?: DateOrder) => {
    setBusy(true);
    setError(false);
    try {
      const reader = await loadReader();
      // An American phone reads 03/04 month first unless the dates say otherwise.
      const parsed = reader.parseResults(text, { order, fallbackOrder: settings.currency === '$' ? 'mdy' : undefined });
      if (!parsed.rows.length) setError(true);
      else setStep({ at: 'review', parsed, reader });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const paste = async () => {
    try {
      const s = await Clipboard.getStringAsync();
      if (s) setText(s);
    } catch {
      // Paste refused: the field still takes a long press.
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Resultados de torneios') }} />
      {step.at === 'paste' ? (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <ScrollView contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: S.sm }}>
              <T v="label" color={C.accent}>
                {t('Para quem joga torneios')}
              </T>
              <T v="h1">{t('Traz os teus resultados de torneios')}</T>
              <T v="callout">{t('Copia a tabela de resultados de uma página de torneios (a tua página de jogador ou os resultados de uma série) e cola-a aqui. Também podes escrever um torneio por linha.')}</T>
            </View>
            <OnlyCashes />
            <Card style={{ gap: S.md }}>
              {[t('Abre no browser a página com os teus resultados.'), t('Seleciona a tabela inteira e copia-a.'), t('Cola-a aqui e confere tudo antes de importar.')].map((line, i) => (
                <Row key={i} gap={S.md} style={{ alignItems: 'flex-start' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <T v="tiny" color={C.accent}>
                      {i + 1}
                    </T>
                  </View>
                  <T v="callout" style={{ flex: 1, color: C.text }}>
                    {line}
                  </T>
                </Row>
              ))}
            </Card>
            <View style={{ gap: S.sm }}>
              <Field
                label={t('Resultados')}
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  setError(false);
                }}
                multiline
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                placeholder={'12/03/2024  €550 Main Event  23rd  €12.400\n2024-07-07  $1,500 No-Limit Hold\'em  1st  $345,000'}
                inputStyle={{ minHeight: 180, fontSize: 14 }}
              />
              <Row gap={S.sm}>
                <Button kind="secondary" size="sm" icon="clipboard-outline" title={t('Colar')} onPress={paste} />
                {text ? <Button kind="ghost" size="sm" title={t('Limpar')} onPress={() => setText('')} /> : null}
              </Row>
            </View>
            {error ? (
              <Banner tone="warn" icon="alert-circle" title={t('Não encontrámos resultados')} body={t('Cada torneio precisa de uma data com dia, mês e ano e de um prémio. Experimenta copiar só a tabela.')} />
            ) : null}
          </ScrollView>
          <Dock bottom={insets.bottom}>
            <Button title={busy ? t('A ler…') : t('Ler resultados')} icon="search" disabled={busy || !text.trim()} onPress={() => read()} />
          </Dock>
        </View>
      ) : step.at === 'review' ? (
        <Review
          parsed={step.parsed}
          reader={step.reader}
          bottom={insets.bottom}
          onOrder={(order) => setStep({ ...step, parsed: step.reader.parseResults(text, { order }) })}
          onBack={() => setStep({ at: 'paste' })}
          onDone={(added, left, counted) => setStep({ at: 'done', added, left, counted })}
        />
      ) : (
        <Done step={step} bottom={insets.bottom} onAgain={() => (setText(''), setStep({ at: 'paste' }))} />
      )}
    </>
  );
}

/** Said before the paste and again before the import: a list of cashes alone looks better than the truth. */
function OnlyCashes() {
  return (
    <Banner
      tone="info"
      icon="information-circle"
      title={t('Estas listas só têm os prémios')}
      body={t('Os torneios em que não chegaste aos prémios não aparecem. Contados sozinhos, os prémios fazem o lucro e o ROI parecer melhores do que são, por isso ficam marcados e fora dos resultados até decidires contá-los.')}
    />
  );
}

const NO_DUPS = new Map<string, Session>();
/** Only ever called from a tap. */
const now = () => Date.now();

function Review({ parsed, reader, bottom, onOrder, onBack, onDone }: { parsed: ParsedResults; reader: Reader; bottom: number; onOrder: (o: DateOrder) => void; onBack: () => void; onDone: (added: number, left: number, counted: boolean) => void }) {
  const tight = useTight();
  const store = useStore();
  const { settings, allSessions, bankrolls, defaultBankroll, setSettings } = store;
  const rows = parsed.rows;
  // Rows the text gave no currency: the player's currency until they pick another.
  const bare = rows.filter((r) => !r.currency).length;
  const [currency, setCurrency] = useState(settings.currency);
  const [typed, setTyped] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<ResultRow | null>(null);
  const opt = { currency, buyIns: typed, tableSize: settings.defaultTableSize };
  const { sessions, waiting } = useMemo(() => reader.cashSessions(rows, opt), [reader, rows, currency, typed, settings.defaultTableSize]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => reader.totalsByCurrency(rows, opt), [reader, rows, currency, typed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Already here (same paste before), or the same prize on a session the player logged here.
  const have = useMemo(() => new Set(allSessions.map((s) => s.id)), [allSessions]);
  const dups = useMemo(() => (sessions.length ? likelyDuplicates(sessions, allSessions, { amount: (s) => s.cashOut, days: 3 }) : NO_DUPS), [sessions, allSessions]);
  const [keepDups, setKeepDups] = useState(false);
  const already = sessions.filter((s) => have.has(s.id)).length;
  const entering = sessions.filter((s) => !have.has(s.id) && (keepDups || !dups.has(s.id)));
  const counted = settings.countCashLists === true;

  // Each currency goes to the bankroll the player uses in it, else a new one (free, like the CSV import).
  const currencies = [...new Set(entering.map((s) => s.currency))];
  const placement = defaultPlacement(currencies, bankrolls, defaultBankroll);
  const where = currencies.map((c) => (placement[c] === NEW ? t('uma bankroll nova em {currency}', { currency: c }) : (bankrolls.find((b) => b.id === placement[c])?.name ?? c))).join(', ');

  // Rows without a buy-in, per currency: one amount for all of them only makes sense in one currency.
  const waitingBy = useMemo(() => {
    const m = new Map<string, ResultRow[]>();
    for (const r of waiting) m.set(r.currency ?? currency, [...(m.get(r.currency ?? currency) ?? []), r]);
    return [...m];
  }, [waiting, currency]);

  const list = [...rows].sort((a, b) => b.at - a.at);
  const first = list[list.length - 1]?.at;
  const last = list[0]?.at;
  const ownCurrencies = [...new Set([currency, settings.currency, ...rows.map((r) => r.currency).filter((c): c is string => !!c), '$', '€', '£'])];

  const save = () => {
    const p = place({ sessions: entering, moves: [] }, placement, { source: 'results', appName: t('Resultados de torneios'), bankrolls });
    const n = store.importData({ app: 'sweatbook', v: 1, exportedAt: now(), hands: [], sessions: p.sessions, players: [], bankrolls: p.bankrolls, transfers: [] });
    track('import_done', { source: 'results', sessions: n.sessions, waiting: waiting.length });
    onDone(n.sessions, waiting.length, counted);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: S.sm }}>
          <T v="label" color={C.accent}>
            {t('Só prémios')}
          </T>
          <T v="h1">{rows.length === 1 ? t('1 prémio encontrado') : t('{n} prémios encontrados', { n: rows.length })}</T>
          {first ? <T v="callout">{fullDate(first) === fullDate(last!) ? fullDate(first) : t('De {from} a {to}', { from: fullDate(first), to: fullDate(last!) })}</T> : null}
        </View>

        <OnlyCashes />

        {/* One line per currency: amounts in two currencies are never added together. */}
        <ListGroup>
          {totals.map((x) => (
            <ListItem
              key={x.currency}
              icon="trophy-outline"
              iconColor={C.good}
              title={t('Prémios em {currency}', { currency: x.currency })}
              subtitle={[x.rows === 1 ? t('1 torneio') : t('{n} torneios', { n: x.rows }), x.withBuyIn ? t('buy-ins de {n}: {amount}', { n: x.withBuyIn, amount: money(x.buyIns, x.currency) }) : t('sem buy-ins')].join(' · ')}
              right={<Prize amount={x.prizes} currency={x.currency} />}
              chevron={false}
            />
          ))}
        </ListGroup>

        {bare ? (
          <Section title={t('Moeda dos prémios sem moeda')} hint={bare === 1 ? t('1 prémio não diz a moeda.') : t('{n} prémios não dizem a moeda.', { n: bare })}>
            <ChipRow>
              {ownCurrencies.map((c) => (
                <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </ChipRow>
          </Section>
        ) : null}

        {waiting.length ? (
          <Section title={t('Falta o buy-in ({n})', { n: waiting.length })} hint={t('Sem buy-in não entram: não inventamos valores. Escreve o de cada torneio ou o mesmo para todos.')}>
            {waitingBy.map(([c, rs]) => (
              <BulkBuyIn key={c} currency={c} n={rs.length} onApply={(v) => setTyped((x) => ({ ...x, ...Object.fromEntries(rs.map((r) => [r.line, v])) }))} />
            ))}
            <ListGroup>
              {waiting.slice(0, 30).map((r) => (
                <RowItem key={r.line} r={r} currency={r.currency ?? currency} onPress={() => setEditing(r)} />
              ))}
            </ListGroup>
            {waiting.length > 30 ? <T v="small">{t('E mais {n}.', { n: waiting.length - 30 })}</T> : null}
          </Section>
        ) : null}

        {already ? <Note icon="copy-outline" text={already === 1 ? t('1 já está na Sweatbook e não entra outra vez.') : t('{n} já estão na Sweatbook e não entram outra vez.', { n: already })} /> : null}

        {dups.size ? (
          <ListGroup>
            <ToggleItem
              icon="copy-outline"
              title={t('Importar também as que parecem repetidas')}
              subtitle={dups.size === 1 ? t('1 prémio igual ao de um torneio que já tens, com até 3 dias de diferença.') : t('{n} prémios iguais aos de torneios que já tens, com até 3 dias de diferença.', { n: dups.size })}
              value={keepDups}
              onChange={setKeepDups}
              lines={4}
            />
            {sessions
              .filter((s) => dups.has(s.id))
              .slice(0, 10)
              .map((s) => {
                const twin = dups.get(s.id)!;
                return <ListItem key={s.id} title={s.name} subtitle={t('Parecida com: {session}', { session: [twin.name, fullDate(twin.startedAt), twin.venue].filter(Boolean).join(' · ') })} right={<Prize amount={s.cashOut} currency={s.currency} />} chevron={false} />;
              })}
          </ListGroup>
        ) : null}

        {parsed.ambiguousDates ? (
          <Section title={t('Datas como 03/04')} hint={t('Confirma num torneio que conheças.')}>
            <Segmented
              options={[
                { key: 'dmy', label: t('Dia/mês') },
                { key: 'mdy', label: t('Mês/dia') },
              ]}
              value={parsed.order}
              onChange={onOrder}
            />
          </Section>
        ) : null}

        <Section title={t('Prémios')} hint={t('Toca num para mudar o buy-in.')}>
          <ListGroup>
            {list
              .filter((r) => !waiting.includes(r))
              .slice(0, 50)
              .map((r) => (
                <RowItem key={r.line} r={r} currency={r.currency ?? currency} buyIn={typed[r.line] ?? r.buyIn} onPress={() => setEditing(r)} />
              ))}
          </ListGroup>
          {rows.length - waiting.length > 50 ? <T v="small">{t('E mais {n}.', { n: rows.length - waiting.length - 50 })}</T> : null}
        </Section>

        {parsed.skipped.length ? (
          <Section title={t('Linhas que ficam de fora')} hint={t('Corrige-as no texto e lê outra vez: o que já entrou não se repete.')}>
            <ListGroup>
              {parsed.skipped.slice(0, 20).map((f) => (
                <ListItem key={f.line} icon="alert-circle-outline" iconColor={C.warn} title={t('Linha {n}', { n: f.line })} subtitle={`${SKIP_TEXT[f.reason]}${f.value ? ' · ' + f.value : ''}`} chevron={false} />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        <View style={{ gap: S.sm }}>
          <ListGroup>
            <ToggleItem
              icon="stats-chart-outline"
              title={t('Contar nos resultados')}
              subtitle={counted ? t('Contam no saldo, no lucro e no ROI, nunca no resultado por hora (não têm horas). Faltam os torneios sem prémio: os números ficam melhores do que são.') : t('Ficam no histórico, marcados como «Lista de prémios», fora do saldo, do lucro e do ROI. Podes mudar isto em Bankroll.')}
              value={counted}
              onChange={(v) => setSettings({ countCashLists: v })}
              lines={6}
            />
          </ListGroup>
          {entering.length ? <Note icon="wallet-outline" text={t('Vão para {where}.', { where })} /> : null}
        </View>
      </ScrollView>

      <Dock bottom={bottom}>
        <View style={{ flexDirection: tight ? 'column-reverse' : 'row', gap: S.sm }}>
          <Button kind="secondary" title={t('Voltar')} onPress={onBack} style={{ paddingHorizontal: 18 }} />
          <Button
            style={tight ? undefined : { flex: 1 }}
            title={entering.length === 0 ? (waiting.length ? t('Falta o buy-in') : t('Nada de novo para importar')) : entering.length === 1 ? t('Importar 1 prémio') : t('Importar {n} prémios', { n: entering.length })}
            sub={entering.length && waiting.length ? (waiting.length === 1 ? t('1 sem buy-in fica de fora') : t('{n} sem buy-in ficam de fora', { n: waiting.length })) : undefined}
            disabled={entering.length === 0}
            onPress={save}
          />
        </View>
      </Dock>

      <BuyInSheet row={editing} currency={editing ? (editing.currency ?? currency) : currency} value={editing ? (typed[editing.line] ?? editing.buyIn) : undefined} onClose={() => setEditing(null)} onSave={(v) => {
        if (editing) setTyped((x) => ({ ...x, [editing.line]: v }));
        setEditing(null);
      }} />
    </View>
  );
}

/** One result: event, day, place and buy-in, the prize on the right. */
function RowItem({ r, currency, buyIn, onPress }: { r: ResultRow; currency: string; buyIn?: number; onPress: () => void }) {
  const sub = [fullDate(r.at), r.finish ? t('{n}.º', { n: r.finish }) + (r.field ? '/' + r.field : '') : '', r.venue, buyIn !== undefined ? t('Buy-in {amount}', { amount: money(buyIn, currency) }) : t('Sem buy-in')].filter(Boolean).join(' · ');
  return <ListItem title={r.name} subtitle={sub} right={<Prize amount={r.prize} currency={currency} />} onPress={onPress} accessibilityLabel={[r.name, sub, money(r.prize, currency)].join(', ')} />;
}

/** A prize is not a profit: no sign, no green (the buy-in still has to come off it). */
function Prize({ amount, currency }: { amount: number; currency: string }) {
  return (
    <T v="mono" color={C.text}>
      {money(amount, currency)}
    </T>
  );
}

function BulkBuyIn({ currency, n, onApply }: { currency: string; n: number; onApply: (v: number) => void }) {
  const [v, setV] = useState(0);
  return (
    <Row gap={S.sm} style={{ alignItems: 'flex-end' }}>
      <NumField label={n === 1 ? t('Buy-in ({currency})', { currency }) : t('O mesmo para os {n} em {currency}', { n, currency })} value={v} onChange={setV} money />
      <Button kind="secondary" title={t('Aplicar')} disabled={!(v > 0)} onPress={() => onApply(v)} />
    </Row>
  );
}

function BuyInSheet({ row, currency, value, onClose, onSave }: { row: ResultRow | null; currency: string; value?: number; onClose: () => void; onSave: (v: number) => void }) {
  const insets = useSafeAreaInsets();
  const animation = useSheetAnimation();
  const [v, setV] = useState(0);
  const [for_, setFor] = useState<ResultRow | null>(null);
  // A new row opens with its own buy-in in the field.
  if (row !== for_) {
    setFor(row);
    setV(value ?? 0);
  }
  return (
    <Modal visible={!!row} transparent animationType={animation} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} accessibilityLabel={t('Fechar')} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingTop: S.lg + 4, paddingHorizontal: S.gutter, paddingBottom: insets.bottom + S.md, gap: S.md }}>
        <SheetHeader title={row?.name ?? ''} onClose={onClose} closeLabel={t('Fechar')} />
        {row ? <T v="small">{[fullDate(row.at), t('Prémio {amount}', { amount: money(row.prize, currency) })].join(' · ')}</T> : null}
        <Row>
          <NumField label={t('Buy-in ({currency})', { currency })} value={v} onChange={setV} money autoFocus selectOnFocus />
        </Row>
        <Button title={t('Guardar')} disabled={!(v > 0)} onPress={() => onSave(v)} />
        <Button kind="ghost" size="sm" title={t('Foi um freeroll (buy-in 0)')} onPress={() => onSave(0)} />
      </View>
    </Modal>
  );
}

function Done({ step, bottom, onAgain }: { step: Extract<Step, { at: 'done' }>; bottom: number; onAgain: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.gutter, paddingTop: S.xxl, gap: S.xl, paddingBottom: 220 }}>
        <View style={{ gap: S.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.goodSoft, alignItems: 'center', justifyContent: 'center', marginBottom: S.xs }}>
            <Ionicons name="checkmark" size={30} color={C.good} />
          </View>
          <T v="label">{t('Resultados de torneios')}</T>
          <T v="title">{step.added === 1 ? t('Importámos 1 prémio') : step.added ? t('Importámos {n} prémios', { n: step.added }) : t('Importação feita')}</T>
          <T v="callout">
            {[
              step.counted ? t('Estão marcados como «Lista de prémios» e contam nos resultados.') : t('Estão no histórico, marcados como «Lista de prémios», e ficam fora do lucro e do ROI até os contares em Bankroll.'),
              step.left ? (step.left === 1 ? t('1 sem buy-in ficou de fora: cola-o outra vez quando souberes o buy-in.') : t('{n} sem buy-in ficaram de fora: cola-os outra vez quando souberes o buy-in.', { n: step.left })) : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </T>
        </View>
      </ScrollView>
      <Dock bottom={bottom}>
        <View style={{ gap: S.sm }}>
          <Button title={t('Ver bankroll')} onPress={() => router.replace('/(tabs)/bankroll')} />
          <Button kind="ghost" size="sm" title={t('Colar outra lista')} onPress={onAgain} />
        </View>
      </Dock>
    </View>
  );
}

function Dock({ children, bottom }: { children: React.ReactNode; bottom: number }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: S.gutter, paddingTop: S.md, paddingBottom: bottom + S.md, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.hairline }}>
      {children}
    </View>
  );
}

function Note({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <Row gap={S.sm} style={{ alignItems: 'flex-start', paddingHorizontal: 4 }}>
      <Ionicons name={icon} size={15} color={C.muted} style={{ marginTop: 2 }} />
      <T v="small" style={{ flex: 1 }}>
        {text}
      </T>
    </Row>
  );
}

function fullDate(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}
