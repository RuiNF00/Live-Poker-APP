// EAS build hook (eas-build-pre-install): a store build without RevenueCat keys
// would show a paywall that can never sell, so it fails here instead.
// Keys come from EAS environment variables (production environment).

const STORE_PROFILES = ['production', 'testflight', 'play-test'];
const profile = process.env.EAS_BUILD_PROFILE;
const platform = process.env.EAS_BUILD_PLATFORM;

if (STORE_PROFILES.includes(profile)) {
  const name = platform === 'android' ? 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY' : 'EXPO_PUBLIC_REVENUECAT_IOS_KEY';
  const prefix = platform === 'android' ? 'goog_' : 'appl_';
  const key = (process.env[name] || '').trim();
  if (!key) {
    console.error(`\n✖ ${name} is missing for the "${profile}" build. Add it with: eas env:create --environment production --name ${name} --value <RevenueCat public key>\n`);
    process.exit(1);
  }
  // The other platform's key, a secret key (sk_) or a test store key (test_) would build fine and never sell.
  if (!key.startsWith(prefix)) {
    console.error(`\n✖ ${name} must be the RevenueCat ${platform === 'android' ? 'Google Play' : 'App Store'} public key, starting with "${prefix}" (got "${key.slice(0, 5)}…"). Fix it with: eas env:update --environment production --name ${name}\n`);
    process.exit(1);
  }
  console.log(`✓ ${name} is set for the "${profile}" build.`);
}
