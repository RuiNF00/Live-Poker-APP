// The swap reminder. When I finish a tournament that belongs to a swap, one sheet asks me to
// confirm how I finished (the result is already on the session) and shows who owes whom. When
// the other player records theirs, a sync brings it in and a notification tells me what it
// means, and asks for my own finish if the swap still waits for it. Mounted once, at the root.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { useLocked } from '@/components/ProGate';
import { Sheet } from '@/components/staking/sheets';
import { Button, Card, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { notifications, setup } from '@/lib/lock-screen/reminder';
import { notifyAmountsOn, notifyOrHold } from '@/lib/notify-gate';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { other, owedOn, swapLedger, swapNames, swapsForSession, type Swap, type SwapEntry } from '@/store/swaps';
import { addEntry, getSwap, onSwapNews, syncAllSwaps, useSwaps } from '@/store/swaps-store';
import { groupOwedOn, groupShareOf, groupsForSession, type GroupEntry, type SwapGroup } from '@/store/swap-groups';
import { addGroupPrize, getGroup, onGroupNews, syncAllGroups, useGroups } from '@/store/swap-groups-store';
import { C, S } from '@/theme';

import { GroupHero, GroupSettle, seatLabel } from './group-parts';
import { AccountsLocked, BalanceHero, pctLabel } from './parts';

const ASKED = 'rl.swapAsked.v1';
/** Only tournaments finished this recently ask: an old one edited later doesn't. */
const RECENT = 12 * 3600000;
const SYNC_EVERY = 2 * 60000;

export function SwapReminder() {
  const { sessions } = useStore();
  const noPro = useLocked('swaps');
  // The accounts are open when I have Pro or the swap's creator does.
  const locked = (x: { accounts?: boolean }) => noPro && !x.accounts;
  const noProRef = useRef(noPro);
  useEffect(() => {
    noProRef.current = noPro;
  }, [noPro]);
  const { ready, swaps } = useSwaps();
  const { ready: gReady, groups } = useGroups();
  const [asked, setAsked] = useState<string[] | null>(null);
  const [step, setStep] = useState<'ask' | 'done'>('ask');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ASKED)
      .then((v) => setAsked(v ? (JSON.parse(v) as string[]) : []))
      .catch(() => setAsked([]));
  }, []);

  const live = useMemo(() => swaps.some((s) => s.confirmedAt && !s.gone && !s.archived) || groups.some((g) => !g.gone && !g.archived), [swaps, groups]);

  // Their side only reaches this phone by syncing: at launch and when the app comes back.
  const lastSync = useRef(0);
  useEffect(() => {
    if (!live) return;
    const run = () => {
      if (Date.now() - lastSync.current < SYNC_EVERY) return;
      lastSync.current = Date.now();
      syncAllSwaps().catch(() => {});
      syncAllGroups().catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    return () => sub.remove();
  }, [live]);

  // Amounts only when allowed on the lock screen and the accounts are open to me.
  const amounts = (x: { accounts?: boolean }) => notifyAmountsOn() && !(noProRef.current && !x.accounts);
  useEffect(() => onSwapNews((s, news) => void notify(s, news, amounts(s))), []);
  useEffect(() => onGroupNews((g, news) => void notifyGroup(g, news, amounts(g))), []);

  // The tournament to ask about: finished recently, in a swap, not asked before. Shown a
  // moment later, so the end-of-session screen lands first.
  const [shown, setShown] = useState<{ session: Session; swaps: Swap[]; groups: SwapGroup[]; auto?: boolean } | null>(null);
  useEffect(() => {
    if (shown || !ready || !gReady || !asked || !live) return;
    const now = Date.now();
    for (const s of sessions) {
      if (!s.endedAt || now - s.endedAt > RECENT || asked.includes(s.id)) continue;
      const list = swapsForSession(swaps, s);
      const gl = groupsForSession(groups, s);
      if (!list.length && !gl.length) continue;
      // Turned on per swap: the result goes in without asking, and the sheet opens on the balance.
      const auto = list.every((x) => x.autoShare) && gl.every((x) => x.autoShare);
      const id = setTimeout(() => {
        setStep('ask');
        setShown({ session: s, swaps: list, groups: gl, auto });
        if (auto) {
          // Marked as asked first, so a restart before the sheet closes never sends it twice.
          const next = [s.id, ...asked].slice(0, 50);
          setAsked(next);
          AsyncStorage.setItem(ASKED, JSON.stringify(next)).catch(() => {});
          setBusy(true);
          void record(s, list, gl).then(() => {
            setBusy(false);
            setStep('done');
          });
        }
      }, 900);
      return () => clearTimeout(id);
    }
  }, [shown, ready, gReady, asked, live, sessions, swaps, groups]);

  function close() {
    if (shown) {
      const next = [shown.session.id, ...(asked ?? [])].slice(0, 50);
      setAsked(next);
      AsyncStorage.setItem(ASKED, JSON.stringify(next)).catch(() => {});
    }
    setShown(null);
    setBusy(false);
  }

  async function confirm() {
    if (!shown) return;
    setBusy(true);
    tap('success');
    await record(shown.session, shown.swaps, shown.groups);
    setBusy(false);
    setStep('done');
  }

  const s = shown?.session;
  const prize = s?.cashOut || 0;
  return (
    <Sheet visible={!!shown} title={step === 'ask' ? t('Swap: como acabaste?') : t('Contas do swap')} onClose={close}>
      {s && shown ? (
        step === 'ask' ? (
          <>
            <View style={{ gap: S.xs }}>
              <T v="title">{s.name || t('Torneio')}</T>
              <T v="body" color={C.textDim}>
                {prize > 0
                  ? t('Cobraste {amount}{place}.', { amount: money(prize, s.currency), place: s.finish ? ' · ' + t('{n}º lugar', { n: s.finish }) : '' })
                  : t('Não cobraste.')}
              </T>
            </View>
            <Card style={{ gap: S.md }}>
              {shown.swaps.map((sw) => {
                const name = swapNames(sw)[other(sw.side)];
                const owe = owedOn(sw.terms, { side: sw.side, amount: prize });
                return (
                  <Row key={sw.id} gap={S.sm} style={{ alignItems: 'baseline' }}>
                    <T v="monoL" color={C.accent} style={{ minWidth: 48 }}>
                      {pctLabel(sw.terms[sw.side].pct)}
                    </T>
                    <T v="body" style={{ flex: 1 }}>
                      {locked(sw) ? t('Swap com {name}', { name }) : owe > 0 ? t('Deves {amount} a {name}', { amount: money(owe, s.currency), name }) : t('Não deves nada a {name}', { name })}
                    </T>
                  </Row>
                );
              })}
              {shown.groups.map((g) => {
                const owe = groupOwedOn(g, prize);
                return (
                  <Row key={g.id} gap={S.sm} style={{ alignItems: 'baseline' }}>
                    <T v="monoL" color={C.accent} style={{ minWidth: 48 }}>
                      {pctLabel(g.terms.pct)}
                    </T>
                    <T v="body" style={{ flex: 1 }}>
                      {locked(g)
                        ? t('Swap de grupo · {title}', { title: g.terms.title })
                        : owe > 0
                        ? t('Grupo de {n}: pagas {each} a cada um ({amount})', { n: g.seats.length, each: money(groupShareOf(g, prize), s.currency), amount: money(owe, s.currency) })
                        : t('Grupo de {n}: não deves nada', { n: g.seats.length })}
                    </T>
                  </Row>
                );
              })}
            </Card>
            <View style={{ gap: S.sm }}>
              <Button lines={2}
                title={busy ? t('A guardar…') : prize > 0 ? t('Confirmo: cobrei {amount}', { amount: money(prize, s.currency) }) : t('Confirmo: não cobrei')}
                icon="checkmark-circle-outline"
                disabled={busy}
                onPress={confirm}
              />
              <Button lines={2} kind="ghost" title={t('Agora não')} onPress={close} />
              <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }} color={C.muted}>
                {t('Fica registado no swap e o outro jogador vê as contas. Se o resultado estiver errado, corrige a sessão e regista no swap.')}
              </T>
            </View>
          </>
        ) : (
          <>
            {shown.auto ? (
              <T v="small" color={C.textDim}>
                {prize > 0 ? t('Enviado automaticamente: cobraste {amount}.', { amount: money(prize, s.currency) }) : t('Enviado automaticamente: não cobraste.')}{' '}
                {t('Para desligar, abre o swap.')}
              </T>
            ) : null}
            {[...shown.swaps, ...shown.groups].some((x) => locked(x)) ? <AccountsLocked /> : null}
            {shown.swaps.map((sw0) => {
              const sw = getSwap(sw0.id) ?? sw0;
              if (locked(sw)) return null;
              const name = swapNames(sw)[other(sw.side)];
              return (
                <View key={sw.id} style={{ gap: S.sm }}>
                  <T v="label">{t('Swap com {name}', { name })}</T>
                  <BalanceHero l={swapLedger(sw)} name={name} currency={sw.terms.currency} />
                  {!sw.entries.some((e) => e.side !== sw.side && e.kind === 'result') ? (
                    <T v="small" color={C.textDim}>
                      {t('Quando {name} registar o resultado, recebes um aviso com as contas.', { name })}
                    </T>
                  ) : null}
                </View>
              );
            })}
            {shown.groups.map((g0) => {
              const g = getGroup(g0.id) ?? g0;
              if (locked(g)) return null;
              return (
                <View key={g.id} style={{ gap: S.sm }}>
                  <T v="label">{t('Swap de grupo · {title}', { title: g.terms.title })}</T>
                  <GroupHero g={g} />
                  <GroupSettle g={g} />
                </View>
              );
            })}
            <View style={{ gap: S.sm }}>
              <Button lines={2}
                title={t('Ver swap')}
                icon="swap-horizontal-outline"
                onPress={() => {
                  const sw = shown.swaps[0];
                  const g = shown.groups[0];
                  close();
                  if (sw) router.push({ pathname: '/swap/[id]', params: { id: sw.id } });
                  else if (g) router.push({ pathname: '/swap/g/[id]', params: { id: g.id } });
                }}
              />
              <Button lines={2} kind="ghost" title={t('Fechar')} onPress={close} />
            </View>
          </>
        )
      ) : null}
    </Sheet>
  );
}

const HOUR = 3600000;
const lastPosted = new Map<string, number>();

/**
 * Posts on the "money" channel: off in Settings drops it, a live session holds it for the end,
 * and each swap gets at most one an hour (design/notificacoes.md).
 */
function postMoney(n: NonNullable<ReturnType<typeof notifications>>, id: string, title: string, body: string, url: string) {
  const last = lastPosted.get(id);
  if (last && Date.now() - last < HOUR) return;
  notifyOrHold('money', () => {
    lastPosted.set(id, Date.now());
    n.scheduleNotificationAsync({ identifier: `swap-${id}`, content: { title, body, data: { url }, sound: true }, trigger: { channelId: 'money' } }).catch((e) => console.warn('[swaps] notify', e));
  });
}

/** What their new entries mean for me, as one notification per swap (only if already allowed). */
async function notify(sw: Swap, news: SwapEntry[], amounts: boolean) {
  const n = notifications();
  if (!n) return;
  try {
    if (!(await n.getPermissionsAsync()).granted) return;
    await setup(n);
    const name = swapNames(sw)[other(sw.side)];
    const cur = sw.terms.currency;
    const lines = !amounts ? [t('Há novidades no swap. Toca para veres as contas.')] : news.map((e) =>
      e.kind === 'payment'
        ? t('{name} registou um pagamento de {amount}.', { name, amount: money(e.amount, cur) })
        : e.amount > 0
          ? t('{name} cobrou {amount}: deve-te {owed}.', { name, amount: money(e.amount, cur), owed: money(owedOn(sw.terms, e), cur) })
          : t('{name} não cobrou no {event}.', { name, event: e.event || sw.terms.title }),
    );
    const waiting = sw.terms.scope === 'event' && news.some((e) => e.kind === 'result') && !sw.entries.some((e) => e.side === sw.side && e.kind === 'result');
    if (waiting) lines.push(t('E tu, como acabaste?'));
    postMoney(n, sw.id, t('Swap com {name}', { name }), lines.join(' '), `sweatbook://swap/${sw.id}`);
  } catch (e) {
    console.warn('[swaps] notify', e);
  }
}

/** What other players' new group entries mean for me (only if notifications are already allowed). */
async function notifyGroup(g: SwapGroup, news: GroupEntry[], amounts: boolean) {
  const n = notifications();
  if (!n) return;
  try {
    if (!(await n.getPermissionsAsync()).granted) return;
    await setup(n);
    const cur = g.terms.currency;
    const lines = !amounts ? [t('Há novidades no swap. Toca para veres as contas.')] : news.map((e) => {
      const name = seatLabel(g, e.seat);
      if (e.kind === 'payment') return t('{name} pagou {amount} a {to}.', { name, amount: money(e.amount, cur), to: e.to === undefined ? '?' : seatLabel(g, e.to) });
      return e.amount > 0 ? t('{name} cobrou {amount}: a tua parte é {owed}.', { name, amount: money(e.amount, cur), owed: money(groupShareOf(g, e.amount), cur) }) : t('{name} não cobrou no {event}.', { name, event: e.event || g.terms.title });
    });
    if (g.terms.scope === 'event' && news.some((e) => e.kind === 'result') && !g.entries.some((e) => e.seat === g.seat && e.kind === 'result')) lines.push(t('E tu, como acabaste?'));
    postMoney(n, `g-${g.id}`, t('Swap de grupo · {title}', { title: g.terms.title }), lines.join(' '), `sweatbook://swap/g/${g.id}`);
  } catch (e) {
    console.warn('[swaps] notify group', e);
  }
}

/** My result in each swap and group of this tournament: the prize, the event and the place, nothing else. */
export async function record(s: Session, swaps: Swap[], groups: SwapGroup[]) {
  for (const sw of swaps) {
    await addEntry(sw.id, { kind: 'result', amount: s.cashOut || 0, event: s.name || sw.terms.title, finish: s.finish ?? null }, s.id).catch(() => 'queued');
  }
  for (const g of groups) {
    await addGroupPrize(g.id, { kind: 'result', amount: s.cashOut || 0, event: s.name || g.terms.title, finish: s.finish ?? null }, s.id).catch(() => 'queued');
  }
}
