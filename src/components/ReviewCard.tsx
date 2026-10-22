// "Rever" on the hand screen, right under the replayer: one tap marks the hand
// reviewed (or puts it in the queue), with an optional note from you or your coach.
// Opened from a queue (end of session, the Sunday notice), it then offers the next one.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { useCoach } from '@/lib/coach-api';
import { shortDate } from '@/poker/format';
import { clearReview, markPending, markReviewed, needsReview } from '@/poker/review';
import type { Hand } from '@/poker/types';
import { C, S } from '@/theme';

import { Button, Card, Field, Row, T, tap } from './ui';

export function ReviewCard({ hand, onChange, left = 0, onNext, inQueue }: { hand: Hand; onChange: (h: Hand) => void; left?: number; onNext?: () => void; inQueue?: 'all' | 'session' }) {
  // Keyed by hand id where it is used, so the draft note starts fresh per hand.
  const [note, setNote] = useState(hand.reviewNote ?? '');
  const coach = useCoach();
  const sent = useMemo(() => new Set(coach.links.flatMap((l) => l.handIds)), [coach]);
  const pending = needsReview(hand, sent);
  const reviewed = hand.review === 'reviewed';
  const saveNote = () => {
    if ((hand.reviewNote ?? '') !== note.trim()) onChange({ ...hand, reviewNote: note.trim() || undefined });
  };

  if (!pending && !reviewed) {
    return (
      <Button
        kind="secondary"
        icon="school-outline"
        title={t('Marcar para rever')}
        onPress={() => {
          tap('select');
          onChange(markPending(hand));
        }}
      />
    );
  }
  return (
    <Card tone={reviewed ? 'good' : 'warn'} style={{ gap: S.sm }}>
      <Row gap={10}>
        <Ionicons name={reviewed ? 'checkmark-circle' : 'school-outline'} size={22} color={reviewed ? C.good : C.warn} />
        <View style={{ flex: 1 }}>
          <T v="h3">{reviewed ? t('Revista') : t('Por rever')}</T>
          {reviewed && hand.reviewedAt ? (
            <T v="tiny" color={C.textDim}>
              {shortDate(hand.reviewedAt)}
            </T>
          ) : null}
        </View>
        {pending ? (
          <Button
            size="sm"
            title={t('Marcar como revista')}
            onPress={() => {
              tap('success');
              onChange(markReviewed(hand, note));
            }}
          />
        ) : (
          <Button
            size="sm"
            kind="plain"
            title={t('Voltar a rever')}
            onPress={() => {
              tap();
              onChange(markPending(hand));
            }}
          />
        )}
      </Row>
      <Field
        value={note}
        onChangeText={setNote}
        onBlur={saveNote}
        placeholder={t('O que tiraste desta mão (tu ou o coach)')}
        multiline
        maxLength={500}
      />
      {reviewed && onNext && left > 0 ? (
        <Button
          icon="arrow-forward"
          title={left === 1 ? t('Próxima mão · falta 1') : t('Próxima mão · faltam {n}', { n: left })}
          onPress={() => {
            saveNote();
            onNext();
          }}
        />
      ) : reviewed && inQueue && left === 0 ? (
        <T v="small" color={C.good}>
          {inQueue === 'session' ? t('Revistas todas as mãos marcadas nesta sessão.') : t('Já não tens mãos para rever.')}
        </T>
      ) : null}
      {pending ? (
        <Button
          size="sm"
          kind="plain"
          title={t('Tirar da lista')}
          style={{ alignSelf: 'flex-start' }}
          onPress={() => {
            tap();
            onChange(clearReview(hand));
          }}
        />
      ) : null}
    </Card>
  );
}
