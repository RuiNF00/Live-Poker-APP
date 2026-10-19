// The hands list's cloud-copy hooks: whether to suggest a copy or warn about one. Kept apart
// from CloudBackup.tsx so the first frame doesn't load the copy code (the cards are lazy).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { loadCloud, onCloudChange, type CloudState } from '@/lib/cloud-backup';
import { backupHealth, type Health } from '@/lib/cloud-guard';

const SUGGEST_KEY = 'rl.cloud.suggest.v1';

/**
 * Once, after the first saved hand or closed session, for players without a
 * cloud copy: one card in the home chain. Never turns it on by itself; gone
 * for good once tapped or dismissed (or once the copy is on).
 */
export function useBackupSuggestion(due: boolean): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!due) return;
    let live = true;
    Promise.all([loadCloud(), AsyncStorage.getItem(SUGGEST_KEY).catch(() => '1')]).then(([c, seen]) => live && setShow(!c && !seen));
    const off = onCloudChange((c) => c && setShow(false));
    return () => {
      live = false;
      off();
    };
  }, [due]);
  const dismiss = useCallback(() => {
    setShow(false);
    AsyncStorage.setItem(SUGGEST_KEY, '1').catch(() => {});
  }, []);
  return { show, dismiss };
}

const SNOOZE_KEY = 'rl.backup.snooze.v1';
const SNOOZE_MS = 24 * 3600000;

/**
 * For the hands list: the warning to show, or null. Only when the cloud copy
 * is on and the last one failed or is a week old; the cross hides it for a day.
 * Kept current as copies are made or fail.
 */
export function useBackupWarning(): { health: Exclude<Health, { level: 'ok' }> | null; snooze: () => void } {
  const [health, setHealth] = useState<Health | null>(null);
  const [snoozed, setSnoozed] = useState(true);
  useEffect(() => {
    const update = (c: CloudState | null) => setHealth(backupHealth(c, Date.now()));
    loadCloud().then(update);
    AsyncStorage.getItem(SNOOZE_KEY)
      .then((v) => setSnoozed(!!v && Date.now() - Number(v) < SNOOZE_MS))
      .catch(() => setSnoozed(false));
    return onCloudChange(update);
  }, []);
  const snooze = useCallback(() => {
    setSnoozed(true);
    AsyncStorage.setItem(SNOOZE_KEY, String(Date.now())).catch(() => {});
  }, []);
  return { health: health && health.level !== 'ok' && !snoozed ? health : null, snooze };
}
