// A new group swap on one screen: who's in, how much, for what. The creator lists the others by
// name; one link goes to the group chat and each player taps their own name to join. Nothing
// counts until everyone is in.

import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { appUserId } from '@/billing/purchases';
import { CurrencyPick, pctLabel } from '@/components/swaps/parts';
import { CURRENCIES } from '@/store/currencies';
import { Button, Card, Chip, ChipRow, Field, IconButton, Row, Screen, Section, Segmented, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { SwapError } from '@/lib/swap-api';
import { createGroup, groupUrl } from '@/lib/swap-group-api';
import { FESTIVALS } from '@/poker/festivals';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { GROUP_MAX, GROUP_MIN, groupFromRemote, type GroupTerms } from '@/store/swap-groups';
import { saveGroup, useGroups } from '@/store/swap-groups-store';
import { swapNames } from '@/store/swaps';
import { useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';

const PCTS = [0.5, 1, 2, 3, 5];

function NewGroupSwap() {
  const { settings, sessions, activeSession, setSettings } = useStore();
  const { swaps } = useSwaps();
  const { groups } = useGroups();
  const live = activeSession?.kind === 'mtt' ? activeSession : null;
  const [me, setMe] = useState(settings.nickname);
  const [others, setOthers] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [pct, setPct] = useState(2);
  const [scope, setScope] = useState<'event' | 'series'>(live ? 'event' : 'series');
  const [title, setTitle] = useState(live?.name ?? '');
  const [venue, setVenue] = useState(live?.venue ?? '');
  const [currency, setCurrency] = useState(live?.currency ?? (CURRENCIES.includes(settings.currency) ? settings.currency : '$'));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Leaving with Voltar drops the draft (going to the background keeps it).
  useFocusEffect(
    useCallback(
      () => () => {
        setOthers([]);
        setTyped('');
        setNote('');
        setBusy(false);
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
    const terms: GroupTerms = { v: 1, scope, title: title.trim(), venue: venue.trim(), currency, pct, note: note.trim(), createdAt: Date.now() };
    try {
      const rc = await appUserId();
      const { group, token, invite } = await createGroup(terms, [me.trim(), ...others], rc);
      saveGroup({ ...groupFromRemote(group, token, 0, invite), ownerRc: rc });
      if (!settings.nickname) setSettings({ nickname: me.trim() });
      const ref = await shareRef().catch(() => '');
      const url = groupUrl(group.id, invite, ref);
      track('link_shared', { channel: 'swap' });
      router.replace({ pathname: '/swap/g/[id]', params: { id: group.id } });
      const msg = t('Swap de grupo de {pct} no {title}. Escolhe o teu nome para entrar: {url}', { pct: pctLabel(pct), title: terms.title, url });
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
          {people.filter((p) => !has(p)).length ? (
            <ChipRow>
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
          <Button
            title={busy ? t('A criar…') : size < GROUP_MIN ? t('Junta pelo menos 2 jogadores') : t('Criar e enviar link')}
            icon="paper-plane-outline"
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
    </>
  );
}

export default NewGroupSwap;
