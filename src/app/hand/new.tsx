// Hand entry. The whole hand is entered on one screen that walks you through
// it: position + cards, then the action seat by seat, the board when a street
// closes, showdown, tags. Every step is one tap where possible:
//  - one tap per card (full-deck grid),
//  - one tap per action, with sizes as presets (2.5x, ⅓, pote…),
//  - preflop, folds up to hero are automatic (again after each opponent who
//    comes in); whoever else came in is one tap on "alguém entrou?",
//  - "salta para" chips fold/check everyone in between in one tap,
//  - "só X paga" / "todos fold" / "todos check" close a street in one tap,
//  - context (tournament, blinds, table) carries over from the session,
//  - no time at the table: "Voz" records a note and saves the hand as it is,
//    to be completed after the session.

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { AmountPad } from '@/components/AmountPad';
import { CardPicker } from '@/components/CardPicker';
import { ContextSheet } from '@/components/entry/ContextSheet';
import { SeatSheet } from '@/components/entry/SeatSheet';
import { RecordingBar, useVoiceCapture, VoiceNotePlayer } from '@/components/entry/VoiceNote';
import { CardRow } from '@/components/PlayingCard';
import { ASPECT, Table } from '@/components/Table';
import { Button, Chip, ChipRow, Field, IconButton, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { keepVoiceNote } from '@/lib/voice-note';
import { comboLabel } from '@/poker/cards';
import { board2Needed, buttonForHeroPosition, callName, legal, positionOrder, positions, raiseName, replay, totalPot, usedCards } from '@/poker/engine';
import { autoFold, callerCandidates, checkAround, onlyCaller, rewindTo, sizePresets, skipTargets, skipTo } from '@/poker/entry';
import { addSeat, newHand, nextLevel, removeSeat, rescaleStacks, resizeTable, sameTable, swapSeats } from '@/poker/factory';
import { amount, bbs, blindsLabel } from '@/poker/format';
import { DEFAULT_TAGS, STAGES, type Hand, type HandAction, type Player } from '@/poker/types';
import { displayName, seatViews } from '@/poker/view';
import { opponentStats } from '@/store/queries';
import { uid, useStore } from '@/store/store';
import { BRAND, C, R, S, SHADOW, ff, posColor } from '@/theme';

const STREET_PT = { preflop: t('Pré-flop'), flop: 'Flop', turn: 'Turn', river: 'River' };

interface Draft {
  hand: Hand;
  posChosen: boolean;
  /** Set when the last step was automatic folds: the first of those actions. */
  autoFrom?: number;
}

export default function NewHand() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ edit?: string }>();
  const store = useStore();
  const pro = usePro();
  const { activeSession, settings, hands } = store;

  // Only an existing hand is an edit (free of the daily limit); a link with a made-up id is a new hand.
  const [isEdit] = useState(() => !!params.edit && store.hands.some((h) => h.id === params.edit));
  const [draft, setDraftState] = useState<Draft>(() => {
    const editing = isEdit ? store.hands.find((h) => h.id === params.edit) : null;
    if (editing) return { hand: editing, posChosen: true };
    if (store.draft) return { hand: store.draft, posChosen: !!store.draft.actions.length || store.draft.button !== 0 || !!store.draft.players[0].cards };
    const last = hands[0] ?? null;
    // Same table as the last hand: seats, stacks and the moved button are already right.
    return { hand: newHand({ id: uid('h_'), session: activeSession, last, currency: settings.currency, tableSize: settings.defaultTableSize }), posChosen: sameTable(last, activeSession) };
  });
  const [history, setHistory] = useState<Draft[]>([]);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [seatEdit, setSeatEdit] = useState<number | null>(null);
  const [pad, setPad] = useState(false);
  const [inBB, setInBB] = useState(settings.inBB);
  // undefined: the picker opens by itself for the only opponent left; null: closed.
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [showdownFor, setShowdownFor] = useState<number | null | undefined>(undefined);

  const hand = draft.hand;
  const n = hand.players.length;
  const pos = positions(n, hand.button);
  const heroCards = hand.players[hand.hero].cards ?? [];
  const r = useMemo(() => replay(hand), [hand]);
  const s = r.final;

  useEffect(() => {
    if (!isEdit) store.setDraft(hand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand]);

  const update = (h: Hand, posChosen = draft.posChosen, autoFrom?: number) => {
    setHistory((x) => [...x.slice(-60), draft]);
    setDraftState({ hand: { ...h, updatedAt: Date.now() }, posChosen, autoFrom });
  };
  const undo = () => {
    tap();
    setHistory((x) => {
      if (!x.length) return x;
      setDraftState(x[x.length - 1]);
      return x.slice(0, -1);
    });
  };

  // ── phase ─────────────────────────────────────────
  type Phase = 'hero' | 'action' | 'board' | 'board2' | 'showdown' | 'done';
  let phase: Phase;
  if (!draft.posChosen || heroCards.length < 2) phase = 'hero';
  else if (s.needsBoard) phase = 'board';
  else if (r.needsBoard2) phase = 'board2';
  else if (s.toAct !== null) phase = 'action';
  else if (r.result && !s.foldWin) phase = 'showdown';
  else phase = 'done';

  // Most hands fold to hero: do that automatically, at the start and after each
  // opponent who comes in before hero. Once per state, so undo or a rewind
  // never folds the same seats again. A reopened draft or an edited hand keeps
  // what was entered: none of its states folds again, even after undo.
  // Keyed on the actions themselves: after undo, a different line of the same
  // length is a new state and still folds.
  const stateKey = (h: Hand, upTo = h.actions.length) => `${h.id}:${h.button}:` + h.actions.slice(0, upTo).map((a) => `${a.p}${a.kind[0]}${a.to ?? ''}`).join(',');
  const autoDone = useRef(new Set<string>(hand.actions.length ? Array.from({ length: hand.actions.length + 1 }, (_, k) => stateKey(hand, k)) : []));
  const autoKey = stateKey(hand);
  useEffect(() => {
    const key = autoKey;
    if (phase !== 'action' || autoDone.current.has(key)) return;
    const acts = autoFold(hand, s);
    if (!acts.length) return;
    autoDone.current.add(key);
    update({ ...hand, actions: [...hand.actions, ...acts] }, draft.posChosen, hand.actions.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoKey]);
  const autoSeats = draft.autoFrom !== undefined && phase === 'action' ? hand.actions.slice(draft.autoFrom).map((a) => a.p) : [];
  const rewind = (seat: number) => {
    if (draft.autoFrom === undefined) return;
    const actions = rewindTo(hand, draft.autoFrom, seat);
    if (!actions) return;
    tap();
    update({ ...hand, actions });
  };

  const setPlayer = (i: number, p: Player) => {
    const players = hand.players.map((x, k) => (k === i ? p : x));
    update({ ...hand, players });
  };
  const pickHeroCard = (c: string) => {
    let cards = [...heroCards];
    if (cards.includes(c)) cards = cards.filter((x) => x !== c);
    else if (cards.length < 2) cards.push(c);
    else cards = [cards[1], c];
    setPlayer(hand.hero, { ...hand.players[hand.hero], cards });
  };
  const setHeroPos = (label: string) => {
    const button = buttonForHeroPosition(n, hand.hero, label);
    autoDone.current.clear();
    update({ ...hand, button, actions: [] }, true);
  };
  const pushActions = (acts: HandAction[]) => update({ ...hand, actions: [...hand.actions, ...acts] });

  const act = (kind: HandAction['kind'], to?: number) => {
    if (s.toAct === null) return;
    tap();
    pushActions([{ p: s.toAct, kind, to }]);
  };

  const boardNeeded = s.street === 'flop' ? 3 : s.street === 'turn' ? 4 : 5;
  const pickBoard = (c: string) => {
    if (hand.board.includes(c)) {
      update({ ...hand, board: hand.board.filter((x) => x !== c) });
      return;
    }
    if (hand.board.length >= boardNeeded) return;
    update({ ...hand, board: [...hand.board, c] });
  };
  // Run it twice: offered while an all-in runs out, and at showdown if forgotten.
  const canTwice = r.runoutFrom !== null && r.runoutFrom < 5 && s.folded.filter((f) => !f).length > 1;
  const twiceChip = canTwice ? (
    <Chip
      label={t('Correr 2 vezes')}
      active={!!hand.board2}
      onPress={() => {
        tap();
        update({ ...hand, board2: hand.board2 ? undefined : [], winners2: undefined });
      }}
    />
  ) : null;
  const board2Count = board2Needed(r);
  const board2Left = board2Count - (hand.board2?.length ?? 0);
  const pickBoard2 = (c: string) => {
    const b2 = hand.board2 ?? [];
    if (b2.includes(c)) return update({ ...hand, board2: b2.filter((x) => x !== c) });
    if (b2.length >= board2Count) return;
    update({ ...hand, board2: [...b2, c] });
  };
  const run2Board = [...hand.board.slice(0, r.runoutFrom ?? 0), ...(hand.board2 ?? [])];

  const save = async (over?: Partial<Hand>) => {
    tap('medium');
    const hand = over ? { ...draft.hand, ...over } : draft.hand;
    // Free plan: past the daily limit the hand stays as a draft and the paywall opens.
    if (!isEdit && !pro.canSaveHand()) {
      if (over) update(hand);
      pro.paywall('hands');
      return;
    }
    // Named villains go into the player notes, so the next time they are one tap away.
    const players = hand.players.map((p, i) => {
      if (i === hand.hero || !p.name.trim() || p.playerId) return p;
      const existing = store.players.find((k) => k.name.trim().toLowerCase() === p.name.trim().toLowerCase());
      if (existing) return { ...p, playerId: existing.id };
      const note = { id: uid('p_'), name: p.name.trim(), look: '', tags: [], notes: '', createdAt: Date.now(), updatedAt: Date.now() };
      store.savePlayer(note);
      return { ...p, playerId: note.id };
    });
    const final = { ...hand, players, updatedAt: Date.now() };
    store.saveHand(final);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Keep the session's live table state in sync, so the next hand is pre-filled.
    const sess = store.sessions.find((x) => x.id === final.sessionId);
    if (sess && !isEdit) {
      const heroEnd = r.result ? s.stacks[hand.hero] + r.result.won[hand.hero] : s.stacks[hand.hero] + s.bets[hand.hero];
      store.saveSession({
        ...sess,
        sb: final.game.sb,
        bb: final.game.bb,
        ante: final.game.ante,
        anteType: final.game.anteType,
        level: final.game.level,
        stage: final.game.stage,
        name: final.game.name || sess.name,
        tableSize: n,
        stack: heroEnd,
        stackLog: [...sess.stackLog, { t: Date.now(), stack: heroEnd, level: final.game.level }],
        roster: final.players.map((p) => p.name),
      });
    }
    if (!settings.onboarded) store.setSettings({ onboarded: true });
    if (!isEdit) {
      store.setDraft(null);
      pro.record('hand');
    }
    router.replace({ pathname: '/hand/[id]', params: { id: final.id } });
  };

  const voice = useVoiceCapture(async (recording) => {
    const voiceNote = await keepVoiceNote(recording, hand.id).catch(() => recording);
    save({ voiceNote });
  });

  const discard = () => {
    store.setDraft(null);
    router.back();
  };

  const reads = useMemo(() => opponentStats(hands, store.players), [hands, store.players]);
  const recentNames = useMemo(() => [...new Set(hands.map((h) => h.game.name).filter(Boolean))].slice(0, 8), [hands]);
  const seatsView = seatViews(hand, s, { inBB, reveal: phase === 'showdown' || phase === 'done', result: r.result, hideActing: phase !== 'action' });
  const l = legal(s);
  const presets = phase === 'action' ? sizePresets(hand, s) : [];
  const skips = phase === 'action' ? skipTargets(hand, s) : [];
  const callers = phase === 'action' ? callerCandidates(hand, s) : [];
  const checks = phase === 'action' ? checkAround(hand, s) : [];
  const levelUp = phase === 'hero' ? nextLevel(hand.game) : null;
  // Heads-up showdown: the picker for the opponent's cards is already open.
  const liveVillains = hand.players.map((_, i) => i).filter((i) => i !== hand.hero && !s.folded[i]);
  const sdSeat = showdownFor !== undefined ? showdownFor : liveVillains.length === 1 && (hand.players[liveVillains[0]].cards?.length ?? 0) < 2 ? liveVillains[0] : null;
  const stage = STAGES.find((x) => x.id === hand.game.stage)?.label;

  const busy = hand.actions.length || heroCards.length || isEdit;
  // Tapping a seat on the felt is how the action is entered: a seat the app
  // folded by itself came in after all; a seat further round gets the turn,
  // with everyone in between checking or folding. Anything else edits the seat.
  const onSeat = (i: number) => {
    if (phase === 'action') {
      if (autoSeats.includes(i)) return rewind(i);
      if (skips.slice(1).includes(i)) {
        tap();
        return pushActions(skipTo(hand, s, i));
      }
    }
    setSeatEdit(i);
  };
  const seatHint =
    phase !== 'action' || !l
      ? null
      : autoSeats.length
        ? (l.p === hand.hero ? t('Fold de todos até ti') : t('Fold de todos até {name}', { name: displayName(hand, l.p, pos) })) + ' · ' + t('alguém entrou? Toca no lugar dele na mesa')
        : skips.length > 1
          ? t('Toca num lugar da mesa para saltar até ele')
          : null;
  const tableW = area.w && area.h ? Math.min(area.w, area.h / ASPECT) : 0;
  // Two ways out at any point of the hand: a voice note (saved when it stops) or just save.
  const quickSave = (
    <Row gap={14}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Gravar nota de voz e guardar')} onPress={voice.start} hitSlop={10}>
        <Row gap={4}>
          <Ionicons name="mic" size={15} color={C.accent} />
          <T v="small" color={C.accent} style={{ fontWeight: '700', fontFamily: ff(700) }}>
            {t('Voz')}
          </T>
        </Row>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => save()} hitSlop={10}>
        <T v="small" color={C.accent} style={{ fontWeight: '700', fontFamily: ff(700) }}>
          {t('Guardar já')}
        </T>
      </Pressable>
    </Row>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* header: one compact row, so the felt gets the screen */}
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: S.gutter, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <IconButton name="close" label={t('Fechar')} onPress={() => (busy ? router.back() : discard())} />
        <Pressable onPress={() => setCtxOpen(true)} style={{ flex: 1, minHeight: 40, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, borderRadius: R.pill, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={hand.game.kind === 'mtt' ? 'trophy' : 'cash'} size={14} color={C.accent} />
          <T v="small" numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: '700', fontFamily: ff(700) }}>
            {(hand.game.name || (hand.game.kind === 'mtt' ? t('Torneio') : 'Cash')) + ' · ' + blindsLabel(hand) + (stage ? ' · ' + stage : '') + ' · ' + t('{n} jog.', { n })}
          </T>
          <Ionicons name="chevron-down" size={14} color={C.muted} />
        </Pressable>
        {levelUp && (
          <IconButton
            name="trending-up"
            color={C.accent}
            label={t('Subiram as blinds? Toca para {blinds}', { blinds: blindsLabel({ ...hand, game: levelUp }) })}
            onPress={() => {
              // Tournament stacks don't grow with the level: only the blinds change.
              update({ ...hand, game: levelUp });
            }}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Valores em big blinds')}
          onPress={() => setInBB((b) => !b)}
          style={{ height: 40, minWidth: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: inBB ? C.accentSoft : C.surface2, borderWidth: 1, borderColor: inBB ? C.accentLine : C.border, borderRadius: 20, paddingHorizontal: 8 }}>
          <T v="tiny" color={inBB ? C.accent : C.textDim} style={{ fontWeight: '800', fontFamily: ff(800) }}>
            BB
          </T>
        </Pressable>
        {hand.voiceNote ? <VoiceNotePlayer uri={hand.voiceNote} compact /> : null}
        <View style={{ opacity: history.length ? 1 : 0.35 }} pointerEvents={history.length ? 'auto' : 'none'}>
          <IconButton name="arrow-undo" label={t('Desfazer')} onPress={undo} />
        </View>
      </View>

      {phase !== 'hero' && <StreetDots street={s.street} done={phase === 'showdown' || phase === 'done'} />}

      {/* the felt takes whatever the dock leaves */}
      <View style={{ flex: 1, minHeight: 160, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width - 16, h: e.nativeEvent.layout.height })}>
        {tableW > 0 && (
          <View style={{ width: tableW }}>
            <Table
              seats={seatsView}
              hero={hand.hero}
              button={hand.button}
              board={phase === 'board2' ? run2Board : hand.board.slice(0, s.boardCount || (phase === 'board' ? hand.board.length : 0))}
              pot={totalPot(s) > 0 ? amount(totalPot(s), hand, inBB) : undefined}
              narration={phase === 'action' ? STREET_PT[s.street] : undefined}
              watermark={BRAND.name}
              onSeatPress={onSeat}
              onSeatLongPress={(i) => setSeatEdit(i)}
            />
          </View>
        )}
      </View>

      {/* dock: everything the thumb needs, pinned to the bottom */}
      <View style={[SHADOW, { backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.border, paddingHorizontal: S.gutter, paddingTop: S.md, paddingBottom: insets.bottom + 10, gap: 10 }]}>
        {voice.recording && <RecordingBar ms={voice.ms} onStop={voice.stop} onCancel={voice.cancel} />}
        {!voice.recording && phase === 'hero' && (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="label">{!draft.posChosen ? t('A tua posição') : heroCards.length < 2 ? t('As tuas cartas') : ''}</T>
              <Pressable onPress={() => setSeatEdit(hand.hero)} hitSlop={8}>
                <T v="small">
                  {t('Stack')} <T v="mono">{amount(hand.players[hand.hero].stack, hand, inBB)}</T>
                </T>
              </Pressable>
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {positionOrder(n).map((label) => {
                const on = draft.posChosen && pos[hand.hero] === label;
                const col = posColor(label);
                return (
                  <Pressable
                    key={label}
                    onPress={() => {
                      tap('select');
                      setHeroPos(label);
                    }}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      minWidth: 62,
                      paddingVertical: 10,
                      borderRadius: R.md,
                      alignItems: 'center',
                      minHeight: 44,
                      justifyContent: 'center',
                      backgroundColor: on ? col : C.surface2,
                      borderWidth: 1,
                      borderColor: on ? col : C.border,
                      opacity: pressed ? 0.75 : 1,
                    })}>
                    <T v="body" color={on ? C.bgDeep : col} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                      {label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            <CardPicker used={usedCards(hand, heroCards)} selected={heroCards} onPick={pickHeroCard} />
            {!settings.onboarded && !isEdit ? (
              <T v="tiny" style={{ textAlign: 'center' }}>
                {t('Posição e duas cartas. Os folds até ti são automáticos.')}
              </T>
            ) : null}
          </>
        )}

        {!voice.recording && phase === 'action' && l && (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2" numberOfLines={1} style={{ flex: 1 }}>
                {STREET_PT[s.street]} · <T v="h2" color={C.warn}>{displayName(hand, l.p, pos)}</T>
                {l.p === hand.hero || !hand.players[l.p].name ? '' : ` (${pos[l.p]})`}
              </T>
              {quickSave}
            </Row>
            {seatHint ? (
              <T v="tiny" color={C.textDim} numberOfLines={2}>
                {seatHint}
              </T>
            ) : null}
            {(callers.length > 0 || checks.length > 0) && (
              <ChipRow>
                {callers.map((i) => (
                  <Chip key={i} big label={t('Só {name} paga', { name: displayName(hand, i, pos) + (hand.players[i].name ? ` (${pos[i]})` : '') })} onPress={() => pushActions(onlyCaller(hand, s, i))} />
                ))}
                {callers.length > 0 && <Chip big label={t('Todos fold')} onPress={() => pushActions(onlyCaller(hand, s, null))} />}
                {checks.length > 0 && <Chip big label={t('Todos check')} onPress={() => pushActions(checks)} />}
              </ChipRow>
            )}
            {presets.length > 0 && (
              <View style={{ gap: 4 }}>
                <T v="label">{l.canBet ? raiseName(s) : t('{action} para', { action: raiseName(s) })}</T>
                <Row gap={6}>
                  {presets.map((p) => (
                    <Pressable
                      key={p.label}
                      onPress={() => act(l.canBet ? 'bet' : 'raise', p.to)}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 58,
                        paddingVertical: 5,
                        borderRadius: R.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: p.allIn ? C.dangerSoft : C.warnSoft,
                        borderWidth: 1,
                        borderColor: p.allIn ? C.danger : C.warn + '66',
                        opacity: pressed ? 0.7 : 1,
                      })}>
                      <T v="body" numberOfLines={1} color={p.allIn ? C.danger : C.warn} style={{ fontWeight: '800', fontFamily: ff(800), fontSize: 15 }}>
                        {p.label}
                      </T>
                      <T v="monoS" numberOfLines={1}>
                        {amount(p.to, hand, inBB)}
                      </T>
                      {!inBB && !p.allIn ? (
                        <T v="tiny" numberOfLines={1} color={C.muted}>
                          {bbs(p.to, hand.game.bb)}
                        </T>
                      ) : null}
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityLabel={t('Outro valor')}
                    onPress={() => setPad(true)}
                    style={({ pressed }) => ({ width: 46, minHeight: 58, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, opacity: pressed ? 0.7 : 1 })}>
                    <Ionicons name="keypad" size={18} color={C.text} />
                  </Pressable>
                </Row>
              </View>
            )}
            <Row gap={8}>
              {l.canCall ? <BigAction label="Fold" kind="fold" onPress={() => act('fold')} /> : null}
              {l.canCheck ? (
                <BigAction label="Check" kind="check" onPress={() => act('check')} />
              ) : (
                <BigAction label={`${callName(s)} ${amount(l.toCall, hand, inBB)}`} kind="call" onPress={() => act('call')} />
              )}
            </Row>
          </>
        )}

        {!voice.recording && phase === 'board' && (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2">
                {STREET_PT[s.street]} · {boardNeeded - hand.board.length === 1 ? t('escolhe 1 carta') : t('escolhe {n} cartas', { n: boardNeeded - hand.board.length })}
                {s.bettingDone ? <T v="small" color={C.allin}>  all-in</T> : null}
              </T>
              {quickSave}
            </Row>
            <CardPicker used={usedCards(hand)} selected={hand.board.slice(s.boardCount)} onPick={pickBoard} />
            {r.steps.length > 0 && s.bettingDone && (
              <Row gap={8}>
                {twiceChip}
                <Button title={t('Guardar sem board')} kind="ghost" small onPress={() => save()} />
              </Row>
            )}
          </>
        )}

        {!voice.recording && phase === 'board2' && (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2">
                {t('2.ª vez')} · {board2Left === 1 ? t('escolhe 1 carta') : t('escolhe {n} cartas', { n: board2Left })}
              </T>
              {twiceChip}
            </Row>
            <CardPicker used={usedCards(hand)} selected={hand.board2 ?? []} onPick={pickBoard2} />
          </>
        )}

        {!voice.recording && (phase === 'showdown' || phase === 'done') && (
          <>
            <ScrollView style={{ maxHeight: area.h ? Math.max(220, (area.h + 300) * 0.55) : 360 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              {phase === 'showdown' && (
                <View style={{ gap: 8 }}>
                  <T v="h2">Showdown</T>
                  <T v="small">{t('Que cartas mostraram? (opcional — sem cartas escolhes tu o vencedor)')}</T>
                  <Row style={{ flexWrap: 'wrap' }} gap={6}>
                    {hand.players.map((p, i) =>
                      i === hand.hero || s.folded[i] ? null : (
                        <Chip
                          key={i}
                          big
                          active={sdSeat === i}
                          label={`${displayName(hand, i, pos)} ${p.cards?.length === 2 ? comboLabel(p.cards) : '??'}`}
                          onPress={() => setShowdownFor(sdSeat === i ? null : i)}
                        />
                      ),
                    )}
                  </Row>
                  {sdSeat !== null && (
                    <CardPicker
                      used={usedCards(hand, hand.players[sdSeat].cards ?? [])}
                      selected={hand.players[sdSeat].cards ?? []}
                      onPick={(c) => {
                        const p = hand.players[sdSeat];
                        let cards = [...(p.cards ?? [])];
                        if (cards.includes(c)) cards = cards.filter((x) => x !== c);
                        else if (cards.length < 2) cards.push(c);
                        else cards = [cards[1], c];
                        setPlayer(sdSeat, { ...p, cards });
                        if (cards.length === 2) setShowdownFor(null);
                      }}
                    />
                  )}
                  {twiceChip && <ChipRow>{twiceChip}</ChipRow>}
                  {r.boards.length === 2 &&
                    r.boards.map((b, run) => (
                      <Row key={run} gap={10}>
                        <T v="small" style={{ minWidth: 80 }}>
                          {run ? t('2.ª vez') : t('1.ª vez')}
                        </T>
                        <CardRow cards={b} />
                      </Row>
                    ))}
                  {r.result && !r.result.resolved && (
                    <View style={{ gap: 6 }}>
                      {(r.boards.length === 2 ? (['winners', 'winners2'] as const) : (['winners'] as const)).map((key, run) => (
                        <View key={key} style={{ gap: 6 }}>
                          <T v="label">{r.boards.length === 2 ? (run ? t('Quem ganhou a 2.ª vez?') : t('Quem ganhou a 1.ª vez?')) : t('Quem ganhou?')}</T>
                          <Row style={{ flexWrap: 'wrap' }} gap={6}>
                            {hand.players.map((p, i) =>
                              s.folded[i] ? null : (
                                <Chip
                                  key={i}
                                  big
                                  label={displayName(hand, i, pos)}
                                  active={hand[key]?.includes(i)}
                                  onPress={() => {
                                    const w = hand[key] ?? [];
                                    update({ ...hand, [key]: w.includes(i) ? w.filter((x) => x !== i) : [...w, i] });
                                  }}
                                />
                              ),
                            )}
                          </Row>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
              {r.result && (
                <View style={{ backgroundColor: C.surface2, borderRadius: R.md, padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="small">{t('Resultado do herói')}</T>
                  {r.result.resolved ? (
                    <T v="mono" color={r.result.net[hand.hero] >= 0 ? C.good : C.bad}>
                      {(r.result.net[hand.hero] >= 0 ? '+' : '') + amount(r.result.net[hand.hero], hand, inBB)}
                    </T>
                  ) : (
                    <T v="small">{t('Escolhe quem ganhou')}</T>
                  )}
                </View>
              )}
              <FinishPanel hand={hand} onChange={(h) => setDraftState({ ...draft, hand: h })} />
            </ScrollView>
            <Button title={t('Guardar e ver replay')} onPress={() => save()} />
          </>
        )}
      </View>

      <ContextSheet
        visible={ctxOpen}
        game={hand.game}
        tableSize={n}
        recentNames={recentNames}
        onChange={(game) => {
          // Straddles and bomb pots change who acts first: the action starts over.
          const g = hand.game;
          const reset = g.straddles !== game.straddles || g.straddleFrom !== game.straddleFrom || g.bombPot !== game.bombPot;
          const next = reset ? { ...hand, actions: [], board: [] } : hand;
          update(hand.sessionId ? { ...next, game } : rescaleStacks(next, game));
        }}
        onTableSize={(k) => update(resizeTable(hand, k), false)}
        onClose={() => setCtxOpen(false)}
      />
      <SeatSheet
        visible={seatEdit !== null}
        title={seatEdit === null ? '' : seatEdit === hand.hero ? t('Tu') : t('Lugar {pos}', { pos: pos[seatEdit] })}
        player={seatEdit === null ? null : hand.players[seatEdit]}
        isHero={seatEdit === hand.hero}
        heroStack={hand.players[hand.hero].stack}
        bb={hand.game.bb}
        known={store.players}
        stats={reads}
        onClose={() => setSeatEdit(null)}
        reseat={
          seatEdit === null || seatEdit === hand.hero || hand.actions.length
            ? undefined
            : {
                swapWith: hand.players.map((_, k) => ({ index: k, label: pos[k] })).filter((x) => x.index !== seatEdit && x.index !== hand.hero),
                onNewPlayer: () => {
                  tap();
                  update({ ...hand, players: hand.players.map((x, k) => (k === seatEdit ? { name: '', stack: x.stack } : x)) });
                  setSeatEdit(null);
                },
                onLeave:
                  n > 2
                    ? () => {
                        tap();
                        update(removeSeat(hand, seatEdit));
                        setSeatEdit(null);
                      }
                    : undefined,
                onJoin:
                  n < 10
                    ? () => {
                        tap();
                        update(addSeat(hand, seatEdit, hand.players[hand.hero].stack));
                        setSeatEdit(null);
                      }
                    : undefined,
                onSwap: (k) => {
                  tap();
                  update(swapSeats(hand, seatEdit, k));
                  setSeatEdit(null);
                },
              }
        }
        onSave={(p, all) => {
          if (seatEdit === null) return;
          const players = hand.players.map((x, k) => (k === seatEdit ? p : all ? { ...x, stack: p.stack } : x));
          update({ ...hand, players });
          setSeatEdit(null);
        }}
      />
      {l && (
        <AmountPad
          visible={pad}
          title={l.canBet ? 'Bet' : t('Raise para')}
          bb={hand.game.bb}
          initialInBB={inBB}
          min={l.minTo}
          max={l.maxTo}
          onClose={() => setPad(false)}
          onDone={(v) => {
            setPad(false);
            act(l.canBet ? 'bet' : 'raise', Math.max(v, l.minTo));
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function BigAction({ label, kind, onPress }: { label: string; kind: 'fold' | 'check' | 'call'; onPress: () => void }) {
  const solid = kind === 'call';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: solid ? 1.4 : 1,
        height: 56,
        borderRadius: R.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? C.accent : C.surface3,
        borderWidth: 1,
        borderColor: solid ? C.accent : C.borderStrong,
        opacity: pressed ? 0.8 : 1,
      })}>
      <T v="body" numberOfLines={1} color={solid ? C.accentInk : C.text} style={{ fontWeight: '800', fontFamily: ff(800), fontSize: 17 }}>
        {label}
      </T>
    </Pressable>
  );
}

function FinishPanel({ hand, onChange }: { hand: Hand; onChange: (h: Hand) => void }) {
  const toggle = (tg: string) =>
    onChange({ ...hand, tags: hand.tags.includes(tg) ? hand.tags.filter((x) => x !== tg) : [...hand.tags, tg] });
  return (
    <View style={{ gap: 10 }}>
      <T v="label">Tags</T>
      <ChipRow>
        {DEFAULT_TAGS.map((tg) => (
          <Chip key={tg} label={t(tg)} active={hand.tags.includes(tg)} onPress={() => toggle(tg)} />
        ))}
      </ChipRow>
      <Field value={hand.notes} onChangeText={(notes) => onChange({ ...hand, notes })} placeholder={t('Notas (o que pensaste, reads, dúvidas…)')} multiline inputStyle={{ minHeight: 70 }} />
    </View>
  );
}

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'] as const;

/** Pré-flop • Flop • Turn • River: where the hand is, at a glance. */
function StreetDots({ street, done }: { street: (typeof STREET_ORDER)[number]; done: boolean }) {
  const at = STREET_ORDER.indexOf(street);
  return (
    <Row gap={6} style={{ justifyContent: 'center', paddingVertical: 2 }}>
      {STREET_ORDER.map((st, i) => {
        const now = i === at && !done;
        const past = i < at || (done && i <= at);
        return (
          <Row key={st} gap={4}>
            {i > 0 ? <View style={{ width: 10, height: 1, backgroundColor: past || now ? C.accentLine : C.border }} /> : null}
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: now ? C.accent : past ? C.textDim : C.border }} />
            <T v="tiny" color={now ? C.text : past ? C.textDim : C.muted} style={now ? { fontWeight: '700', fontFamily: ff(700) } : undefined}>
              {STREET_PT[st]}
            </T>
          </Row>
        );
      })}
    </Row>
  );
}
