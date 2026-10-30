// The switch to the yearly plan made from Settings, kept on the phone until the monthly renews (see annualSwitch).

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AnnualSwitched } from './offers';

const KEY = 'rl.annual-switch.v1';

export async function annualSwitched(): Promise<AnnualSwitched | null> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
    return v && typeof v.product === 'string' && typeof v.ends === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function rememberAnnualSwitch(s: AnnualSwitched): void {
  AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
}
