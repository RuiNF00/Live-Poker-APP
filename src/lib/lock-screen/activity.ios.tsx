// iOS Live Activity for the running session: lock screen banner and Dynamic
// Island. The layout below is serialized by the 'widget' directive and runs in
// the widget extension, so it can only use its props, @expo/ui and literals
// (no theme import, no helpers from outside the function). Colours are the
// "Noite" tokens from src/theme.ts, copied by value.

import { HStack, Image, Link, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, activityBackgroundTint, background, cornerRadius, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivity } from 'expo-widgets';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { LiveProps } from './live-state';

const SessionActivity = createLiveActivity<LiveProps>('SweatbookSession', (p, env) => {
  'widget';
  const text = '#F1F4F2';
  const dim = '#B4BFBA';
  const accent = '#FF6A3D';
  const warn = '#F5B83D';
  const good = '#4ADE80';
  const track = '#1A2521';
  const DAY = 86400000;
  const pauseAt = p.pausedAt ? new Date(p.pausedAt) : undefined;
  const mono = (size: number, color: string, weight: 'bold' | 'semibold' | 'regular' = 'bold') => [font({ size, weight, design: 'monospaced' }), monospacedDigit(), foregroundStyle(color)];
  const clock = (size: number, color = p.paused ? warn : text) => (
    <Text timerInterval={{ lower: new Date(p.clockFrom), upper: new Date(p.clockFrom + DAY) }} countsDown={false} pauseTime={pauseAt} modifiers={mono(size, color)} />
  );
  const label = (s: string, color = dim) => <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(color), lineLimit(1)]}>{s.toUpperCase()}</Text>;
  // A tournament with a level clock: the time to the next level is what a glance is for.
  const leveled = p.levelFrom > 0;
  // A break stops the level clock with the session clock, so a paused level never reads as due.
  const levelDue = leveled && !p.paused && (env.isStale || p.nextLevelAt <= Date.now());
  const countdown = (size: number, color = p.paused ? warn : text) => (
    <Text timerInterval={{ lower: new Date(p.levelFrom), upper: new Date(p.nextLevelAt) }} countsDown pauseTime={pauseAt} modifiers={mono(size, color)} />
  );
  // Fills as the level runs; frozen at the pause during a break.
  const levelBar = p.paused ? (
    <ProgressView value={Math.min(1, Math.max(0, (p.pausedAt - p.levelFrom) / (p.nextLevelAt - p.levelFrom)))} modifiers={[tint(warn)]} />
  ) : (
    <ProgressView timerInterval={{ lower: new Date(p.levelFrom), upper: new Date(p.nextLevelAt) }} countsDown={false} modifiers={[tint(accent)]} />
  );
  const newHand = (
    <Link destination="sweatbook://hand/new" modifiers={[frame({ maxWidth: 10000 }), padding({ top: 9, bottom: 9 }), background(accent), cornerRadius(12)]}>
      <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle('#1A0A04'), lineLimit(1)]}>{'+ ' + p.labels.newHand}</Text>
    </Link>
  );
  // Secondary actions, one tap each: they open the session screen, which does them with "Anular"
  // (only once the app lock, if any, is open). Icons keep the row on one line in every language.
  const small = (url: string, icon: SFSymbol, name: string) => (
    <Link destination={url} modifiers={[padding({ top: 9, bottom: 9, leading: 13, trailing: 13 }), background(track), cornerRadius(12), accessibilityLabel(name)]}>
      <Image systemName={icon} size={16} color={text} />
    </Link>
  );
  const actions = (
    <HStack spacing={8}>
      {newHand}
      {small(p.pauseUrl, p.paused ? 'play.fill' : 'pause.fill', p.labels.pause)}
      {small(p.rebuyUrl, 'arrow.counterclockwise', p.labels.rebuy)}
      {/* A tournament: its chip count as a story, without opening the session first. */}
      {p.shareUrl ? small(p.shareUrl, 'square.and.arrow.up', p.labels.shareStack) : null}
    </HStack>
  );
  const stackCol = (size: number) => (
    <VStack alignment="leading" spacing={2}>
      {label(p.labels.stack)}
      <Text modifiers={[...mono(size, text), lineLimit(1)]}>{p.stack}</Text>
      <Text modifiers={mono(12, dim, 'regular')}>{p.stackBB}</Text>
    </VStack>
  );
  const blindsCol = (
    <VStack alignment="trailing" spacing={2}>
      {label(leveled ? p.labels.blinds : p.level)}
      <Text modifiers={[...mono(20, levelDue ? accent : text), lineLimit(1)]}>{p.blinds}</Text>
      {levelDue ? (
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(accent), lineLimit(1)]}>{p.labels.levelUp + ' → ' + p.nextBlinds}</Text>
      ) : leveled ? (
        <Text modifiers={[...mono(12, dim, 'regular'), lineLimit(1)]}>{'→ ' + p.nextBlinds}</Text>
      ) : null}
    </VStack>
  );

  // The banner carries the app's own wordmark, small and dim like a system app
  // name: it says whose session this is, it isn't an ad.
  const head = (
    <HStack spacing={6}>
      <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(p.paused ? warn : good)]}>{'● ' + p.status.toUpperCase()}</Text>
      {leveled ? clock(12, dim) : <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(dim), lineLimit(1)]}>{p.title}</Text>}
      <Spacer />
      {p.breakAt ? (
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(warn), lineLimit(1)]}>{p.breakAt}</Text>
      ) : (
        <HStack spacing={0}>
          <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(dim)]}>Sweat</Text>
          <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(accent)]}>book</Text>
        </HStack>
      )}
    </HStack>
  );
  // Tournament with a level clock: the level countdown leads, a bar shows how much of the level is gone,
  // and the played time moves to the line below. Otherwise (cash, no level length): the played time leads.
  // The lock screen gives a Live Activity about 160 pt: header, numbers, (level bar,) buttons.
  const shell = [padding({ top: 14, bottom: 14, leading: 16, trailing: 16 }), activityBackgroundTint('#0C1311')];
  const banner = leveled ? (
    <VStack alignment="leading" spacing={8} modifiers={shell}>
      {head}
      <HStack alignment="top" spacing={12}>
        <VStack alignment="leading" spacing={2}>
          {label(p.level + ' · ' + p.labels.next, levelDue ? accent : dim)}
          {countdown(28, levelDue ? accent : p.paused ? warn : text)}
        </VStack>
        <Spacer />
        {stackCol(20)}
        <Spacer />
        {blindsCol}
      </HStack>
      {levelBar}
      {actions}
    </VStack>
  ) : (
    <VStack alignment="leading" spacing={8} modifiers={shell}>
      {head}
      <HStack alignment="top" spacing={12}>
        <VStack alignment="leading" spacing={2}>
          {label(p.labels.time)}
          {clock(28)}
        </VStack>
        <Spacer />
        {stackCol(20)}
        <Spacer />
        {blindsCol}
      </HStack>
      {actions}
    </VStack>
  );

  return {
    banner,
    // Compact island: stack in big blinds on the left, the level countdown (or the played time) on the right.
    // Timer text takes all the width it can, so it gets a fixed one.
    compactLeading: <Text modifiers={[...mono(14, text), lineLimit(1)]}>{p.stackBB}</Text>,
    compactTrailing: leveled ? (
      levelDue ? (
        <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(accent)]}>↑</Text>
      ) : (
        <VStack modifiers={[frame({ width: 52, alignment: 'trailing' })]}>{countdown(14, p.paused ? warn : accent)}</VStack>
      )
    ) : (
      <VStack modifiers={[frame({ width: 64, alignment: 'trailing' })]}>{clock(14)}</VStack>
    ),
    minimal: <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(levelDue ? warn : accent)]}>{levelDue ? '↑' : '♠︎'}</Text>,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        {leveled ? label(p.labels.next, levelDue ? accent : dim) : label(p.labels.time)}
        {leveled ? countdown(22, levelDue ? accent : p.paused ? warn : text) : clock(22)}
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ trailing: 4 })]}>
        {label(p.level)}
        <Text modifiers={mono(18, levelDue ? accent : text)}>{p.blinds}</Text>
      </VStack>
    ),
    expandedCenter: (
      <VStack spacing={2}>
        {label(p.labels.stack)}
        <Text modifiers={mono(18, text)}>{p.stack}</Text>
        <Text modifiers={mono(11, dim, 'regular')}>{p.stackBB}</Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={8}>
        {leveled ? levelBar : null}
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
  // Only ever one on the lock screen: any other left over (a start that raced a relaunch) goes.
  const extra = SessionActivity.getInstances().filter((a) => a.getId() !== current?.getId());
  await Promise.all(extra.map((a) => a.end('immediate').catch(() => {})));
  // Stale once the level should have gone up; a break stops that clock, so no stale date while paused.
  const stale = props.nextLevelAt && !props.paused ? new Date(props.nextLevelAt) : undefined;
  if (current) await current.update(props, stale);
  else current = SessionActivity.start(props, 'sweatbook://session', stale);
}

/** Take it off the lock screen (session ended or deleted). */
export async function endSession(): Promise<void> {
  const all = current ? [current, ...SessionActivity.getInstances().filter((a) => a.getId() !== current!.getId())] : SessionActivity.getInstances();
  current = null;
  await Promise.all(all.map((a) => a.end('immediate')));
}
