// Things to send when there's signal. Card rooms often have none: an event, a
// pending invite or any other small request is kept on the phone and sent on
// its own when the connection is back, with growing pauses between tries.
//
// Pure core (storage, clock and senders are passed in) so it can be tested.

export interface Job {
  id: string;
  kind: string;
  /** Jobs with the same kind and key replace each other (only the latest matters). */
  key?: string;
  payload: unknown;
  tries: number;
  nextAt: number;
  createdAt: number;
}

/** done: sent. retry: try again later. drop: will never work, forget it. */
export type Outcome = 'done' | 'retry' | 'drop';
export type Sender = (payload: unknown) => Promise<Outcome>;

export interface OutboxStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const MAX_JOBS = 300;
export const MAX_TRIES = 25;
export const MAX_AGE_MS = 14 * 86400000;

export function backoff(tries: number): number {
  return Math.min(10 * 60000, 5000 * 2 ** Math.max(0, tries - 1));
}

export function createOutbox(kv: OutboxStorage, senders: Record<string, Sender>, opts: { key?: string; now?: () => number } = {}) {
  const KEY = opts.key ?? 'rl.outbox.v1';
  const now = opts.now ?? Date.now;
  let jobs: Job[] | null = null;
  let loading: Promise<Job[]> | null = null;
  let draining: Promise<void> | null = null;
  const listeners = new Set<(n: number) => void>();
  let seq = 0;

  const load = (): Promise<Job[]> => {
    if (jobs) return Promise.resolve(jobs);
    loading ??= kv
      .getItem(KEY)
      .then((raw) => {
        const v = raw ? (JSON.parse(raw) as unknown) : [];
        return Array.isArray(v) ? (v as Job[]) : [];
      })
      .catch(() => [] as Job[])
      .then((list) => {
        // Anything enqueued while we were reading goes after what was on disk.
        jobs = [...list, ...(jobs ?? [])];
        return jobs;
      });
    return loading;
  };

  const save = async () => {
    for (const l of listeners) l(jobs?.length ?? 0);
    await kv.setItem(KEY, JSON.stringify(jobs ?? [])).catch(() => {});
  };

  const api = {
    async enqueue(kind: string, payload: unknown, key?: string) {
      const list = await load();
      const t = now();
      const job: Job = { id: `${t.toString(36)}${(seq++).toString(36)}`, kind, key, payload, tries: 0, nextAt: t, createdAt: t };
      const i = key === undefined ? -1 : list.findIndex((j) => j.kind === kind && j.key === key);
      if (i >= 0) list[i] = job;
      else list.push(job);
      if (list.length > MAX_JOBS) list.splice(0, list.length - MAX_JOBS); // oldest go first
      await save();
    },

    /** Sends every job that is due, one at a time. Stops at the first network failure. */
    drain(force = false): Promise<void> {
      draining ??= (async () => {
        const list = await load();
        let changed = false;
        for (const job of [...list]) {
          const t = now();
          if (t - job.createdAt > MAX_AGE_MS || job.tries >= MAX_TRIES || !senders[job.kind]) {
            list.splice(list.indexOf(job), 1);
            changed = true;
            continue;
          }
          if (!force && job.nextAt > t) continue;
          let out: Outcome;
          try {
            out = await senders[job.kind](job.payload);
          } catch {
            out = 'retry';
          }
          const at = list.indexOf(job);
          if (out === 'retry') {
            if (at >= 0) list[at] = { ...job, tries: job.tries + 1, nextAt: now() + backoff(job.tries + 1) };
            changed = true;
            break; // the network is probably down; don't hammer it with the rest
          }
          if (at >= 0) list.splice(at, 1);
          changed = true;
        }
        if (changed) await save();
      })().finally(() => {
        draining = null;
      });
      return draining;
    },

    async size(): Promise<number> {
      return (await load()).length;
    },

    /** Earliest time a job is due, or null when empty. */
    async nextDue(): Promise<number | null> {
      const list = await load();
      return list.length ? Math.min(...list.map((j) => j.nextAt)) : null;
    },

    subscribe(l: (n: number) => void): () => void {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
  return api;
}

export type Outbox = ReturnType<typeof createOutbox>;
