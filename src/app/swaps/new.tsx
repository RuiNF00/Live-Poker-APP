// A new swap on one screen: who, how much, for what. Everything else is pre-filled (your name,
// the event you're playing, the festival, the currency). Creating it makes the link the other
// player confirms; nothing counts until they do.

import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { CurrencyPick, pctLabel } from '@/components/swaps/parts';
import { CURRENCIES } from '@/store/currencies';
import { Button, Card, Chip, ChipRow, Field, Row, Screen, Section, Segmented, T, ToggleItem, ListGroup, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { createSwap, SwapError, swapUrl } from '@/lib/swap-api';
import { FESTIVALS } from '@/poker/festivals';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { fromRemote, swapNames, type SwapTerms } from '@/store/swaps';
import { saveSwap, useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';

const PCTS = [1, 2, 3, 5, 7.5, 10];

function NewSwap() {
  const { settings, sessions, activeSession, setSettings } = useStore();
  const { swaps } = useSwaps();
  const live = activeSession?.kind === 'mtt' ? activeSession : null;
  const [me, setMe] = useState(settings.nickname);
  const [them, setThem] = useState('');
  const [pct, setPct] = useState(5);
  const [same, setSame] = useState(true);
  const [theirPct, setTheirPct] = useState(5);
  const [scope, setScope] = useState<'event' | 'series'>(live ? 'event' : 'series');
  const [title, setTitle] = useState(live?.name ?? '');
  const [venue, setVenue] = useState(live?.venue ?? '');
  const [currency, setCurrency] = useState(live?.currency ?? (CURRENCIES.includes(settings.currency) ? settings.currency : '$'));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

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

  // What you might be swapping for: the tournament you're in, festivals, recent events.
  const suggestions = useMemo(() => {
    const out: { title: string; venue: string; currency: string; scope: 'event' | 'series' }[] = [];
    if (live?.name) out.push({ title: live.name, venue: live.venue, currency: live.currency, scope: 'event' });
    for (const f of FESTIVALS) out.push({ title: f.name, venue: f.venue, currency: f.currency, scope: 'series' });
    for (const s of sessions) {
      if (out.length >= 6) break;
      if (s.kind === 'mtt' && s.name && !out.some((o) => o.title === s.name)) out.push({ title: s.name, venue: s.venue, currency: s.currency, scope: 'event' });
    }
    return out.filter((o) => o.scope === scope);
  }, [live, sessions, scope]);

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
      const { swap, token } = await createSwap(terms);
      saveSwap(fromRemote(swap, token, 'a'));
      if (!settings.nickname) setSettings({ nickname: me.trim() });
      const ref = await shareRef().catch(() => '');
      const url = swapUrl(swap.id, ref);
      const msg = t('Swap de {pct} no {title}. Confirma aqui para ficar por escrito: {url}', { pct: pctLabel(pct), title: terms.title, url });
      track('link_shared', { channel: 'swap' });
      router.replace({ pathname: '/swap/[id]', params: { id: swap.id } });
      if (Platform.OS === 'web') await Clipboard.setStringAsync(url);
      else await Share.share({ message: msg });
    } catch (e) {
      const code = e instanceof SwapError ? e.code : 'offline';
      Alert.alert(
        t('Não foi possível criar o swap'),
        code === 'offensive' ? t('Um dos nomes não é permitido.') : code === 'rate_limited' ? t('Demasiados swaps seguidos. Tenta daqui a pouco.') : t('Precisa de rede para criar o link. Tenta de novo quando tiveres sinal.'),
      );
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t('Novo swap'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }} keyboardShouldPersistTaps="handled">
        <Section title={t('Com quem')}>
          <Field value={them} onChangeText={setThem} placeholder={t('Nome do jogador')} autoFocus={!people.length} maxLength={40} autoCapitalize="words" />
          {people.length ? (
            <ChipRow>
              {people.map((p) => (
                <Chip key={p} label={p} icon="person-outline" active={them === p} onPress={() => setThem(p)} />
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
          <Section title={t('{name} dá', { name })}>
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
            {t('Se cobrares {prize}, pagas {mine} a {name}.', { prize: money(example, currency), mine: money((pct / 100) * example, currency), name })}
          </T>
          <T v="small">
            {t('Se {name} cobrar {prize}, recebes {theirs}.', { prize: money(example, currency), theirs: money((pB / 100) * example, currency), name })}
          </T>
        </Card>

        <View style={{ gap: S.sm }}>
          <Button title={busy ? t('A criar…') : t('Criar e enviar link')} icon="paper-plane-outline" disabled={!ok} onPress={create} />
          <Row gap={6} style={{ justifyContent: 'center', paddingHorizontal: S.lg }}>
            <T v="tiny" style={{ textAlign: 'center' }} color={C.muted}>
              {t('{name} confirma no link, com ou sem a app. Depois disso os termos e a hora ficam fixados.', { name })}{' '}
              {t('Envia o link só a {name}: quem o abrir primeiro pode confirmar.', { name })}
            </T>
          </Row>
        </View>
      </Screen>
    </>
  );
}

export default NewSwap;
