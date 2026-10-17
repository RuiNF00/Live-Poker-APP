import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro, useWelcomeOffer } from '@/billing/pro';
import { CardRow, PlayingCard } from '@/components/PlayingCard';
import { Badge, Banner, Button, Chip, ChipRow, Empty, IconButton, Pill, Row, ScreenHeader, SearchField, T, Wordmark } from '@/components/ui';
import { locale, t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { isComplete, positions, replay } from '@/poker/engine';
import { amount, blindsLabel, chips, duration, timeOf } from '@/poker/format';
import { DEFAULT_TAGS, type Hand } from '@/poker/types';
import { useStore } from '@/store/store';
import { C, R, S, SHADOW, ff } from '@/theme';

const DAY = 86400000;

function dayKey(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayTitle(day: number) {
  const today = dayKey(Date.now());
  if (day === today) return t('Hoje');
  if (day === today - DAY) return t('Ontem');
  const sameYear = new Date(day).getFullYear() === new Date().getFullYear();
  return new Date(day).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', ...(sameYear ? null : { year: 'numeric' }) });
}

export default function HandsScreen() {
  const { hands, activeSession, settings, draft, setDraft } = useStore();
  const { handsLeft, trialDays, paywall } = usePro();
  useWelcomeOffer(hands.length);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const sections = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const rows = [...hands]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((h) => (!tag || h.tags.includes(tag)) && (!qq || [h.game.name, h.notes, h.title, comboLabel(h.players[h.hero].cards), ...h.players.map((p) => p.name)].join(' ').toLowerCase().includes(qq)));
    const out: { title: string; data: Hand[] }[] = [];
    let cur = -1;
    for (const h of rows) {
      const k = dayKey(h.createdAt);
      if (k !== cur) {
        out.push({ title: dayTitle(k), data: [] });
        cur = k;
      }
      out[out.length - 1].data.push(h);
    }
    return out;
  }, [hands, q, tag]);

  const usedTags = useMemo(() => DEFAULT_TAGS.filter((tg) => hands.some((h) => h.tags.includes(tg))), [hands]);
  const hasDraft = !!draft && (draft.actions.length > 0 || !!draft.players[draft.hero].cards?.length);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(h) => h.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: S.sm }} />}
        ListHeaderComponent={
          <SafeTop>
            <View style={{ gap: S.md, marginBottom: S.sm }}>
              <ScreenHeader
                title={<Wordmark size={30} />}
                right={
                  <>
                    {hands.length > 0 ? <IconButton name={searching ? 'close' : 'search'} label={t('Procurar')} onPress={() => (searching ? (setSearching(false), setQ('')) : setSearching(true))} /> : null}
                    <IconButton name="settings-outline" label={t('Definições')} onPress={() => router.push('/settings')} />
                  </>
                }
              />
              {activeSession ? (
                <Banner
                  live
                  title={t('Sessão em curso · {time}', { time: duration(Date.now() - activeSession.startedAt) })}
                  body={[activeSession.name || t('Sem nome'), 'Stack ' + chips(activeSession.stack)].join(' · ')}
                  onPress={() => router.push('/session')}
                />
              ) : null}
              {hasDraft ? (
                <Banner tone="warn" icon="create-outline" title={t('Mão a meio')} body={t('Toca para continuar onde ficaste')} onPress={() => router.push('/hand/new')} onDismiss={() => setDraft(null)} dismissLabel={t('Descartar')} />
              ) : null}
              {handsLeft !== null && hands.length > 0 ? (
                <FreeMeter left={handsLeft} cta={handsLeft === 0 && trialDays ? t('{days} dias grátis', { days: trialDays }) : t('Ver Pro')} onPress={() => paywall(handsLeft === 0 ? 'hands' : 'generic')} />
              ) : null}
              {searching ? <SearchField value={q} onChange={setQ} placeholder={t('Torneio, jogador, AKs…')} /> : null}
              {usedTags.length > 0 ? (
                <ChipRow>
                  <Chip label={t('Todas')} active={!tag} onPress={() => setTag(null)} />
                  {usedTags.map((tg) => (
                    <Chip key={tg} label={t(tg)} active={tag === tg} onPress={() => setTag(tag === tg ? null : tg)} />
                  ))}
                </ChipRow>
              ) : null}
            </View>
          </SafeTop>
        }
        renderSectionHeader={({ section }) => (
          <Row style={{ paddingTop: S.lg, paddingBottom: S.sm, paddingHorizontal: 4 }}>
            <T v="label" style={{ flex: 1 }}>
              {section.title}
            </T>
            <T v="tiny">{section.data.length === 1 ? t('1 mão') : t('{n} mãos', { n: section.data.length })}</T>
          </Row>
        )}
        ListEmptyComponent={
          hands.length === 0 ? (
            <FirstRun />
          ) : (
            <Empty icon="search" title={t('Nada encontrado')} body={t('Tenta outro nome, torneio ou mão.')} />
          )
        }
        renderItem={({ item }) => <HandRow hand={item} inBB={settings.inBB} />}
      />
    </View>
  );
}

function SafeTop({ children }: { children: React.ReactNode }) {
  // SectionList has no safe-area prop; pad the header instead.
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top + S.sm }}>{children}</View>;
}

/** Free plan: how many of today's hands are left, as a small meter. */
function FreeMeter({ left, cta, onPress }: { left: number; cta: string; onPress: () => void }) {
  const total = 3;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.surface, borderWidth: 1, borderColor: left === 0 ? C.accentLine : C.border, opacity: pressed ? 0.8 : 1 })}>
      <Row gap={4}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: i < total - left ? C.accent : C.surface3 }} />
        ))}
      </Row>
      <T v="small" style={{ flex: 1 }} numberOfLines={1}>
        {left === 0 ? t('Mãos grátis de hoje esgotadas') : left === 1 ? t('Falta 1 mão grátis hoje') : t('Faltam {n} mãos grátis hoje', { n: left })}
      </T>
      <T v="small" color={C.accent} style={{ fontFamily: ff(800) }}>
        {cta}
      </T>
    </Pressable>
  );
}

/** Empty state for a brand-new install: what the app does, in three steps. */
function FirstRun() {
  const steps: [React.ComponentProps<typeof Ionicons>['name'], string, string][] = [
    ['flash-outline', t('Regista em segundos'), t('Posição, cartas e ação com poucos toques, entre mãos.')],
    ['play-circle-outline', t('Revê no replayer'), t('Cada mão fica numa mesa que podes ver rua a rua.')],
    ['paper-plane-outline', t('Partilha e discute'), t('Um link para os amigos votarem no que fariam.')],
  ];
  return (
    <View style={{ gap: S.xl, paddingTop: S.lg }}>
      <View style={{ alignItems: 'center', gap: S.md }}>
        <Row gap={0} style={{ marginBottom: 6 }}>
          <View style={{ transform: [{ rotate: '-8deg' }], ...SHADOW }}>
            <PlayingCard card="Ah" size="lg" />
          </View>
          <View style={{ marginLeft: -12, transform: [{ rotate: '7deg' }, { translateY: 4 }], ...SHADOW }}>
            <PlayingCard card="Ks" size="lg" />
          </View>
        </Row>
        <T v="h1" style={{ textAlign: 'center' }}>
          {t('O teu caderno de póquer live')}
        </T>
        <T v="callout" style={{ textAlign: 'center', maxWidth: 300 }}>
          {t('Guarda as mãos que importam enquanto ainda te lembras de tudo.')}
        </T>
      </View>
      <View style={{ gap: S.md }}>
        {steps.map(([ic, title, body]) => (
          <Row key={title} gap={14} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={ic} size={19} color={C.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="h3">{title}</T>
              <T v="small">{body}</T>
            </View>
          </Row>
        ))}
      </View>
      <View style={{ gap: S.sm }}>
        <Button title={t('Registar a primeira mão')} icon="add" onPress={() => router.push('/hand/new')} />
        <Button title={t('Ver uma mão de exemplo')} kind="ghost" size="md" onPress={() => router.push({ pathname: '/hand/[id]', params: { id: 'sample' } })} />
      </View>
    </View>
  );
}

function HandRow({ hand, inBB }: { hand: Hand; inBB: boolean }) {
  const r = useMemo(() => replay(hand), [hand]);
  const pos = positions(hand.players.length, hand.button);
  const net = r.result?.resolved ? r.result.net[hand.hero] : undefined;
  const hero = hand.players[hand.hero];
  const done = isComplete(hand, r);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/hand/[id]', params: { id: hand.id } })}
      style={({ pressed }) => ({
        backgroundColor: pressed ? C.surface2 : C.surface,
        borderRadius: R.lg,
        borderWidth: 1,
        borderColor: C.border,
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 10,
        ...SHADOW,
      })}>
      <Row gap={12}>
        {hero.cards?.length === 2 ? <CardRow cards={hero.cards} size="sm" gap={2} /> : <View style={{ width: 62, height: 42, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong }} />}
        <View style={{ flex: 1, gap: 3 }}>
          <Row gap={6}>
            <T v="h3" numberOfLines={1} style={{ fontSize: 16 }}>
              {comboLabel(hero.cards) || t('Sem cartas')}
            </T>
            <Badge label={pos[hand.hero]} />
          </Row>
          <T v="small" numberOfLines={1}>
            {(hand.game.name || (hand.game.kind === 'mtt' ? t('Torneio') : 'Cash')) + ' · ' + blindsLabel(hand)}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {net !== undefined ? (
            <T v="mono" color={net > 0 ? C.good : net < 0 ? C.bad : C.textDim}>
              {(net > 0 ? '+' : '') + amount(net, hand, inBB)}
            </T>
          ) : (
            <T v="mono" color={C.muted}>
              —
            </T>
          )}
          <T v="monoS">{timeOf(hand.createdAt)}</T>
        </View>
      </Row>
      {hand.board.length || hand.tags.length || !done || hand.shareId ? (
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {hand.board.length ? (
            <Row gap={2} style={{ marginRight: 4 }}>
              {hand.board.map((c, i) => (
                <PlayingCard key={c + i} card={c} size="xs" />
              ))}
            </Row>
          ) : null}
          {!done ? <Pill label={t('Por completar')} color={C.warn} /> : null}
          {hand.tags.slice(0, 3).map((x) => (
            <Pill key={x} label={t(x)} />
          ))}
          {hand.tags.length > 3 ? <Pill label={`+${hand.tags.length - 3}`} /> : null}
          {hand.shareId ? <Pill icon="link" label={t('Partilhada')} color={C.info} /> : null}
        </Row>
      ) : null}
    </Pressable>
  );
}
