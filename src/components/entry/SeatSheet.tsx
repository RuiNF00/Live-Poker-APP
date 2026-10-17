import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { bbs, chips } from '@/poker/format';
import type { Player } from '@/poker/types';
import type { OpponentStats } from '@/store/queries';
import type { PlayerNote } from '@/store/types';
import { C, R, S } from '@/theme';

import { AmountPad } from '../AmountPad';
import { OpponentStatsRow } from '../OpponentStats';
import { Button, Chip, ChipRow, Field, inputStyle, Row, SheetHeader, T } from '../ui';

export function SeatSheet({
  visible,
  title,
  player,
  isHero,
  heroStack,
  bb,
  known,
  stats,
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
  /** Reads per known player, shown once the seat is someone you know. */
  stats?: Map<string, OpponentStats>;
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
  const knownId = playerId ?? known.find((k) => q && k.name.trim().toLowerCase() === q)?.id;
  const quick = [20, 40, 60, 100].map((x) => x * bb);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.border, padding: S.gutter, paddingTop: S.lg, paddingBottom: 36, gap: S.lg }}>
        <SheetHeader title={title} onClose={onClose} closeLabel={t('Fechar')} />
        <View style={{ gap: S.sm }}>
          <Field
            label={t('Nome')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setPlayerId(undefined);
            }}
            placeholder={isHero ? t('O teu nome') : t('Ex.: Boné vermelho')}
          />
          {!isHero && sugg.length > 0 && (
            <ChipRow>
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
            </ChipRow>
          )}
          {!isHero && knownId && stats ? <OpponentStatsRow stats={stats.get(knownId)} /> : null}
        </View>
        <View style={{ gap: S.sm }}>
          <T v="label">{t('Stack no início da mão')}</T>
          <Pressable onPress={() => setPad(true)} style={[inputStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <T v="monoL">{chips(stack)}</T>
            <T v="monoS">{bbs(stack, bb)}</T>
          </Pressable>
          <ChipRow>
            {!isHero && <Chip label={t('Igual ao meu')} onPress={() => setStack(heroStack)} />}
            {quick.map((v) => (
              <Chip key={v} label={bbs(v, bb)} active={stack === v} onPress={() => setStack(v)} />
            ))}
          </ChipRow>
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
