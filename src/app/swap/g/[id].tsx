// One group swap (sweatbook.poker/swap/g/<id> opens here too). Your own group: where you stand,
// who pays whom, the prizes and payments, and buttons to add yours. The group link (with its
// invite): pick your name to take your seat.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, Pressable, Share, View } from 'react-native';

import { GroupEntryRow, GroupEntrySheet, GroupHero, GroupSettle, seatLabel, type GroupDraft } from '@/components/swaps/group-parts';
import { useLocked } from '@/components/ProGate';
import { AccountsLocked, PAIR, pctLabel, useSettledReview } from '@/components/swaps/parts';
import { Banner, Button, Card, Chip, ChipRow, confirmAction, Empty, ListGroup, Row, Screen, Section, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { claimInvite, shareRef } from '@/lib/referrals';
import { SwapError } from '@/lib/swap-api';
import { claimSeat, fetchGroup, groupUrl } from '@/lib/swap-group-api';
import { notice } from '@/lib/notice';
import { shortDate, timeOf } from '@/poker/format';
import { GROUP_MIN, groupFromRemote, groupNet, groupReady, groupWaitingOn, minTransfers, type GroupEntry, type GroupSeat, type RemoteGroup, type SwapGroup } from '@/store/swap-groups';
import { addGroupPrize, leaveGroupEverywhere, releaseSeatHere, removeGroupEntryHere, saveGroup, syncGroup, useGroups } from '@/store/swap-groups-store';
import { C, S } from '@/theme';

const POLL_MS = 30000;
const HEX = /^[a-f0-9]{32,128}$/;

export default function GroupSwapScreen() {
  const params = useLocalSearchParams<{ id: string; k?: string; i?: string; r?: string; pay?: string; '#'?: string }>();
  const { id, r } = params;
  // +native-intent moves #i= and #k= into the query; a link opened inside the app keeps them in '#'.
  const frag = new URLSearchParams(typeof params['#'] === 'string' ? params['#'] : '');
  const k = params.k ?? frag.get('k') ?? undefined;
  const i = params.i ?? frag.get('i') ?? undefined;
  const { groups, ready } = useGroups();
  const own = groups.find((g) => g.id === id);
  const [remote, setRemote] = useState<RemoteGroup | null | undefined>(undefined);
  const invite = typeof i === 'string' && HEX.test(i) ? i : undefined;

  useEffect(() => {
    if (!id) return;
    track('link_opened', { kind: 'swap' });
    if (r) claimInvite(String(r), 'share');
  }, [id, r]);

  useEffect(() => {
    if (!ready || own || !id) return;
    let alive = true;
    const token = typeof k === 'string' && HEX.test(k) ? k : undefined;
    fetchGroup(String(id), token)
      .then((x) => {
        if (!alive) return;
        if (x && token && x.you !== null) saveGroup(groupFromRemote(x, token, x.you));
        else setRemote(x);
      })
      .catch(() => alive && setRemote(null));
    return () => {
      alive = false;
    };
  }, [ready, own, id, k]);

  if (own) return <OwnGroup g={own} pay={params.pay === '1'} />;
  return (
    <>
      <Stack.Screen options={{ title: t('Swap de grupo'), headerBackTitle: t('Voltar') }} />
      {remote === undefined ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.muted} />
        </View>
      ) : remote === null ? (
        <Screen>
          <Empty icon="people" title={t('Swap não encontrado')} body={t('O link pode ter sido apagado, ou estás sem rede.')} />
        </Screen>
      ) : (
        <Join remote={remote} invite={invite} />
      )}
    </>
  );
}

function Head({ g }: { g: Pick<SwapGroup, 'terms' | 'seats'> }) {
  return (
    <View style={{ gap: 4 }}>
      <T v="label">{[t('Swap de grupo'), g.terms.scope === 'series' ? t('Série inteira') : t('Um evento'), g.terms.venue].filter(Boolean).join(' · ')}</T>
      <T v="title">{g.terms.title}</T>
      <T v="callout">{t('{n} jogadores · {pct} de cada um para cada um', { n: g.seats.length, pct: pctLabel(g.terms.pct) })}</T>
    </View>
  );
}

/** Someone's group link: pick your name to take your seat. */
function Join({ remote, invite }: { remote: RemoteGroup; invite?: string }) {
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const open = remote.seats.filter((s) => !s.confirmedAt);

  async function join() {
    if (pick === null || !invite) return;
    setBusy(true);
    tap('medium');
    try {
      const { group, token } = await claimSeat(remote.id, invite, pick);
      saveGroup(groupFromRemote(group, token, pick));
      tap('success');
    } catch (e) {
      const code = e instanceof SwapError ? e.code : 'offline';
      Alert.alert(t('Não foi possível entrar'), code === 'seat_taken' ? t('Esse lugar já foi escolhido.') : t('Precisa de rede. Tenta de novo quando tiveres sinal.'));
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={{ paddingTop: S.lg }}>
      <Head g={{ terms: remote.terms, seats: remote.seats.map((s) => ({ ...s, confirmedAt: s.confirmedAt ? 1 : undefined })) }} />
      {remote.terms.note ? (
        <Card tone="inset">
          <T v="small" style={{ fontStyle: 'italic' }}>
            “{remote.terms.note}”
          </T>
        </Card>
      ) : null}
      {invite && open.length ? (
        <>
          <Section title={t('Quem és tu?')} hint={t('Toca no teu nome para entrar. Cada nome só pode ser escolhido uma vez.')}>
            <ChipRow>
              {remote.seats.map((s) => (
                <Chip key={s.seat} big label={s.name === '-' ? t('Saiu') : s.name} icon={s.confirmedAt ? 'checkmark-circle' : 'person-outline'} active={pick === s.seat} color={s.confirmedAt ? C.muted : undefined} onPress={() => !s.confirmedAt && setPick(s.seat)} />
              ))}
            </ChipRow>
          </Section>
          <Button lines={2}
            title={busy ? t('A entrar…') : pick === null ? t('Escolhe o teu nome') : t('Entrar como {name}', { name: remote.seats.find((s) => s.seat === pick)?.name ?? '' })}
            icon="checkmark-circle-outline"
            disabled={pick === null || busy}
            onPress={join}
          />
          <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
            {t('Ao entrar, aceitas estes termos. Os termos e os nomes já não mudam.')}
          </T>
          <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
            {t('Registo e contas apenas. Nenhum dinheiro passa pela Sweatbook: os pagamentos fazem-se entre vocês.')} {t('Só para maiores de 18 anos.')}
          </T>
        </>
      ) : (
        <Card tone="inset">
          <T v="small">{open.length ? t('Para escolheres o teu lugar, abre o link completo que recebeste no grupo.') : t('Já estão todos no grupo. Quem entrou no browser pode usar o botão "Abrir na app" da página.')}</T>
        </Card>
      )}
    </Screen>
  );
}

function OwnGroup({ g, pay }: { g: SwapGroup; pay?: boolean }) {
  // Who owes whom: with my Pro, or for everyone when the creator has Pro.
  const locked = useLocked('swaps') && !g.accounts;
  // From the "falta acertar" reminder: straight to the payment, the first one I owe already in.
  // (A moment after the screen lands: a sheet opened mid-push is lost on iOS.)
  const [sheet, setSheet] = useState<'result' | 'payment' | null>(null);
  const canPay = groupReady(g) && !g.gone && !g.removed;
  useEffect(() => {
    if (!pay || !canPay) return;
    const id = setTimeout(() => setSheet('payment'), 450);
    return () => clearTimeout(id);
  }, [pay, canPay]);
  const [offline, setOffline] = useState(false);
  const ready = groupReady(g);
  const someoneLeft = g.seats.some((s) => s.name === '-');
  const missing = g.seats.filter((s) => !s.confirmedAt);
  const pending = g.entries.some((e) => e.pending);
  useSettledReview(!pending && g.entries.some((e) => e.kind === 'payment') && !minTransfers(groupNet(g)).length);

  const sync = useCallback(() => syncGroup(g.id).then((ok) => setOffline(!ok)), [g.id]);
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
    if (!g.invite) return;
    const ref = await shareRef().catch(() => '');
    const url = groupUrl(g.id, g.invite, ref);
    track('link_shared', { channel: 'swap' });
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(url);
      notice(t('Link copiado'), url);
    } else await Share.share({ message: t('Swap de grupo de {pct} no {title}. Escolhe o teu nome para entrar: {url}', { pct: pctLabel(g.terms.pct), title: g.terms.title, url }) });
  }

  async function save(d: GroupDraft) {
    setSheet(null);
    const { sessionId, ...entry } = d;
    const res = await addGroupPrize(g.id, entry, sessionId);
    tap('success');
    if (res === 'queued') setOffline(true);
  }

  function onEntry(e: GroupEntry) {
    if (e.seat !== g.seat) return;
    confirmAction(t('Apagar registo?'), t('O grupo deixa de o ver. Usa isto só para corrigir um erro.'), t('Apagar'), async () => {
      if (!(await removeGroupEntryHere(g.id, e))) Alert.alert(t('Sem rede'), t('Tenta de novo quando tiveres sinal.'));
    });
  }

  const results = g.entries.filter((e) => e.kind === 'result').sort((a, b) => b.at - a.at);
  const payments = g.entries.filter((e) => e.kind === 'payment').sort((a, b) => b.at - a.at);
  const creator = g.seat === 0;
  // The creator can take out a player who joined but has nothing in the accounts yet (the seat
  // opens again), or drop one who never joined (the group carries on without them, from 3 up).
  const releasable = (s: GroupSeat) =>
    creator && !g.gone && !someoneLeft && s.seat !== 0 && (s.confirmedAt ? !g.entries.some((e) => e.seat === s.seat || e.to === s.seat) : g.seats.length > GROUP_MIN);

  function onSeat(s: GroupSeat) {
    if (!releasable(s)) return;
    const name = seatLabel(g, s.seat);
    const body = s.confirmedAt
      ? t('O lugar fica livre e o link de {name} deixa de funcionar. Quem tiver o link do grupo pode entrar nesse lugar.', { name })
      : t('O grupo fica com {n} jogadores e as contas começam quando estiverem todos. A percentagem de cada um não muda.', { n: g.seats.length - 1 });
    confirmAction(t('Tirar {name} do grupo?', { name }), body, t('Tirar'), async () => {
      const res = await releaseSeatHere(g.id, s.seat);
      if (res === 'in_use') Alert.alert(t('Já tem registos'), t('Só podes tirar um jogador antes de ele registar prémios ou pagamentos.'));
      else if (res === 'offline') Alert.alert(t('Sem rede'), t('Tenta de novo quando tiveres sinal.'));
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: t('Swap de grupo'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <Head g={g} />

        {g.gone && g.removed ? (
          <Banner tone="warn" icon="person-remove-outline" title={t('Já não estás neste grupo')} body={t('Quem criou o grupo libertou o teu lugar. Esta cópia fica no teu telemóvel como registo.')} />
        ) : g.gone ? (
          <Banner tone="warn" icon="trash-outline" title={t('Apagado do servidor')} body={t('Quem criou o grupo apagou o link. Esta cópia fica no teu telemóvel como registo.')} />
        ) : offline || pending ? (
          <Banner tone="info" icon="cloud-offline-outline" title={t('Sem rede')} body={t('O que registares fica guardado e é enviado quando houver sinal.')} />
        ) : null}

        {!ready && !g.gone ? (
          <Card tone="warn" style={{ gap: S.md }}>
            <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="hourglass-outline" size={22} color={C.warn} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="h3">{missing.length === 1 ? t('Falta 1 jogador entrar') : t('Faltam {n} jogadores entrar', { n: missing.length })}</T>
                <T v="small">{t('Nada conta até estarem todos. Envia o link para o grupo: cada um toca no seu nome.')}</T>
              </View>
            </Row>
            {g.invite ? <Button lines={2} size="md" title={t('Enviar o link do grupo')} icon="share-outline" onPress={share} /> : null}
          </Card>
        ) : null}

        {ready ? locked ? <AccountsLocked /> : <GroupHero g={g} /> : null}

        {someoneLeft && !g.gone ? (
          <Banner tone="info" icon="lock-closed-outline" title={t('Só para leitura')} body={t('Um jogador apagou os dados. As contas ficam como estavam.')} />
        ) : null}

        {ready && !g.gone && !someoneLeft ? (
          <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
            <Button lines={2} title={t('Cobrei')} icon="trophy-outline" style={PAIR} onPress={() => setSheet('result')} />
            <Button lines={2} title={t('Paguei')} kind="secondary" icon="cash-outline" style={PAIR} onPress={() => setSheet('payment')} />
          </Row>
        ) : null}

        {groupWaitingOn(g).length ? (
          <Card tone="inset" style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
            <Ionicons name="hourglass-outline" size={18} color={C.textDim} />
            <T v="small" style={{ flex: 1 }}>
              {t('À espera do resultado de {name}', { name: groupWaitingOn(g).map((seat) => seatLabel(g, seat)).join(', ') })}
            </T>
          </Card>
        ) : null}

        {ready && !g.gone && !someoneLeft ? (
          <Section hint={t('Mãos, notas e bankroll nunca saem do teu telemóvel. Desliga quando quiseres.')}>
            <ListGroup>
              <ToggleItem
                icon="flash-outline"
                title={t('Enviar o meu resultado sozinho')}
                subtitle={t('Ao acabar um torneio deste swap, o prémio e o evento entram sem perguntar.')}
                value={!!g.autoShare}
                onChange={(v) => saveGroup({ ...g, autoShare: v, updatedAt: Date.now() })}
              />
            </ListGroup>
          </Section>
        ) : null}

        {ready && !locked ? <GroupSettle g={g} /> : null}

        <Section title={t('Jogadores')} hint={g.seats.some(releasable) ? t('Mantém premido um jogador sem registos para o tirar do grupo.') : undefined}>
          <ListGroup>
            {g.seats.map((s) => (
              <Pressable
                key={s.seat}
                onLongPress={releasable(s) ? () => onSeat(s) : undefined}
                accessibilityRole={releasable(s) ? 'button' : undefined}
                accessibilityHint={releasable(s) ? t('Mantém premido para tirar do grupo') : undefined}>
                <Row gap={S.md} style={{ paddingVertical: S.md, paddingHorizontal: S.lg, alignItems: 'center', minHeight: 44 }}>
                  <Ionicons name={s.confirmedAt ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={s.confirmedAt ? C.good : C.muted} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="body">{seatLabel(g, s.seat)}</T>
                    <T v="small">{s.confirmedAt ? `${shortDate(s.confirmedAt)}, ${timeOf(s.confirmedAt)}` : t('Por entrar')}</T>
                  </View>
                </Row>
              </Pressable>
            ))}
          </ListGroup>
        </Section>

        {ready && !g.entries.length ? (
          <Card tone="inset">
            <T v="small">{t('Quando cobrares, toca em "Cobrei". Cada um regista os seus prémios e as contas do grupo fazem-se sozinhas.')}</T>
          </Card>
        ) : null}

        {results.length ? (
          <Section title={t('Prémios')} hint={t('Mantém premido um registo teu para o apagar.')}>
            <ListGroup>
              {results.map((e) => (
                <GroupEntryRow key={e.cid + ':' + e.seat} g={g} e={e} hideOwed={locked} onLongPress={() => onEntry(e)} />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        {payments.length ? (
          <Section title={t('Pagamentos')}>
            <ListGroup>
              {payments.map((e) => (
                <GroupEntryRow key={e.cid + ':' + e.seat} g={g} e={e} hideOwed={locked} onLongPress={() => onEntry(e)} />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        {g.terms.note ? (
          <T v="small" style={{ fontStyle: 'italic' }}>
            “{g.terms.note}”
          </T>
        ) : null}

        <View style={{ gap: S.sm, marginTop: S.md }}>
          {ready && g.invite && !g.gone && !locked ? <Button lines={2} title={t('Partilhar as contas')} kind="ghost" size="md" icon="share-outline" onPress={share} /> : null}
          {ready ? (
            <Button lines={2}
              title={g.archived ? t('Tirar do arquivo') : t('Arquivar')}
              kind="ghost"
              size="md"
              icon="archive-outline"
              onPress={() => {
                saveGroup({ ...g, archived: !g.archived, updatedAt: Date.now() });
                if (!g.archived) router.back();
              }}
            />
          ) : null}
          <Button lines={2}
            title={creator && !g.gone ? t('Apagar para todos') : t('Sair do grupo')}
            kind="danger"
            size="md"
            onPress={() =>
              confirmAction(
                creator && !g.gone ? t('Apagar o swap para todos?') : t('Sair do grupo?'),
                creator && !g.gone
                  ? t('O link deixa de funcionar e ninguém pode registar mais nada. Quando estiver acertado, prefere "Arquivar".')
                  : t('O teu nome sai do grupo e deixas de poder registar. Os teus registos ficam para as contas dos outros.'),
                creator && !g.gone ? t('Apagar') : t('Sair'),
                async () => {
                  if (await leaveGroupEverywhere(g.id)) router.back();
                  else Alert.alert(t('Sem rede'), t('Tenta de novo quando tiveres sinal.'));
                },
              )
            }
          />
          <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }} color={C.muted}>
            {t('Registo e contas apenas. Nenhum dinheiro passa pela Sweatbook: os pagamentos fazem-se entre vocês.')}
          </T>
        </View>
      </Screen>
      <GroupEntrySheet g={sheet ? g : null} kind={sheet ?? 'result'} onClose={() => setSheet(null)} onSave={save} />
    </>
  );
}
