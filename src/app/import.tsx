// Bring your history from another app: Poker Bankroll Tracker, Pokerbase,
// Poker Analytics, any CSV, or a Sweatbook backup. Pick where it comes from,
// pick the file, check what was read (and fix a column if needed), import.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { ImportSupport } from '@/components/ImportSupport';
import { Amount, Banner, Button, Card, Chip, ChipRow, ListGroup, ListItem, Row, Section, Segmented, SheetHeader, Stat, StatGrid, T, ToggleItem } from '@/components/ui';
import { locale, t } from '@/i18n';
import { currenciesOf, defaultPlacement, NEW, place, type Placement } from '@/import/bankrolls';
import { likelyDuplicateMoves, likelyDuplicates } from '@/import/duplicates';
import { prepare, toSessionsAsync, type DateOrder, type FailedRow, type FailReason, type ImportResult, type Prepared } from '@/import/convert';
import type { Field, Mapping, SourceId } from '@/import/mapping';
import { importRecap, type ImportRecap } from '@/import/recap';
import { track } from '@/lib/events';
import { pickTextFileWithName } from '@/lib/files';
import { useSheetAnimation } from '@/lib/motion';
import { money, plus } from '@/poker/format';
import { importSummary, parseBackup } from '@/store/backup';
import { profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, R, S } from '@/theme';

// Poker Ledger has no tile: its file is recognised from the header when picked as CSV.
type Pick = Exclude<SourceId, 'generic' | 'pokerledger'> | 'csv';

const SOURCES: { id: Pick; name: string; sub: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }[] = [
  { id: 'pbt', name: 'Poker Bankroll Tracker', sub: t('Sessões cash e torneios'), icon: 'stats-chart', color: '#5AA9FF' },
  { id: 'pokerbase', name: 'Pokerbase', sub: t('Data, local e resultado'), icon: 'albums', color: '#B07CFF' },
  { id: 'pokeranalytics', name: 'Poker Analytics', sub: t('Sessões em CSV'), icon: 'analytics', color: '#4ADE80' },
  { id: 'csv', name: t('Outra app ou Excel'), sub: t('Qualquer CSV, escolhes as colunas'), icon: 'grid', color: '#F5B83D' },
  { id: 'sweatbook', name: t('Cópia do Sweatbook'), sub: t('Ficheiro .json ou .csv exportado daqui'), icon: 'refresh-circle', color: '#FF6A3D' },
];

const STEPS: Record<Pick, string[]> = {
  pbt: [
    t('Abre o menu no canto superior esquerdo e desce até ao ícone de utilizador.'),
    t('Toca em «Export to CSV».'),
    t('Guarda o ficheiro em Ficheiros (ou envia-o para ti por email) e escolhe-o aqui.'),
  ],
  pokerbase: [
    t('Abre o separador «More» e toca em «CSV Export».'),
    t('Toca em «Generate report» e guarda o ficheiro em Ficheiros.'),
    t('O Pokerbase só exporta data, local, despesas, moeda e lucro. Dizes a seguir se são cash ou torneios.'),
  ],
  pokeranalytics: [
    t('Nas definições do Poker Analytics, exporta as sessões em CSV.'),
    t('Guarda o ficheiro em Ficheiros (ou envia-o para ti por email) e escolhe-o aqui.'),
    t('Lemos as colunas pelo nome. Confirmas no passo seguinte antes de importar.'),
  ],
  csv: [
    t('Uma linha por sessão, com a data e o resultado (ou buy-in e prémio).'),
    t('Vírgula, ponto e vírgula ou tab; datas dia/mês ou mês/dia. Tudo é detetado.'),
    t('No passo seguinte vês o que lemos e podes mudar a coluna de cada campo.'),
  ],
  sweatbook: [t('Escolhe um ficheiro exportado em Definições. Junta-se ao que já tens, não apaga nada.')],
};

const SOURCE_NAME: Record<SourceId, string> = {
  pbt: 'Poker Bankroll Tracker',
  pokerbase: 'Pokerbase',
  pokeranalytics: 'Poker Analytics',
  pokerledger: 'Poker Ledger',
  sweatbook: 'Sweatbook',
  generic: 'CSV',
};

const FIELD_LABEL: Partial<Record<Field, string>> = {
  start: t('Data / início'),
  time: t('Hora de início'),
  end: t('Fim'),
  hours: t('Horas'),
  minutes: t('Minutos jogados'),
  kind: t('Cash ou torneio'),
  name: t('Nome do torneio'),
  game: t('Jogo'),
  stakes: t('Blinds (1/2)'),
  venue: t('Local'),
  currency: t('Moeda'),
  buyIn: 'Buy-in',
  cashOut: t('Cash-out / prémio'),
  profit: t('Lucro'),
  expenses: t('Despesas'),
  tips: t('Gorjetas'),
  handsDealt: t('Mãos jogadas'),
  finish: t('Lugar final'),
  field: t('Jogadores no torneio'),
  notes: t('Notas'),
};
const MAPPABLE = Object.keys(FIELD_LABEL) as Field[];

/** A file that doesn't say cash or tournament starts from what this player mostly plays. */
function mostlyPlays(sessions: Session[]): 'cash' | 'mtt' {
  return sessions.filter((s) => s.kind === 'mtt').length * 2 > sessions.length ? 'mtt' : 'cash';
}

/** Lets the screen draw (a label, the progress bar) before a long step starts. */
const paint = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** A narrow screen or big text (200%): three tiles or two buttons side by side no longer fit. */
function useTight() {
  const { width, fontScale } = useWindowDimensions();
  return width / Math.max(1, fontScale) < 320;
}

type Step = { at: 'pick' } | { at: 'review'; file: Prepared; first: ImportResult } | { at: 'done'; added: number; total: number; skipped?: number; moves?: number; summary?: string; recap: ImportRecap; source: SourceId };

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [source, setSource] = useState<Pick>('pbt');
  const [step, setStep] = useState<Step>({ at: 'pick' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The file as picked, so a failed import can go to support as it was.
  const [picked, setPicked] = useState<{ text: string; name: string; uri: string } | null>(null);
  const [help, setHelp] = useState(false);
  // Rows read so far, for a file with years of sessions. Only the bar redraws, not the whole screen.
  const [progress] = useState(progressBar);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const choose = async () => {
    setError(null);
    setBusy(true);
    try {
      const got = await pickTextFileWithName();
      if (got === null) return;
      setPicked(got);
      await paint();
      const { text } = got;
      if (/^\s*\{/.test(text)) {
        // A Sweatbook backup: hands, sessions and players in one go.
        const backup = parseBackup(text);
        const had = new Set(store.sessions.map((s) => s.id));
        const n = store.importData(backup);
        const fresh = backup.sessions.filter((s) => !had.has(s.id));
        const recap = importRecap(fresh, [...store.sessions, ...fresh]);
        track('import_done', { source: 'sweatbook', sessions: n.sessions, hours: Math.round(recap.hours) });
        setStep({ at: 'done', added: n.sessions + n.hands + n.players, total: n.sessions, summary: importSummary(n), recap, source: 'sweatbook' });
        return;
      }
      if (/^\s*</.test(text)) {
        // Poker Analytics also exports XML, only for its own restore.
        setError(t('Este ficheiro é XML. Exporta as sessões em CSV na outra app e escolhe esse ficheiro.'));
        return;
      }
      // A spreadsheet (.xlsx), an image or a zip is not text: say so instead of listing junk rows.
      if (text.includes('\0') || (text.match(/\uFFFD/g)?.length ?? 0) > text.length / 100) throw new Error('binary');
      const file = prepare(text);
      if (!file.table.rows.length) throw new Error('empty');
      if (file.source === 'generic' && source === 'pokeranalytics') file.source = 'pokeranalytics';
      const first = await toSessionsAsync(
        file.table,
        file.mapping,
        { currency: store.settings.currency, tableSize: store.settings.defaultTableSize, source: file.source, defaultKind: mostlyPlays(store.sessions) },
        { onProgress: (done, total) => progress.set({ done, total }), cancelled: () => !alive.current },
      );
      if (first) setStep({ at: 'review', file, first });
    } catch (e) {
      // A backup from a later version: refused whole, so say why instead of "can't read".
      if ((e as Error)?.message === 'too_big') setError(t('Este ficheiro tem mais de 20 MB. Exporta só as sessões, ou um ano de cada vez, e tenta outra vez.'));
      else if ((e as Error)?.message === 'newer') setError(t('Esta cópia foi feita numa versão mais recente da Sweatbook. Atualiza a app e tenta outra vez; nada foi alterado.'));
      else setError(t('Não conseguimos ler este ficheiro. Escolhe o CSV exportado pela outra app (ou um .json do Sweatbook).'));
    } finally {
      setBusy(false);
      progress.set(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Importar de outra app') }} />
      {step.at === 'pick' ? (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <ScrollView contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 140 }}>
            <View style={{ gap: S.sm }}>
              <T v="label" color={C.accent}>
                {t('Mudar de app em 1 minuto')}
              </T>
              <T v="h1">{t('Traz o teu histórico')}</T>
              <T v="callout">{t('As sessões que tens noutra app entram no teu bankroll. Junta-se ao que já tens, não apaga nada.')}</T>
            </View>
            <Row gap={S.sm}>
              {[t('Escolhe a app'), t('Exporta o ficheiro'), t('Confere e importa')].map((x, i) => (
                <View key={x} style={{ flex: 1, gap: 6, padding: S.sm + 2, borderRadius: R.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
                  <T v="monoS" color={C.accent}>
                    {i + 1}
                  </T>
                  <T v="small" style={{ color: C.text }} numberOfLines={2}>
                    {x}
                  </T>
                </View>
              ))}
            </Row>
            <Section title={t('De onde vem')}>
              <ListGroup>
                {SOURCES.map((s) => (
                  <ListItem
                    key={s.id}
                    icon={s.icon}
                    iconColor={s.color}
                    title={s.name}
                    subtitle={s.sub}
                    chevron={false}
                    right={<Radio on={source === s.id} />}
                    onPress={() => setSource(s.id)}
                  />
                ))}
              </ListGroup>
            </Section>
            <Section title={t('Como exportar')}>
              <Card style={{ gap: S.md }}>
                {STEPS[source].map((line, i) => (
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
            </Section>
            {error ? (
              <View style={{ gap: S.sm }}>
                <Banner tone="warn" icon="alert-circle" title={t('Ficheiro inválido')} body={error} />
                {picked ? (
                  <>
                    <Button kind="secondary" icon="mail-outline" title={t('Enviar ao suporte')} onPress={() => setHelp(true)} />
                    <T v="tiny" style={{ paddingHorizontal: 4 }}>
                      {t('Fazemos a primeira importação por ti. Só envias se aceitares.')}
                    </T>
                    <ImportSupport
                      visible={help}
                      onClose={() => setHelp(false)}
                      file={{ fileName: picked.name, uri: picked.uri, text: picked.text, source: 'unreadable', rows: picked.text ? picked.text.split(/\r?\n/).filter(Boolean).length : 0, read: 0, failed: [] }}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
          <Dock bottom={insets.bottom}>
            <ReadProgress bar={progress} />
            <Button title={busy ? t('A ler…') : t('Escolher ficheiro')} icon="document-attach" disabled={busy} onPress={choose} />
          </Dock>
        </View>
      ) : step.at === 'review' ? (
        <Review
          picked={picked}
          file={step.file}
          initial={step.first}
          bottom={insets.bottom}
          onBack={() => setStep({ at: 'pick' })}
          onImport={(r, placement, skipped) => {
            const p = place(r, placement, { source: step.file.source, appName: SOURCE_NAME[step.file.source], bankrolls: store.bankrolls, names: r.bankrollNames });
            const before = new Set(store.transfers.map((x) => x.id));
            const had = new Set(store.sessions.map((s) => s.id));
            const n = store.importData({ app: 'sweatbook', v: 1, exportedAt: Date.now(), hands: [], sessions: p.sessions, players: [], bankrolls: p.bankrolls, transfers: p.transfers });
            const moves = p.transfers.filter((x) => !before.has(x.id)).length;
            const fresh = p.sessions.filter((s) => !had.has(s.id));
            const recap = importRecap(fresh, [...store.sessions, ...fresh]);
            track('import_done', { source: step.file.source, sessions: n.sessions, hours: Math.round(recap.hours) });
            setStep({ at: 'done', added: n.sessions, total: r.sessions.length, skipped, moves, recap, source: step.file.source });
          }}
        />
      ) : (
        <Done step={step} bottom={insets.bottom} onAgain={() => setStep({ at: 'pick' })} />
      )}
    </>
  );
}

/** After the import: what came in, the best year, and a way straight into that year's review. */
function Done({ step, bottom, onAgain }: { step: Extract<Step, { at: 'done' }>; bottom: number; onAgain: () => void }) {
  const tight = useTight();
  const r = step.recap;
  const skipped = step.skipped
    ? step.skipped === 1
      ? t('1 parecida com uma sessão que já tinhas ficou de fora.')
      : t('{n} parecidas com sessões que já tinhas ficaram de fora.', { n: step.skipped })
    : null;
  const before =
    step.summary ??
    (step.moves
      ? step.moves === 1
        ? t('E 1 depósito ou levantamento no saldo da bankroll.')
        : t('E {n} depósitos e levantamentos no saldo da bankroll.', { n: step.moves })
      : step.total > step.added
        ? step.total - step.added === 1
          ? t('1 já estava no Sweatbook e ficou como estava.')
          : t('{n} já estavam no Sweatbook e ficaram como estavam.', { n: step.total - step.added })
        : null);
  const sub = [before, skipped].filter(Boolean).join(' ') || null;
  const span = r.from === null ? null : r.from === r.to ? t('Em {year}', { year: r.from }) : t('De {from} a {to}', { from: r.from, to: r.to! });
  const best = r.best;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.gutter, paddingTop: S.xxl, gap: S.xl, paddingBottom: 220 }}>
        <View style={{ gap: S.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.goodSoft, alignItems: 'center', justifyContent: 'center', marginBottom: S.xs }}>
            <Ionicons name="checkmark" size={30} color={C.good} />
          </View>
          <T v="label">{t('Já mudaste de app')}</T>
          <T v="title">{r.sessions === 1 ? t('Importámos 1 sessão') : t('Importámos {n} sessões', { n: r.sessions })}</T>
          {span || sub ? <T v="callout">{[span, sub].filter(Boolean).join('. ')}</T> : null}
        </View>

        {r.sessions ? (
          <StatGrid cols={tight ? 1 : 3}>
            <Stat label={t('Horas')} value={String(Math.round(r.hours))} />
            <Stat label={t('Salas')} value={String(r.venues)} />
            <Stat label={t('Anos')} value={String(r.from === null ? 0 : r.to! - r.from + 1)} />
          </StatGrid>
        ) : null}

        {best ? (
          <Card tone="accent" style={{ gap: S.xs }}>
            <T v="label" color={C.accent}>
              {best.byHours ? t('O ano em que mais jogaste') : t('O teu melhor ano')}
            </T>
            <Row gap={S.md} style={{ alignItems: 'baseline' }}>
              <T v="display">{String(best.year)}</T>
              {best.byHours ? (
                <T v="callout">{best.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: best.sessions })}</T>
              ) : (
                <T v="h1" color={C.good}>
                  {'+' + money(Math.round(best.profit), r.currency)}
                </T>
              )}
            </Row>
            <T v="small">{t('Vê o teu ano em cartões para partilhar: horas, melhor sessão, stakes e o maior pote.')}</T>
          </Card>
        ) : null}
      </ScrollView>
      <Dock bottom={bottom}>
        <View style={{ gap: S.sm }}>
          {best ? (
            <Button title={t('Ver o meu {year}', { year: best.year })} icon="sparkles" onPress={() => router.replace({ pathname: '/year', params: { y: String(best.year) } })} />
          ) : null}
          <Button kind={best ? 'secondary' : 'primary'} title={t('Ver bankroll')} onPress={() => router.replace('/(tabs)/bankroll')} />
          <Button kind="ghost" size="sm" title={t('Importar outro ficheiro')} onPress={onAgain} />
        </View>
      </Dock>
    </View>
  );
}

function Review({ file, initial, picked, bottom, onBack, onImport }: { file: Prepared; initial: ImportResult; picked: { name: string; uri: string } | null; bottom: number; onBack: () => void; onImport: (r: ImportResult, placement: Placement, skipped: number) => void }) {
  const tight = useTight();
  const { settings, sessions: local, transfers: localTx, bankrolls, defaultBankroll } = useStore();
  const pro = usePro();
  const [mapping, setMapping] = useState<Mapping>(file.mapping);
  const [order, setOrder] = useState<DateOrder | undefined>(undefined);
  // A file that doesn't say cash or tournament: start from what this player mostly plays.
  const [defaultKind, setDefaultKind] = useState<'cash' | 'mtt'>(() => mostlyPlays(local));
  const [editing, setEditing] = useState<Field | null>(null);
  const [showAll, setShowAll] = useState(file.source === 'generic' || file.source === 'pokeranalytics');

  // The pick screen already converted the file once; a change here converts it again in
  // steps, keeping the last result on screen and the import button waiting until it's done.
  const opts = { currency: settings.currency, tableSize: settings.defaultTableSize, source: file.source, order, defaultKind };
  const [conv, setConv] = useState({ r: initial, mapping, ...opts });
  const [importing, setImporting] = useState(false);
  const stale = conv.mapping !== mapping || conv.order !== order || conv.defaultKind !== defaultKind || conv.currency !== opts.currency || conv.tableSize !== opts.tableSize;
  useEffect(() => {
    if (!stale) return;
    let gone = false;
    const o = { currency: settings.currency, tableSize: settings.defaultTableSize, source: file.source, order, defaultKind };
    toSessionsAsync(file.table, mapping, o, { cancelled: () => gone }).then((r) => {
      if (r && !gone) setConv({ r, mapping, ...o });
    });
    return () => {
      gone = true;
    };
  }, [stale, file, mapping, order, defaultKind, settings.currency, settings.defaultTableSize]);
  // A small file is done before anyone could read "A atualizar…".
  const pending = stale && file.table.rows.length > 250;
  const r = conv.r;
  const have = useMemo(() => new Set([...local.map((s) => s.id), ...localTx.map((x) => x.id)]), [local, localTx]);
  // The same night from another app, or typed by hand: left out unless the player says otherwise.
  const dups = useMemo(() => likelyDuplicates(r.sessions, local), [r.sessions, local]);
  const dupMoves = useMemo(() => likelyDuplicateMoves(r.moves, localTx, bankrolls), [r.moves, localTx, bankrolls]);
  const [keepDups, setKeepDups] = useState(false);
  const skip = keepDups ? new Set<string>() : new Set([...dups, ...dupMoves]);
  const fresh = r.sessions.filter((s) => !have.has(s.id) && !skip.has(s.id)).length;
  const freshMoves = r.moves.filter((m) => !have.has(m.id) && !skip.has(m.id)).length;
  const deposits = r.moves.filter((m) => m.kind === 'deposit').length;
  const fileCurrencies = currenciesOf(r.sessions, r.moves, settings.currency);
  const [placement, setPlacement] = useState<Placement>(() => defaultPlacement(fileCurrencies, bankrolls, defaultBankroll));
  // A currency that showed up after a column change gets its default too.
  const placed: Placement = { ...defaultPlacement(fileCurrencies, bankrolls, defaultBankroll), ...placement };
  const canAddBankroll = pro.isPro || FREE.bankrolls === null || bankrolls.length < FREE.bankrolls;
  const list = [...r.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const currencies = new Set(r.sessions.map((s) => s.currency));
  const cur = currencies.size === 1 ? [...currencies][0] : settings.currency;
  const total = r.sessions.reduce((a, s) => a + profit(s), 0);
  const mtts = r.sessions.filter((s) => s.kind === 'mtt').length;
  const first = list[list.length - 1]?.startedAt;
  const last = list[0]?.startedAt;
  const known = file.source !== 'generic';
  const missing = mapping.start === undefined ? t('Data / início') : mapping.profit === undefined && mapping.cashOut === undefined && mapping.buyIn === undefined ? t('Lucro') : null;

  const sample = (col: number) => file.table.rows.find((row) => row[col])?.[col] ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 140 }}>
        <View style={{ gap: S.sm }}>
          <Row gap={S.sm}>
            <Ionicons name={known ? 'checkmark-circle' : 'document-text'} size={18} color={known ? C.good : C.textDim} />
            <T v="small" color={known ? C.good : C.textDim}>
              {known ? t('Ficheiro do {app} reconhecido', { app: SOURCE_NAME[file.source] }) : t('CSV com {n} colunas', { n: file.table.headers.length })}
            </T>
          </Row>
          <T v="h1">{r.sessions.length === 1 ? t('1 sessão encontrada') : t('{n} sessões encontradas', { n: r.sessions.length })}</T>
          {first ? (
            <T v="callout">
              {fullDate(first) === fullDate(last!)
                ? fullDate(first)
                : t('De {from} a {to}', { from: fullDate(first), to: fullDate(last!) })}
            </T>
          ) : null}
        </View>

        {r.sessions.length ? (
          <StatGrid cols={tight ? 1 : 3}>
            <Stat label={t('Lucro')} value={plus(total) + money(Math.round(total), cur)} tone={total >= 0 ? 'good' : 'bad'} />
            <Stat label="Cash" value={String(r.sessions.length - mtts)} />
            <Stat label={t('Torneios')} value={String(mtts)} />
          </StatGrid>
        ) : null}

        {missing ? <Banner tone="warn" icon="alert-circle" title={t('Falta a coluna «{field}»', { field: missing })} body={t('Escolhe-a em Colunas, mais abaixo.')} /> : null}
        {r.moves.length ? (
          <Card tone="inset" style={{ gap: 6, paddingVertical: S.md }}>
            <Note
              icon="swap-vertical"
              text={t(r.moves.length === 1 ? '{list} entra no saldo da bankroll.' : '{list} entram no saldo da bankroll.', {
                list: [
                  deposits ? (deposits === 1 ? t('1 depósito') : t('{n} depósitos', { n: deposits })) : '',
                  r.moves.length - deposits ? (r.moves.length - deposits === 1 ? t('1 levantamento') : t('{n} levantamentos', { n: r.moves.length - deposits })) : '',
                ]
                  .filter(Boolean)
                  .join(t(' e ')),
              })}
            />
          </Card>
        ) : null}
        {r.transfers || r.unreadable || fresh < r.sessions.length ? (
          <Card tone="inset" style={{ gap: 6, paddingVertical: S.md }}>
            {fresh < r.sessions.length ? <Note icon="copy-outline" text={r.sessions.length - fresh === 1 ? t('1 já está no Sweatbook e não entra outra vez.') : t('{n} já estão no Sweatbook e não entram outra vez.', { n: r.sessions.length - fresh })} /> : null}
            {r.transfers ? <Note icon="swap-horizontal" text={r.transfers === 1 ? t('1 depósito ou levantamento sem data ou valor fica de fora.') : t('{n} depósitos ou levantamentos sem data ou valor ficam de fora.', { n: r.transfers })} /> : null}
            {r.unreadable ? <Note icon="help-circle-outline" text={r.unreadable === 1 ? t('1 linha sem data ou sem valores fica de fora.') : t('{n} linhas sem data ou sem valores ficam de fora.', { n: r.unreadable })} /> : null}
            {currencies.size > 1 ? <Note icon="cash-outline" text={t('Há sessões em {n} moedas; cada uma fica na sua.', { n: currencies.size })} /> : null}
          </Card>
        ) : null}

        {dups.size + dupMoves.size ? (
          <View style={{ gap: S.sm }}>
            <ListGroup>
              <ToggleItem
                icon="copy-outline"
                title={t('Importar também as que parecem repetidas')}
                subtitle={[
                  dups.size === 0 ? '' : dups.size === 1 ? t('1 sessão tem o mesmo dia e resultado de uma que já tens.') : t('{n} sessões têm o mesmo dia e resultado de outras que já tens.', { n: dups.size }),
                  dupMoves.size === 0 ? '' : dupMoves.size === 1 ? t('1 depósito ou levantamento igual a um que já tens.') : t('{n} depósitos ou levantamentos iguais a outros que já tens.', { n: dupMoves.size }),
                ]
                  .filter(Boolean)
                  .join(' ')}
                value={keepDups}
                onChange={setKeepDups}
                lines={3}
              />
              {/* Which ones, so two €100 tournaments lost on the same day can be told apart from a real repeat. */}
              {list
                .filter((s) => dups.has(s.id))
                .slice(0, 20)
                .map((s) => (
                  <ListItem
                    key={s.id}
                    title={s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash')}
                    subtitle={[fullDate(s.startedAt), s.kind === 'mtt' ? t('Torneio') : 'Cash', s.venue].filter(Boolean).join(' · ')}
                    right={<Amount value={profit(s)} text={money(Math.round(profit(s) * 100) / 100, s.currency)} />}
                  />
                ))}
            </ListGroup>
            {dups.size > 20 ? <T v="small">{t('E mais {n}.', { n: dups.size - 20 })}</T> : null}
          </View>
        ) : null}

        {r.failed.length ? <FailedRows file={file} picked={picked} failed={r.failed} read={r.sessions.length} /> : null}

        {fileCurrencies.length ? (
          <Section title={t('Para que bankroll')} hint={t('Cada moeda vai para uma bankroll dessa moeda.')}>
            {fileCurrencies.map((c) => {
              const mine = bankrolls.filter((b) => b.currency === c).sort((a, b) => a.createdAt - b.createdAt);
              // A currency with no bankroll yet gets one anyway, so that one is free.
              const newLocked = mine.length > 0 && !canAddBankroll;
              return (
                <View key={c} style={{ gap: S.sm }}>
                  {fileCurrencies.length > 1 ? <T v="small">{c}</T> : null}
                  <ChipRow>
                    {mine.map((b) => (
                      <Chip key={b.id} label={b.name} active={placed[c] === b.id} onPress={() => setPlacement({ ...placed, [c]: b.id })} />
                    ))}
                    <Chip
                      label={mine.length ? t('Nova: {name}', { name: SOURCE_NAME[file.source] }) : t('Nova bankroll {currency}', { currency: c })}
                      icon={newLocked ? 'lock-closed' : 'add'}
                      active={placed[c] === NEW}
                      onPress={() => (newLocked ? pro.paywall('stats') : setPlacement({ ...placed, [c]: NEW }))}
                    />
                  </ChipRow>
                </View>
              );
            })}
          </Section>
        ) : null}

        {!r.kindKnown && r.sessions.length ? (
          <Section title={t('Estas sessões são')} hint={local.length ? t('O ficheiro não diz se é cash ou torneio. Começámos pelo que mais jogas; podes mudar cada sessão depois.') : t('O ficheiro não diz se é cash ou torneio. Podes mudar cada sessão depois.')}>
            <Segmented options={[{ key: 'cash', label: 'Cash' }, { key: 'mtt', label: t('Torneios') }]} value={defaultKind} onChange={setDefaultKind} />
          </Section>
        ) : null}

        {r.ambiguousDates ? (
          <Section title={t('Datas como 03/04')} hint={t('Confirma numa sessão que conheças.')}>
            <Segmented
              options={[
                { key: 'dmy', label: t('Dia/mês') },
                { key: 'mdy', label: t('Mês/dia') },
              ]}
              value={order ?? r.order}
              onChange={setOrder}
            />
          </Section>
        ) : null}

        {list.length ? (
          <Section title={t('Últimas sessões')}>
            <ListGroup>
              {list.slice(0, 5).map((s) => (
                <ListItem
                  key={s.id}
                  title={
                    tight ? (
                      // Big text: the amount goes under the name instead of squeezing it.
                      <View style={{ gap: 2 }}>
                        <T v="body">{s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash')}</T>
                        <Amount value={profit(s)} text={money(Math.round(profit(s) * 100) / 100, s.currency)} />
                      </View>
                    ) : (
                      s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash')
                    )
                  }
                  subtitle={[fullDate(s.startedAt), s.venue].filter(Boolean).join(' · ')}
                  right={tight ? undefined : <Amount value={profit(s)} text={money(Math.round(profit(s) * 100) / 100, s.currency)} />}
                />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        <Section title={t('Colunas')} action={showAll ? undefined : t('Rever')} onAction={() => setShowAll(true)} hint={showAll ? t('Toca num campo para escolher outra coluna do ficheiro.') : undefined}>
          {showAll ? (
            <ListGroup>
              {MAPPABLE.map((f) => (
                <ListItem
                  key={f}
                  title={FIELD_LABEL[f]!}
                  subtitle={mapping[f] !== undefined ? (tight ? [file.table.headers[mapping[f]!], sample(mapping[f]!)].filter(Boolean).join(' · ') : sample(mapping[f]!) || ' ') : undefined}
                  value={tight ? (mapping[f] === undefined ? '—' : undefined) : mapping[f] !== undefined ? file.table.headers[mapping[f]!] : '—'}
                  valueColor={mapping[f] !== undefined ? C.text : C.muted}
                  onPress={() => setEditing(f)}
                />
              ))}
            </ListGroup>
          ) : (
            <Card onPress={() => setShowAll(true)} style={{ paddingVertical: S.md }}>
              <Row gap={S.md}>
                <Ionicons name="git-compare-outline" size={18} color={C.textDim} />
                <T v="small" style={{ flex: 1 }}>
                  {t('{n} colunas lidas automaticamente', { n: Object.keys(mapping).length })}
                </T>
                <Ionicons name="chevron-forward" size={17} color={C.muted} />
              </Row>
            </Card>
          )}
        </Section>
      </ScrollView>

      <Dock bottom={bottom}>
        <View style={{ flexDirection: tight ? 'column-reverse' : 'row', gap: S.sm }}>
          <Button kind="secondary" title={t('Voltar')} onPress={onBack} style={{ paddingHorizontal: 18 }} />
          <Button
            style={tight ? undefined : { flex: 1 }}
            title={importing ? t('A importar…') : pending ? t('A atualizar…') : r.sessions.length + r.moves.length === 0 ? t('Nada para importar') : fresh + freshMoves === 0 ? t('Nada de novo para importar') : fresh === 0 ? t('Importar movimentos') : fresh === 1 ? t('Importar 1 sessão') : t('Importar {n} sessões', { n: fresh })}
            disabled={importing || stale || fresh + freshMoves === 0}
            onPress={async () => {
              // Thousands of sessions take a moment to add: say so first.
              setImporting(true);
              await paint();
              try {
                const sessions = r.sessions.filter((s) => !skip.has(s.id));
                onImport(skip.size ? { ...r, sessions, moves: r.moves.filter((m) => !skip.has(m.id)) } : r, placed, r.sessions.length - sessions.length);
              } finally {
                setImporting(false);
              }
            }}
          />
        </View>
      </Dock>

      <ColumnSheet
        field={editing}
        headers={file.table.headers}
        sample={sample}
        current={editing ? mapping[editing] : undefined}
        onClose={() => setEditing(null)}
        onPick={(col) => {
          if (!editing) return;
          const next: Mapping = { ...mapping };
          // One column, one field: taking it from another field frees that one.
          for (const k of Object.keys(next) as Field[]) if (next[k] === col) delete next[k];
          if (col === undefined) delete next[editing];
          else next[editing] = col;
          setMapping(next);
          setEditing(null);
        }}
      />
    </View>
  );
}

function ColumnSheet({ field, headers, sample, current, onClose, onPick }: { field: Field | null; headers: string[]; sample: (col: number) => string; current?: number; onClose: () => void; onPick: (col: number | undefined) => void }) {
  const insets = useSafeAreaInsets();
  const animation = useSheetAnimation();
  return (
    <Modal visible={!!field} transparent animationType={animation} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} accessibilityLabel={t('Fechar')} />
      <View style={{ maxHeight: '75%', backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingTop: S.lg + 4, paddingHorizontal: S.gutter, paddingBottom: insets.bottom + S.md, gap: S.md }}>
        <SheetHeader title={field ? FIELD_LABEL[field]! : ''} onClose={onClose} closeLabel={t('Fechar')} />
        <ScrollView contentContainerStyle={{ paddingBottom: S.md }}>
          <ListGroup>
            <ListItem title={t('Nenhuma coluna')} chevron={false} right={<Radio on={current === undefined} />} onPress={() => onPick(undefined)} />
            {headers.map((h, i) => (
              <ListItem key={i} title={h} subtitle={sample(i) || t('(vazia)')} chevron={false} right={<Radio on={current === i} />} onPress={() => onPick(i)} />
            ))}
          </ListGroup>
        </ScrollView>
      </View>
    </Modal>
  );
}

const FAIL_TEXT: Record<FailReason, string> = {
  noDate: t('Sem data'),
  badDate: t('Data que não se lê'),
  noMoney: t('Sem resultado, buy-in nem prémio'),
  badMoney: t('Valor que não é um número'),
  badMove: t('Depósito ou levantamento sem valor'),
  running: t('Sessão ainda a decorrer: acaba-a na outra app e exporta outra vez'),
};

/** Each row left out, with its line in the file and why, plus the choice to send the file to support. */
function FailedRows({ file, picked, failed, read }: { file: Prepared; picked: { name: string; uri: string } | null; failed: FailedRow[]; read: number }) {
  const [all, setAll] = useState(false);
  const [send, setSend] = useState(false);
  const shown = all ? failed.slice(0, 100) : failed.slice(0, 4);
  return (
    <Section title={t('Linhas que ficam de fora')} hint={read ? t('O resto entra na mesma. Podes corrigir no ficheiro e importar outra vez: o que já entrou não se repete.') : t('Nenhuma linha se lê. Corrige o ficheiro e importa outra vez.')}>
      <ListGroup>
        {shown.map((f) => (
          <ListItem key={f.line} icon="alert-circle-outline" iconColor={C.warn} title={t('Linha {n}', { n: f.line })} subtitle={`${FAIL_TEXT[f.reason]}${f.value ? ' · ' + f.value : ''}`} chevron={false} />
        ))}
      </ListGroup>
      <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
        {failed.length > shown.length && !all ? <Button kind="ghost" size="sm" title={t('Ver as {n}', { n: failed.length })} onPress={() => setAll(true)} /> : null}
        <Button kind="ghost" size="sm" icon="mail-outline" title={t('Enviar ao suporte')} onPress={() => setSend(true)} />
      </Row>
      <ImportSupport
        visible={send}
        onClose={() => setSend(false)}
        file={{ fileName: picked?.name ?? `import-${file.source}.csv`, uri: picked?.uri, text: file.text, source: file.source, rows: file.table.rows.length, read, failed }}
      />
    </Section>
  );
}

type Progress = { done: number; total: number };

function progressBar() {
  let now: Progress | null = null;
  const listeners = new Set<() => void>();
  return {
    set(p: Progress | null) {
      now = p;
      listeners.forEach((l) => l());
    },
    get: () => now,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}

function ReadProgress({ bar }: { bar: ReturnType<typeof progressBar> }) {
  const p = useSyncExternalStore(bar.subscribe, bar.get);
  if (!p) return null;
  const { done, total } = p;
  return (
    <View style={{ gap: 6, marginBottom: S.sm }} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }} accessibilityLabel={t('A ler {done} de {total} linhas…', { done, total })}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden' }}>
        <View style={{ height: 4, width: `${Math.round((done / Math.max(total, 1)) * 100)}%`, backgroundColor: C.accent }} />
      </View>
      <T v="small">{t('A ler {done} de {total} linhas…', { done, total })}</T>
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

function Radio({ on }: { on: boolean }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? C.accent : C.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
      {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} /> : null}
    </View>
  );
}

function Note({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
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
