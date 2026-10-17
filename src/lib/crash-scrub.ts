// What a crash report may carry. Reports go to Sentry (EU region) to fix
// crashes, and nothing in them may identify the player or show their poker:
// no user, IP, device name, emails, phone numbers, long texts (notes, hand
// histories), screenshots, or link tokens. Pure, so the tests run it in Node.
// See /mnt/project-files/launch/crash-reporting.md.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 9+ digits with optional separators and a leading +: phone numbers, never a stack line number.
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const LONG = 200;

/** Tags a report may carry; anything else is dropped (never install id, RevenueCat id, names or amounts). */
export const TAGS = ['channel', 'platform', 'locale', 'pro', 'live_session'] as const;
export type CrashTag = (typeof TAGS)[number];

export function scrubString(s: string): string {
  if (s.length > LONG) return `[${s.length} chars removed]`;
  return s.replace(EMAIL, '[email]').replace(PHONE, '[number]');
}

/** A URL without its query and fragment (links carry edit tokens, recovery codes, keys after #). */
export function stripUrl(u: string): string {
  return u.replace(/[?#].*$/, '');
}

function deep(x: unknown, depth = 0): unknown {
  if (typeof x === 'string') return scrubString(x);
  if (depth > 8 || x == null || typeof x !== 'object') return x;
  if (Array.isArray(x)) return x.map((v) => deep(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) out[k] = deep(v, depth + 1);
  return out;
}

type Obj = Record<string, unknown>;

/**
 * Sentry's beforeSend. Stack frames keep their file, function and line (that
 * is what fixes a crash); everything else free-form is filtered.
 */
export function scrubEvent<E extends object>(event: E): E {
  const e: Obj = { ...(event as Obj) };
  delete e.user;
  delete e.server_name;
  if (e.request && typeof e.request === 'object') {
    const r = { ...(e.request as Obj) };
    delete r.cookies;
    delete r.headers;
    delete r.data;
    if (typeof r.url === 'string') r.url = stripUrl(r.url);
    delete r.query_string;
    e.request = r;
  }
  if (e.contexts && typeof e.contexts === 'object') {
    const c = { ...(e.contexts as Obj) };
    if (c.device && typeof c.device === 'object') {
      const d = { ...(c.device as Obj) };
      delete d.name;
      c.device = d;
    }
    e.contexts = c;
  }
  if (e.tags && typeof e.tags === 'object') {
    e.tags = Object.fromEntries(Object.entries(e.tags as Obj).filter(([k]) => (TAGS as readonly string[]).includes(k)));
  }
  if (e.message != null) e.message = deep(e.message);
  if (e.extra != null) e.extra = deep(e.extra);
  if (e.exception && typeof e.exception === 'object') {
    const ex = e.exception as { values?: Obj[] };
    e.exception = { ...ex, values: ex.values?.map((v) => ({ ...v, value: typeof v.value === 'string' ? scrubString(v.value) : v.value })) };
  }
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = (e.breadcrumbs as Obj[]).map((x) => scrubBreadcrumb(x)).filter(Boolean);
  return e as unknown as E;
}

/** Sentry's beforeBreadcrumb: no console lines; network crumbs keep method, path and status only. */
export function scrubBreadcrumb<B extends object>(crumb: B): B | null {
  const b = crumb as Obj;
  if (b.category === 'console') return null;
  const out: Obj = { ...b };
  if (out.message != null) out.message = deep(out.message);
  if (out.data && typeof out.data === 'object') {
    const d = out.data as Obj;
    if (b.category === 'fetch' || b.category === 'xhr' || b.type === 'http') {
      out.data = { method: d.method, url: typeof d.url === 'string' ? stripUrl(d.url) : undefined, status_code: d.status_code };
    } else if (b.category === 'navigation') {
      out.data = { from: typeof d.from === 'string' ? stripUrl(d.from) : undefined, to: typeof d.to === 'string' ? stripUrl(d.to) : undefined };
    } else {
      out.data = deep(d);
    }
  }
  return out as unknown as B;
}
