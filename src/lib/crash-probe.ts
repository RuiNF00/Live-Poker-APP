// Lets the crash-survival check make a screen throw on purpose while it
// renders: a hand editor or live session that crashes must keep the player's
// data. Does nothing unless a test sets globalThis.__sweatbookCrash to the
// screen's name. It keeps throwing until the test clears it (React retries a
// failed render once before showing the error screen).

type G = { __sweatbookCrash?: string };

export function crashProbe(where: string): void {
  if ((globalThis as G).__sweatbookCrash === where) throw new Error(`crash probe: ${where}`);
}
