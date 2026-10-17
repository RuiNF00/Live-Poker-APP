// Sweatbook design system: the shared building blocks every screen is made of.
// Tokens live in theme.ts; this file turns them into components so spacing,
// type and touch targets stay the same everywhere. Phone first: 16 px gutters,
// 44 pt minimum touch targets, numbers always in JetBrains Mono.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput,
  useWindowDimensions,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { MASK, moneyMasked } from '@/poker/format';
import { C, F, R, S, SHADOW, ff, posColor } from '@/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Off in Settings › Vibração; kept here so every tap() call obeys it.
let hapticsOn = true;
export function setHaptics(on: boolean) {
  hapticsOn = on;
}

export function tap(kind: 'light' | 'medium' | 'select' | 'success' = 'light') {
  if (Platform.OS === 'web' || !hapticsOn) return;
  if (kind === 'select') Haptics.selectionAsync().catch(() => {});
  else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Asks before something that can't be undone (delete, end). */
export function confirmAction(title: string, body: string, okLabel: string, onOk: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || window.confirm(body ? `${title}\n\n${body}` : title)) onOk();
    return;
  }
  Alert.alert(title, body, [
    { text: t('Cancelar'), style: 'cancel' },
    { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);
}

// ─── Type ────────────────────────────────────────────────────────────────────

export type TV =
  | 'display'
  | 'title'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'callout'
  | 'small'
  | 'tiny'
  | 'label'
  | 'mono'
  | 'monoS'
  | 'monoL'
  | 'monoXL';

// How far each style may grow with the iPhone's text size setting. Big titles and
// numbers already read well and would break their rows; body text grows the most.
// Reading text follows Larger Text to ~200%; big numbers and titles stop earlier so they never collide.
const MAX_SCALE: Record<TV, number> = { display: 1.15, title: 1.3, h1: 1.5, h2: 1.6, h3: 1.6, body: 2, callout: 2, small: 2, tiny: 1.6, label: 2, mono: 1.6, monoS: 1.6, monoL: 1.25, monoXL: 1.15 };
/** Text inside buttons, chips and pills. */
const CONTROL_SCALE = 1.6;

const WEB = Platform.OS === 'web';

/**
 * React Native for web ignores adjustsFontSizeToFit, so one-line amounts and
 * labels were cut ("Você deve € 5.…"). On web this measures the rendered text
 * and scales the font down to fit, never below `min`. Native does nothing here.
 */
function useWebFit(on: boolean, min: number) {
  const ref = useRef<unknown>(null);
  const [scale, setScale] = useState(1);
  const fit = () => {
    const el = ref.current as HTMLElement | null;
    if (!on || !el || !el.clientWidth) return;
    // scrollWidth is the text's width at the current scale; undo it to get the full-size width.
    const natural = el.scrollWidth / scale;
    const next = natural > el.clientWidth + 0.5 ? Math.max(min, Math.floor((el.clientWidth / natural) * 100) / 100) : 1;
    if (Math.abs(next - scale) >= 0.01) setScale(next);
  };
  // After every render (the text may have changed); fit() only sets state when the scale changes.
  useLayoutEffect(fit);
  // The web fonts arrive after the first measure and are wider than the fallback: measure again.
  const [fonts, setFonts] = useState(0);
  useEffect(() => {
    if (!on || typeof document === 'undefined' || !document.fonts) return;
    const bump = () => setFonts((n) => n + 1);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, [on]);
  void fonts;
  return { ref, scale, fit };
}

/** Text that may shrink to one line on web too; same props as RN Text. */
export function FitText({ style, onLayout, ...rest }: TextProps) {
  const { ref, scale, fit } = useWebFit(WEB && !!rest.adjustsFontSizeToFit && rest.numberOfLines === 1, rest.minimumFontScale || 0.5);
  if (!WEB) return <RNText {...rest} style={style} onLayout={onLayout} />;
  const size = scale < 1 ? StyleSheet.flatten(style)?.fontSize : undefined;
  return (
    <RNText
      ref={ref as React.Ref<never>}
      {...rest}
      style={size ? [style, { fontSize: size * scale }] : style}
      onLayout={(e) => {
        fit();
        onLayout?.(e);
      }}
    />
  );
}

export function T({ v = 'body', style, color, ...rest }: TextProps & { v?: TV; color?: string }) {
  return <FitText maxFontSizeMultiplier={MAX_SCALE[v]} {...rest} style={[ts[v], color ? { color } : null, style]} />;
}

const mono: TextStyle = { fontFamily: F.mono, fontVariant: ['tabular-nums'], color: C.text };

export const ts = StyleSheet.create<Record<TV, TextStyle>>({
  display: { color: C.text, fontSize: 40, lineHeight: 44, fontFamily: ff(800), fontWeight: '800', letterSpacing: -1 },
  title: { color: C.text, fontSize: 30, lineHeight: 36, fontFamily: ff(800), fontWeight: '800', letterSpacing: -0.6 },
  h1: { color: C.text, fontSize: 22, lineHeight: 28, fontFamily: ff(800), fontWeight: '800', letterSpacing: -0.3 },
  h2: { color: C.text, fontSize: 17, lineHeight: 22, fontFamily: ff(700), fontWeight: '700', letterSpacing: -0.1 },
  h3: { color: C.text, fontSize: 15, lineHeight: 20, fontFamily: ff(700), fontWeight: '700' },
  body: { color: C.text, fontSize: 16, lineHeight: 22, fontFamily: F.regular },
  callout: { color: C.textDim, fontSize: 15, lineHeight: 21, fontFamily: F.regular },
  small: { color: C.textDim, fontSize: 13, lineHeight: 18, fontFamily: F.regular },
  tiny: { color: C.muted, fontSize: 12, lineHeight: 16, fontFamily: F.medium },
  label: { color: C.muted, fontSize: 11, lineHeight: 14, fontFamily: ff(700), fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  mono: { ...mono, fontSize: 15, lineHeight: 20 },
  monoS: { ...mono, fontSize: 12, lineHeight: 16, fontFamily: F.monoRegular, color: C.textDim },
  monoL: { ...mono, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  monoXL: { ...mono, fontSize: 40, lineHeight: 46, letterSpacing: -1.5 },
});

/** A signed money or chip amount, green when up and red when down. */
export function Amount({ value, text, v = 'mono', style, neutral }: { value: number; text: string; v?: TV; style?: StyleProp<TextStyle>; neutral?: boolean }) {
  // Privacy mode: not even the colour says whether it was a win.
  const hidden = moneyMasked();
  const col = hidden || neutral || value === 0 ? C.textDim : value > 0 ? C.good : C.bad;
  return (
    <T v={v} color={col} style={style}>
      {hidden ? MASK : value > 0 && !text.startsWith('+') ? '+' + text : text}
    </T>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

/** a11y: a row that reads as one line for screen readers (label and value together). */
type RowA11y = Partial<Pick<ViewProps, 'accessible' | 'accessibilityLabel' | 'accessibilityRole'>>;

export function Row({ children, style, gap = S.sm, ...a11y }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number } & RowA11y) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} {...a11y}>
      {children}
    </View>
  );
}

export function Spacer() {
  return <View style={{ flex: 1 }} />;
}

/**
 * A tab screen: safe area, a large title with actions on the right, and a
 * scroll view with the standard gutters. Pass `scroll={false}` to lay out your
 * own list (use `ScreenHeader` at the top of it).
 */
export function Screen({
  title,
  eyebrow,
  right,
  children,
  scroll = true,
  contentStyle,
  ...rest
}: {
  title?: React.ReactNode;
  eyebrow?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
} & Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>) {
  const insets = useSafeAreaInsets();
  if (!scroll)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        {children}
      </View>
    );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[{ paddingTop: insets.top + S.sm, paddingHorizontal: S.gutter, paddingBottom: 48, gap: S.xl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...rest}>
      {title !== undefined ? <ScreenHeader title={title} eyebrow={eyebrow} right={right} /> : null}
      {children}
    </ScrollView>
  );
}

/** Large title row used at the top of tab screens. */
export function ScreenHeader({ title, eyebrow, right, style }: { title: React.ReactNode; eyebrow?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: S.md, minHeight: 52 }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? <T v="label">{eyebrow}</T> : null}
        {typeof title === 'string' ? (
          <T v="title" numberOfLines={1}>
            {title}
          </T>
        ) : (
          title
        )}
      </View>
      {right ? <Row gap={S.sm}>{right}</Row> : null}
    </View>
  );
}

/** Header for a modal sheet: title on the left, a close button on the right. */
export function SheetHeader({ title, onClose, right, closeLabel }: { title: string; onClose: () => void; right?: React.ReactNode; closeLabel?: string }) {
  return (
    <View style={{ gap: S.md }}>
      <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.borderStrong, marginTop: -S.sm }} />
      <Row gap={S.md}>
        <T v="h1" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </T>
        {right}
        <IconButton name="close" onPress={onClose} label={closeLabel ?? t('Fechar')} />
      </Row>
    </View>
  );
}

/** A titled group: small caps label (and optional action) above the content. */
export function Section({
  title,
  action,
  onAction,
  children,
  style,
  hint,
}: {
  title?: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hint?: string;
}) {
  return (
    <View style={[{ gap: S.sm + 2 }, style]}>
      {title ? (
        <Row style={{ paddingHorizontal: 4, minHeight: 20 }}>
          <T v="label" style={{ flex: 1 }}>
            {title}
          </T>
          {action ? (
            <Pressable onPress={onAction} hitSlop={12}>
              <T v="small" color={C.accent} style={{ fontFamily: ff(700) }}>
                {action}
              </T>
            </Pressable>
          ) : null}
        </Row>
      ) : null}
      {children}
      {hint ? (
        <T v="tiny" style={{ paddingHorizontal: 4 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

// ─── Surfaces ────────────────────────────────────────────────────────────────

type CardTone = 'default' | 'raised' | 'accent' | 'warn' | 'good' | 'inset';

const CARD_TONE: Record<CardTone, ViewStyle> = {
  default: { backgroundColor: C.surface, borderColor: C.border },
  raised: { backgroundColor: C.surface2, borderColor: C.borderStrong },
  accent: { backgroundColor: C.accentSoft, borderColor: C.accentLine },
  warn: { backgroundColor: C.warnSoft, borderColor: 'rgba(245,184,61,0.35)' },
  good: { backgroundColor: C.goodSoft, borderColor: 'rgba(74,222,128,0.30)' },
  inset: { backgroundColor: C.bgDeep, borderColor: C.border },
};

export function Card({
  children,
  style,
  tone = 'default',
  onPress,
  onLongPress,
  padded = true,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: CardTone;
  onPress?: () => void;
  onLongPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  const base: ViewStyle = { borderRadius: R.lg, borderWidth: 1, padding: padded ? S.lg : 0, overflow: 'hidden', ...CARD_TONE[tone], ...(tone === 'default' || tone === 'raised' ? SHADOW : null) };
  if (!onPress)
    return (
      <View style={[base, style]} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tap();
        onPress();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => [base, pressed ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null, style]}>
      {children}
    </Pressable>
  );
}

/** Older name for Card, kept so existing screens keep working. */
export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Card style={style}>{children}</Card>;
}

export function Divider({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: C.borderStrong, marginLeft: inset }, style]} />;
}

// ─── Lists ───────────────────────────────────────────────────────────────────

/** Inset grouped list (iOS settings style): rows share one card with hairlines. */
export function ListGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Card padded={false} style={style}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <Divider inset={S.lg} /> : null}
          {child}
        </React.Fragment>
      ))}
    </Card>
  );
}

export function ListItem({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  valueColor,
  right,
  onPress,
  chevron,
  destructive,
  left,
  numberOfLines = 2,
  accessibilityLabel,
}: {
  icon?: IconName;
  iconColor?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: string;
  valueColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  left?: React.ReactNode;
  numberOfLines?: number;
  /** What VoiceOver reads for the row, when the visible text alone reads out of order. */
  accessibilityLabel?: string;
}) {
  // At 160%+ text the icon tile and chevron leave too little room: titles broke mid-word ("Viagen s").
  const bigText = useWindowDimensions().fontScale >= 1.6;
  const body = (
    <>
      {left}
      {icon && !bigText ? (
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: (iconColor ? iconColor : C.text) === C.text ? C.surface3 : softOf(iconColor!), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={17} color={iconColor ?? (destructive ? C.danger : C.text)} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === 'string' ? (
          <T v="body" numberOfLines={numberOfLines} color={destructive ? C.danger : undefined} style={{ fontFamily: F.medium }}>
            {title}
          </T>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <T v="small" numberOfLines={3}>
              {subtitle}
            </T>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {value ? (
        // Capped, so a long amount at large text can't squeeze the title to nothing.
        <T v="mono" color={valueColor ?? C.textDim} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, maxWidth: '45%', textAlign: 'right' }}>
          {value}
        </T>
      ) : null}
      {right}
      {chevron ?? !!onPress ? <Ionicons name="chevron-forward" size={17} color={C.muted} /> : null}
    </>
  );
  const st: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, paddingVertical: 12, minHeight: 52 };
  if (!onPress)
    return (
      <View style={st} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [st, pressed ? { backgroundColor: C.surface2 } : null]}>
      {body}
    </Pressable>
  );
}

function softOf(hex: string) {
  if (!hex.startsWith('#') || hex.length !== 7) return C.surface3;
  return hex + '24';
}

/** A setting with an on/off switch, used inside a ListGroup. */
export function ToggleItem({ title, subtitle, value, onChange, icon, iconColor, lines = 2 }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName; iconColor?: string; lines?: number }) {
  const flip = (v: boolean) => {
    tap('select');
    onChange(v);
  };
  // The whole row flips it, like iOS Settings; VoiceOver reads one switch, not a row plus a switch.
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ checked: value }}
      onPress={() => flip(!value)}
      style={({ pressed }) => (pressed ? { backgroundColor: C.surface2 } : null)}>
      <ListItem
        icon={icon}
        iconColor={iconColor}
        title={title}
        subtitle={subtitle}
        numberOfLines={lines}
        chevron={false}
        right={
          <Switch
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            value={value}
            onValueChange={flip}
            trackColor={{ true: C.accent, false: C.surface3 }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={C.surface3}
            // react-native-web only: its default "on" thumb is teal.
            {...({ activeThumbColor: '#FFFFFF' } as object)}
          />
        }
      />
    </Pressable>
  );
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

/** A labelled number tile. `tone` colours the value. */
export function Stat({
  label,
  value,
  sub,
  tone,
  style,
  big,
  onPress,
  locked,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad' | 'accent' | 'warn';
  style?: StyleProp<ViewStyle>;
  big?: boolean;
  onPress?: () => void;
  locked?: boolean;
}) {
  const col = tone === 'good' ? C.good : tone === 'bad' ? C.bad : tone === 'accent' ? C.accent : tone === 'warn' ? C.warn : C.text;
  return (
    <Card
      onPress={onPress}
      style={[{ flex: 1, gap: 6, paddingVertical: S.md + 2, paddingHorizontal: S.md + 2 }, style]}
      // Read as one line: "Por hora: 26 €. Lucro ÷ horas à mesa".
      accessibilityLabel={`${label}: ${locked ? t('Pro') : value}${sub ? '. ' + sub : ''}`}>
      <Row gap={4}>
        <T v="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1 }}>
          {label}
        </T>
        {locked ? <Ionicons name="lock-closed" size={10} color={C.accent} /> : null}
      </Row>
      <T v={big ? 'monoL' : 'mono'} color={locked ? C.muted : col} numberOfLines={1} adjustsFontSizeToFit style={big ? null : { fontSize: 18, lineHeight: 24 }}>
        {value}
      </T>
      {sub ? (
        <T v="tiny" numberOfLines={2}>
          {sub}
        </T>
      ) : null}
    </Card>
  );
}

/** Lays stats out in rows of `cols`, all the same width. */
export function StatGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: number }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={{ gap: S.sm }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: S.sm }}>
          {r}
          {r.length < cols ? Array.from({ length: cols - r.length }, (_, k) => <View key={'f' + k} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'plain' | 'outline';
type BtnSize = 'lg' | 'md' | 'sm';

export function Button({
  title,
  kind = 'primary',
  onPress,
  disabled,
  style,
  icon,
  iconRight,
  small,
  size,
  haptic,
  sub,
  lines = 1,
}: {
  title: string;
  kind?: BtnKind;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** An Ionicons name, or any node. */
  icon?: IconName | React.ReactNode;
  iconRight?: IconName;
  small?: boolean;
  size?: BtnSize;
  /** Defaults to a light tap on primary buttons only: haptics are for moments that count. */
  haptic?: boolean;
  /** Second line under the title (primary buttons with a price, say). */
  sub?: string;
  /** Lines the title may take in a narrow slot. Web can't shrink text, and 200% may not fit in one line even shrunk. */
  lines?: 1 | 2;
}) {
  const sz: BtnSize = size ?? (small ? 'sm' : 'lg');
  const h = sz === 'lg' ? 54 : sz === 'md' ? 44 : 36;
  const bg =
    kind === 'primary' ? C.accent : kind === 'secondary' ? C.surface3 : kind === 'danger' ? C.dangerSoft : kind === 'outline' ? C.accentSoft : 'transparent';
  const fg = kind === 'primary' ? C.accentInk : kind === 'danger' ? C.danger : kind === 'outline' || kind === 'plain' ? C.accent : C.text;
  const fs = sz === 'lg' ? 17 : sz === 'md' ? 15 : 14;
  const iconNode = typeof icon === 'string' ? <Ionicons name={icon as IconName} size={fs + 2} color={fg} /> : icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={sz === 'sm' ? 4 : 0}
      onPress={() => {
        if (haptic ?? kind === 'primary') tap('light');
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: kind === 'primary' && pressed ? C.accentPressed : bg,
          borderRadius: sz === 'sm' ? R.pill : R.md + 2,
          minHeight: h,
          paddingVertical: sub ? 8 : 0,
          paddingHorizontal: sz === 'sm' ? 14 : 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.4 : pressed && kind !== 'primary' ? 0.75 : 1,
          borderWidth: kind === 'ghost' || kind === 'outline' ? 1 : 0,
          borderColor: kind === 'outline' ? C.accentLine : C.borderStrong,
        },
        kind === 'primary' && !disabled ? { shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 } : null,
        style,
      ]}>
      {iconNode}
      {/* Shrinks to fit a narrow slot (the session dock at 200%) instead of cutting to "Nova…". */}
      <View style={{ alignItems: 'center', flexShrink: 1 }}>
        <FitText numberOfLines={lines} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={CONTROL_SCALE} style={{ color: fg, fontWeight: '800', fontFamily: ff(800), fontSize: fs, letterSpacing: -0.1, textAlign: 'center' }}>
          {title}
        </FitText>
        {sub ? <RNText maxFontSizeMultiplier={CONTROL_SCALE} style={{ color: fg, opacity: 0.75, fontFamily: F.medium, fontSize: 12 }}>{sub}</RNText> : null}
      </View>
      {iconRight ? <Ionicons name={iconRight} size={fs + 1} color={fg} /> : null}
    </Pressable>
  );
}

/** Round icon-only button (44 pt target). */
export function IconButton({
  name,
  onPress,
  label,
  color,
  bg,
  size = 40,
  badge,
}: {
  name: IconName;
  onPress?: () => void;
  label: string;
  color?: string;
  bg?: string;
  size?: number;
  badge?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Math.max(0, (44 - size) / 2)}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? C.surface2,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}>
      <Ionicons name={name} size={Math.round(size * 0.48)} color={color ?? C.text} />
      {badge ? <View style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.bg }} /> : null}
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
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
  icon?: IconName;
}) {
  const col = color ?? C.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      onPress={() => {
        tap('select');
        onPress?.();
      }}
      hitSlop={big ? 0 : 5}
      style={({ pressed }) => [
        {
          minHeight: big ? 44 : 34,
          paddingHorizontal: big ? 16 : 13,
          borderRadius: R.pill,
          borderWidth: 1,
          borderColor: active ? col : C.border,
          backgroundColor: active ? (col === C.accent ? C.accentSoft : col + '22') : C.surface2,
          opacity: pressed ? 0.75 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={big ? 16 : 14} color={active ? col : C.textDim} /> : null}
      <RNText numberOfLines={1} maxFontSizeMultiplier={CONTROL_SCALE} style={{ color: active ? col : C.textDim, fontWeight: '700', fontFamily: ff(700), fontSize: big ? 15 : 14 }}>
        {label}
      </RNText>
    </Pressable>
  );
}

/** A row of chips that scrolls sideways instead of wrapping onto new lines. */
export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[{ marginHorizontal: -S.gutter, flexGrow: 0 }, style]}
      contentContainerStyle={{ gap: S.sm, paddingHorizontal: S.gutter }}>
      {children}
    </ScrollView>
  );
}

/** Segmented control: one choice out of 2 to 4. */
export function Segmented<K extends string | number>({
  options,
  value,
  onChange,
  style,
  size = 'md',
}: {
  options: { key: K; label: string; locked?: boolean }[];
  value: K;
  onChange: (k: K) => void;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'sm';
}) {
  return (
    <View accessibilityRole="tablist" style={[{ flexDirection: 'row', backgroundColor: C.bgDeep, borderRadius: R.md, padding: 3, borderWidth: 1, borderColor: C.fieldBorder }, style]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.locked ? `${o.label}, Pro` : o.label}
            // 36pt drawn, 44pt to the finger.
            hitSlop={{ top: size === 'md' ? 7 : 9, bottom: size === 'md' ? 7 : 9 }}
            onPress={() => {
              tap('select');
              onChange(o.key);
            }}
            style={{
              flex: 1,
              minHeight: size === 'md' ? 36 : 32,
              borderRadius: R.sm + 1,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 4,
              backgroundColor: on ? C.surface3 : 'transparent',
              ...(on ? SHADOW : null),
            }}>
            <RNText numberOfLines={1} maxFontSizeMultiplier={CONTROL_SCALE} style={{ color: on ? C.text : C.muted, fontFamily: ff(700), fontWeight: '700', fontSize: size === 'md' ? 14 : 13 }}>
              {o.label}
            </RNText>
            {o.locked ? <Ionicons name="lock-closed" size={10} color={C.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// Badges and pills repeat on every hand row: their styles are built once per colour.
const tagSt = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: R.xs, alignSelf: 'flex-start' },
  badgeText: { fontFamily: ff(800), fontWeight: '800', fontSize: 11, letterSpacing: 0.3 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 22, paddingVertical: 2, borderRadius: R.pill },
  pillText: { fontFamily: ff(700), fontWeight: '700', fontSize: 12 },
});
const tint = new Map<string, { bg: ViewStyle; fg: TextStyle }>();
function tinted(bg: string, fg: string) {
  const k = bg + fg;
  let v = tint.get(k);
  if (!v) tint.set(k, (v = StyleSheet.create({ bg: { backgroundColor: bg }, fg: { color: fg } })));
  return v;
}

/** Small coloured tag: positions (BTN, CO…) or labels. */
export const Badge = React.memo(function Badge({ label, color, solid, style }: { label: string; color?: string; solid?: boolean; style?: StyleProp<ViewStyle> }) {
  const col = color ?? posColor(label);
  const tn = tinted(solid ? col : col + '26', solid ? C.bgDeep : col);
  return (
    <View style={[tagSt.badge, tn.bg, style]}>
      <RNText maxFontSizeMultiplier={CONTROL_SCALE} style={[tagSt.badgeText, tn.fg]}>{label}</RNText>
    </View>
  );
});

/** Rounded label for tags and states. */
export const Pill = React.memo(function Pill({ label, color, icon, style }: { label: string; color?: string; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const col = color ?? C.textDim;
  const tn = tinted(color ? col + '1F' : C.surface3, col);
  return (
    <View style={[tagSt.pill, tn.bg, style]}>
      {icon ? <Ionicons name={icon} size={11} color={col} /> : null}
      <RNText numberOfLines={1} maxFontSizeMultiplier={CONTROL_SCALE} style={[tagSt.pillText, tn.fg]}>
        {label}
      </RNText>
    </View>
  );
});

// ─── Inputs ──────────────────────────────────────────────────────────────────

export const inputStyle = {
  backgroundColor: C.bgDeep,
  borderRadius: R.md,
  borderWidth: 1,
  borderColor: C.fieldBorder,
  color: C.text,
  paddingHorizontal: 14,
  minHeight: 48,
  paddingVertical: 12,
  fontSize: 16,
  fontWeight: '600' as const,
  fontFamily: ff(600),
};

export function Field({ label, style, inputStyle: ist, hint, ...rest }: TextInputProps & { label?: string; hint?: string; inputStyle?: StyleProp<TextStyle> }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={[{ gap: 6, flex: rest.multiline ? undefined : undefined }, style as StyleProp<ViewStyle>]}>
      {label ? <T v="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={C.muted}
        selectionColor={C.accent}
        maxFontSizeMultiplier={CONTROL_SCALE}
        {...rest}
        accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={[inputStyle, focus ? { borderColor: C.accentLine } : null, rest.multiline ? { minHeight: 110, textAlignVertical: 'top' } : null, ist]}
      />
      {hint ? <T v="tiny">{hint}</T> : null}
    </View>
  );
}

/** Whole-number field: chips, money, places. */
export function NumField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <Field
      label={label}
      style={{ flex: 1 }}
      value={value ? String(value) : ''}
      onChangeText={(x) => onChange(parseInt(x.replace(/\D/g, ''), 10) || 0)}
      keyboardType="number-pad"
      placeholder={suffix ? `0 ${suffix}` : '0'}
      inputStyle={{ fontFamily: F.mono, fontVariant: ['tabular-nums'] }}
    />
  );
}

export function SearchField({ value, onChange, placeholder, style, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; style?: StyleProp<ViewStyle>; autoFocus?: boolean }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: 12, borderWidth: 1, borderColor: C.fieldBorder, minHeight: 44, gap: 8 }, style]}>
      <Ionicons name="search" size={17} color={C.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxFontSizeMultiplier={CONTROL_SCALE}
        placeholderTextColor={C.muted}
        selectionColor={C.accent}
        returnKeyType="search"
        style={{ flex: 1, color: C.text, fontSize: 16, fontFamily: F.regular, paddingVertical: 0 }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel={t('Limpar')}>
          <Ionicons name="close-circle" size={18} color={C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Feedback ────────────────────────────────────────────────────────────────

/** A one-line strip that says something about now: a live session, a draft, the free limit. */
export function Banner({
  tone = 'accent',
  icon,
  title,
  body,
  action,
  onPress,
  onDismiss,
  dismissLabel,
  live,
}: {
  tone?: 'accent' | 'warn' | 'info' | 'good';
  icon?: IconName;
  title: string;
  body?: string;
  action?: string;
  onPress?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  live?: boolean;
}) {
  const col = tone === 'warn' ? C.warn : tone === 'info' ? C.info : tone === 'good' ? C.good : C.accent;
  return (
    <Card tone={tone === 'info' ? 'raised' : tone} onPress={onPress} style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
      <Row gap={12}>
        {live ? (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: col, shadowColor: col, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />
        ) : icon ? (
          <Ionicons name={icon} size={18} color={col} />
        ) : null}
        <View style={{ flex: 1, gap: 1 }}>
          <T v="h3" color={col}>
            {title}
          </T>
          {body ? <T v="small">{body}</T> : null}
        </View>
        {action ? (
          <T v="small" color={col} style={{ fontFamily: ff(800) }}>
            {action}
          </T>
        ) : null}
        {onDismiss ? (
          // Its own tap target, set apart by a hairline, so it isn't hit while reaching for the banner.
          <Pressable
            onPress={onDismiss}
            hitSlop={{ top: 12, bottom: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel ?? t('Fechar')}
            style={{ alignSelf: 'stretch', justifyContent: 'center', paddingLeft: 14, marginLeft: 2, borderLeftWidth: 1, borderLeftColor: C.border }}>
            <Ionicons name="close" size={18} color={C.muted} />
          </Pressable>
        ) : onPress && !action ? (
          <Ionicons name="chevron-forward" size={17} color={col} />
        ) : null}
      </Row>
    </Card>
  );
}

export function Empty({ title, body, action, icon }: { title: string; body?: string; action?: React.ReactNode; icon?: IconName }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 12, gap: 12 }}>
      {icon ? (
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <Ionicons name={icon} size={28} color={C.accent} />
        </View>
      ) : null}
      <T v="h1" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T v="callout" style={{ textAlign: 'center', maxWidth: 320 }}>
          {body}
        </T>
      ) : null}
      {action ? <View style={{ alignSelf: 'stretch', marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

export function PressRow({ children, style, ...rest }: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

// Brand wordmark: "Sweat" in text colour + "book" in accent.
export function Wordmark({ size = 30 }: { size?: number }) {
  const st: TextStyle = { fontSize: size, fontFamily: ff(800), fontWeight: '800', letterSpacing: -0.035 * size };
  return (
    <RNText numberOfLines={1} allowFontScaling={false} style={[st, { color: C.text }]}>
      Sweat<RNText style={{ color: C.accent }}>book</RNText>
    </RNText>
  );
}
