import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { C } from '@/theme';

/** Minimal area/line chart for profit curves and stack graphs. */
export function LineChart({ values, height = 140, zeroLine = true }: { values: number[]; height?: number; zeroLine?: boolean }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const pts = values.length === 1 ? [values[0], values[0]] : values;
  const min = Math.min(0, ...pts);
  const max = Math.max(0, ...pts);
  const span = max - min || 1;
  const pad = 6;
  const x = (i: number) => (i / Math.max(1, pts.length - 1)) * w;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const up = pts[pts.length - 1] >= pts[0];
  const col = up ? C.accent : C.danger;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={col} stopOpacity={0.35} />
              <Stop offset="1" stopColor={col} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {zeroLine && <Line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={C.border} strokeDasharray="4 4" />}
          <Path d={`${d} L${w},${height} L0,${height} Z`} fill="url(#g)" />
          <Path d={d} stroke={col} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}
