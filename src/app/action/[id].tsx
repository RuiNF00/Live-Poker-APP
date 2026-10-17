// Selling action for a festival: the package (events, % on sale, markup, cap per
// backer), its price and what the player keeps, one link to share, and the
// reservations backers make on it. Confirming one turns it into a normal staking
// deal; the sessions started from those events carry the backer's stake.

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { markupLabel } from '@/components/staking/sheets';
import { Button, Card, Chip, ChipRow, Empty, Field, ListGroup, ListItem, Pill, Row, Screen, Section, Segmented, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { fetchReservations, OfferFailure, publishOffer, setReservationStatus, updateRemoteOffer } from '@/lib/offer-api';
import { eventTitle, FESTIVALS, venueTime } from '@/poker/festivals';
import { money, shortDate } from '@/poker/format';
import {
  CAPS,
  reservationLabel,
  dealRecords,
  MARKUPS,
  SHARES,
  getOffers,
  offerEvents,
  offerTotals,
  payload,
  reservationPrice,
  setAllShares,
  stakesFor,
  taken,
  updateOffer,
  useOffers,
  withOfferStakes,
  type ActionOffer,
  type Reservation,
} from '@/store/action-offer';
import { festivalName, useFestivalPlan } from '@/store/festival-plan';
import { uid, useStore } from '@/store/store';
import { C, R, S } from '@/theme';

const pct = (n: number) => `${String(n).replace('.', ',')}%`;

export default function ActionOfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const offers = useOffers();
  const o = offers.find((x) => x.id === id);
  const f = FESTIVALS.find((x) => x.id === o?.festivalId);
  const plan = useFestivalPlan(o?.festivalId ?? '');
  const { settings, setSettings, backers, saveBacker, savePackage, sessions, saveSession } = useStore();
  const pro = usePro();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!o?.remote) return;
    try {
      const list = await fetchReservations(o.remote);
      updateOffer(o.id, (x) => ({ ...x, reservations: list }));
    } catch (e) {
      if (e instanceof OfferFailure && e.reason === 'gone') updateOffer(o.id, (x) => ({ ...x, remote: undefined }));
    }
    // Only when the link changes: a new list would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o?.id, o?.remote?.id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => void refresh(), 30_000);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  if (!o || !f)
    return (
      <>
        <Stack.Screen options={{ title: t('Pacote de ação') }} />
        <Screen contentStyle={{ paddingTop: S.lg }}>
          <Empty title={t('Este pacote já não existe')} action={<Button title={t('Voltar')} onPress={() => router.back()} />} />
        </Screen>
      </>
    );

  const title = festivalName(f, plan);
  const tot = offerTotals(f, o);
  const events = offerEvents(f, o);
  // Events the player can add: the ones in their festival plan (Day 2s have nothing to sell).
  const candidates = f.events.filter((e) => !e.day2 && (plan.picked.includes(e.id) || (o.shares[e.id] ?? 0) > 0));
  const wholePct = events.length ? o.shares[events[0].id] : 30;
  const took = taken(o.reservations);
  const set = (fn: (x: ActionOffer) => ActionOffer) => updateOffer(o.id, fn);

  // The offer's stakes on every session already started from its events.
  const applyToSessions = () => {
    const all = getOffers().filter((x) => x.festivalId === f.id);
    const pkgs = new Set(all.flatMap((x) => Object.values(x.deals).map((d) => d.packageId)));
    for (const [eventId, sessionId] of Object.entries(plan.sessions)) {
      const s = sessions.find((x) => x.id === sessionId);
      if (!s) continue;
      const stakes = withOfferStakes(s.stakes, stakesFor(all, f.id, eventId), pkgs);
      if (JSON.stringify(stakes) !== JSON.stringify(s.stakes ?? [])) saveSession({ ...s, stakes });
    }
  };

  const share = async () => {
    if (!settings.nickname.trim()) return setError(t('Escreve o teu nome para os backers saberem de quem é o pacote.'));
    if (!events.length) return setError(t('Escolhe pelo menos um evento.'));
    // Free: one shared package. More is Pro.
    if (!o.remote && !pro.isPro && getOffers().some((x) => x.remote && x.id !== o.id)) return pro.paywall('generic');
    setBusy(true);
    setError(null);
    tap('medium');
    try {
      const body = payload(f, o, settings.nickname, title);
      let remote = o.remote;
      if (remote) await updateRemoteOffer(remote, body);
      else {
        remote = await publishOffer(body);
        set((x) => ({ ...x, remote }));
      }
      const msg = [
        t('Vendo ação para {title}: {n} eventos, markup {markup}.', { title, n: events.length, markup: markupLabel(o.markup) }),
        t('Reserva a tua parte aqui: {url}', { url: remote.url }),
      ].join('\n');
      if (Platform.OS === 'web') await Clipboard.setStringAsync(msg);
      else await Share.share({ message: msg });
      track('link_shared', { channel: 'action_offer' });
    } catch (e) {
      const why = e instanceof OfferFailure ? e.reason : 'network';
      setError(
        why === 'offensive'
          ? t('O nome ou o título não passou no filtro. Muda-o e tenta outra vez.')
          : why === 'conflict'
            ? t('Já há reservas acima da nova percentagem num evento. Sobe a % ou recusa reservas primeiro.')
            : why === 'rate_limited'
              ? t('Demasiadas tentativas. Tenta daqui a pouco.')
              : t('Sem ligação. Tenta outra vez quando tiveres rede.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const decide = async (r: Reservation, status: 'confirmed' | 'declined') => {
    if (!o.remote) return;
    setBusy(true);
    try {
      await setReservationStatus(o.remote, r.id, status);
      tap(status === 'confirmed' ? 'success' : 'select');
      if (status === 'confirmed') {
        // The backer by name (one you already have), or a new one.
        const { backer, isNew, pkg } = dealRecords(r, backers, title, o.markup, { backer: uid('b'), pkg: uid('p') });
        if (isNew) saveBacker(backer);
        savePackage(pkg);
        set((x) => ({ ...x, reservations: x.reservations?.map((y) => (y.id === r.id ? { ...y, status } : y)), deals: { ...x.deals, [r.id]: { backerId: backer.id, packageId: pkg.id } } }));
      } else {
        set((x) => ({ ...x, reservations: x.reservations?.map((y) => (y.id === r.id ? { ...y, status } : y)) }));
      }
      applyToSessions();
    } catch {
      setError(t('Sem ligação. Tenta outra vez quando tiveres rede.'));
    } finally {
      setBusy(false);
    }
  };

  const togglePaid = (r: Reservation) => {
    tap('select');
    set((x) => ({ ...x, deals: { ...x.deals, [r.id]: { ...x.deals[r.id], paid: !x.deals[r.id]?.paid } } }));
    applyToSessions();
  };

  const confirmDecline = (r: Reservation) => {
    if (Platform.OS === 'web') return void decide(r, 'declined');
    Alert.alert(t('Recusar a reserva de {name}?', { name: r.name }), t('A percentagem fica outra vez livre no link.'), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Recusar'), style: 'destructive', onPress: () => void decide(r, 'declined') },
    ]);
  };

  const pending = (o.reservations ?? []).filter((r) => r.status === 'pending');
  const confirmed = (o.reservations ?? []).filter((r) => r.status === 'confirmed');

  return (
    <>
      <Stack.Screen options={{ title: t('Vender ação'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <Card tone="raised" style={{ gap: S.sm }}>
          <T v="label">{title}</T>
          <T v="monoXL" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 36, lineHeight: 42 }}>
            {money(tot.price, f.currency)}
          </T>
          <T v="small">
            {events.length
              ? t('Se venderes tudo, os backers pagam {price} e tu pões {out} do teu bolso.', { price: money(tot.price, f.currency), out: money(Math.max(0, tot.outOfPocket), f.currency) })
              : t('Escolhe os eventos que queres vender.')}
          </T>
          <Row style={{ marginTop: S.xs, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.border }}>
            <Figure label={t('Buy-ins')} value={money(tot.buyIns, f.currency)} />
            <Figure label={t('Ficas com')} value={pct(Math.round(tot.keep))} />
            <Figure label="Markup" value={'+' + money(tot.premium, f.currency)} color={tot.premium > 0 ? C.good : undefined} />
          </Row>
        </Card>

        <Section title={t('Como vendes')}>
          <View style={{ gap: S.md }}>
            <Segmented
              options={[
                { key: 'whole', label: t('Pacote inteiro') },
                { key: 'each', label: t('Por evento') },
              ]}
              value={o.whole ? 'whole' : 'each'}
              onChange={(k) => set((x) => (k === 'whole' ? setAllShares({ ...x, whole: true }, wholePct) : { ...x, whole: false }))}
            />
            {o.whole ? (
              <View style={{ gap: S.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="label">{t('% de cada evento à venda')}</T>
                  <Stepper value={wholePct} onChange={(v) => set((x) => setAllShares(x, v))} />
                </Row>
                <ChipRow>
                  {SHARES.map((s) => (
                    <Chip key={s} label={`${s}%`} active={wholePct === s} onPress={() => set((x) => setAllShares(x, s))} />
                  ))}
                </ChipRow>
                {tot.perPct ? <T v="tiny">{t('1% do pacote custa {price} ao backer.', { price: money(tot.perPct, f.currency) })}</T> : null}
              </View>
            ) : null}
            <View style={{ gap: 6 }}>
              <T v="label">Markup</T>
              <ChipRow>
                {MARKUPS.map((m) => (
                  <Chip key={m} label={markupLabel(m)} active={o.markup === m} onPress={() => set((x) => ({ ...x, markup: m }))} />
                ))}
              </ChipRow>
            </View>
            <View style={{ gap: 6 }}>
              <T v="label">{t('Máximo por backer, em cada evento')}</T>
              <ChipRow>
                {CAPS.map((c) => (
                  <Chip key={c} label={c === 100 ? t('Sem limite') : `${c}%`} active={o.cap === c} onPress={() => set((x) => ({ ...x, cap: c, min: Math.min(x.min, c) }))} />
                ))}
              </ChipRow>
            </View>
          </View>
        </Section>

        <Section title={t('Eventos ({n})', { n: events.length })}>
          {candidates.length === 0 ? (
            <Card tone="inset">
              <T v="small">{t('Marca no festival os eventos que vais jogar e volta aqui.')}</T>
            </Card>
          ) : (
            <View style={{ gap: S.sm }}>
              {candidates.map((e) => {
                const on = (o.shares[e.id] ?? 0) > 0;
                const used = took[e.id] ?? 0;
                return (
                  <Card key={e.id} tone={on ? 'accent' : 'default'} padded={false}>
                    <Pressable
                      onPress={() => {
                        tap('select');
                        set((x) => {
                          const shares = { ...x.shares };
                          if (on) delete shares[e.id];
                          else shares[e.id] = x.whole ? wholePct : 30;
                          return { ...x, shares };
                        });
                      }}
                      disabled={on && used > 0}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T v="h3" numberOfLines={2}>
                          {eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '')}
                        </T>
                        <T v="small">{[shortDate(venueTime(f, e.start)), money(e.buyIn, f.currency), used ? t('{pct} reservado', { pct: pct(used) }) : ''].filter(Boolean).join(' · ')}</T>
                      </View>
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.accent : C.muted} />
                    </Pressable>
                    {on && !o.whole ? (
                      <Row style={{ paddingHorizontal: S.md, paddingBottom: S.md, justifyContent: 'space-between' }}>
                        <T v="small">{t('% à venda')}</T>
                        <Stepper value={o.shares[e.id]} min={Math.max(1, Math.ceil(used))} onChange={(v) => set((x) => ({ ...x, shares: { ...x.shares, [e.id]: v } }))} />
                      </Row>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </Section>

        {settings.nickname.trim() ? null : (
          <Field label={t('O teu nome no link')} value={settings.nickname} onChangeText={(nickname) => setSettings({ nickname })} placeholder="Rui" maxLength={40} />
        )}
        {error ? (
          <T v="small" color={C.warn}>
            {error}
          </T>
        ) : null}
        <Button icon="share-outline" title={o.remote ? t('Partilhar o link outra vez') : t('Partilhar o link')} onPress={share} disabled={busy || !events.length} />
        <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
          {t('Os backers reservam a parte deles no link. Só tu vês os nomes, e cada reserva só conta quando a confirmares.')}
        </T>

        {o.remote ? (
          <>
            <Section title={t('Por confirmar ({n})', { n: pending.length })}>
              {pending.length === 0 ? (
                <Card tone="inset">
                  <T v="small">{t('Ainda ninguém reservou. Atualiza sozinho enquanto tens este ecrã aberto.')}</T>
                </Card>
              ) : (
                <View style={{ gap: S.sm }}>
                  {pending.map((r) => (
                    <Card key={r.id} style={{ gap: S.sm }}>
                      <ReservationLine r={r} price={money(reservationPrice(f, o, r), f.currency)} />
                      <Row gap={S.sm}>
                        <Button size="sm" kind="secondary" style={{ flex: 1 }} title={t('Recusar')} onPress={() => confirmDecline(r)} disabled={busy} />
                        <Button size="sm" style={{ flex: 1 }} icon="checkmark" title={t('Confirmar')} onPress={() => void decide(r, 'confirmed')} disabled={busy} />
                      </Row>
                    </Card>
                  ))}
                </View>
              )}
            </Section>
            {confirmed.length ? (
              <Section title={t('Confirmados ({n})', { n: confirmed.length })}>
                <ListGroup>
                  {confirmed.map((r) => {
                    const paid = !!o.deals[r.id]?.paid;
                    return (
                      <ListItem
                        key={r.id}
                        title={r.name}
                        subtitle={<ReservationSub r={r} price={money(reservationPrice(f, o, r), f.currency)} />}
                        right={<Pill label={paid ? t('Pago') : t('Por pagar')} color={paid ? C.good : C.warn} icon={paid ? 'checkmark' : undefined} />}
                        onPress={() => togglePaid(r)}
                      />
                    );
                  })}
                </ListGroup>
                <T v="tiny" style={{ paddingHorizontal: 4 }}>
                  {t('Toca para marcar como pago. As sessões destes eventos levam a parte de cada backer, e as contas ficam no Staking.')}
                </T>
              </Section>
            ) : null}
            <Button
              kind="ghost"
              size="sm"
              title={o.closed ? t('Reabrir as reservas') : t('Fechar as reservas')}
              onPress={() => {
                const next = { ...o, closed: !o.closed };
                set(() => next);
                if (o.remote) void updateRemoteOffer(o.remote, payload(f, next, settings.nickname, title)).catch(() => {});
              }}
            />
          </>
        ) : null}
      </Screen>
    </>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="label" numberOfLines={1}>
        {label}
      </T>
      <T v="mono" color={color} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 16 }}>
        {value}
      </T>
    </View>
  );
}

function ReservationLine({ r, price }: { r: Reservation; price: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3" numberOfLines={1} style={{ flex: 1 }}>
          {r.name}
        </T>
        <T v="mono">{price}</T>
      </Row>
      <ReservationSub r={r} />
    </View>
  );
}

function ReservationSub({ r, price }: { r: Reservation; price?: string }) {
  const l = reservationLabel(r);
  const what = l.pct != null ? t('{pct} de {n} eventos', { pct: pct(l.pct), n: l.events }) : l.events === 1 ? t('1 evento') : t('{n} eventos', { n: l.events });
  return <T v="small">{[what, price, r.contact].filter(Boolean).join(' · ')}</T>;
}

/** − 30% + in steps of 5 (1 below 10). */
function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  const step = (dir: 1 | -1) => {
    const by = (dir > 0 ? value < 10 : value <= 10) ? 1 : 5;
    const next = Math.max(min, Math.min(100, dir > 0 ? Math.floor(value / by) * by + by : Math.ceil(value / by) * by - by));
    if (next !== value) {
      tap('select');
      onChange(next);
    }
  };
  const btn = (dir: 1 | -1) => (
    <Pressable
      onPress={() => step(dir)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={dir > 0 ? t('Mais') : t('Menos')}
      style={{ width: 36, height: 36, borderRadius: R.md, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={dir > 0 ? 'add' : 'remove'} size={18} color={C.text} />
    </Pressable>
  );
  return (
    <Row gap={6}>
      {btn(-1)}
      <T v="mono" style={{ minWidth: 48, textAlign: 'center' }}>
        {pct(value)}
      </T>
      {btn(1)}
    </Row>
  );
}
