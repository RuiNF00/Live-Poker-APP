// Saving a player's statement link in your own Sweatbook: opened from the link's
// web page (sweatbook://backing/add?d=…), or by pasting the link here.

import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Avatar } from '@/components/Avatar';
import { backedLabel } from '@/components/staking/use-backing';
import { Button, Card, Field, Row, Screen, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { noteSource } from '@/lib/attribution';
import { decodeStatement, type Statement } from '@/lib/backing-link';
import { track } from '@/lib/events';
import { claimInvite } from '@/lib/referrals';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { S } from '@/theme';

export default function AddBacking() {
  const { d, r } = useLocalSearchParams<{ d?: string; r?: string }>();
  const { saveBacked, backing } = useStore();
  const [text, setText] = useState('');
  const [st, setSt] = useState<Statement | null>(() => (d ? decodeStatement(String(d)) : null));
  const [bad, setBad] = useState(false);

  useEffect(() => {
    if (r) claimInvite(String(r), 'link');
    if (d) {
      track('link_opened', { kind: 'backer_statement' });
      noteSource('backer_page');
    }
  }, [d, r]);

  const read = (raw: string) => {
    const x = decodeStatement(raw);
    setSt(x);
    setBad(!x);
  };
  const paste = async () => {
    const raw = await Clipboard.getStringAsync().catch(() => '');
    setText(raw);
    read(raw);
  };

  const save = () => {
    if (!st) return;
    tap('medium');
    saveBacked(st);
    router.replace({ pathname: '/backing/[id]', params: { id: st.id } });
  };

  const known = st ? backing.find((b) => b.id === st.id) : undefined;
  const older = !!known && !!st && known.statement.at > st.at;

  return (
    <>
      <Stack.Screen options={{ title: t('Guardar contas'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        {st ? (
          <>
            <Card tone="raised" style={{ gap: S.sm, alignItems: 'center', paddingVertical: S.xl }}>
              <Avatar name={st.pl || '?'} size={56} />
              <T v="h2">{st.pl || t('Jogador')}</T>
              <T v="mono" color={backedLabel(st.bal, st.cur).color}>
                {backedLabel(st.bal, st.cur).text}
              </T>
              <T v="small" style={{ textAlign: 'center' }}>
                {[st.rows.length === 1 ? t('1 sessão') : t('{n} sessões', { n: st.rows.length }), st.mk >= 0.01 ? t('makeup {amount}', { amount: money(st.mk, st.cur) }) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            </Card>
            {older ? (
              <T v="small">{t('Já tens contas mais recentes de {name}. Estas ficam de fora.', { name: st.pl || t('o jogador') })}</T>
            ) : (
              <Button
                icon="checkmark-circle-outline"
                title={known ? t('Atualizar as contas') : t('Guardar na minha Sweatbook')}
                onPress={save}
              />
            )}
            <T v="tiny" style={{ textAlign: 'center' }}>
              {t('Ficas a ver a tua parte, o que te deve, o makeup e as sessões em direto. Só tu vês estas contas.')}
            </T>
          </>
        ) : (
          <>
            <T v="body">{t('Cola o link das contas que o jogador te enviou.')}</T>
            <Button icon="clipboard-outline" title={t('Colar o link')} onPress={paste} />
            <Field
              label={t('Ou escreve-o aqui')}
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (v.includes('#')) read(v);
              }}
              placeholder="https://sweatbook.poker/b#…"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {bad ? (
              <Row>
                <T v="small">{t('Este link não tem contas da Sweatbook. Confirma que copiaste a mensagem toda.')}</T>
              </Row>
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}
