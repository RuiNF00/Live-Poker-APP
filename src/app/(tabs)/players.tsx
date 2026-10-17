// Player notes: who is who at the table, how they play, and the hands you have
// recorded against them.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { inputStyle } from '@/components/entry/ContextSheet';
import { Button, Chip, Empty, Row, T } from '@/components/ui';
import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { shortDate } from '@/poker/format';
import type { Hand } from '@/poker/types';
import { handCounts } from '@/store/queries';
import { uid, useStore } from '@/store/store';
import { PLAYER_TAGS, type PlayerNote } from '@/store/types';
import { C, R } from '@/theme';

function handsWith(hands: Hand[], p: PlayerNote) {
  const n = p.name.trim().toLowerCase();
  return hands.filter((h) => h.players.some((x, i) => i !== h.hero && (x.playerId === p.id || (n && x.name.trim().toLowerCase() === n))));
}

export default function PlayersScreen() {
  const insets = useSafeAreaInsets();
  const { players, savePlayer, deletePlayer, hands } = useStore();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<PlayerNote | null>(null);
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return [...players]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((p) => !qq || [p.name, p.look, p.notes, ...p.tags].join(' ').toLowerCase().includes(qq));
  }, [players, q]);

  const counts = useMemo(() => handCounts(hands, players), [hands, players]);

  const blank = (): PlayerNote => ({ id: uid('p_'), name: '', look: '', tags: [], notes: '', createdAt: Date.now(), updatedAt: Date.now() });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="title">{t('Jogadores')}</T>
              <Button small title={t('+ Novo')} onPress={() => setEdit(blank())} />
            </Row>
            {players.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border }}>
                <Ionicons name="search" size={16} color={C.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder={t('Nome, aspeto, tag…')} placeholderTextColor={C.muted} style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15 }} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Empty
            title={t('Notas sobre os teus adversários')}
            body={t('Guarda quem é quem (o do boné, o alemão da mesa 4), como joga e as mãos que tiveste contra ele. Na próxima vez que o vires, já sabes.')}
            action={<Button title={t('Adicionar jogador')} onPress={() => setEdit(blank())} />}
          />
        }
        renderItem={({ item }) => {
          const n = counts.get(item.id) ?? 0;
          return (
            <Pressable onPress={() => setEdit(item)} style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: 12, borderWidth: 1, borderColor: C.border, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="h2">{item.name || t('Sem nome')}</T>
                <T v="tiny">{n ? (n === 1 ? t('1 mão') : t('{n} mãos', { n })) : ''}</T>
              </Row>
              {item.look ? <T v="small">{item.look}</T> : null}
              {item.tags.length ? (
                <T v="tiny" color={C.accent}>
                  {item.tags.map((x) => t(x)).join(' · ')}
                </T>
              ) : null}
              {item.notes ? (
                <T v="small" numberOfLines={2} style={{ color: C.text }}>
                  {item.notes}
                </T>
              ) : null}
            </Pressable>
          );
        }}
      />
      <Modal visible={!!edit} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEdit(null)}>
        {edit && (
          <PlayerEditor
            p={edit}
            hands={handsWith(hands, edit)}
            onClose={() => setEdit(null)}
            onSave={(p) => {
              savePlayer(p);
              setEdit(null);
            }}
            onDelete={() => {
              deletePlayer(edit.id);
              setEdit(null);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

function PlayerEditor({ p, hands, onSave, onClose, onDelete }: { p: PlayerNote; hands: Hand[]; onSave: (p: PlayerNote) => void; onClose: () => void; onDelete: () => void }) {
  const [x, setX] = useState(p);
  const toggle = (tg: string) => setX((v) => ({ ...v, tags: v.tags.includes(tg) ? v.tags.filter((k) => k !== tg) : [...v.tags, tg] }));
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingTop: 24, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h1">{p.name ? p.name : t('Novo jogador')}</T>
        <Pressable onPress={onClose}>
          <T v="body" color={C.textDim}>
            {t('Fechar')}
          </T>
        </Pressable>
      </Row>
      <TextInput value={x.name} onChangeText={(name) => setX({ ...x, name })} placeholder={t('Nome ou alcunha')} placeholderTextColor={C.muted} style={inputStyle} />
      <TextInput value={x.look} onChangeText={(look) => setX({ ...x, look })} placeholder={t('Como o reconheces (boné, óculos, mesa…)')} placeholderTextColor={C.muted} style={inputStyle} />
      <Row style={{ flexWrap: 'wrap' }} gap={6}>
        {PLAYER_TAGS.map((tg) => (
          <Chip key={tg} label={t(tg)} active={x.tags.includes(tg)} onPress={() => toggle(tg)} />
        ))}
      </Row>
      <TextInput
        value={x.notes}
        onChangeText={(notes) => setX({ ...x, notes })}
        placeholder={t('Notas: tendências, tells, sizings…')}
        placeholderTextColor={C.muted}
        multiline
        style={[inputStyle, { minHeight: 110, textAlignVertical: 'top' }]}
      />
      <Button title={t('Guardar')} disabled={!x.name.trim()} onPress={() => onSave(x)} />
      {hands.length > 0 && (
        <View style={{ gap: 6 }}>
          <T v="h2">{t('Mãos contra {name}', { name: x.name })}</T>
          {hands.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => {
                onClose();
                router.push({ pathname: '/hand/[id]', params: { id: h.id } });
              }}
              style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
              <T v="small" style={{ color: C.text }}>
                {comboLabel(h.players[h.hero].cards)} · {h.game.name || t('Mão')}
              </T>
              <T v="tiny">{shortDate(h.createdAt)}</T>
            </Pressable>
          ))}
        </View>
      )}
      {p.name ? <Button title={t('Apagar jogador')} kind="danger" onPress={onDelete} /> : null}
    </ScrollView>
  );
}
