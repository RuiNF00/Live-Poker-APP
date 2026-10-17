// Where features register how to delete their own copies on "Delete all my
// data". Kept apart from erase-all so registering at launch doesn't load the
// whole delete path (cloud crypto, documents, voice notes) before the first screen.

type Eraser = () => void | Promise<void>;
const erasers = new Set<Eraser>();

/**
 * A feature with its own public copy or local cache registers how to delete it.
 * Server deletes should be queued (see sync.queue), never awaited on the network.
 */
export function onEraseAll(fn: Eraser): () => void {
  erasers.add(fn);
  return () => erasers.delete(fn);
}

/** Runs every registered eraser; one failing doesn't stop the rest. */
export async function runErasers() {
  for (const fn of erasers) await Promise.resolve(fn()).catch(() => {});
}
