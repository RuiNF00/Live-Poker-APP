import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { bbs, chips } from '@/poker/format';
import type { Player } from '@/poker/types';
import type { PlayerNote } from '@/store/types';
import { C, R } from '@/theme';

import { AmountPad } from '../AmountPad';
import { Button, Chip, Row, T } from '../ui';
import { inputStyle } from './ContextSheet';

export function SeatSheet({
  visible,
  title,
  player,
  isHero,
  heroStack,
  bb,
  known,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  player: Player | null;
  isHero: boolean;
  heroStack: number;
  bb: number;
  known: PlayerNote[];
  onSave: (p: Player, applyStackToAll?: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [stack, setStack] = useState(0);
  const [pad, setPad] = useState(false);
  const [playerId, setPlayerId] = useState<string | undefined>();
  useEffect(() => {
    if (player) {
      setName(player.name);
      setStack(player.stack);
      setPlayerId(player.playerId);
    }
  }, [player, visible]);
  if (!player) return null;
  const q = name.trim().toLowerCase();
  const sugg = known.filter((k) => !q || k.name.toLowerCase().includes(q)).slice(0, 8);
  const quick = [20, 40, 60, 100].map((x) => x * bb);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: 16, paddingBottom: 36, gap: 14 }}>
        <T v="h1">{title}</T>
        <View style={{ gap: 6 }}>
          <T v="label">{t('Nome')}</T>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              setPlayerId(undefined);
            }}
            placeholder={isHero ? t('O teu nome') : t('Ex.: Boné vermelho')}
            placeholderTextColor={C.muted}
            style={inputStyle}
          />
          {!isHero && sugg.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {sugg.map((k) => (
                <Chip
                  key={k.id}
                  label={k.name}
                  active={playerId === k.id}
                  onPress={() => {
                    setName(k.name);
                    setPlayerId(k.id);
                  }}
                />
              ))}
            </ScrollView>
          )}
        </View>
        <View style={{ gap: 6 }}>
          <T v="label">{t('Stack no início da mão')}</T>
          <Pressable onPress={() => setPad(true)} style={[inputStyle, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <T v="h2">{chips(stack)}</T>
            <T v="small">{bbs(stack, bb)}</T>
          </Pressable>
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            {!isHero && <Chip label={t('Igual ao meu')} onPress={() => setStack(heroStack)} />}
            {quick.map((v) => (
              <Chip key={v} label={bbs(v, bb)} active={stack === v} onPress={() => setStack(v)} />
            ))}
          </Row>
        </View>
        <Row gap={10}>
          {isHero ? (
            <Button title={t('Aplicar a todos')} kind="secondary" style={{ flex: 1 }} onPress={() => onSave({ ...player, name, stack, playerId }, true)} />
          ) : null}
          <Button title={t('Guardar')} style={{ flex: 1 }} onPress={() => onSave({ ...player, name, stack, playerId })} />
        </Row>
      </View>
      <AmountPad
        visible={pad}
        title="Stack"
        bb={bb}
        onClose={() => setPad(false)}
        onDone={(v) => {
          setStack(v);
          setPad(false);
        }}
      />
    </Modal>
  );
}
