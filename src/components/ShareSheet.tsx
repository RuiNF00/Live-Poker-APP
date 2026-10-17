// One "Partilhar" button opens this: every way out of the app in one list
// (Instagram, X, the other apps, copy link…), instead of a row of buttons.

import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { t } from '@/i18n';
import { useSheetAnimation } from '@/lib/motion';
import { C, R, S } from '@/theme';

import { ListGroup, ListItem, SheetHeader, T, type IconName } from './ui';

export interface ShareOption {
  icon: IconName;
  label: string;
  sub?: string;
  onPress: () => void;
}

/** Groups of options; a group with a title shows it above, quieter ("Mais"). */
export function ShareSheet({ visible, title, header, groups, onClose }: { visible: boolean; title?: string; header?: ReactNode; groups: { title?: string; options: ShareOption[] }[]; onClose: () => void }) {
  const sheetAnimation = useSheetAnimation();
  return (
    <Modal visible={visible} animationType={sheetAnimation} transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} accessibilityLabel={t('Fechar')} />
      <View style={{ maxHeight: '85%', backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.border }}>
        <ScrollView contentContainerStyle={{ padding: S.gutter, paddingTop: S.lg, paddingBottom: 36, gap: S.md }}>
          <SheetHeader title={title ?? t('Partilhar')} onClose={onClose} closeLabel={t('Fechar')} />
          {header}
          {groups.map((g, k) => (
            <View key={k} style={{ gap: S.sm }}>
              {g.title ? <T v="label">{g.title}</T> : null}
              <ListGroup>
                {g.options.map((o) => (
                  <ListItem
                    key={o.label}
                    icon={o.icon}
                    iconColor={C.text}
                    title={o.label}
                    subtitle={o.sub}
                    chevron={false}
                    onPress={() => {
                      // Close first: the system share sheet or the next screen opens over nothing.
                      onClose();
                      o.onPress();
                    }}
                  />
                ))}
              </ListGroup>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
