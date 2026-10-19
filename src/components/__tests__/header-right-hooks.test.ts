/// <reference types="node" />
// React Navigation (and the native stack on the phone) calls `headerRight(props)` as a
// plain function inside its own Header, not as a component. A hook called there counts
// as one of the Header's hooks, so when a screen swaps in its own headerRight the hook
// count changes and React throws #300 («Rendered fewer hooks»). That crashed saving the
// first hand of a running session (launch/primeiros-5-minutos.md). Hooks belong in a
// component the function returns (<OfflineBadge />), never in the function itself.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const SRC = join(__dirname, '..', '..');
const HOOK = /\buse[A-Z]\w*\s*\(/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

/** The value after `headerRight:` up to the comma or bracket that closes it. */
function valueAt(src: string, from: number): string {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') {
      if (depth === 0) return src.slice(from, i);
      depth--;
    } else if (c === ',' && depth === 0) return src.slice(from, i);
  }
  return src.slice(from);
}

/** The body of a function declaration: from its first `{` to the matching `}`. */
function bodyOf(src: string, decl: string): string {
  const start = src.indexOf('{', src.indexOf(decl));
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`no body for ${decl}`);
}

test('no headerRight calls a hook directly', () => {
  const found: string[] = [];
  for (const f of files(join(SRC, 'app'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/headerRight\s*:/g)) {
      const v = valueAt(src, m.index! + m[0].length);
      if (HOOK.test(v)) found.push(`${f.slice(SRC.length)}: ${v.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(found, []);
});

test('headerRightWithBadge returns a function without hooks', () => {
  const src = readFileSync(join(SRC, 'components', 'NetStatus.tsx'), 'utf8');
  const body = bodyOf(src, 'export function headerRightWithBadge');
  assert.ok(body.includes('<OfflineBadge />'), 'the badge is rendered as a component');
  assert.ok(!HOOK.test(body), `hook call inside headerRightWithBadge: ${body.match(HOOK)?.[0]}`);
});

test('the check catches the old bug', () => {
  const old = `options={{ headerRight: () => { const offline = useOffline(); return offline ? null : null; }, title: 'x' }}`;
  const m = /headerRight\s*:/.exec(old)!;
  assert.ok(HOOK.test(valueAt(old, m.index + m[0].length)));
  const oldBadge = `export function headerRightWithBadge(right) { return function HeaderRight() { const offline = useOffline(); return right(); }; }`;
  assert.ok(HOOK.test(bodyOf(oldBadge, 'export function headerRightWithBadge')));
});
