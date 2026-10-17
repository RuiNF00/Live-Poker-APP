// A new swap on one screen: who, how much, for what. Everything else is pre-filled (your name,
// the event you're playing, the festival, the currency). Creating it makes the link the other
// player confirms; nothing counts until they do.

import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { appUserId } from '@/billing/purchases';
import { CurrencyPick, pctLabel } from '@/components/swaps/parts';
import { useSwapSuggestions } from '@/components/swaps/suggest';
import { sendsToWhatsapp, sendWhatsapp, SwapSend, type SwapLink } from '@/components/swaps/SwapSend';
import { notice } from '@/lib/notice';
import { CURRENCIES } from '@/store/currencies';
import { Button, Card, Chip, ChipRow, Field, Row, Screen, Section, Segmented, T, ToggleItem, ListGroup, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { onReconnect } from '@/lib/online';
import { shareRef } from '@/lib/referrals';
import { createSwap, newCreateKey, SwapError, swapUrl } from '@/lib/swap-api';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { fromRemote, swapNames, type SwapTerms } from '@/store/swaps';
import { saveSwap, useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';

const PCTS = [1, 2, 3, 5, 7.5, 10];

function NewSwap() {
  const { settings, activeSession, setSettings } = useStore();
  const { swaps } = useSwaps();
  const live = activeSession?.kind === 'mtt' ? activeSession : null;
  const all = useSwapSuggestions();
  const [me, setMe] = useState(settings.nickname);
  const [them, setThem] = useState('');
  const [pct, setPct] = useState(5);
  const [same, setSame] = useState(true);
  const [theirPct, setTheirPct] = useState(5);
  const [scope, setScope] = useState<'event' | 'series'>(live || all.some((o) => o.from === 'plan') ? 'event' : 'series');
  // Typed or picked; until then, the tournament you're in or the first one planned for today.
  const [typedTitle, setTitle] = useState<string | null>(live?.name ?? null);
  const [typedVenue, setVenue] = useState<string | null>(live?.venue ?? null);
  const auto = typedTitle === null && scope === 'event' ? all.find((o) => o.from === 'plan') : undefined;
  const title = typedTitle ?? auto?.title ?? '';
  const venue = typedVenue ?? auto?.venue ?? '';
  const [pickedCurrency, setCurrency] = useState<string | null>(live?.currency ?? null);
  const currency = pickedCurrency ?? (auto && CURRENCIES.includes(auto.currency) ? auto.currency : CURRENCIES.includes(settings.currency) ? settings.currency : '$');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // Created, choosing where to send the link: the swap screen opens when the sheet closes.
  const [sent, setSent] = useState<{ id: string; link: SwapLink } | null>(null);
  // No signal: everything typed stays, and the swap is created by itself when the signal is back.
  const [waiting, setWaiting] = useState(false);
  // The draft's own key: a retry (by hand or when the signal is back) can't make a second swap.
  const key = useRef(newCreateKey());

  // Each visit starts fresh: leaving with Voltar drops the draft (going to the background keeps it).
  useFocusEffect(
    useCallback(
      () => () => {
        setThem('');
        setPct(5);
        setSame(true);
        setTheirPct(5);
        setNote('');
        setBusy(false);
        setWaiting(false);
        key.current = newCreateKey();
      },
      [],
    ),
  );

  // People you swapped with before, newest first: a repeat swap is one tap.
  const people = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of swaps) {
      const n = swapNames(s)[s.side === 'a' ? 'b' : 'a'];
      if (n && !seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        out.push(n);
      }
    }
    return out.slice(0, 6);
  }, [swaps]);

  const suggestions = all.filter((o) => o.scope === scope);

  // A repeat swap is one tap: picking someone brings back the terms of your last swap with them.
  const pickPerson = (p: string) => {
    setThem(p);
    const last = swaps.find((x) => swapNames(x)[x.side === 'a' ? 'b' : 'a'].toLowerCase() === p.toLowerCase());
    if (!last) return;
    const mine = last.terms[last.side].pct;
    const theirs = last.terms[last.side === 'a' ? 'b' : 'a'].pct;
    setPct(mine);
    setSame(mine === theirs);
    setTheirPct(theirs);
    if (!live && CURRENCIES.includes(last.terms.currency)) setCurrency(last.terms.currency);
  };

  const pB = same ? pct : theirPct;
  const ok = me.trim() && them.trim() && title.trim() && !busy;
  const example = 100000;
  const name = them.trim() || t('o outro jogador');

  async function create() {
    if (!ok) return;
    setBusy(true);
    tap('medium');
    const terms: SwapTerms = {
      v: 1,
      scope,
      title: title.trim(),
      venue: venue.trim(),
      currency,
      a: { name: me.trim(), pct },
      b: { name: them.trim(), pct: pB },
      note: note.trim(),
      createdAt: Date.now(),
    };
    try {
      const rc = await appUserId();
      const { swap, token } = await createSwap(terms, rc, key.current);
      saveSwap({ ...fromRemote(swap, token, 'a'), ownerRc: rc });
      if (!settings.nickname) setSettings({ nickname: me.trim() });
      const ref = await shareRef().catch(() => '');
      const url = swapUrl(swap.id, ref);
      const msg = t('Swap de {pct} no {title}. Confirma aqui para ficar por escrito: {url}', { pct: pctLabel(pct), title: terms.title, url });
      track('link_shared', { channel: 'swap' });
      const open = () => router.replace({ pathname: '/swap/[id]', params: { id: swap.id } });
      if (Platform.OS === 'web') {
        open();
        await Clipboard.setStringAsync(url);
      } else if (sendsToWhatsapp()) {
        open();
        await sendWhatsapp(msg);
      } else setSent({ id: swap.id, link: { url, message: msg, to: t('Envia o link só a {name}: quem o abrir primeiro pode confirmar.', { name: terms.b.name }) } });
    } catch (e) {
      const code = e instanceof SwapError ? e.code : 'offline';
      setBusy(false);
      if (code === 'offline') {
        setWaiting(true);
        return;
      }
      notice(
        t('Não foi possível criar o swap'),
        code === 'offensive' ? t('Um dos nomes não é permitido.') : code === 'rate_limited' ? t('Demasiados swaps seguidos. Tenta daqui a pouco.') : t('Precisa de rede para criar o link. Tenta de novo quando tiveres sinal.'),
      );
      setBusy(false);
    }
  }

  const createRef = useRef(create);
  useEffect(() => {
    createRef.current = create;
  });
  useEffect(() => {
    if (!waiting) return;
    return onReconnect(() => {
      setWaiting(false);
      void createRef.current();
    });
  }, [waiting]);

  return (
    <>
      <Stack.Screen options={{ title: t('Novo swap'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }} keyboardShouldPersistTaps="handled">
        <Section title={t('Com quem')}>
          <Field value={them} onChangeText={setThem} placeholder={t('Nome do jogador')} autoFocus={!people.length} maxLength={40} autoCapitalize="words" />
          {people.length ? (
            <ChipRow>
              {people.map((p) => (
                <Chip key={p} label={p} icon="person-outline" active={them === p} onPress={() => pickPerson(p)} />
              ))}
            </ChipRow>
          ) : null}
        </Section>

        <Section title={same ? t('Percentagem (para os dois)') : t('Tu dás')}>
          <ChipRow>
            {PCTS.map((p) => (
              <Chip key={p} big label={pctLabel(p)} active={pct === p} onPress={() => setPct(p)} />
            ))}
          </ChipRow>
        </Section>
        {!same ? (
          <Section title={them.trim() ? t('{name} dá', { name }) : t('O outro jogador dá')}>
            <ChipRow>
              {PCTS.map((p) => (
                <Chip key={p} big label={pctLabel(p)} active={theirPct === p} onPress={() => setTheirPct(p)} />
              ))}
            </ChipRow>
          </Section>
        ) : null}
        <ListGroup>
          <ToggleItem
            icon="git-compare-outline"
            title={t('A mesma percentagem')}
            subtitle={t('Desliga para um swap desigual (ex.: 3% por 2%)')}
            value={same}
            onChange={(v) => {
              setSame(v);
              if (!v) setTheirPct(pct);
            }}
          />
        </ListGroup>

        <Section title={t('Para')}>
          <Segmented
            options={[
              { key: 'event', label: t('Um evento') },
              { key: 'series', label: t('Série inteira') },
            ]}
            value={scope}
            onChange={setScope}
          />
          {suggestions.length ? (
            <ChipRow>
              {suggestions.map((o) => (
                <Chip
                  key={o.title}
                  label={o.title}
                  icon={o.scope === 'series' ? 'calendar-outline' : 'trophy-outline'}
                  active={title === o.title}
                  onPress={() => {
                    setTitle(o.title);
                    setVenue(o.venue);
                    if (CURRENCIES.includes(o.currency)) setCurrency(o.currency);
                  }}
                />
              ))}
            </ChipRow>
          ) : null}
          <Field value={title} onChangeText={setTitle} placeholder={scope === 'series' ? t('Ex.: Bahamas, dezembro') : t('Ex.: $10k Main Event')} maxLength={80} />
          <Field value={venue} onChangeText={setVenue} placeholder={t('Sala (opcional)')} maxLength={80} />
        </Section>

        <Section title={t('Moeda')}>
          <CurrencyPick value={currency} onChange={setCurrency} home={settings.currency} />
        </Section>

        {!settings.nickname ? (
          <Section title={t('O teu nome')} hint={t('É o nome que o outro jogador vê no link.')}>
            <Field value={me} onChangeText={setMe} placeholder={t('Ex.: Rui')} maxLength={40} autoCapitalize="words" />
          </Section>
        ) : null}

        <Section title={t('Nota (opcional)')}>
          <Field value={note} onChangeText={setNote} placeholder={t('Ex.: só eventos até $25k, acerto por transferência')} maxLength={280} multiline />
        </Section>

        <Card tone="inset" style={{ gap: S.xs }}>
          <T v="small">
            {them.trim()
              ? t('Se cobrares {prize}, pagas {mine} a {name}.', { prize: money(example, currency), mine: money((pct / 100) * example, currency), name })
              : t('Se cobrares {prize}, pagas {mine} ao outro jogador.', { prize: money(example, currency), mine: money((pct / 100) * example, currency) })}
          </T>
          <T v="small">
            {t('Se {name} cobrar {prize}, recebes {theirs}.', { prize: money(example, currency), theirs: money((pB / 100) * example, currency), name })}
          </T>
        </Card>

        <View style={{ gap: S.sm }}>
          <Button lines={2} title={busy ? t('A criar…') : waiting ? t('Sem rede: é criado quando houver sinal') : sendsToWhatsapp() ? t('Criar e enviar por WhatsApp') : t('Criar e enviar link')}
            icon={sendsToWhatsapp() && !busy && !waiting ? 'logo-whatsapp' : 'paper-plane-outline'} disabled={!ok} onPress={create} />
          <Row gap={6} style={{ justifyContent: 'center', paddingHorizontal: S.lg }}>
            <T v="tiny" style={{ textAlign: 'center' }} color={C.muted}>
              {them.trim() ? t('{name} confirma no link, com ou sem a app. Depois disso os termos e a hora ficam fixados.', { name }) : t('O outro jogador confirma no link, com ou sem a app. Depois disso os termos e a hora ficam fixados.')}{' '}
              {them.trim() ? t('Envia o link só a {name}: quem o abrir primeiro pode confirmar.', { name }) : t('Envia o link só ao outro jogador: quem o abrir primeiro pode confirmar.')}
            </T>
          </Row>
        </View>
      </Screen>
      <SwapSend
        link={sent?.link ?? null}
        onDone={() => {
          if (sent) router.replace({ pathname: '/swap/[id]', params: { id: sent.id } });
          setSent(null);
        }}
      />
    </>
  );
}

export default NewSwap;
