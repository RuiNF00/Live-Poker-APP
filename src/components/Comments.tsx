import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { postComment, reportComment, type Comment } from '@/lib/share-api';
import { shortDate, timeOf } from '@/poker/format';
import type { Street } from '@/poker/types';
import { BRAND, C, F, R, S } from '@/theme';

import { Avatar } from './Avatar';
import { Button, Card, Field, Row, T } from './ui';

const STREET_NAME: Record<Street, string> = { preflop: t('Pré-flop'), flop: 'Flop', turn: 'Turn', river: 'River' };

/**
 * Comments on a shared hand. Given the streets the hand reached, they're grouped by street like
 * the conversation at the table: the whole hand first, then each street, with the street the
 * replayer is on marked "you are here". There the player also keeps a private note per street.
 */
export function CommentsList({
  shareId,
  comments,
  onPosted,
  defaultName = '',
  streets,
  street,
  onJumpStreet,
  notes,
  onNote,
  onRemove,
}: {
  shareId: string;
  comments: Comment[];
  onPosted: (c: Comment) => void;
  defaultName?: string;
  /** Streets the hand reached; turns on grouping by street. */
  streets?: Street[];
  /** The street on screen in the replayer. */
  street?: Street;
  onJumpStreet?: (s: Street) => void;
  /** Private notes per street (never shared). */
  notes?: Partial<Record<Street, string>>;
  onNote?: (s: Street, text: string) => void;
  /** Given on the owner's own hand: each comment offers "Apagar" instead of "Denunciar". */
  onRemove?: (c: Comment) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [onStreet, setOnStreet] = useState(true);
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  const report = (id: string) => {
    setReported((r) => new Set(r).add(id));
    reportComment(shareId, id).catch(() => {});
  };
  const grouped = !!streets && streets.length > 0;
  const about = grouped && onStreet && street ? street : undefined;
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const c = await postComment(shareId, { name: name.trim() || t('Anónimo'), text: text.trim(), ...(about ? { street: about } : {}) });
      onPosted({ ...c, street: c.street ?? about ?? null });
      setText('');
    } catch (e) {
      setErr(e instanceof Error && e.message === 'offensive' ? t('Comentário recusado: linguagem ofensiva.') : t('Não deu para enviar. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  const groups: { street: Street | null; items: Comment[] }[] = grouped
    ? [
        { street: null, items: comments.filter((c) => !c.street) },
        ...streets!.map((st) => ({ street: st as Street | null, items: comments.filter((c) => c.street === st) })),
      ].filter((g) => g.items.length > 0 || (g.street && (g.street === street || notes?.[g.street]?.trim())))
    : [{ street: null, items: comments }];

  return (
    <View style={{ gap: S.sm }}>
      {comments.length === 0 && !grouped ? (
        <Card tone="inset" style={{ alignItems: 'center', paddingVertical: S.lg }}>
          <T v="small">{t('Ainda sem comentários. Sê o primeiro a dar a tua opinião.')}</T>
        </Card>
      ) : null}
      {groups.map((g) => {
        const here = !!g.street && g.street === street;
        return (
          <View key={g.street ?? 'hand'} style={grouped ? { gap: S.sm, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: here ? C.accent : C.border } : { gap: S.sm }}>
            {grouped ? (
              <Pressable
                disabled={!g.street}
                onPress={() => g.street && onJumpStreet?.(g.street)}
                accessibilityRole="button"
                accessibilityLabel={g.street ? `${STREET_NAME[g.street]}${here ? `, ${t('estás aqui')}` : ''}` : t('A mão toda')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}>
                <T v="label" color={C.text}>
                  {g.street ? STREET_NAME[g.street].toUpperCase() : t('A MÃO TODA')}
                </T>
                {here ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: R.pill, backgroundColor: C.accentSoft }}>
                    <T v="tiny" color={C.accent}>
                      {t('Estás aqui')}
                    </T>
                  </View>
                ) : null}
                {g.items.length ? <T v="monoS">{g.items.length}</T> : null}
              </Pressable>
            ) : null}
            {g.street && onNote ? <StreetNote key={g.street} street={g.street} value={notes?.[g.street] ?? ''} editable={here} onSave={(v) => onNote(g.street!, v)} /> : null}
            {grouped && here && g.items.length === 0 ? <T v="small">{t('Ainda nada sobre esta rua.')}</T> : null}
            {g.items.map((c) => (
              <Row key={c.id} gap={10} style={{ alignItems: 'flex-start' }}>
                <Avatar name={c.name} size={32} />
                <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, borderTopLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 12, gap: 3, borderWidth: 1, borderColor: C.border }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="h3" style={{ fontSize: 14 }}>
                      {c.name}
                    </T>
                    <T v="monoS">
                      {shortDate(c.createdAt)} {timeOf(c.createdAt)}
                    </T>
                  </Row>
                  <T v="body">{c.text}</T>
                  {onRemove ? (
                    <Pressable
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('Apagar comentário de')} ${c.name}`}
                      onPress={() => onRemove(c)}
                      style={{ alignSelf: 'flex-end', minHeight: 24, justifyContent: 'center' }}>
                      <T v="tiny" color={C.muted}>
                        {t('Apagar')}
                      </T>
                    </Pressable>
                  ) : (
                  <Pressable
                    disabled={reported.has(c.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={reported.has(c.id) ? t('Comentário denunciado') : `${t('Denunciar comentário de')} ${c.name}`}
                    onPress={() => report(c.id)}
                    style={{ alignSelf: 'flex-end', minHeight: 24, justifyContent: 'center' }}>
                    <T v="tiny" color={C.muted}>
                      {reported.has(c.id) ? t('Denunciado. Obrigado.') : t('Denunciar')}
                    </T>
                  </Pressable>
                  )}
                </View>
              </Row>
            ))}
          </View>
        );
      })}
      <Card style={{ gap: S.sm, marginTop: S.xs }}>
        <Field value={name} onChangeText={setName} placeholder={t('O teu nome')} />
        <Field value={text} onChangeText={setText} placeholder={t('O que fazias? Fold, call, shove…')} multiline inputStyle={{ minHeight: 72 }} />
        {grouped && street ? (
          <Pressable onPress={() => setOnStreet((x) => !x)} accessibilityRole="checkbox" accessibilityState={{ checked: onStreet }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 }}>
            <Ionicons name={onStreet ? 'checkbox' : 'square-outline'} size={20} color={onStreet ? C.accent : C.muted} />
            <T v="small">
              {t('Sobre o')} <T v="small" color={C.text}>{STREET_NAME[street]}</T>
            </T>
          </Pressable>
        ) : null}
        {err ? (
          <T v="small" color={C.danger}>
            {err}
          </T>
        ) : null}
        <Button size="md" icon="send" title={busy ? t('A enviar…') : t('Comentar')} disabled={busy || !text.trim()} onPress={send} />
        <T v="tiny" color={C.muted} style={{ textAlign: 'center' }}>
          {t('Ao comentar aceitas os')}{' '}
          <T v="tiny" color={C.accent} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/terms`).catch(() => {})}>
            {t('Termos')}
          </T>
        </T>
      </Card>
    </View>
  );
}

/** The player's own note on a street: editable while that street is on screen, saved on blur. */
function StreetNote({ street, value, editable, onSave }: { street: Street; value: string; editable: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  if (!editable && !value.trim()) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: editable ? 'center' : 'flex-start', paddingHorizontal: 12, paddingVertical: editable ? 2 : 8, borderRadius: R.md, backgroundColor: C.bgDeep, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' }}>
      <Ionicons name="lock-closed" size={13} color={C.textDim} />
      {editable ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={() => draft !== value && onSave(draft.trim())}
          placeholder={t('Nota privada sobre o {s} (só tu vês)').replace('{s}', STREET_NAME[street])}
          placeholderTextColor={C.muted}
          selectionColor={C.accent}
          multiline
          accessibilityLabel={t('Nota privada')}
          style={{ flex: 1, minHeight: 40, paddingVertical: 10, color: C.text, fontFamily: F.regular, fontSize: 14 }}
        />
      ) : (
        <T v="small" color={C.text} style={{ flex: 1 }}>
          {value}
        </T>
      )}
    </View>
  );
}

/** The player's private notes per street, for a hand that isn't shared: the street on screen is editable. */
export function PrivateStreetNotes({
  streets,
  street,
  onJumpStreet,
  notes,
  onNote,
}: {
  streets: Street[];
  street: Street;
  onJumpStreet: (s: Street) => void;
  notes?: Partial<Record<Street, string>>;
  onNote: (s: Street, text: string) => void;
}) {
  return (
    <View style={{ gap: S.sm }}>
      {streets
        .filter((st) => st === street || notes?.[st]?.trim())
        .map((st) => {
          const here = st === street;
          return (
            <View key={st} style={{ gap: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: here ? C.accent : C.border }}>
              <Pressable onPress={() => onJumpStreet(st)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}>
                <T v="label" color={C.text}>
                  {STREET_NAME[st].toUpperCase()}
                </T>
                {here ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: R.pill, backgroundColor: C.accentSoft }}>
                    <T v="tiny" color={C.accent}>
                      {t('Estás aqui')}
                    </T>
                  </View>
                ) : null}
              </Pressable>
              <StreetNote key={st} street={st} value={notes?.[st] ?? ''} editable={here} onSave={(v) => onNote(st, v)} />
            </View>
          );
        })}
    </View>
  );
}
