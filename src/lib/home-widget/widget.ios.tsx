// iOS home-screen widget, small and medium. With a session running it shows
// the live clock, stack and blinds (medium adds a "Nova mão" button);
// otherwise this week's result and the logging streak. Like the Live
// Activity, the layout is serialized by the 'widget' directive, so it only
// uses its props, @expo/ui and literals; colours are the "Noite" tokens.

import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, containerBackground, cornerRadius, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import type { WidgetProps } from './widget-state';

const HomeWidget = createWidget<WidgetProps>('SweatbookHome', (p, env) => {
  'widget';
  const bg = '#0C1311';
  const text = '#F1F4F2';
  const dim = '#B4BFBA';
  const accent = '#FF6A3D';
  const warn = '#F5B83D';
  const good = '#4ADE80';
  const bad = '#F87171';
  const DAY = 86400000;
  const medium = env.widgetFamily === 'systemMedium';
  const label = (s: string) => <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(dim)]}>{s.toUpperCase()}</Text>;
  const mono = (s: string, size: number, color: string) => (
    <Text modifiers={[font({ size, weight: 'bold', design: 'monospaced' }), monospacedDigit(), foregroundStyle(color), lineLimit(1)]}>{s}</Text>
  );
  const shell = (url: string) => [containerBackground(bg, 'widget'), widgetURL(url)];

  if (p.live) {
    const clock = (
      <Text
        timerInterval={{ lower: new Date(p.clockFrom), upper: new Date(p.clockFrom + DAY) }}
        countsDown={false}
        pauseTime={p.pausedAt ? new Date(p.pausedAt) : undefined}
        modifiers={[font({ size: medium ? 30 : 26, weight: 'bold', design: 'monospaced' }), monospacedDigit(), foregroundStyle(p.paused ? warn : text)]}
      />
    );
    const head = <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(p.paused ? warn : good)]}>{'● ' + p.status.toUpperCase()}</Text>;
    if (!medium) {
      return (
        <VStack alignment="leading" spacing={4} modifiers={shell('sweatbook://session')}>
          {head}
          {clock}
          <Spacer />
          {label(p.labels.stack)}
          {mono(p.stack, 17, text)}
          <Text modifiers={[font({ size: 12, design: 'monospaced' }), foregroundStyle(dim), lineLimit(1)]}>{p.stackBB + ' · ' + p.blinds}</Text>
        </VStack>
      );
    }
    return (
      <VStack alignment="leading" spacing={8} modifiers={shell('sweatbook://session')}>
        <HStack>
          {head}
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(dim), lineLimit(1)]}>{p.title}</Text>
        </HStack>
        <HStack alignment="top" spacing={12}>
          <VStack alignment="leading" spacing={2}>
            {label(p.labels.time)}
            {clock}
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={2}>
            {label(p.labels.stack)}
            {mono(p.stack, 18, text)}
            <Text modifiers={[font({ size: 12, design: 'monospaced' }), foregroundStyle(dim)]}>{p.stackBB + ' · ' + p.blinds}</Text>
          </VStack>
        </HStack>
        <Link destination="sweatbook://hand/new" modifiers={[frame({ maxWidth: 10000 }), padding({ top: 8, bottom: 8 }), background(accent), cornerRadius(12)]}>
          <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle('#1A0A04')]}>{'+ ' + p.labels.newHand}</Text>
        </Link>
      </VStack>
    );
  }

  const resultColor = p.tone === 'up' ? good : p.tone === 'down' ? bad : text;
  const streak = (
    <HStack spacing={4}>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(p.streakOn ? accent : dim)]}>{'🔥'}</Text>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(p.streakOn ? text : dim), lineLimit(1)]}>{p.streak}</Text>
    </HStack>
  );
  if (!medium) {
    return (
      <VStack alignment="leading" spacing={4} modifiers={shell('sweatbook://')}>
        {label(p.week)}
        {mono(p.result, 24, resultColor)}
        <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(1)]}>{p.weekSub}</Text>
        <Spacer />
        {streak}
      </VStack>
    );
  }
  return (
    <HStack alignment="center" spacing={12} modifiers={shell('sweatbook://')}>
      <VStack alignment="leading" spacing={4}>
        {label(p.week)}
        {mono(p.result, 28, resultColor)}
        <Text modifiers={[font({ size: 12 }), foregroundStyle(dim), lineLimit(1)]}>{p.weekSub}</Text>
        <Spacer />
        {streak}
      </VStack>
      <Spacer />
      <Link destination="sweatbook://hand/new" modifiers={[padding({ top: 10, bottom: 10, leading: 14, trailing: 14 }), background(accent), cornerRadius(12)]}>
        <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle('#1A0A04')]}>{'+ ' + p.labels.newHand}</Text>
      </Link>
    </HStack>
  );
});

export function updateWidget(props: WidgetProps): void {
  HomeWidget.updateSnapshot(props);
}
