// Counts the touches on a screen, its sheets included, for the friction metric on hand_saved.
// Only a number: which control was touched is never recorded.

import React, { createContext, useContext } from 'react';
import { View, type ViewProps } from 'react-native';

const Count = createContext<(() => void) | null>(null);
export const TapCountProvider = Count.Provider;

/** A View that counts each touch that starts inside it, without taking the touch. A plain View outside a provider. */
export function TapCounted(props: ViewProps) {
  const inc = useContext(Count);
  return (
    <View
      {...props}
      onStartShouldSetResponderCapture={(e) => {
        inc?.();
        return props.onStartShouldSetResponderCapture?.(e) ?? false;
      }}
    />
  );
}
