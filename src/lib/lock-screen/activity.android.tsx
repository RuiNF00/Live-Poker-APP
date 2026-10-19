// Android: the running session as an ongoing notification (lock screen and
// shade). Tapping it opens hand entry. The layout is serialized by the
// 'widget' directive and rendered natively, so it only uses its props,
// @expo/ui and literals; colours are the "Noite" tokens copied by value.
// Android notifications can't run a live clock in a custom layout, so it shows
// the start time and the played time as of the last update.

import { Column, Row, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxWidth, padding, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createCustomNotification } from 'expo-widgets';

import type { LiveProps } from './live-state';
import { notificationChannels, SESSION_CHANNEL } from './reminder';

const ID = 'sweatbook-session';

const SessionNotification = createCustomNotification<LiveProps>('SweatbookSession', (p) => {
  'widget';
  const text = '#F1F4F2';
  const dim = '#B4BFBA';
  const accent = '#FF6A3D';
  const warn = '#F5B83D';
  const levelDue = p.nextLevelAt > 0 && p.nextLevelAt <= Date.now();
  const stat = (label: string, value: string, sub: string, color: string) => (
    <Column modifiers={[padding(0, 0, 28, 0)]}>
      <Text color={dim} style={{ fontSize: 11, fontWeight: '600' }}>{label.toUpperCase()}</Text>
      <Text color={color} style={{ fontSize: 17, fontWeight: '700', fontFamily: 'monospace' }}>{value}</Text>
      <Text color={dim} style={{ fontSize: 12 }}>{sub}</Text>
    </Column>
  );
  // The notification is decorated, so it sits on the system's own background, which is light in
  // the light theme: the layout carries its own dark panel so the "Noite" text always reads.
  const panel = [fillMaxWidth(), background('#0C1311'), cornerRadius(12)];
  const summary = (
    <Column modifiers={[...panel, paddingAll(10)]}>
      <Text color={p.paused ? warn : accent} style={{ fontSize: 13, fontWeight: '700' }}>{p.status + ' · ' + p.played + ' · ' + p.since}</Text>
      <Text color={text} style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace' }}>{p.stack + ' (' + p.stackBB + ') · ' + p.blinds}</Text>
      {p.breakAt ? <Text color={warn} style={{ fontSize: 12, fontWeight: '600' }}>{p.breakAt}</Text> : null}
    </Column>
  );
  return {
    collapsed: summary,
    expanded: (
      <Column modifiers={[...panel, paddingAll(12)]}>
        <Row modifiers={[fillMaxWidth()]}>
          {stat(p.labels.time, p.played, p.since, p.paused ? warn : text)}
          {stat(p.labels.stack, p.stack, p.stackBB, text)}
          {stat(p.level, p.blinds, levelDue ? p.labels.levelUp + ' → ' + p.nextBlinds : p.nextBlinds ? '→ ' + p.nextBlinds : '', levelDue ? accent : text)}
        </Row>
        {p.breakAt ? <Text color={warn} style={{ fontSize: 12, fontWeight: '600' }} modifiers={[padding(0, 8, 0, 0)]}>{p.breakAt}</Text> : null}
        <Row modifiers={[fillMaxWidth(), padding(0, 10, 0, 0)]}>
          <Text
            color="#1A0A04"
            style={{ fontSize: 14, fontWeight: '700', textAlign: 'center' }}
            modifiers={[fillMaxWidth(), background(accent), cornerRadius(12), padding(0, 8, 0, 8)]}>
            {'+ ' + p.labels.newHand}
          </Text>
        </Row>
      </Column>
    ),
  };
});

/** Show or refresh the session notification. Throws when notifications are off. */
export async function showSession(props: LiveProps): Promise<void> {
  await notificationChannels();
  await SessionNotification.post(props, {
    id: ID,
    channelId: SESSION_CHANNEL,
    ongoing: true,
    alertOnlyOnce: true,
    title: props.title,
    text: `${props.status} · ${props.stack} · ${props.blinds}`,
    url: 'sweatbook://hand/new',
    color: '#FF6A3D',
  });
}

export async function endSession(): Promise<void> {
  await SessionNotification.cancelAll();
}
