// The swap reminder. When I finish a tournament that belongs to a swap, one sheet asks me to
// confirm how I finished (the result is already on the session) and shows who owes whom. When
// the other player records theirs, a sync brings it in and a notification tells me what it
// means, and asks for my own finish if the swap still waits for it. Mounted once, at the root.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { Sheet } from '@/components/staking/sheets';
import { Button, Card, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { notifications, setup } from '@/lib/lock-screen/reminder';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { other, owedOn, swapLedger, swapNames, swapsForSession, type Swap, type SwapEntry } from '@/store/swaps';
import { addEntry, getSwap, onSwapNews, syncAllSwaps, useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';

import { BalanceHero, pctLabel } from './parts';

const ASKED = 'rl.swapAsked.v1';
/** Only tournaments finished this recently ask: an old one edited later doesn't. */
const RECENT = 12 * 3600000;
const SYNC_EVERY = 2 * 60000;

export function SwapReminder() {
  const { sessions } = useStore();
  const { ready, swaps } = useSwaps();
  const [asked, setAsked] = useState<string[] | null>(null);
  const [step, setStep] = useState<'ask' | 'done'>('ask');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ASKED)
      .then((v) => setAsked(v ? (JSON.parse(v) as string[]) : []))
      .catch(() => setAsked([]));
  }, []);

  const live = useMemo(() => swaps.some((s) => s.confirmedAt && !s.gone && !s.archived), [swaps]);

  // Their side only reaches this phone by syncing: at launch and when the app comes back.
  const lastSync = useRef(0);
  useEffect(() => {
    if (!live) return;
    const run = () => {
      if (Date.now() - lastSync.current < SYNC_EVERY) return;
      lastSync.current = Date.now();
      syncAllSwaps().catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    return () => sub.remove();
  }, [live]);

  useEffect(() => onSwapNews((s, news) => void notify(s, news)), []);

  // The tournament to ask about: finished recently, in a swap, not asked before. Shown a
  // moment later, so the end-of-session screen lands first.
  const [shown, setShown] = useState<{ session: Session; swaps: Swap[] } | null>(null);
  useEffect(() => {
    if (shown || !ready || !asked || !live) return;
    const now = Date.now();
    for (const s of sessions) {
      if (!s.endedAt || now - s.endedAt > RECENT || asked.includes(s.id)) continue;
      const list = swapsForSession(swaps, s);
      if (!list.length) continue;
      const id = setTimeout(() => {
        setStep('ask');
        setShown({ session: s, swaps: list });
      }, 900);
      return () => clearTimeout(id);
    }
  }, [shown, ready, asked, live, sessions, swaps]);

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
    const s = shown.session;
    setBusy(true);
    tap('success');
    for (const sw of shown.swaps) {
      await addEntry(sw.id, { kind: 'result', amount: s.cashOut || 0, event: s.name || sw.terms.title, finish: s.finish ?? null }, s.id).catch(() => 'queued');
    }
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
                      {owe > 0 ? t('Deves {amount} a {name}', { amount: money(owe, s.currency), name }) : t('Não deves nada a {name}', { name })}
                    </T>
                  </Row>
                );
              })}
            </Card>
            <View style={{ gap: S.sm }}>
              <Button
                title={busy ? t('A guardar…') : prize > 0 ? t('Confirmo: cobrei {amount}', { amount: money(prize, s.currency) }) : t('Confirmo: não cobrei')}
                icon="checkmark-circle-outline"
                disabled={busy}
                onPress={confirm}
              />
              <Button kind="ghost" title={t('Agora não')} onPress={close} />
              <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }} color={C.muted}>
                {t('Fica registado no swap e o outro jogador vê as contas. Se o resultado estiver errado, corrige a sessão e regista no swap.')}
              </T>
            </View>
          </>
        ) : (
          <>
            {shown.swaps.map((sw0) => {
              const sw = getSwap(sw0.id) ?? sw0;
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
            <View style={{ gap: S.sm }}>
              <Button
                title={t('Ver swap')}
                icon="swap-horizontal-outline"
                onPress={() => {
                  const id = shown.swaps[0].id;
                  close();
                  router.push({ pathname: '/swap/[id]', params: { id } });
                }}
              />
              <Button kind="ghost" title={t('Fechar')} onPress={close} />
            </View>
          </>
        )
      ) : null}
    </Sheet>
  );
}

/** What their new entries mean for me, as one notification per swap (only if already allowed). */
async function notify(sw: Swap, news: SwapEntry[]) {
  const n = notifications();
  if (!n) return;
  try {
    if (!(await n.getPermissionsAsync()).granted) return;
    await setup(n);
    const name = swapNames(sw)[other(sw.side)];
    const cur = sw.terms.currency;
    const lines = news.map((e) =>
      e.kind === 'payment'
        ? t('{name} registou um pagamento de {amount}.', { name, amount: money(e.amount, cur) })
        : e.amount > 0
          ? t('{name} cobrou {amount}: deve-te {owed}.', { name, amount: money(e.amount, cur), owed: money(owedOn(sw.terms, e), cur) })
          : t('{name} não cobrou no {event}.', { name, event: e.event || sw.terms.title }),
    );
    const waiting = sw.terms.scope === 'event' && news.some((e) => e.kind === 'result') && !sw.entries.some((e) => e.side === sw.side && e.kind === 'result');
    if (waiting) lines.push(t('E tu, como acabaste?'));
    await n.scheduleNotificationAsync({
      content: { title: t('Swap com {name}', { name }), body: lines.join(' '), data: { url: `sweatbook://swap/${sw.id}` }, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.warn('[swaps] notify', e);
  }
}
