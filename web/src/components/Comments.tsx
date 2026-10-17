'use client';

import { useEffect, useState } from 'react';
import { describeStep, streetLabel, type AmountMode, type ReplayStep } from '@livepoker/hand-format';
import { t, type Dict, type Locale } from '@/lib/i18n';
import type { HandComment } from '@/lib/types';
import { voteFromComment } from '@/lib/hand';
import { readLocal, voterId, writeLocal } from '@/lib/local';

interface Props {
  shareId: string;
  comments: HandComment[];
  onAdded: (c: HandComment) => void;
  steps: ReplayStep[];
  currentStep: number;
  bb: number;
  mode: AmountMode;
  locale: Locale;
  onJump: (stepIndex: number) => void;
}

function ago(ms: number, d: Dict) {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return d.justNow;
  if (min < 60) return d.minutesAgo(min);
  if (min < 60 * 24) return d.hoursAgo(Math.floor(min / 60));
  return d.daysAgo(Math.floor(min / 1440));
}

export function Comments({ shareId, comments: all, onAdded, steps, currentStep, bb, mode, locale, onJump }: Props) {
  const d = t(locale);
  // Challenge votes posted by the app as "🗳️ <choice>" comments are counted in the quiz, not listed.
  const comments = all.filter((c) => !voteFromComment(c.text));
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [attach, setAttach] = useState(true);
  const [state, setState] = useState<'idle' | 'sending' | 'error' | 'limited' | 'offensive'>('idle');
  const [reported, setReported] = useState<Set<string>>(new Set());

  const report = async (commentId: string) => {
    setReported((r) => new Set(r).add(commentId));
    await fetch(`/api/hands/${shareId}/comments/${commentId}/report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reporterId: voterId() }),
    }).catch(() => {});
  };

  useEffect(() => setName(readLocal<string>('name') ?? ''), []);

  const anchorLabel = (i: number) => {
    const s = steps[i];
    if (!s) return '';
    return s.kind === 'action' ? `${streetLabel(s.street, locale)} · ${describeStep(s, bb, mode, locale)}` : describeStep(s, bb, mode, locale);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim() || state === 'sending') return;
    setState('sending');
    writeLocal('name', name.trim());
    try {
      const res = await fetch(`/api/hands/${shareId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          text: body.trim(),
          stepIndex: attach && currentStep > 0 ? currentStep : null,
        }),
      });
      if (res.status === 429) return setState('limited');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return setState(err.error === 'offensive' ? 'offensive' : 'error');
      }
      const { comment } = await res.json();
      onAdded(comment);
      setBody('');
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <section className="comments" id="comments">
      <h2 className="section-title">
        {d.comments} {comments.length > 0 && <span className="count">{comments.length}</span>}
      </h2>
      {comments.length === 0 ? (
        <p className="muted">{d.noComments}</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <div className="comment-head">
                <span className="avatar" aria-hidden>
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <strong>{c.name}</strong>
                <span className="muted">{ago(c.createdAt, d)}</span>
                {reported.has(c.id) ? (
                  <span className="report-done">{d.reported}</span>
                ) : (
                  <button className="report" onClick={() => report(c.id)}>
                    {d.report}
                  </button>
                )}
              </div>
              {c.stepIndex !== null && steps[c.stepIndex] && (
                <button className="anchor" onClick={() => onJump(c.stepIndex!)}>
                  ▶ {anchorLabel(c.stepIndex)}
                </button>
              )}
              <p className="comment-body">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={submit}>
        <input
          className="input"
          placeholder={d.yourName}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
          required
        />
        <textarea
          className="input"
          placeholder={d.commentPlaceholder}
          value={body}
          maxLength={1000}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        {currentStep > 0 && (
          <label className="attach">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
            <span>
              {d.attachToStep}: <em>{anchorLabel(currentStep)}</em>
            </span>
          </label>
        )}
        <button className="btn btn-primary" disabled={state === 'sending'}>
          {state === 'sending' ? d.sending : d.send}
        </button>
        {state === 'error' && <p className="error">{d.commentError}</p>}
        {state === 'limited' && <p className="error">{d.rateLimited}</p>}
        {state === 'offensive' && <p className="error">{d.offensive}</p>}
      </form>
    </section>
  );
}
