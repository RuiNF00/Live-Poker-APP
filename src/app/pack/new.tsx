// One link for several hands (sweatbook.poker/p/<id>): picked in the list, a folder or a whole
// tournament. Friends get a replay per hand with previous/next, without installing anything.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { CardRow } from '@/components/PlayingCard';
import { Button, Card, Empty, Field, ListGroup, Row, T, tap, ToggleItem } from '@/components/ui';
import { t, variant } from '@/i18n';
import { track } from '@/lib/events';
import { withLang } from '@/lib/link-lang';
import { createPack } from '@/lib/pack-api';
import { MAX_PACK_HANDS, packHands } from '@/lib/pack-core';
import { shareRef } from '@/lib/referrals';
import { useUgcTerms } from '@/components/UgcTerms';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

export default function NewPack() {
  const [termsSheet, acceptUgcTerms] = useUgcTerms();
  const { ids, folder, session } = useLocalSearchParams<{ ids?: string; folder?: string; session?: string }>();
  const { hands, sessions, settings, saveHand } = useStore();
  const pro = usePro();
  const s = session ? sessions.find((x) => x.id === session) : undefined;
  const [title, setTitle] = useState(folder || s?.name || '');
  const [chips, setChips] = useState(false);
  const [busy, setBusy] = useState(false);

  const { send, left, extra } = useMemo(() => {
    const want = new Set((ids ?? '').split(',').filter(Boolean));
    return packHands(hands.filter((h) => (session ? h.sessionId === session : folder ? h.folders?.includes(folder) : want.has(h.id))));
  }, [hands, ids, folder, session]);

  if (send.length < 2)
    return (
      <Empty
        icon="albums-outline"
        title={t('Precisas de pelo menos 2 mãos')}
        body={left ? t('As mãos por completar não entram no link. Acaba-as primeiro.') : t('Seleciona mãos na lista (toque longo) ou abre uma pasta.')}
      />
    );

  const create = async () => {
    tap('medium');
    if (!(await acceptUgcTerms())) return;
    setBusy(true);
    const name = title.trim().slice(0, 80);
    const r = await createPack({ hands: send, title: name, hideAmounts: !chips, share: { names: settings.shareNames, notes: settings.shareNotes }, saveHand });
    setBusy(false);
    if (!r.ok) {
      note(
        t('Link não criado'),
        r.error === 'offline'
          ? t('Sem rede. Tenta outra vez quando tiveres sinal.')
          : r.error === 'busy'
            ? t('Uma das mãos ainda está a ficar com link. Tenta daqui a um instante.')
            : r.error === 'rate_limited'
              ? t('Criaste muitos links seguidos. Tenta daqui a pouco.')
              : t('Não deu para criar o link. Tenta outra vez.'),
      );
      return;
    }
    for (let i = 0; i < r.uploaded; i++) pro.record('share');
    const ref = await shareRef();
    const url = withLang(ref ? `${r.pack.url}?r=${encodeURIComponent(ref)}` : r.pack.url, variant);
    track('link_shared', { channel: 'pack', hands: send.length, ref });
    const msg = `${t('{n} mãos para rever: o que fazias em cada uma? 👀', { n: send.length })}\n${url}`;
    router.replace('/pack');
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      note(t('Link copiado'));
    } else await Share.share({ message: msg }).catch(() => {});
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, gap: S.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      {termsSheet}
      <Card style={{ gap: S.md, paddingVertical: S.lg }}>
        <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="albums" size={22} color={C.accent} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="h2">{t('{n} mãos num só link', { n: send.length })}</T>
            <T v="small">{t('Quem abre vê o replay de cada mão, uma a seguir à outra, e comenta sem instalar nada.')}</T>
          </View>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {send.slice(0, 12).map((h) => (
            <View key={h.id} style={{ paddingVertical: 4, paddingHorizontal: 5, borderRadius: R.sm, backgroundColor: C.surface2 }}>
              {h.players[h.hero].cards?.length === 2 ? <CardRow cards={h.players[h.hero].cards!} size="xs" gap={1} /> : <T v="tiny">—</T>}
            </View>
          ))}
          {send.length > 12 ? (
            <View style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: R.sm, backgroundColor: C.surface2, justifyContent: 'center' }}>
              <T v="tiny">+{send.length - 12}</T>
            </View>
          ) : null}
        </View>
        {left || extra ? (
          <T v="tiny" color={C.warn}>
            {[left ? (left === 1 ? t('1 mão por completar fica de fora.') : t('{n} mãos por completar ficam de fora.', { n: left })) : '', extra ? t('Seguem as {max} mais recentes.', { max: MAX_PACK_HANDS }) : '']
              .filter(Boolean)
              .join(' ')}
          </T>
        ) : null}
      </Card>

      <Field label={t('Título (opcional)')} value={title} onChangeText={setTitle} maxLength={80} placeholder={t('Ex.: Main Event, dia 1')} />

      <ListGroup>
        <ToggleItem icon="cash-outline" title={t('Mostrar fichas')} subtitle={t('Desligado, as mãos abrem em big blinds.')} value={chips} onChange={setChips} />
      </ListGroup>

      <Card tone="inset" style={{ gap: 8 }}>
        <Row gap={8}>
          <Ionicons name="lock-closed" size={15} color={C.textDim} />
          <T v="h3" style={{ fontSize: 14 }}>
            {t('Só quem tiver o link')}
          </T>
        </Row>
        <T v="small">{t('O link não aparece no Google nem no teu perfil, e podes desligá-lo quando quiseres. Cada mão mantém o seu próprio link.')}</T>
        <T v="small">{settings.shareNames ? t('Os nomes dos adversários vão com as mãos.') : t('Os adversários aparecem só pela posição.')}</T>
        <T v="small">{settings.shareNotes ? t('As tuas notas vão com as mãos.') : t('As tuas notas ficam no telemóvel.')}</T>
      </Card>

      <Button title={busy ? t('A criar link…') : t('Criar link e partilhar')} icon="share-outline" disabled={busy} onPress={create} />
    </ScrollView>
  );
}
