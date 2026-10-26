// Live session updates by voice: the player dictates (or types) "nível 12,
// stack 45 mil", sees what was understood and applies it in one tap. Opened
// from the session screen through ./voice-chunk, never imported directly.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { t } from '@/i18n';
import { useSheetAnimation } from '@/lib/motion';
import { chips, money } from '@/poker/format';
import { applyLive, liveChanges, type LiveChange } from '@/poker/voice-live';
import type { Session } from '@/store/types';
import { C, R, S } from '@/theme';

import { Button, Field, Row, SheetHeader, T, useSheetPad } from './ui';

function line(c: LiveChange, s: Session): string {
  switch (c.k) {
    case 'stack':
      return c.inBB ? t('Stack: {n} bb', { n: c.v }) : t('Stack: {chips}', { chips: chips(c.v) });
    case 'level':
      return t('Nível {n}', { n: c.v });
    case 'levelStep':
      return c.dir > 0 ? t('Subir nível') : t('Descer nível');
    case 'blinds':
      return c.ante !== undefined ? t('Blinds {sb}/{bb}, ante {ante}', { sb: chips(c.sb), bb: chips(c.bb), ante: chips(c.ante) }) : t('Blinds {sb}/{bb}', { sb: chips(c.sb), bb: chips(c.bb) });
    case 'rebuy':
      return `${s.kind === 'mtt' ? 'Re-entry' : 'Rebuy'} · ${money(s.buyIn, s.currency)}`;
    case 'addon':
      return `Add-on · ${money(s.buyIn, s.currency)}`;
    case 'pause':
      return t('Pausa');
    case 'resume':
      return t('Retomar');
    case 'left':
      return t('Restam {n}', { n: c.v });
    case 'entries':
      return t('{n} inscritos', { n: c.v });
    case 'note':
      return t('Nota: {text}', { text: c.text });
  }
}

export function LiveVoiceSheet({ visible, session, onClose, onDone }: { visible: boolean; session: Session; onClose: () => void; onDone: (title: string, patch: Partial<Session>) => void }) {
  const sheetAnimation = useSheetAnimation();
  const sheetPad = useSheetPad(24);
  const [text, setText] = useState('');
  const heard = useDeferredValue(text);
  const changes = useMemo(() => liveChanges(heard).filter((c) => session.kind === 'mtt' || (c.k !== 'left' && c.k !== 'entries' && c.k !== 'addon')), [heard, session.kind]);
  const close = () => {
    setText('');
    onClose();
  };
  const done = () => {
    const patch = applyLive(session, changes);
    setText('');
    onDone(changes.map((c) => line(c, session)).join(' · '), patch);
  };

  return (
    <Modal visible={visible} animationType={sheetAnimation} transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={close} />
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '92%', borderTopWidth: 1, borderColor: C.border }}>
          <ScrollView contentContainerStyle={{ padding: S.gutter, paddingTop: S.lg, gap: S.md, paddingBottom: sheetPad }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <SheetHeader title={t('Atualizar por voz')} onClose={close} closeLabel={t('Fechar')} />
            <Row gap={8} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="mic" size={16} color={C.accent} style={{ marginTop: 2 }} />
              <T v="small" color={C.textDim} style={{ flex: 1 }}>
                {t('Toca no microfone do teclado e diz o que mudou: o stack, o nível, um rebuy, quantos restam. Também podes escrever.')}
              </T>
            </Row>
            <Field
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              autoCorrect={false}
              accessibilityLabel={t('O que mudou, por palavras tuas')}
              placeholder={t('Nível 12, stack 45 mil, restam 80')}
              inputStyle={{ minHeight: 80 }}
            />
            {changes.length > 0 && (
              <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
                <T v="label">{t('O que percebemos')}</T>
                {changes.map((c, i) => (
                  <Row key={i} gap={8}>
                    <Ionicons name="checkmark-circle" size={16} color={C.good} />
                    <T v="small" style={{ flex: 1 }}>
                      {line(c, session)}
                    </T>
                  </Row>
                ))}
              </View>
            )}
            {!changes.length && heard.trim().length > 8 && (
              <T v="small" color={C.textDim} accessibilityLiveRegion="polite">
                {t('Ainda não percebemos. Experimenta «stack 45 mil» ou «nível 12».')}
              </T>
            )}
            <Button
              title={t('Atualizar')}
              icon="checkmark"
              disabled={!changes.length}
              onPress={done}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
