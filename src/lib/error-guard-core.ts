// What happens when a tap, a timer or a callback throws (an error no screen's boundary sees).
//
// React Native's default ends the app at once: the hand being entered (written at most every
// 400 ms) and the last edits (written in bursts) could go with it. Once the app is up, the error
// is reported (Sentry wraps this handler), everything waiting is written now, the player is told
// once that their hand and session are kept, and the app stays open. Errors coming one after
// another (the app can't go on) still close it, after the writes. Before the store has loaded,
// in development, for non-fatal errors and for a render error no boundary caught (it carries
// React's componentStack: the screen is gone, so staying open would leave a white screen),
// React Native's own handling runs as before, after the writes.
//
// Pure (what it calls is passed in), so the tests run it in Node.

export const STORM = 4;
export const STORM_MS = 30_000;
/** Time for the writes to land before an app that keeps failing closes. */
export const CLOSE_AFTER_MS = 1500;
export const TELL_EVERY_MS = 10_000;

export interface GuardDeps {
  now: () => number;
  dev: boolean;
  /** React Native's own handler: in a release build, a fatal error closes the app. */
  fallback: (error: unknown, isFatal: boolean) => void;
  /** Writes everything waiting (draft, lists). */
  flush: () => void;
  /** «Algo correu mal… ficou guardado». */
  tell: () => void;
  later: (fn: () => void, ms: number) => void;
}

/** A render error React reported (ReactFiberErrorDialog sets these): the tree it was in is unmounted. */
export function isRenderError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { componentStack?: unknown; isComponentError?: unknown };
  return e.isComponentError === true || (typeof e.componentStack === 'string' && e.componentStack.length > 0);
}

export function makeGuard(d: GuardDeps) {
  let ready = false;
  let recent: number[] = [];
  let told = -Infinity;
  let closing = false;
  const flush = () => {
    try {
      d.flush();
    } catch {
      // Writing is best effort here; the error being handled matters more.
    }
  };
  return {
    setReady(v: boolean) {
      ready = v;
    },
    handle(error: unknown, isFatal = false) {
      if (!ready) return d.fallback(error, isFatal);
      flush();
      if (d.dev || !isFatal || isRenderError(error)) return d.fallback(error, isFatal);
      const at = d.now();
      recent = [...recent.filter((x) => at - x < STORM_MS), at];
      if (recent.length >= STORM) {
        if (!closing) {
          closing = true;
          d.later(() => d.fallback(error, true), CLOSE_AFTER_MS);
        }
        return;
      }
      if (at - told >= TELL_EVERY_MS) {
        told = at;
        try {
          d.tell();
        } catch {
          // Nothing more to do: the data is written.
        }
      }
    },
  };
}
