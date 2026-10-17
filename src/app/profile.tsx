// Public profile: an opt-in page at sweatbook.poker/u/<handle> with the hands and
// session cards the player ticks here. Off until created; amounts hidden by default.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Share, View } from 'react-native';

import { CardRow } from '@/components/PlayingCard';
import { Button, Card, Field, ListGroup, ListItem, Row, Section, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { EMPTY_DRAFT, handleLooksValid, MAX_ITEMS, normalizeHandle, profileBody, profileSessions, shareableHands, type ProfileDraft, type ProfileLink } from '@/lib/profile-payload';
import { checkHandle, createProfile, deleteProfile, loadProfileLink, profileUrl, updateProfile, type HandleCheck, type SaveResult } from '@/lib/public-profile';
import { shareRef } from '@/lib/referrals';
import { shortDate } from '@/poker/format';
import { useStore } from '@/store/store';
import { C, F, S } from '@/theme';

const HANDLE_COPY: Record<Exclude<HandleCheck, 'ok'>, string> = {
  taken: 'Esse nome já está ocupado.',
  invalid: '3 a 20 letras, números, _ ou ponto.',
  reserved: 'Esse nome está reservado.',
  offensive: 'Escolhe outro nome.',
  offline: 'Sem rede para confirmar o nome.',
};

const SAVE_COPY: Record<Exclude<SaveResult, 'ok'>, string> = {
  taken: 'Esse nome já está ocupado.',
  invalid: 'Esse nome não serve. Usa 3 a 20 letras, números, _ ou ponto.',
  reserved: 'Esse nome está reservado.',
  offensive: 'O nome, a bio ou uma sessão têm uma palavra que não podemos publicar.',
  gone: 'Este perfil já não existe. Podes criar outro.',
  offline: 'Sem rede. Tenta outra vez quando tiveres sinal.',
  error: 'Não deu para guardar. Tenta outra vez.',
};

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

function confirm(title: string, body: string, yes: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${body}`));
  return new Promise((r) =>
    Alert.alert(title, body, [
      { text: t('Cancelar'), style: 'cancel', onPress: () => r(false) },
      { text: yes, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

export default function ProfileScreen() {
  const { hands, sessions, settings } = useStore();
  const [link, setLink] = useState<ProfileLink | null | undefined>(undefined);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [handle, setHandle] = useState('');
  const [remote, setRemote] = useState<{ handle: string; result: HandleCheck } | null>(null);
  const [busy, setBusy] = useState(false);

  const shareable = useMemo(() => shareableHands(hands), [hands]);
  const finished = useMemo(() => profileSessions(sessions), [sessions]);

  useEffect(() => {
    loadProfileLink().then((l) => {
      setLink(l);
      if (l) {
        setDraft(l.draft);
        setHandle(l.handle);
      } else setDraft({ ...EMPTY_DRAFT, name: settings.nickname ?? '' });
    });
    // Only on open: the nickname is a starting point, not kept in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live check of the handle while typing (skipped when it is the current one).
  const h = normalizeHandle(handle);
  const needsCheck = !!h && h !== link?.handle && handleLooksValid(h);
  const check: HandleCheck | 'checking' | null = !h || h === link?.handle ? null : !handleLooksValid(h) ? 'invalid' : remote?.handle === h ? remote.result : 'checking';
  useEffect(() => {
    if (!needsCheck) return;
    let live = true;
    const id = setTimeout(() => checkHandle(h).then((result) => live && setRemote({ handle: h, result })), 400);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [h, needsCheck]);

  const set = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }));
  const toggle = (key: 'hands' | 'sessions', id: string) => {
    tap();
    setDraft((d) => {
      const on = d[key].includes(id);
      if (!on && d[key].length >= MAX_ITEMS) {
        note(t('Máximo de {n}', { n: MAX_ITEMS }), t('Tira uma para pores outra.'));
        return d;
      }
      return { ...d, [key]: on ? d[key].filter((x) => x !== id) : [...d[key], id] };
    });
  };

  const dirty = !!link && (JSON.stringify(draft) !== JSON.stringify(link.draft) || h !== link.handle);
  const handleOk = h === link?.handle || check === 'ok';

  const save = async () => {
    tap('medium');
    setBusy(true);
    const body = profileBody(draft, { hands, sessions }, (await shareRef()) || null);
    const r = link ? await updateProfile(link, draft, body, h) : await createProfile(h, draft, body);
    setBusy(false);
    if (r !== 'ok') {
      note(t('Não ficou guardado'), t(SAVE_COPY[r]));
      if (r === 'gone') setLink(null);
      return;
    }
    if (!link) track('share_created', { kind: 'profile', hands: body.hands.length, sessions: body.profile.sessions.length, hide: draft.hideAmounts });
    const l = await loadProfileLink();
    setLink(l);
    if (l) setHandle(l.handle);
  };

  const remove = async () => {
    if (!link) return;
    if (!(await confirm(t('Apagar o perfil?'), t('A página sai do ar e o link deixa de funcionar. As mãos partilhadas continuam nos seus links.'), t('Apagar')))) return;
    setBusy(true);
    const r = await deleteProfile(link);
    setBusy(false);
    if (r !== 'ok') return note(t('Não deu para apagar'), t(SAVE_COPY[r]));
    setLink(null);
    setHandle('');
    setDraft({ ...EMPTY_DRAFT, name: draft.name });
  };

  const shareLink = async () => {
    if (!link) return;
    tap();
    const url = profileUrl(link.handle);
    track('link_shared', { channel: 'profile' });
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(url);
      note(t('Link copiado'));
    } else await Share.share({ message: url, url });
  };

  if (link === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  const handleHint =
    check === 'checking' ? t('A confirmar…') : check === 'ok' ? t('Disponível') : check ? t(HANDLE_COPY[check]) : link ? t('Mudar o nome muda o link: o antigo deixa de funcionar.') : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t('Perfil público') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {link ? (
          <Card tone="good" style={{ gap: S.md }}>
            <Row gap={10}>
              <Ionicons name="globe-outline" size={18} color={C.good} />
              <T v="h2" style={{ flex: 1 }}>
                {t('O teu perfil está público')}
              </T>
            </Row>
            <T v="callout" selectable style={{ fontFamily: F.mono }}>
              {profileUrl(link.handle).replace(/^https?:\/\//, '')}
            </T>
            <Row gap={S.sm}>
              <Button title={t('Partilhar link')} icon="share-outline" size="md" onPress={shareLink} style={{ flex: 1 }} />
              <Button title={t('Abrir')} kind="secondary" size="md" icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(profileUrl(link.handle))} />
            </Row>
          </Card>
        ) : (
          <Card tone="accent" style={{ gap: 6 }}>
            <Row gap={10}>
              <Ionicons name="person-circle-outline" size={20} color={C.accent} />
              <T v="h2" style={{ flex: 1 }}>
                {t('Uma página só tua')}
              </T>
            </Row>
            <T v="small">{t('Em sweatbook.poker, com as mãos e sessões que escolheres aqui. Nada aparece sem escolheres, e quem te segue instala a app com o teu convite.')}</T>
          </Card>
        )}

        <Section title={t('Nome e bio')}>
          <Card style={{ gap: S.lg }}>
            <Field
              label={t('Nome de utilizador')}
              value={handle}
              onChangeText={(v) => setHandle(v.replace(/\s/g, '').slice(0, 21))}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="ex.: rui.poker"
              hint={handleHint}
              inputStyle={{ fontFamily: F.mono }}
            />
            <Field label={t('Nome a mostrar')} value={draft.name} onChangeText={(name) => set({ name: name.slice(0, 40) })} placeholder={t('Ex.: Rui')} />
            <Field label={t('Bio')} value={draft.bio} onChangeText={(bio) => set({ bio: bio.slice(0, 160) })} placeholder={t('Ex.: MTTs live em Portugal e Espanha')} multiline />
          </Card>
          <ListGroup>
            <ToggleItem icon="eye-off-outline" title={t('Esconder montantes')} subtitle={t('Resultados e buy-ins ficam só no telemóvel. Mostra lugares e horas.')} value={draft.hideAmounts} onChange={(hideAmounts) => set({ hideAmounts })} />
          </ListGroup>
        </Section>

        <Section title={t('Mãos no perfil ({n})', { n: draft.hands.length })} hint={t('Só aparecem mãos que já partilhaste por link. Num desafio, o board fica escondido.')}>
          {shareable.length ? (
            <ListGroup>
              {shareable.map((hd) => {
                const on = draft.hands.includes(hd.id);
                const cards = hd.players[hd.hero]?.cards ?? [];
                return (
                  <ListItem
                    key={hd.id}
                    left={cards.length ? <CardRow cards={cards} size="xs" /> : undefined}
                    icon={cards.length ? undefined : 'albums-outline'}
                    title={hd.title || hd.game.name || t('Mão')}
                    subtitle={[hd.game.venue, shortDate(hd.createdAt)].filter(Boolean).join(' · ')}
                    right={<Check on={on} />}
                    chevron={false}
                    onPress={() => toggle('hands', hd.id)}
                  />
                );
              })}
            </ListGroup>
          ) : (
            <Card style={{ alignItems: 'center', gap: 4 }}>
              <T v="small" style={{ textAlign: 'center' }}>
                {t('Ainda não partilhaste nenhuma mão. Abre uma mão e toca em Partilhar.')}
              </T>
            </Card>
          )}
        </Section>

        <Section title={t('Sessões no perfil ({n})', { n: draft.sessions.length })} hint={draft.hideAmounts ? t('Sem montantes: aparecem o torneio, o lugar e as horas.') : t('Com montantes: aparecem o resultado e o buy-in.')}>
          {finished.length ? (
            <ListGroup>
              {finished.map((s) => (
                <ListItem
                  key={s.id}
                  icon={s.kind === 'mtt' ? 'trophy-outline' : 'cash-outline'}
                  title={s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash')}
                  subtitle={[s.venue, shortDate(s.startedAt), s.finish ? `${s.finish}º` : null].filter(Boolean).join(' · ')}
                  right={<Check on={draft.sessions.includes(s.id)} />}
                  chevron={false}
                  onPress={() => toggle('sessions', s.id)}
                />
              ))}
            </ListGroup>
          ) : (
            <Card style={{ alignItems: 'center' }}>
              <T v="small" style={{ textAlign: 'center' }}>
                {t('As sessões terminadas aparecem aqui.')}
              </T>
            </Card>
          )}
        </Section>

        <View style={{ gap: S.sm }}>
          {link ? (
            <Button title={busy ? t('A guardar…') : dirty ? t('Guardar alterações') : t('Tudo guardado')} disabled={busy || !dirty || !handleOk} onPress={save} />
          ) : (
            <Button title={busy ? t('A criar…') : t('Criar perfil público')} icon="globe-outline" disabled={busy || !handleOk} onPress={save} />
          )}
          <T v="tiny" style={{ textAlign: 'center' }}>
            {t('Qualquer pessoa com o link vê o que escolheste. Podes mudar ou apagar quando quiseres.')}
          </T>
        </View>

        {link ? (
          <ListGroup>
            <ListItem icon="trash-outline" title={t('Apagar perfil')} destructive onPress={remove} />
          </ListGroup>
        ) : null}
      </ScrollView>
    </>
  );
}

function Check({ on }: { on: boolean }) {
  return <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.accent : C.muted} accessibilityLabel={on ? t('No perfil') : t('Fora do perfil')} />;
}
