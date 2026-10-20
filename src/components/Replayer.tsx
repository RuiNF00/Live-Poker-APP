import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { useLocked } from '@/components/ProGate';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { legal, raiseName, replay } from '@/poker/engine';
import { pct } from '@/poker/format';
import { topClasses } from '@/poker/ranges';
import type { Hand, Street } from '@/poker/types';
import { C, F, R, ff } from '@/theme';

import { STAGE_RATIO } from './replayer/layout';
import { timeline, viewAt, type TimelineItem } from './replayer/model';
import { useReduceMotion } from './replayer/motion';
import { RangeSheet } from './replayer/RangeSheet';
import { ReplayerTable } from './replayer/ReplayerTable';
import { Scrubber } from './replayer/Scrubber';
import { motionTimeline } from './replayer/timeline';
import { tap } from './ui';

// Only drawn when the player turns ICM on: loaded then, not at launch.
const IcmPanel = React.lazy(() => import('./replayer/IcmPanel').then((m) => ({ default: m.IcmPanel })));

const SPEEDS = [1, 1.5, 2, 0.5];
// v2: shown once more to everyone when swiping between streets arrived.
const TIPS_KEY = 'sweatbook.replayer.tips.v2';
const NAMES_KEY = 'sweatbook.replayer.hideNames.v1';
const SPEED_KEY = 'sweatbook.replayer.speed.v1';
/** Hands whose replay was already counted this app session (replay_opened fires once per hand). */
const counted = new Set<string>();

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
  playToQuiz = false,
  onVote,
  onStreet,
  seek,
  streetNotes,
  source,
  icm = false,
  onInBB,
}: {
  hand: Hand;
  /** Where the hand came from, for the replay_opened event. Previews (welcome) pass nothing and aren't counted. */
  source?: 'own' | 'sample' | 'shared';
  initialInBB?: boolean;
  autoPlay?: boolean;
  /** Called when the player switches chips/BB, so the next hand opens the same way. */
  onInBB?: (inBB: boolean) => void;
  /** Tournament hands: the ICM estimate (Settings, off by default). */
  icm?: boolean;
  /** Kept for callers; the timeline replaces the old action list. */
  compact?: boolean;
  /** Stop before hero's last decision and ask "what do you do?". */
  quiz?: boolean;
  /** With quiz and autoPlay: play from preflop up to hero's decision, then ask (first run). */
  playToQuiz?: boolean;
  onVote?: (choice: string) => void;
  /** Called with the street on screen whenever it changes (comments mark "you are here"). */
  onStreet?: (street: Street) => void;
  /** Jump to the start of a street; bump `n` to jump again to the same one. */
  seek?: { street: Street; n: number };
  /** The player's private note on each street, shown while that street is on screen. */
  streetNotes?: Partial<Record<Street, string>>;
}) {
  // The felt is as tall as its width allows: on a wide window (a tablet on its side) it would run
  // past the screen, so it stops at 70% of the height. Phones held upright never reach it.
  const maxW = (useWindowDimensions().height * 0.7) / STAGE_RATIO;
  const r = useMemo(() => replay(hand), [hand]);
  useEffect(() => {
    const key = `${source}:${hand.id}`;
    if (!source || counted.has(key)) return;
    counted.add(key);
    track('replay_opened', { source });
  }, [source, hand.id]);
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
  // The first run plays up to the decision instead: the question lands after the story so far.
  const start = (locked && !playToQuiz) || !autoPlay ? last : 0;
  const [i, setI] = useState(start);
  const [playing, setPlaying] = useState(autoPlay && (!locked || playToQuiz));
  const [inBB, setInBB] = useState(initialInBB);
  const [reveal, setReveal] = useState(false);
  const [speed, setSpeed] = useState(0);
  // The playback speed is a habit, not a per-hand choice: it stays for the next hand.
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(SPEED_KEY)
      .then((v) => {
        const n = Number(v);
        if (live && v != null && n >= 0 && n < SPEEDS.length) setSpeed(n);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const nextSpeed = () => {
    const n = (speed + 1) % SPEEDS.length;
    setSpeed(n);
    AsyncStorage.setItem(SPEED_KEY, String(n)).catch(() => {});
  };

  useEffect(() => {
    setI(start);
    setPlaying(autoPlay && (!locked || playToQuiz));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand, autoPlay]);

  const k = Math.min(i, last);
  const atEnd = !locked && k >= steps.length - 1;

  // Playback stops by itself at the last step it may show.
  // One timeline for the replayer and the Story/reel export: how long each step holds, what moves.
  const reduceMotion = useReduceMotion();
  const motion = useMemo(() => motionTimeline(hand, r, { reduce: reduceMotion }), [hand, r, reduceMotion]);
  // A step plays its animations only when reached going forward.
  const [came, setCame] = useState({ k, from: k });
  if (came.k !== k) setCame({ k, from: came.k });
  const forward = came.k === k && came.from < k;
  const running = playing && k < last;
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setI((x) => Math.min(x + 1, last)), motion[k].ms / SPEEDS[speed]);
    return () => clearTimeout(id);
  }, [running, k, last, motion, speed]);

  // A card being dealt is felt as well as seen: one firm tap per new street.
  const prevK = useRef(k);
  useEffect(() => {
    if (k > prevK.current && (steps[k]?.kind === 'board' || steps[k]?.kind === 'showdown')) tap('medium');
    prevK.current = k;
  }, [k, steps]);

  // First open: a tip right where the controls are, gone after the first tap or "Percebi".
  const [tips, setTips] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(TIPS_KEY)
      // A replay that plays by itself (the welcome screen, the sample hand) needs no tip yet.
      .then((v) => live && !v && !autoPlay && setTips(true))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [autoPlay]);
  const doneTips = () => {
    if (!tips) return;
    setTips(false);
    AsyncStorage.setItem(TIPS_KEY, '1').catch(() => {});
  };

  const street = steps[k]?.street ?? 'preflop';
  useEffect(() => {
    onStreet?.(street);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street]);
  const note = streetNotes?.[street]?.trim();

  // Names off for a screenshot or a screen share: every player shows as their position, hero as "Hero".
  const named = hand.players.some((p) => p.name);
  const [hideNames, setHideNames] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(NAMES_KEY)
      .then((v) => live && v === '1' && setHideNames(true))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const toggleNames = () => {
    tap('select');
    AsyncStorage.setItem(NAMES_KEY, hideNames ? '0' : '1').catch(() => {});
    setHideNames(!hideNames);
  };
  const shown = useMemo(() => (hideNames && named ? { ...hand, players: hand.players.map((p) => ({ ...p, name: '' })) } : hand), [hand, hideNames, named]);

  // The villain range the player drew (Pro); null = the one read from villain's preflop raises.
  const [range, setRange] = useState<string[] | null>(null);
  const [rangeSheet, setRangeSheet] = useState<string[] | null>(null);
  const rangeLocked = useLocked('villainRange');
  const { paywall } = usePro();
  const view = useMemo(() => viewAt(shown, r, k, { inBB, reveal: reveal && !locked, atEnd, range }), [shown, r, k, inBB, reveal, locked, atEnd, range]);
  // Screen readers hear every step as it happens, not only the cards: "Vilão no BTN faz raise para 3 BB",
  // "Flop: Ás de copas, 7 de paus, 2 de ouros", then who wins. The focus stays on the button pressed.
  const said = useRef(k);
  useEffect(() => {
    if (said.current === k) return;
    said.current = k;
    if (view.spoken) AccessibilityInfo.announceForAccessibility(view.spoken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  const editRange = () => {
    if (!view.rangeEq) return;
    tap('select');
    const open = () => setRangeSheet(range ?? topClasses(view.rangeEq!.pct));
    if (rangeLocked) return paywall('villainRange', open);
    open();
  };
  const items = useMemo(() => timeline(shown, r, inBB), [shown, r, inBB]);

  const go = (to: number) => {
    doneTips();
    tap('select');
    setPlaying(false);
    setI(Math.max(0, Math.min(last, to)));
  };
  // A street tapped outside the replayer (in the comments).
  useEffect(() => {
    if (!seek) return;
    const at = steps.findIndex((s) => s.street === seek.street && (s.kind === 'start' || s.kind === 'board'));
    if (at >= 0 && at <= last) go(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seek?.n]);
  // From the result (where a saved hand opens), "next street" starts the hand again from preflop.
  const nextStreet = () => {
    if (k >= last) return go(locked ? last : 0);
    const n = steps.findIndex((s, j) => j > k && (s.kind === 'board' || s.kind === 'showdown'));
    go(n < 0 ? last : n);
  };
  // Back to the start of this street, or of the one before when already there.
  const prevStreet = () => {
    let n = 0;
    steps.forEach((s, j) => {
      if (j < k && (s.kind === 'start' || s.kind === 'board' || s.kind === 'showdown')) n = j;
    });
    go(n);
  };
  const togglePlay = () => {
    tap();
    if (k >= last) {
      setI(0);
      setPlaying(true);
    } else setPlaying(!running);
  };
  // On a computer (the web build): arrows step, space plays, like a video.
  const keys = useRef({ step: (_: number) => {}, play: () => {} });
  useEffect(() => {
    keys.current = { step: (d) => go(k + d), play: () => togglePlay() };
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') keys.current.step(1);
      else if (e.key === 'ArrowLeft') keys.current.step(-1);
      else if (e.key === ' ') keys.current.play();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center' }}>
        <ReplayerTable animate motion={forward ? motion[k] : undefined} view={view} heroIndex={hand.hero} button={hand.button} onTapLeft={() => go(k - 1)} onTapRight={() => go(k + 1)} onSwipe={locked ? undefined : (d) => (d > 0 ? nextStreet() : prevStreet())} />
      </View>

      {locked && k === last ? (
        <QuizPanel
          state={steps[k].state}
          onPick={(c) => {
            tap('medium');
            setAnswered(c);
            AccessibilityInfo.announceForAccessibility(`${t('Tu escolheste')} ${c}. ${t('Vê o que aconteceu.')}`);
            onVote?.(c);
            setPlaying(true);
          }}
        />
      ) : (
        <InfoBar view={view} onRange={editRange} rangeLocked={rangeLocked} />
      )}
      {view.rangeEq ? (
        <RangeSheet
          visible={!!rangeSheet}
          initial={rangeSheet ?? []}
          hero={view.rangeEq.hero}
          board={view.rangeEq.board}
          onClose={() => setRangeSheet(null)}
          onApply={(c) => {
            setRange(c);
            setRangeSheet(null);
          }}
        />
      ) : null}
      {note ? (
        <View accessibilityLabel={`${t('Nota privada')}: ${note}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
          <Ionicons name="lock-closed" size={13} color={C.textDim} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, color: C.text, fontFamily: F.regular, fontSize: 13, lineHeight: 18 }}>{note}</Text>
        </View>
      ) : null}
      {icm && hand.game.kind === 'mtt' && !locked && hand.players.length >= 2 ? <React.Suspense fallback={null}><IcmPanel hand={hand} facing={view.facing} /></React.Suspense> : null}
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
          onPress={togglePlay}
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
        <Ctrl text={`${SPEEDS[speed]}×`} label={`${t('Velocidade')} ${SPEEDS[speed]}×`} onPress={nextSpeed} />
        <Ctrl text={inBB ? 'BB' : '#'} label={inBB ? t('Ver em fichas') : t('Ver em BB')} active={inBB} onPress={() => {
            setInBB(!inBB);
            onInBB?.(!inBB);
          }} />
        <Ctrl icon={reveal ? 'eye' : 'eye-off'} label={t('Mostrar cartas')} active={reveal} toggle onPress={() => setReveal((x) => !x)} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Scrubber
            k={k}
            last={last}
            items={items}
            onSeek={(to) => {
              doneTips();
              setPlaying(false);
              setI(to);
            }}
          />
        </View>
        {/* Step counter, like a video's time: the scrubber already says it to screen readers. */}
        <Text importantForAccessibility="no-hide-descendants" accessibilityElementsHidden maxFontSizeMultiplier={1.3} style={{ minWidth: 40, textAlign: 'right', color: C.textDim, fontFamily: F.mono, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {k + 1}/{last + 1}
        </Text>
        {named ? (
          <View style={{ width: 52, flexDirection: 'row' }}>
            <Ctrl icon={hideNames ? 'person-outline' : 'person'} label={hideNames ? t('Mostrar nomes') : t('Esconder nomes')} active={hideNames} onPress={toggleNames} />
          </View>
        ) : null}
      </View>

      {/* Not on a preview (the welcome screen's sample has no source): it has no room there and nothing to learn yet. */}
      {tips && !locked && source ? <TipBubble onClose={doneTips} /> : null}
      <Timeline items={items} current={k} last={last} onPick={go} />
    </View>
  );
}

/** First-open coach mark: how to move through a hand, shown once, in place. */
function TipBubble({ onClose }: { onClose: () => void }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: R.md,
        backgroundColor: 'rgba(255,106,61,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,106,61,0.45)',
        paddingVertical: 9,
        paddingLeft: 12,
        paddingRight: 6,
      }}>
      <Ionicons name="hand-left-outline" size={18} color={C.accent} />
      <Text style={{ flex: 1, color: C.text, fontFamily: F.regular, fontSize: 13, lineHeight: 18 }}>
        {t('Toca à direita da mesa para avançar e à esquerda para recuar. Desliza na mesa para mudar de street.')}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Fechar')} onPress={onClose} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
        <Text style={{ color: C.accent, fontFamily: ff(700), fontSize: 13 }}>{t('Percebi')}</Text>
      </Pressable>
    </View>
  );
}

/** "Hero facing" bar when hero has a decision (pot odds, MDF), otherwise pot and stacks. */
function InfoBar({ view, onRange, rangeLocked }: { view: ReturnType<typeof viewAt>; onRange: () => void; rangeLocked: boolean }) {
  const f = view.facing;
  return (
    <View
      style={{
        minHeight: 36,
        borderRadius: R.md,
        backgroundColor: '#0E0D0B',
        borderWidth: 1,
        borderColor: f || view.decision || view.heroBet ? 'rgba(255,106,61,0.45)' : C.border,
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
          <Stat label={t('Pot odds')} value={pct(f.potOdds, 1)} color={C.info} />
          <Stat label="MDF" value={pct(f.mdf)} color="#A78BFA" />
          <Stat label="Bet" value={pct(f.betPct)} color={C.text} />
          <Stat label="V:B" value={ratio(f.vb)} color={C.warn} />
          {view.rangeEq ? <RangeEq eq={view.rangeEq} onPress={onRange} locked={rangeLocked} /> : null}
          <Text numberOfLines={1} style={{ color: C.textDim, fontFamily: F.mono, fontSize: 11 }}>
            {view.info}
          </Text>
        </>
      ) : view.heroBet ? (
        <>
          <Text style={{ color: C.accent, fontFamily: ff(800), fontSize: 12, letterSpacing: 0.6 }}>
            {t('HERO FAZ BET')}
            <Text style={{ color: C.textDim, fontFamily: F.medium, letterSpacing: 0 }}> {pct(view.heroBet.pct)} {t('do pote')}</Text>
          </Text>
          <Stat label="Bluff BE" value={pct(view.heroBet.bluffBE, 1)} color={C.accent} />
          <Stat label="V:B" value={ratio(view.heroBet.vb)} color={C.warn} />
          <Text style={{ color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>
            {view.heroBet.vs}: {t('pot odds')} <Text style={{ color: C.info, fontFamily: F.mono, fontSize: 13 }}>{pct(view.heroBet.vsPotOdds, 1)}</Text> · MDF{' '}
            <Text style={{ color: '#A78BFA', fontFamily: F.mono, fontSize: 13 }}>{pct(view.heroBet.vsMdf)}</Text>
          </Text>
          <Text numberOfLines={1} style={{ color: C.textDim, fontFamily: F.mono, fontSize: 11 }}>
            {view.info}
          </Text>
        </>
      ) : view.decision ? (
        <>
          <Text style={{ color: C.accent, fontFamily: ff(800), fontSize: 12, letterSpacing: 0.6 }}>
            {t('HERO A DECIDIR')}
            <Text style={{ color: C.textDim, fontFamily: F.medium, letterSpacing: 0 }}> · {view.decision}</Text>
          </Text>
          <Text numberOfLines={1} style={{ color: C.textDim, fontFamily: F.mono, fontSize: 11 }}>
            {view.info}
          </Text>
          {view.rangeEq ? <RangeEq eq={view.rangeEq} onPress={onRange} locked={rangeLocked} /> : null}
        </>
      ) : (
        <>
          <Text numberOfLines={view.board2 || view.end ? 2 : 1} style={{ flexShrink: 1, color: view.end ? C.good : C.text, fontFamily: ff(700), fontSize: 13 }}>
            {view.narration}
          </Text>
          <Text numberOfLines={1} style={{ color: C.textDim, fontFamily: F.mono, fontSize: 11 }}>
            {view.info}
          </Text>
          {view.rangeEq ? <RangeEq eq={view.rangeEq} onPress={onRange} locked={rangeLocked} /> : null}
        </>
      )}
    </View>
  );
}

/** Hero's equity against villain's range, e.g. "Equity 54%" and a chip "vs top 20% ›" that opens the range to edit. */
function RangeEq({ eq, onPress, locked }: { eq: NonNullable<ReturnType<typeof viewAt>['rangeEq']>; onPress: () => void; locked: boolean }) {
  const vs = eq.custom ? `${t('vs a tua range')} ${pct(eq.pct / 100, 1)}` : `${t('vs top')} ${eq.pct}%`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>
        Equity <Text style={{ color: C.good, fontFamily: F.mono, fontSize: 13 }}>{pct(eq.equity)}</Text>
      </Text>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${vs}. ${t('Editar a range do vilão')}${locked ? ', Pro' : ''}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill, borderWidth: 1, borderColor: C.border, backgroundColor: pressed ? C.surface3 : C.surface2 })}>
        <Text style={{ color: C.text, fontFamily: F.medium, fontSize: 12 }}>{vs}</Text>
        {locked ? <Ionicons name="lock-closed" size={11} color={C.accent} /> : null}
        <Ionicons name="chevron-forward" size={11} color={C.textDim} />
      </Pressable>
    </View>
  );
}

/** Value:bluff as "2.3:1". */
function ratio(x: number): string {
  return `${pct(x / 100, 1).replace('%', '')}:1`;
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
  const reduce = useReduceMotion();
  const at = Math.max(
    0,
    items.reduce((best, it, idx) => (it.k <= current ? idx : best), 0),
  );
  useEffect(() => {
    if (w) ref.current?.scrollTo({ x: Math.max(0, at * ITEM_W - w / 2 + ITEM_W / 2), animated: !reduce });
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
            accessibilityLabel={it.spoken}
            accessibilityState={{ selected: on }}
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
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color: street ? (on ? C.accent : '#B0A892') : on ? C.text : C.textDim, fontFamily: street ? ff(800) : F.medium, fontSize: 10, letterSpacing: street && it.kind !== 'end' ? 0.8 : 0 }}>
              {it.label}
            </Text>
            {it.detail ? (
              <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color: DOT[it.color], fontFamily: F.mono, fontSize: 10 }}>
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
            accessibilityRole="button"
            onPress={() => onPick(o)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 14,
              borderRadius: R.md,
              backgroundColor: o === 'Fold' ? C.surface3 : C.accent,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}>
            <Text maxFontSizeMultiplier={1.6} numberOfLines={1} adjustsFontSizeToFit style={{ color: o === 'Fold' ? C.text : C.accentInk, fontFamily: ff(800), fontSize: 16 }}>{o}</Text>
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
  toggle,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  text?: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  /** The label stays the same and `active` says whether it's on (read as "selected"). */
  toggle?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={toggle ? { selected: !!active } : undefined}
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
      {icon ? <Ionicons name={icon} size={18} color={active ? C.accent : C.text} /> : <Text maxFontSizeMultiplier={1.5} style={{ color: active ? C.accent : C.text, fontFamily: F.mono, fontSize: 12 }}>{text}</Text>}
    </Pressable>
  );
}
