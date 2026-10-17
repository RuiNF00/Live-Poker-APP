// Hand entry. The whole hand is entered on one screen that walks you through
// it: position + cards, then the action seat by seat, the board when a street
// closes, showdown, tags. Every step is one tap where possible:
//  - one tap per card (full-deck grid),
//  - one tap per action, with sizes as presets (2.2x, 33%, pote…),
//  - "salta para" chips fold/check everyone in between in one tap,
//  - context (tournament, blinds, table) carries over from the session.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { AmountPad } from '@/components/AmountPad';
import { CardPicker } from '@/components/CardPicker';
import { ContextSheet, inputStyle } from '@/components/entry/ContextSheet';
import { SeatSheet } from '@/components/entry/SeatSheet';
import { PlayingCard } from '@/components/PlayingCard';
import { Table } from '@/components/Table';
import { Button, Chip, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { buttonForHeroPosition, callName, legal, positionOrder, positions, raiseName, replay, totalPot, usedCards } from '@/poker/engine';
import { callerCandidates, onlyCaller, sizePresets, skipTargets, skipTo } from '@/poker/entry';
import { newHand, rescaleStacks, resizeTable } from '@/poker/factory';
import { amount, blindsLabel, chips } from '@/poker/format';
import { DEFAULT_TAGS, STAGES, type Hand, type HandAction, type Player } from '@/poker/types';
import { displayName, seatViews } from '@/poker/view';
import { uid, useStore } from '@/store/store';
import { BRAND, C, R, ff } from '@/theme';

const STREET_PT = { preflop: t('Pré-flop'), flop: 'Flop', turn: 'Turn', river: 'River' };

interface Draft {
  hand: Hand;
  posChosen: boolean;
}

export default function NewHand() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ edit?: string }>();
  const store = useStore();
  const pro = usePro();
  const { activeSession, settings, hands } = store;

  const [draft, setDraftState] = useState<Draft>(() => {
    const editing = params.edit ? store.hands.find((h) => h.id === params.edit) : null;
    if (editing) return { hand: editing, posChosen: true };
    if (store.draft) return { hand: store.draft, posChosen: !!store.draft.actions.length || store.draft.button !== 0 || !!store.draft.players[0].cards };
    const last = hands[0] ?? null;
    return { hand: newHand({ id: uid('h_'), session: activeSession, last, currency: settings.currency }), posChosen: false };
  });
  const [history, setHistory] = useState<Draft[]>([]);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [seatEdit, setSeatEdit] = useState<number | null>(null);
  const [pad, setPad] = useState(false);
  const [inBB, setInBB] = useState(settings.inBB);
  const [showdownFor, setShowdownFor] = useState<number | null>(null);

  const hand = draft.hand;
  const n = hand.players.length;
  const pos = positions(n, hand.button);
  const heroCards = hand.players[hand.hero].cards ?? [];
  const r = useMemo(() => replay(hand), [hand]);
  const s = r.final;

  useEffect(() => {
    if (!params.edit) store.setDraft(hand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand]);

  const update = (h: Hand, posChosen = draft.posChosen) => {
    setHistory((x) => [...x.slice(-60), draft]);
    setDraftState({ hand: { ...h, updatedAt: Date.now() }, posChosen });
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
  type Phase = 'hero' | 'action' | 'board' | 'showdown' | 'done';
  let phase: Phase;
  if (!draft.posChosen || heroCards.length < 2) phase = 'hero';
  else if (s.needsBoard) phase = 'board';
  else if (s.toAct !== null) phase = 'action';
  else if (r.result && !s.foldWin) phase = 'showdown';
  else phase = 'done';

  // Most hands fold to hero: do that automatically once per position. Undo
  // brings back the seats before hero if someone did enter the pot.
  const autoFolded = useRef('');
  useEffect(() => {
    const key = `${hand.id}:${hand.button}`;
    if (phase !== 'action' || hand.actions.length || s.street !== 'preflop' || s.toAct === hand.hero || autoFolded.current === key) return;
    autoFolded.current = key;
    const acts = skipTo(hand, s, hand.hero);
    if (acts.length) pushActions(acts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hand.actions.length, hand.button]);
  const autoFoldCount = autoFolded.current === `${hand.id}:${hand.button}` && hand.actions.length && hand.actions.every((a) => a.kind === 'fold' && a.p !== hand.hero) ? hand.actions.length : 0;

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

  const save = async () => {
    tap('medium');
    // Free plan: past the daily limit the hand stays as a draft and the paywall opens.
    if (!params.edit && !pro.canSaveHand()) {
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
    // Keep the session's live table state in sync, so the next hand is pre-filled.
    const sess = store.sessions.find((x) => x.id === final.sessionId);
    if (sess && !params.edit) {
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
    if (!params.edit) {
      store.setDraft(null);
      pro.record('hand');
    }
    router.replace({ pathname: '/hand/[id]', params: { id: final.id } });
  };

  const discard = () => {
    store.setDraft(null);
    router.back();
  };

  const recentNames = useMemo(() => [...new Set(hands.map((h) => h.game.name).filter(Boolean))].slice(0, 8), [hands]);
  const seatsView = seatViews(hand, s, { inBB, reveal: phase === 'showdown' || phase === 'done', result: r.result, hideActing: phase !== 'action' });
  const l = legal(s);
  const presets = phase === 'action' ? sizePresets(hand, s) : [];
  const skips = phase === 'action' ? skipTargets(hand, s) : [];
  const callers = phase === 'action' ? callerCandidates(hand, s) : [];
  const stage = STAGES.find((x) => x.id === hand.game.stage)?.label;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => (hand.actions.length || heroCards.length || params.edit ? router.back() : discard())} hitSlop={10}>
          <Ionicons name="close" size={26} color={C.textDim} />
        </Pressable>
        <Pressable onPress={() => setCtxOpen(true)} style={{ flex: 1, backgroundColor: C.surface2, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={hand.game.kind === 'mtt' ? 'trophy' : 'cash'} size={14} color={C.accent} />
          <T v="small" numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: '700', fontFamily: ff(700) }}>
            {(hand.game.name || (hand.game.kind === 'mtt' ? t('Torneio') : 'Cash')) + ' · ' + blindsLabel(hand) + (stage ? ' · ' + stage : '') + ' · ' + t('{n} jog.', { n })}
          </T>
          <Ionicons name="chevron-down" size={14} color={C.muted} />
        </Pressable>
        <Pressable onPress={undo} disabled={!history.length} hitSlop={10} style={{ opacity: history.length ? 1 : 0.3 }}>
          <Ionicons name="arrow-undo" size={24} color={C.text} />
        </Pressable>
        <Pressable onPress={() => setInBB((b) => !b)} hitSlop={8} style={{ backgroundColor: inBB ? C.accentSoft : C.surface2, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }}>
          <T v="tiny" color={inBB ? C.accent : C.textDim} style={{ fontWeight: '800', fontFamily: ff(800) }}>
            BB
          </T>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Table
          seats={seatsView}
          hero={hand.hero}
          button={hand.button}
          board={hand.board.slice(0, s.boardCount || (phase === 'board' ? hand.board.length : 0))}
          pot={totalPot(s) > 0 ? amount(totalPot(s), hand, inBB) : undefined}
          narration={phase === 'action' ? STREET_PT[s.street] : undefined}
          watermark={BRAND.name}
          onSeatPress={(i) => setSeatEdit(i)}
        />

        {phase === 'hero' && (
          <View style={{ gap: 12 }}>
            <View style={{ gap: 6 }}>
              <T v="label">{t('A tua posição')}</T>
              <Row style={{ flexWrap: 'wrap' }} gap={6}>
                {positionOrder(n).map((label) => (
                  <Chip key={label} big label={label} active={draft.posChosen && pos[hand.hero] === label} onPress={() => setHeroPos(label)} />
                ))}
              </Row>
            </View>
            <View style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="label">{t('As tuas cartas')}</T>
                <Row gap={4}>
                  {[0, 1].map((k) => (
                    <PlayingCard key={k} card={heroCards[k]} size="sm" faceDown={!heroCards[k]} />
                  ))}
                </Row>
              </Row>
              <CardPicker used={usedCards(hand, heroCards)} selected={heroCards} onPick={pickHeroCard} />
            </View>
            <Pressable onPress={() => setSeatEdit(hand.hero)} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.surface, padding: 12, borderRadius: R.md }}>
              <T v="small">{t('O teu stack (toca num lugar para mudar nome ou stack)')}</T>
              <T v="mono">{amount(hand.players[hand.hero].stack, hand, inBB)}</T>
            </Pressable>
          </View>
        )}

        {phase === 'action' && l && (
          <View style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2">
                {STREET_PT[s.street]} · <T v="h2" color={C.warn}>{displayName(hand, l.p, pos)}</T>
                {l.p === hand.hero || !hand.players[l.p].name ? '' : ` (${pos[l.p]})`}
              </T>
              {l.toCall > 0 ? <T v="small">{t('para pagar {amount}', { amount: amount(l.toCall, hand, inBB) })}</T> : null}
            </Row>
            {autoFoldCount > 0 && l.p === hand.hero && (
              <Pressable onPress={undo} hitSlop={6}>
                <T v="small">
                  {t('Fold de todos até ti')} · <T v="small" color={C.accent}>{t('alguém entrou antes? Desfaz')}</T>
                </T>
              </Pressable>
            )}
            {callers.length > 0 && (
              <View style={{ gap: 6 }}>
                <T v="label">{t('Resposta rápida (os outros fazem fold)')}</T>
                <Row style={{ flexWrap: 'wrap' }} gap={6}>
                  {callers.map((i) => (
                    <Chip key={i} big label={t('Só {name} paga', { name: displayName(hand, i, pos) + (hand.players[i].name ? ` (${pos[i]})` : '') })} onPress={() => pushActions(onlyCaller(hand, s, i))} />
                  ))}
                  <Chip big label={t('Todos fold')} onPress={() => pushActions(onlyCaller(hand, s, null))} />
                </Row>
              </View>
            )}
            <Row gap={8}>
              {l.canCall ? (
                <Button title="Fold" kind="secondary" style={{ flex: 1 }} onPress={() => act('fold')} />
              ) : null}
              {l.canCheck ? (
                <Button title="Check" kind="secondary" style={{ flex: 1 }} onPress={() => act('check')} />
              ) : (
                <Button title={`${callName(s)} ${amount(l.toCall, hand, inBB)}`} style={{ flex: 1.4 }} onPress={() => act('call')} />
              )}
            </Row>
            {presets.length > 0 && (
              <View style={{ gap: 6 }}>
                <T v="label">{l.canBet ? raiseName(s) : t('{action} para', { action: raiseName(s) })}</T>
                <Row style={{ flexWrap: 'wrap' }} gap={6}>
                  {presets.map((p) => (
                    <Pressable
                      key={p.label}
                      onPress={() => act(l.canBet ? 'bet' : 'raise', p.to)}
                      style={({ pressed }) => ({
                        minWidth: 70,
                        flexGrow: 1,
                        paddingVertical: 9,
                        paddingHorizontal: 8,
                        borderRadius: R.md,
                        alignItems: 'center',
                        backgroundColor: p.allIn ? C.dangerSoft : 'rgba(245,184,61,0.12)',
                        borderWidth: 1,
                        borderColor: p.allIn ? C.danger : 'rgba(245,184,61,0.45)',
                        opacity: pressed ? 0.7 : 1,
                      })}>
                      <T v="body" color={p.allIn ? C.danger : C.warn} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                        {p.label}
                      </T>
                      <T v="tiny" color={C.textDim}>
                        {amount(p.to, hand, inBB)}
                      </T>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => setPad(true)}
                    style={({ pressed }) => ({ minWidth: 70, flexGrow: 1, paddingVertical: 9, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, opacity: pressed ? 0.7 : 1 })}>
                    <Ionicons name="keypad" size={18} color={C.text} />
                  </Pressable>
                </Row>
              </View>
            )}
            {skips.length > 1 && (
              <View style={{ gap: 6 }}>
                <T v="label">{t('Salta para (os do meio fazem {action})', { action: l.canCheck ? 'check' : 'fold' })}</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {skips.slice(1).map((i) => (
                    <Chip
                      key={i}
                      label={(i === hand.hero ? '★ ' : '') + displayName(hand, i, pos) + (i === hand.hero ? '' : hand.players[i].name ? ` · ${pos[i]}` : '')}
                      onPress={() => pushActions(skipTo(hand, s, i))}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {phase === 'board' && (
          <View style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2">
                {STREET_PT[s.street]} — {boardNeeded - hand.board.length === 1 ? t('escolhe 1 carta') : t('escolhe {n} cartas', { n: boardNeeded - hand.board.length })}
              </T>
              {s.bettingDone ? <T v="small" color={C.allin}>all-in</T> : null}
            </Row>
            <CardPicker used={usedCards(hand)} selected={hand.board.slice(s.boardCount)} onPick={pickBoard} />
            {r.steps.length > 0 && s.bettingDone && (
              <Button title={t('Guardar sem board')} kind="ghost" onPress={save} />
            )}
          </View>
        )}

        {(phase === 'showdown' || phase === 'done') && (
          <View style={{ gap: 12 }}>
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
                        active={showdownFor === i}
                        label={`${displayName(hand, i, pos)} ${p.cards?.length === 2 ? comboLabel(p.cards) : '??'}`}
                        onPress={() => setShowdownFor(showdownFor === i ? null : i)}
                      />
                    ),
                  )}
                </Row>
                {showdownFor !== null && (
                  <CardPicker
                    used={usedCards(hand, hand.players[showdownFor].cards ?? [])}
                    selected={hand.players[showdownFor].cards ?? []}
                    onPick={(c) => {
                      const p = hand.players[showdownFor];
                      let cards = [...(p.cards ?? [])];
                      if (cards.includes(c)) cards = cards.filter((x) => x !== c);
                      else if (cards.length < 2) cards.push(c);
                      else cards = [cards[1], c];
                      setPlayer(showdownFor, { ...p, cards });
                      if (cards.length === 2) setShowdownFor(null);
                    }}
                  />
                )}
                {r.result && !r.result.resolved && (
                  <View style={{ gap: 6 }}>
                    <T v="label">{t('Quem ganhou?')}</T>
                    <Row style={{ flexWrap: 'wrap' }} gap={6}>
                      {hand.players.map((p, i) =>
                        s.folded[i] ? null : (
                          <Chip
                            key={i}
                            big
                            label={displayName(hand, i, pos)}
                            active={hand.winners?.includes(i)}
                            onPress={() => {
                              const w = hand.winners ?? [];
                              update({ ...hand, winners: w.includes(i) ? w.filter((x) => x !== i) : [...w, i] });
                            }}
                          />
                        ),
                      )}
                    </Row>
                  </View>
                )}
              </View>
            )}
            {r.result && (
              <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
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
            <Button title={t('Guardar e ver replay')} onPress={save} />
          </View>
        )}

        {phase === 'hero' && !settings.onboarded && !params.edit && (
          <View style={{ backgroundColor: C.accentSoft, borderRadius: R.md, padding: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(255,106,61,0.35)' }}>
            <T v="h2">{t('Primeira mão? É rápido:')}</T>
            <T v="small" style={{ color: C.text, lineHeight: 19 }}>
              {t('1. Toca na tua posição e nas tuas duas cartas.\n2. Os folds até ti são automáticos. Depois do teu raise, usa "Só X paga".\n3. Escolhe o flop e continua. Podes guardar a meio e completar depois.')}
            </T>
          </View>
        )}
        {(phase === 'action' || phase === 'board') && (
          <Button title={t('Guardar rápido · completas depois')} kind="ghost" small onPress={save} />
        )}
        {phase === 'hero' && heroCards.length === 2 && !draft.posChosen ? (
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Escolhe a tua posição para começar a ação.')}
          </T>
        ) : null}
      </ScrollView>

      <ContextSheet
        visible={ctxOpen}
        game={hand.game}
        tableSize={n}
        recentNames={recentNames}
        onChange={(game) => update(hand.sessionId ? { ...hand, game } : rescaleStacks(hand, game))}
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
        onClose={() => setSeatEdit(null)}
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

function FinishPanel({ hand, onChange }: { hand: Hand; onChange: (h: Hand) => void }) {
  const toggle = (tg: string) =>
    onChange({ ...hand, tags: hand.tags.includes(tg) ? hand.tags.filter((x) => x !== tg) : [...hand.tags, tg] });
  return (
    <View style={{ gap: 10 }}>
      <T v="label">Tags</T>
      <Row style={{ flexWrap: 'wrap' }} gap={6}>
        {DEFAULT_TAGS.map((tg) => (
          <Chip key={tg} label={t(tg)} active={hand.tags.includes(tg)} onPress={() => toggle(tg)} />
        ))}
      </Row>
      <TextInput
        value={hand.notes}
        onChangeText={(notes) => onChange({ ...hand, notes })}
        placeholder={t('Notas (o que pensaste, reads, dúvidas…)')}
        placeholderTextColor={C.muted}
        multiline
        style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
      />
      <T v="tiny">{t('Stack inicial do herói: {stack}', { stack: chips(hand.players[hand.hero].stack) })}</T>
    </View>
  );
}
