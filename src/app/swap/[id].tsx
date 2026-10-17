// One swap (sweatbook.poker/swap/<id> opens here too). Your own swap: where you stand, the
// prizes and payments, and buttons to add yours. Someone else's link: the terms and a button
// to confirm them, which makes it yours too (side b).

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, Share, View } from 'react-native';

import { useLocked } from '@/components/ProGate';
import { AccountsLocked, BalanceHero, EntryRow, EntrySheet, PAIR, pctLabel, Seal, SwapBadge, TermsCard, useSettledReview, type EntryDraft } from '@/components/swaps/parts';
import { Banner, Button, Card, confirmAction, Empty, Field, ListGroup, Row, Screen, Section, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { noteSource } from '@/lib/attribution';
import { track } from '@/lib/events';
import { claimInvite, shareRef } from '@/lib/referrals';
import { confirmSwap, fetchSwap, SwapError, swapUrl } from '@/lib/swap-api';
import { useStore } from '@/store/store';
import { fromRemote, other, settled, swapLedger, swapNames, waitingOn, type RemoteSwap, type Swap, type SwapEntry } from '@/store/swaps';
import { addEntry, deleteSwapEverywhere, removeEntry, saveSwap, syncSwap, useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';

const POLL_MS = 30000;

export default function SwapScreen() {
  const { id, k, r } = useLocalSearchParams<{ id: string; k?: string; r?: string }>();
  const { swaps, ready } = useSwaps();
  const own = swaps.find((s) => s.id === id);
  const [remote, setRemote] = useState<RemoteSwap | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    track('link_opened', { kind: 'swap' });
    noteSource('swap');
    if (r) claimInvite(String(r), 'share');
  }, [id, r]);

  // Opened from someone's link (or "Open in the app" on the page with your token).
  useEffect(() => {
    if (!ready || own || !id) return;
    let alive = true;
    const token = typeof k === 'string' && /^[a-f0-9]{32,128}$/.test(k) ? k : undefined;
    fetchSwap(String(id), token)
      .then((x) => {
        if (!alive) return;
        if (x && token && x.you) saveSwap(fromRemote(x, token, x.you));
        else setRemote(x);
      })
      .catch(() => alive && setRemote(null));
    return () => {
      alive = false;
    };
  }, [ready, own, id, k]);

  if (own) return <OwnSwap s={own} />;
  return (
    <>
      <Stack.Screen options={{ title: 'Swap', headerBackTitle: t('Voltar') }} />
      {remote === undefined ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.muted} />
        </View>
      ) : remote === null ? (
        <Screen>
          <Empty icon="swap-horizontal" title={t('Swap não encontrado')} body={t('O link pode ter sido apagado por um dos jogadores, ou estás sem rede.')} />
        </Screen>
      ) : (
        <Incoming remote={remote} />
      )}
    </>
  );
}

/** Someone's proposal: read the terms, put your name, confirm. */
function Incoming({ remote }: { remote: RemoteSwap }) {
  const { settings, setSettings } = useStore();
  const [name, setName] = useState(settings.nickname || remote.terms.b.name);
  const [busy, setBusy] = useState(false);
  const tm = remote.terms;
  const names = { a: tm.a.name, b: remote.confirmedName || tm.b.name };

  async function confirm() {
    setBusy(true);
    tap('medium');
    try {
      const { swap, token } = await confirmSwap(remote.id, name.trim());
      saveSwap(fromRemote(swap, token, 'b'));
      if (!settings.nickname) setSettings({ nickname: name.trim() });
      tap('success');
    } catch (e) {
      const code = e instanceof SwapError ? e.code : 'offline';
      Alert.alert(
        t('Não foi possível confirmar'),
        code === 'already_confirmed' ? t('Este swap já foi confirmado.') : code === 'offensive' ? t('Esse nome não é permitido.') : t('Precisa de rede. Tenta de novo quando tiveres sinal.'),
      );
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={{ paddingTop: S.lg }} keyboardShouldPersistTaps="handled">
      <Head terms={tm} names={names} />
      <TermsCard terms={tm} names={names} side={remote.confirmedAt ? null : 'b'}>
        <Seal swap={{ confirmedAt: remote.confirmedAt ? Date.parse(remote.confirmedAt) : undefined, confirmedName: remote.confirmedName ?? undefined, code: remote.code ?? undefined, terms: tm }} />
      </TermsCard>
      {remote.confirmedAt ? (
        <Card tone="inset">
          <T v="small">{t('Este swap já foi confirmado. Só os dois jogadores podem registar prémios; quem o confirmou no browser pode usar o botão "Abrir na app" da página.')}</T>
        </Card>
      ) : (
        <>
          <Section title={t('O teu nome')}>
            <Field value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" />
          </Section>
          <Button lines={2} title={busy ? t('A confirmar o swap…') : t('Confirmo o swap')} icon="checkmark-circle-outline" disabled={!name.trim() || busy} onPress={confirm} />
          <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
            {t('Ao confirmar, os termos e a hora ficam fixados. Nenhum dos dois os pode mudar depois.')}
          </T>
          <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
            {t('Registo e contas apenas. Nenhum dinheiro passa pela Sweatbook: os pagamentos fazem-se entre vocês.')} {t('Só para maiores de 18 anos.')}
          </T>
        </>
      )}
    </Screen>
  );
}

function Head({ terms, names }: { terms: Swap['terms']; names: Record<'a' | 'b', string> }) {
  return (
    <View style={{ gap: 4 }}>
      <T v="label">{[terms.scope === 'series' ? t('Série inteira') : t('Um evento'), terms.venue].filter(Boolean).join(' · ')}</T>
      <T v="title">{terms.title}</T>
      <T v="callout">
        {names.a} × {names.b}
      </T>
    </View>
  );
}

function OwnSwap({ s }: { s: Swap }) {
  // Who owes whom: with my Pro, or for everyone when the creator has Pro.
  const locked = useLocked('swaps') && !s.accounts;
  const [sheet, setSheet] = useState<'result' | 'payment' | null>(null);
  const [offline, setOffline] = useState(false);
  const names = swapNames(s);
  const them = names[other(s.side)];
  const l = swapLedger(s);
  const cur = s.terms.currency;
  const pending = s.entries.some((e) => e.pending);
  useSettledReview(!pending && s.entries.some((e) => e.kind === 'payment') && settled(l));

  const sync = useCallback(() => syncSwap(s.id).then((ok) => setOffline(!ok)), [s.id]);
  useEffect(() => {
    sync();
    const poll = setInterval(() => AppState.currentState === 'active' && sync(), POLL_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && sync());
    return () => {
      clearInterval(poll);
      sub.remove();
    };
  }, [sync]);

  async function share() {
    const ref = await shareRef().catch(() => '');
    const url = swapUrl(s.id, ref);
    track('link_shared', { channel: 'swap' });
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(url);
      Alert.alert(t('Link copiado'), url);
    } else
      await Share.share({
        message: s.confirmedAt
          ? t('O nosso swap no {title}, com as contas: {url}', { title: s.terms.title, url })
          : t('Swap de {pct} no {title}. Confirma aqui para ficar por escrito: {url}', { pct: pctLabel(s.terms[s.side].pct), title: s.terms.title, url }),
      });
  }

  async function save(e: EntryDraft) {
    setSheet(null);
    const { sessionId, ...entry } = e;
    const res = await addEntry(s.id, entry, sessionId);
    tap('success');
    if (res === 'queued') setOffline(true);
  }

  function onEntry(e: SwapEntry) {
    if (e.side !== s.side) return;
    confirmAction(t('Apagar registo?'), t('{name} deixa de o ver. Usa isto só para corrigir um erro.', { name: them }), t('Apagar'), async () => {
      if (!(await removeEntry(s.id, e))) Alert.alert(t('Sem rede'), t('Tenta de novo quando tiveres sinal.'));
    });
  }

  const results = s.entries.filter((e) => e.kind === 'result').sort((a, b) => b.at - a.at);
  const payments = s.entries.filter((e) => e.kind === 'payment').sort((a, b) => b.at - a.at);

  return (
    <>
      <Stack.Screen options={{ title: 'Swap', headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <Head terms={s.terms} names={names} />

        {s.left && s.left !== s.side ? (
          <Banner tone="info" icon="lock-closed-outline" title={t('Só para leitura')} body={t('O outro jogador apagou os dados. As contas ficam como estavam.')} />
        ) : s.gone ? (
          <Banner tone="warn" icon="trash-outline" title={t('Apagado do servidor')} body={t('Um dos jogadores apagou o link. Esta cópia fica no teu telemóvel como registo.')} />
        ) : offline || pending ? (
          <Banner tone="info" icon="cloud-offline-outline" title={t('Sem rede')} body={t('O que registares fica guardado e é enviado quando houver sinal.')} />
        ) : null}

        {!s.confirmedAt && !s.gone ? (
          <Card tone="warn" style={{ gap: S.md }}>
            <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="hourglass-outline" size={22} color={C.warn} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="h3">{t('À espera que {name} confirme', { name: them })}</T>
                <T v="small">{t('Nada conta até lá. Quando confirmar, os termos e a hora ficam fixados e recebes aqui o código do acordo.')}</T>
              </View>
            </Row>
            <Button lines={2} size="md" title={t('Enviar o link outra vez')} icon="share-outline" onPress={share} />
          </Card>
        ) : null}

        {s.confirmedAt ? locked ? <AccountsLocked /> : <BalanceHero l={l} name={them} currency={cur} gone={s.gone} /> : null}

        {s.confirmedAt && !s.gone && !s.left ? (
          <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
            <Button lines={2} title={t('Cobrei')} icon="trophy-outline" style={PAIR} onPress={() => setSheet('result')} />
            <Button lines={2} title={!locked && l.balance < -0.5 ? t('Paguei') : t('Pagamento')} kind="secondary" icon="cash-outline" style={PAIR} onPress={() => setSheet('payment')} />
          </Row>
        ) : null}

        {waitingOn(s) ? (
          <Card tone="inset" style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
            <Ionicons name="hourglass-outline" size={18} color={C.textDim} />
            <T v="small" style={{ flex: 1 }}>
              {t('À espera do resultado de {name}', { name: them })}
            </T>
          </Card>
        ) : null}

        {s.confirmedAt && !s.gone && !s.left ? (
          <Section hint={t('Mãos, notas e bankroll nunca saem do teu telemóvel. Desliga quando quiseres.')}>
            <ListGroup>
              <ToggleItem
                icon="flash-outline"
                title={t('Enviar o meu resultado sozinho')}
                subtitle={t('Ao acabar um torneio deste swap, o prémio e o evento entram sem perguntar.')}
                value={!!s.autoShare}
                onChange={(v) => saveSwap({ ...s, autoShare: v, updatedAt: Date.now() })}
              />
            </ListGroup>
          </Section>
        ) : null}

        <Section title={t('Acordo')}>
          <TermsCard terms={s.terms} names={names} side={s.side}>
            <Seal swap={s} />
          </TermsCard>
        </Section>

        {s.confirmedAt && !s.entries.length ? (
          <Card tone="inset" style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}>
            <SwapBadge />
            <T v="small" style={{ flex: 1 }}>
              {t('Quando cobrares, toca em "Cobrei". {name} regista os seus prémios e as contas fazem-se sozinhas.', { name: them })}
            </T>
          </Card>
        ) : null}

        {results.length ? (
          <Section title={t('Prémios')} hint={t('Mantém premido um registo teu para o apagar.')}>
            <ListGroup>
              {results.map((e) => (
                <EntryRow key={e.cid + e.side} swap={s} e={e} hideOwed={locked} onLongPress={() => onEntry(e)} />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        {payments.length ? (
          <Section title={t('Pagamentos')}>
            <ListGroup>
              {payments.map((e) => (
                <EntryRow key={e.cid + e.side} swap={s} e={e} hideOwed={locked} onLongPress={() => onEntry(e)} />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        <View style={{ gap: S.sm, marginTop: S.md }}>
          {s.confirmedAt && !s.gone && !locked ? <Button lines={2} title={t('Partilhar as contas')} kind="ghost" size="md" icon="share-outline" onPress={share} /> : null}
          {s.confirmedAt ? (
            <Button lines={2}
              title={s.archived ? t('Tirar do arquivo') : t('Arquivar')}
              kind="ghost"
              size="md"
              icon="archive-outline"
              onPress={() => {
                saveSwap({ ...s, archived: !s.archived, updatedAt: Date.now() });
                if (!s.archived) router.back();
              }}
            />
          ) : null}
          <Button lines={2}
            title={s.confirmedAt && !s.gone ? t('Apagar para os dois') : t('Apagar')}
            kind="danger"
            size="md"
            onPress={() =>
              confirmAction(
                s.confirmedAt && !s.gone ? t('Apagar o swap para os dois?') : t('Apagar o swap?'),
                s.confirmedAt && !s.gone
                  ? t('O link deixa de funcionar e nenhum dos dois pode registar mais nada. Quando estiver acertado, prefere "Arquivar".')
                  : t('O link deixa de funcionar.'),
                t('Apagar'),
                async () => {
                  if (await deleteSwapEverywhere(s.id)) router.back();
                  else Alert.alert(t('Sem rede'), t('Tenta de novo quando tiveres sinal.'));
                },
              )
            }
          />
        </View>
      </Screen>
      <EntrySheet swap={sheet ? s : null} kind={sheet ?? 'result'} owe={locked ? 0 : Math.max(0, -l.balance)} onClose={() => setSheet(null)} onSave={save} />
    </>
  );
}

