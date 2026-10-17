import React, { useState } from 'react';
import { TextInput, View } from 'react-native';

import { postComment, type Comment } from '@/lib/share-api';
import { shortDate, timeOf } from '@/poker/format';
import { C, R } from '@/theme';

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
      const c = await postComment(shareId, { name: name.trim() || 'Anónimo', text: text.trim() });
      onPosted(c);
      setText('');
    } catch {
      setErr('Não deu para enviar. Tenta outra vez.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {comments.length === 0 ? <T v="small">Ainda sem comentários. Sê o primeiro a dar a tua opinião.</T> : null}
      {comments.map((c) => (
        <View key={c.id} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 10, gap: 3, borderWidth: 1, borderColor: C.border }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="small" style={{ color: C.text, fontWeight: '800' }}>
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
        <TextInput value={name} onChangeText={setName} placeholder="O teu nome" placeholderTextColor={C.muted} style={inputStyle} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="O que fazias? Fold, call, shove…"
          placeholderTextColor={C.muted}
          multiline
          style={[inputStyle, { minHeight: 64, textAlignVertical: 'top' }]}
        />
        {err ? <T v="small" color={C.danger}>{err}</T> : null}
        <Button title={busy ? 'A enviar…' : 'Comentar'} disabled={busy || !text.trim()} onPress={send} />
      </View>
    </View>
  );
}
