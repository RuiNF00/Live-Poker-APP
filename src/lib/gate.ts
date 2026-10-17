// Paywall seam. Every place that saves or shares a hand asks `gate()` first.
// The free/pro rules live behind `setGate` (owned by the payments work); until
// one is installed everything is allowed.

import type { Hand } from '@/poker/types';

export type GateAction = 'save' | 'share' | 'share-story';
export type GateCheck = (action: GateAction, ctx: { hand: Hand; hands: Hand[] }) => Promise<boolean>;

let current: GateCheck = async () => true;

export function setGate(check: GateCheck) {
  current = check;
}

export function gate(action: GateAction, ctx: { hand: Hand; hands: Hand[] }) {
  return current(action, ctx).catch(() => true);
}
