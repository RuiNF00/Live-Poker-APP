// A hand's tournament buy-in and venue: what the player spends and where they play. No shared
// page needs them, so they are neither stored nor served, even for hands shared before the app
// stopped sending them (Replayer e2e, 19 Oct: GET /api/hands/<id> returned both to anyone with the link).

/** The hand without game.buyIn and game.venue; anything that isn't a hand comes back as it is. */
export function withoutPrivateGame<T>(hand: T): T {
  if (!hand || typeof hand !== 'object' || Array.isArray(hand)) return hand;
  const game = (hand as { game?: unknown }).game;
  if (!game || typeof game !== 'object' || Array.isArray(game)) return hand;
  const { buyIn: _b, venue: _v, ...rest } = game as Record<string, unknown>;
  return { ...hand, game: rest };
}
