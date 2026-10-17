// localStorage helpers that never throw (private mode, blocked storage).
export function readLocal<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`lh:${key}`);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(`lh:${key}`, JSON.stringify(value));
  } catch {}
}

/** Anonymous id so a friend's vote counts once per hand. */
export function voterId(): string {
  let id = readLocal<string>('voterId');
  if (!id) {
    id = crypto.randomUUID();
    writeLocal('voterId', id);
  }
  return id;
}
