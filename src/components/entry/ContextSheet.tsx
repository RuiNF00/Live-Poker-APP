import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { t } from '@/i18n';
import { useSheetAnimation } from '@/lib/motion';
import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { chips } from '@/poker/format';
import { STAGES, type GameInfo } from '@/poker/types';
import { C, R, S } from '@/theme';

import { Button, Chip, ChipRow, Field, NumField, Row, Segmented, SheetHeader, T } from '../ui';

// Older screens import these from here; they live in the design system now.
export { inputStyle, NumField } from '../ui';

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
  const sheetAnimation = useSheetAnimation();
  const set = (patch: Partial<GameInfo>) => onChange({ ...game, ...patch });
  const levels = game.kind === 'mtt' ? MTT_LEVELS : CASH_LEVELS;
  return (
    <Modal visible={visible} animationType={sheetAnimation} transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '88%', borderTopWidth: 1, borderColor: C.border }}>
        <ScrollView contentContainerStyle={{ padding: S.gutter, paddingTop: S.lg, gap: S.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <SheetHeader title={t('Contexto da mão')} onClose={onClose} closeLabel={t('Fechar')} />
          <Segmented
            options={[
              { key: 'mtt', label: t('Torneio') },
              { key: 'cash', label: 'Cash' },
            ]}
            value={game.kind}
            onChange={(k) =>
              k === 'mtt'
                ? set({ kind: 'mtt', anteType: game.anteType === 'none' ? 'bb' : game.anteType, ante: game.ante || game.bb, straddles: undefined, straddleFrom: undefined, bombPot: undefined })
                : set({ kind: 'cash', anteType: 'none', ante: 0, stage: undefined, level: undefined, playersLeft: undefined })
            }
          />

          <View style={{ gap: S.sm }}>
            <Field
              label={game.kind === 'mtt' ? t('Torneio') : t('Sala / jogo')}
              value={game.name}
              onChangeText={(name) => set({ name })}
              placeholder={game.kind === 'mtt' ? t('Ex.: Main Event do festival') : t('Ex.: Casino, 1/2')}
            />
            {recentNames.length > 0 && (
              <ChipRow>
                {recentNames.map((n) => (
                  <Chip key={n} label={n} active={n === game.name} onPress={() => set({ name: n })} />
                ))}
              </ChipRow>
            )}
          </View>

          <View style={{ gap: S.sm }}>
            <T v="label">Blinds</T>
            <ChipRow>
              {levels.map(([sb, bb]) => (
                <Chip
                  key={`${sb}/${bb}`}
                  label={`${chips(sb)}/${chips(bb)}`}
                  active={game.sb === sb && game.bb === bb}
                  onPress={() => set({ sb, bb, ante: game.kind === 'mtt' && game.anteType !== 'none' ? (game.anteType === 'bb' ? bb : Math.round(bb / 8)) : 0 })}
                />
              ))}
            </ChipRow>
            <Row gap={10}>
              <NumField label="SB" value={game.sb} onChange={(sb) => set({ sb })} />
              <NumField label="BB" value={game.bb} onChange={(bb) => set({ bb })} />
              <NumField label="Ante" value={game.ante} onChange={(ante) => set({ ante, anteType: ante ? (game.anteType === 'none' ? 'bb' : game.anteType) : 'none' })} />
            </Row>
            <ChipRow>
              <Chip label="BB ante" active={game.anteType === 'bb'} onPress={() => set({ anteType: 'bb', ante: game.ante || game.bb })} />
              <Chip label={t('Ante de todos')} active={game.anteType === 'all'} onPress={() => set({ anteType: 'all', ante: game.ante && game.anteType !== 'bb' ? game.ante : Math.round(game.bb / 8) })} />
              <Chip label={t('Ante no botão')} active={game.anteType === 'btn'} onPress={() => set({ anteType: 'btn', ante: game.ante || game.bb })} />
              <Chip label={t('Sem ante')} active={game.anteType === 'none'} onPress={() => set({ anteType: 'none', ante: 0 })} />
            </ChipRow>
          </View>

          {game.kind === 'cash' && (
            <View style={{ gap: S.sm }}>
              <T v="label">{t('Esta mão')}</T>
              <ChipRow>
                <Chip label={t('Normal')} active={!game.straddles && !game.bombPot} onPress={() => set({ straddles: undefined, straddleFrom: undefined, bombPot: undefined })} />
                <Chip label="Straddle" active={game.straddles === 1 && game.straddleFrom !== 'btn'} onPress={() => set({ straddles: 1, straddleFrom: 'utg', bombPot: undefined })} />
                <Chip label={t('Re-straddle')} active={(game.straddles ?? 0) >= 2} onPress={() => set({ straddles: 2, straddleFrom: 'utg', bombPot: undefined })} />
                <Chip label={t('Straddle no botão')} active={game.straddleFrom === 'btn' && !!game.straddles} onPress={() => set({ straddles: 1, straddleFrom: 'btn', bombPot: undefined })} />
                <Chip label="Bomb pot" active={!!game.bombPot} onPress={() => set({ bombPot: game.bombPot || game.bb * 2, straddles: undefined, straddleFrom: undefined })} />
              </ChipRow>
              {game.bombPot ? <NumField label={t('Bomb pot, cada um')} value={game.bombPot} onChange={(b) => set({ bombPot: b || undefined })} /> : null}
            </View>
          )}

          <View style={{ gap: S.sm }}>
            <T v="label">{t('Jogadores na mesa')}</T>
            <ChipRow>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Chip key={n} label={String(n)} big active={tableSize === n} onPress={() => onTableSize(n)} style={{ minWidth: 48 }} />
              ))}
            </ChipRow>
          </View>

          {game.kind === 'mtt' && (
            <>
              <View style={{ gap: S.sm }}>
                <T v="label">{t('Fase do torneio')}</T>
                <ChipRow>
                  {STAGES.map((s) => (
                    <Chip key={s.id} label={s.label} active={game.stage === s.id} onPress={() => set({ stage: game.stage === s.id ? undefined : s.id })} />
                  ))}
                </ChipRow>
              </View>
              <Row gap={10}>
                <NumField label={t('Nível')} value={game.level ?? 0} onChange={(level) => set({ level: level || undefined })} />
                <NumField label={t('Jogadores restantes')} value={game.playersLeft ?? 0} onChange={(p) => set({ playersLeft: p || undefined })} />
                <NumField label="Buy-in" value={game.buyIn ?? 0} onChange={(b) => set({ buyIn: b || undefined })} />
              </Row>
            </>
          )}
          <Button title={t('Feito')} onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}
