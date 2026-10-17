import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { t } from '@/i18n';
import { legal, positions, raiseName, replay, totalPot, type Step } from '@/poker/engine';
import { amount } from '@/poker/format';
import type { Hand, Street } from '@/poker/types';
import { actionColor, actionLabel, displayName, narrate, seatViews } from '@/poker/view';
import { BRAND, C, R, ff } from '@/theme';

import { Table } from './Table';
import { Chip, Row, T, tap } from './ui';

const STREET_PT: Record<Street, string> = { preflop: t('Pré-flop'), flop: 'Flop', turn: 'Turn', river: 'River' };

export function Replayer({
  hand,
  initialInBB = false,
  autoPlay = false,
  compact = false,
  quiz = false,
  onVote,
}: {
  hand: Hand;
  initialInBB?: boolean;
  autoPlay?: boolean;
  compact?: boolean;
  /** Stop before hero's last decision and ask "what do you do?". */
  quiz?: boolean;
  onVote?: (choice: string) => void;
}) {
  const r = useMemo(() => replay(hand), [hand]);
  const steps = r.steps;
  const quizAt = useMemo(() => {
    if (!quiz) return -1;
    for (let k = steps.length - 1; k > 0; k--) if (steps[k].kind === 'action' && steps[k].state.last?.p === hand.hero) return k;
    return -1;
  }, [quiz, steps, hand.hero]);
  const [answered, setAnswered] = useState<string | null>(null);
  const locked = quizAt > 0 && !answered;
  const last = locked ? quizAt - 1 : steps.length - 1;
  const [i, setI] = useState(autoPlay ? 0 : last);
  const [playing, setPlaying] = useState(autoPlay);
  const [inBB, setInBB] = useState(initialInBB);
  const [revealAll, setRevealAll] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setI(autoPlay ? 0 : last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand, autoPlay]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setI((x) => {
        if (x >= last) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, 1100);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, last]);

  const step: Step = steps[Math.min(i, last)];
  const st = step.state;
  const atEnd = !locked && i >= last;
  const isShowdown = step.kind === 'showdown';
  const result = atEnd ? r.result : null;
  const views = seatViews(hand, st, { inBB, reveal: isShowdown || (revealAll && !locked), result, hideActing: !(locked && i === last) });
  if (result) {
    views.forEach((v, k) => {
      v.stack = amount(st.stacks[k] + result.won[k], hand, inBB);
      v.allIn = false;
    });
  }
  const board = hand.board.slice(0, st.boardCount);
  const potNow = atEnd && result ? result.pots.reduce((a, p) => a + p.amount, 0) : totalPot(st);
  const pos = positions(hand.players.length, hand.button);

  const streetStart = (s: Street) => steps.findIndex((x) => x.street === s && (x.kind === 'board' || (s === 'preflop' && x.kind === 'start')));
  const go = (k: number) => {
    tap('select');
    setPlaying(false);
    setI(Math.max(0, Math.min(last, k)));
  };

  const narration = step.kind === 'start' ? 'Blinds' : step.kind === 'board' ? STREET_PT[step.street] : isShowdown ? 'Showdown' : narrate(st.last, hand, inBB);

  // Action log grouped by street.
  const log = steps
    .map((x, k) => ({ x, k }))
    .filter(({ x }) => x.kind === 'action' && x.state.last);

  return (
    <View style={{ gap: 10 }}>
      <Table
        seats={views}
        hero={hand.hero}
        button={hand.button}
        board={board}
        pot={potNow > 0 ? amount(potNow, hand, inBB) : undefined}
        narration={narration}
        watermark={BRAND.name}
      />

      {locked && i === last && (
        <QuizPanel
          state={st}
          onPick={(c) => {
            tap('medium');
            setAnswered(c);
            onVote?.(c);
            setPlaying(true);
          }}
        />
      )}
      {answered ? (
        <T v="small" style={{ textAlign: 'center' }}>
          {t('Tu escolheste')} <T v="small" color={C.accent} style={{ fontWeight: '800', fontFamily: ff(800) }}>{answered}</T>. {t('Vê o que aconteceu ↓')}
        </T>
      ) : null}

      {/* progress */}
      <View style={{ height: 4, backgroundColor: C.surface3, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: `${last ? (i / last) * 100 : 100}%`, height: 4, backgroundColor: C.accent }} />
      </View>

      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={4}>
          <Ctrl icon="play-skip-back" onPress={() => go(0)} />
          <Ctrl icon="chevron-back" onPress={() => go(i - 1)} />
          <Pressable
            onPress={() => {
              tap();
              if (atEnd) setI(0);
              setPlaying((p) => !p);
            }}
            style={{ width: 52, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={playing ? 'pause' : 'play'} size={22} color={C.accentInk} />
          </Pressable>
          <Ctrl icon="chevron-forward" onPress={() => go(i + 1)} />
          <Ctrl icon="play-skip-forward" onPress={() => go(last)} />
        </Row>
        <Row gap={6}>
          <Ctrl icon={revealAll ? 'eye' : 'eye-off'} onPress={() => setRevealAll((x) => !x)} active={revealAll} />
          <Pressable
            onPress={() => setInBB((b) => !b)}
            style={{ height: 36, paddingHorizontal: 10, borderRadius: 18, backgroundColor: inBB ? C.accentSoft : C.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: inBB ? C.accent : C.textDim, fontWeight: '800', fontFamily: ff(800), fontSize: 12 }}>BB</Text>
          </Pressable>
        </Row>
      </Row>

      <Row gap={6}>
        {(['preflop', 'flop', 'turn', 'river'] as Street[]).map((s) => {
          const k = streetStart(s);
          return <Chip key={s} label={STREET_PT[s]} active={step.street === s} onPress={k >= 0 ? () => go(k) : undefined} style={{ opacity: k >= 0 ? 1 : 0.35 }} />;
        })}
      </Row>

      {!compact && !locked && (
        <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 2 }} nestedScrollEnabled>
          {log.map(({ x, k }, idx) => {
            const a = x.state.last!;
            const prevStreet = idx > 0 ? streetOfAction(log[idx - 1].x) : null;
            const thisStreet = streetOfAction(x);
            return (
              <React.Fragment key={k}>
                {thisStreet !== prevStreet && (
                  <T v="label" style={{ marginTop: 8, marginBottom: 2 }}>
                    {STREET_PT[thisStreet]}
                    {thisStreet !== 'preflop' ? '  ' + boardFor(hand, thisStreet) : ''}
                  </T>
                )}
                <Pressable
                  onPress={() => go(k)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 8, borderRadius: R.sm, backgroundColor: k === i ? C.surface3 : 'transparent' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: actionColor(a) }} />
                  <T v="small" style={{ color: a.p === hand.hero ? C.accent : C.text, fontWeight: '700', fontFamily: ff(700), width: 92 }} numberOfLines={1}>
                    {displayName(hand, a.p, pos)}
                  </T>
                  <T v="small" style={{ flex: 1 }}>
                    {actionLabel(a, hand, inBB).toLowerCase()}
                  </T>
                </Pressable>
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function streetOfAction(step: Step): Street {
  return step.actStreet ?? step.street;
}

function boardFor(hand: Hand, s: Street) {
  const n = s === 'flop' ? 3 : s === 'turn' ? 4 : 5;
  const cards = hand.board.slice(s === 'flop' ? 0 : n - 1, n);
  return cards.map((c) => c[0] + ({ s: '♠', h: '♥', d: '♦', c: '♣' } as Record<string, string>)[c[1]]).join(' ');
}

function QuizPanel({ state, onPick }: { state: Step['state']; onPick: (c: string) => void }) {
  const l = legal(state);
  if (!l) return null;
  const opts = [l.canCall ? 'Fold' : null, l.canCheck ? 'Check' : 'Call', l.canBet || l.canRaise ? raiseName(state) : null].filter(Boolean) as string[];
  return (
    <View style={{ backgroundColor: C.accentSoft, borderRadius: R.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,106,61,0.4)' }}>
      <T v="h2" style={{ textAlign: 'center' }}>
        {t('O que fazes aqui?')}
      </T>
      <Row gap={8}>
        {opts.map((o) => (
          <Pressable
            key={o}
            onPress={() => onPick(o)}
            style={({ pressed }) => ({ flex: 1, paddingVertical: 14, borderRadius: R.md, backgroundColor: o === 'Fold' ? C.surface3 : C.accent, alignItems: 'center', opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ color: o === 'Fold' ? C.text : C.accentInk, fontWeight: '800', fontFamily: ff(800), fontSize: 16 }}>{o}</Text>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

function Ctrl({ icon, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: active ? C.accentSoft : C.surface2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={18} color={active ? C.accent : C.text} />
    </Pressable>
  );
}
