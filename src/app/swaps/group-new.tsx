// A new group swap on one screen: who's in, how much, for what. The creator lists the others by
// name; one link goes to the group chat and each player taps their own name to join. Nothing
// counts until everyone is in.

import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { appUserId } from '@/billing/purchases';
import { CurrencyPick, pctLabel } from '@/components/swaps/parts';
import { useSwapSuggestions } from '@/components/swaps/suggest';
import { sendsToWhatsapp, sendWhatsapp, SwapSend, type SwapLink } from '@/components/swaps/SwapSend';
import { notice } from '@/lib/notice';
import { CURRENCIES } from '@/store/currencies';
import { Button, Card, Chip, ChipRow, Field, IconButton, Row, Screen, Section, Segmented, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { newCreateKey, SwapError, swapIdFor } from '@/lib/swap-api';
import { forgetSwapCreate, queueSwapCreate } from '@/lib/swap-create-queue';
import { createGroup, groupUrl } from '@/lib/swap-group-api';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { GROUP_MAX, GROUP_MIN, groupFromRemote, type GroupTerms } from '@/store/swap-groups';
import { saveGroup, useGroups } from '@/store/swap-groups-store';
import { swapNames } from '@/store/swaps';
import { useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';

const PCTS = [0.5, 1, 2, 3, 5];
// When the terms are made (only ever from the create button, never during a render).
const madeAt = () => Date.now();

function NewGroupSwap() {
  const { settings, activeSession, setSettings } = useStore();
  const { swaps } = useSwaps();
  const { groups } = useGroups();
  const live = activeSession?.kind === 'mtt' ? activeSession : null;
  const all = useSwapSuggestions();
  const [me, setMe] = useState(settings.nickname);
  const [others, setOthers] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [pct, setPct] = useState(2);
  const [scope, setScope] = useState<'event' | 'series'>(live || all.some((o) => o.from === 'plan') ? 'event' : 'series');
  // Typed or picked; until then, the tournament you're in or the first one planned for today.
  const [typedTitle, setTitle] = useState<string | null>(live?.name ?? null);
  const [typedVenue, setVenue] = useState<string | null>(live?.venue ?? null);
  const auto = typedTitle === null && scope === 'event' ? all.find((o) => o.from === 'plan') : undefined;
  const title = typedTitle ?? auto?.title ?? '';
  const venue = typedVenue ?? auto?.venue ?? '';
  const [pickedCurrency, setCurrency] = useState<string | null>(live?.currency ?? null);
  const currency = pickedCurrency ?? (auto && CURRENCIES.includes(auto.currency) ? auto.currency : CURRENCIES.includes(settings.currency) ? settings.currency : '$');
  // Created, choosing where to send the link: the group screen opens when the sheet closes.
  const [sent, setSent] = useState<{ id: string; queued: boolean; link: SwapLink } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // The draft's own key: a retry (by hand or when the signal is back) can't make a second group.
  const key = useRef({ token: newCreateKey(), invite: newCreateKey() });

  // Leaving with Voltar drops the draft (going to the background keeps it).
  useFocusEffect(
    useCallback(
      () => () => {
        setOthers([]);
        setTyped('');
        setNote('');
        setBusy(false);
        key.current = { token: newCreateKey(), invite: newCreateKey() };
      },
      [],
    ),
  );

  // People from earlier swaps and groups: building a group is a few taps.
  const people = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (n: string) => {
      if (n && n !== '-' && !seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        out.push(n);
      }
    };
    for (const s of swaps) if (!s.left) push(swapNames(s)[s.side === 'a' ? 'b' : 'a']);
    for (const g of groups) for (const s of g.seats) if (s.seat !== g.seat) push(s.name);
    return out.slice(0, 12);
  }, [swaps, groups]);

  const suggestions = all.filter((o) => o.scope === scope);

  // The same table again (the group you swapped with last): everyone, the % and the currency in one tap.
  const last = groups.find((g) => g.seats.some((x) => x.seat !== g.seat && x.name !== '-'));
  const lastNames = last ? last.seats.filter((x) => x.seat !== last.seat && x.name !== '-').map((x) => x.name).slice(0, GROUP_MAX - 1) : [];
  const sameAsLast = lastNames.length > 0 && lastNames.length === others.length && lastNames.every((n) => others.some((o) => o.toLowerCase() === n.toLowerCase()));
  const pickLast = () => {
    if (!last) return;
    setOthers(lastNames);
    setPct(last.terms.pct);
    if (!live && CURRENCIES.includes(last.terms.currency)) setCurrency(last.terms.currency);
  };

  const has = (n: string) => others.some((o) => o.toLowerCase() === n.trim().toLowerCase()) || n.trim().toLowerCase() === me.trim().toLowerCase();
  const toggle = (n: string) => setOthers((cur) => (cur.some((o) => o.toLowerCase() === n.toLowerCase()) ? cur.filter((o) => o.toLowerCase() !== n.toLowerCase()) : cur.length < GROUP_MAX - 1 ? [...cur, n] : cur));
  const addTyped = () => {
    const n = typed.trim();
    if (n && !has(n) && others.length < GROUP_MAX - 1) setOthers([...others, n]);
    setTyped('');
  };

  const size = others.length + 1;
  const ok = me.trim() && size >= GROUP_MIN && title.trim() && !busy;
  const example = 100000;
  const each = (pct / 100) * example;

  async function create() {
    if (!ok) return;
    setBusy(true);
    tap('medium');
    const terms: GroupTerms = { v: 1, scope, title: title.trim(), venue: venue.trim(), currency, pct, note: note.trim(), createdAt: madeAt() };
    const names = [me.trim(), ...others];
    const rc = await appUserId();
    // The link's id comes from the draft's key: the same link with or without signal.
    const id = await swapIdFor(key.current.token);
    let made: Pick<Awaited<ReturnType<typeof createGroup>>, 'group' | 'invite'> | undefined;
    try {
      const { group, token, invite } = await createGroup(terms, names, rc, key.current, id);
      saveGroup({ ...groupFromRemote(group, token, 0, invite), ownerRc: rc });
      forgetSwapCreate(key.current.token);
      if (!settings.nickname) setSettings({ nickname: me.trim() });
      made = { group, invite };
    } catch (e) {
      const code = e instanceof SwapError ? e.code : 'offline';
      if (code === 'offline') {
        // No signal: the link goes out now and the group is created by itself when the signal is
        // back, even after Voltar or a restart. Until then the link says to try again in a little while.
        const link = await linkFor(id, key.current.invite, terms);
        queueSwapCreate({ kind: 'group', keys: key.current, terms, names, rc, id }, { url: link.url, message: link.message });
        if (!settings.nickname) setSettings({ nickname: me.trim() });
        await send(id, key.current.invite, terms, true, link);
        return;
      }
      notice(
        t('Não foi possível criar o swap'),
        code === 'offensive' ? t('Um dos nomes não é permitido.') : code === 'rate_limited' ? t('Demasiados swaps seguidos. Tenta daqui a pouco.') : t('Precisa de rede para criar o link. Tenta de novo quando tiveres sinal.'),
      );
      setBusy(false);
    }
    // Sent after the try: a share sheet that fails is not «no signal» (that would queue a create of a group that exists).
    if (made) await send(made.group.id, made.invite, made.group.terms, false).catch(() => {});
  }

  async function linkFor(id: string, invite: string, terms: GroupTerms): Promise<SwapLink> {
    const ref = await shareRef().catch(() => '');
    const url = groupUrl(id, invite, ref);
    return { url, message: t('Swap de grupo de {pct} no {title}. Escolhe o teu nome para entrar: {url}', { pct: pctLabel(terms.pct), title: terms.title, url }) };
  }

  // Made: the group screen once the link is sent. Waiting for signal: the swaps list, where it shows as waiting.
  async function send(id: string, invite: string, terms: GroupTerms, queued: boolean, made?: SwapLink) {
    const link = made ?? (await linkFor(id, invite, terms));
    track('link_shared', { channel: 'swap' });
    const open = () => (queued ? router.replace('/swaps') : router.replace({ pathname: '/swap/g/[id]', params: { id } }));
    if (Platform.OS === 'web') {
      open();
      await Clipboard.setStringAsync(link.url);
      notice(t('Link copiado'), link.url);
    } else if (sendsToWhatsapp()) {
      open();
      await sendWhatsapp(link.message);
    } else setSent({ id, queued, link: queued ? { ...link, to: t('Sem rede: o swap é criado quando houver sinal e o link abre a partir daí.') } : link });
  }

  return (
    <>
      <Stack.Screen options={{ title: t('Swap de grupo'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }} keyboardShouldPersistTaps="handled">
        <Section title={t('Quem entra ({n} de {max})', { n: size, max: GROUP_MAX })} hint={t('Tu e mais 2 a 7 jogadores. Cada um escolhe o seu nome no link.')}>
          <ChipRow>
            <Chip label={me.trim() || t('Tu')} icon="person" active />
            {others.map((o) => (
              <Chip key={o} label={o} icon="close" active onPress={() => toggle(o)} />
            ))}
          </ChipRow>
          {others.length < GROUP_MAX - 1 ? (
            <Row gap={S.sm} style={{ alignItems: 'center' }}>
              <Field value={typed} onChangeText={setTyped} placeholder={t('Nome do jogador')} maxLength={40} autoCapitalize="words" onSubmitEditing={addTyped} returnKeyType="done" style={{ flex: 1 }} />
              <IconButton name="add" onPress={addTyped} label={t('Adicionar')} />
            </Row>
          ) : null}
          {people.filter((p) => !has(p)).length || (lastNames.length && !sameAsLast) ? (
            <ChipRow>
              {lastNames.length && !sameAsLast ? <Chip label={t('Mesmo grupo da última vez')} icon="people" onPress={pickLast} /> : null}
              {people
                .filter((p) => !has(p))
                .map((p) => (
                  <Chip key={p} label={p} icon="add" onPress={() => toggle(p)} />
                ))}
            </ChipRow>
          ) : null}
        </Section>

        <Section title={t('Percentagem (cada um para cada um)')}>
          <ChipRow>
            {PCTS.map((p) => (
              <Chip key={p} big label={pctLabel(p)} active={pct === p} onPress={() => setPct(p)} />
            ))}
          </ChipRow>
        </Section>

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
          <Section title={t('O teu nome')} hint={t('É o nome que os outros veem no link.')}>
            <Field value={me} onChangeText={setMe} placeholder={t('Ex.: Rui')} maxLength={40} autoCapitalize="words" />
          </Section>
        ) : null}

        <Section title={t('Nota (opcional)')}>
          <Field value={note} onChangeText={setNote} placeholder={t('Ex.: só eventos até $25k, acerto por transferência')} maxLength={280} multiline />
        </Section>

        <Card tone="inset" style={{ gap: S.xs }}>
          <T v="small">
            {t('Se cobrares {prize}, pagas {each} a cada um ({total} no total).', { prize: money(example, currency), each: money(each, currency), total: money(each * Math.max(size - 1, 2), currency) })}
          </T>
          <T v="small">{t('Se outro do grupo cobrar {prize}, recebes {each}.', { prize: money(example, currency), each: money(each, currency) })}</T>
        </Card>

        <View style={{ gap: S.sm }}>
          <Button lines={2}
            title={busy ? t('A criar…') : size < GROUP_MIN ? t('Junta pelo menos 2 jogadores') : sendsToWhatsapp() ? t('Criar e enviar por WhatsApp') : t('Criar e enviar link')}
            icon={sendsToWhatsapp() && !busy && size >= GROUP_MIN ? 'logo-whatsapp' : 'paper-plane-outline'}
            disabled={!ok}
            onPress={create}
          />
          <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }} color={C.muted}>
            {t('Envia o link para o grupo. Cada um toca no seu nome; quando estiverem todos, os termos ficam fixados.')}
          </T>
          <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }} color={C.muted}>
            {t('Registo e contas apenas. Nenhum dinheiro passa pela Sweatbook: os pagamentos fazem-se entre vocês.')} {t('Só para maiores de 18 anos.')}
          </T>
        </View>
      </Screen>
      <SwapSend
        link={sent?.link ?? null}
        onDone={() => {
          if (sent) router.replace(sent.queued ? '/swaps' : { pathname: '/swap/g/[id]', params: { id: sent.id } });
          setSent(null);
        }}
      />
    </>
  );
}

export default NewGroupSwap;
