// "Partilhar o meu plano" in the festival planner: the planned events as a
// story image and as a text for the friends' WhatsApp group, through the same
// Partilhar sheet as everything else. The story preview sits in the sheet;
// it's captured while the sheet is open, since the sheet closes before the
// share opens.

import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { t } from '@/i18n';
import { track } from '@/lib/events';
import { canShareStory, captureStory, sharePost, shareStory } from '@/lib/instagram-story';
import { notice } from '@/lib/notice';
import { shareRef } from '@/lib/referrals';
import type { Festival } from '@/poker/festivals';
import { planDays, planText } from '@/share/festival-plan';
import { festivalName, type FestivalPlan } from '@/store/festival-plan';
import { BRAND, C, R } from '@/theme';

import { dateRange } from './FestivalCard';
import { FestivalPlanCard } from './FestivalPlanCard';
import { ShareSheet, type ShareOption } from './ShareSheet';
import { STORY_H, STORY_W } from './StoryCard';
import { Button, ListGroup, tap, ToggleItem } from './ui';

const PREVIEW = 0.5;
// Long enough for the sheet to close before Instagram or the system share sheet opens over it.
const AFTER_CLOSE_MS = 350;

export function SharePlan({ f, plan }: { f: Festival; plan: FestivalPlan }) {
  const [open, setOpen] = useState(false);
  // Off by default: friends see the days and events, not what the player spends.
  const [buyIns, setBuyIns] = useState(false);
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const shot = useRef<Promise<string> | null>(null);
  const days = useMemo(() => planDays(f, plan), [f, plan]);
  const name = festivalName(f, plan);
  const dates = days.length ? dateRange(Date.parse(days[0].day + 'T12:00:00'), Date.parse(days[days.length - 1].day + 'T12:00:00')) : '';

  // Capture the story once the preview has drawn (and again after the toggle).
  useEffect(() => {
    if (!open || !canShareStory) return;
    const capture = new Promise<string>((resolve, reject) => void setTimeout(() => captureStory(ref).then(resolve, reject), 250));
    capture.catch(() => {});
    shot.current = capture;
  }, [open, buyIns, days]);

  if (!days.length) return null;

  const link = async (source: string) => {
    const code = await shareRef().catch(() => '');
    return `${BRAND.webUrl}/r/${code}?utm_source=${source}&utm_medium=plan&utm_campaign=festival_plan`;
  };
  const fail = () => Alert.alert(t('Não deu'), t('Não conseguimos preparar a imagem. Tenta outra vez.'));
  const later = (fn: () => Promise<void>) => () => void setTimeout(() => void fn().catch(fail), AFTER_CLOSE_MS);
  const image = () => shot.current ?? Promise.reject(new Error('no capture'));

  const options: ShareOption[] = [];
  if (canShareStory) {
    options.push({
      icon: 'logo-instagram',
      label: t('Story no Instagram'),
      onPress: later(async () => {
        const target = await shareStory(await image(), await link('instagram'));
        track('story_shared', { target: String(target), kind: 'festival_plan', events: days.reduce((n, d) => n + d.rows.length, 0), buyIns });
      }),
    });
    options.push({
      icon: 'image-outline',
      label: t('Imagem e texto'),
      sub: t('WhatsApp, Mensagens, guardar imagem…'),
      onPress: later(async () => {
        await sharePost([await image()], planText(f, plan, await link('app'), { buyIns }), 'any');
        track('story_shared', { target: 'any', kind: 'festival_plan', buyIns });
      }),
    });
  }
  options.push({
    icon: 'chatbubble-ellipses-outline',
    label: t('Só o texto'),
    sub: t('Dias, horas e torneios, para o grupo'),
    onPress: later(async () => {
      await Share.share({ message: planText(f, plan, await link('whatsapp'), { buyIns }) });
      track('story_shared', { target: 'text', kind: 'festival_plan', buyIns });
    }),
  });
  options.push({
    icon: 'copy-outline',
    label: t('Copiar texto'),
    onPress: () =>
      void link('copy').then(async (l) => {
        await Clipboard.setStringAsync(planText(f, plan, l, { buyIns })).catch(() => {});
        notice(t('Texto copiado'));
      }),
  });

  return (
    <>
      <Button
        size="md"
        kind="secondary"
        icon="share-outline"
        title={t('Partilhar o meu plano')}
        sub={t('Para quem vai contigo: dias, horas e torneios')}
        onPress={() => {
          tap('medium');
          setOpen(true);
        }}
      />
      <ShareSheet
        visible={open}
        title={t('Partilhar o meu plano')}
        onClose={() => setOpen(false)}
        header={
          <>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: STORY_W * PREVIEW, height: STORY_H * PREVIEW, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: C.borderStrong }}>
                <View style={{ position: 'absolute', left: (STORY_W * PREVIEW - STORY_W) / 2, top: (STORY_H * PREVIEW - STORY_H) / 2, transform: [{ scale: PREVIEW }] }}>
                  <FestivalPlanCard ref={ref} name={name} dates={dates} days={days} buyIns={buyIns} />
                </View>
              </View>
            </View>
            <ListGroup>
              <ToggleItem icon="cash-outline" title={t('Mostrar buy-ins')} subtitle={t('Nunca o total nem a banca')} value={buyIns} onChange={setBuyIns} />
            </ListGroup>
          </>
        }
        groups={[{ options }]}
      />
    </>
  );
}
