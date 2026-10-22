// One place for the notification rules in design/notificacoes.md: the kinds
// (one Android channel and one Settings switch each), the quiet hours, holding
// what isn't the session's while a session is live, one unrequested notice a
// day, and the iOS budget of 64 pending. Pure, so it can be tested; every
// scheduler asks here before it schedules.

import type { Settings } from '@/store/types';

export type NotifyKind = 'levels' | 'festival' | 'money' | 'coach' | 'comments' | 'recap' | 'billing' | 'week' | 'tips';

export interface KindInfo {
  kind: NotifyKind;
  /** Android channel id. Existing ids stay as they are, or the system keeps the old channel. */
  channel: string;
  /** Channel and Settings row name (PT-PT key for t()). */
  name: string;
  importance: 'high' | 'default' | 'low';
  /** Contents hidden on a locked phone (money). */
  private?: boolean;
  /** The player asked for it at this time: no quiet hours, never held. */
  requested?: boolean;
  /**
   * iOS interruption level. Time-sensitive breaks through Focus, so only what the
   * player set a time for; passive arrives without sound or lighting the screen.
   */
  interruption: 'timeSensitive' | 'active' | 'passive';
}

export const KINDS: readonly KindInfo[] = [
  { kind: 'levels', channel: 'level-up', name: 'Níveis e intervalos', importance: 'high', requested: true, interruption: 'timeSensitive' },
  { kind: 'festival', channel: 'festival', name: 'Torneios planeados', importance: 'high', requested: true, interruption: 'timeSensitive' },
  { kind: 'money', channel: 'money', name: 'Swaps e staking', importance: 'default', private: true, interruption: 'active' },
  { kind: 'coach', channel: 'coach', name: 'Comentários do coach', importance: 'default', interruption: 'active' },
  // A push from the server (lib/comment-push), which keeps the quiet hours itself.
  { kind: 'comments', channel: 'comments', name: 'Comentários nas tuas mãos', importance: 'default', interruption: 'active' },
  { kind: 'recap', channel: 'recap', name: 'Resumo do mês', importance: 'default', interruption: 'active' },
  { kind: 'billing', channel: 'billing', name: 'Subscrição', importance: 'default', interruption: 'active' },
  { kind: 'week', channel: 'week', name: 'A tua semana', importance: 'low', interruption: 'passive' },
  { kind: 'tips', channel: 'tips', name: 'Lembretes', importance: 'low', interruption: 'passive' },
];

export const kindInfo = (k: NotifyKind): KindInfo => KINDS.find((x) => x.kind === k)!;

/** The ongoing session notification's channel; not a switch (it is the session itself). */
export const SESSION_CHANNEL = 'session-live';

/** Kinds with a switch in Settings › Notificações. The notice before a charge has none: it protects the player. */
export const SWITCHABLE: readonly NotifyKind[] = ['levels', 'festival', 'money', 'coach', 'comments', 'recap', 'week', 'tips'];

/** Is this kind on in Settings? Everything is on until turned off; billing always is. */
export function kindOn(s: Pick<Settings, 'notify' | 'monthRecap'>, k: NotifyKind): boolean {
  if (k === 'billing') return true;
  if (k === 'recap' && s.monthRecap === false) return false;
  // New in the 1st update: whoever had turned "Lembretes" off doesn't get it either.
  if (k === 'week' && s.notify?.week === undefined) return s.notify?.tips !== false;
  return s.notify?.[k] !== false;
}

/** Quiet hours for what the player didn't set a time for: 23:00 to 12:00 local. */
export const QUIET_FROM = 23;
export const QUIET_TO = 12;

/** Moves `at` out of the quiet hours to the next 12:00; requested kinds keep their time. */
export function outOfQuiet(at: number, k: NotifyKind): number {
  if (kindInfo(k).requested || k === 'billing') return at;
  const d = new Date(at);
  const h = d.getHours();
  if (h >= QUIET_TO && h < QUIET_FROM) return at;
  const out = new Date(at);
  if (h >= QUIET_FROM) out.setDate(out.getDate() + 1);
  out.setHours(QUIET_TO, 0, 0, 0);
  return out.getTime();
}

/**
 * Wait for the end of the live session? Only what belongs to the session
 * (levels, breaks, planned tournaments) goes out during one, unless the player
 * turned "Silenciar durante a sessão" off. A paused session lets them out.
 */
export function holdNow(k: NotifyKind, live: { paused: boolean } | null, s: Pick<Settings, 'notifyHoldInSession'>): boolean {
  if (!live || live.paused) return false;
  if (kindInfo(k).requested || k === 'billing') return false;
  return s.notifyHoldInSession !== false;
}

/** Unrequested notices that share the one-a-day cap, most important first. */
export const DAILY_PRIORITY: readonly string[] = ['settle', 'recap', 'trial-day', 'comeback'];

/** Of several unrequested notices for the same day, the one that goes out. */
export function pickDaily<T extends { id: string; at: number }>(list: T[]): T[] {
  const byDay = new Map<string, T>();
  const rank = (x: T) => {
    const i = DAILY_PRIORITY.findIndex((p) => x.id.startsWith(p));
    return i < 0 ? DAILY_PRIORITY.length : i;
  };
  for (const x of list) {
    const d = new Date(x.at);
    const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const cur = byDay.get(day);
    if (!cur || rank(x) < rank(cur)) byDay.set(day, x);
  }
  return [...byDay.values()].sort((a, b) => a.at - b.at);
}

/** iOS keeps at most 64 pending local notifications per app: each owner stays inside its share. */
export const IOS_BUDGET = { festival: 40, levels: 4, billing: 3, recap: 1, money: 8, spare: 8 } as const;

/** After "Agora não" on the ask before the system prompt, don't ask again anywhere for this long. */
export const SOFT_ASK_COOLDOWN = 30 * 86_400_000;

export const softAskAllowed = (lastNo: number | null, now = Date.now()) => lastNo == null || now - lastNo >= SOFT_ASK_COOLDOWN;

/**
 * Notifications just went from refused or not asked to allowed (the ask before the system
 * prompt, or back from the phone's settings). What was planned before that answer found no
 * permission and scheduled nothing: it is planned again. Null: not known yet.
 */
export const becameAllowed = (was: boolean | null, now: boolean) => now && was === false;

/** How many times the session summary may ask, and from which closed session the second time. */
export const SUMMARY_ASKS_MAX = 2;
export const SUMMARY_SECOND_ASK_FROM = 3;
/** The summary asks only right after the session ends, not when opened again from the history. */
export const SUMMARY_ASK_WITHIN = 15 * 60_000;

/**
 * Ask for notifications on the session summary? The first time right after the
 * first saved session, with the Sunday notice as the example; once more from the
 * third, if the first answer was "Agora não". Never with "A tua semana" switched
 * off: the example would be a notice they turned off. The 30 days after "Agora
 * não" and a refusal in the system are checked by the sheet (NotifySoftAsk).
 */
export function askOnSummary(p: { closed: number; asks: number; weekOn: boolean; endedAt?: number; now: number }): boolean {
  if (!p.weekOn || !p.endedAt || p.now - p.endedAt > SUMMARY_ASK_WITHIN) return false;
  if (p.asks <= 0) return p.closed >= 1;
  return p.asks < SUMMARY_ASKS_MAX && p.closed >= SUMMARY_SECOND_ASK_FROM;
}
