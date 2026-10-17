import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Modal, Pressable, View, type StyleProp, type TextStyle } from 'react-native';

import { GLOSSARY, type TermKey } from '@/data/glossary';
import { t } from '@/i18n';
import { C, S } from '@/theme';

import { SheetHeader, T, type TV } from './ui';

/**
 * A poker abbreviation the player can tap for a one-line definition.
 * Renders like the label it replaces, with a small info mark.
 */
export function Term({ k, v = 'label', style, color }: { k: TermKey; v?: TV; style?: StyleProp<TextStyle>; color?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={k} accessibilityHint={t(GLOSSARY[k].line)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <T v={v} color={color} style={style}>
          {k}
        </T>
        <Ionicons name="information-circle-outline" size={12} color={C.muted} />
      </Pressable>
      <TermSheet k={open ? k : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function TermSheet({ k, onClose }: { k: TermKey | null; onClose: () => void }) {
  return (
    <Modal visible={!!k} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t('Fechar')} onPress={onClose} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: S.xxl, gap: S.md }}>
          {k ? (
            <>
              <SheetHeader title={k} onClose={onClose} />
              <View style={{ gap: S.xs }}>
                <T v="label">{GLOSSARY[k].name}</T>
                <T v="body">{t(GLOSSARY[k].line)}</T>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
