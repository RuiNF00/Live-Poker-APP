// «Quando voltas a jogar?»: the day the player picked on the session summary, kept on the phone.
// nudges.ts turns it into the two notices about logging; nudges-sync puts them on the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlayPlan } from './nudges';

const KEY = 'rl.play-plan.v1';

export async function readPlayPlan(): Promise<PlayPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as PlayPlan) : null;
    return p && typeof p.day === 'number' ? p : null;
  } catch {
    return null;
  }
}

/** Null: «Ainda não sei», no notices. */
export async function savePlayPlan(plan: PlayPlan | null): Promise<void> {
  await (plan ? AsyncStorage.setItem(KEY, JSON.stringify(plan)) : AsyncStorage.removeItem(KEY)).catch(() => {});
}
