// The Sentry SDK, on phones only (crash-sdk.ts keeps it out of the web bundle).
export const loadSentry = () => import('@sentry/react-native');
