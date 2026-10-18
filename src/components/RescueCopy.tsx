// On the root crash screen (the app can't open at all, so Definições can't
// either): saves the player's records, raw, as a file they share themselves,
// for support or to keep. Nothing goes to a server. The app lock still holds:
// the phone's lock is asked first, and with an app PIN (which needs the app's
// own keypad) the button isn't offered.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import { askDeviceResult, loadLock, type LockConfig } from '@/lib/app-lock';
import { saveTextFile } from '@/lib/files';
import { versionLabel } from '@/lib/ota';
import type { KV } from '@/store/persist';
import { readRecords, rescueFile } from '@/store/rescue';

import { Button } from './ui';

export function RescueCopy() {
  // undefined while the lock is being read: the button waits, so it never shows unguarded.
  const [lock, setLock] = useState<LockConfig | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    loadLock()
      .catch(() => null)
      .then((l) => alive && setLock(l));
    return () => {
      alive = false;
    };
  }, []);
  if (lock === undefined || lock?.mode === 'pin') return null;
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (lock?.mode === 'device' && (await askDeviceResult()) === 'no') return;
      const records = await readRecords(AsyncStorage as unknown as KV);
      const stamp = new Date().toISOString().slice(0, 10);
      await saveTextFile(`sweatbook-copia-${stamp}.json`, rescueFile(records, { version: versionLabel(), platform: Platform.OS }), 'application/json');
    } catch {
      // Share sheet closed or not available: nothing to undo.
    } finally {
      setBusy(false);
    }
  };
  return <Button title={busy ? t('A preparar…') : t('Guardar uma cópia dos dados')} kind="ghost" icon="download-outline" disabled={busy} onPress={save} />;
}
