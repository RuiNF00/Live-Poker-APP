import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { postComment, type Comment } from '@/lib/share-api';
import { shortDate, timeOf } from '@/poker/format';
import { C, R, ff } from '@/theme';

import { inputStyle } from './entry/ContextSheet';
import { Button, Row, T } from './ui';

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
    <View style={{ gap: 8 }}>
      {comments.length === 0 ? <T v="small">{t('Ainda sem comentários. Sê o primeiro a dar a tua opinião.')}</T> : null}
      {comments.map((c) => (
        <View key={c.id} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 10, gap: 3, borderWidth: 1, borderColor: C.border }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="small" style={{ color: C.text, fontWeight: '800', fontFamily: ff(800) }}>
              {c.name}
            </T>
            <T v="tiny">
              {shortDate(c.createdAt)} {timeOf(c.createdAt)}
            </T>
          </Row>
          <T v="body" style={{ lineHeight: 20 }}>
            {c.text}
          </T>
        </View>
      ))}
      <View style={{ gap: 6 }}>
        <TextInput value={name} onChangeText={setName} placeholder={t('O teu nome')} placeholderTextColor={C.muted} style={inputStyle} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('O que fazias? Fold, call, shove…')}
          placeholderTextColor={C.muted}
          multiline
          style={[inputStyle, { minHeight: 64, textAlignVertical: 'top' }]}
        />
        {err ? <T v="small" color={C.danger}>{err}</T> : null}
        <Button title={busy ? t('A enviar…') : t('Comentar')} disabled={busy || !text.trim()} onPress={send} />
      </View>
    </View>
  );
}
