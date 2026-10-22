// «Quando voltas a jogar?» on the summary of a session that just ended: one tap picks the day, and
// that day brings two notices about logging (billing/nudges playNotices), never about going to play.
// A plan made ahead (when and where) is what most often turns an intention into the act.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { usualStartHour } from '@/billing/nudges';
import { readPlayPlan, savePlayPlan } from '@/billing/play-plan';
import { usePro } from '@/billing/pro';
import type { SoftAsk } from '@/components/NotifySoftAsk';
import { Button, Card, Chip, ChipRow, Row, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { S } from '@/theme';

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function plusDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

function dayName(day: number, today: number): string {
  if (day === plusDays(today, 1)) return t('Amanhã');
  const w = new Date(day).toLocaleDateString(locale, { weekday: 'long' });
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function NextPlayCard({ sessions, ask }: { sessions: { startedAt: number; endedAt?: number }[]; ask: (a: SoftAsk) => Promise<boolean> }) {
  const { refreshNudges } = usePro();
  const [today] = useState(() => dayStart(Date.now()));
  // undefined while reading; null for no plan (or «Ainda não sei»).
  const [plan, setPlan] = useState<number | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [noNotices, setNoNotices] = useState(false);
  const [unsure, setUnsure] = useState(false);
  useEffect(() => {
    void readPlayPlan().then((p) => setPlan(p && p.day > today ? p.day : null));
  }, [today]);
  if (plan === undefined || unsure) return null;

  const hour = `${String(usualStartHour(sessions)).padStart(2, '0')}:00`;
  const pick = async (day: number | null) => {
    setPlan(day);
    setEditing(false);
    setUnsure(day === null);
    await savePlayPlan(day === null ? null : { day });
    if (day !== null) {
      const ok = await ask({
        where: 'plan',
        title: t('Um aviso no dia em que jogas'),
        body: t('Só para abrires a sessão quando chegares, e para a registares no dia seguinte se ficou por registar. Sem valores e sem publicidade.'),
        preview: { title: t('Chegaste à mesa?'), body: t('Abre a sessão com um toque: o jogo e as blinds já vêm preenchidos.') },
      });
      setNoNotices(!ok);
    }
    refreshNudges();
  };

  if (plan && !editing) {
    return (
      <Card style={{ gap: S.xs }}>
        <Row gap={S.sm}>
          <T v="h3" style={{ flex: 1 }}>
            {t('Combinado: {day}', { day: dayName(plan, today) })}
          </T>
          <Button kind="plain" size="sm" title={t('Mudar')} haptic={false} onPress={() => setEditing(true)} />
        </Row>
        <T v="small">{noNotices ? t('Os avisos estão desligados, por isso fica só anotado.') : t('Às {time} lembramos-te de abrir a sessão.', { time: hour })}</T>
      </Card>
    );
  }
  const days = [1, 2, 3, 4, 5, 6].map((n) => plusDays(today, n));
  return (
    <Card style={{ gap: S.sm }}>
      <View style={{ gap: 2 }}>
        <T v="h3">{t('Quando voltas a jogar?')}</T>
        <T v="small">{t('Nesse dia lembramos-te de abrir a sessão e, se ficar por registar, no dia seguinte. Podes mudar quando quiseres.')}</T>
      </View>
      <ChipRow style={{ marginHorizontal: -S.lg }}>
        {days.map((d) => (
          <Chip key={d} label={dayName(d, today)} active={plan === d} onPress={() => void pick(d)} />
        ))}
        <Chip label={t('Ainda não sei')} onPress={() => void pick(null)} />
      </ChipRow>
    </Card>
  );
}
