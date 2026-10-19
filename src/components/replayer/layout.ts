// Geometry of the phone replayer table. Pure, no React Native, so it can be tested.
//
// The look and the idea come from the replayer of the stats app the owner uses
// (seats and bet spots placed by hand per table size, like real poker clients,
// rather than computed on a circle). The stage here is portrait for a phone:
// width W, height W * STAGE_RATIO. Every position is a percentage of the stage;
// every size scales with W (k = W / 366, the width of an iPhone screen minus margins).

export const STAGE_RATIO = 1.22;

export type Pt = { x: number; y: number };

/** Seat centres (plate centre), index 0 = hero at the bottom, then clockwise. */
export const SEATS: Record<number, Pt[]> = {
  2: [{ x: 50, y: 87 }, { x: 50, y: 14 }],
  3: [{ x: 50, y: 87 }, { x: 15, y: 25 }, { x: 85, y: 25 }],
  4: [{ x: 50, y: 87 }, { x: 10.5, y: 50 }, { x: 50, y: 14 }, { x: 89.5, y: 50 }],
  5: [{ x: 50, y: 87 }, { x: 13, y: 67 }, { x: 22, y: 19 }, { x: 78, y: 19 }, { x: 87, y: 67 }],
  6: [{ x: 50, y: 87 }, { x: 12, y: 66 }, { x: 13, y: 30 }, { x: 50, y: 13 }, { x: 87, y: 30 }, { x: 88, y: 66 }],
  7: [{ x: 50, y: 87 }, { x: 12, y: 67 }, { x: 12, y: 34 }, { x: 33, y: 13 }, { x: 67, y: 13 }, { x: 88, y: 34 }, { x: 88, y: 67 }],
  8: [{ x: 50, y: 87 }, { x: 13, y: 72 }, { x: 10.5, y: 47 }, { x: 15, y: 22 }, { x: 50, y: 12 }, { x: 85, y: 22 }, { x: 89.5, y: 47 }, { x: 87, y: 72 }],
  9: [{ x: 50, y: 87 }, { x: 14, y: 73 }, { x: 10.5, y: 52 }, { x: 13, y: 30 }, { x: 33, y: 13 }, { x: 67, y: 13 }, { x: 87, y: 30 }, { x: 89.5, y: 52 }, { x: 86, y: 73 }],
  10: [{ x: 50, y: 87 }, { x: 18, y: 77 }, { x: 10.5, y: 54 }, { x: 11, y: 33 }, { x: 22, y: 15 }, { x: 50, y: 11 }, { x: 78, y: 15 }, { x: 89, y: 33 }, { x: 89.5, y: 54 }, { x: 82, y: 77 }],
};

/** Where each seat's chips go: in front of the seat, on the way to the pot, clear of the board. */
export const BET_SPOTS: Record<number, Pt[]> = {
  2: [{ x: 50, y: 71 }, { x: 50, y: 30 }],
  3: [{ x: 50, y: 71 }, { x: 30, y: 36 }, { x: 70, y: 36 }],
  4: [{ x: 50, y: 71 }, { x: 27, y: 57 }, { x: 50, y: 30 }, { x: 73, y: 57 }],
  5: [{ x: 50, y: 71 }, { x: 33, y: 66 }, { x: 34, y: 33 }, { x: 66, y: 33 }, { x: 67, y: 66 }],
  6: [{ x: 50, y: 71 }, { x: 33, y: 66 }, { x: 29, y: 38 }, { x: 50, y: 29 }, { x: 71, y: 38 }, { x: 67, y: 66 }],
  7: [{ x: 50, y: 71 }, { x: 33, y: 66 }, { x: 33, y: 38 }, { x: 40, y: 29 }, { x: 60, y: 29 }, { x: 67, y: 38 }, { x: 67, y: 66 }],
  8: [{ x: 50, y: 71 }, { x: 33, y: 66 }, { x: 27, y: 56 }, { x: 30, y: 32 }, { x: 50, y: 27 }, { x: 70, y: 32 }, { x: 73, y: 56 }, { x: 67, y: 66 }],
  9: [{ x: 50, y: 71 }, { x: 34, y: 66 }, { x: 27, y: 59 }, { x: 29, y: 38 }, { x: 40, y: 29 }, { x: 60, y: 29 }, { x: 71, y: 38 }, { x: 73, y: 59 }, { x: 66, y: 66 }],
  10: [{ x: 50, y: 71 }, { x: 38, y: 66 }, { x: 27, y: 61 }, { x: 33, y: 38 }, { x: 34, y: 31 }, { x: 50, y: 26 }, { x: 66, y: 31 }, { x: 67, y: 38 }, { x: 73, y: 61 }, { x: 62, y: 66 }],
};

/** Share of a seat's hole cards that shows above its plate; the rest tucks under it. Hero's big cards tuck more. */
export const CARD_SHOW = 0.88;
export const HERO_CARD_SHOW = 0.7;
export const cardShow = (hero: boolean) => (hero ? HERO_CARD_SHOW : CARD_SHOW);

export const BOARD_Y = 47;
export const POT_Y = 60;
export const BRAND_Y = 36;

/** Plates keep this far (px at k = 1) from the stage edges, so a full-width table never touches the screen edge. */
export const EDGE = 8;

/** Scale factor for a stage of width w. */
export const scaleFor = (w: number) => Math.max(0.82, Math.min(1.18, w / 366));

/** Sizes in px at k = 1. */
export const SIZE = {
  plateW: 76,
  plateH: 38,
  seatCardW: 26,
  seatCardH: 36,
  heroCardW: 40,
  heroCardH: 56,
  boardCardW: 38,
  boardCardH: 53,
  boardGap: 4,
  /** Chip stack + amount pill. */
  betW: 70,
  betH: 22,
  potW: 96,
  potH: 26,
};

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const at = (p: Pt, w: number) => ({ x: (p.x / 100) * w, y: (p.y / 100) * w * STAGE_RATIO });

/** A seat's plate centre in px, pulled in from the side so the plate stays EDGE clear of it. */
export function seatCenter(p: Pt, w: number): { x: number; y: number } {
  const c = at(p, w);
  const min = (SIZE.plateW / 2 + EDGE) * scaleFor(w);
  return { x: Math.max(min, Math.min(w - min, c.x)), y: c.y };
}

/** The board shrinks a little when side seats sit level with it (4, 8, 9 and 10 seats). */
export function boardScale(n: number): number {
  return tableMap(n).seats.some((p) => Math.abs(p.y - BOARD_Y) < 9) ? 0.9 : 1;
}

/** Plate plus the cards tucked above it (or the FOLD label), in px. */
export function seatBox(p: Pt, w: number, hero = false): Box {
  const k = scaleFor(w);
  const c = seatCenter(p, w);
  const cardsH = (hero ? SIZE.heroCardH : SIZE.seatCardH) * k * cardShow(hero);
  return {
    left: c.x - (SIZE.plateW * k) / 2,
    right: c.x + (SIZE.plateW * k) / 2,
    top: c.y - (SIZE.plateH * k) / 2 - cardsH,
    bottom: c.y + (SIZE.plateH * k) / 2,
  };
}

export function betBox(p: Pt, w: number): Box {
  const k = scaleFor(w);
  const c = at(p, w);
  return { left: c.x - (SIZE.betW * k) / 2, right: c.x + (SIZE.betW * k) / 2, top: c.y - (SIZE.betH * k) / 2, bottom: c.y + (SIZE.betH * k) / 2 };
}

export function boardBox(w: number, n = 6): Box {
  const k = scaleFor(w) * boardScale(n);
  const c = at({ x: 50, y: BOARD_Y }, w);
  const half = ((5 * SIZE.boardCardW + 4 * SIZE.boardGap) * k) / 2;
  return { left: c.x - half, right: c.x + half, top: c.y - (SIZE.boardCardH * k) / 2, bottom: c.y + (SIZE.boardCardH * k) / 2 };
}

export function potBox(w: number): Box {
  const k = scaleFor(w);
  const c = at({ x: 50, y: POT_Y }, w);
  return { left: c.x - (SIZE.potW * k) / 2, right: c.x + (SIZE.potW * k) / 2, top: c.y - (SIZE.potH * k) / 2, bottom: c.y + (SIZE.potH * k) / 2 };
}

/** Seat and bet-spot maps for n players; falls back to the nearest authored size. */
export function tableMap(n: number): { seats: Pt[]; bets: Pt[] } {
  const m = Math.max(2, Math.min(10, n));
  return { seats: SEATS[m], bets: BET_SPOTS[m] };
}

/**
 * Dealer disc: next to its seat, a little towards the centre, pushed sideways
 * to the side away from that seat's bet so the two never share the lane.
 */
export function dealerSpot(seat: Pt, bet: Pt): Pt {
  const t = 0.24;
  const bx = seat.x + (50 - seat.x) * t;
  const by = seat.y + (BOARD_Y - seat.y) * t;
  let ux = 50 - seat.x;
  let uy = (BOARD_Y - seat.y) * STAGE_RATIO;
  const len = Math.hypot(ux, uy) || 1;
  ux /= len;
  uy /= len;
  let px = -uy;
  let py = ux;
  if ((bet.x - bx) * px + (bet.y - by) * STAGE_RATIO * py > 0) {
    px = -px;
    py = -py;
  }
  const off = 13;
  return { x: Math.max(5, Math.min(95, bx + px * off)), y: Math.max(4, Math.min(96, by + (py * off) / STAGE_RATIO)) };
}
