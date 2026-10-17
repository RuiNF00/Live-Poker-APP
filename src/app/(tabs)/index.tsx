import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

// toLocaleDateString is slow on Hermes; a long history has hundreds of days.
const dayTitles = new Map<number, string>();
function dayTitle(day: number) {
  const today = dayKey(Date.now());
  if (day === today) return t('Hoje');
  // Half a day back is always inside yesterday, even when it was 23 or 25 hours long.
  if (day === dayKey(today - DAY / 2)) return t('Ontem');
  let s = dayTitles.get(day);
  if (s === undefined) {
    const sameYear = new Date(day).getFullYear() === new Date().getFullYear();
    s = new Date(day).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', ...(sameYear ? null : { year: 'numeric' }) });
    dayTitles.set(day, s);
  }
  return s;
}

// Defined once: an inline component here is a new type on every render, so
// React unmounted and remounted every separator each time the list rendered.
const Separator = () => <View style={{ height: S.sm }} />;

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
      .filter((h) => (!tag || h.tags.includes(tag)) && (!qq || searchText(h).includes(qq)));
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

  const renderItem = useCallback(({ item }: { item: Hand }) => <HandRow hand={item} inBB={settings.inBB} />, [settings.inBB]);

  const usedTags = useMemo(() => DEFAULT_TAGS.filter((tg) => hands.some((h) => h.tags.includes(tg))), [hands]);
  // Discarding a draft is one tap, so keep it for a few seconds behind an undo.
  const [discarded, setDiscarded] = useState<Hand | null>(null);
  useEffect(() => {
    if (!discarded) return;
    const id = setTimeout(() => setDiscarded(null), 6000);
    return () => clearTimeout(id);
  }, [discarded]);
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
        ItemSeparatorComponent={Separator}
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
                <Banner
                  tone="warn"
                  icon="create-outline"
                  title={t('Mão a meio')}
                  body={t('Toca para continuar onde ficaste')}
                  onPress={() => router.push('/hand/new')}
                  onDismiss={() => {
                    setDiscarded(draft);
                    setDraft(null);
                  }}
                  dismissLabel={t('Descartar')}
                />
              ) : discarded ? (
                <Banner
                  tone="info"
                  icon="trash-outline"
                  title={t('Mão descartada')}
                  action={t('Anular')}
                  onPress={() => {
                    setDraft(discarded);
                    setDiscarded(null);
                  }}
                />
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
        renderItem={renderItem}
        // Long histories: render a screenful first, keep a small window
        // mounted and build the rest in idle batches.
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
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

// Search text per hand, built once per hand version rather than on every keystroke.
const searchCache = new WeakMap<Hand, string>();
function searchText(h: Hand): string {
  let s = searchCache.get(h);
  if (s === undefined) {
    s = [h.game.name, h.notes, h.title, comboLabel(h.players[h.hero].cards), ...h.players.map((p) => p.name)].join(' ').toLowerCase();
    searchCache.set(h, s);
  }
  return s;
}

// Replaying a hand is the costly part of a row. Keep the result per hand
// version, so rows scrolling back into view don't replay again.
const rowCache = new WeakMap<Hand, { net: number | undefined; done: boolean }>();
function rowSummary(hand: Hand) {
  let v = rowCache.get(hand);
  if (!v) {
    const r = replay(hand);
    v = { net: r.result?.resolved ? r.result.net[hand.hero] : undefined, done: isComplete(hand, r) };
    rowCache.set(hand, v);
  }
  return v;
}

const HandRow = React.memo(function HandRow({ hand, inBB }: { hand: Hand; inBB: boolean }) {
  const { net, done } = rowSummary(hand);
  const pos = positions(hand.players.length, hand.button);
  const hero = hand.players[hand.hero];
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
});
