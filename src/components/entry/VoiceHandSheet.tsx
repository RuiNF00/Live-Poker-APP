// "Contar a mão": the player tells the hand (the keyboard's microphone, or
// typing) and sees it take shape as they go: position, cards, each street's
// action. Cards the app had to guess are marked and one tap away from being
// fixed; the rest is fixed on the entry screen, where the hand lands.
// The words are read on the phone (poker/voice.ts); nothing is sent anywhere.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { TapCounted } from '@/components/TapCount';
import { t } from '@/i18n';
import { useSheetAnimation } from '@/lib/motion';
import { positions, replay, usedCards } from '@/poker/engine';
import type { CardCode, Hand, Street } from '@/poker/types';
import { handFromSpeech, type VoiceNote } from '@/poker/voice';
import { C, R, S, ff, posColor } from '@/theme';

import { CardPicker } from '../CardPicker';
import { PlayingCard } from '../PlayingCard';
import { STREET_LABEL, timeline } from '../replayer/model';
import { Button, Field, Row, SheetHeader, T, tap, useSheetPad } from '../ui';

/** Where a card sits: hero's two, the board's five, or an opponent's two. */
type Slot = { k: 'hero'; i: number } | { k: 'board'; i: number } | { k: 'seat'; seat: number; i: number };
const slotKey = (s: Slot) => (s.k === 'seat' ? `s${s.seat}.${s.i}` : `${s.k[0]}${s.i}`);

function cardAt(hand: Hand, s: Slot): CardCode | undefined {
  if (s.k === 'board') return hand.board[s.i];
  return hand.players[s.k === 'hero' ? hand.hero : s.seat].cards?.[s.i];
}

function setCard(hand: Hand, s: Slot, c: CardCode): Hand {
  if (s.k === 'board') return { ...hand, board: hand.board.map((x, i) => (i === s.i ? c : x)) };
  const p = s.k === 'hero' ? hand.hero : s.seat;
  return { ...hand, players: hand.players.map((x, i) => (i === p && x.cards ? { ...x, cards: x.cards.map((y, k) => (k === s.i ? c : y)) } : x)) };
}

/** Every card slot in the hand, so a picked card already in use swaps places with the one it replaces. */
function slots(hand: Hand): Slot[] {
  const out: Slot[] = [];
  hand.players.forEach((p, seat) => p.cards?.forEach((_, i) => out.push(seat === hand.hero ? { k: 'hero', i } : { k: 'seat', seat, i })));
  hand.board.forEach((_, i) => out.push({ k: 'board', i }));
  return out;
}

/** The player's fixes on top of what was heard. A card used elsewhere trades places with the one it replaces. */
function withFixes(hand: Hand, fixes: Record<string, CardCode>): Hand {
  let h = hand;
  for (const [key, c] of Object.entries(fixes)) {
    const s = slots(h).find((x) => slotKey(x) === key);
    if (!s) continue;
    const old = cardAt(h, s);
    if (!old || old === c) continue;
    const other = slots(h).find((x) => cardAt(h, x) === c);
    h = setCard(h, s, c);
    if (other) h = setCard(h, other, old);
  }
  return h;
}

function noteText(n: VoiceNote, hand: Hand): string {
  const street = n.street ? STREET_LABEL[n.street] : '';
  switch (n.code) {
    case 'suits':
      return t('Os naipes que não disseste foram escolhidos por nós. Toca numa carta para a mudar.');
    case 'size':
      return n.pos ? t('Sem valor para o {pos}: ficou o tamanho habitual.', { pos: n.pos }) : t('Um valor não foi dito: ficou o tamanho habitual.');
    case 'minRaise':
      return t('O raise do {pos} estava abaixo do mínimo e foi subido.', { pos: n.pos ?? '' });
    case 'boardMissing':
      return t('Faltam cartas no {street}: a mão fica por aí e escolhes as cartas a seguir.', { street });
    case 'noPosition':
      return t('Não disseste a tua posição: ficaste no {pos}.', { pos: positions(hand.players.length, hand.button)[hand.hero] });
    case 'noCards':
      return t('Não percebemos as tuas cartas: escolhes a seguir.');
    case 'skipped':
      return t('Uma ação não encaixou na mão e ficou de fora.');
    case 'stackGrew':
      return t('O stack do {pos} subiu para caber o valor que disseste.', { pos: n.pos ?? '' });
  }
}

export function VoiceHandSheet({ visible, base, onClose, onDone }: { visible: boolean; base: Hand; onClose: () => void; onDone: (hand: Hand, posKnown: boolean) => void }) {
  const sheetAnimation = useSheetAnimation();
  const sheetPad = useSheetPad(24);
  const [text, setText] = useState('');
  const [fixes, setFixes] = useState<Record<string, CardCode>>({});
  const [picking, setPicking] = useState<Slot | null>(null);
  const heard = useDeferredValue(text);
  const result = useMemo(() => handFromSpeech(heard, base), [heard, base]);
  const hand = useMemo(() => withFixes(result.hand, fixes), [result.hand, fixes]);
  const fixed = new Set(Object.keys(fixes));
  const guessed = (s: Slot) => {
    const c = cardAt(hand, s);
    return !!c && result.guessed.includes(c) && !fixed.has(slotKey(s));
  };

  const change = (v: string) => {
    setText(v);
    // New words make a new hand: fixes made to the old one no longer line up.
    if (Object.keys(fixes).length) setFixes({});
    setPicking(null);
  };
  const close = () => {
    setPicking(null);
    onClose();
  };
  const done = () => {
    tap('success');
    onDone(hand, result.posKnown);
    setText('');
    setFixes({});
    setPicking(null);
  };

  const card = (s: Slot) => {
    const c = cardAt(hand, s);
    if (!c) return null;
    const g = guessed(s);
    const on = picking && slotKey(picking) === slotKey(s);
    return (
      <Pressable
        key={slotKey(s)}
        accessibilityRole="button"
        accessibilityLabel={g ? t('Carta com naipe escolhido por nós. Toca para mudar') : t('Toca para mudar a carta')}
        onPress={() => {
          tap('select');
          setPicking(on ? null : s);
        }}
        hitSlop={4}
        style={{ alignItems: 'center', gap: 3 }}>
        <PlayingCard card={c} size="sm" highlight={!!on} />
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: g ? C.warn : 'transparent' }} />
      </Pressable>
    );
  };

  // What was understood, street by street: the board cards, then each action as a short chip.
  const r = replay(hand);
  const items = timeline(hand, r, false);
  const streets: { street: Street; chips: { label: string; detail?: string; hero: boolean; fold: boolean }[] }[] = [];
  let cur: (typeof streets)[number] | null = null;
  for (const it of items) {
    if (it.kind === 'street') {
      const street = (['preflop', 'flop', 'turn', 'river'] as Street[])[streets.length] ?? 'river';
      cur = { street, chips: [] };
      streets.push(cur);
    } else if (it.kind === 'action' && cur) cur.chips.push({ label: it.label, detail: it.detail, hero: it.color === 'hero', fold: it.color === 'fold' });
  }
  const pos = positions(hand.players.length, hand.button);
  const boardFor = (st: Street) => (st === 'flop' ? [0, 1, 2] : st === 'turn' ? [3] : st === 'river' ? [4] : []).filter((i) => i < hand.board.length);
  const shown = hand.players.map((p, seat) => ({ p, seat })).filter(({ p, seat }) => seat !== hand.hero && p.cards?.length);
  const heroCards = hand.players[hand.hero].cards ?? [];
  const pickUsed = picking ? usedCards(hand, [cardAt(hand, picking) ?? '']) : new Set<string>();
  // Folds the app filled in are left out of the chips: only what was said (and the checks) shows.
  const said = (c: { fold: boolean; hero: boolean }) => !c.fold || c.hero;

  // The deck opens right under the card being fixed, not at the bottom of the sheet.
  const picker = (here: (x: Slot) => boolean) =>
    picking && here(picking) ? (
      <View style={{ gap: 6 }}>
        <T v="tiny" color={C.textDim}>
          {t('Escolhe a carta certa')}
        </T>
        <CardPicker
          used={pickUsed}
          selected={[cardAt(hand, picking) ?? '']}
          onPick={(c) => {
            setFixes((f) => ({ ...f, [slotKey(picking)]: c }));
            setPicking(null);
          }}
        />
      </View>
    ) : null;

  return (
    <Modal visible={visible} animationType={sheetAnimation} transparent onRequestClose={close}>
      <TapCounted style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={close} />
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '92%', borderTopWidth: 1, borderColor: C.border }}>
            <ScrollView contentContainerStyle={{ padding: S.gutter, paddingTop: S.lg, gap: S.md, paddingBottom: sheetPad }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              <SheetHeader title={t('Contar a mão')} onClose={close} closeLabel={t('Fechar')} />
              <Row gap={8} style={{ alignItems: 'flex-start' }}>
                <Ionicons name="mic" size={16} color={C.accent} style={{ marginTop: 2 }} />
                <T v="small" color={C.textDim} style={{ flex: 1 }}>
                  {t('Toca no microfone do teclado e conta a mão como a contarias a um amigo. Também podes escrever.')}
                </T>
              </Row>
              <Field
                value={text}
                onChangeText={change}
                multiline
                autoFocus
                autoCorrect={false}
                accessibilityLabel={t('A mão, por palavras tuas')}
                placeholder={t('Estou no botão com ás rei de copas. O UTG abre para 2500, eu pago. Flop rei sete dois, ele faz bet de 3000, eu pago…')}
                inputStyle={{ minHeight: 120 }}
              />

              {!result.empty && (
                <View style={{ gap: S.md }} accessibilityLiveRegion="polite">
                  <T v="label">{t('O que percebemos')}</T>
                  <Row gap={10} style={{ flexWrap: 'wrap' }}>
                    <View style={{ minWidth: 44, minHeight: 28, paddingHorizontal: 8, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center', backgroundColor: result.posKnown ? posColor(pos[hand.hero]) : C.surface2 }}>
                      <T v="small" color={result.posKnown ? C.bgDeep : C.muted} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                        {pos[hand.hero]}
                      </T>
                    </View>
                    {heroCards.length ? (
                      <Row gap={4}>{heroCards.map((_, i) => card({ k: 'hero', i }))}</Row>
                    ) : (
                      <T v="small" color={C.muted}>
                        {t('Cartas por escolher')}
                      </T>
                    )}
                  </Row>
                  {picker((x) => x.k === 'hero')}
                  {streets.map(({ street, chips }) =>
                    chips.length || boardFor(street).length ? (
                      <View key={street} style={{ gap: 6 }}>
                        <Row gap={8}>
                          <T v="tiny" color={C.accent} style={{ fontWeight: '800', fontFamily: ff(800), letterSpacing: 1 }}>
                            {STREET_LABEL[street].toUpperCase()}
                          </T>
                          <Row gap={4}>{boardFor(street).map((i) => card({ k: 'board', i }))}</Row>
                        </Row>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {chips.filter(said).map((c, i) => (
                            <View key={i} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill, backgroundColor: c.hero ? C.accentSoft : C.surface2, borderWidth: 1, borderColor: c.hero ? C.accentLine : C.border }}>
                              <T v="tiny" color={c.hero ? C.accent : C.text}>
                                {c.label} <T v="tiny" color={C.textDim}>{c.detail}</T>
                              </T>
                            </View>
                          ))}
                        </View>
                        {picker((x) => x.k === 'board' && boardFor(street).includes(x.i))}
                      </View>
                    ) : null,
                  )}
                  {shown.map(({ p, seat }) => (
                    <View key={seat} style={{ gap: 6 }}>
                      <Row gap={8}>
                        <T v="small" style={{ fontWeight: '700', fontFamily: ff(700) }}>
                          {t('{pos} mostra', { pos: pos[seat] })}
                        </T>
                        <Row gap={4}>{p.cards!.map((_, i) => card({ k: 'seat', seat, i }))}</Row>
                      </Row>
                      {picker((x) => x.k === 'seat' && x.seat === seat)}
                    </View>
                  ))}
                  {result.notes.length > 0 && (
                    <View style={{ gap: 6 }}>
                      {[...new Map(result.notes.map((n) => [noteText(n, hand), n])).keys()].map((line) => (
                        <Row key={line} gap={8} style={{ alignItems: 'flex-start' }}>
                          <Ionicons name="alert-circle" size={14} color={C.warn} style={{ marginTop: 2 }} />
                          <T v="tiny" color={C.textDim} style={{ flex: 1 }}>
                            {line}
                          </T>
                        </Row>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <Button title={t('Pôr na mesa')} icon="checkmark" disabled={result.empty} onPress={done} />
              {!result.empty && (
                <T v="tiny" color={C.muted} style={{ textAlign: 'center' }}>
                  {t('Depois corriges o que faltar com toques, como numa mão normal.')}
                </T>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </TapCounted>
    </Modal>
  );
}
