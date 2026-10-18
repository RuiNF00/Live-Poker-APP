import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ListGroup, Row, SheetHeader, T, tap, ToggleItem, useSheetPad } from '@/components/ui';
import { t } from '@/i18n';
import { useStore } from '@/store/store';
import { computeStreak, FREEZE_EVERY, type WeekState } from '@/store/streak';
import { C, S } from '@/theme';

const DOT: Record<WeekState, string> = { logged: C.textDim, frozen: C.info, paused: C.borderStrong, empty: C.surface3 };

/**
 * Weeks in a row with something logged. About discipline, never about playing
 * more. A cell of the home summary row; tapping it explains the rule.
 */
export function StreakStat() {
  const { hands, sessions, players, settings, setSettings } = useStore();
  const [open, setOpen] = useState(false);
  // Read once per mount: the home tab remounts often enough for a weekly count.
  const [now] = useState(() => Date.now());
  const s = useMemo(() => {
    const at = [...hands.map((h) => h.createdAt), ...sessions.filter((x) => x.notes.trim()).map((x) => x.startedAt), ...players.map((p) => p.updatedAt)];
    return computeStreak(at, settings.streakPauses ?? [], now);
  }, [hands, sessions, players, settings.streakPauses, now]);

  const title = s.weeks === 1 ? t('1 semana seguida') : t('{n} semanas seguidas', { n: s.weeks });
  const sub = s.paused
    ? t('Em pausa até voltares')
    : s.loggedThisWeek
      ? t('Esta semana já conta · próximo objetivo {n}', { n: s.next })
      : t('Uma mão ou nota esta semana mantém-na');

  const setPaused = (on: boolean) => {
    tap('select');
    const list = settings.streakPauses ?? [];
    if (on) setSettings({ streakPauses: [...list, { from: Date.now() }] });
    else setSettings({ streakPauses: list.map((p) => (p.to === undefined ? { ...p, to: Date.now() } : p)) });
  };

  const sheetPad = useSheetPad(S.xxl);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, sub, s.freezes ? t('{n} gelos guardados', { n: s.freezes }) : ''].filter(Boolean).join('. ')}
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => ({ gap: 2, opacity: pressed ? 0.7 : 1 })}>
        <T v="label" numberOfLines={1}>
          {t('Semanas')}
        </T>
        <Row gap={5}>
          <Ionicons name={s.paused ? 'pause-circle' : 'flame'} size={16} color={s.paused ? C.muted : s.loggedThisWeek ? C.accent : C.muted} />
          <T v="mono">{s.weeks}</T>
          {s.freezes > 0 ? (
            <Row gap={2}>
              <Ionicons name="snow" size={12} color={C.info} />
              <T v="monoS" style={{ color: C.info }}>
                {s.freezes}
              </T>
            </Row>
          ) : null}
        </Row>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessible={false} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
          <Pressable accessible={false} accessibilityViewIsModal onAccessibilityEscape={() => setOpen(false)} style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: sheetPad, gap: S.md }}>
            <SheetHeader title={t('Sequência de registo')} onClose={() => setOpen(false)} />
            <Row gap={S.sm}>
              <T v="h2" style={{ flex: 1 }}>
                {title}
              </T>
              <Row gap={3}>
                {s.recent.map((st, i) => (
                  <View key={i} style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: DOT[st] }} />
                ))}
              </Row>
            </Row>
            <T v="small">{sub}</T>
            <T v="body" style={{ color: C.textDim }}>
              {t('Conta as semanas em que registas pelo menos uma mão ou uma nota. Não tem nada a ver com jogar mais: é rever o teu jogo com regularidade.')}
            </T>
            <Row gap={S.sm}>
              <Ionicons name="snow" size={18} color={C.info} />
              <T v="body" style={{ flex: 1 }}>
                {t('A cada {n} semanas ganhas um gelo (até 2). Se falhares uma semana, o gelo guarda a sequência.', { n: FREEZE_EVERY })}
              </T>
            </Row>
            <ListGroup>
              <ToggleItem icon="airplane-outline" title={t('Modo pausa')} subtitle={t('Para viagens. Estas semanas não quebram nada.')} value={s.paused} onChange={setPaused} />
            </ListGroup>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
