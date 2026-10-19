// Action sold for a festival, as a record: the events and markup of the package,
// each backer's agreed piece (a normal staking deal), what it adds up to, and a
// private link per backer to confirm their piece. Nothing is sold or paid here:
// payments happen outside the app and the player only logs them.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { Sheet } from '@/components/BankrollSheets';
import { useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { ProRow } from '@/components/ProGate';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { markupLabel } from '@/components/staking/sheets';
import { balanceLabel } from '@/components/staking/use-staking';
import { Button, Card, Chip, ChipRow, Empty, Field, IconButton, Pill, Row, Screen, Section, T, tap } from '@/components/ui';
import { t, variant } from '@/i18n';
import { withLang } from '@/lib/link-lang';
import { track } from '@/lib/events';
import { agreementUpdateWaiting, fetchConfirmation, OfferFailure, publishAgreement, queueAgreementDelete, queueAgreementUpdate, updateAgreement } from '@/lib/offer-api';
import { eventTitle, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';
import { money, num, shortDate } from '@/poker/format';
import {
  MARKUPS,
  PIECES,
  agreement,
  getOffers,
  lineCost,
  lineRecords,
  lineSettlement,
  offerEvents,
  offerPackageIds,
  offerTotals,
  stakesFor,
  unanswered,
  setLinePaid,
  updateLine,
  updateOffer,
  useOffers,
  usualTerms,
  withOfferStakes,
  type ActionOffer,
  type LineSettlement,
  type PackageLine,
  type SettlementState,
} from '@/store/action-offer';
import { festivalName, planFestival, updatePlan, useFestivalPlan } from '@/store/festival-plan';
import { useFestivals, useFestivalsReady } from '@/store/my-festivals';
import { uid, useStore } from '@/store/store';
import { tripToCover } from '@/store/trip-math';
import type { Session } from '@/store/types';
import { C, R, S } from '@/theme';

const pct = (n: number) => `${num(n)}%`;

export default function ActionPackageScreen() {
  const { id, add } = useLocalSearchParams<{ id: string; add?: string }>();
  const offers = useOffers();
  const o = offers.find((x) => x.id === id);
  const plan = useFestivalPlan(o?.festivalId ?? '');
  // An own festival too, with the tournaments the player added (as the festival screen).
  const f = planFestival(useFestivals(), o?.festivalId, () => plan);
  const ready = useFestivalsReady();
  const { settings, setSettings, backers, saveBacker, packages, savePackage, deletePackage, sessions, saveSession, trips, saveTrip } = useStore();
  const pro = usePro();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A new package opens on its first backer.
  const [adding, setAdding] = useState(add === '1');
  const [logging, setLogging] = useState<FestivalEvent | null>(null);
  const [softAsk, askNotify] = useNotifySoftAsk();

  // Confirmations come from the links: check the ones still waiting whenever the screen shows.
  const waiting = (o?.lines ?? []).filter((l) => l.remote && !l.confirmedAt).map((l) => `${l.id}:${l.remote!.id}`).join(',');

  const refresh = useCallback(async () => {
    if (!o || !waiting) return;
    for (const pair of waiting.split(',')) {
      const [lineId, remoteId] = pair.split(':');
      try {
        // New terms not on the server yet: what it says confirmed is the old terms.
        if (await agreementUpdateWaiting(remoteId)) continue;
        // A confirmation counts only for the terms this phone has now (QA P1: a refused change).
        const l = o.lines.find((x) => x.id === lineId);
        if (!l || !f) continue;
        const terms = agreement(f, o, l, settings.nickname, backers.find((b) => b.id === l.backerId)?.name ?? t('Backer'), festivalName(f, plan));
        const at = await fetchConfirmation({ id: remoteId }, terms);
        if (at) updateLine(o.id, lineId, (l) => ({ ...l, confirmedAt: at }));
      } catch (e) {
        if (e instanceof OfferFailure && e.reason === 'gone') updateLine(o.id, lineId, (l) => ({ ...l, remote: undefined, confirmedAt: null }));
      }
    }
    // Again when the terms change too: each check compares against the terms of this render.
  }, [o, f, plan, settings.nickname, backers, waiting]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => void refresh(), 30_000);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  // An own festival not read from the phone yet: wait, it isn't gone.
  if (o && !f && !ready) return <Stack.Screen options={{ title: t('Ação vendida') }} />;
  if (!o || !f)
    return (
      <>
        <Stack.Screen options={{ title: t('Ação vendida') }} />
        <Screen contentStyle={{ paddingTop: S.lg }}>
          <Empty title={t('Este pacote já não existe')} action={<Button title={t('Voltar')} onPress={() => router.back()} />} />
        </Screen>
      </>
    );

  const title = festivalName(f, plan);
  const tot = offerTotals(f, o);
  const events = offerEvents(f, o);
  // Events the player can add: the ones in their festival plan (Day 2s have no buy-in).
  const candidates = f.events.filter((e) => !e.day2 && (plan.picked.includes(e.id) || o.events.includes(e.id)));
  const nameOf = (l: PackageLine) => backers.find((b) => b.id === l.backerId)?.name ?? t('Backer');
  // Backers used most recently first, minus those already in this offer: the first one starts picked.
  const offerNames = (() => {
    const last = new Map<string, number>();
    for (const x of sessions) for (const st of x.stakes ?? []) if (st.backerId) last.set(st.backerId, Math.max(last.get(st.backerId) ?? 0, x.startedAt));
    const inOffer = new Set(o.lines.map((l) => nameOf(l).trim().toLowerCase()));
    return [...backers].sort((a, b) => (last.get(b.id) ?? b.createdAt) - (last.get(a.id) ?? a.createdAt)).map((b) => b.name).filter((n) => !inOffer.has(n.trim().toLowerCase()));
  })();
  // Once the first event is played (or goes by), where each backer stands on the festival.
  const settled = o.lines.map((l) => ({ l, st: lineSettlement(f, o, l, plan.sessions, sessions) }));
  const underway = settled.some(({ st }) => st.rows.some((r) => r.state !== 'upcoming'));
  // Gone by with no session: asked, never assumed (a forgotten session would leave the accounts wrong).
  const ask = o.lines.length ? unanswered(f, o, plan.sessions) : [];
  const notPlayed = (e: FestivalEvent) => {
    tap('select');
    updateOffer(o.id, (x) => ({ ...x, skipped: [...(x.skipped ?? []).filter((y) => y !== e.id), e.id] }));
  };
  // "Joguei": log it as a past session of that event, with the package's stakes, and link it to the plan.
  const logPlayed = (s: Session) => {
    if (!logging) return;
    saveSession(s);
    const trip = tripToCover(trips, f.id, s.startedAt);
    if (trip) saveTrip(trip);
    updatePlan(f.id, (p) => ({ ...p, picked: p.picked.includes(logging.id) ? p.picked : [...p.picked, logging.id], sessions: { ...p.sessions, [logging.id]: s.id } }));
    setLogging(null);
  };

  const sendSettlement = async (l: PackageLine, st: LineSettlement) => {
    tap('medium');
    const cur = f.currency;
    const msg = [
      t('{title}: a tua parte de {pct}', { title, pct: pct(l.pct) }),
      ...st.rows.map((r) => `${shortDate(venueTime(f, r.event.start))} · ${eventTitle(r.event)}${r.event.flight ? ` · Flight ${r.event.flight}` : ''} · ${rowLabel(r.state, r.prize, cur)}`),
      '',
      t('Prémios da tua parte: {amount}', { amount: money(st.prizes, cur) }),
      st.cost ? (st.paid ? t('Custo da parte: {amount} (pago)', { amount: money(st.cost, cur) }) : t('Custo da parte: {amount} (por pagar)', { amount: money(st.cost, cur) })) : '',
      st.refund ? t('Torneios que não joguei: devolvo-te {amount}', { amount: money(st.refund, cur) }) : '',
      Math.abs(st.net) < 0.01
        ? t('Estamos acertados.')
        : st.net > 0
          ? t('Devo-te {amount}.', { amount: money(st.net, cur) })
          : t('Deves-me {amount}.', { amount: money(-st.net, cur) }),
      st.done ? '' : t('Ainda há torneios por jogar: isto pode mudar.'),
    ].filter((x) => x !== '');
    const text = msg.join('\n');
    if (Platform.OS === 'web') await Clipboard.setStringAsync(text);
    else await Share.share({ message: text });
    track('link_shared', { channel: 'festival_settlement' });
  };

  // The package's stakes on every session already started from its events.
  const applyToSessions = (before: Set<string>) => {
    const mine = getOffers().filter((x) => x.festivalId === f.id);
    const pkgs = new Set([...before, ...offerPackageIds(mine)]);
    for (const [eventId, sessionId] of Object.entries(plan.sessions)) {
      const s = sessions.find((x) => x.id === sessionId);
      if (!s) continue;
      const stakes = withOfferStakes(s.stakes, stakesFor(mine, f.id, eventId), pkgs);
      if (JSON.stringify(stakes) !== JSON.stringify(s.stakes ?? [])) saveSession({ ...s, stakes });
    }
  };

  /** New terms (events or markup): staking packages follow, and every sent link asks to confirm again. */
  const changeTerms = (fn: (x: ActionOffer) => ActionOffer) => {
    const before = offerPackageIds(getOffers());
    const next = fn(o);
    updateOffer(o.id, () => ({ ...next, lines: next.lines.map((l) => (l.remote ? { ...l, confirmedAt: null } : l)) }));
    for (const l of next.lines) {
      const p = packages.find((x) => x.id === l.packageId);
      if (p && p.markup !== next.markup) savePackage({ ...p, markup: next.markup });
      // Offline too: it goes when the signal is back, and until then no old confirmation is read.
      if (l.remote) queueAgreementUpdate(l.remote, agreement(f, next, l, settings.nickname, nameOf(l), title));
    }
    applyToSessions(before);
  };

  const addLine = (name: string, piece: number, markup: number) => {
    tap('success');
    const before = offerPackageIds(getOffers());
    // The first backer sets the package's markup (their usual one); later ones join at the package's.
    const r = lineRecords(name, backers, title, { ...o, markup }, piece, { line: uid('l'), backer: uid('b'), pkg: uid('p') });
    if (r.isNew) saveBacker(r.backer);
    savePackage(r.pkg);
    updateOffer(o.id, (x) => ({ ...x, markup, lines: [...x.lines, r.line] }));
    applyToSessions(before);
    setAdding(false);
    // The first backer: offer the reminder that closes the accounts after each event (only asks once allowed or refused).
    if (!o.lines.length)
      void askNotify({
        where: 'staking',
        title: t('Avisamos-te no dia a seguir a cada torneio para fechares as contas'),
        preview: { title: t('Acerto com {name}', { name: r.backer.name }), body: t('O torneio acabou. Regista o resultado para fechar as contas.') },
      });
  };

  const removeLine = (l: PackageLine) => {
    const go = () => {
      const before = offerPackageIds(getOffers());
      if (l.remote) queueAgreementDelete(l.remote);
      updateOffer(o.id, (x) => ({ ...x, lines: x.lines.filter((y) => y.id !== l.id) }));
      applyToSessions(before);
      deletePackage(l.packageId);
    };
    if (Platform.OS === 'web') return go();
    Alert.alert(t('Tirar {name} do pacote?', { name: nameOf(l) }), t('A parte deste backer sai das sessões deste pacote e o link deixa de funcionar.'), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Tirar'), style: 'destructive', onPress: go },
    ]);
  };

  const togglePaid = (l: PackageLine) => {
    tap('select');
    const before = offerPackageIds(getOffers());
    setLinePaid(o.id, l.id, !l.paid);
    applyToSessions(before);
  };

  // `unlocked`: called again right after paying, so the link goes out without a second tap.
  const send = async (l: PackageLine, unlocked = false) => {
    if (!settings.nickname.trim()) return setError(t('Escreve o teu nome para o backer saber de quem é o link.'));
    // Free: links for one package. More is Pro.
    if (!unlocked && !l.remote && !pro.isPro && getOffers().some((x) => x.id !== o.id && x.lines.some((y) => y.remote))) return pro.paywall('staking', () => void send(l, true));
    setBusy(l.id);
    setError(null);
    tap('medium');
    try {
      const body = agreement(f, o, l, settings.nickname, nameOf(l), title);
      let remote = l.remote;
      if (remote) await updateAgreement(remote, body);
      else {
        remote = await publishAgreement(body);
        updateLine(o.id, l.id, (x) => ({ ...x, remote, confirmedAt: null }));
      }
      const msg = t('A tua parte em {title}: {pct} de {n} torneios, markup {markup}. Confirma aqui o que combinámos: {url}', {
        title,
        pct: pct(l.pct),
        n: events.length,
        markup: markupLabel(o.markup),
        url: withLang(remote.url, variant),
      });
      if (Platform.OS === 'web') await Clipboard.setStringAsync(msg);
      else await Share.share({ message: msg });
      track('link_shared', { channel: 'action_package' });
    } catch (e) {
      const why = e instanceof OfferFailure ? e.reason : 'network';
      setError(
        why === 'offensive'
          ? t('Um dos nomes não passou no filtro. Muda-o e tenta outra vez.')
          : why === 'invalid'
            ? t('O link não aceitou estes termos. Atualiza a app e tenta outra vez.')
            : why === 'rate_limited'
            ? t('Demasiadas tentativas. Tenta daqui a pouco.')
            : t('Sem ligação. Tenta outra vez quando tiveres rede.'),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Ação vendida'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <Card tone="raised" style={{ gap: S.sm }}>
          <T v="label">{title}</T>
          <T v="monoXL" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 36, lineHeight: 42 }}>
            {pct(tot.sold)}
          </T>
          <T v="small">
            {o.lines.length === 0
              ? t('Regista cada backer com quem combinaste uma parte. As sessões destes torneios ficam com a parte de cada um.')
              : o.lines.length === 1
                ? t('Vendida a 1 backer por {price}. Pões {out} do teu bolso.', { price: money(tot.price, f.currency), out: money(Math.max(0, tot.outOfPocket), f.currency) })
                : t('Vendida a {n} backers por {price}. Pões {out} do teu bolso.', { n: o.lines.length, price: money(tot.price, f.currency), out: money(Math.max(0, tot.outOfPocket), f.currency) })}
          </T>
          <Row style={{ marginTop: S.xs, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.border }}>
            <Figure label={t('Buy-ins')} value={money(tot.buyIns, f.currency)} />
            <Figure label={t('Ficas com')} value={pct(Math.round(tot.keep * 10) / 10)} />
            <Figure label="Markup" value={'+' + money(tot.premium, f.currency)} color={tot.premium > 0 ? C.good : undefined} />
          </Row>
        </Card>

        {underway || ask.length ? (
          <Section title={t('Contas do festival')}>
            <View style={{ gap: S.sm }}>
              {ask.map((e) => (
                <Card key={e.id} tone="raised" style={{ gap: S.sm }}>
                  <T v="h3">{t('Não jogaste o {event}?', { event: eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '') })}</T>
                  <T v="small">{t('Não há sessão registada. As contas deste torneio ficam à espera até responderes.')}</T>
                  <Button size="md" icon="create-outline" title={t('Joguei, registar resultado')} onPress={() => setLogging(e)} />
                  <Button size="md" kind="secondary" title={t('Não joguei')} onPress={() => notPlayed(e)} />
                </Card>
              ))}
              {/* Settling up is Pro (PRO_ONLY.staking): the "Não jogaste?" answers stay free. */}
              {!settled.length ? null : pro.isPro ? (
                settled.map(({ l, st }) => (
                  <SettleCard key={l.id} name={nameOf(l)} st={st} cur={f.currency} onOpen={() => router.push(`/staking/${l.backerId}`)} onSend={() => void sendSettlement(l, st)} />
                ))
              ) : (
                <ProRow feature="staking" title={t('Ver contas')} body={t('Quanto acertas com cada backer, já calculado. Com o Pro.')} />
              )}
            </View>
          </Section>
        ) : null}

        <Section title={t('Backers ({n})', { n: o.lines.length })}>
          <View style={{ gap: S.sm }}>
            {o.lines.map((l) => (
              <Card key={l.id} style={{ gap: S.sm }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="h3" numberOfLines={1}>
                      {nameOf(l)}
                    </T>
                    <T v="small">{t('{pct} de cada torneio · {cost}', { pct: pct(l.pct), cost: money(lineCost(f, o, l.pct), f.currency) })}</T>
                  </View>
                  <IconButton name="trash-outline" size={34} label={t('Tirar do pacote')} onPress={() => removeLine(l)} />
                </Row>
                <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
                  {l.confirmedAt ? (
                    <Pill label={t('Confirmou a {date}', { date: shortDate(Date.parse(l.confirmedAt)) })} color={C.good} icon="checkmark" />
                  ) : l.remote ? (
                    <Pill label={t('Por confirmar')} color={C.warn} />
                  ) : null}
                  <Pressable onPress={() => togglePaid(l)} accessibilityRole="switch" accessibilityState={{ checked: !!l.paid }} hitSlop={6}>
                    <Pill label={l.paid ? t('Pago') : t('Por pagar')} color={l.paid ? C.good : C.muted} icon={l.paid ? 'checkmark' : 'ellipse-outline'} />
                  </Pressable>
                </Row>
                <Button
                  size="sm"
                  kind={l.remote ? 'ghost' : 'secondary'}
                  icon="share-outline"
                  title={l.remote ? t('Enviar o link outra vez') : t('Enviar link para confirmar')}
                  onPress={() => void send(l)}
                  disabled={busy === l.id}
                />
              </Card>
            ))}
            {adding && events.length ? (
              <AddLine
                cur={f.currency}
                names={offerNames}
                markup={o.markup}
                firstLine={!o.lines.length}
                usual={(n) => {
                  const b = backers.find((x) => x.name.trim().toLowerCase() === n.trim().toLowerCase());
                  return b ? usualTerms(b.id, packages, sessions) : null;
                }}
                cost={(p, m) => lineCost(f, { ...o, markup: m }, p)}
                onAdd={addLine}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <Button
                kind={o.lines.length ? 'outline' : 'primary'}
                icon="person-add-outline"
                title={o.lines.length ? t('Registar outro backer') : t('Registar um backer')}
                onPress={() => setAdding(true)}
                disabled={!events.length}
              />
            )}
          </View>
        </Section>

        {settings.nickname.trim() || !o.lines.length ? null : (
          <Field label={t('O teu nome nos links')} value={settings.nickname} onChangeText={(nickname) => setSettings({ nickname })} placeholder="Rui" maxLength={40} />
        )}
        {error ? (
          <T v="small" color={C.warn}>
            {error}
          </T>
        ) : null}

        <Section title="Markup">
          <ChipRow>
            {MARKUPS.map((m) => (
              <Chip key={m} label={markupLabel(m)} active={o.markup === m} onPress={() => changeTerms((x) => ({ ...x, markup: m }))} />
            ))}
          </ChipRow>
        </Section>

        <Section title={t('Torneios ({n})', { n: events.length })}>
          {candidates.length === 0 ? (
            <Card tone="inset">
              <T v="small">{t('Marca no festival os torneios que vais jogar e volta aqui.')}</T>
            </Card>
          ) : (
            <View style={{ gap: S.sm }}>
              {candidates.map((e) => {
                const on = o.events.includes(e.id);
                return (
                  <Card key={e.id} tone={on ? 'accent' : 'default'} padded={false}>
                    <Pressable
                      onPress={() => {
                        tap('select');
                        changeTerms((x) => ({ ...x, events: on ? x.events.filter((y) => y !== e.id) : f.events.filter((y) => y.id === e.id || x.events.includes(y.id)).map((y) => y.id) }));
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T v="h3" numberOfLines={2}>
                          {eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '')}
                        </T>
                        <T v="small">{[shortDate(venueTime(f, e.start)), money(e.buyIn, f.currency)].join(' · ')}</T>
                      </View>
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.accent : C.muted} />
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          )}
          {o.lines.some((l) => l.remote) ? <T v="tiny">{t('Mudar os torneios ou o markup pede a cada backer que confirme outra vez.')}</T> : null}
        </Section>

        <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg, paddingBottom: S.lg }}>
          {t('Os pagamentos fazem-se fora da app; aqui só os registas. Cada link é privado e mostra só a parte desse backer.')}
        </T>
      </Screen>

      {softAsk}
      <Sheet visible={!!logging} title={t('Sessão passada')} onClose={() => setLogging(null)}>
        {logging ? (
          <SessionForm
            key={logging.id}
            past
            initial={pastSession(f, logging, settings.defaultTableSize, uid('s_'))}
            recentNames={[]}
            recentVenues={[]}
            submitLabel={t('Guardar sessão')}
            onSubmit={logPlayed}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function AddLine({
  cur,
  names,
  markup,
  firstLine,
  usual,
  cost,
  onAdd,
  onCancel,
}: {
  cur: string;
  names: string[];
  /** The package's markup; the first backer brings their usual one instead. */
  markup: number;
  firstLine: boolean;
  usual: (name: string) => { pct: number; markup: number } | null;
  cost: (pct: number, markup: number) => number;
  onAdd: (name: string, pct: number, markup: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(names[0] ?? '');
  // A repeat backer comes with what they took last time.
  const [piece, setPiece] = useState(() => (names[0] ? usual(names[0])?.pct : undefined) ?? 5);
  const u = usual(name);
  const m = firstLine && u ? u.markup : markup;
  const pick = (n: string) => {
    setName(n);
    const x = usual(n);
    if (x) setPiece(x.pct);
  };
  const ok = name.trim().length > 0 && piece > 0;
  return (
    <Card tone="raised" style={{ gap: S.md }}>
      <Field label={t('Backer')} value={name} onChangeText={setName} placeholder={t('Nome')} maxLength={40} />
      {names.length ? (
        <ChipRow>
          {names.slice(0, 8).map((n) => (
            <Chip key={n} label={n} active={name.trim().toLowerCase() === n.trim().toLowerCase()} onPress={() => pick(n)} />
          ))}
        </ChipRow>
      ) : null}
      <View style={{ gap: S.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="label">{t('% de cada torneio')}</T>
          <Stepper value={piece} onChange={setPiece} />
        </Row>
        <ChipRow>
          {PIECES.map((p) => (
            <Chip key={p} label={`${p}%`} active={piece === p} onPress={() => setPiece(p)} />
          ))}
        </ChipRow>
        <T v="small">{t('Custo da parte: {cost} · markup {markup}', { cost: money(cost(piece, m), cur), markup: markupLabel(m) })}</T>
      </View>
      <Row gap={S.sm}>
        <Button size="md" kind="ghost" style={{ flex: 1 }} title={t('Cancelar')} onPress={onCancel} />
        <Button size="md" style={{ flex: 1.4 }} icon="checkmark" title={t('Registar')} onPress={() => onAdd(name, piece, m)} disabled={!ok} />
      </Row>
    </Card>
  );
}

/** A past session of a festival event, at its start time, with the package's stakes on it. */
function pastSession(f: Festival, e: FestivalEvent, tableSize: number, id: string): Session {
  const startedAt = venueTime(f, e.start);
  return {
    ...blankSession('mtt', f.currency, tableSize),
    id,
    name: eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : ''),
    venue: `${f.venue}, ${f.city.split(',')[0]}`,
    buyIn: e.buyIn,
    stakes: stakesFor(getOffers(), f.id, e.id),
    startedAt,
    endedAt: startedAt + 6 * 3600e3,
  };
}

/** One event of a backer's piece, in words: "prémio 1 200$", "sem prémio", "a decorrer"... */
function rowLabel(state: SettlementState, prize: number, cur: string): string {
  if (state === 'cashed') return t('prémio {amount}', { amount: money(prize, cur) });
  if (state === 'busted') return t('sem prémio');
  if (state === 'live') return t('a decorrer');
  if (state === 'missed') return t('não joguei');
  if (state === 'waiting') return t('à espera');
  return t('por jogar');
}

function SettleCard({ name, st, cur, onOpen, onSend }: { name: string; st: LineSettlement; cur: string; onOpen: () => void; onSend: () => void }) {
  const bal = balanceLabel(st.net, cur);
  const status = st.done
    ? t('Todos os torneios fechados')
    : [
        st.waiting ? t('{n} à espera de resposta', { n: st.waiting }) : '',
        st.live ? t('{n} a decorrer', { n: st.live }) : '',
        st.upcoming ? t('{n} por jogar', { n: st.upcoming }) : '',
      ]
        .filter(Boolean)
        .join(' · ');
  const lines: [string, string][] = [
    [t('Prémios da parte'), money(st.prizes, cur)],
    [st.paid ? t('Custo da parte (pago)') : t('Custo da parte (por pagar)'), (st.paid ? '' : '−') + money(st.cost, cur)],
  ];
  if (st.refund) lines.push([t('Não jogados (devolver)'), '+' + money(st.refund, cur)]);
  return (
    <Card style={{ gap: S.sm }}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={[name, bal.text, ...lines.map(([k, v]) => `${k} ${v}`), status].filter(Boolean).join(', ')}
        accessibilityHint={t('Abre as contas com este backer')}
        style={{ gap: S.sm }}>
        <Row style={{ alignItems: 'center' }}>
          <T v="h3" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </T>
          <T v="mono" color={bal.color} numberOfLines={1}>
            {bal.text}
          </T>
          <Ionicons name="chevron-forward" size={16} color={C.muted} style={{ marginLeft: 4 }} />
        </Row>
        {lines.map(([k, v]) => (
          <Row key={k} style={{ justifyContent: 'space-between' }}>
            <T v="small">{k}</T>
            <T v="small" style={{ fontVariant: ['tabular-nums'] }}>
              {v}
            </T>
          </Row>
        ))}
        {status ? <T v="tiny">{status}</T> : null}
      </Pressable>
      <Button size="sm" kind="secondary" icon="share-outline" title={t('Enviar contas')} onPress={onSend} />
    </Card>
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

/** − 5% + in steps of 1 up to 10, then 5. */
function Stepper({ value, onChange, min = 0.5 }: { value: number; onChange: (v: number) => void; min?: number }) {
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
