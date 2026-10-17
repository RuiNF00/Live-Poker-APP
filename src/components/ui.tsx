import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { C, R, S } from '@/theme';

export function tap(kind: 'light' | 'medium' | 'select' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'select') Haptics.selectionAsync().catch(() => {});
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

type TV = 'title' | 'h1' | 'h2' | 'body' | 'small' | 'tiny' | 'label' | 'mono';

export function T({ v = 'body', style, color, ...rest }: TextProps & { v?: TV; color?: string }) {
  return <RNText {...rest} style={[ts[v], color ? { color } : null, style]} />;
}

const ts = StyleSheet.create<Record<TV, TextStyle>>({
  title: { color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  h1: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  h2: { color: C.text, fontSize: 17, fontWeight: '700' },
  body: { color: C.text, fontSize: 15 },
  small: { color: C.textDim, fontSize: 13 },
  tiny: { color: C.muted, fontSize: 11 },
  label: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  mono: { color: C.text, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
});

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  kind = 'primary',
  onPress,
  disabled,
  style,
  icon,
  small,
  haptic = true,
}: {
  title: string;
  kind?: BtnKind;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  small?: boolean;
  haptic?: boolean;
}) {
  const bg = kind === 'primary' ? C.accent : kind === 'secondary' ? C.surface3 : kind === 'danger' ? C.dangerSoft : 'transparent';
  const fg = kind === 'primary' ? C.accentInk : kind === 'danger' ? C.danger : C.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: R.md,
          paddingVertical: small ? 8 : 14,
          paddingHorizontal: small ? 12 : 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          borderWidth: kind === 'ghost' ? 1 : 0,
          borderColor: C.border,
        },
        style,
      ]}>
      {icon}
      <RNText style={{ color: fg, fontWeight: '800', fontSize: small ? 13 : 16 }}>{title}</RNText>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
  style,
  big,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const col = color ?? C.accent;
  return (
    <Pressable
      onPress={() => {
        tap('select');
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          paddingVertical: big ? 10 : 7,
          paddingHorizontal: big ? 14 : 11,
          borderRadius: R.pill,
          borderWidth: 1,
          borderColor: active ? col : C.border,
          backgroundColor: active ? col + '22' : C.surface2,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}>
      <RNText style={{ color: active ? col : C.textDim, fontWeight: '700', fontSize: big ? 15 : 13 }}>{label}</RNText>
    </Pressable>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.lg }, style]}>
      {children}
    </View>
  );
}

export function Row({ children, style, gap = S.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function PressRow({ children, style, ...rest }: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 }}>
      <T v="h2" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T v="small" style={{ textAlign: 'center', lineHeight: 19 }}>
          {body}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: S.md }} />;
}
