// Android: the running session as an ongoing notification (lock screen and
// shade). Tapping it opens hand entry. The layout is serialized by the
// 'widget' directive and rendered natively, so it only uses its props,
// @expo/ui and literals; colours are the "Noite" tokens copied by value.
// Android notifications can't run a live clock in a custom layout, so it shows
// the start time and the played time as of the last update.

import { Button, Column, Row, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxWidth, padding, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { addUserInteractionListener, createCustomNotification } from 'expo-widgets';
import { PixelRatio } from 'react-native';

import type { LiveProps } from './live-state';
import { notificationChannels, SESSION_CHANNEL } from './reminder';

const ID = 'sweatbook-session';

/** The system text size is 150 % or more (read by the app at each post; the layout can't read it). */
type NoticeProps = LiveProps & { bigText?: boolean };

const SessionNotification = createCustomNotification<NoticeProps>('SweatbookSession', (p) => {
  'widget';
  const text = '#F1F4F2';
  const dim = '#B4BFBA';
  const accent = '#FF6A3D';
  const warn = '#F5B83D';
  // A break stops the level clock, so a paused level never reads as due.
  const levelDue = p.nextLevelAt > 0 && !p.paused && p.nextLevelAt <= Date.now();
  const stat = (label: string, value: string, sub: string, color: string) => (
    <Column modifiers={[padding(0, 0, 28, 0)]}>
      <Text color={dim} style={{ fontSize: 11, fontWeight: '600' }} maxLines={1}>{label.toUpperCase()}</Text>
      <Text color={color} style={{ fontSize: 17, fontWeight: '700', fontFamily: 'monospace' }} maxLines={1}>{value}</Text>
      <Text color={dim} style={{ fontSize: 12 }} maxLines={1}>{sub}</Text>
    </Column>
  );
  // Button's types have no `target`, but the widget renderer reads it to name the press.
  const btn = (target: string, name: string) => (
    <Button {...({ target } as object)} colors={{ containerColor: '#1A2521', contentColor: text }} modifiers={[padding(0, 0, 8, 0)]}>
      <Text color={text} style={{ fontSize: 14, fontWeight: '600' }}>{name}</Text>
    </Button>
  );
  // The notification is decorated, so it sits on the system's own background, which is light in
  // the light theme: the layout carries its own dark panel so the "Noite" text always reads.
  const panel = [fillMaxWidth(), background('#0C1311'), cornerRadius(12)];
  const summary = (
    <Column modifiers={[...panel, paddingAll(10)]}>
      <Text color={p.paused ? warn : accent} style={{ fontSize: 13, fontWeight: '700' }} maxLines={1}>{p.status + ' · ' + p.played + ' · ' + p.since}</Text>
      <Text color={text} style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace' }} maxLines={1}>{p.stack + ' (' + p.stackBB + ') · ' + (p.game ? p.game + ' ' : '') + p.blinds}</Text>
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
          {stat(p.gameLevel, p.blinds, levelDue ? p.labels.levelUp + ' → ' + p.nextBlinds : p.nextBlinds ? '→ ' + p.nextBlinds : '', levelDue ? accent : text)}
        </Row>
        {/* The expanded notification has a fixed height: with large text the break line would push
            the buttons out, and the collapsed line already carries it. */}
        {p.breakAt && !p.bigText ? <Text color={warn} style={{ fontSize: 12, fontWeight: '600' }} modifiers={[padding(0, 8, 0, 0)]} maxLines={1}>{p.breakAt}</Text> : null}
        {/* No "+" on the button: a notification can't give TalkBack another name, and it read "mais". */}
        <Row modifiers={[fillMaxWidth(), padding(0, 10, 0, 0)]}>
          <Text
            color="#1A0A04"
            style={{ fontSize: 14, fontWeight: '700', textAlign: 'center' }}
            maxLines={1}
            modifiers={[fillMaxWidth(), background(accent), cornerRadius(12), padding(0, 8, 0, 8)]}>
            {p.labels.newHand}
          </Text>
        </Row>
        {/* With no app lock on: pause/resume right here (a button press reaches the app as an event;
            see onLockButton). A rebuy moves money, so it is done in the app, with «Anular». With a
            lock, the notification only opens the app. */}
        {p.inPlace ? (
          <Row modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>
            {btn(p.pauseTarget, p.labels.pause)}
          </Row>
        ) : null}
      </Column>
    ),
  };
});

/** Show or refresh the session notification. Throws when notifications are off. */
export async function showSession(props: LiveProps): Promise<void> {
  await notificationChannels();
  await SessionNotification.post({ ...props, bigText: PixelRatio.getFontScale() >= 1.5 }, {
    id: ID,
    channelId: SESSION_CHANNEL,
    ongoing: true,
    alertOnlyOnce: true,
    title: props.title,
    text: `${props.status} · ${props.stack} · ${props.game ? props.game + ' ' : ''}${props.blinds}`,
    url: 'sweatbook://hand/new',
    color: '#FF6A3D',
  });
}

export async function endSession(): Promise<void> {
  await SessionNotification.cancelAll();
}

/** A pause, resume or rebuy pressed on the notification: its button target. */
export function onLockButton(cb: (target: string) => void): () => void {
  const sub = addUserInteractionListener((e) => {
    if (e.source === 'SweatbookSession') cb(e.target);
  });
  return () => sub.remove();
}

/** No push-to-end on Android yet (it would need FCM): the app clears the notification at its next launch. */
export function onLiveToken(_cb: ((token: string) => void) | null): void {}
