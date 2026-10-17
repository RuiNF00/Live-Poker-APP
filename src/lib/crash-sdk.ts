// Web: no crash reports, and the Sentry SDK stays out of the web bundle.
export const loadSentry = (): Promise<typeof import('@sentry/react-native') | null> => Promise.resolve(null);
