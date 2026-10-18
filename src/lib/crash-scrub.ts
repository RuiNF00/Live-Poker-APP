// What a crash report may carry. Reports go to Sentry (EU region) to fix
// crashes, and nothing in them may identify the player or show their poker:
// no user, IP, device name, emails, phone numbers, long texts (notes, hand
// histories), screenshots, or link tokens. Pure, so the tests run it in Node.
// See /mnt/project-files/launch/crash-reporting.md.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 9+ digits with optional separators and a leading +: phone numbers, never a stack line number.
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const LONG = 200;
// Cards (Ah, KdQs, T♠): a hand in an error message ("bad action for AhKd") is poker the player didn't share.
const CARDS = /(?<![A-Za-z0-9])(?:[2-9TJQKA][shdc♠♥♦♣]){1,7}(?![A-Za-z0-9])/g;
// Money: a number next to a currency sign or code (€1.250, $ 500, 30,50 EUR, R$ 99).
const MONEY = /(?:R\$|US\$|[€$£¥₹])\s?\d[\d.,]*|\b\d[\d.,]*\s?(?:€|EUR|USD|BRL|GBP|MXN|ARS)\b/g;

/** Tags a report may carry; anything else is dropped (never install id, RevenueCat id, names or amounts). */
export const TAGS = ['channel', 'platform', 'locale', 'pro', 'live_session'] as const;
export type CrashTag = (typeof TAGS)[number];

const URL_IN_TEXT = /\b(?:https?|sweatbook|exp):\/\/[^\s"'<>)]+/gi;

export function scrubString(s: string): string {
  if (s.length > LONG) return `[${s.length} chars removed]`;
  // URLs first: fetch errors quote the whole link, token included.
  return s.replace(URL_IN_TEXT, stripUrl).replace(EMAIL, '[email]').replace(PHONE, '[number]').replace(MONEY, '[amount]').replace(CARDS, '[cards]');
}

/**
 * A URL (or app path) with no secrets: no query or fragment (edit tokens,
 * recovery codes, keys after #), and every path segment that isn't a plain
 * route word becomes :id (coach and swap tokens, backup ids and hand ids sit
 * in the path).
 */
export function stripUrl(u: string): string {
  const bare = u.replace(/[?#].*$/, '');
  const m = /^([a-z][a-z0-9+.-]*:\/\/[^/]*)?(.*)$/i.exec(bare)!;
  const path = m[2].split('/').map((seg) => (seg === '' || /^[a-z][a-z-]*$/.test(seg) ? seg : ':id'));
  return (m[1] ?? '') + path.join('/');
}

// Keys whose values are a person's words or a secret, however short ("Rui", a 20-character note): dropped, not filtered.
const SECRET_KEY = /^(name|names|note|notes|nickname|token|code|edit|.*token|.*_name)$/i;
// The SDK's own descriptions of the phone and the app (os.name "iOS", app.app_name): kept, values still filtered.
const SDK_CONTEXTS = ['os', 'app', 'runtime', 'culture'];

function deep(x: unknown, depth = 0, dropKeys = true): unknown {
  if (typeof x === 'string') return scrubString(x);
  if (depth > 8 || x == null || typeof x !== 'object') return x;
  if (Array.isArray(x)) return x.map((v) => deep(v, depth + 1, dropKeys));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) if (!dropKeys || !SECRET_KEY.test(k)) out[k] = deep(v, depth + 1, dropKeys);
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
  if (typeof e.transaction === 'string') e.transaction = stripUrl(e.transaction);
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
      delete d.id;
      c.device = d;
    }
    // iOS puts a fixed per-phone hash here: an install id the privacy forms don't allow.
    if (c.app && typeof c.app === 'object') {
      const a = { ...(c.app as Obj) };
      delete a.device_app_hash;
      c.app = a;
    }
    // Any other context (React's component stack, app, os) goes through the same string filter.
    for (const k of Object.keys(c)) if (k !== 'device') c[k] = deep(c[k], 0, !SDK_CONTEXTS.includes(k));
    e.contexts = c;
  }
  if (e.tags && typeof e.tags === 'object') {
    e.tags = Object.fromEntries(Object.entries(e.tags as Obj).filter(([k]) => (TAGS as readonly string[]).includes(k)));
  }
  if (e.message != null) e.message = deep(e.message);
  if (e.extra != null) e.extra = deep(e.extra);
  if (e.logentry != null) e.logentry = deep(e.logentry);
  if (e.exception && typeof e.exception === 'object') {
    const ex = e.exception as { values?: Obj[] };
    e.exception = { ...ex, values: ex.values?.map((v) => ({ ...v, value: typeof v.value === 'string' ? scrubString(v.value) : v.value, stacktrace: noVars(v.stacktrace) })) };
  }
  if (e.threads && typeof e.threads === 'object') {
    const th = e.threads as { values?: Obj[] };
    e.threads = { ...th, values: th.values?.map((v) => ({ ...v, stacktrace: noVars(v.stacktrace) })) };
  }
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = (e.breadcrumbs as Obj[]).map((x) => scrubBreadcrumb(x)).filter(Boolean);
  return e as unknown as E;
}

/** Stack frames keep file, function and line; local variables (a hand, a session) never leave. */
function noVars(st: unknown): unknown {
  if (!st || typeof st !== 'object') return st;
  const frames = (st as { frames?: Obj[] }).frames;
  if (!Array.isArray(frames)) return st;
  return { ...(st as Obj), frames: frames.map(({ vars: _v, ...f }) => f) };
}

/**
 * Sentry's beforeBreadcrumb: no console lines and no touches (a touched
 * button's label can be a name or an amount); network crumbs keep method,
 * path and status only; navigation keeps the route, never its params.
 */
export function scrubBreadcrumb<B extends object>(crumb: B): B | null {
  const b = crumb as Obj;
  const cat = typeof b.category === 'string' ? b.category : '';
  if (cat === 'console' || cat === 'touch' || cat.startsWith('ui.')) return null;
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
