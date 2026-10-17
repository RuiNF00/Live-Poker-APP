// Settings row for the app lock. With a phone lock (Face ID, fingerprint or
// code) it uses that; on a phone without one, the player picks a 4-digit PIN.

import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { askDevice, deviceLockAvailable, loadLock, lockSupported, PIN_LENGTH, pinConfig, saveLock } from '@/lib/app-lock';
import { notice } from '@/lib/notice';
import { C, S } from '@/theme';

import { lockChanged, PinPad } from './AppLock';
import { Button, ToggleItem } from './ui';
import { useSheetAnimation } from '@/lib/motion';

export function AppLockSetting() {
  const sheetAnim = useSheetAnimation();
  const [on, setOn] = useState<boolean | null>(null);
  const [settingPin, setSettingPin] = useState(false);

  useEffect(() => {
    loadLock().then((c) => setOn(!!c));
  }, []);

  if (!lockSupported || on === null) return null;

  const done = (v: boolean) => {
    setOn(v);
    lockChanged();
  };

  const change = async (v: boolean) => {
    if (!v) {
      // With the phone's lock, turning it off asks for it once more.
      const c = await loadLock();
      if (c?.mode === 'device' && !(await askDevice())) return;
      await saveLock(null);
      return done(false);
    }
    if (await deviceLockAvailable()) {
      if (!(await askDevice())) return;
      await saveLock({ mode: 'device' });
      return done(true);
    }
    setSettingPin(true);
  };

  return (
    <>
      <ToggleItem
        icon="lock-closed-outline"
        title={t('Bloquear a app')}
        subtitle={t('Pede Face ID, impressão digital ou código ao abrir e depois de 30 s fora da app')}
        value={on}
        onChange={change}
      />
      <Modal visible={settingPin} animationType={sheetAnim} presentationStyle="pageSheet" onRequestClose={() => setSettingPin(false)}>
        <NewPin
          onCancel={() => setSettingPin(false)}
          onDone={async (pin) => {
            await saveLock(await pinConfig(pin));
            setSettingPin(false);
            done(true);
            notice(t('PIN guardado'), t('Se o esqueceres, não há forma de o recuperar neste telemóvel. Liga a cópia na nuvem para não perderes nada.'));
          }}
        />
      </Modal>
    </>
  );
}

function NewPin({ onDone, onCancel }: { onDone: (pin: string) => void; onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const type = (d: string) => {
    const next = (pin + d).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    if (first === null) {
      setFirst(next);
      setPin('');
      setMismatch(false);
    } else if (next === first) onDone(next);
    else {
      setFirst(null);
      setPin('');
      setMismatch(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.xl, paddingBottom: insets.bottom + S.lg, alignItems: 'center', gap: S.xl }}>
      <PinPad
        value={pin}
        onDigit={type}
        onBack={() => setPin((p) => p.slice(0, -1))}
        title={mismatch ? t('Os PIN não são iguais. Escolhe outra vez.') : first === null ? t('Escolhe um PIN de 4 dígitos') : t('Escreve o PIN outra vez')}
        error={mismatch}
      />
      <Button kind="ghost" size="md" title={t('Cancelar')} onPress={onCancel} />
    </View>
  );
}
