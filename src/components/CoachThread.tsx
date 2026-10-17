// The coach's comments on one hand (from private coaching links), with the player's replies.

import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { lang, t } from '@/i18n';
import { commentsForHand, linkStatus, type CoachComment, type CoachLink, type Mark } from '@/lib/coach-core';
import { markCoachSeen, replyToCoach, useCoach } from '@/lib/coach-api';
import { stepLabeller } from '@/lib/coach-steps';
import { shortDate, timeOf } from '@/poker/format';
import type { Hand } from '@/poker/types';
import { C, R, S } from '@/theme';

import { Avatar } from './Avatar';
import { Button, Card, Field, Pill, Row, Section, T, tap } from './ui';

const MARK: Record<Mark, { label: string; color: string }> = {
  good: { label: 'Boa linha', color: C.good },
  mistake: { label: 'Erro', color: C.bad },
  question: { label: 'Pergunta', color: C.warn },
};

export function CoachThread({ hand, name }: { hand: Hand; name: string }) {
  const coach = useCoach();
  const items = useMemo(() => commentsForHand(coach, hand.id), [coach, hand.id]);
  const label = useMemo(() => stepLabeller(hand, lang === 'pt' ? 'pt' : 'en'), [hand]);
  // Unread comments keep their "Novo" tag while the screen is up; they count as read once the player leaves.
  const fresh = useMemo(() => {
    const seen = new Set(coach.seen);
    return new Set(items.filter((x) => x.comment.author === 'coach' && !seen.has(x.comment.id)).map((x) => x.comment.id));
  }, [items, coach.seen]);
  useEffect(() => () => void markCoachSeen(hand.id), [hand.id]);

  const live = useMemo(() => coach.links.filter((l) => l.handIds.includes(hand.id) && linkStatus(l) === 'live'), [coach.links, hand.id]);
  const [replyTo, setReplyTo] = useState<{ link: CoachLink; comment: CoachComment } | null>(null);
  const [text, setText] = useState('');

  if (!items.length) return null;

  const target = replyTo && live.some((l) => l.token === replyTo.link.token) ? replyTo : null;
  const linkForReply = target?.link ?? live[0];
  const send = () => {
    if (!linkForReply || !text.trim()) return;
    tap('medium');
    replyToCoach(linkForReply.token, hand.id, target?.comment.stepIndex ?? null, name, text);
    setText('');
    setReplyTo(null);
  };

  return (
    <Section title={t('Comentários do coach')}>
      {items.map(({ link, comment: c }) => {
        const mark = c.mark ? MARK[c.mark] : null;
        const at = label(c.stepIndex);
        const mine = c.author === 'player';
        return (
          <Row key={c.id} gap={10} style={{ alignItems: 'flex-start', marginLeft: mine ? S.xl : 0 }}>
            <Avatar name={c.name} size={30} />
            <View style={{ flex: 1, backgroundColor: mine ? C.surface2 : C.surface, borderRadius: R.md, borderTopLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 12, gap: 6, borderWidth: 1, borderColor: fresh.has(c.id) ? C.accentLine : C.border }}>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                <T v="h3" style={{ fontSize: 14 }}>
                  {c.name}
                </T>
                {mark ? <Pill label={t(mark.label)} color={mark.color} /> : null}
                {fresh.has(c.id) ? <Pill label={t('Novo')} color={C.accent} /> : null}
                <T v="monoS" style={{ marginLeft: 'auto' }}>
                  {c.pending ? t('A enviar…') : c.id.endsWith('-unsent') ? t('Não enviado') : `${shortDate(Date.parse(c.createdAt))} ${timeOf(Date.parse(c.createdAt))}`}
                </T>
              </Row>
              {at ? (
                <T v="small" color={C.info} numberOfLines={2}>
                  ▶ {at}
                </T>
              ) : null}
              <T v="body">{c.body}</T>
              {!mine && live.some((l) => l.token === link.token) ? (
                <T
                  v="small"
                  color={C.accent}
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    setReplyTo({ link, comment: c });
                  }}
                  style={{ alignSelf: 'flex-start', paddingVertical: 2 }}>
                  {t('Responder')}
                </T>
              ) : null}
            </View>
          </Row>
        );
      })}
      {linkForReply ? (
        <Card style={{ gap: S.sm, marginTop: S.xs }}>
          {target ? (
            <Row gap={6}>
              <T v="small" numberOfLines={1} style={{ flex: 1 }}>
                {t('A responder a {name}', { name: target.comment.name })}
                {label(target.comment.stepIndex) ? ` · ${label(target.comment.stepIndex)}` : ''}
              </T>
              <T v="small" color={C.muted} accessibilityRole="button" onPress={() => setReplyTo(null)}>
                {t('Cancelar')}
              </T>
            </Row>
          ) : null}
          <Field value={text} onChangeText={setText} placeholder={t('Responde ao coach…')} multiline maxLength={2000} inputStyle={{ minHeight: 64 }} />
          <Button size="md" icon="send" title={t('Responder')} disabled={!text.trim()} onPress={send} />
        </Card>
      ) : (
        <T v="tiny" style={{ paddingHorizontal: 4 }}>
          {t('O link deste coach já está desligado. Os comentários ficam guardados aqui.')}
        </T>
      )}
    </Section>
  );
}
