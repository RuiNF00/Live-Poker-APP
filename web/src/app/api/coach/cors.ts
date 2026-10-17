// The app calls these from the phone; the coach's page calls them from the same origin.
export const coachCors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-owner-token',
  // A link's token is in the URL: never cache what comes back.
  'cache-control': 'private, no-store',
};
