// Android home-screen widget. Same content as iOS, but Android widgets can't
// run a clock or open a link from a button in this expo-widgets version, so
// it shows the start time and the played time as of the last update, and
// tapping it opens the app. Layout rules as in widget.ios.tsx.

import { Column, Row, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, fillMaxWidth, padding, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import type { WidgetProps } from './widget-state';

const HomeWidget = createWidget<WidgetProps>('SweatbookHome', (p) => {
  'widget';
  const bg = '#0C1311';
  const text = '#F1F4F2';
  const dim = '#B4BFBA';
  const warn = '#F5B83D';
  const good = '#4ADE80';
  const bad = '#F87171';
  const accent = '#FF6A3D';
  const label = (s: string) => (
    <Text color={dim} style={{ fontSize: 11, fontWeight: '600' }}>
      {s.toUpperCase()}
    </Text>
  );
  const shell = [fillMaxSize(), background(bg), cornerRadius(20), paddingAll(14)];

  if (p.live) {
    return (
      <Column modifiers={shell}>
        <Text color={p.paused ? warn : good} style={{ fontSize: 11, fontWeight: '700' }}>
          {'● ' + p.status.toUpperCase() + ' · ' + p.since}
        </Text>
        <Text color={p.paused ? warn : text} style={{ fontSize: 26, fontWeight: '700', fontFamily: 'monospace' }}>
          {p.played}
        </Text>
        <Row modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>
          <Column>
            {label(p.labels.stack)}
            <Text color={text} style={{ fontSize: 16, fontWeight: '700', fontFamily: 'monospace' }}>
              {p.stack}
            </Text>
            <Text color={dim} style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {p.stackBB + ' · ' + p.blinds}
            </Text>
          </Column>
        </Row>
      </Column>
    );
  }

  return (
    <Column modifiers={shell}>
      {label(p.week)}
      <Text color={p.tone === 'up' ? good : p.tone === 'down' ? bad : text} style={{ fontSize: 26, fontWeight: '700', fontFamily: 'monospace' }}>
        {p.result}
      </Text>
      <Text color={dim} style={{ fontSize: 12 }}>
        {p.weekSub}
      </Text>
      <Text color={p.streakOn ? accent : dim} style={{ fontSize: 12, fontWeight: '600' }} modifiers={[padding(0, 8, 0, 0)]}>
        {'🔥 ' + p.streak}
      </Text>
    </Column>
  );
});

export function updateWidget(props: WidgetProps): void {
  HomeWidget.updateSnapshot(props);
}
