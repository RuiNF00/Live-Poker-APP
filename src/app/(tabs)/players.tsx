// Player notes: who is who at the table, how they play, and the hands you have
// recorded against them.

import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, ScrollView, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { OpponentStatsRow, tagColor } from '@/components/OpponentStats';
import { CardRow } from '@/components/PlayingCard';
import { Button, Card, Chip, confirmAction, Empty, Field, IconButton, ListGroup, ListItem, Pill, Row, Screen, ScreenHeader, SearchField, Section, SheetHeader, T } from '@/components/ui';
import { sampleColor, SmallSample } from '@/components/SmallSample';
import { usePaged } from '@/components/ShowMore';
import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { shortDate } from '@/poker/format';
import type { Hand } from '@/poker/types';
import { handCounts, opponentStats } from '@/store/queries';
import { uid, useStore } from '@/store/store';
import { PLAYER_TAGS, type PlayerNote } from '@/store/types';
import { C, S } from '@/theme';
import { useSheetAnimation } from '@/lib/motion';

function handsWith(hands: Hand[], p: PlayerNote) {
  const n = p.name.trim().toLowerCase();
  return hands.filter((h) => h.players.some((x, i) => i !== h.hero && (x.playerId === p.id || (n && x.name.trim().toLowerCase() === n))));
}

export default function PlayersScreen() {
  const sheetAnim = useSheetAnimation();
  const { players, savePlayer, deletePlayer, hands } = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<PlayerNote | null>(null);
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
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return [...players]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((p) => !qq || [p.name, p.look, p.notes, ...p.tags].join(' ').toLowerCase().includes(qq));
  }, [players, q]);

  const counts = useMemo(() => handCounts(hands, players), [hands, players]);
  const stats = useMemo(() => opponentStats(hands, players), [hands, players]);

  const blank = (): PlayerNote => ({ id: uid('p_'), name: '', look: '', tags: [], notes: '', createdAt: Date.now(), updatedAt: Date.now() });

  return (
    <Screen scroll={false}>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: S.gutter, paddingTop: S.sm, gap: S.sm, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: S.md, marginBottom: S.sm }}>
            <ScreenHeader title={t('Jogadores')} right={<IconButton name="person-add-outline" label={t('Novo jogador')} onPress={() => setEdit(blank())} />} />
            {players.length > 0 && <SearchField value={q} onChange={setQ} placeholder={t('Nome, aspeto, tag…')} />}
          </View>
        }
        ListEmptyComponent={
          players.length === 0 ? (
            <Empty
              icon="people-outline"
              title={t('Conhece a tua mesa')}
              body={t('Quem é quem, como joga e as mãos que tiveste contra ele. Na próxima vez que o vires, já sabes.')}
              action={<Button title={t('Adicionar jogador')} icon="person-add-outline" onPress={() => setEdit(blank())} />}
            />
          ) : (
            <Empty icon="search" title={t('Nada encontrado')} />
          )
        }
        renderItem={({ item }) => {
          const n = counts.get(item.id) ?? 0;
          const st = stats.get(item.id);
          return (
            <Card onPress={() => setEdit(item)} style={{ gap: S.sm, paddingVertical: S.md }}>
              <Row gap={12}>
                <Avatar name={item.name || '?'} size={40} />
                <View style={{ flex: 1, gap: 1 }}>
                  <T v="h2" numberOfLines={1}>
                    {item.name || t('Sem nome')}
                  </T>
                  {item.look ? (
                    <T v="small" numberOfLines={1}>
                      {item.look}
                    </T>
                  ) : null}
                </View>
                {n ? <Pill icon="albums-outline" label={String(n)} /> : null}
              </Row>
              {item.tags.length ? (
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {item.tags.map((x) => (
                    <Pill key={x} label={t(x)} color={tagColor(x)} />
                  ))}
                </Row>
              ) : null}
              {st?.hands ? (
                <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
                  <T v="monoS" color={sampleColor(st.hands)} accessibilityLabel={`VPIP ${pct(st.vpip, st.hands)}%, PFR ${pct(st.pfr, st.hands)}%`}>
                    {`VPIP ${pct(st.vpip, st.hands)} · PFR ${pct(st.pfr, st.hands)} · 3-bet ${pct(st.threeBet, st.threeBetOpp)}`}
                  </T>
                  {/* Under 20 hands the numbers are a hint, never a read (same rule as the stats app). */}
                  <SmallSample n={st.hands} />
                </Row>
              ) : null}
              {item.notes ? (
                <T v="callout" numberOfLines={2} style={{ color: C.text }}>
                  {item.notes}
                </T>
              ) : null}
            </Card>
          );
        }}
      />
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
    </Screen>
  );
}

function PlayerEditor({ p, hands, onDraft, onSave, onClose, onDelete }: { p: PlayerNote; hands: Hand[]; onDraft: (p: PlayerNote) => void; onSave: (p: PlayerNote) => void; onClose: () => void; onDelete: () => void }) {
  const [x, setX] = useState(p);
  useEffect(() => onDraft(x), [x, onDraft]);
  const toggle = (tg: string) => setX((v) => ({ ...v, tags: v.tags.includes(tg) ? v.tags.filter((k) => k !== tg) : [...v.tags, tg] }));
  const { shown, more } = usePaged(hands);
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingTop: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <SheetHeader title={p.name ? p.name : t('Novo jogador')} onClose={onClose} closeLabel={t('Fechar')} />
      <Card style={{ gap: S.lg }}>
        <Field label={t('Nome ou alcunha')} value={x.name} onChangeText={(name) => setX({ ...x, name })} placeholder={t('Ex.: Boné azul')} autoFocus={!p.name} />
        <Field label={t('Como o reconheces')} value={x.look} onChangeText={(look) => setX({ ...x, look })} placeholder={t('Boné, óculos, lugar 3…')} />
      </Card>
      <Section title={t('Perfil')}>
        <Row style={{ flexWrap: 'wrap' }} gap={S.sm}>
          {PLAYER_TAGS.map((tg) => (
            <Chip key={tg} label={t(tg)} active={x.tags.includes(tg)} color={tagColor(tg)} onPress={() => toggle(tg)} />
          ))}
        </Row>
      </Section>
      {p.name ? (
        <Section title={t('Estatísticas')}>
          <OpponentStatsRow stats={opponentStats(hands, [p]).get(p.id)} />
        </Section>
      ) : null}
      <Field label={t('Notas')} value={x.notes} onChangeText={(notes) => setX({ ...x, notes })} placeholder={t('Tendências, tells, sizings…')} multiline />
      <Button title={t('Guardar')} icon="checkmark" disabled={!x.name.trim()} onPress={() => onSave(x)} />
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
      {p.name ? <Button title={t('Apagar jogador')} kind="danger" size="md" icon="trash-outline" onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const pct = (n: number, d: number) => (d ? String(Math.round((100 * n) / d)) : '—');
