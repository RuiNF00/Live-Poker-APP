// The app lock screen: covers everything on launch and after 30 s away, and
// blanks the app in the app switcher so a glance at the phone shows nothing.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { askDeviceResult, checkPin, deviceLockAvailable, loadFails, loadLock, lockoutMs, needsUnlock, PIN_LENGTH, saveFails, saveLock, type LockConfig } from '@/lib/app-lock';
import { C, S } from '@/theme';

import { Button, T, tap, Wordmark } from './ui';

const listeners = new Set<() => void>();
/** Settings calls this after turning the lock on or off. */
export function lockChanged() {
  for (const l of listeners) l();
}

export function AppLock() {
  const [cfg, setCfg] = useState<LockConfig | null | undefined>(undefined);
  const [locked, setLocked] = useState(false);
  const [cover, setCover] = useState(false);
  const leftAt = useRef<number | null>(null);
  const cfgRef = useRef<LockConfig | null>(null);

  const reload = useCallback((lockNow: boolean) => {
    loadLock().then((c) => {
      cfgRef.current = c;
      setCfg(c);
      if (lockNow && c) setLocked(true);
    });
  }, []);

  useEffect(() => {
    reload(true);
    // Turned on or off in Settings: no lock screen right away, the player is here.
    const l = () => reload(false);
    listeners.add(l);
    const sub = AppState.addEventListener('change', (st) => {
      if (!cfgRef.current) return;
      if (st === 'active') {
        setCover(false);
        // Only after really leaving: Face ID's own prompt and pulling down the
        // notification centre make the app inactive too.
        if (leftAt.current !== null && needsUnlock(cfgRef.current, leftAt.current, Date.now())) setLocked(true);
        leftAt.current = null;
      } else {
        setCover(true);
        if (st === 'background' && leftAt.current === null) leftAt.current = Date.now();
      }
    });
    return () => {
      listeners.delete(l);
      sub.remove();
    };
  }, [reload]);

  // Stable, so the lock screen asks for Face ID once when it opens, not again on every re-render
  // (the app going inactive and active around a cancelled prompt would bring it straight back).
  const unlock = useCallback(() => setLocked(false), []);

  // Until we know whether there's a lock, show nothing of the app.
  if (cfg === undefined) return <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />;
  if (!cfg) return null;
  // A Modal, so it also covers screens that are themselves modals (new hand, paywall).
  return (
    <Modal visible={locked || cover} animationType="none" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => {}}>
      {locked ? (
        <LockScreen cfg={cfg} onUnlock={unlock} />
      ) : (
        <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Wordmark size={28} />
        </View>
      )}
    </Modal>
  );
}

function LockScreen({ cfg, onUnlock }: { cfg: LockConfig; onUnlock: () => void }) {
  const insets = useSafeAreaInsets();
  const [device, setDevice] = useState(cfg.mode === 'device');
  const asking = useRef(false);

  const tryDevice = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const r = await askDeviceResult();
    asking.current = false;
    if (r === 'ok') onUnlock();
    // The phone's own lock was removed: this lock can't be answered any more, so it goes too.
    else if (r === 'gone' && cfg.mode === 'device') {
      // A lock that couldn't be read stays saved: it may be a PIN, read fine next time.
      if (!cfg.unknown) await saveLock(null).catch(() => {});
      onUnlock();
    }
  }, [onUnlock, cfg.mode, cfg.unknown]);

  useEffect(() => {
    if (cfg.mode === 'device') tryDevice();
    else deviceLockAvailable().then(setDevice);
  }, [cfg.mode, tryDevice]);

  return (
    <View
      accessibilityViewIsModal
      style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 56, paddingBottom: insets.bottom + S.xl, paddingHorizontal: S.xl, alignItems: 'center', gap: S.xl }}>
      <Wordmark size={30} />
      <Ionicons name="lock-closed" size={28} color={C.textDim} />
      {cfg.mode === 'pin' ? (
        <PinEntry cfg={cfg} onUnlock={onUnlock} />
      ) : (
        <Button title={t('Desbloquear')} icon="scan-outline" onPress={tryDevice} style={{ alignSelf: 'stretch' }} />
      )}
      {cfg.mode === 'pin' && device ? <Button kind="ghost" size="md" title={t('Usar o código do telemóvel')} onPress={tryDevice} /> : null}
    </View>
  );
}

function PinEntry({ cfg, onUnlock }: { cfg: LockConfig; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [fails, setFails] = useState({ n: 0, at: 0 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    loadFails().then(setFails);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const wait = Math.max(0, fails.at + lockoutMs(fails.n) - now);

  const type = async (d: string) => {
    if (wait) return;
    const next = (pin + d).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    if (await checkPin(cfg, next)) {
      tap('success');
      await saveFails({ n: 0, at: 0 });
      onUnlock();
    } else {
      tap('medium');
      const f = { n: fails.n + 1, at: Date.now() };
      setFails(f);
      await saveFails(f);
      setPin('');
    }
  };

  return (
    <PinPad
      value={pin}
      onDigit={type}
      onBack={() => setPin((p) => p.slice(0, -1))}
      title={wait ? t('Tenta outra vez daqui a {s} s', { s: Math.ceil(wait / 1000) }) : fails.n ? t('PIN errado') : t('Escreve o teu PIN')}
      error={!!fails.n}
    />
  );
}

/** Four dots and a phone-style keypad. */
export function PinPad({ value, onDigit, onBack, title, error }: { value: string; onDigit: (d: string) => void; onBack: () => void; title: string; error?: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'];
  return (
    <View style={{ alignItems: 'center', gap: S.xl }}>
      <T v="callout" color={error ? C.bad : C.textDim} accessibilityLiveRegion="polite">
        {title}
      </T>
      <View style={{ flexDirection: 'row', gap: 18 }} accessibilityLabel={t('{n} de {m} dígitos', { n: value.length, m: PIN_LENGTH })}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: C.textDim, backgroundColor: i < value.length ? C.text : 'transparent' }} />
        ))}
      </View>
      <View style={{ width: 264, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={i} style={{ width: 76, height: 76 }} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === '<' ? t('Apagar') : k}
              onPress={() => (tap('select'), k === '<' ? onBack() : onDigit(k))}
              style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: k === '<' ? 'transparent' : pressed ? C.surface3 : C.surface2 })}>
              {k === '<' ? <Ionicons name="backspace-outline" size={26} color={C.text} /> : <T v="h1">{k}</T>}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}
