import React from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { chips } from '@/poker/format';
import { STAGES, type GameInfo } from '@/poker/types';
import { C, R, ff } from '@/theme';

import { Button, Chip, Row, T } from '../ui';

export function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <T v="label">{label}</T>
      <TextInput
        value={value ? String(value) : ''}
        onChangeText={(t) => onChange(parseInt(t.replace(/\D/g, ''), 10) || 0)}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={C.muted}
        style={inputStyle}
      />
    </View>
  );
}

export const inputStyle = {
  backgroundColor: C.bg,
  borderRadius: R.md,
  borderWidth: 1,
  borderColor: C.border,
  color: C.text,
  paddingHorizontal: 12,
  paddingVertical: 11,
  fontSize: 16,
  fontWeight: '600' as const,
  fontFamily: ff(600),
};

export function ContextSheet({
  visible,
  game,
  tableSize,
  recentNames,
  onChange,
  onTableSize,
  onClose,
}: {
  visible: boolean;
  game: GameInfo;
  tableSize: number;
  recentNames: string[];
  onChange: (g: GameInfo) => void;
  onTableSize: (n: number) => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<GameInfo>) => onChange({ ...game, ...patch });
  const levels = game.kind === 'mtt' ? MTT_LEVELS : CASH_LEVELS;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '88%' }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h1">Contexto da mão</T>
            <Row>
              <Chip label="Torneio" active={game.kind === 'mtt'} onPress={() => set({ kind: 'mtt', anteType: game.anteType === 'none' ? 'bb' : game.anteType, ante: game.ante || game.bb })} />
              <Chip label="Cash" active={game.kind === 'cash'} onPress={() => set({ kind: 'cash', anteType: 'none', ante: 0, stage: undefined })} />
            </Row>
          </Row>

          <View style={{ gap: 6 }}>
            <T v="label">{game.kind === 'mtt' ? 'Torneio' : 'Sala / jogo'}</T>
            <TextInput
              value={game.name}
              onChangeText={(name) => set({ name })}
              placeholder={game.kind === 'mtt' ? 'Ex.: EPT Main Event' : 'Ex.: Casino Lisboa 1/2'}
              placeholderTextColor={C.muted}
              style={inputStyle}
            />
            {recentNames.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {recentNames.map((n) => (
                  <Chip key={n} label={n} active={n === game.name} onPress={() => set({ name: n })} />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={{ gap: 6 }}>
            <T v="label">Blinds</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {levels.map(([sb, bb]) => (
                <Chip
                  key={bb}
                  label={`${chips(sb)}/${chips(bb)}`}
                  active={game.sb === sb && game.bb === bb}
                  onPress={() => set({ sb, bb, ante: game.kind === 'mtt' && game.anteType !== 'none' ? (game.anteType === 'bb' ? bb : Math.round(bb / 8)) : 0 })}
                />
              ))}
            </ScrollView>
            <Row gap={10}>
              <NumField label="SB" value={game.sb} onChange={(sb) => set({ sb })} />
              <NumField label="BB" value={game.bb} onChange={(bb) => set({ bb })} />
              <NumField label="Ante" value={game.ante} onChange={(ante) => set({ ante, anteType: ante ? (game.anteType === 'none' ? 'bb' : game.anteType) : 'none' })} />
            </Row>
            <Row>
              <Chip label="BB ante" active={game.anteType === 'bb'} onPress={() => set({ anteType: 'bb', ante: game.ante || game.bb })} />
              <Chip label="Ante de todos" active={game.anteType === 'all'} onPress={() => set({ anteType: 'all', ante: game.ante && game.anteType !== 'bb' ? game.ante : Math.round(game.bb / 8) })} />
              <Chip label="Sem ante" active={game.anteType === 'none'} onPress={() => set({ anteType: 'none', ante: 0 })} />
            </Row>
          </View>

          <View style={{ gap: 6 }}>
            <T v="label">Jogadores na mesa</T>
            <Row style={{ flexWrap: 'wrap' }} gap={6}>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Chip key={n} label={String(n)} big active={tableSize === n} onPress={() => onTableSize(n)} />
              ))}
            </Row>
          </View>

          {game.kind === 'mtt' && (
            <>
              <View style={{ gap: 6 }}>
                <T v="label">Fase do torneio</T>
                <Row style={{ flexWrap: 'wrap' }} gap={6}>
                  {STAGES.map((s) => (
                    <Chip key={s.id} label={s.label} active={game.stage === s.id} onPress={() => set({ stage: game.stage === s.id ? undefined : s.id })} />
                  ))}
                </Row>
              </View>
              <Row gap={10}>
                <NumField label="Nível" value={game.level ?? 0} onChange={(level) => set({ level: level || undefined })} />
                <NumField label="Jogadores restantes" value={game.playersLeft ?? 0} onChange={(p) => set({ playersLeft: p || undefined })} />
                <NumField label="Buy-in" value={game.buyIn ?? 0} onChange={(b) => set({ buyIn: b || undefined })} />
              </Row>
            </>
          )}
          <Button title="Feito" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}
