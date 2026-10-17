import React, { useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { postComment, type Comment } from '@/lib/share-api';
import { shortDate, timeOf } from '@/poker/format';
import { C, R, S } from '@/theme';

import { Avatar } from './Avatar';
import { Button, Card, Field, Row, T } from './ui';

export function CommentsList({
  shareId,
  comments,
  onPosted,
  defaultName = '',
}: {
  shareId: string;
  comments: Comment[];
  onPosted: (c: Comment) => void;
  defaultName?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const c = await postComment(shareId, { name: name.trim() || t('Anónimo'), text: text.trim() });
      onPosted(c);
      setText('');
    } catch (e) {
      setErr(e instanceof Error && e.message === 'offensive' ? t('Comentário recusado: linguagem ofensiva.') : t('Não deu para enviar. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: S.sm }}>
      {comments.length === 0 ? (
        <Card tone="inset" style={{ alignItems: 'center', paddingVertical: S.lg }}>
          <T v="small">{t('Ainda sem comentários. Sê o primeiro a dar a tua opinião.')}</T>
        </Card>
      ) : null}
      {comments.map((c) => (
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
          </View>
        </Row>
      ))}
      <Card style={{ gap: S.sm, marginTop: S.xs }}>
        <Field value={name} onChangeText={setName} placeholder={t('O teu nome')} />
        <Field value={text} onChangeText={setText} placeholder={t('O que fazias? Fold, call, shove…')} multiline inputStyle={{ minHeight: 72 }} />
        {err ? (
          <T v="small" color={C.danger}>
            {err}
          </T>
        ) : null}
        <Button size="md" icon="send" title={busy ? t('A enviar…') : t('Comentar')} disabled={busy || !text.trim()} onPress={send} />
      </Card>
    </View>
  );
}
