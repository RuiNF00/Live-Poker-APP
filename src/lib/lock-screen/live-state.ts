// What the lock screen shows for a running session (iOS Live Activity,
// Android ongoing notification) and when the next level is due. Pure, so the
// tests run in plain Node and both platforms render the same numbers.

import { t } from '@/i18n';
import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { bbs, chips, timeOf } from '@/poker/format';
import { levelOf } from '@/poker/tourney';
import { isPaused, playedMs } from '@/store/session-math';
import type { Session } from '@/store/types';

/** Level lengths offered on the session screen, in minutes. */
export const LEVEL_LENGTHS = [15, 20, 30, 40, 60] as const;

/**
 * Props sent to the native layouts. Plain JSON: the layouts run in a separate
 * JS runtime and receive these serialized, so dates travel as epoch ms.
 */
export interface LiveProps {
  title: string;
  /** "A jogar" / "Em pausa", already translated. */
  status: string;
  paused: boolean;
  /** Start of the clock with breaks taken out: now - played time. */
  clockFrom: number;
  /** When paused, the moment the clock stopped. 0 when running. */
  pausedAt: number;
  /** "desde 20:14": the Android notification can't run a live clock. */
  since: string;
  /** Played time when these props were made ("2h 05"), for the same reason. */
  played: string;
  stack: string;
  stackBB: string;
  level: string;
  blinds: string;
  /** 0 when no level length is set. */
  nextLevelAt: number;
  nextBlinds: string;
  labels: { time: string; stack: string; next: string; levelUp: string; newHand: string };
}

/** The blinds `dir` levels away from the current ones, on the same ladder the session screen uses. */
export function levelAfter(s: Pick<Session, 'kind' | 'sb' | 'bb' | 'anteType' | 'level' | 'tourney'>, dir: 1 | -1) {
  const level = (s.level ?? 1) + dir > 0 ? (s.level ?? 1) + dir : 1;
  // A tournament with its structure entered: the next row of it, with that level's length.
  const st = s.kind === 'mtt' ? s.tourney?.structure : undefined;
  if (st?.length) {
    const n = Math.min(level, st.length);
    const l = levelOf(st, n);
    return { sb: l.sb, bb: l.bb, ante: l.ante, level: n, levelMinutes: l.minutes };
  }
  const levels = s.kind === 'mtt' ? MTT_LEVELS : CASH_LEVELS;
  const i = levels.findIndex(([sb, bb]) => sb === s.sb && bb === s.bb);
  const j = Math.max(0, Math.min(levels.length - 1, (i < 0 ? 0 : i) + dir));
  const [sb, bb] = levels[j];
  const ante = s.anteType === 'bb' ? bb : s.anteType === 'all' ? Math.round(bb / 8) : 0;
  return { sb, bb, ante, level };
}

/**
 * When the current level ends, or undefined with no level length. Paused time
 * (tournament breaks) pushes it back, like the floor's clock.
 */
export function nextLevelAt(s: Session, now = Date.now()): number | undefined {
  if (!s.levelMinutes || !s.levelStartedAt || s.endedAt) return undefined;
  const from = s.levelStartedAt;
  const paused = (s.breaks ?? []).reduce((a, b) => a + Math.max(0, Math.min(b.end ?? now, now) - Math.max(b.start, from)), 0);
  return from + s.levelMinutes * 60_000 + paused;
}

/**
 * Restart the level clock when the level or blinds change, or when a level
 * length is set for the first time. Every save goes through this, so a level
 * bumped from hand entry resets the clock as well as one bumped on the session screen.
 */
export function withLevelClock(prev: Session | undefined, next: Session, now = Date.now()): Session {
  if (!next.levelMinutes || next.endedAt) return next;
  const changed = !prev || prev.level !== next.level || prev.bb !== next.bb || prev.sb !== next.sb;
  // A start set with the change (synced to the floor's clock) is kept.
  const synced = !!prev && !!next.levelStartedAt && next.levelStartedAt !== prev.levelStartedAt;
  if ((changed && !synced) || !next.levelStartedAt) return { ...next, levelStartedAt: now };
  return next;
}

function hm(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`;
}

/**
 * What the lock screen shows. With privacy mode on (`hideAmounts`), a cash
 * game's stack is money on the table, so it shows ••• there; tournament chips
 * aren't money and stay. The session's name often carries the venue, so
 * privacy mode shows the game instead.
 */
export function liveProps(s: Session, now = Date.now(), hideAmounts = false): LiveProps {
  const paused = isPaused(s);
  const played = playedMs(s, now);
  const mtt = s.kind === 'mtt';
  const next = nextLevelAt(s, now);
  const after = levelAfter(s, 1);
  const hideCash = hideAmounts && !mtt;
  return {
    title: (!hideAmounts && s.name) || (mtt ? t('Torneio') : 'Cash game'),
    status: paused ? t('Em pausa') : t('A jogar'),
    paused,
    clockFrom: now - played,
    pausedAt: paused ? now : 0,
    since: t('desde {time}', { time: timeOf(s.startedAt) }),
    played: hm(played),
    stack: hideCash ? '•••' : chips(s.stack),
    stackBB: hideCash ? '•••' : bbs(s.stack, s.bb),
    level: s.level ? t('Nível {n}', { n: s.level }) : 'Blinds',
    blinds: `${chips(s.sb)}/${chips(s.bb)}`,
    nextLevelAt: next ?? 0,
    nextBlinds: `${chips(after.sb)}/${chips(after.bb)}`,
    labels: {
      time: t('Tempo'),
      stack: 'Stack',
      next: t('Sobe em'),
      levelUp: t('Subir nível'),
      newHand: t('Nova mão'),
    },
  };
}

/** Text of the level-up reminder. */
export function levelUpMessage(s: Session): { title: string; body: string } {
  const after = levelAfter(s, 1);
  return {
    title: t('Subida de nível'),
    body: t('Nível {n}: blinds {blinds}. Toca para atualizar a sessão.', { n: after.level, blinds: `${chips(after.sb)}/${chips(after.bb)}` }),
  };
}
