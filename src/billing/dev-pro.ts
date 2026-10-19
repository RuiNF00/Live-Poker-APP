// Screenshot builds only: turn Pro on in a web build with
// localStorage.setItem('sweatbook.devPro', '1'). Read only in development or
// when EXPO_PUBLIC_SCREENSHOTS=1; both are inlined at build time, so a store
// build compiles this down to `false` and never looks at storage.

export const DEV_PRO_KEY = 'sweatbook.devPro';

type Storage = { getItem: (k: string) => string | null } | undefined;

/** Pure rule, tested: the flag counts only in a dev or screenshot build. */
export function devProFrom(dev: boolean, screenshots: string | undefined, storage: Storage): boolean {
  if (!dev && screenshots !== '1') return false;
  try {
    return storage?.getItem(DEV_PRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function devPro(): boolean {
  if (!__DEV__ && process.env.EXPO_PUBLIC_SCREENSHOTS !== '1') return false;
  return devProFrom(true, '1', typeof localStorage === 'undefined' ? undefined : localStorage);
}

/**
 * Pro in the Release build installed by cable on a test iPhone (EXPO_PUBLIC_LOCAL_PRO=1, set only
 * on that local build command). Counts only when the build has no store key: nothing can be bought
 * there, so it can never stand in for a real purchase. EAS builds refuse the flag (app.config.js)
 * and check:release fails if it is set.
 */
export function localProFrom(flag: string | undefined, live: boolean): boolean {
  return flag === '1' && !live;
}

/**
 * Present in the bundle only when a test flag was on at build time (both are inlined, so a
 * store build compiles this to ''). scripts/check-store-bundle.mjs looks for it in the built
 * app before an upload: Apple's 2.5.19 forbids features a build hides from review.
 */
export const TEST_BUILD_MARK =
  process.env.EXPO_PUBLIC_LOCAL_PRO === '1' ? 'sweatbook:test-build:local-pro' : process.env.EXPO_PUBLIC_SCREENSHOTS === '1' ? 'sweatbook:test-build:screenshots' : '';
