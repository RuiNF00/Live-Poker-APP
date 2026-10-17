import React from 'react';
import { Text, View } from 'react-native';

import { ff } from '@/theme';

const HUES = ['#FF6A3D', '#5AA9FF', '#B07CFF', '#4ADE80', '#F5B83D', '#FF8A7A', '#3DD6C6'];

/** Initials in a coloured circle; the colour is stable for a name. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const clean = name.trim();
  const initials = clean
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
  let h = 0;
  for (const ch of clean) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const col = HUES[h % HUES.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: col + '26', borderWidth: 1, borderColor: col + '55', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: col, fontFamily: ff(800), fontWeight: '800', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}
