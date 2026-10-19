// Web and the Node tests: no notifications. Kept apart from the phone version
// (notifications-module.native.ts) so expo-notifications stays out of the web bundle.

export function loadNotifications(): typeof import('expo-notifications') | null {
  return null;
}
