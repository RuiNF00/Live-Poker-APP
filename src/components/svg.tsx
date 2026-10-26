// react-native-svg (~53 KB) for every chart and share card, kept out of the web launch.
// Metro puts a module two routes share in the chunk that always loads at launch, and 13
// routes draw with svg. Here it is one import() instead, so it gets a chunk of its own.
// Until it arrives, Svg holds its size with an empty View and its parts draw nothing.
// Phones use svg.native.ts, which is the library itself.

import React, { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type * as Lib from 'react-native-svg';

type Kit = typeof Lib;
let kit: Kit | null = null;
let loading: Promise<Kit> | null = null;

function load(): Promise<Kit> {
  loading ??= import('react-native-svg').then(
    (m) => (kit = m),
    (e: unknown) => {
      // Offline on the web: the next drawing asks again.
      loading = null;
      throw e;
    },
  );
  return loading;
}

/** Starts the download after launch, so a chart opened later draws at once. */
export function preloadSvg(): Promise<void> {
  return load().then(
    () => {},
    () => {},
  );
}

function useKit(): Kit | null {
  const [k, setK] = useState(kit);
  useEffect(() => {
    if (!k) load().then(setK, () => {});
  }, [k]);
  return k;
}

type Name = 'Svg' | 'Defs' | 'Ellipse' | 'G' | 'Line' | 'LinearGradient' | 'Path' | 'RadialGradient' | 'Rect' | 'Stop';

function part<N extends Name>(name: N, hold?: boolean): Kit[N] {
  function Part(props: Record<string, unknown>) {
    const k = useKit();
    if (!k) {
      if (!hold) return null;
      const { width, height, style } = props as { width?: number | string; height?: number | string; style?: StyleProp<ViewStyle> };
      return <View style={[style, { width: width as number, height: height as number }]} />;
    }
    const Real = k[name] as unknown as React.ComponentType<Record<string, unknown>>;
    return <Real {...props} />;
  }
  Part.displayName = name;
  return Part as unknown as Kit[N];
}

export const Svg = part('Svg', true);
export const Defs = part('Defs');
export const Ellipse = part('Ellipse');
export const G = part('G');
export const Line = part('Line');
export const LinearGradient = part('LinearGradient');
export const Path = part('Path');
export const RadialGradient = part('RadialGradient');
export const Rect = part('Rect');
export const Stop = part('Stop');
