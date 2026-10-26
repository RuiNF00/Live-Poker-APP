// Before a hand leaves the phone: what the link shows, in the player's own names,
// and a switch for each thing they may want to keep out. The same switches as in Definições.

import React from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import type { Hand } from '@/poker/types';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

import { ListGroup, T, ToggleItem } from './ui';

/** The hero's own name, when it is one they typed (not the "Hero" every new hand starts with). */
export function ownName(hand: Hand): string {
  const n = hand.players[hand.hero]?.name?.trim() ?? '';
  return n.toLowerCase() === 'hero' ? '' : n;
}

/** `shared`: the link already exists, so the switches would change nothing on it. */
export function WhatFriendsSee({ hand, shared = false }: { hand: Hand; shared?: boolean }) {
  const { settings, setSettings } = useStore();
  // The title and tags go too (the page shows them after a vote); say so when the hand has them.
  const title = !!hand.title?.trim();
  const tags = hand.tags.length > 0;
  const what =
    title && tags
      ? t('As cartas, as ações e as fichas desta mão, com o título e as etiquetas.')
      : title
        ? t('As cartas, as ações e as fichas desta mão, com o título.')
        : tags
          ? t('As cartas, as ações e as fichas desta mão, com as etiquetas.')
          : t('As cartas, as ações e as fichas desta mão.');
  const never = t('Nunca veem o buy-in, os teus resultados, a bankroll nem as notas por rua.');
  if (shared) {
    return (
      <View style={{ gap: 4 }} accessible>
        <T v="label">{t('O que os amigos veem')}</T>
        <T v="small">{what + ' ' + never}</T>
        <T v="tiny">{t('Para mudar o que o link mostra, apaga a partilha e partilha outra vez.')}</T>
      </View>
    );
  }
  const me = ownName(hand);
  // Tournament names always go; a cash game's name is often the casino, so it stays here unless switched on.
  const game = hand.game.kind === 'cash' ? hand.game.name.trim() : '';
  const named = hand.players.some((p, i) => i !== hand.hero && !!p.name?.trim());
  const notes = !!hand.notes?.trim();
  return (
    <View style={{ gap: S.sm }}>
      <View style={{ gap: 4 }} accessible>
        <T v="label">{t('O que os amigos veem')}</T>
        <T v="small" style={{ color: C.text }}>
          {what}
        </T>
        <T v="small">{never}</T>
      </View>
      {me || game || named || notes ? (
        <ListGroup>
          {me ? (
            <ToggleItem
              icon="person-circle-outline"
              title={t('O teu nome')}
              subtitle={settings.shareHideMe ? t('Apareces como Hero') : t('Aparece «{name}» no teu lugar', { name: me })}
              value={!settings.shareHideMe}
              onChange={(v) => setSettings({ shareHideMe: !v })}
            />
          ) : null}
          {game ? (
            <ToggleItem
              icon="location-outline"
              title={t('Nome do jogo')}
              subtitle={settings.shareCashName ? t('Aparece «{name}»', { name: game }) : t('Aparece só «{plain}»', { plain: 'Cash' })}
              value={!!settings.shareCashName}
              onChange={(shareCashName) => setSettings({ shareCashName })}
            />
          ) : null}
          {named ? (
            <ToggleItem
              icon="people-outline"
              title={t('Nomes dos adversários')}
              subtitle={settings.shareNames ? t('Os nomes que lhes deste aparecem no link') : t('Aparecem como BTN, SB, BB…')}
              value={settings.shareNames}
              onChange={(shareNames) => setSettings({ shareNames })}
            />
          ) : null}
          {notes ? (
            <ToggleItem icon="document-text-outline" title={t('As minhas notas da mão')} value={settings.shareNotes} onChange={(shareNotes) => setSettings({ shareNotes })} />
          ) : null}
        </ListGroup>
      ) : null}
    </View>
  );
}
