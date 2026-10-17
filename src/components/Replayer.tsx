import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { t } from '@/i18n';
import { legal, raiseName, replay } from '@/poker/engine';
import type { Hand } from '@/poker/types';
import { C, F, R, ff } from '@/theme';

import { timeline, viewAt, type TimelineItem } from './replayer/model';
import { ReplayerTable } from './replayer/ReplayerTable';
import { tap } from './ui';

const SPEEDS = [1, 1.5, 2, 0.5];
const BASE_MS = 1100;

/**
 * Hand replayer, built for a phone held upright. Visual and interaction base:
 * the stats-app replayer (charcoal felt, ivory cards, chip stacks, a badge per
 * player, a "hero facing" bar with pot odds, and a tappable action timeline).
 * Tap the right of the table to step forward, the left to step back.
 */
export function Replayer({
  hand,
  initialInBB = true,
  autoPlay = false,
  quiz = false,
  onVote,
}: {
  hand: Hand;
  initialInBB?: boolean;
  autoPlay?: boolean;
  /** Kept for callers; the timeline replaces the old action list. */
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
  // A challenge opens straight on hero's decision; a saved hand opens on its result.
  const start = locked || !autoPlay ? last : 0;
  const [i, setI] = useState(start);
  const [playing, setPlaying] = useState(autoPlay && !locked);
  const [inBB, setInBB] = useState(initialInBB);
  const [reveal, setReveal] = useState(false);
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    setI(start);
    setPlaying(autoPlay && !locked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand, autoPlay]);

  const k = Math.min(i, last);
  const atEnd = !locked && k >= steps.length - 1;

  // Playback stops by itself at the last step it may show.
  const running = playing && k < last;
  useEffect(() => {
    if (!running) return;
    // A new street gets a beat longer, like a dealer burning and turning.
    const pause = steps[k + 1]?.kind === 'board' ? 1.4 : 1;
    const id = setTimeout(() => setI((x) => Math.min(x + 1, last)), (BASE_MS * pause) / SPEEDS[speed]);
    return () => clearTimeout(id);
  }, [running, k, last, steps, speed]);

  const view = useMemo(() => viewAt(hand, r, k, { inBB, reveal: reveal && !locked, atEnd }), [hand, r, k, inBB, reveal, locked, atEnd]);
  const items = useMemo(() => timeline(hand, r, inBB), [hand, r, inBB]);

  const go = (to: number) => {
    tap('select');
    setPlaying(false);
    setI(Math.max(0, Math.min(last, to)));
  };
  const nextStreet = () => {
    const n = steps.findIndex((s, j) => j > k && (s.kind === 'board' || s.kind === 'showdown'));
    go(n < 0 ? last : n);
  };

  return (
    <View style={{ gap: 8 }}>
      <ReplayerTable view={view} heroIndex={hand.hero} button={hand.button} onTapLeft={() => go(k - 1)} onTapRight={() => go(k + 1)} />

      {locked && k === last ? (
        <QuizPanel
          state={steps[k].state}
          onPick={(c) => {
            tap('medium');
            setAnswered(c);
            onVote?.(c);
            setPlaying(true);
          }}
        />
      ) : (
        <InfoBar view={view} />
      )}
      {answered ? (
        <Text style={{ textAlign: 'center', color: C.textDim, fontFamily: F.regular, fontSize: 13 }}>
          {t('Tu escolheste')} <Text style={{ color: C.accent, fontFamily: ff(800) }}>{answered}</Text>. {t('Vê o que aconteceu.')}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ctrl icon="play-skip-back" label={t('Início')} onPress={() => go(0)} />
        <Ctrl icon="chevron-back" label={t('Anterior')} onPress={() => go(k - 1)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? t('Pausa') : t('Reproduzir')}
          onPress={() => {
            tap();
            if (k >= last) {
              setI(0);
              setPlaying(true);
            } else setPlaying(!running);
          }}
          style={({ pressed }) => ({
            flex: 1.3,
            height: 46,
            borderRadius: R.md,
            backgroundColor: 'rgba(255,106,61,0.16)',
            borderWidth: 1,
            borderColor: 'rgba(255,106,61,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}>
          <Ionicons name={running ? 'pause' : atEnd ? 'refresh' : 'play'} size={22} color={C.accent} />
        </Pressable>
        <Ctrl icon="chevron-forward" label={t('Seguinte')} onPress={() => go(k + 1)} />
        <Ctrl icon="play-forward" label={t('Próxima street')} onPress={nextStreet} />
        <Ctrl text={`${SPEEDS[speed]}×`} label={t('Velocidade')} onPress={() => setSpeed((s) => (s + 1) % SPEEDS.length)} />
        <Ctrl text={inBB ? 'BB' : '#'} label={inBB ? t('Ver em fichas') : t('Ver em BB')} active={inBB} onPress={() => setInBB((b) => !b)} />
        <Ctrl icon={reveal ? 'eye' : 'eye-off'} label={t('Mostrar cartas')} active={reveal} onPress={() => setReveal((x) => !x)} />
      </View>

      <Timeline items={items} current={k} last={last} onPick={go} />
    </View>
  );
}

/** "Hero facing" bar when hero has a decision (pot odds, MDF), otherwise pot and stacks. */
function InfoBar({ view }: { view: ReturnType<typeof viewAt> }) {
  const f = view.facing;
  return (
    <View
      style={{
        minHeight: 36,
        borderRadius: R.md,
        backgroundColor: '#0E0D0B',
        borderWidth: 1,
        borderColor: f ? 'rgba(255,106,61,0.45)' : C.border,
        paddingHorizontal: 12,
        paddingVertical: 7,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        columnGap: 12,
        rowGap: 2,
      }}>
      {f ? (
        <>
          <Text style={{ color: C.accent, fontFamily: ff(800), fontSize: 12, letterSpacing: 0.6 }}>
            {t('HERO A DECIDIR')}
            {f.vs ? <Text style={{ color: C.textDim, fontFamily: F.medium, letterSpacing: 0 }}> vs {f.vs}</Text> : null}
          </Text>
          <Stat label="Call" value={f.toCall} color={C.good} />
          <Stat label={t('Pot odds')} value={`${(f.potOdds * 100).toFixed(1)}%`} color={C.info} />
          <Stat label="MDF" value={`${Math.round(f.mdf * 100)}%`} color="#A78BFA" />
          {view.rangeEq ? <RangeEq eq={view.rangeEq} /> : null}
        </>
      ) : (
        <>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: view.end ? C.good : C.text, fontFamily: ff(700), fontSize: 13 }}>
            {view.narration}
          </Text>
          <Text numberOfLines={1} style={{ color: C.textDim, fontFamily: F.mono, fontSize: 11 }}>
            {view.info}
          </Text>
          {view.rangeEq ? <RangeEq eq={view.rangeEq} /> : null}
        </>
      )}
    </View>
  );
}

/** Hero's equity against the range villain's preflop action suggests, e.g. "Equity 54% vs top 20%". */
function RangeEq({ eq }: { eq: { equity: number; pct: number } }) {
  return (
    <Text style={{ color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>
      Equity <Text style={{ color: C.good, fontFamily: F.mono, fontSize: 13 }}>{Math.round(eq.equity * 100)}%</Text> {t('vs top')} {eq.pct}%
    </Text>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Text style={{ color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>
      {label} <Text style={{ color, fontFamily: F.mono, fontSize: 13 }}>{value}</Text>
    </Text>
  );
}

const DOT: Record<TimelineItem['color'], string> = {
  hero: C.accent,
  aggr: '#F39C12',
  passive: '#2ECC71',
  fold: '#6B7280',
  street: '#F5EDD8',
};
const ITEM_W = 62;

/** Every action as a dot on a line, streets as diamonds: tap any of them to jump there. */
function Timeline({ items, current, last, onPick }: { items: TimelineItem[]; current: number; last: number; onPick: (k: number) => void }) {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [w, setW] = useState(0);
  const at = Math.max(
    0,
    items.reduce((best, it, idx) => (it.k <= current ? idx : best), 0),
  );
  useEffect(() => {
    if (w) ref.current?.scrollTo({ x: Math.max(0, at * ITEM_W - w / 2 + ITEM_W / 2), animated: true });
  }, [at, w]);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      contentContainerStyle={{ paddingVertical: 4 }}>
      <View style={{ position: 'absolute', left: ITEM_W / 2, right: ITEM_W / 2, top: 4 + 9, height: 2, backgroundColor: C.surface3 }} />
      <View style={{ position: 'absolute', left: ITEM_W / 2, width: at * ITEM_W, top: 4 + 9, height: 2, backgroundColor: 'rgba(255,106,61,0.6)' }} />
      {items.map((it, idx) => {
        const future = it.k > last;
        const on = idx === at;
        const street = it.kind !== 'action';
        return (
          <Pressable
            key={it.k + it.kind}
            disabled={future}
            onPress={() => onPick(it.k)}
            accessibilityRole="button"
            accessibilityLabel={`${it.label} ${it.detail ?? ''}`}
            style={{ width: ITEM_W, alignItems: 'center', opacity: future ? 0.25 : idx > at ? 0.55 : 1 }}>
            <View style={{ height: 20, justifyContent: 'center' }}>
              <View
                style={{
                  width: street ? 11 : on ? 14 : 9,
                  height: street ? 11 : on ? 14 : 9,
                  borderRadius: street ? 2 : 7,
                  transform: street ? [{ rotate: '45deg' }] : undefined,
                  backgroundColor: street ? (on ? C.accent : '#2A2620') : DOT[it.color],
                  borderWidth: on ? 2 : street ? 1 : 0,
                  borderColor: on ? '#FFF' : '#7A7260',
                }}
              />
            </View>
            <Text numberOfLines={1} style={{ color: street ? (on ? C.accent : '#B0A892') : on ? C.text : C.textDim, fontFamily: street ? ff(800) : F.medium, fontSize: 10, letterSpacing: street ? 0.8 : 0 }}>
              {it.label}
            </Text>
            {it.detail ? (
              <Text numberOfLines={1} style={{ color: DOT[it.color], fontFamily: F.mono, fontSize: 10 }}>
                {it.detail}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function QuizPanel({ state, onPick }: { state: ReturnType<typeof replay>['steps'][number]['state']; onPick: (c: string) => void }) {
  const l = legal(state);
  if (!l) return null;
  const opts = [l.canCall ? 'Fold' : null, l.canCheck ? 'Check' : 'Call', l.canBet || l.canRaise ? raiseName(state) : null].filter(Boolean) as string[];
  return (
    <View style={{ backgroundColor: '#14100D', borderRadius: R.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,106,61,0.5)' }}>
      <Text style={{ color: C.text, fontFamily: ff(800), fontSize: 18, textAlign: 'center' }}>{t('O que fazes aqui?')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {opts.map((o) => (
          <Pressable
            key={o}
            onPress={() => onPick(o)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 14,
              borderRadius: R.md,
              backgroundColor: o === 'Fold' ? C.surface3 : C.accent,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}>
            <Text style={{ color: o === 'Fold' ? C.text : C.accentInk, fontFamily: ff(800), fontSize: 16 }}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Ctrl({
  icon,
  text,
  label,
  onPress,
  active,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  text?: string;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 46,
        borderRadius: R.md,
        backgroundColor: active ? C.accentSoft : '#141210',
        borderWidth: 1,
        borderColor: active ? 'rgba(255,106,61,0.45)' : '#2A2620',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}>
      {icon ? <Ionicons name={icon} size={18} color={active ? C.accent : C.text} /> : <Text style={{ color: active ? C.accent : C.text, fontFamily: F.mono, fontSize: 12 }}>{text}</Text>}
    </Pressable>
  );
}
