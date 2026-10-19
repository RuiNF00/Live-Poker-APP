// Mental game journal: every check-in (sleep, energy, focus, tilt, a line),
// what they add up to, and what they do to the results once the sample can
// say it. Private: none of it leaves the phone in a share or a link.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Sheet } from '@/components/BankrollSheets';
import { Insights } from '@/components/Insights';
import { mindLine } from '@/lib/mind-line';
import { Card, ListGroup, ListItem, Row, Section, Stat, StatGrid, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { money, plus } from '@/poker/format';
import { profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { MindCheck, Session } from '@/store/types';
import { C, S } from '@/theme';

// Only when the check-in shows (it can be turned off): off the first frame.
const MindBefore = React.lazy(() => import('@/components/MindCheckIn').then((m) => ({ default: m.MindBefore }), () => ({ default: (() => null) as never })));
const MindAfter = React.lazy(() => import('@/components/MindCheckIn').then((m) => ({ default: m.MindAfter }), () => ({ default: (() => null) as never })));

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const one = (n: number | null) => (n === null ? '—' : n.toLocaleString(locale, { maximumFractionDigits: 1 }));

export default function MindScreen() {
  const { sessions, defaultBankroll, settings, saveSession } = useStore();
  const params = useLocalSearchParams<{ currency?: string }>();
  const cur = params.currency || defaultBankroll.currency;
  const hidden = !!settings.hideAmounts;
  const [editing, setEditing] = useState<Session | null>(null);
  const done = useMemo(() => sessions.filter((s) => s.endedAt && s.currency === cur), [sessions, cur]);
  const logged = useMemo(() => done.filter((s) => s.mind).sort((a, b) => b.startedAt - a.startedAt), [done]);
  const m = logged.map((s) => s.mind!);
  const sleep = avg(m.flatMap((x) => (x.sleep !== undefined ? [x.sleep] : [])));
  const energy = avg(m.flatMap((x) => (x.energy ? [x.energy] : [])));
  const tilt = avg(m.flatMap((x) => (x.tilt ? [x.tilt] : [])));
  const hot = m.filter((x) => (x.tilt ?? 0) >= 4).length;

  return (
    <>
      <Stack.Screen options={{ title: t('Diário mental') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}>
        <Card style={{ gap: S.sm }}>
          <Row>
            <Ionicons name="lock-closed" size={15} color={C.muted} />
            <T v="small" style={{ flex: 1 }}>
              {t('Só tu vês. Nunca entra numa partilha, num link ou num extrato para backers.')}
            </T>
          </Row>
          <T v="h2">{logged.length === 1 ? t('1 sessão com check-in') : t('{n} sessões com check-in', { n: logged.length })}</T>
          <T v="small">{t('Antes de começar: sono, energia, foco e humor. Ao terminar: tilt e uma linha. Tudo com toques e tudo opcional.')}</T>
        </Card>

        {logged.length ? (
          <StatGrid cols={2}>
            <Stat label={t('Sono médio')} sub={t('Na noite antes')} value={sleep === null ? '—' : `${one(sleep)} h`} tone={sleep !== null && sleep < 6 ? 'bad' : undefined} />
            <Stat label={t('Energia média')} sub={t('De 1 a 5')} value={one(energy)} />
            <Stat label={t('Tilt médio')} sub={t('De 1 (calmo) a 5')} value={one(tilt)} tone={tilt !== null && tilt >= 3 ? 'bad' : undefined} />
            <Stat label={t('Sessões com tilt 4+')} sub={t('Marcadas por ti')} value={String(hot)} tone={hot ? 'bad' : undefined} />
          </StatGrid>
        ) : null}

        <Insights list={done} cur={cur} hidden={hidden} mind />

        <Section title={t('Check-ins')} hint={logged.length ? undefined : t('Faz o primeiro ao começar a próxima sessão, ou junta-o a uma sessão passada no Bankroll.')}>
          {logged.length ? (
            <ListGroup>
              {logged.slice(0, 60).map((s) => {
                const p = profit(s);
                return (
                  <ListItem
                    key={s.id}
                    title={`${new Date(s.startedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · ${s.venue || s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash')}`}
                    subtitle={[mindLine(s.mind!), s.mind!.note ? `“${s.mind!.note}”` : ''].filter(Boolean).join('\n')}
                    value={hidden ? '•••' : plus(p) + money(Math.round(p), cur)}
                    valueColor={p >= 0 ? C.good : C.bad}
                    onPress={() => setEditing(s)}
                  />
                );
              })}
            </ListGroup>
          ) : null}
        </Section>
      </ScrollView>
      <Sheet visible={!!editing} title={t('Check-in')} onClose={() => setEditing(null)}>
        {editing ? <Edit s={editing} onChange={(mind) => setEditing({ ...editing, mind })} onSave={(x) => saveSession({ ...x, updatedAt: Date.now() })} /> : null}
      </Sheet>
    </>
  );
}

function Edit({ s, onChange, onSave }: { s: Session; onChange: (m: MindCheck | undefined) => void; onSave: (s: Session) => void }) {
  const change = (mind: MindCheck | undefined) => {
    onChange(mind);
    onSave({ ...s, mind });
  };
  return (
    <View style={{ gap: S.md }}>
      <React.Suspense fallback={null}><MindBefore value={s.mind} onChange={change} /></React.Suspense>
      <React.Suspense fallback={null}><MindAfter value={s.mind} onChange={change} /></React.Suspense>
    </View>
  );
}
