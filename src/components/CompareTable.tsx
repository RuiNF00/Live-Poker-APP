// Free and Pro side by side (and Plus, once it is sold): the "table" paywall, and the full
// comparison a player can open from the paywall or a locked screen before deciding.

import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { compareRowLabel, freeVsPro, PLUS_ON } from '@/billing/plans';
import { Button, Row, T, useSheetPad } from '@/components/ui';
import { t } from '@/i18n';
import { C, R, S } from '@/theme';

/** The table. `full` adds every row, for the comparison sheet. */
export function CompareTable({ full }: { full?: boolean }) {
  const cell = (v: string | boolean, pro: boolean) =>
    typeof v === 'boolean' ? (
      <Ionicons name={v ? 'checkmark' : 'remove'} size={18} color={v ? (pro ? C.accent : C.text) : C.muted} accessibilityLabel={v ? t('Sim') : t('Não')} />
    ) : (
      <T v="mono" color={pro ? C.accent : C.text}>
        {v}
      </T>
    );
  return (
    <View style={{ borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
      {/* The column names are read inside each row, so VoiceOver skips the header. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Row style={{ paddingHorizontal: S.md, paddingVertical: S.sm, backgroundColor: C.surface2 }}>
          <View style={{ flex: 1 }} />
          <T v="label" style={{ width: 56, textAlign: 'center' }}>
            {t('Grátis')}
          </T>
          {PLUS_ON ? (
            <T v="label" style={{ width: 56, textAlign: 'center' }}>
              Plus
            </T>
          ) : null}
          <T v="label" color={C.accent} style={{ width: 56, textAlign: 'center' }}>
            Pro
          </T>
        </Row>
      </View>
      {freeVsPro(full).map((r, i) => (
        <Row key={r.label} accessible accessibilityLabel={compareRowLabel(r)} style={{ paddingHorizontal: S.md, minHeight: 44, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}>
          <T v="body" style={{ flex: 1 }}>
            {t(r.label)}
          </T>
          <View style={{ width: 56, alignItems: 'center' }}>{cell(r.free, false)}</View>
          {PLUS_ON ? <View style={{ width: 56, alignItems: 'center' }}>{cell(r.plus, false)}</View> : null}
          <View style={{ width: 56, alignItems: 'center' }}>{cell(r.pro, true)}</View>
        </Row>
      ))}
    </View>
  );
}

/**
 * Everything side by side, in a sheet over the screen it was opened from. `onPro` (a locked
 * screen) adds the way on to the paywall; from the paywall itself the plans are right behind it.
 */
export function CompareSheet({ visible, onClose, onPro }: { visible: boolean; onClose: () => void; onPro?: () => void }) {
  const pad = useSheetPad(S.xl);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessible={false} onPress={onClose} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
        <Pressable accessible={false} accessibilityViewIsModal onAccessibilityEscape={onClose} style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '90%' }}>
          <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: pad, gap: S.lg }}>
            <View style={{ gap: S.xs }}>
              <T v="h1" accessibilityRole="header">
                {t('Grátis e Pro')}
              </T>
              <T v="body" style={{ color: C.textDim }}>
                {t('O que tens hoje fica teu. O Pro junta o resto.')}
              </T>
            </View>
            <CompareTable full />
            <View style={{ gap: S.sm }}>
              {onPro ? <Button title={t('Ver com Pro')} iconRight="chevron-forward" onPress={onPro} /> : null}
              <Button title={onPro ? t('Agora não') : t('Voltar aos planos')} kind={onPro ? 'ghost' : 'secondary'} onPress={onClose} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
