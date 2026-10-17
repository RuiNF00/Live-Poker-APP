// One "Partilhar" button per screen opens this sheet: Instagram, X, the other
// apps and copy link, so a screen never stacks a button per network. The hand
// screen and every card screen (session, festival, carousel, year) use it.

import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useSheetAnimation } from '@/lib/motion';
import { C, S } from '@/theme';

import { ListGroup, ListItem, SheetHeader, tap, type IconName } from './ui';

export interface ShareOption {
  key: string;
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

export interface ShareTargets {
  instagram?: () => void;
  instagramTitle?: string;
  x?: () => void;
  other?: () => void;
  copy?: () => void;
  copyTitle?: string;
}

/** The usual four, in this order; a target with no handler is left out. */
function optionsFor(o: ShareTargets): ShareOption[] {
  const out: (ShareOption | null)[] = [
    o.instagram ? { key: 'instagram', icon: 'logo-instagram', title: o.instagramTitle ?? t('Story no Instagram'), onPress: o.instagram } : null,
    o.x ? { key: 'x', icon: 'logo-x', title: t('Post no X'), onPress: o.x } : null,
    o.other ? { key: 'other', icon: 'share-outline', title: t('Outras apps'), subtitle: t('WhatsApp, Mensagens, guardar imagem…'), onPress: o.other } : null,
    o.copy ? { key: 'copy', icon: 'link-outline', title: o.copyTitle ?? t('Copiar link'), onPress: o.copy } : null,
  ];
  return out.filter((x): x is ShareOption => !!x);
}

// Long enough for the sheet to close before Instagram or the system share sheet opens over it.
const AFTER_CLOSE_MS = 350;

export function ShareSheet({ visible, onClose, title, options: extra, ...targets }: { visible: boolean; onClose: () => void; title?: string; options?: ShareOption[] } & ShareTargets) {
  const options = extra ?? optionsFor(targets);
  const insets = useSafeAreaInsets();
  const animation = useSheetAnimation();
  const pick = (o: ShareOption) => {
    tap('select');
    onClose();
    setTimeout(o.onPress, AFTER_CLOSE_MS);
  };
  return (
    <Modal visible={visible} transparent animationType={animation} onRequestClose={onClose}>
      <Pressable accessibilityLabel={t('Fechar')} onPress={onClose} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: Math.max(insets.bottom, S.lg), gap: S.lg }}>
          <SheetHeader title={title ?? t('Partilhar')} onClose={onClose} />
          <View>
            <ListGroup>
              {options.map((o) => (
                <ListItem key={o.key} icon={o.icon} title={o.title} subtitle={o.subtitle} chevron onPress={() => pick(o)} />
              ))}
            </ListGroup>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
