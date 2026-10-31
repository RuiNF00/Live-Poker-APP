// What the lock screen shows for a running session (iOS Live Activity,
// Android ongoing notification) and when the next level is due. Pure, so the
// tests run in plain Node and both platforms render the same numbers.

import { t } from '@/i18n';
import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { bbs, chips, timeOf } from '@/poker/format';
import { levelOf, nextBreak, type NextBreak } from '@/poker/tourney';
import type { GameInfo } from '@/poker/types';
import { isPLO } from '@/poker/variant';
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
  /** "PLO" when the session's last hand was Omaha, '' for hold'em. Not translated, like blindsLabel. */
  game: string;
  /** The level label with the game in front ("PLO · Nível 3", or "PLO" with no level); `level` for hold'em. */
  gameLevel: string;
  /** 0 when no level length is set. */
  nextLevelAt: number;
  /** When the current level began, breaks taken out (so it pairs with nextLevelAt for the level bar); 0 with no level clock. */
  levelFrom: number;
  nextBlinds: string;
  /** "Intervalo às 21:40 · 15 min" from the structure, '' when none is known. */
  breakAt: string;
  /** A tournament's chip-count story ("Partilhar stack"), one tap from the lock screen; '' for cash. */
  shareUrl: string;
  /** Pause or resume, and a rebuy (cash) or re-entry (tournament), one tap from the lock screen: see lockAction. */
  pauseUrl: string;
  rebuyUrl: string;
  endUrl: string;
  /**
   * The buttons act without opening the app (iOS LiveActivityIntent, Android notification button).
   * Only with no app lock known to be on: otherwise they open the app, which asks for the lock first.
   */
  inPlace: boolean;
  /** Button targets for the in-place actions: "pause:<id>", read back by parseTarget. */
  pauseTarget: string;
  labels: { time: string; stack: string; blinds: string; next: string; levelUp: string; newHand: string; nextBlinds: string; shareStack: string; pause: string; rebuy: string; end: string };
}

/** The blinds `dir` levels away from the current ones, on the same ladder the session screen uses. */
/**
 * A cash game named after its stakes («NLH 2/5», «2/5 Casino») follows them when the blinds move, so
 * the title on the session, the lock screen and the backers' link doesn't keep saying «2/5» at 5/10.
 * Any other name, or one with other numbers, is left as typed. Undefined when nothing changes.
 */
export function nameForStakes(name: string | undefined, from: { sb: number; bb: number }, to: { sb: number; bb: number }): string | undefined {
  if (!name || (from.sb === to.sb && from.bb === to.bb)) return undefined;
  const num = (n: number) => String(n).replace('.', '[.,]');
  // Not part of longer numbers or of a mix like «1/2/5»: those blinds aren't these stakes.
  const re = new RegExp(`(?<![\\d.,/])${num(from.sb)}\\s*/\\s*${num(from.bb)}(?![\\d.,]|\\s*/)`);
  const m = name.match(re);
  if (!m) return undefined;
  const comma = m[0].includes(',');
  const show = (n: number) => (comma ? String(n).replace('.', ',') : String(n));
  return name.replace(re, `${show(to.sb)}/${show(to.bb)}`);
}

export function levelAfter(s: Pick<Session, 'kind' | 'sb' | 'bb' | 'anteType' | 'level' | 'tourney'> & { name?: string }, dir: 1 | -1) {
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
  // Blinds off the ladder (2/4, 150/300): up is the next bigger big blind, down the next smaller one.
  const off = dir > 0 ? levels.findIndex(([, bb]) => bb > s.bb) : levels.findLastIndex(([, bb]) => bb < s.bb);
  const j = i >= 0 ? i + dir : off;
  // Above the top rung (50/100, a deep tournament) «+» doubles; below the bottom one «−» stays put.
  // Never a step the wrong way: 50/100 «+» fell to the top rung (25/50) and 0.5/1 «−» rose to 1/2.
  const [sb, bb] = j >= 0 && j < levels.length ? levels[j] : !(s.bb > 0) ? levels[0] : dir > 0 ? [s.sb * 2, s.bb * 2] : [s.sb, s.bb];
  const ante = s.anteType === 'bb' ? bb : s.anteType === 'all' ? Math.round(bb / 8) : 0;
  // Cash has stakes, not levels: moving up from 1/2 to 2/5 is no «Nível 2».
  const name = s.kind === 'cash' ? nameForStakes(s.name, s, { sb, bb }) : undefined;
  return { sb, bb, ante, level: s.kind === 'mtt' ? level : undefined, ...(name !== undefined ? { name } : null) };
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
 * A tournament whose level clock ran out moves up by itself: one level per
 * elapsed length (several if the app was away), each starting when the last
 * one ended, so the clock stays on the floor's time. Null when nothing is due.
 */
export function levelsDue(s: Session, now = Date.now()): Partial<Session> | null {
  if (s.kind !== 'mtt') return null;
  let cur: Session = s;
  // Enough for a whole day of 5-minute levels; the bound only stops a broken clock looping.
  for (let i = 0; i < 300; i++) {
    const at = nextLevelAt(cur, now);
    if (at === undefined || at > now) break;
    cur = { ...cur, ...levelAfter(cur, 1), levelStartedAt: at };
  }
  return cur === s ? null : { sb: cur.sb, bb: cur.bb, ante: cur.ante, level: cur.level, levelMinutes: cur.levelMinutes, levelStartedAt: cur.levelStartedAt };
}

/**
 * The session as its level clock says it is now. Only the session screen saves the levels that
 * came due; back after hours on another tab, the lock screen and the reminder use this, not the
 * level the app was left on (whose reminder has already gone by).
 */
export function caughtUp(s: Session, now = Date.now()): Session {
  const due = levelsDue(s, now);
  return due ? { ...s, ...due } : s;
}

/** The next break on a tournament's structure, timed from the level clock; null without one. */
export function breakOf(s: Session, now = Date.now()): NextBreak | null {
  if (s.kind !== 'mtt') return null;
  const end = nextLevelAt(s, now);
  return end === undefined ? null : nextBreak(s.tourney?.structure, s.level ?? 1, end);
}

/** "Intervalo às 21:40 · 15 min", or "Intervalo agora" while it should be on. */
export function breakLabel(b: NextBreak | null, now = Date.now()): string {
  if (!b) return '';
  if (b.at <= now && now < b.at + b.minutes * 60_000) return t('Intervalo agora · {n} min', { n: b.minutes });
  return t('Intervalo às {time} · {n} min', { time: timeOf(b.at), n: b.minutes });
}

/**
 * Restart the level clock when the level or blinds change, or when a level
 * length is set for the first time. Every save goes through this, so a level
 * bumped from hand entry resets the clock as well as one bumped on the session screen.
 */
export function withLevelClock(prev: Session | undefined, next: Session, now = Date.now()): Session {
  if (!next.levelMinutes || next.endedAt) return next;
  const changed = !prev || prev.level !== next.level || prev.bb !== next.bb || prev.sb !== next.sb;
  // A start set with the change (synced to the floor's clock), or set on a new session (a festival event's published start), is kept.
  const synced = !!next.levelStartedAt && (!prev || next.levelStartedAt !== prev.levelStartedAt);
  if ((changed && !synced) || !next.levelStartedAt) return { ...next, levelStartedAt: now };
  return next;
}

function hm(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`;
}

type HandGame = { sessionId?: string; createdAt: number; game: Pick<GameInfo, 'variant'> };

/**
 * Whether the session is played as PLO: its latest hand says so. The game belongs to the table, and a
 * new hand at the same table carries it (newHand), so the last hand is enough; no hands yet, hold'em.
 */
export function sessionPLO(hands: readonly HandGame[], sessionId: string): boolean {
  let last: HandGame | undefined;
  for (const h of hands) if (h.sessionId === sessionId && (!last || h.createdAt > last.createdAt)) last = h;
  return !!last && isPLO(last.game);
}

/**
 * What the lock screen shows. With privacy mode on (`hideAmounts`), a cash
 * game's stack is money on the table, so it shows ••• there; tournament chips
 * aren't money and stay. The session's name often carries the venue, so
 * privacy mode shows the game instead.
 */
export function liveProps(s: Session, now = Date.now(), hideAmounts = false, inPlace = false, plo = false): LiveProps {
  const paused = isPaused(s);
  const played = playedMs(s, now);
  const mtt = s.kind === 'mtt';
  const next = nextLevelAt(s, now);
  const after = levelAfter(s, 1);
  const hideCash = hideAmounts && !mtt;
  const level = s.level ? t('Nível {n}', { n: s.level }) : 'Blinds';
  const game = plo ? 'PLO' : '';
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
    level,
    blinds: `${chips(s.sb)}/${chips(s.bb)}`,
    game,
    gameLevel: !game ? level : s.level ? `${game} · ${level}` : game,
    nextLevelAt: next ?? 0,
    levelFrom: next && s.levelMinutes ? next - s.levelMinutes * 60_000 : 0,
    nextBlinds: `${chips(after.sb)}/${chips(after.bb)}`,
    breakAt: breakLabel(breakOf(s, now), now),
    shareUrl: mtt ? `sweatbook://session-card/${encodeURIComponent(s.id)}?stack=1` : '',
    pauseUrl: `sweatbook://session?do=${paused ? 'resume' : 'pause'}&id=${encodeURIComponent(s.id)}`,
    rebuyUrl: `sweatbook://session?do=rebuy&id=${encodeURIComponent(s.id)}`,
    // Ending needs the cash-out or the prize, so it always opens the app, on the end form.
    endUrl: `sweatbook://session?do=end&id=${encodeURIComponent(s.id)}`,
    inPlace,
    pauseTarget: `${paused ? 'resume' : 'pause'}:${s.id}`,
    labels: {
      time: t('Tempo'),
      stack: 'Stack',
      blinds: 'Blinds',
      next: t('Sobe em'),
      levelUp: t('Subir nível'),
      newHand: t('Nova mão'),
      nextBlinds: t('Blinds seguintes'),
      shareStack: t('Partilhar stack'),
      pause: paused ? t('Retomar') : t('Pausa'),
      rebuy: mtt ? 'Re-entry' : 'Rebuy',
      end: t('Terminar sessão'),
    },
  };
}

/**
 * What a lock-screen button can do in place (no app open): pause and resume only. A rebuy moves
 * money, so it opens the app, where it comes with «Anular»; 'end' opens the end form.
 */
export type InPlaceAction = 'pause' | 'resume';
export type LockAction = InPlaceAction | 'rebuy' | 'end';

/**
 * The action a lock-screen button asked for, if it still applies: same session (not one the
 * lock screen showed before), and a pause only when running, a resume only when paused, so a
 * tap on an out-of-date banner never does the opposite. The session screen runs it only once
 * the app lock (if any) is open.
 */
export function lockAction(what: string | undefined, id: string | undefined, s: Session): LockAction | null {
  if (!id || id !== s.id || s.endedAt) return null;
  if (what === 'rebuy') return 'rebuy';
  if (what === 'end') return 'end';
  if (what === 'pause') return isPaused(s) ? null : 'pause';
  if (what === 'resume') return isPaused(s) ? 'resume' : null;
  return null;
}

/**
 * Android 13+ shows the running session on the lock screen only once notifications are allowed,
 * and a cash player is never asked for them otherwise: ask once per running session, Android only.
 */
export function askForLockScreen(os: string, s: Pick<Session, 'id' | 'endedAt'>, asked: Set<string>): boolean {
  if (os !== 'android' || s.endedAt || asked.has(s.id)) return false;
  asked.add(s.id);
  return true;
}

/** The session notification the soft ask previews: the same title and line Android shows. */
export function sessionNoticePreview(s: Session, now = Date.now(), hideAmounts = false): { title: string; body: string } {
  const p = liveProps(s, now, hideAmounts);
  return { title: p.title, body: `${p.status} · ${p.stack} · ${p.blinds}` };
}

/** "pause:<id>" from a lock-screen button back into the action and the session id. */
export function parseTarget(target: string): { what: string; id: string } {
  const i = target.indexOf(':');
  return i < 0 ? { what: target, id: '' } : { what: target.slice(0, i), id: target.slice(i + 1) };
}

/** What a pause or resume from the lock screen changes, the same as the session screen's button. */
export function lockActionPatch(s: Session, a: InPlaceAction, now = Date.now()): Partial<Session> {
  if (a === 'pause') return { breaks: [...s.breaks, { start: now }] };
  return { breaks: s.breaks.map((b, i) => (i === s.breaks.length - 1 && !b.end ? { ...b, end: now } : b)) };
}

/** Text of the level-up reminder. */
export function levelUpMessage(s: Session, now = Date.now()): { title: string; body: string } {
  const after = levelAfter(s, 1);
  const b = breakOf(s, now);
  // The level ending now is followed by a break: pausing the session keeps the level clock on the floor's time.
  if (b && b.afterLevel === (s.level ?? 1)) {
    return {
      title: t('Intervalo de {n} min', { n: b.minutes }),
      body: t('Põe a sessão em pausa. Depois do intervalo, nível {n}: blinds {blinds}.', { n: after.level ?? (s.level ?? 1) + 1, blinds: `${chips(after.sb)}/${chips(after.bb)}` }),
    };
  }
  return {
    title: t('Subida de nível'),
    // Cash has no level number: just the blinds.
    body:
      after.level === undefined
        ? t('Blinds {blinds}. Toca para atualizar a sessão.', { blinds: `${chips(after.sb)}/${chips(after.bb)}` })
        : t('Nível {n}: blinds {blinds}. Toca para atualizar a sessão.', { n: after.level, blinds: `${chips(after.sb)}/${chips(after.bb)}` }),
  };
}

/** Text of the call back to the table near the end of a break. */
export function breakEndMessage(s: Session, b: NextBreak): { title: string; body: string } {
  const l = s.tourney?.structure?.[b.afterLevel];
  return {
    title: t('O intervalo está a acabar'),
    body: l ? t('Recomeça daqui a 2 min com o nível {n}: blinds {blinds}. Retoma a sessão.', { n: b.afterLevel + 1, blinds: `${chips(l.sb)}/${chips(l.bb)}` }) : t('Recomeça daqui a 2 min. Retoma a sessão.'),
  };
}
