// iOS Live Activity for the running session: lock screen banner and Dynamic
// Island. The layout below is serialized by the 'widget' directive and runs in
// the widget extension, so it can only use its props, @expo/ui and literals
// (no theme import, no helpers from outside the function). Colours are the
// "Noite" tokens from src/theme.ts, copied by value.

import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, background, cornerRadius, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivity } from 'expo-widgets';

import type { LiveProps } from './live-state';

const SessionActivity = createLiveActivity<LiveProps>('SweatbookSession', (p, env) => {
  'widget';
  const text = '#F1F4F2';
  const dim = '#B4BFBA';
  const accent = '#FF6A3D';
  const warn = '#F5B83D';
  const good = '#4ADE80';
  const DAY = 86400000;
  const clock = (size: number) => (
    <Text
      timerInterval={{ lower: new Date(p.clockFrom), upper: new Date(p.clockFrom + DAY) }}
      countsDown={false}
      pauseTime={p.pausedAt ? new Date(p.pausedAt) : undefined}
      modifiers={[font({ size, weight: 'bold', design: 'monospaced' }), monospacedDigit(), foregroundStyle(p.paused ? warn : text)]}
    />
  );
  const label = (s: string) => <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(dim)]}>{s.toUpperCase()}</Text>;
  const levelDue = p.nextLevelAt > 0 && (env.isStale || p.nextLevelAt <= Date.now());
  const countdown =
    p.nextLevelAt > 0 && !levelDue ? (
      <Text
        timerInterval={{ lower: new Date(Math.min(p.clockFrom, p.nextLevelAt)), upper: new Date(p.nextLevelAt) }}
        countsDown
        modifiers={[font({ size: 13, weight: 'semibold', design: 'monospaced' }), monospacedDigit(), foregroundStyle(dim)]}
      />
    ) : null;
  const newHand = (
    <Link destination="sweatbook://hand/new" modifiers={[frame({ maxWidth: 10000 }), padding({ top: 10, bottom: 10 }), background(accent), cornerRadius(12)]}>
      <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle('#1A0A04')]}>{'+ ' + p.labels.newHand}</Text>
    </Link>
  );
  // A tournament: its chip count as a story, without opening the session first.
  const actions = p.shareUrl ? (
    <HStack spacing={8}>
      {newHand}
      <Link destination={p.shareUrl} modifiers={[padding({ top: 10, bottom: 10, leading: 14, trailing: 14 }), background('#1A2521'), cornerRadius(12)]}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(text)]}>{p.labels.shareStack}</Text>
      </Link>
    </HStack>
  ) : (
    newHand
  );

  // The banner carries the app's own wordmark, small and dim like a system app
  // name: it says whose session this is, it isn't an ad.
  return {
    banner: (
      <VStack alignment="leading" spacing={12} modifiers={[padding({ all: 16 }), activityBackgroundTint('#0C1311')]}>
        <HStack spacing={6}>
          <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(p.paused ? warn : good)]}>{'● ' + p.status.toUpperCase()}</Text>
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(dim), lineLimit(1)]}>{p.title}</Text>
          <Spacer />
          <HStack spacing={0}>
            <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(dim)]}>Sweat</Text>
            <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(accent)]}>book</Text>
          </HStack>
        </HStack>
        <HStack alignment="top" spacing={12}>
          <VStack alignment="leading" spacing={2}>
            {label(p.labels.time)}
            {clock(28)}
          </VStack>
          <Spacer />
          <VStack alignment="leading" spacing={2}>
            {label(p.labels.stack)}
            <Text modifiers={[font({ size: 20, weight: 'bold', design: 'monospaced' }), foregroundStyle(text)]}>{p.stack}</Text>
            <Text modifiers={[font({ size: 12, design: 'monospaced' }), foregroundStyle(dim)]}>{p.stackBB}</Text>
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={2}>
            {label(p.level)}
            <Text modifiers={[font({ size: 20, weight: 'bold', design: 'monospaced' }), foregroundStyle(text)]}>{p.blinds}</Text>
            {levelDue ? (
              <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(accent)]}>{p.labels.levelUp + ' → ' + p.nextBlinds}</Text>
            ) : countdown ? (
              <HStack spacing={4}>
                <Text modifiers={[font({ size: 12 }), foregroundStyle(dim)]}>{p.labels.next}</Text>
                {countdown}
              </HStack>
            ) : null}
          </VStack>
        </HStack>
        {p.breakAt ? <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(warn)]}>{p.breakAt}</Text> : null}
        {actions}
      </VStack>
    ),
    compactLeading: <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(accent)]}>♠︎</Text>,
    compactTrailing: (
      <Text modifiers={[font({ size: 14, weight: 'bold', design: 'monospaced' }), foregroundStyle(text)]}>{p.stackBB}</Text>
    ),
    minimal: <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(accent)]}>♠︎</Text>,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        {label(p.labels.time)}
        {clock(22)}
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ trailing: 4 })]}>
        {label(p.level)}
        <Text modifiers={[font({ size: 18, weight: 'bold', design: 'monospaced' }), foregroundStyle(levelDue ? accent : text)]}>{p.blinds}</Text>
      </VStack>
    ),
    expandedCenter: (
      <VStack spacing={2}>
        {label(p.labels.stack)}
        <Text modifiers={[font({ size: 18, weight: 'bold', design: 'monospaced' }), foregroundStyle(text)]}>{p.stack}</Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={8}>
        {p.breakAt ? <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(warn)]}>{p.breakAt}</Text> : null}
        {actions}
      </VStack>
    ),
  };
});

let current: LiveActivity<LiveProps> | null = null;

/** Show or refresh the session on the lock screen. */
export async function showSession(props: LiveProps): Promise<void> {
  // After a relaunch the activity is still up: pick it back up instead of starting a second one.
  current ??= SessionActivity.getInstances()[0] ?? null;
  const stale = props.nextLevelAt ? new Date(props.nextLevelAt) : undefined;
  if (current) await current.update(props, stale);
  else current = SessionActivity.start(props, 'sweatbook://session', stale);
}

/** Take it off the lock screen (session ended or deleted). */
export async function endSession(): Promise<void> {
  const all = current ? [current, ...SessionActivity.getInstances().filter((a) => a.getId() !== current!.getId())] : SessionActivity.getInstances();
  current = null;
  await Promise.all(all.map((a) => a.end('immediate')));
}
