// Installs error-guard-core as React Native's global error handler (see there). Installed before
// crash reports start, so Sentry reports the error first and then hands it here.

import { Platform } from 'react-native';

import { t } from '@/i18n';

import { makeGuard } from './error-guard-core';
import { notice } from './notice';

type Handler = (error: unknown, isFatal?: boolean) => void;
type EU = { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void };

const flushers = new Set<() => void>();
let original: Handler = () => {};

const guard = makeGuard({
  now: Date.now,
  dev: __DEV__,
  fallback: (e, fatal) => original(e, fatal),
  flush: () => {
    for (const f of flushers) f();
  },
  tell: () => notice(t('Algo correu mal'), t('A mão que estavas a registar e a sessão ao vivo ficaram guardadas. Podes continuar; se voltar a acontecer, fecha e abre a app.')),
  later: (fn, ms) => void setTimeout(fn, ms),
});

/** Called once at launch. The web has no global handler: an error there never closes the page. */
export function installErrorGuard() {
  const eu = (globalThis as { ErrorUtils?: EU }).ErrorUtils;
  if (Platform.OS === 'web' || !eu) return;
  original = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => guard.handle(e, !!fatal));
}

/** The store: what to write right away when something throws. */
export function onErrorFlush(fn: () => void): () => void {
  flushers.add(fn);
  return () => void flushers.delete(fn);
}

/** True once the store has loaded: before that, an error closes the app as before (nothing to keep yet). */
export const errorGuardReady = (v: boolean) => guard.setReady(v);
