// Bring your history from another app: Poker Bankroll Tracker, Pokerbase,
// Poker Analytics, any CSV, or a Sweatbook backup. Pick where it comes from,
// pick the file, check what was read (and fix a column if needed), import.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FREE } from '@/billing/plans';
import { usePro } from '@/billing/pro';
import { Amount, Banner, Button, Card, Chip, ChipRow, Empty, ListGroup, ListItem, Row, Section, Segmented, SheetHeader, Stat, StatGrid, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { currenciesOf, defaultPlacement, NEW, place, type Placement } from '@/import/bankrolls';
import { prepare, toSessions, type DateOrder, type FailedRow, type FailReason, type ImportResult, type Prepared } from '@/import/convert';
import type { Field, Mapping, SourceId } from '@/import/mapping';
import { pickTextFile, saveTextFile } from '@/lib/files';
import { money } from '@/poker/format';
import { importSummary, parseBackup } from '@/store/backup';
import { profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

type Pick = Exclude<SourceId, 'generic'> | 'csv';

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
  finish: t('Lugar final'),
  field: t('Jogadores no torneio'),
  notes: t('Notas'),
};
const MAPPABLE = Object.keys(FIELD_LABEL) as Field[];

type Step = { at: 'pick' } | { at: 'review'; file: Prepared } | { at: 'done'; added: number; total: number; moves?: number; summary?: string };

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [source, setSource] = useState<Pick>('pbt');
  const [step, setStep] = useState<Step>({ at: 'pick' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async () => {
    setError(null);
    setBusy(true);
    try {
      const text = await pickTextFile();
      if (text === null) return;
      if (/^\s*\{/.test(text)) {
        // A Sweatbook backup: hands, sessions and players in one go.
        const n = store.importData(parseBackup(text));
        setStep({ at: 'done', added: n.sessions + n.hands + n.players, total: n.sessions, summary: importSummary(n) });
        return;
      }
      const file = prepare(text);
      if (!file.table.rows.length) throw new Error('empty');
      if (file.source === 'generic' && source === 'pokeranalytics') file.source = 'pokeranalytics';
      setStep({ at: 'review', file });
    } catch {
      setError(t('Não conseguimos ler este ficheiro. Escolhe o CSV exportado pela outra app (ou um .json do Sweatbook).'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Importar de outra app') }} />
      {step.at === 'pick' ? (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <ScrollView contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 140 }}>
            <View style={{ gap: S.sm }}>
              <T v="h1">{t('Traz o teu histórico')}</T>
              <T v="callout">{t('As sessões que tens noutra app entram no teu bankroll. Junta-se ao que já tens, não apaga nada.')}</T>
            </View>
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
            {error ? <Banner tone="warn" icon="alert-circle" title={t('Ficheiro inválido')} body={error} /> : null}
          </ScrollView>
          <Dock bottom={insets.bottom}>
            <Button title={busy ? t('A ler…') : t('Escolher ficheiro')} icon="document-attach" disabled={busy} onPress={choose} />
          </Dock>
        </View>
      ) : step.at === 'review' ? (
        <Review
          file={step.file}
          bottom={insets.bottom}
          onBack={() => setStep({ at: 'pick' })}
          onImport={(r, placement) => {
            const p = place(r, placement, { source: step.file.source, appName: SOURCE_NAME[step.file.source], bankrolls: store.bankrolls });
            const before = new Set(store.transfers.map((x) => x.id));
            const n = store.importData({ app: 'sweatbook', v: 1, exportedAt: Date.now(), hands: [], sessions: p.sessions, players: [], bankrolls: p.bankrolls, transfers: p.transfers });
            const moves = p.transfers.filter((x) => !before.has(x.id)).length;
            setStep({ at: 'done', added: n.sessions, total: r.sessions.length, moves });
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: S.gutter, paddingBottom: insets.bottom + S.xl }}>
          <Empty
            icon="checkmark-circle"
            title={step.added === 1 ? t('1 sessão importada') : t('{n} sessões importadas', { n: step.added })}
            body={
              step.summary ??
              (step.moves
                ? step.moves === 1
                  ? t('E 1 depósito ou levantamento no saldo da bankroll.')
                  : t('E {n} depósitos e levantamentos no saldo da bankroll.', { n: step.moves })
                : step.total > step.added
                ? step.total - step.added === 1
                  ? t('1 já estava no Sweatbook e ficou como estava.')
                  : t('{n} já estavam no Sweatbook e ficaram como estavam.', { n: step.total - step.added })
                : t('Já contam no bankroll, no lucro por hora e nos resultados por sala.'))
            }
            action={
              <View style={{ gap: S.sm }}>
                <Button title={t('Ver bankroll')} onPress={() => router.replace('/(tabs)/bankroll')} />
                <Button kind="ghost" title={t('Importar outro ficheiro')} onPress={() => setStep({ at: 'pick' })} />
              </View>
            }
          />
        </View>
      )}
    </>
  );
}

function Review({ file, bottom, onBack, onImport }: { file: Prepared; bottom: number; onBack: () => void; onImport: (r: ImportResult, placement: Placement) => void }) {
  const { settings, sessions: local, transfers: localTx, bankrolls, defaultBankroll } = useStore();
  const pro = usePro();
  const [mapping, setMapping] = useState<Mapping>(file.mapping);
  const [order, setOrder] = useState<DateOrder | undefined>(undefined);
  const [defaultKind, setDefaultKind] = useState<'cash' | 'mtt'>('cash');
  const [editing, setEditing] = useState<Field | null>(null);
  const [showAll, setShowAll] = useState(file.source === 'generic' || file.source === 'pokeranalytics');

  const r = useMemo(
    () => toSessions(file.table, mapping, { currency: settings.currency, tableSize: settings.defaultTableSize, source: file.source, order, defaultKind }),
    [file, mapping, order, defaultKind, settings.currency, settings.defaultTableSize],
  );
  const have = useMemo(() => new Set([...local.map((s) => s.id), ...localTx.map((x) => x.id)]), [local, localTx]);
  const fresh = r.sessions.filter((s) => !have.has(s.id)).length;
  const freshMoves = r.moves.filter((m) => !have.has(m.id)).length;
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
          <StatGrid cols={3}>
            <Stat label={t('Lucro')} value={(total > 0 ? '+' : '') + money(Math.round(total), cur)} tone={total >= 0 ? 'good' : 'bad'} />
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

        {r.failed.length ? <FailedRows file={file} failed={r.failed} /> : null}

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
          <Section title={t('Estas sessões são')} hint={t('O ficheiro não diz se é cash ou torneio. Podes mudar cada sessão depois.')}>
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
                  title={s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash')}
                  subtitle={[fullDate(s.startedAt), s.venue].filter(Boolean).join(' · ')}
                  right={<Amount value={profit(s)} text={money(Math.round(profit(s) * 100) / 100, s.currency)} />}
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
                  subtitle={mapping[f] !== undefined ? sample(mapping[f]!) || ' ' : undefined}
                  value={mapping[f] !== undefined ? file.table.headers[mapping[f]!] : '—'}
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
        <Row gap={S.sm}>
          <Button kind="secondary" title={t('Voltar')} onPress={onBack} style={{ paddingHorizontal: 18 }} />
          <Button
            style={{ flex: 1 }}
            title={fresh + freshMoves === 0 ? t('Nada de novo para importar') : fresh === 0 ? t('Importar movimentos') : fresh === 1 ? t('Importar 1 sessão') : t('Importar {n} sessões', { n: fresh })}
            disabled={fresh + freshMoves === 0}
            onPress={() => onImport(r, placed)}
          />
        </Row>
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
  return (
    <Modal visible={!!field} transparent animationType="slide" onRequestClose={onClose}>
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
  badMove: t('Depósito ou levantamento sem valor'),
};

/** Each row left out, with its line in the file and why, plus the choice to send us the file. */
function FailedRows({ file, failed }: { file: Prepared; failed: FailedRow[] }) {
  const insets = useSafeAreaInsets();
  const [all, setAll] = useState(false);
  const [send, setSend] = useState(false);
  const shown = all ? failed.slice(0, 100) : failed.slice(0, 4);
  return (
    <Section title={t('Linhas que ficam de fora')} hint={t('O resto entra na mesma. Podes corrigir no ficheiro e importar outra vez: o que já entrou não se repete.')}>
      <ListGroup>
        {shown.map((f) => (
          <ListItem key={f.line} icon="alert-circle-outline" iconColor={C.warn} title={t('Linha {n}', { n: f.line })} subtitle={`${FAIL_TEXT[f.reason]}${f.value ? ' · ' + f.value : ''}`} chevron={false} />
        ))}
      </ListGroup>
      <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
        {failed.length > shown.length && !all ? <Button kind="ghost" size="sm" title={t('Ver as {n}', { n: failed.length })} onPress={() => setAll(true)} /> : null}
        <Button kind="ghost" size="sm" icon="mail-outline" title={t('Envia-nos o ficheiro')} onPress={() => setSend(true)} />
      </Row>
      <Modal visible={send} transparent animationType="slide" onRequestClose={() => setSend(false)}>
        <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={() => setSend(false)} accessibilityLabel={t('Fechar')} />
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingTop: S.lg + 4, paddingHorizontal: S.gutter, paddingBottom: insets.bottom + S.md, gap: S.md }}>
          <SheetHeader title={t('Envia-nos o ficheiro')} onClose={() => setSend(false)} closeLabel={t('Fechar')} />
          <T v="body" style={{ color: C.textDim }}>
            {t('Vemos porque é que estas linhas não entram e melhoramos a importação para o teu ficheiro.')}
          </T>
          <Card tone="inset" style={{ gap: S.xs }}>
            <Row gap={S.sm}>
              <Ionicons name="lock-closed-outline" size={16} color={C.info} />
              <T v="h3" color={C.info} style={{ flex: 1 }}>
                {t('O ficheiro tem os teus dados de póquer')}
              </T>
            </Row>
            <T v="small">{t('Datas, salas e resultados. Só sai do telemóvel se o enviares tu, por email ou outra app à tua escolha. Nada é enviado sozinho.')}</T>
          </Card>
          <Button
            icon="share-outline"
            title={t('Escolher como enviar')}
            onPress={async () => {
              setSend(false);
              await saveTextFile(`sweatbook-importacao-${file.source}.csv`, file.text, 'text/csv').catch(() => {});
            }}
          />
        </View>
      </Modal>
    </Section>
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
  return new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
