// What the store reads at launch, and what it does with values it can't use.
//
// Launch must survive whatever is on the phone: data from every earlier
// version of the app, an update interrupted half-way, a value cut short by a
// full disk. Nothing unreadable is handed to a screen and nothing is deleted
// unread: each bad value is first copied to a quarantine key
// (rl.quarantine.v1.<when>.<original key>), and only then removed from where
// it would be read again or overwritten. The store tells the player once.
//
// Pure (storage is passed in) so the launch tests run it in Node.

import type { Hand } from '@/poker/types';

import type { BackedPlayer, Backer, BackerPayment, Bankroll, PlayerNote, Session, Settings, StakePackage, Transfer, Trip } from './types';
import { loadCollection, type CollectionSpec, type KV, type Loaded } from './persist';
import { fixBacked, fixHand, fixItem, fixPlayer, fixSession, fixSettings, fixTrip } from './validate';

export const KEYS = {
  settings: 'rl.settings.v1',
  draft: 'rl.draft.v1',
};

export const SPECS = {
  hands: { index: 'rl.hands.v2', prefix: 'rl.hand.v2.', legacy: 'rl.hands.v1' },
  sessions: { index: 'rl.sessions.v2', prefix: 'rl.session.v2.', legacy: 'rl.sessions.v1' },
  players: { index: 'rl.players.v2', prefix: 'rl.player.v2.', legacy: 'rl.players.v1' },
  bankrolls: { index: 'rl.bankrolls.v2', prefix: 'rl.bankroll.v2.' },
  transfers: { index: 'rl.transfers.v2', prefix: 'rl.transfer.v2.' },
  backers: { index: 'rl.backers.v1', prefix: 'rl.backer.v1.' },
  packages: { index: 'rl.packages.v1', prefix: 'rl.package.v1.' },
  payments: { index: 'rl.payments.v1', prefix: 'rl.payment.v1.' },
  trips: { index: 'rl.trips.v1', prefix: 'rl.trip.v1.' },
  backing: { index: 'rl.backing.v1', prefix: 'rl.backed.v1.' },
} satisfies Record<string, CollectionSpec>;

export const QUARANTINE = 'rl.quarantine.v1.';

export interface Boot {
  hands: Loaded<Hand>;
  sessions: Loaded<Session>;
  players: Loaded<PlayerNote>;
  bankrolls: Loaded<Bankroll>;
  transfers: Loaded<Transfer>;
  backers: Loaded<Backer>;
  packages: Loaded<StakePackage>;
  payments: Loaded<BackerPayment>;
  trips: Loaded<Trip>;
  backing: Loaded<BackedPlayer>;
  /** Over the defaults, every field of the right type. */
  settings: Settings;
  draft: Hand | null;
  /** Values moved to quarantine on this launch: the player is told when > 0. */
  quarantined: number;
  /** Values that couldn't even be read (kept where they are). */
  unreadable: number;
  ms: number;
}

/** A plain value (settings, draft): the parsed value, or `bad` when it isn't JSON. */
async function readValue(kv: KV, key: string): Promise<{ raw: string | null; value: unknown; bad: boolean; unreadable: boolean }> {
  let raw: string | null;
  try {
    raw = await kv.getItem(key);
  } catch {
    return { raw: null, value: undefined, bad: false, unreadable: true };
  }
  if (raw == null || raw === '') return { raw, value: undefined, bad: false, unreadable: false };
  try {
    return { raw, value: JSON.parse(raw), bad: false, unreadable: false };
  } catch {
    return { raw, value: undefined, bad: true, unreadable: false };
  }
}

/**
 * Copies each bad value to quarantine, then removes the original. If the copy
 * can't be written, the original stays put and is tried again next launch.
 * Returns how many were moved.
 */
export async function quarantine(kv: KV, bad: [string, string][], now = Date.now()): Promise<number> {
  if (!bad.length) return 0;
  const unique = [...new Map(bad).entries()];
  try {
    await kv.multiSet(unique.map(([k, raw]) => [`${QUARANTINE}${now}.${k}`, raw]));
  } catch {
    return 0;
  }
  await kv.multiRemove(unique.map(([k]) => k)).catch(() => {});
  return unique.length;
}

export async function loadAll(kv: KV, now = Date.now()): Promise<Boot> {
  const t0 = Date.now();
  const [hands, sessions, players, bankrolls, transfers, backers, packages, payments, trips, backing, rawSettings, rawDraft] = await Promise.all([
    loadCollection<Hand>(kv, SPECS.hands, { fix: fixHand }),
    loadCollection<Session>(kv, SPECS.sessions, { fix: fixSession }),
    loadCollection<PlayerNote>(kv, SPECS.players, { fix: fixPlayer }),
    loadCollection<Bankroll>(kv, SPECS.bankrolls, { fix: fixItem }),
    loadCollection<Transfer>(kv, SPECS.transfers, { fix: fixItem }),
    loadCollection<Backer>(kv, SPECS.backers, { fix: fixItem }),
    loadCollection<StakePackage>(kv, SPECS.packages, { fix: fixItem }),
    loadCollection<BackerPayment>(kv, SPECS.payments, { fix: fixItem }),
    loadCollection<Trip>(kv, SPECS.trips, { fix: fixTrip }),
    loadCollection<BackedPlayer>(kv, SPECS.backing, { fix: fixBacked }),
    readValue(kv, KEYS.settings),
    readValue(kv, KEYS.draft),
  ]);
  const lists = [hands, sessions, players, bankrolls, transfers, backers, packages, payments, trips, backing];
  const bad: [string, string][] = lists.flatMap((l) => l.bad);

  // Settings are written back right after launch, so a bad copy must be kept first.
  const st = fixSettings(rawSettings.value);
  if ((rawSettings.bad || st.bad) && rawSettings.raw != null) bad.push([KEYS.settings, rawSettings.raw]);

  let draft: Hand | null = null;
  if (rawDraft.value != null) draft = fixHand(rawDraft.value);
  if ((rawDraft.bad || (rawDraft.value != null && !draft)) && rawDraft.raw != null) bad.push([KEYS.draft, rawDraft.raw]);

  const quarantined = await quarantine(kv, bad, now);
  const problems = lists.reduce((n, l) => n + l.problems, 0);
  return {
    hands,
    sessions,
    players,
    bankrolls,
    transfers,
    backers,
    packages,
    payments,
    trips,
    backing,
    settings: st.settings,
    draft,
    quarantined,
    unreadable: Math.max(0, problems - lists.reduce((n, l) => n + l.bad.length, 0)) + Number(rawSettings.unreadable) + Number(rawDraft.unreadable),
    ms: Date.now() - t0,
  };
}
