// Tournament mode for the running tournament session: the blind structure and
// the level clock synced to the floor's in one tap, your stack in BB and M
// against the average, the pay jumps ahead, and the final-table deal. All of it
// lives on the session (Session.tourney), so it works offline.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { AmountPad } from '@/components/AmountPad';
import { useNow } from '@/components/useNow';
import { Badge, Button, Card, Chip, ChipRow, Divider, Empty, Field, IconButton, ListGroup, ListItem, Row, Section, SheetHeader, Stat, StatGrid, T, tap, useSheetPad } from '@/components/ui';
import { locale, t } from '@/i18n';
import { breakOf, levelAfter, nextLevelAt } from '@/lib/lock-screen/live-state';
import { askExactAlarms, exactAlarmsAllowed } from '@/lib/lock-screen/reminder';
import { kindOn } from '@/lib/notify-policy';
import { useSheetAnimation } from '@/lib/motion';
import { canReadStructure, photoStructure } from '@/lib/structure-photo';
import { bbs, chips, decimal, money, timeOf } from '@/poker/format';
import { averageStack, levelOf, parsePayouts, parseStructure, payState, stackDepth, syncTo, syncedLevelStart, TEMPLATES, templateStructure, type Level, type Tourney } from '@/poker/tourney';
import { useStore } from '@/store/store';
import { isPaused } from '@/store/session-math';
import type { Session } from '@/store/types';
import { C, S } from '@/theme';
import { ordinal } from '@/share/festival-card';

const TEMPLATE_NAME: Record<string, string> = { turbo: 'Turbo', standard: 'Normal', deep: 'Deep', highroller: 'High roller' };

const mmss = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};
const blindsOf = (l: { sb: number; bb: number; ante: number }) => `${chips(l.sb)}/${chips(l.bb)}` + (l.ante ? ` (${chips(l.ante)})` : '');
/** The structure as the paste sheet shows it: one level per line, breaks as "Break 15". */
const structureText = (st: Level[]) => st.map((l) => `${l.sb}/${l.bb}/${l.ante} ${l.minutes}` + (l.breakAfter ? `\nBreak ${l.breakAfter}` : '')).join('\n');

/** Minutes the player can tap to match the floor's clock: the last few one by one, then every 5. */
function syncChoices(levelMinutes: number): number[] {
  const out = [1, 2, 3, 4];
  for (let m = 5; m <= levelMinutes; m += 5) out.push(m);
  return out.filter((m) => m <= levelMinutes);
}

export default function TournamentScreen() {
  const { activeSession } = useStore();
  if (!activeSession || activeSession.kind !== 'mtt') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: S.gutter }}>
        <Stack.Screen options={{ title: t('Modo torneio') }} />
        <Empty icon="trophy-outline" title={t('Sem torneio a decorrer')} body={t('Começa uma sessão de torneio para teres a estrutura, o relógio e os prémios aqui.')} action={<Button title={t('Ir para a sessão')} onPress={() => router.replace('/session')} />} />
      </View>
    );
  }
  return <Tournament s={activeSession} />;
}

function Tournament({ s }: { s: Session }) {
  const { saveSession } = useStore();
  const tour: Tourney = s.tourney ?? {};
  const st = tour.structure?.length ? tour.structure : undefined;
  const [pad, setPad] = useState<null | 'stack' | 'left' | 'entries' | 'startStack' | 'bounties'>(null);
  const [sheet, setSheet] = useState<null | 'structure' | 'payouts'>(null);
  const [allLevels, setAllLevels] = useState(false);
  const save = (p: Partial<Session>) => saveSession({ ...s, ...p });
  const setTour = (p: Partial<Tourney>, extra: Partial<Session> = {}) => save({ ...extra, tourney: { ...tour, ...p } });

  const level = s.level ?? 1;
  const depth = stackDepth(s.stack, s, s.tableSize || 9);
  // The stack the session started with stands in until the player types the official one.
  const startStack = tour.startStack || s.stackLog[0]?.stack || 0;
  const avg = averageStack({ ...tour, startStack });
  const pay = tour.payouts?.length && tour.left ? payState(tour.payouts, tour.left) : null;

  const applyStructure = (structure: Level[], name?: string) => {
    tap('success');
    // Keep the level you're on; the clock starts on it now.
    setTour({ structure, structureName: name }, syncTo(structure, level));
  };
  const goLevel = (dir: 1 | -1) => {
    tap();
    save(st ? syncTo(st, level + dir) : levelAfter(s, dir));
  };
  const syncMinutes = (m: number) => {
    tap('success');
    if (st) save(syncTo(st, level, m));
    else if (s.levelMinutes) save({ levelStartedAt: syncedLevelStart(s.levelMinutes, m) });
  };
  // The floor stops the clock for a break: pausing the session does the same to the level clock.
  const togglePause = () => {
    tap();
    const now = Date.now();
    if (isPaused(s)) save({ breaks: s.breaks.map((b, i) => (i === s.breaks.length - 1 ? { ...b, end: now } : b)) });
    else save({ breaks: [...s.breaks, { start: now }] });
  };
  const bust = (n: number) => {
    if (!tour.left) return;
    tap();
    setTour({ left: Math.max(1, tour.left - n) });
  };
  const toChop = () => {
    const n = Math.min(9, Math.max(2, tour.left ?? 3));
    router.push({ pathname: '/chop', params: { n: String(n), stack: String(s.stack), pays: (tour.payouts ?? []).slice(0, 9).join(',') } });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Modo torneio') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}>
        <LevelCard s={s} st={st} onLevel={goLevel} onSync={syncMinutes} onPause={togglePause} />
        {s.levelMinutes ? <ExactAlarms /> : null}

        <Section title={t('O teu stack')}>
          <Card onPress={() => setPad('stack')} accessibilityLabel={t('Atualizar stack')} style={{ gap: S.md }}>
            <Row>
              <T v="label" style={{ flex: 1 }}>
                Stack
              </T>
              <Ionicons name="pencil" size={13} color={C.accent} />
            </Row>
            <T v="monoXL" style={{ fontSize: 34, lineHeight: 40 }}>
              {chips(s.stack)}
            </T>
            <StatGrid cols={3}>
              <Stat label="BB" value={decimal(depth.bb, depth.bb < 10 ? 1 : 0)} tone={depth.bb < 10 ? 'bad' : depth.bb < 20 ? 'warn' : undefined} />
              <Stat label="M" value={decimal(depth.m, depth.m < 10 ? 1 : 0)} tone={depth.m < 6 ? 'bad' : depth.m < 12 ? 'warn' : undefined} />
              <Stat label={t('vs média')} value={avg ? Math.round((s.stack / avg) * 100) + '%' : '—'} tone={avg ? (s.stack >= avg ? 'good' : 'bad') : undefined} />
            </StatGrid>
          </Card>
        </Section>

        <Section title={t('Jogadores')} hint={avg ? t('Stack médio {avg} · {bb}', { avg: chips(Math.round(avg)), bb: bbs(avg, s.bb) }) : t('Com entradas, jogadores e stack inicial vês o stack médio.')}>
          <Card style={{ gap: S.md }}>
            <Row gap={S.md}>
              <Cell label={t('Restam')} value={tour.left ? tour.left.toLocaleString(locale) : undefined} onPress={() => setPad('left')} big />
              <Button size="md" kind="secondary" title="−1" onPress={() => bust(1)} disabled={!tour.left} style={{ minWidth: 64 }} haptic={false} />
              <Button size="md" kind="secondary" title="−5" onPress={() => bust(5)} disabled={!tour.left} style={{ minWidth: 64 }} haptic={false} />
            </Row>
            <Divider />
            <Row gap={S.md}>
              <Cell label={t('Entradas')} value={tour.entries ? tour.entries.toLocaleString(locale) : undefined} onPress={() => setPad('entries')} />
              <Cell label={t('Stack inicial')} value={startStack ? chips(startStack) : undefined} onPress={() => setPad('startStack')} />
            </Row>
            <Divider />
            <Row gap={S.md}>
              <Cell label="Bounties" value={tour.bounties ? money(tour.bounties, s.currency) : undefined} onPress={() => setPad('bounties')} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <T v="tiny">{t('Contam no prémio: soma-os ao valor que recebes no fim.')}</T>
              </View>
            </Row>
          </Card>
        </Section>

        <Section title={t('Prémios')} action={tour.payouts?.length ? t('Editar') : undefined} onAction={() => setSheet('payouts')}>
          {tour.payouts?.length ? (
            <PayCard pay={pay} payouts={tour.payouts} left={tour.left} currency={s.currency} />
          ) : (
            <Card onPress={() => setSheet('payouts')} style={{ gap: 4 }}>
              <Row>
                <Ionicons name="cash-outline" size={18} color={C.accent} />
                <T v="h3" style={{ flex: 1 }}>
                  {t('Colar a tabela de prémios')}
                </T>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </Row>
              <T v="small">{t('Vês quantos faltam para o dinheiro e para o próximo salto.')}</T>
            </Card>
          )}
        </Section>

        <Section title={t('Mesa final')}>
          <ListGroup>
            <ListItem icon="pie-chart-outline" title={t('Calculadora de deal')} subtitle={t('ICM e chip chop com os stacks da mesa')} onPress={toChop} chevron />
          </ListGroup>
        </Section>

        <Section title={t('Estrutura')} action={st ? t('Colar outra') : undefined} onAction={() => setSheet('structure')}>
          <ChipRow>
            {TEMPLATES.map((x) => (
              <Chip key={x.id} label={`${TEMPLATE_NAME[x.id]} · ${x.minutes}′`} active={tour.structureName === x.id} onPress={() => applyStructure(templateStructure(x.minutes), x.id)} />
            ))}
            <Chip icon="clipboard-outline" label={t('Colar')} active={!!st && !tour.structureName} onPress={() => setSheet('structure')} />
          </ChipRow>
          {st ? (
            <Card padded={false}>
              {st.map((l, i) => {
                const n = i + 1;
                if (!allLevels && (n < level - 1 || n > level + 4)) return null;
                const cur = n === level;
                return (
                  <View key={n}>
                    {n > Math.max(1, allLevels ? 1 : level - 1) ? <Divider inset={S.lg} /> : null}
                    <Row style={{ paddingHorizontal: S.lg, paddingVertical: 11, backgroundColor: cur ? C.accentSoft : undefined }}>
                      <T v="monoS" color={cur ? C.accent : C.muted} style={{ width: 28 }}>
                        {n}
                      </T>
                      <T v="mono" color={cur ? C.accent : n < level ? C.muted : C.text} style={{ flex: 1 }}>
                        {blindsOf(l)}
                      </T>
                      <T v="monoS">{l.minutes}′</T>
                    </Row>
                    {l.breakAfter ? (
                      <>
                        <Divider inset={S.lg} />
                        <Row style={{ paddingHorizontal: S.lg, paddingVertical: 8 }}>
                          <Ionicons name="cafe-outline" size={14} color={n < level ? C.muted : C.warn} style={{ width: 28 }} />
                          <T v="small" color={n < level ? C.muted : C.warn} style={{ flex: 1 }}>
                            {t('Intervalo')}
                          </T>
                          <T v="monoS" color={n < level ? C.muted : C.warn}>
                            {l.breakAfter}′
                          </T>
                        </Row>
                      </>
                    ) : null}
                  </View>
                );
              })}
              <Divider />
              <Button kind="plain" size="sm" title={allLevels ? t('Mostrar menos') : t('Ver os {n} níveis', { n: st.length })} onPress={() => setAllLevels(!allLevels)} />
            </Card>
          ) : (
            <T v="small">{t('Escolhe um modelo ou cola a estrutura do torneio. Subir de nível passa a seguir a estrutura, com a duração de cada nível.')}</T>
          )}
        </Section>
      </ScrollView>

      <AmountPad
        visible={pad === 'stack'}
        title={t('Stack atual')}
        bb={s.bb}
        onClose={() => setPad(null)}
        onDone={(v) => {
          setPad(null);
          save({ stack: v, stackLog: [...s.stackLog, { t: Date.now(), stack: v, level: s.level }] });
        }}
      />
      <AmountPad
        visible={pad === 'left' || pad === 'entries' || pad === 'startStack' || pad === 'bounties'}
        plain
        title={pad === 'left' ? t('Jogadores que restam') : pad === 'entries' ? t('Entradas') : pad === 'bounties' ? t('Bounties ganhos ({currency})', { currency: s.currency }) : t('Stack inicial')}
        bb={s.bb}
        onClose={() => setPad(null)}
        onDone={(v) => {
          const k = pad!;
          setPad(null);
          setTour({ [k]: v });
        }}
      />
      <PasteSheet
        visible={sheet === 'structure'}
        title={t('Estrutura de blinds')}
        hint={t('Um nível por linha: blinds, ante e minutos. Ex.: 100/200/200 40. Os intervalos numa linha própria: Break 15')}
        placeholder={'100/200/200 40\n200/300/300 40\nBreak 15\n200/400/400 40'}
        initial={st && !tour.structureName ? structureText(st) : ''}
        parse={(x) => parseStructure(x, s.levelMinutes || 30).length}
        photo={Platform.OS === 'web' ? undefined : () => photoStructure('camera')}
        onClose={() => setSheet(null)}
        onSave={(x) => {
          setSheet(null);
          applyStructure(parseStructure(x, s.levelMinutes || 30));
        }}
      />
      <PasteSheet
        visible={sheet === 'payouts'}
        title={t('Tabela de prémios')}
        hint={t('Um lugar por linha. Ex.: 1 250.000 ou 10-12 15.000')}
        placeholder={'1 250000\n2 150000\n3 90000\n4-5 50000'}
        initial={(tour.payouts ?? []).map((p, i) => `${i + 1} ${p}`).join('\n')}
        parse={(x) => parsePayouts(x).length}
        onClose={() => setSheet(null)}
        onSave={(x) => {
          setSheet(null);
          tap('success');
          setTour({ payouts: parsePayouts(x) });
        }}
      />
    </>
  );
}

/** A number you tap to type on the keypad; empty ones say so in the accent colour. */
function Cell({ label, value, onPress, big }: { label: string; value?: string; onPress: () => void; big?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={{ flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' }}>
      <T v="label">{label}</T>
      <Row gap={6}>
        {value ? (
          <T v={big ? 'monoL' : 'mono'} style={big ? null : { fontSize: 18 }}>
            {value}
          </T>
        ) : (
          <T v="h3" color={C.accent}>
            {t('Indicar')}
          </T>
        )}
        <Ionicons name="pencil" size={12} color={C.accent} />
      </Row>
    </Pressable>
  );
}

function LevelCard({ s, st, onLevel, onSync, onPause }: { s: Session; st?: Level[]; onLevel: (dir: 1 | -1) => void; onSync: (m: number) => void; onPause: () => void }) {
  const now = useNow(1000);
  const level = s.level ?? 1;
  const nextAt = nextLevelAt(s, now);
  const left = nextAt ? nextAt - now : 0;
  const after = levelAfter(s, 1);
  const due = !!nextAt && left <= 0;
  const leftMin = Math.ceil(left / 60_000);
  const lm = st ? levelOf(st, level).minutes : s.levelMinutes;
  const choices = lm ? syncChoices(lm) : [];
  const near = choices.reduce((a, m) => (Math.abs(m - leftMin) < Math.abs(a - leftMin) ? m : a), choices[0]);
  const paused = isPaused(s);
  const brk = breakOf(s, now);
  // The break follows this level: from its last minutes on, offer the pause right here.
  const breakNext = !!brk && brk.afterLevel === level;
  return (
    <Card tone="raised" style={{ gap: S.md }}>
      <Row>
        <IconButton name="remove" label={t('Nível anterior')} onPress={() => onLevel(-1)} color={level <= 1 ? C.muted : undefined} />
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <T v="label">{t('Nível {n}', { n: level })}</T>
          <T v="monoL" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize: 26, lineHeight: 32 }}>
            {blindsOf(s)}
          </T>
        </View>
        <IconButton name="add" label={t('Subir nível')} onPress={() => onLevel(1)} />
      </Row>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <T v="monoXL" style={{ fontSize: 52, lineHeight: 58 }} color={due ? C.accent : nextAt && left < 120_000 ? C.warn : C.text}>
          {nextAt ? (due ? '0:00' : mmss(left)) : '—:—'}
        </T>
        <T v="small">{!lm ? t('Escolhe a estrutura em baixo para teres o relógio do nível') : due ? (breakNext ? t('Nível acabou · intervalo de {n} min', { n: brk!.minutes }) : t('Nível acabou · sobe para {blinds}', { blinds: blindsOf(after) })) : t('Depois: {blinds}', { blinds: blindsOf(after) })}</T>
      </View>
      {paused || (breakNext && (due || left < 5 * 60_000)) ? (
        <Card tone="accent" style={{ gap: S.sm }}>
          <Row>
            <Ionicons name="cafe-outline" size={16} color={C.warn} />
            <T v="h3" style={{ flex: 1 }}>
              {paused ? t('Em pausa: o relógio do nível parou') : t('Intervalo de {n} min a seguir', { n: brk!.minutes })}
            </T>
          </Row>
          <T v="small">{paused ? t('Retoma quando o torneio recomeçar.') : t('Põe a sessão em pausa no intervalo para o relógio do nível acertar com o do torneio.')}</T>
          <Button size="sm" kind={paused ? 'primary' : 'secondary'} icon={paused ? 'play' : 'pause'} title={paused ? t('Retomar') : t('Pausar no intervalo')} onPress={onPause} />
        </Card>
      ) : brk ? (
        <Row style={{ justifyContent: 'center' }}>
          <Ionicons name="cafe-outline" size={13} color={C.textDim} />
          <T v="tiny" color={C.textDim}>
            {t('Intervalo às {time} · depois do nível {n} · {m} min', { time: timeOf(brk.at), n: brk.afterLevel, m: brk.minutes })}
          </T>
        </Row>
      ) : null}
      {choices.length ? (
        <View style={{ gap: S.sm }}>
          <Row>
            <Ionicons name="sync" size={13} color={C.textDim} />
            <T v="tiny" color={C.textDim} style={{ flex: 1 }}>
              {t('Minutos que o relógio do torneio mostra')}
            </T>
          </Row>
          <ChipRow>
            {[...choices].reverse().map((m) => (
              <Chip key={m} label={m + '′'} active={!!nextAt && !due && m === near} onPress={() => onSync(m)} style={{ minWidth: 48 }} />
            ))}
          </ChipRow>
        </View>
      ) : null}
    </Card>
  );
}

function PayCard({ pay, payouts, left, currency }: { pay: ReturnType<typeof payState>; payouts: number[]; left?: number; currency: string }) {
  const [all, setAll] = useState(false);
  // The podium and the places around you; the full list on request.
  const near = new Set([1, 2, 3, ...(left ? [left - 2, left - 1, left, left + 1] : [4, 5])].filter((x) => x >= 1 && x <= payouts.length));
  const shown = payouts.map((p, i) => ({ p, place: i + 1 })).filter((x) => all || near.has(x.place));
  return (
    <Card padded={false}>
      <View style={{ padding: S.lg, gap: 6 }}>
        {!pay ? (
          <T v="small">{t('Indica quantos jogadores restam para veres o próximo salto.')}</T>
        ) : pay.toMoney > 0 ? (
          <>
            <Badge label={pay.toMoney <= Math.max(3, Math.round(pay.paid * 0.05)) ? t('Bolha') : t('Fora do dinheiro')} color={C.warn} />
            <T v="h2" accessibilityRole="text">{pay.toMoney === 1 ? t('Falta 1 jogador para o dinheiro') : t('Faltam {n} jogadores para o dinheiro', { n: pay.toMoney })}</T>
            <T v="small">{t('Pagam {n} lugares · mínimo {amount}', { n: pay.paid, amount: money(payouts[pay.paid - 1], currency) })}</T>
          </>
        ) : (
          <>
            <Badge label={t('No dinheiro')} color={C.good} />
            <T v="h2" accessibilityRole="text">{t('Garantido agora: {amount}', { amount: money(pay.now, currency) })}</T>
            {pay.next !== null ? <T v="small">{pay.toNext === 1 ? t('Próximo salto: {amount}, falta 1 jogador', { amount: money(pay.next, currency) }) : t('Próximo salto: {amount}, faltam {n} jogadores', { amount: money(pay.next, currency), n: pay.toNext! })}</T> : <T v="small">{t('Ganhaste o torneio')}</T>}
          </>
        )}
      </View>
      {shown.map(({ p, place }, i) => {
        const here = !!left && left === place;
        const gap = i > 0 && place - shown[i - 1].place > 1;
        return (
          <View key={place}>
            <Divider inset={S.lg} />
            {gap ? (
              <T v="monoS" color={C.muted} style={{ paddingHorizontal: S.lg, paddingVertical: 2 }}>
                ···
              </T>
            ) : null}
            <Row style={{ paddingHorizontal: S.lg, paddingVertical: 10, backgroundColor: here ? C.accentSoft : undefined }}>
              <T v="monoS" color={here ? C.accent : C.muted} style={{ width: 44 }}>
                {ordinal(place)}
              </T>
              <T v="mono" color={here ? C.accent : C.text} style={{ flex: 1, textAlign: 'right' }}>
                {money(p, currency)}
              </T>
            </Row>
          </View>
        );
      })}
      {payouts.length > shown.length || all ? (
        <>
          <Divider />
          <Button kind="plain" size="sm" title={all ? t('Mostrar menos') : t('Ver os {n} lugares pagos', { n: payouts.length })} onPress={() => setAll(!all)} />
        </>
      ) : null}
    </Card>
  );
}

function PasteSheet({ visible, title, hint, placeholder, initial, parse, onClose, onSave, photo }: { visible: boolean; title: string; hint: string; placeholder: string; initial: string; parse: (text: string) => number; onClose: () => void; onSave: (text: string) => void; photo?: () => Promise<string | null> }) {
  const [text, setText] = useState(initial);
  const [shownFor, setShownFor] = useState(visible);
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) setText(initial);
  }
  const n = useMemo(() => parse(text), [parse, text]);
  const animation = useSheetAnimation();
  const [reading, setReading] = useState(false);
  const [unread, setUnread] = useState(false);
  const snap = async () => {
    if (!photo) return;
    setReading(true);
    setUnread(false);
    try {
      // null: cancelled. '': a photo with no levels in it.
      const got = await photo();
      if (got) setText(got);
      else if (got === '') setUnread(true);
    } finally {
      setReading(false);
    }
  };
  const sheetPad = useSheetPad(S.xxl);
  return (
    <Modal visible={visible} transparent animationType={animation} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: sheetPad, gap: S.md }}>
          <SheetHeader title={title} onClose={onClose} />
          <T v="small">{hint}</T>
          {photo ? (
            canReadStructure ? (
              <Button kind="secondary" size="sm" icon="camera-outline" title={reading ? t('A ler a folha…') : t('Fotografar a folha da estrutura')} disabled={reading} onPress={snap} style={{ alignSelf: 'flex-start' }} />
            ) : (
              <T v="tiny">{t('Fotografar a folha da estrutura: disponível na versão da loja')}</T>
            )
          ) : null}
          {unread ? <T v="tiny" color={C.warn}>{t('Não conseguimos ler os níveis nesta foto. Tenta com mais luz e a folha direita, ou cola o texto.')}</T> : null}
          <Field value={text} onChangeText={setText} placeholder={placeholder} multiline autoFocus autoCorrect={false} inputStyle={{ minHeight: 160, maxHeight: 280, textAlignVertical: 'top', paddingTop: 12 }} />
          <Button title={n ? t('Usar {n} linhas', { n }) : t('Nada reconhecido ainda')} icon="checkmark" disabled={!n} onPress={() => onSave(text)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Android only, when exact alarms are refused: the level reminders may come a few minutes late, so offer the setting. */
function ExactAlarms() {
  const { settings } = useStore();
  const [allowed, setAllowed] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void exactAlarmsAllowed().then((ok) => live && setAllowed(ok));
      return () => {
        live = false;
      };
    }, []),
  );
  // No point asking when "Níveis e intervalos" is off in Settings.
  if (allowed || Platform.OS !== 'android' || !kindOn(settings, 'levels')) return null;
  return (
    <Card tone="inset" style={{ gap: S.sm }}>
      <Row>
        <Ionicons name="alarm-outline" size={16} color={C.warn} />
        <T v="h3" style={{ flex: 1 }}>
          {t('Os avisos de nível podem chegar atrasados')}
        </T>
      </Row>
      <T v="small">{t('Com o telemóvel parado, o Android pode atrasar os avisos alguns minutos. Com alarmes exatos chegam à hora; o relógio aqui está sempre certo.')}</T>
      <Button size="sm" kind="secondary" icon="alarm-outline" title={t('Permitir alarmes exatos')} onPress={() => void askExactAlarms().then(setAllowed)} />
    </Card>
  );
}
