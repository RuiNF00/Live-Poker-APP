// localStorage helpers that never throw (private mode, blocked storage). Some in-app browsers
// block storage: values then live in memory for the visit, so a typed name isn't asked twice.
const memory = new Map<string, string>();

export function readLocal<T>(key: string): T | null {
  let raw: string | null = memory.get(`lh:${key}`) ?? null;
  try {
    raw = window.localStorage.getItem(`lh:${key}`) ?? raw;
  } catch {}
  try {
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  memory.set(`lh:${key}`, raw);
  try {
    window.localStorage.setItem(`lh:${key}`, raw);
  } catch {}
}

/** Anonymous id so a friend's vote counts once per hand. */
export function voterId(): string {
  let id = readLocal<string>('voterId');
  if (!id) {
    id = randomId();
    writeLocal('voterId', id);
  }
  return id;
}

// crypto.randomUUID is missing in older in-app browsers (iOS before 15.4, older Android WebView).
function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
