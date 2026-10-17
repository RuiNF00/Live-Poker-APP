'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stakesText, type AmountMode, type HandRecord, type ReplayStep } from '@livepoker/hand-format';
import { buildReplay, describeStep, formatAmount, streetLabel } from '@/lib/hand-i18n';
import { Mark as Logo } from '@/components/Brand';
import { PokerTable } from '@/components/PokerTable';
import { PlayingCard } from '@/components/PlayingCard';
import type { CoachComment, Mark } from '@/lib/coach-data';
import { intlTag, t, type Locale } from '@/lib/i18n';
import { readLocal, writeLocal } from '@/lib/local';
import { scrollMode } from '@/lib/motion';
import { coachCopy, type CoachCopy } from './copy';
import './coach.css';

export interface CoachHand {
  id: string;
  hand: HandRecord;
  title: string;
}

interface Props {
  token: string;
  title: string;
  player: string;
  expiresAt: string | null;
  hands: CoachHand[];
  comments: CoachComment[];
  locale: Locale;
}

const MARK_ICON: Record<Mark, string> = { good: '✓', mistake: '✕', question: '?' };

/** The coach's page: every hand in the replayer, comments pinned to a street or action, lines marked good, mistake or question. */
export function CoachView(props: Props) {
  const { locale, token } = props;
  const c = coachCopy(locale);
  const [at, setAt] = useState(0);
  const [comments, setComments] = useState(props.comments);
  const [closed, setClosed] = useState(false);
  // The coach's way out: hides the link in this browser and leaves a note the player's app syncs.
  const [left, setLeft] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setLeft(readLocal<boolean>(`coachLeft.${token}`) === true), [token]);
  const leave = async () => {
    const first = props.hands[0];
    if (first && !closed) {
      await fetch(`/api/coach/${token}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handId: first.id, stepIndex: null, mark: null, name: readLocal<string>('coachName') || c.coach, body: c.leftNote }),
      }).catch(() => {});
    }
    writeLocal(`coachLeft.${token}`, true);
    setLeaving(false);
    setLeft(true);
  };
  const current = props.hands[at];
  const byHand = useMemo(() => {
    const m = new Map<string, CoachComment[]>();
    for (const x of comments) m.set(x.handId, [...(m.get(x.handId) ?? []), x]);
    return m;
  }, [comments]);

  // Open on the hand in the URL hash (#2), so a coach can send "look at #3" back.
  useEffect(() => {
    const n = Number(window.location.hash.slice(1));
    if (Number.isInteger(n) && n >= 1 && n <= props.hands.length) setAt(n - 1);
  }, [props.hands.length]);
  const pick = (i: number) => {
    setAt(i);
    window.history.replaceState(null, '', `#${i + 1}`);
    window.scrollTo({ top: 0, behavior: scrollMode() });
  };

  const expires = props.expiresAt
    ? new Date(props.expiresAt).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'long', timeZone: 'UTC' })
    : null;

  if (left) {
    return (
      <div className="cv">
        <div className="cv-top">
          <h1>{c.leftTitle}</h1>
          <p className="cv-meta">{c.leftBody}</p>
          <p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                writeLocal(`coachLeft.${token}`, false);
                setLeft(false);
              }}>
              {c.comeBack}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cv">
      <header className="cv-bar">
        <span className="cv-logo">
          <Logo size={24} />
          <b>Sweatbook</b>
        </span>
        <span className="cv-private">
          <LockIcon /> {c.privateBadge}
        </span>
      </header>

      <div className="cv-top">
        <p className="cv-kicker">{c.kicker(props.player)}</p>
        <h1>{props.title || c.kicker(props.player)}</h1>
        <p className="cv-meta">{[c.handsCount(props.hands.length), expires ? c.expires(expires) : null].filter(Boolean).join(' · ')}</p>
      </div>

      <nav className="cv-tabs" aria-label={c.handsCount(props.hands.length)}>
        {props.hands.map((h, i) => {
          const hero = h.hand.players.find((p) => p.isHero)?.cards ?? [];
          const n = byHand.get(h.id)?.length ?? 0;
          return (
            <button key={h.id} className={`cv-tab${i === at ? ' on' : ''}`} onClick={() => pick(i)} aria-current={i === at}>
              <span className="cv-tab-n">{i + 1}</span>
              <span className="cv-tab-cards">
                {hero.length ? hero.map((x) => <PlayingCard key={x} card={x} size="xs" locale={locale} />) : null}
              </span>
              {n ? <span className="cv-tab-count">{n}</span> : null}
            </button>
          );
        })}
      </nav>

      {current ? (
        <HandReview
          key={current.id}
          token={token}
          item={current}
          index={at}
          total={props.hands.length}
          comments={byHand.get(current.id) ?? []}
          onAdded={(x) => setComments((cs) => [...cs, x])}
          onClosed={() => setClosed(true)}
          onMove={(d) => pick(Math.max(0, Math.min(props.hands.length - 1, at + d)))}
          locale={locale}
          c={c}
        />
      ) : null}

      {closed ? <p className="cv-closed">{c.closed}</p> : null}
      <footer className="cv-foot">
        <p>{c.privacy}</p>
        {leaving ? (
          <p>
            {c.leaveSure}{' '}
            <button type="button" className="btn" onClick={leave}>
              {c.leaveYes}
            </button>{' '}
            <button type="button" className="btn" onClick={() => setLeaving(false)}>
              {c.leaveNo}
            </button>
          </p>
        ) : (
          <p>
            <button type="button" className="btn" onClick={() => setLeaving(true)}>
              {c.leave}
            </button>
          </p>
        )}
        <p>
          <a href="/" target="_blank" rel="noreferrer noopener">
            {c.cta}
          </a>
        </p>
      </footer>
    </div>
  );
}

function HandReview({
  token,
  item,
  index,
  total,
  comments,
  onAdded,
  onClosed,
  onMove,
  locale,
  c,
}: {
  token: string;
  item: CoachHand;
  index: number;
  total: number;
  comments: CoachComment[];
  onAdded: (x: CoachComment) => void;
  onClosed: () => void;
  onMove: (d: number) => void;
  locale: Locale;
  c: CoachCopy;
}) {
  const d = t(locale);
  const { hand } = item;
  const steps = useMemo(() => buildReplay(hand, { revealAll: true, locale }), [hand, locale]);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<AmountMode>('bb');
  const bb = hand.blinds.bb;
  const go = useCallback((i: number) => setStep(Math.max(0, Math.min(steps.length - 1, i))), [steps.length]);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const saved = readLocal<AmountMode>('amountMode');
    if (saved === 'bb' || saved === 'chips') setMode(saved);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') go(stepRef.current + 1);
      else if (e.key === 'ArrowLeft') go(stepRef.current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const s = steps[step];
  const label = (i: number) => {
    const x = steps[i];
    if (!x) return '';
    return x.kind === 'action' ? `${streetLabel(x.street, locale)} · ${describeStep(x, bb, mode, locale)}` : describeStep(x, bb, mode, locale);
  };
  const marksAt = useMemo(() => {
    const m = new Map<number, Mark | 'note'>();
    for (const x of comments) if (x.stepIndex !== null && !m.has(x.stepIndex)) m.set(x.stepIndex, x.mark ?? 'note');
    return m;
  }, [comments]);
  const sorted = useMemo(() => [...comments].sort((a, b) => (a.stepIndex ?? -1) - (b.stepIndex ?? -1) || a.createdAt.localeCompare(b.createdAt)), [comments]);
  const tour = hand.tournament;
  const stakes = stakesText(hand.blinds, (n) => formatAmount(n, bb, 'chips', locale));

  return (
    <div className="cv-grid">
      <div className="cv-main">
        <div className="cv-hand-head">
          <div>
            <p className="cv-hand-n">{c.hand(index + 1)}</p>
            <h2>{item.title}</h2>
            <p className="cv-meta">{[hand.format === 'tournament' ? tour?.name || d.tournament : d.cash, tour?.level ? `${d.level} ${tour.level}` : null, stakes, hand.location].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="cv-pager">
            <button className="ctl" onClick={() => onMove(-1)} disabled={index === 0} aria-label={c.prev}>
              ‹
            </button>
            <button className="ctl" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={c.next}>
              ›
            </button>
          </div>
        </div>

        {hand.notes ? (
          <blockquote className="notes">
            <span className="notes-label">{c.notes}</span>
            {hand.notes}
          </blockquote>
        ) : null}

        <section className="replayer" aria-label="Replayer">
          <PokerTable step={s} tableSize={hand.tableSize} bb={bb} mode={mode} locale={locale} potLabel={d.pot} />
          <div className="step-line" aria-live="polite">
            <span className={`street-pill street-${s.street}`}>{streetLabel(s.street, locale)}</span>
            <span className="step-text">{describeStep(s, bb, mode, locale)}</span>
          </div>
          <div className="scrub">
            <input type="range" min={0} max={steps.length - 1} value={step} onChange={(e) => go(Number(e.target.value))} aria-label="Passo" />
            <div className="scrub-marks">
              {[...marksAt].map(([i, m]) => (
                <span key={i} className={`scrub-mark cv-dot-${m}`} style={{ left: `${(i / Math.max(1, steps.length - 1)) * 100}%` }} />
              ))}
            </div>
          </div>
          <div className="controls">
            <button className="ctl" onClick={() => go(0)} aria-label={d.restart}>
              ⏮
            </button>
            <button className="ctl ctl-main" onClick={() => go(step - 1)} aria-label={d.prev}>
              ◀
            </button>
            <button className="ctl ctl-main" onClick={() => go(step + 1)} aria-label={d.next}>
              ▶
            </button>
            <button className="ctl" onClick={() => go(steps.length - 1)} aria-label={d.end}>
              ⏭
            </button>
            <button
              className="ctl ctl-text"
              onClick={() => {
                const next = mode === 'chips' ? 'bb' : 'chips';
                setMode(next);
                writeLocal('amountMode', next);
              }}
            >
              {mode === 'chips' ? 'BB' : '#'}
            </button>
          </div>
        </section>

      </div>

      <aside className="cv-side">
        <Composer token={token} handId={item.id} step={step} stepLabel={label(step)} onAdded={onAdded} onClosed={onClosed} c={c} />
        <section className="cv-comments">
          <h3>
            {c.comments} {comments.length ? <span className="count">{comments.length}</span> : null}
          </h3>
          {sorted.length ? (
            <ul>
              {sorted.map((x) => (
                <li key={x.id} className={`cv-comment${x.author === 'player' ? ' player' : ''}`}>
                  <div className="cv-comment-head">
                    {x.mark ? (
                      <span className={`cv-mark cv-mark-${x.mark}`}>
                        {MARK_ICON[x.mark]} {c.marks[x.mark]}
                      </span>
                    ) : null}
                    <b>{x.author === 'player' ? `${x.name} · ${c.player}` : x.name}</b>
                  </div>
                  {x.stepIndex !== null && steps[x.stepIndex] ? (
                    <button className="anchor" onClick={() => go(x.stepIndex!)}>
                      ▶ {label(x.stepIndex)}
                    </button>
                  ) : null}
                  <p className="comment-body">{x.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{c.noComments}</p>
          )}
        </section>
      </aside>

      {/* After the comments on a phone, under the table on a desktop. */}
      <Log steps={steps} index={step} bb={bb} mode={mode} locale={locale} marks={marksAt} onPick={go} title={c.log} />
    </div>
  );
}

function Composer({
  token,
  handId,
  step,
  stepLabel,
  onAdded,
  onClosed,
  c,
}: {
  token: string;
  handId: string;
  step: number;
  stepLabel: string;
  onAdded: (x: CoachComment) => void;
  onClosed: () => void;
  c: CoachCopy;
}) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [mark, setMark] = useState<Mark | null>(null);
  const [whole, setWhole] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'error' | 'limited' | 'offensive'>('idle');
  // The name is asked once; after that the composer is just the comment.
  const [knownName, setKnownName] = useState(false);
  useEffect(() => {
    const n = readLocal<string>('coachName') ?? '';
    setName(n);
    setKnownName(!!n);
  }, []);
  const pinned = !whole && step > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim() || state === 'sending') return;
    setState('sending');
    writeLocal('coachName', name.trim());
    setKnownName(true);
    try {
      const r = await fetch(`/api/coach/${token}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handId, stepIndex: pinned ? step : null, mark, name: name.trim(), body: body.trim() }),
      });
      if (r.status === 429) return setState('limited');
      if (r.status === 404) {
        onClosed();
        return setState('error');
      }
      if (r.status === 422 && (await r.json().catch(() => null))?.error === 'offensive') return setState('offensive');
      if (!r.ok) return setState('error');
      onAdded((await r.json()).comment);
      setBody('');
      setMark(null);
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <form className="cv-compose" onSubmit={submit}>
      <div className="cv-compose-head">
        <b>{pinned ? c.composeTitle : c.composeHand}</b>
        {step > 0 ? (
          <div className="cv-seg" role="group">
            <button type="button" className={!whole ? 'on' : ''} onClick={() => setWhole(false)}>
              {c.atStep}
            </button>
            <button type="button" className={whole ? 'on' : ''} onClick={() => setWhole(true)}>
              {c.wholeHand}
            </button>
          </div>
        ) : null}
      </div>
      {pinned ? <p className="cv-at">▶ {stepLabel}</p> : null}
      <div className="cv-marks" role="radiogroup">
        {(['good', 'mistake', 'question'] as Mark[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mark === m} className={`cv-mark-btn cv-mark-${m}${mark === m ? ' on' : ''}`} onClick={() => setMark(mark === m ? null : m)}>
            {MARK_ICON[m]} {c.marks[m]}
          </button>
        ))}
      </div>
      <textarea className="input" rows={3} maxLength={2000} placeholder={c.placeholder} value={body} onChange={(e) => setBody(e.target.value)} required />
      {!knownName ? (
        <input className="input" maxLength={40} placeholder={c.yourName} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      ) : null}
      <button className="btn btn-primary" disabled={state === 'sending' || !body.trim() || !name.trim()}>
        {state === 'sending' ? c.sending : c.send}
      </button>
      {state === 'error' ? <p className="error">{c.error}</p> : null}
      {state === 'limited' ? <p className="error">{c.limited}</p> : null}
      {state === 'offensive' ? <p className="error">{c.offensive}</p> : null}
    </form>
  );
}

function Log({
  steps,
  index,
  bb,
  mode,
  locale,
  marks,
  onPick,
  title,
}: {
  steps: ReplayStep[];
  index: number;
  bb: number;
  mode: AmountMode;
  locale: Locale;
  marks: Map<number, Mark | 'note'>;
  onPick: (i: number) => void;
  title: string;
}) {
  return (
    <section className="log cv-log" aria-label={title}>
      <ol>
        {steps.map((s, i) =>
          s.kind === 'start' ? null : (
            <li key={i}>
              <button className={`log-item${i === index ? ' active' : ''}${s.kind === 'street' ? ' cv-log-street' : ''}`} onClick={() => onPick(i)}>
                {marks.has(i) ? <span className={`cv-dot cv-dot-${marks.get(i)}`} aria-hidden /> : null}
                {s.kind === 'street' ? (
                  <>
                    {streetLabel(s.street, locale)}
                    <span className="log-board">
                      {(s.street === 'flop' ? s.board.slice(0, 3) : s.board.slice(-1)).map((x) => (
                        <PlayingCard key={x} card={x} size="xs" locale={locale} />
                      ))}
                    </span>
                  </>
                ) : (
                  describeStep(s, bb, mode, locale)
                )}
              </button>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1Zm2 0h8V8a4 4 0 1 0-8 0v2Z" fill="currentColor" />
    </svg>
  );
}
