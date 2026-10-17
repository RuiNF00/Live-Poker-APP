#!/usr/bin/env node
// Checklist before any store build (TestFlight, App Store, Play): the same
// checks CI runs, with the launch tests first and by name, because data lost
// or a crash after an update is what makes players leave. Stops at the first
// failure and exits non-zero, so it can sit in front of the build command:
//
//   npm run check:release && npx eas-cli@latest build -p ios --profile testflight ...
//
// Fast mode (--quick) skips the web export.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const quick = process.argv.includes('--quick');
const root = new URL('..', import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), 'sweatbook-release-'));

const steps = [
  { name: 'Arranque com dados de todas as versões e valores corrompidos', cmd: 'npx tsx --test src/store/__tests__/boot.test.ts src/store/__tests__/persist.test.ts' },
  { name: 'Tipos (TypeScript)', cmd: 'npx tsc --noEmit' },
  { name: 'Lint, sem erros', cmd: 'npx eslint .' },
  { name: 'Todos os testes da app', cmd: 'npm test --silent' },
  {
    name: 'Formato das mãos partilhadas (packages/hand-format)',
    cmd: `${existsSync(join(root, 'packages/hand-format/node_modules')) ? '' : 'npm ci --silent && '}npm run --silent typecheck && npm test --silent`,
    cwd: 'packages/hand-format',
  },
  { name: 'Configuração Expo válida', cmd: 'npx expo config --type public --json > /dev/null' },
  { name: 'iOS: modos em segundo plano e textos de permissão', cmd: 'node scripts/check-ios-plist.mjs' },
  { name: 'Atualizações over-the-air (EAS Update)', cmd: 'node scripts/check-updates.mjs' },
  ...(quick ? [] : [{ name: 'Bundle exporta sem erros', cmd: `npx expo export --platform web --output-dir ${out}` }]),
];

const results = [];
let failed = null;
for (const s of steps) {
  process.stdout.write(`○ ${s.name}…\n`);
  const t0 = Date.now();
  const r = spawnSync(s.cmd, { cwd: join(root, s.cwd ?? ''), shell: true, encoding: 'utf8', env: { ...process.env, CI: '1' } });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status === 0) {
    results.push(`✓ ${s.name} (${secs}s)`);
    continue;
  }
  results.push(`✗ ${s.name} (${secs}s)`);
  failed = { ...s, log: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n') };
  break;
}
rmSync(out, { recursive: true, force: true });

console.log('\nAntes da versão para as lojas\n');
for (const l of results) console.log(l);
for (const s of steps.slice(results.length)) console.log(`○ ${s.name} (não corrido)`);
if (failed) {
  console.log(`\nParado em: ${failed.name}\n$ ${failed.cmd}\n\n${failed.log}\n\nNão faças a build até isto passar.`);
  process.exit(1);
}
console.log('\nTudo verde: podes fazer a build.');
