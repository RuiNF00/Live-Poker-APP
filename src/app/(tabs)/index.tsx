import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboarding, usePro, useWelcomeOffer } from '@/billing/pro';
import { CardRow, PlayingCard } from '@/components/PlayingCard';
import { Amount, Badge, Banner, Button, Chip, ChipRow, confirmAction, Empty, Field, IconButton, Pill, Row, ScreenHeader, SearchField, SheetHeader, T, tap, Wordmark } from '@/components/ui';
import { locale, t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { isComplete, positions, replay } from '@/poker/engine';
import { amount, blindsLabel, money, timeOf } from '@/poker/format';
import { fileInFolder, needsReview } from '@/poker/review';
import { DEFAULT_TAGS, type Hand } from '@/poker/types';
import { StreakStat } from '@/components/StreakStat';
import { filterPills, HandFilterSheet } from '@/components/HandFilters';
import { activeFilters, matches, NO_FILTER, sortByResult, type HandFilter } from '@/store/hand-filters';
import { unreadByHand } from '@/lib/coach-core';
import { useCoach } from '@/lib/coach-api';
import { saveSolverFile, solverReady } from '@/lib/solver-export';
import { StartChecklist, useStartChecklist } from '@/components/StartChecklist';
import { mainCurrency, profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, R, S, SHADOW, ff } from '@/theme';

const DAY = 86400000;
const FOLDER = 'folder:';

function dayKey(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// toLocaleDateString is slow on Hermes; a long history has hundreds of days.
const dayTitles = new Map<number, string>();
function dayTitle(day: number) {
  const today = dayKey(Date.now());
  if (day === today) return t('Hoje');
  // Half a day back is always inside yesterday, even when it was 23 or 25 hours long.
  if (day === dayKey(today - DAY / 2)) return t('Ontem');
  let s = dayTitles.get(day);
  if (s === undefined) {
    const sameYear = new Date(day).getFullYear() === new Date().getFullYear();
    s = new Date(day).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', ...(sameYear ? null : { year: 'numeric' }) });
    dayTitles.set(day, s);
  }
  return s;
}

// Defined once: an inline component here is a new type on every render, so
// React unmounted and remounted every separator each time the list rendered.
const Separator = () => <View style={{ height: S.sm }} />;

export default function HandsScreen() {
  const { hands, sessions, activeSession, settings, draft, setDraft, saveHand, deleteHand } = useStore();
  const { handsLeft, trialDays, paywall, isPro } = usePro();
  useWelcomeOffer(hands.length);
  useOnboarding();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [filter, setFilter] = useState<HandFilter>(NO_FILTER);
  const [filtering, setFiltering] = useState(false);
  const coach = useCoach();
  const unread = useMemo(() => unreadByHand(coach), [coach]);
  const sentToCoach = useMemo(() => new Set(coach.links.flatMap((l) => l.handIds)), [coach]);
  const [searching, setSearching] = useState(false);

  const sections = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const rows = [...hands]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((h) => (!tag || (tag === INCOMPLETE ? !rowSummary(h).done : tag === TO_REVIEW ? needsReview(h, sentToCoach) : tag.startsWith(FOLDER) ? !!h.folders?.includes(tag.slice(FOLDER.length)) : h.tags.includes(tag))) && (!qq || searchText(h).includes(qq)) && matches(h, filter));
    // Sorted by result: one list, biggest first, instead of days.
    if (filter.sort !== 'recent') {
      const data = sortByResult(rows, filter.sort, (h) => rowSummary(h).net);
      return data.length ? [{ title: filter.sort === 'won' ? t('Mais bb ganhas') : t('Mais bb perdidas'), data }] : [];
    }
    const out: { title: string; data: Hand[] }[] = [];
    let cur = -1;
    for (const h of rows) {
      const k = dayKey(h.createdAt);
      if (k !== cur) {
        out.push({ title: dayTitle(k), data: [] });
        cur = k;
      }
      out[out.length - 1].data.push(h);
    }
    return out;
  }, [hands, q, tag, sentToCoach, filter]);

  const pills = useMemo(() => filterPills(filter), [filter]);
  // While the list is narrowed, nudges about the rest of it get out of the way.
  const narrowed = !!tag || pills.length > 0;
  const shown = useMemo(() => sections.reduce((n, sec) => n + sec.data.length, 0), [sections]);
  const incomplete = useMemo(() => hands.filter((h) => !rowSummary(h).done).length, [hands]);
  const checklist = useStartChecklist();
  const [now] = useState(() => Date.now());
  const lastEnd = useMemo(() => Math.max(0, ...sessions.map((x) => x.endedAt ?? 0)), [sessions]);
  const idleDays = lastEnd ? Math.floor((now - lastEnd) / DAY) : 0;

  // Long-press a hand to start picking several; tap then adds or removes.
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const picking = picked.size > 0;
  const togglePick = useCallback((id: string) => {
    tap('select');
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [tagging, setTagging] = useState(false);

  const renderItem = useCallback(
    ({ item }: { item: Hand }) => <HandRow hand={item} inBB={settings.inBB} picking={picking} picked={picked.has(item.id)} onPick={togglePick} coach={unread[item.id] ?? 0} />,
    [settings.inBB, picking, picked, togglePick, unread],
  );

  const usedTags = useMemo(() => DEFAULT_TAGS.filter((tg) => hands.some((h) => h.tags.includes(tg))), [hands]);
  const folders = useMemo(() => [...new Set(hands.flatMap((h) => h.folders ?? []))].sort((a, b) => a.localeCompare(b)), [hands]);
  const toReview = useMemo(() => hands.filter((h) => needsReview(h, sentToCoach)).length, [hands, sentToCoach]);
  const [filing, setFiling] = useState(false);
  // Discarding a draft is one tap, so keep it for a few seconds behind an undo.
  const [discarded, setDiscarded] = useState<Hand | null>(null);
  useEffect(() => {
    if (!discarded) return;
    const id = setTimeout(() => setDiscarded(null), 6000);
    return () => clearTimeout(id);
  }, [discarded]);
  const hasDraft = !!draft && (draft.actions.length > 0 || !!draft.players[draft.hero].cards?.length);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(h) => h.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: picking ? 110 : 40 }}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <SafeTop>
            <View style={{ gap: S.md, marginBottom: S.sm }}>
              <ScreenHeader
                title={<Wordmark size={30} />}
                right={
                  <>
                    {hands.length > 0 ? <IconButton name={searching ? 'close' : 'search'} label={t('Procurar')} onPress={() => (searching ? (setSearching(false), setQ('')) : setSearching(true))} /> : null}
                    {hands.length > 1 ? <IconButton name={activeFilters(filter) || filter.sort !== 'recent' ? 'options' : 'options-outline'} label={t('Filtrar mãos')} onPress={() => setFiltering(true)} /> : null}
                    <IconButton name="calculator-outline" label={t('Calculadora de odds')} onPress={() => router.push('/odds')} />
                    <IconButton name="settings-outline" label={t('Definições')} onPress={() => router.push('/settings')} />
                  </>
                }
              />
              {/* One summary row, then at most one context card, so a returning player still sees four hands. */}
              {!searching ? (
                <HomeSummary
                  sessions={sessions}
                  streak={hands.length > 0}
                  handsLeft={hands.length > 0 ? handsLeft : null}
                  cta={handsLeft === 0 && trialDays ? t('{days} dias grátis', { days: trialDays }) : t('Ver Pro')}
                  onPro={() => paywall(handsLeft === 0 ? 'hands' : 'generic')}
                />
              ) : null}
              {searching ? null : hasDraft ? (
                <Banner
                  tone="warn"
                  icon="create-outline"
                  title={t('Mão a meio')}
                  body={t('Toca para continuar onde ficaste')}
                  onPress={() => router.push('/hand/new')}
                  onDismiss={() => {
                    setDiscarded(draft);
                    setDraft(null);
                  }}
                  dismissLabel={t('Descartar')}
                />
              ) : discarded ? (
                <Banner
                  tone="info"
                  icon="trash-outline"
                  title={t('Mão descartada')}
                  action={t('Anular')}
                  onPress={() => {
                    setDraft(discarded);
                    setDiscarded(null);
                  }}
                />
              ) : narrowed ? null : checklist ? (
                <StartChecklist state={checklist} />
              ) : incomplete > 0 && tag !== INCOMPLETE ? (
                <Banner
                  tone="warn"
                  icon="alert-circle-outline"
                  title={incomplete === 1 ? t('1 mão por completar') : t('{n} mãos por completar', { n: incomplete })}
                  action={t('Ver')}
                  onPress={() => setTag(INCOMPLETE)}
                />
              ) : !activeSession && idleDays >= 7 ? (
                <Banner icon="timer-outline" title={t('Sem sessões há {n} dias', { n: idleDays })} action={t('Começar')} onPress={() => router.navigate('/session')} />
              ) : null}
              {searching ? <SearchField value={q} onChange={setQ} placeholder={t('Torneio, jogador, AKs…')} /> : null}
              {usedTags.length > 0 || folders.length > 0 || toReview > 0 ? (
                <ChipRow>
                  <Chip label={t('Todas')} active={!tag} onPress={() => setTag(null)} />
                  {toReview > 0 || tag === TO_REVIEW ? (
                    <Chip icon="school-outline" label={t('Por rever ({n})', { n: toReview })} active={tag === TO_REVIEW} onPress={() => setTag(tag === TO_REVIEW ? null : TO_REVIEW)} />
                  ) : null}
                  {folders.map((f) => (
                    <Chip key={FOLDER + f} icon="folder-outline" label={f} active={tag === FOLDER + f} onPress={() => setTag(tag === FOLDER + f ? null : FOLDER + f)} />
                  ))}
                  {usedTags.map((tg) => (
                    <Chip key={tg} label={t(tg)} active={tag === tg} onPress={() => setTag(tag === tg ? null : tg)} />
                  ))}
                </ChipRow>
              ) : null}
              {tag || q.trim() ? (
                <Row gap={S.sm}>
                  <T v="small" style={{ flex: 1 }}>
                    {shown === 1 ? t('1 mão') : t('{n} mãos', { n: shown })}
                  </T>
                  {tag ? <FilterPill label={tag === INCOMPLETE ? t('Por completar') : tag === TO_REVIEW ? t('Por rever') : tag.startsWith(FOLDER) ? tag.slice(FOLDER.length) : t(tag)} onClear={() => setTag(null)} /> : null}
                  {tag?.startsWith(FOLDER) && shown > 0 ? (
                    <Button
                      kind="secondary"
                      size="sm"
                      icon="school-outline"
                      title={t('Enviar ao coach')}
                      onPress={() => router.push({ pathname: '/coach/new', params: { folder: tag.slice(FOLDER.length) } })}
                    />
                  ) : null}
                </Row>
              ) : null}
              {pills.length ? (
                <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
                  {tag || q.trim() ? null : <T v="small">{shown === 1 ? t('1 mão') : t('{n} mãos', { n: shown })}</T>}
                  {pills.map((x) => (
                    <FilterPill key={x.key} label={x.label} onClear={() => setFilter((f) => ({ ...f, ...x.clear }))} />
                  ))}
                </Row>
              ) : null}
            </View>
          </SafeTop>
        }
        renderSectionHeader={({ section }) => (
          <Row style={{ paddingTop: S.lg, paddingBottom: S.sm, paddingHorizontal: 4 }}>
            <T v="label" style={{ flex: 1 }}>
              {section.title}
            </T>
            <T v="tiny">{section.data.length === 1 ? t('1 mão') : t('{n} mãos', { n: section.data.length })}</T>
          </Row>
        )}
        ListEmptyComponent={
          hands.length === 0 ? (
            <FirstRun />
          ) : (
            <Empty
              icon="search"
              title={t('Nada encontrado')}
              body={t('Tenta outro nome, torneio ou mão.')}
              action={<Button title={t('Ver todas as mãos')} kind="secondary" size="md" onPress={() => (setTag(null), setQ(''), setSearching(false), setFilter(NO_FILTER))} />}
            />
          )
        }
        renderItem={renderItem}
        // Long histories: render a screenful first, keep a small window
        // mounted and build the rest in idle batches.
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        extraData={picked}
      />
      {picking ? (
        <View style={{ position: 'absolute', left: S.gutter, right: S.gutter, bottom: S.md, flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.sm, paddingLeft: S.lg, borderRadius: R.lg, backgroundColor: C.surface3, borderWidth: 1, borderColor: C.borderStrong, ...SHADOW }}>
          <T v="h3" numberOfLines={1} style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {picked.size === 1 ? t('1 selecionada') : t('{n} selecionadas', { n: picked.size })}
          </T>
          <IconButton
            name="school-outline"
            label={t('Enviar ao coach')}
            onPress={() => {
              router.push({ pathname: '/coach/new', params: { ids: [...picked].join(',') } });
              setPicked(new Set());
            }}
          />
          <IconButton name="analytics-outline" label={t('Exportar para solver')} onPress={() => (isPro ? exportSolver(hands.filter((h) => picked.has(h.id))) : paywall('solver'))} />
          <IconButton name="folder-outline" label={t('Guardar em pasta')} onPress={() => setFiling(true)} />
          <IconButton name="pricetag-outline" label={t('Pôr tag')} onPress={() => setTagging(true)} />
          <IconButton
            name="trash-outline"
            label={t('Apagar')}
            color={C.danger}
            onPress={() =>
              confirmAction(picked.size === 1 ? t('Apagar mão?') : t('Apagar {n} mãos?', { n: picked.size }), t('Não dá para desfazer.'), t('Apagar'), () => {
                picked.forEach((id) => deleteHand(id));
                setPicked(new Set());
              })
            }
          />
          <IconButton name="close" label={t('Cancelar')} onPress={() => setPicked(new Set())} />
        </View>
      ) : null}
      <HandFilterSheet visible={filtering} onClose={() => setFiltering(false)} value={filter} onChange={setFilter} hands={hands} />
      <FolderSheet visible={filing} onClose={() => setFiling(false)} folders={folders} list={hands.filter((h) => picked.has(h.id))} save={saveHand} />
      <Modal visible={tagging} transparent animationType="fade" onRequestClose={() => setTagging(false)}>
        <Pressable accessibilityLabel={t('Fechar')} onPress={() => setTagging(false)} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: S.xxl, gap: S.md }}>
            <SheetHeader title={picked.size === 1 ? t('Tag para 1 mão') : t('Tag para {n} mãos', { n: picked.size })} onClose={() => setTagging(false)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {DEFAULT_TAGS.map((tg) => {
                const list = hands.filter((h) => picked.has(h.id));
                const all = list.length > 0 && list.every((h) => h.tags.includes(tg));
                return (
                  <Chip
                    key={tg}
                    big
                    label={t(tg)}
                    active={all}
                    onPress={() => list.forEach((h) => saveHand({ ...h, tags: all ? h.tags.filter((x) => x !== tg) : h.tags.includes(tg) ? h.tags : [...h.tags, tg] }))}
                  />
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SafeTop({ children }: { children: React.ReactNode }) {
  // SectionList has no safe-area prop; pad the header instead.
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top + S.sm }}>{children}</View>;
}

/** Free plan: how many of today's hands are left, as a small meter. */
/**
 * The home verdict as one row of numbers: this month, the weekly streak and
 * the free hands left today. Each cell opens where the number comes from.
 */
function HomeSummary({ sessions, streak, handsLeft, cta, onPro }: { sessions: Session[]; streak: boolean; handsLeft: number | null; cta: string; onPro: () => void }) {
  const [now] = useState(() => Date.now());
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const done = sessions.filter((x) => x.endedAt);
  const cur = mainCurrency(done, '€');
  const month = done.filter((x) => (x.endedAt ?? 0) >= start.getTime() && x.currency === cur);
  const net = month.reduce((a, x) => a + profit(x), 0);
  const cells: React.ReactNode[] = [];
  if (done.length) {
    cells.push(
      <Pressable
        key="month"
        accessibilityRole="button"
        accessibilityLabel={month.length ? `${t('Este mês')}: ${money(net, cur)}, ${month.length === 1 ? t('em 1 sessão') : t('em {n} sessões', { n: month.length })}` : t('Ainda sem sessões este mês')}
        onPress={() => router.navigate('/bankroll')}
        hitSlop={6}
        style={({ pressed }) => [sumSt.cell, { opacity: pressed ? 0.7 : 1 }]}>
        <T v="label" numberOfLines={1}>
          {t('Este mês')}
        </T>
        {month.length ? <Amount value={net} text={money(net, cur)} v="mono" /> : <T v="mono" color={C.muted}>—</T>}
      </Pressable>,
    );
  }
  if (streak)
    cells.push(
      <View key="streak" style={sumSt.cell}>
        <StreakStat />
      </View>,
    );
  if (handsLeft !== null) {
    const total = 3;
    cells.push(
      <Pressable
        key="free"
        accessibilityRole="button"
        accessibilityLabel={`${handsLeft === 0 ? t('Mãos grátis de hoje esgotadas') : handsLeft === 1 ? t('Falta 1 mão grátis hoje') : t('Faltam {n} mãos grátis hoje', { n: handsLeft })}. ${cta}`}
        onPress={onPro}
        hitSlop={6}
        style={({ pressed }) => [sumSt.cell, { opacity: pressed ? 0.7 : 1 }]}>
        <T v="label" numberOfLines={1} color={handsLeft === 0 ? C.accent : undefined}>
          {t('Grátis hoje')}
        </T>
        {handsLeft === 0 ? (
          <T v="small" numberOfLines={1} color={C.accent} style={{ fontFamily: ff(800), lineHeight: 20 }}>
            {cta}
          </T>
        ) : (
          <Row gap={6}>
            <Row gap={3}>
              {Array.from({ length: total }, (_, i) => (
                <View key={i} style={[sumSt.dot, { backgroundColor: i < total - handsLeft ? C.accent : C.surface3 }]} />
              ))}
            </Row>
            <T v="mono">{handsLeft}</T>
          </Row>
        )}
      </Pressable>,
    );
  }
  if (!cells.length) return null;
  return (
    <View style={[sumSt.wrap, handsLeft === 0 && { borderColor: C.accentLine }]}>
      {cells.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={sumSt.divider} /> : null}
          {c}
        </React.Fragment>
      ))}
    </View>
  );
}

const sumSt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  cell: { flex: 1, gap: 2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: C.border },
  dot: { width: 10, height: 5, borderRadius: 3 },
});

/** Empty state for a brand-new install: what the app does, in three steps. */
function FirstRun() {
  const steps: [React.ComponentProps<typeof Ionicons>['name'], string, string][] = [
    ['flash-outline', t('Regista em segundos'), t('Posição, cartas e ação com poucos toques, entre mãos.')],
    ['play-circle-outline', t('Revê no replayer'), t('Cada mão fica numa mesa que podes ver rua a rua.')],
    ['paper-plane-outline', t('Partilha e discute'), t('Um link para os amigos votarem no que fariam.')],
  ];
  return (
    <View style={{ gap: S.xl, paddingTop: S.lg }}>
      <View style={{ alignItems: 'center', gap: S.md }}>
        <Row gap={0} style={{ marginBottom: 6 }}>
          <View style={{ transform: [{ rotate: '-8deg' }], ...SHADOW }}>
            <PlayingCard card="Ah" size="lg" />
          </View>
          <View style={{ marginLeft: -12, transform: [{ rotate: '7deg' }, { translateY: 4 }], ...SHADOW }}>
            <PlayingCard card="Ks" size="lg" />
          </View>
        </Row>
        <T v="h1" style={{ textAlign: 'center' }}>
          {t('O teu caderno de póquer live')}
        </T>
        <T v="callout" style={{ textAlign: 'center', maxWidth: 300 }}>
          {t('Guarda as mãos que importam enquanto ainda te lembras de tudo.')}
        </T>
      </View>
      <View style={{ gap: S.md }}>
        {steps.map(([ic, title, body]) => (
          <Row key={title} gap={14} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={ic} size={19} color={C.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="h3">{title}</T>
              <T v="small">{body}</T>
            </View>
          </Row>
        ))}
      </View>
      <View style={{ gap: S.sm }}>
        <Button title={t('Registar a primeira mão')} icon="add" onPress={() => router.push('/hand/new')} />
        <Button title={t('Ver uma mão de exemplo')} kind="ghost" size="md" onPress={() => router.push({ pathname: '/hand/[id]', params: { id: 'sample' } })} />
      </View>
    </View>
  );
}

// Search text per hand, built once per hand version rather than on every keystroke.
const searchCache = new WeakMap<Hand, string>();
function searchText(h: Hand): string {
  let s = searchCache.get(h);
  if (s === undefined) {
    s = [h.game.name, h.notes, h.title, comboLabel(h.players[h.hero].cards), ...h.players.map((p) => p.name)].join(' ').toLowerCase();
    searchCache.set(h, s);
  }
  return s;
}

// Replaying a hand is the costly part of a row. Keep the result per hand
// version, so rows scrolling back into view don't replay again.
const rowCache = new WeakMap<Hand, { net: number | undefined; done: boolean }>();
function rowSummary(hand: Hand) {
  let v = rowCache.get(hand);
  if (!v) {
    const r = replay(hand);
    v = { net: r.result?.resolved ? r.result.net[hand.hero] : undefined, done: isComplete(hand, r) };
    rowCache.set(hand, v);
  }
  return v;
}

const HandRow = React.memo(function HandRow({ hand, inBB, picking, picked, onPick, coach }: { hand: Hand; inBB: boolean; picking: boolean; picked: boolean; onPick: (id: string) => void; coach: number }) {
  const { net, done } = rowSummary(hand);
  const heroPos = positions(hand.players.length, hand.button)[hand.hero];
  // Next to a full board only two tags fit on the line at 390 pt.
  const maxTags = hand.board.length > 3 || !done ? 2 : 3;
  const hero = hand.players[hand.hero];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={picking ? { selected: picked } : undefined}
      onPress={() => (picking ? onPick(hand.id) : router.push({ pathname: '/hand/[id]', params: { id: hand.id } }))}
      onLongPress={() => onPick(hand.id)}
      delayLongPress={350}
      style={({ pressed }) => (picked ? rowSt.picked : pressed ? rowSt.pressed : rowSt.row)}>
      <Row gap={12}>
        {picking ? <Ionicons name={picked ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={picked ? C.accent : C.muted} /> : null}
        {hero.cards?.length === 2 ? <CardRow cards={hero.cards} size="sm" gap={2} /> : <View style={rowSt.noCards} />}
        <View style={rowSt.main}>
          <Row gap={6}>
            <T v="h3" numberOfLines={1} style={rowSt.combo}>
              {comboLabel(hero.cards) || t('Sem cartas')}
            </T>
            <Badge label={heroPos} />
          </Row>
          <T v="small" numberOfLines={1}>
            {(hand.game.name || (hand.game.kind === 'mtt' ? t('Torneio') : 'Cash')) + ' · ' + blindsLabel(hand)}
          </T>
        </View>
        <View style={rowSt.side}>
          {net !== undefined ? (
            <T v="mono" color={net > 0 ? C.good : net < 0 ? C.bad : C.textDim}>
              {(net > 0 ? '+' : '') + amount(net, hand, inBB)}
            </T>
          ) : (
            <T v="mono" color={C.muted}>
              —
            </T>
          )}
          <T v="monoS">{timeOf(hand.createdAt)}</T>
        </View>
      </Row>
      {hand.board.length || hand.tags.length || !done || hand.shareId || coach ? (
        <Row gap={6} style={rowSt.wrap}>
          {hand.board.length ? (
            <Row gap={2} style={rowSt.board}>
              {hand.board.map((c, i) => (
                <PlayingCard key={c + i} card={c} size="xs" />
              ))}
            </Row>
          ) : null}
          {coach ? <Pill icon="school" label={coach === 1 ? t('1 comentário do coach') : t('{n} comentários do coach', { n: coach })} color={C.accent} /> : null}
          {!done ? <Pill label={t('Por completar')} color={C.warn} /> : null}
          {hand.tags.slice(0, maxTags).map((x) => (
            <Pill key={x} label={t(x)} />
          ))}
          {hand.tags.length > maxTags ? <Pill label={`+${hand.tags.length - maxTags}`} /> : null}
          {hand.shareId ? <Pill icon="link" label={t('Partilhada')} color={C.info} /> : null}
        </Row>
      ) : null}
    </Pressable>
  );
});

const rowBase = { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 12, gap: 10, ...SHADOW };
const rowSt = StyleSheet.create({
  row: rowBase,
  pressed: { ...rowBase, backgroundColor: C.surface2 },
  picked: { ...rowBase, backgroundColor: C.accentSoft, borderColor: C.accentLine },
  noCards: { width: 62, height: 42, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong },
  main: { flex: 1, gap: 3 },
  side: { alignItems: 'flex-end', gap: 4 },
  combo: { fontSize: 16 },
  wrap: { flexWrap: 'wrap' },
  board: { marginRight: 4 },
});

const INCOMPLETE = '__incomplete';
const TO_REVIEW = '__review';

/** A filter that is on, with an x to take it off. */
/** "Guardar em pasta": private study folders, toggled on every picked hand. */
function FolderSheet({ visible, onClose, folders, list, save }: { visible: boolean; onClose: () => void; folders: string[]; list: Hand[]; save: (h: Hand) => void }) {
  const [name, setName] = useState('');
  const toggle = (f: string, on: boolean) => list.forEach((h) => save(fileInFolder(h, f, on)));
  const create = () => {
    const f = name.trim();
    if (!f) return;
    toggle(f, true);
    tap('success');
    setName('');
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel={t('Fechar')} onPress={onClose} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: S.xxl, gap: S.md }}>
            <SheetHeader title={list.length === 1 ? t('Guardar 1 mão em') : t('Guardar {n} mãos em', { n: list.length })} onClose={onClose} />
            {folders.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                {folders.map((f) => {
                  const all = list.length > 0 && list.every((h) => h.folders?.includes(f));
                  return <Chip key={f} big icon={all ? 'folder' : 'folder-outline'} label={f} active={all} onPress={() => toggle(f, !all)} />;
                })}
              </View>
            ) : (
              <T v="body" style={{ color: C.textDim }}>
                {t('Junta mãos para estudar depois, por exemplo "Rever com coach". As pastas são só tuas e nunca saem quando partilhas.')}
              </T>
            )}
            <Row gap={S.sm}>
              <Field value={name} onChangeText={setName} placeholder={t('Nova pasta')} maxLength={30} returnKeyType="done" onSubmitEditing={create} style={{ flex: 1 }} />
              <Button title={t('Criar')} size="md" kind="secondary" disabled={!name.trim()} onPress={create} />
            </Row>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Tirar filtro {name}', { name: label })}
      onPress={onClear}
      hitSlop={8}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 8, height: 30, borderRadius: R.pill, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, opacity: pressed ? 0.75 : 1 })}>
      <T v="small" color={C.accent} style={{ fontFamily: ff(700) }}>
        {label}
      </T>
      <Ionicons name="close" size={14} color={C.accent} />
    </Pressable>
  );
}


/** Picked hands as one PokerStars file; unfinished hands are left out, and the player is told. */
function exportSolver(list: Hand[]) {
  tap();
  const ready = solverReady(list);
  const skipped = list.length - ready.length;
  if (!ready.length) {
    note(t('Nenhuma mão completa'), t('Os solvers só leem mãos completas.'));
    return;
  }
  saveSolverFile(ready)
    .then(() => {
      if (skipped) note(skipped === 1 ? t('1 mão por completar ficou de fora') : t('{n} mãos por completar ficaram de fora', { n: skipped }));
    })
    .catch(() => note(t('Não deu'), t('Não conseguimos guardar o ficheiro. Tenta outra vez.')));
}

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}
