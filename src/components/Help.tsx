import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';

import { HELP, type HelpKey } from '@/data/help';
import { t } from '@/i18n';
import { C, S } from '@/theme';

import { SheetHeader, T, useSheetPad } from './ui';

/**
 * A small «?» beside a feature that isn't obvious. Opens two or three lines on what it is,
 * so the screen itself stays short. Goes in a Section's `help` slot.
 */
export function Help({ k, label }: { k: HelpKey; label?: string }) {
  const [open, setOpen] = useState(false);
  const title = t(HELP[k].title);
  // Grows with the section title in larger text, up to the same cap as buttons, so it doesn't look lost beside it.
  const size = Math.round(16 * Math.min(Math.max(useWindowDimensions().fontScale, 1), 1.6));
  return (
    <>
      {label ? (
        // A link with words, for an empty screen where there is no section title to sit beside.
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityHint={title} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="help-circle-outline" size={size} color={C.accent} />
          <T v="small" color={C.accent}>
            {label}
          </T>
        </Pressable>
      ) : (
        // 16 + 2 × 14 = 44 pt to tap.
        <Pressable onPress={() => setOpen(true)} hitSlop={14} accessibilityRole="button" accessibilityLabel={t('Ajuda: {topic}', { topic: title })}>
          <Ionicons name="help-circle-outline" size={size} color={C.muted} />
        </Pressable>
      )}
      <HelpSheet k={open ? k : null} onClose={() => setOpen(false)} />
    </>
  );
}

function HelpSheet({ k, onClose }: { k: HelpKey | null; onClose: () => void }) {
  const sheetPad = useSheetPad(S.xxl);
  return (
    <Modal visible={!!k} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessible={false} onPress={onClose} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
        <Pressable accessible={false} accessibilityViewIsModal onAccessibilityEscape={onClose} style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: sheetPad, gap: S.md }}>
          {k ? (
            <>
              <SheetHeader title={t(HELP[k].title)} onClose={onClose} />
              <View style={{ gap: S.sm }}>
                {HELP[k].lines.map((line) => (
                  <T key={line} v="body">
                    {t(line)}
                  </T>
                ))}
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
