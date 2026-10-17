// Are we online? Learned from what our own requests do, not from a native
// module (works the same in Expo Go): any answer from a server means online,
// a request that can't reach anyone means offline. While offline, a light
// probe checks again every so often, so queued work goes out as soon as the
// signal is back.

type Listener = (online: boolean) => void;

let online = true;
const listeners = new Set<Listener>();

export function isOnline(): boolean {
  return online;
}

/** Called with the outcome of each request (see observeFetch). */
export function reportNetwork(ok: boolean) {
  if (ok === online) return;
  online = ok;
  for (const l of [...listeners]) l(ok);
}

export function subscribeOnline(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Runs `cb` each time the connection comes back. */
export function onReconnect(cb: () => void): () => void {
  return subscribeOnline((ok) => {
    if (ok) cb();
  });
}

/** A fetch error that means "couldn't reach the server" (not a 4xx/5xx, not a caller's abort). */
function unreachable(e: unknown, init?: RequestInit): boolean {
  if (init?.signal?.aborted && init.signal.reason !== undefined && (init.signal.reason as Error)?.name !== 'AbortError') return false;
  return e instanceof TypeError || (e as Error)?.name === 'AbortError';
}

type Fetch = typeof fetch;

/** Wraps fetch so every request tells us whether the network works. */
export function observeFetch(base: Fetch): Fetch {
  const wrapped = (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) =>
    base(input, init).then(
      (res) => {
        reportNetwork(true);
        return res;
      },
      (e: unknown) => {
        if (unreachable(e, init)) reportNetwork(false);
        throw e;
      },
    );
  return wrapped as Fetch;
}

let probeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * While offline, ask `url` (any answer, even a 404, means online) every
 * `everyMs`. Call again when the app comes to the foreground for a check now.
 */
export function probeWhileOffline(url: string, everyMs = 15000) {
  if (online) return;
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = null;
  fetch(url, { method: 'HEAD', cache: 'no-store' })
    .then(() => reportNetwork(true))
    .catch(() => {
      if (!online) probeTimer = setTimeout(() => probeWhileOffline(url, everyMs), everyMs);
    });
}
