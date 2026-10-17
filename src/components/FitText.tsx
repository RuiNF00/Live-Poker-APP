// One line of text on a share card that shrinks to its box instead of being cut.
// See src/share/fit-text.ts.

import React, { useState } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { F } from '@/theme';
import { fitFont, MONO_EM, SANS_EM } from '@/share/fit-text';

export function FitText({ children, style, width: fixed }: { children: string; style: TextStyle; /** The box, when the text's own width isn't it (a text in a row). */ width?: number }) {
  const [measured, setMeasured] = useState(0);
  const s: TextStyle = StyleSheet.flatten(style) ?? {};
  const base = s.fontSize ?? 14;
  const width = fixed ?? measured;
  const size = width ? fitFont(children, base, width, { em: s.fontFamily === F.mono ? MONO_EM : SANS_EM, letterSpacing: s.letterSpacing ?? 0 }) : base;
  const k = size / base;
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      onLayout={fixed ? undefined : (e) => setMeasured(Math.round(e.nativeEvent.layout.width))}
      style={[s, { fontSize: size, lineHeight: s.lineHeight ? s.lineHeight * k : undefined, letterSpacing: s.letterSpacing ? s.letterSpacing * k : undefined }]}>
      {children}
    </Text>
  );
}
