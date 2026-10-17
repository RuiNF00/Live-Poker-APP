// Local persistence for lists of items (hands, sessions, players). Each item
// is its own AsyncStorage key, plus one small key with the ordered ids.
//
// Why not one JSON array per list (the v1 layout): saving one hand rewrote
// every hand, and on Android a single value over ~2 MB can't be read back at
// all (SQLite CursorWindow), which around 1,500–2,000 hands meant an empty
// app. Per-item keys make a save O(1) and keep every value small.
//
// Pure (storage is passed in) so it can be tested in Node.

export interface KV {
  getItem(key: string): Promise<string | null>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiSet(pairs: [string, string][]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface CollectionSpec {
  /** Key holding the ordered ids, e.g. 'rl.hands.v2'. */
  index: string;
  /** Item key = prefix + id, e.g. 'rl.hand.v2.'. */
  prefix: string;
  /** v1 key with the whole list as one JSON array, migrated then removed. */
  legacy?: string;
}

export interface Loaded<T> {
  items: T[];
  /** What is already on disk in the per-item layout (the writer diffs against it). */
  persisted: T[];
  /** Items or keys that couldn't be read. Nothing on disk is deleted because of them. */
  problems: number;
}

type Item = { id: string; updatedAt?: number };

// Android's multiGet binds one SQL parameter per key; stay well under 999.
const CHUNK = 400;

function chunks<T>(list: T[], n = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

function parseJson(raw: string | null): unknown {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const isItem = (x: unknown): x is Item => !!x && typeof x === 'object' && typeof (x as Item).id === 'string' && (x as Item).id.length > 0;

async function readItems<T extends Item>(kv: KV, spec: CollectionSpec, ids: string[]): Promise<{ items: T[]; problems: number }> {
  const items: T[] = [];
  let problems = 0;
  for (const part of chunks(ids)) {
    const rows = await kv.multiGet(part.map((id) => spec.prefix + id));
    for (const [, raw] of rows) {
      if (raw == null) continue; // removed between index write and now: fine
      const v = parseJson(raw);
      if (isItem(v)) items.push(v as T);
      else problems++;
    }
  }
  return { items, problems };
}

/** Writes the whole list in the per-item layout (items first, index last). */
async function writeAll<T extends Item>(kv: KV, spec: CollectionSpec, items: T[]): Promise<void> {
  for (const part of chunks(items)) await kv.multiSet(part.map((x) => [spec.prefix + x.id, JSON.stringify(x)]));
  await kv.multiSet([[spec.index, JSON.stringify(items.map((x) => x.id))]]);
}

/** Newer updatedAt wins; ties keep `a`. Order: `a` first, then what only `b` has. */
function union<T extends Item>(a: T[], b: T[]): T[] {
  const byId = new Map(a.map((x) => [x.id, x]));
  for (const x of b) {
    const cur = byId.get(x.id);
    if (!cur || (x.updatedAt ?? 0) > (cur.updatedAt ?? 0)) byId.set(x.id, x);
  }
  return [...byId.values()];
}

/**
 * Reads a collection. Never throws and never deletes anything it couldn't
 * read: a corrupt index is rebuilt from the item keys, a corrupt item is
 * skipped (and left on disk), an unreadable v1 value stays where it is.
 */
export async function loadCollection<T extends Item>(kv: KV, spec: CollectionSpec): Promise<Loaded<T>> {
  let items: T[] = [];
  let persisted: T[] = [];
  let problems = 0;

  try {
    const rawIdx = await kv.getItem(spec.index);
    let ids: string[] | null = null;
    if (rawIdx != null) {
      const parsed = parseJson(rawIdx);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) ids = parsed as string[];
      else problems++;
    }
    if (ids === null) {
      // Index missing or broken: rebuild it from whatever item keys exist.
      ids = (await kv.getAllKeys()).filter((k) => k.startsWith(spec.prefix)).map((k) => k.slice(spec.prefix.length));
    }
    if (ids) {
      const r = await readItems<T>(kv, spec, [...new Set(ids)]);
      items = r.items;
      problems += r.problems;
      if (rawIdx == null || problems) items.sort((a, b) => ((b as { createdAt?: number }).createdAt ?? 0) - ((a as { createdAt?: number }).createdAt ?? 0));
      // A rebuilt index isn't on disk yet: leave persisted empty for the index
      // to be rewritten, but the items themselves are already there.
      persisted = rawIdx != null && !problems ? items : [];
    }
  } catch {
    problems++;
  }

  if (spec.legacy) {
    let raw: string | null = null;
    let readable = true;
    try {
      raw = await kv.getItem(spec.legacy);
    } catch {
      readable = false; // e.g. Android "Row too big to fit into CursorWindow"
    }
    if (!readable) problems++;
    else if (raw != null) {
      const v = parseJson(raw);
      if (Array.isArray(v)) {
        items = union(items, v.filter(isItem) as T[]);
        try {
          await writeAll(kv, spec, items);
          persisted = items;
          await kv.multiRemove([spec.legacy]);
        } catch {
          // Disk full or similar: keep v1 as is and try again next launch. The
          // writer will rewrite everything, since persisted is still stale.
        }
      } else problems++;
    }
  }

  return { items, persisted, problems };
}

export interface Diff {
  set: [string, string][];
  remove: string[];
}

/** What to write to go from `prev` to `next`. Items are compared by reference (state is immutable). */
export function diffCollection<T extends Item>(spec: CollectionSpec, prev: T[], next: T[]): Diff {
  const before = new Map(prev.map((x) => [x.id, x]));
  const set: [string, string][] = [];
  for (const x of next) if (before.get(x.id) !== x) set.push([spec.prefix + x.id, JSON.stringify(x)]);
  const nextIds = new Set(next.map((x) => x.id));
  const remove = prev.filter((x) => !nextIds.has(x.id)).map((x) => spec.prefix + x.id);
  const sameOrder = prev.length === next.length && prev.every((x, i) => x.id === next[i].id);
  if (!sameOrder) set.push([spec.index, JSON.stringify(next.map((x) => x.id))]);
  return { set, remove };
}

/**
 * Coalesces rapid changes into one write and never runs two writes at once.
 * A failed write is retried on the next change or flush, and reported once
 * per failure streak through onError.
 */
export function createWriter<T extends Item>(kv: KV, spec: CollectionSpec, persisted: T[], onError: (e: unknown) => void, delay = 250) {
  let written = persisted;
  let latest: T[] = persisted;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> = Promise.resolve();
  let failing = false;

  const run = async () => {
    const next = latest;
    const { set, remove } = diffCollection(spec, written, next);
    if (!set.length && !remove.length) return;
    try {
      // Items before the index, removals after it: a crash in between leaves
      // at worst an orphan key, never an id pointing at nothing.
      for (const part of chunks(set)) await kv.multiSet(part);
      if (remove.length) await kv.multiRemove(remove);
      written = next;
      failing = false;
    } catch (e) {
      if (!failing) onError(e);
      failing = true;
    }
  };

  const flush = (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    running = running.then(run);
    return running;
  };

  return {
    schedule(next: T[]) {
      latest = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
  };
}
