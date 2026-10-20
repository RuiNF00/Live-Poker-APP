// Notas: who is who at the table, how they play, and the hands you have recorded
// against them. Opens from the Resumo; `id` opens one note, `id=new` a blank one.
// Built from Mobbin references: the people from this table first (Lapse's "friends" above
// "everyone"), tag chips over the list (Fixtured), dense rows (Mesh, Quo), and a note that
// asks for the type in one big tap before any typing (Beli, Letterboxd) with the numbers
// on top like a scouting card (Sofascore).

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { OpponentStatsRow, tagColor } from '@/components/OpponentStats';
import { CardRow } from '@/components/PlayingCard';
import { Button, Chip, confirmAction, Empty, Field, ListGroup, ListItem, Pill, Row, SearchField, Section, SheetHeader, T, tap } from '@/components/ui';
import { usePaged } from '@/components/ShowMore';
import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { shortDate } from '@/poker/format';
import { MAX_NAME_LENGTH } from '@/poker/privacy';
import type { Hand } from '@/poker/types';
import { handCounts, opponentStats, type OpponentStats } from '@/store/queries';
import { uid, useStore } from '@/store/store';
import { PLAYER_TAGS, type PlayerNote } from '@/store/types';
import { C, R, S, SHADOW, ff } from '@/theme';
import { useSheetAnimation } from '@/lib/motion';

/** The four kinds of player, one tap each; the rest of the tags are tendencies on top. */
const TYPES: { tag: string; line: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { tag: 'Fish', line: 'Joga muitas mãos e paga demais', icon: 'fish-outline' },
  { tag: 'Reg', line: 'Joga bem e com regularidade', icon: 'shield-outline' },
  { tag: 'Nit', line: 'Só entra com mãos fortes', icon: 'lock-closed-outline' },
  { tag: 'LAG', line: 'Abre muito e pressiona', icon: 'flame-outline' },
];
const TYPE_TAGS = TYPES.map((x) => x.tag);
const TENDENCIES = PLAYER_TAGS.filter((x) => !TYPE_TAGS.includes(x));

function handsWith(hands: Hand[], p: PlayerNote) {
  const n = p.name.trim().toLowerCase();
  return hands.filter((h) => h.players.some((x, i) => i !== h.hero && (x.playerId === p.id || (n && x.name.trim().toLowerCase() === n))));
}

export default function NotesScreen() {
  const sheetAnim = useSheetAnimation();
  const insets = useSafeAreaInsets();
  const { players, savePlayer, deletePlayer, hands, sessions, activeSession } = useStore();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const blank = (): PlayerNote => ({ id: uid('p_'), name: '', look: '', tags: [], notes: '', createdAt: Date.now(), updatedAt: Date.now() });
  // From the Resumo: straight into the note that was tapped, or a new one.
  const [edit, setEdit] = useState<PlayerNote | null>(() => (id === 'new' ? blank() : (players.find((p) => p.id === id) ?? null)));
  // Closing the sheet (X, swipe, back) keeps what was typed: notes are written at the table, in a hurry.
  const draft = useRef<PlayerNote | null>(null);
  const setDraft = useCallback((d: PlayerNote) => {
    draft.current = d;
  }, []);
  const closeEditor = () => {
    const d = draft.current;
    draft.current = null;
    if (d && edit && d !== edit && d.name.trim()) savePlayer(d);
    setEdit(null);
  };

  // Last time each player was in a hand you saved, so the list says when you saw them.
  const seen = useMemo(() => {
    const m = new Map<string, number>();
    const byName = new Map(players.map((p) => [p.name.trim().toLowerCase(), p.id]));
    for (const h of hands)
      h.players.forEach((x, i) => {
        if (i === h.hero) return;
        const pid = x.playerId ?? byName.get(x.name.trim().toLowerCase());
        if (pid && (m.get(pid) ?? 0) < h.createdAt) m.set(pid, h.createdAt);
      });
    return m;
  }, [hands, players]);

  // This table: the players in the hands of the session being played, else of the last one with hands.
  const table = useMemo(() => {
    const sid = activeSession?.id ?? [...hands].filter((h) => h.sessionId).sort((a, b) => b.createdAt - a.createdAt)[0]?.sessionId;
    if (!sid) return null;
    const ids = new Set<string>();
    const byName = new Map(players.map((p) => [p.name.trim().toLowerCase(), p.id]));
    for (const h of hands) {
      if (h.sessionId !== sid) continue;
      h.players.forEach((x, i) => {
        const pid = i === h.hero ? undefined : (x.playerId ?? byName.get(x.name.trim().toLowerCase()));
        if (pid) ids.add(pid);
      });
    }
    const list = players.filter((p) => ids.has(p.id));
    if (!list.length) return null;
    const s = sessions.find((x) => x.id === sid);
    return { live: !!activeSession && activeSession.id === sid, list, where: s ? s.name || s.venue : '' };
  }, [activeSession, hands, players, sessions]);

  const inUse = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of players) for (const x of p.tags) m.set(x, (m.get(x) ?? 0) + 1);
    return PLAYER_TAGS.filter((x) => m.has(x)).map((x) => ({ tag: x, n: m.get(x)! }));
  }, [players]);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return [...players]
      .sort((a, b) => Math.max(b.updatedAt, seen.get(b.id) ?? 0) - Math.max(a.updatedAt, seen.get(a.id) ?? 0))
      .filter((p) => !tag || p.tags.includes(tag))
      // Tags are stored in pt-PT and shown translated: either matches ('Agressivo', 'Aggressive').
      .filter((p) => !qq || [p.name, p.look, p.notes, ...p.tags, ...p.tags.map((x) => t(x))].join(' ').toLowerCase().includes(qq));
  }, [players, q, tag, seen]);

  const counts = useMemo(() => handCounts(hands, players), [hands, players]);
  const stats = useMemo(() => opponentStats(hands, players), [hands, players]);
  const filtered = !!tag || !!q.trim();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingTop: S.sm, paddingBottom: 110 + insets.bottom }}
        ListHeaderComponent={
          players.length > 0 ? (
            <View style={{ gap: S.md, marginBottom: S.md }}>
              {table && !filtered ? <TableStrip {...table} onOpen={setEdit} /> : null}
              <SearchField value={q} onChange={setQ} placeholder={t('Nome, aspeto, tag…')} />
              {inUse.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -S.gutter }}>
                  <View style={{ width: S.gutter - 6 }} />
                  <Chip label={`${t('Todos')} ${players.length}`} active={!tag} onPress={() => setTag(null)} />
                  {inUse.map((x) => (
                    <Chip key={x.tag} label={`${t(x.tag)} ${x.n}`} active={tag === x.tag} color={tagColor(x.tag)} onPress={() => setTag(tag === x.tag ? null : x.tag)} />
                  ))}
                  <View style={{ width: S.gutter - 6 }} />
                </ScrollView>
              ) : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          players.length === 0 ? (
            <Empty
              icon="create-outline"
              title={t('Conhece a tua mesa')}
              body={t('Quem é quem, como joga e as mãos que tiveste contra ele. Na próxima vez que o vires, já sabes.')}
              action={<Button title={t('Nova nota')} icon="create-outline" onPress={() => setEdit(blank())} />}
            />
          ) : (
            <Empty icon="search" title={t('Nada encontrado')} />
          )
        }
        renderItem={({ item, index }) => (
          <NoteRow p={item} first={index === 0} last={index === rows.length - 1} hands={counts.get(item.id) ?? 0} seen={seen.get(item.id)} vpip={stats.get(item.id)} onPress={() => setEdit(item)} />
        )}
      />
      {players.length > 0 ? (
        // Bottom right, where the thumb is (Quo).
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Nova nota')}
          onPress={() => {
            tap('light');
            setEdit(blank());
          }}
          style={({ pressed }) => [st.fab, { bottom: insets.bottom + S.lg }, pressed && { backgroundColor: C.accentPressed }]}>
          <Ionicons name="add" size={22} color={C.accentInk} />
          <T v="body" color={C.accentInk} style={{ fontFamily: ff(800) }} maxFontSizeMultiplier={1.4}>
            {t('Nova nota')}
          </T>
        </Pressable>
      ) : null}
      <Modal visible={!!edit} animationType={sheetAnim} presentationStyle="pageSheet" onRequestClose={closeEditor}>
        {edit && (
          <PlayerEditor
            p={edit}
            hands={handsWith(hands, edit)}
            onDraft={setDraft}
            onClose={closeEditor}
            onSave={(p) => {
              savePlayer(p);
              setEdit(null);
            }}
            onDelete={() =>
              confirmAction(t('Apagar {name}?', { name: edit.name }), t('As notas sobre este jogador desaparecem. As mãos ficam.'), t('Apagar'), () => {
                deletePlayer(edit.id);
                setEdit(null);
              })
            }
          />
        )}
      </Modal>
    </View>
  );
}

/** Who was at this table: one tap opens their note, before any search. */
function TableStrip({ live, list, where, onOpen }: { live: boolean; list: PlayerNote[]; where: string; onOpen: (p: PlayerNote) => void }) {
  return (
    <View style={st.table}>
      <Row gap={6}>
        {live ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.good }} /> : null}
        <T v="label" color={live ? C.good : undefined} style={{ flex: 1 }} numberOfLines={1}>
          {live ? t('Nesta mesa') : t('Na última sessão')}
          {where ? ` · ${where}` : ''}
        </T>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.md }}>
        {list.map((p) => {
          const type = p.tags.find((x) => TYPE_TAGS.includes(x)) ?? p.tags[0];
          return (
            <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={[p.name, type ? t(type) : ''].filter(Boolean).join(', ')} onPress={() => onOpen(p)} style={({ pressed }) => ({ width: 64, alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}>
              <View style={[st.ring, { borderColor: (type && tagColor(type)) || C.borderStrong }]}>
                <Avatar name={p.name || '?'} size={44} />
              </View>
              <T v="tiny" color={C.text} numberOfLines={1}>
                {p.name}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** One player in a line or three: name and type, how you know them, when you saw them, the first line of the note. */
function NoteRow({ p, first, last, hands, seen, vpip, onPress }: { p: PlayerNote; first: boolean; last: boolean; hands: number; seen?: number; vpip?: OpponentStats; onPress: () => void }) {
  const win = useWindowDimensions();
  // 200% text or a very small screen: no avatar, the numbers go under the name.
  const big = win.fontScale >= 1.6 || win.width < 330;
  const type = p.tags.find((x) => TYPE_TAGS.includes(x)) ?? p.tags[0];
  const read = p.notes.split('\n').map((l) => l.trim()).find(Boolean);
  const sub = [p.look, seen ? t('Visto a {date}', { date: shortDate(seen) }) : ''].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [st.row, big && { flexDirection: 'column', alignItems: 'stretch', gap: 4 }, first && st.rowFirst, last && st.rowLast, !last && st.rowLine, pressed && { backgroundColor: C.surface2 }]}>
      {big ? null : <Avatar name={p.name || '?'} size={40} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <T v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
            {p.name || t('Sem nome')}
          </T>
          {type ? <Pill label={t(type)} color={tagColor(type)} /> : null}
          {p.tags.length > 1 ? (
            <T v="tiny" color={C.muted}>
              {`+${p.tags.length - 1}`}
            </T>
          ) : null}
        </Row>
        {sub ? (
          <T v="small" numberOfLines={big ? undefined : 1}>
            {sub}
          </T>
        ) : null}
        {read ? (
          <T v="small" color={C.text} numberOfLines={big ? 3 : 1}>
            {read}
          </T>
        ) : null}
      </View>
      <View style={big ? st.numsBig : { alignItems: 'flex-end', gap: 2 }}>
        {vpip?.hands ? (
          <T v="monoS" color={C.textDim} accessibilityLabel={`VPIP ${pct(vpip.vpip, vpip.hands)}%, PFR ${pct(vpip.pfr, vpip.hands)}%`}>
            {`${pct(vpip.vpip, vpip.hands)}/${pct(vpip.pfr, vpip.hands)}`}
          </T>
        ) : null}
        {hands ? (
          <Row gap={3}>
            <Ionicons name="albums-outline" size={12} color={C.muted} />
            <T v="tiny">{String(hands)}</T>
          </Row>
        ) : null}
      </View>
    </Pressable>
  );
}

function PlayerEditor({ p, hands, onDraft, onSave, onClose, onDelete }: { p: PlayerNote; hands: Hand[]; onDraft: (p: PlayerNote) => void; onSave: (p: PlayerNote) => void; onClose: () => void; onDelete: () => void }) {
  const [x, setX] = useState(p);
  useEffect(() => onDraft(x), [x, onDraft]);
  const known = !!p.name;
  const toggle = (tg: string) => setX((v) => ({ ...v, tags: v.tags.includes(tg) ? v.tags.filter((k) => k !== tg) : [...v.tags, tg] }));
  // One type at a time: picking one replaces the other three; tapping it again clears it.
  const pickType = (tg: string) => setX((v) => ({ ...v, tags: v.tags.includes(tg) ? v.tags.filter((k) => k !== tg) : [tg, ...v.tags.filter((k) => !TYPE_TAGS.includes(k))] }));
  const { shown, more } = usePaged(hands);
  const win = useWindowDimensions();
  const big = win.fontScale >= 1.6 || win.width < 330;
  const stats = useMemo(() => (known ? opponentStats(hands, [p]).get(p.id) : undefined), [known, hands, p]);
  const who = (
    <View style={{ gap: S.md }}>
      <Field label={t('Nome ou alcunha')} value={x.name} onChangeText={(name) => setX({ ...x, name })} placeholder={t('Ex.: Boné azul')} autoFocus={!known} maxLength={MAX_NAME_LENGTH} />
      <Field label={t('Como o reconheces')} value={x.look} onChangeText={(look) => setX({ ...x, look })} placeholder={t('Boné, óculos, lugar 3…')} />
    </View>
  );
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingTop: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <SheetHeader title={known ? '' : t('Nova nota')} onClose={onClose} closeLabel={t('Fechar')} />
      {known ? (
        // A scouting card: who, how you know them, and the numbers (Sofascore).
        <View style={{ gap: S.md }}>
          <Row gap={S.md}>
            <Avatar name={x.name || '?'} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="h1" numberOfLines={2}>
                {x.name || t('Sem nome')}
              </T>
              {x.look ? <T v="small">{x.look}</T> : null}
            </View>
          </Row>
          <OpponentStatsRow stats={stats} />
        </View>
      ) : (
        who
      )}
      <Section title={t('Que tipo de jogador?')}>
        <View style={st.types}>
          {TYPES.map((ty) => {
            const on = x.tags.includes(ty.tag);
            const col = tagColor(ty.tag) ?? C.accent;
            return (
              <Pressable
                key={ty.tag}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t(ty.tag)}: ${t(ty.line)}`}
                onPress={() => {
                  tap('select');
                  pickType(ty.tag);
                }}
                style={({ pressed }) => [st.type, big && { flexBasis: '100%' }, on && { borderColor: col, backgroundColor: col + '22' }, pressed && { opacity: 0.75 }]}>
                <Ionicons name={ty.icon} size={22} color={on ? col : C.muted} />
                <T v="h3" color={on ? col : C.text}>
                  {t(ty.tag)}
                </T>
                <T v="tiny" style={{ textAlign: 'center' }}>
                  {t(ty.line)}
                </T>
              </Pressable>
            );
          })}
        </View>
      </Section>
      <Section title={t('Tendências')}>
        <Row style={{ flexWrap: 'wrap' }} gap={S.sm}>
          {TENDENCIES.map((tg) => (
            <Chip key={tg} big label={t(tg)} active={x.tags.includes(tg)} color={tagColor(tg)} onPress={() => toggle(tg)} />
          ))}
        </Row>
      </Section>
      <Field label={t('Notas')} value={x.notes} onChangeText={(notes) => setX({ ...x, notes })} placeholder={t('Tendências, tells, sizings…')} multiline />
      {known ? <Section title={t('Quem é')}>{who}</Section> : null}
      <Button title={t('Guardar')} icon="checkmark" disabled={!x.name.trim()} hint={x.name.trim() ? undefined : t('Escreve um nome ou alcunha')} onPress={() => onSave(x)} />
      {hands.length > 0 && (
        <Section title={t('Mãos contra {name}', { name: x.name })}>
          <ListGroup>
            {shown.map((h) => (
              <ListItem
                key={h.id}
                left={h.players[h.hero].cards?.length === 2 ? <CardRow cards={h.players[h.hero].cards!} size="xs" gap={2} /> : undefined}
                title={comboLabel(h.players[h.hero].cards) + ' · ' + (h.game.name || t('Mão'))}
                value={shortDate(h.createdAt)}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/hand/[id]', params: { id: h.id } });
                }}
              />
            ))}
          </ListGroup>
          {more}
        </Section>
      )}
      {known ? <Button title={t('Apagar nota')} kind="danger" size="md" icon="trash-outline" onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const pct = (n: number, d: number) => (d ? String(Math.round((100 * n) / d)) : '—');

const st = StyleSheet.create({
  table: { gap: S.sm, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.md },
  ring: { borderWidth: 2, borderRadius: 26, padding: 2 },
  numsBig: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 64, backgroundColor: C.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: R.lg, borderBottomRightRadius: R.lg },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  fab: { position: 'absolute', right: S.gutter, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 52, paddingHorizontal: 20, borderRadius: R.pill, backgroundColor: C.accent, ...SHADOW },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  type: { flexGrow: 1, flexBasis: '45%', alignItems: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 10, minHeight: 104, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.border },
});
