// A request with no signal of its own gets a time limit. On a card room's one
// bar of signal a fetch can otherwise hang forever, leaving a spinner that
// never ends (share, comments, cloud backup). With a limit it fails like any
// other network error and each screen shows its usual "no connection" path.

type Fetch = typeof fetch;

export const TIMEOUT_MS = 20000;
/** Uploads (the story video) are big; give them longer. */
export const UPLOAD_TIMEOUT_MS = 120000;

export function withTimeout(base: Fetch, ms = TIMEOUT_MS, uploadMs = UPLOAD_TIMEOUT_MS): Fetch {
  const wrapped = (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    if (init?.signal || typeof AbortController === 'undefined') return base(input, init);
    const ctrl = new AbortController();
    const upload = typeof FormData !== 'undefined' && init?.body instanceof FormData;
    const id = setTimeout(() => ctrl.abort(), upload ? uploadMs : ms);
    return base(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
  };
  return wrapped as Fetch;
}

/**
 * A signal for big transfers (cloud backup up and down, up to 2 MB): on one bar
 * of signal they take far longer than the default limit, which would fail them
 * every time. Passing it also opts the request out of the default limit.
 */
export function longSignal(ms = UPLOAD_TIMEOUT_MS): AbortSignal | undefined {
  if (typeof AbortController === 'undefined') return undefined;
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

let installed = false;
/** Once, at startup. */
export function installFetchTimeout() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  globalThis.fetch = withTimeout(globalThis.fetch.bind(globalThis));
}

/**
 * The server said 429 (too many requests): it was reached, so this is not "Sem ligação". Our
 * request helpers throw `'<what> <status>'` ('upload 429', 'live 429'), a bare status, or 'rate_limited'.
 */
export function isRateLimited(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : '';
  return msg === 'rate_limited' || /(^|\s)429$/.test(msg) || (e as { status?: unknown } | null)?.status === 429;
}
