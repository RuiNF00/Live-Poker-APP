// «Mão guardada · +750 € · Ver» over the felt of the next hand, for about 4 s, after a hand of a live
// session saved itself and the screen went on to the next one. «Ver» opens the saved hand. With Reduce
// Motion it appears and goes with no fade; screen readers hear «Mão guardada» and the result once.
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { t } from '@/i18n';
import { useReduceMotion } from '@/lib/motion';
import { announceAfterChange } from '@/lib/screen-reader';
import { savedMessage } from '@/lib/spoken';
import { C, R, S, SHADOW } from '@/theme';

export const SAVED_TOAST_MS = 4000;

export function SavedToast({ result, onView, top }: { result?: string; onView: () => void; top: number }) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(true);
  const [a] = useState(() => new Animated.Value(reduce ? 1 : 0));
  const said = useRef<(() => void) | null>(null);
  useEffect(() => {
    said.current = announceAfterChange(savedMessage('hand', result));
    if (!reduce) Animated.timing(a, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      if (reduce) return setShown(false);
      Animated.timing(a, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setShown(false));
    }, SAVED_TOAST_MS);
    return () => {
      clearTimeout(timer);
      said.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!shown) return null;
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: S.md, right: S.md, top, opacity: a, alignItems: 'center' }}>
      <View
        accessibilityLiveRegion="polite"
        style={[{ flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.surface3, borderRadius: R.pill, paddingLeft: S.lg, paddingRight: S.xs, minHeight: 44 }, SHADOW]}>
        <T v="small" color={C.text}>
          {result ? `${t('Mão guardada')} · ${result}` : t('Mão guardada')}
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Ver a mão guardada')} onPress={onView} hitSlop={8} style={{ paddingHorizontal: S.md, minHeight: 44, justifyContent: 'center' }}>
          <T v="small" color={C.accent} style={{ fontWeight: '700' }}>
            {t('Ver')}
          </T>
        </Pressable>
      </View>
    </Animated.View>
  );
}
