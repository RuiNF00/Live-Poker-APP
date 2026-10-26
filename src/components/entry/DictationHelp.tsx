// "Como ditar uma mão": what to say, real examples to try, and what the app doesn't
// understand yet. Opened from the voice sheet, so it lives in the voice chunk.

import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { t } from '@/i18n';
import { C, R, S } from '@/theme';

import { Row, T, tap } from '../ui';
import { dictationLang, EXAMPLES } from './dictation-examples';

export function DictationHelp({ onTry, onBack }: { onTry: (text: string) => void; onBack: () => void }) {
  const say = [
    t('A tua posição e as tuas cartas.'),
    t('Em PLO, começa por «PLO» ou «Omaha» e diz as quatro cartas.'),
    t('Cada ação pela ordem, com o valor: quem abre, quem paga, quem sobe.'),
    t('As cartas de cada rua: flop, turn e river.'),
    t('No fim, o que mostraram, se mostraram.'),
    t('Enganaste-te? Diz logo a seguir: «900, não, 1100».'),
  ];
  const notYet = [
    t('Nomes ou lugares («o João», «o lugar 3», «o da minha esquerda»): diz a posição, como UTG, cutoff ou botão.'),
    t('O stack de alguém dito no fim: diz antes da ação dele, «o UTG, com 12 mil, abre».'),
    t('Valores com vírgula por extenso («um vírgula dois»): diz «1200» ou «mil e duzentos».'),
    t('Duas mãos de seguida: conta uma de cada vez.'),
    t("Jogos que não sejam Hold'em ou PLO (Omaha de 4 cartas, sem Hi-Lo)."),
  ];
  const back = (
    <Pressable onPress={onBack} accessibilityRole="button" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
      <Ionicons name="chevron-back" size={16} color={C.accent} />
      <T v="small" color={C.accent}>
        {t('Voltar à mão')}
      </T>
    </Pressable>
  );
  return (
    <View style={{ gap: S.md }}>
      {back}
      <T v="h3" accessibilityRole="header">{t('Como ditar uma mão')}</T>
      <T v="small" color={C.textDim}>
        {t('Conta pela ordem em que aconteceu, como a contarias a um amigo. Não precisa de frases certas.')}
      </T>
      <View style={{ gap: 6 }}>
        {say.map((x) => (
          <Row key={x} gap={8} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="checkmark" size={14} color={C.good} style={{ marginTop: 2 }} />
            <T v="small" style={{ flex: 1 }}>
              {x}
            </T>
          </Row>
        ))}
      </View>
      <T v="label" accessibilityRole="header">
        {t('Exemplos')}
      </T>
      <T v="tiny" color={C.muted}>
        {t('Toca num exemplo para o experimentar.')}
      </T>
      {EXAMPLES[dictationLang()].map((x) => (
        <Pressable
          key={x}
          accessibilityRole="button"
          accessibilityHint={t('Põe este exemplo na mão')}
          onPress={() => {
            tap();
            onTry(x);
          }}
          style={{
            padding: S.sm,
            borderRadius: R.md,
            backgroundColor: C.surface2,
            borderWidth: 1,
            borderColor: C.border,
          }}
        >
          <Row gap={8} style={{ alignItems: 'center' }}>
            <T v="small" style={{ flex: 1 }}>
              «{x}»
            </T>
            <Ionicons name="chevron-forward" size={14} color={C.muted} />
          </Row>
        </Pressable>
      ))}
      <T v="label" accessibilityRole="header">
        {t('Ainda não percebemos')}
      </T>
      <View style={{ gap: 6 }}>
        {notYet.map((x) => (
          <Row key={x} gap={8} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="alert-circle" size={14} color={C.warn} style={{ marginTop: 2 }} />
            <T v="small" color={C.textDim} style={{ flex: 1 }}>
              {x}
            </T>
          </Row>
        ))}
      </View>
      {back}
    </View>
  );
}
