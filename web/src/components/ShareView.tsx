'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ActionType, type AmountMode, type HandRecord, type ReplayStep } from '@livepoker/hand-format';
import { buildReplay, describeStep, formatAmount, streetLabel } from '@/lib/hand-i18n';
import { t, type Locale } from '@/lib/i18n';
import type { HandComment, QuizSpot } from '@/lib/types';
import { PokerTable } from './PokerTable';
import { PlayingCard } from './PlayingCard';
import { Comments } from './Comments';
import { Quiz } from './Quiz';
import { AppCta } from './AppCta';
import { readLocal, voterId, writeLocal } from '@/lib/local';
import { track } from '@/lib/track';

interface Props {
  shareId: string;
  hand: HandRecord;
  /** `hand` stops at the challenge decision; the whole hand comes back with the vote. */
  teaser?: boolean;
  title: string | null;
  revealAll: boolean;
  quiz: QuizSpot | null;
  allowComments: boolean;
  initialComments: HandComment[];
  viewCount: number;
  locale: Locale;
  shareUrl: string;
  /** Sharer's referral code, when the link carries one. */
  invite?: string | null;
  /** How the friend got here (from the app's share link), carried to the store badges. */
  utm?: { source: string; medium: string };
}

const PLAY_MS = 1100;

export function ShareView(props: Props) {
  const { locale, quiz } = props;
  const [hand, setHand] = useState(props.hand);
  const [revealed, setRevealed] = useState(!props.teaser);
  const d = t(locale);
  const steps = useMemo(() => buildReplay(hand, { revealAll: props.revealAll, locale }), [hand, props.revealAll, locale]);
  const quizStep = useMemo(
    () => (quiz ? steps.findIndex((s) => s.action && s.street === quiz.street && s.action.index === quiz.actionIndex) : -1),
    [steps, quiz],
  );
  // A challenge opens straight on hero's decision: the table as it stands, question on screen.
  const [index, setIndex] = useState(quizStep > 0 ? quizStep - 1 : 0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<AmountMode>('chips');
  const [comments, setComments] = useState(props.initialComments);

  /** The whole hand arrived with a vote: replay it, and load the comments the page held back. */
  const reveal = useCallback(
    (full: HandRecord) => {
      if (revealed) return;
      setHand(full);
      setRevealed(true);
      if (props.allowComments)
        fetch(`/api/hands/${props.shareId}/comments`)
          .then((r) => r.json())
          .then((j) => setComments(j.comments ?? []))
          .catch(() => {});
    },
    [revealed, props.allowComments, props.shareId],
  );
  const [quizState, setQuizState] = useState<'pending' | 'open' | 'done'>(quizStep > 0 ? 'open' : 'pending');
  // Until the friend has voted, nothing may give the answer away: notes, tags, later actions, comments.
  const quizHidesSpoilers = quizStep > 0 && quizState !== 'done';

  useEffect(() => {
    const saved = readLocal<AmountMode>('amountMode');
    if (saved === 'bb' || saved === 'chips') setMode(saved);
    track('share_viewed', { shareId: props.shareId });
    const voted = !!readLocal<string>(`quiz:${props.shareId}`);
    if (voted) {
      setQuizState('done');
      setIndex(0);
    } else if (quizStep > 0) return; // waiting on the friend's vote
    // Friends open the link from a chat: start playing right away.
    const id = setTimeout(() => setPlaying(true), 700);
    return () => clearTimeout(id);
  }, [props.shareId, quizStep]);

  // Back after voting on a challenge: the same vote again (the server keeps one per voter)
  // brings the whole hand.
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    const choice = readLocal<string>(`quiz:${props.shareId}`);
    if (!props.teaser || !choice) return;
    fetch(`/api/hands/${props.shareId}/vote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voterId: voterId(), choice }),
    })
      .then((r) => r.json())
      .then((j) => j.hand && revealRef.current(j.hand as HandRecord))
      .catch(() => {});
  }, [props.shareId, props.teaser]);

  /** Moves to a step, stopping at the quiz spot the first time it is reached. */
  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(steps.length - 1, next));
      if (quizStep > 0 && quizState !== 'done' && target >= quizStep) {
        setIndex(quizStep - 1);
        setPlaying(false);
        setQuizState('open');
        return;
      }
      setIndex(target);
    },
    [steps.length, quizStep, quizState],
  );

  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (!playing) return;
    if (index >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => goTo(indexRef.current + 1), steps[index + 1]?.kind === 'street' ? PLAY_MS * 1.3 : PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, index, steps, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') goTo(indexRef.current + 1);
      else if (e.key === 'ArrowLeft') goTo(indexRef.current - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else return;
      if (e.key !== ' ') setPlaying(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);

  const toggleMode = () => {
    const next = mode === 'chips' ? 'bb' : 'chips';
    setMode(next);
    writeLocal('amountMode', next);
  };

  const step = steps[index];
  const bb = hand.blinds.bb;
  const streetStarts = useMemo(
    () => steps.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'street' || s.kind === 'start'),
    [steps],
  );
  const commentSteps = new Set(comments.map((c) => c.stepIndex).filter((x): x is number => x !== null));

  const replayer = useRef<HTMLElement>(null);
  const finishQuiz = () => {
    // The vote panel goes away: put the table back on screen for the reveal.
    replayer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setQuizState('done');
    setIndex(quizStep);
    setTimeout(() => setPlaying(true), 900);
  };

  return (
    <main className="page">
      <Header {...props} hand={hand} spoilers={!quizHidesSpoilers} />

      <section className="replayer" aria-label="Replayer" ref={replayer}>
        <PokerTable step={step} tableSize={hand.tableSize} bb={bb} mode={mode} locale={locale} potLabel={d.pot} />

        <div className="step-line" aria-live="polite">
          <span className={`street-pill street-${step.street}`}>{streetLabel(step.street, locale)}</span>
          <span className="step-text">{describeStep(step, bb, mode, locale)}</span>
        </div>

        {quizState === 'open' && quizStep > 0 && (
          <Quiz
            shareId={props.shareId}
            step={steps[quizStep]}
            bb={bb}
            mode={mode}
            locale={locale}
            onDone={finishQuiz}
            onHand={reveal}
            hideAnswer={!revealed}
          />
        )}

        {index === steps.length - 1 && !playing && quizState !== 'open' && (
          <EndCard locale={locale} allowComments={props.allowComments} />
        )}

        <div className="scrub">
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              goTo(Number(e.target.value));
            }}
            aria-label="Passo"
          />
          <div className="scrub-marks">
            {[...commentSteps].map((i) => (
              <span key={i} className="scrub-mark" style={{ left: `${(i / (steps.length - 1)) * 100}%` }} />
            ))}
          </div>
        </div>

        <div className="controls">
          <button className="ctl" onClick={() => { setPlaying(false); setIndex(0); }} aria-label={d.restart}>
            <Icon name="first" />
          </button>
          <button className="ctl" onClick={() => { setPlaying(false); goTo(index - 1); }} aria-label={d.prev}>
            <Icon name="prev" />
          </button>
          <button
            className="ctl ctl-main"
            onClick={() => {
              if (index >= steps.length - 1) setIndex(0);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? d.pause : d.play}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button className="ctl" onClick={() => { setPlaying(false); goTo(index + 1); }} aria-label={d.next}>
            <Icon name="next" />
          </button>
          <button className="ctl" onClick={() => { setPlaying(false); goTo(steps.length - 1); }} aria-label={d.end}>
            <Icon name="last" />
          </button>
          <button className="ctl ctl-text" onClick={toggleMode}>
            {mode === 'chips' ? 'BB' : '#'}
          </button>
        </div>

        <div className="streets">
          {streetStarts.map(({ s, i }) => (
            <button
              key={i}
              className={`street-jump${step.street === s.street ? ' active' : ''}`}
              onClick={() => {
                setPlaying(false);
                goTo(i);
              }}
            >
              {streetLabel(s.street, locale)}
            </button>
          ))}
        </div>
      </section>

      <div className="below">
        <ShareButtons url={props.shareUrl} locale={locale} title={props.title} />
      </div>

      <ActionLog
        steps={quizHidesSpoilers ? steps.slice(0, quizStep) : steps}
        index={index}
        bb={bb}
        mode={mode}
        locale={locale}
        onPick={(i) => {
          setPlaying(false);
          goTo(i);
        }}
      />

      {props.allowComments && quizHidesSpoilers && (
        <section className="comments" id="comments">
          <h2 className="section-title">{d.comments}</h2>
          <p className="muted">{d.voteToSeeComments}</p>
        </section>
      )}

      {props.allowComments && !quizHidesSpoilers && (
        <Comments
          shareId={props.shareId}
          comments={comments}
          onAdded={(c) => setComments((cs) => [...cs, c])}
          steps={steps}
          currentStep={index}
          bb={bb}
          mode={mode}
          locale={locale}
          onJump={(i) => {
            setPlaying(false);
            goTo(i);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      <ReportHand shareId={props.shareId} locale={locale} />

      <AppCta locale={locale} shareId={props.shareId} hideSticky={quizState === 'open' && quizStep > 0} invite={props.invite ?? null} utm={props.utm ?? { source: 'share', medium: 'hand' }} />
    </main>
  );
}

/** The hand just ended: the friend's attention peaks here, so ask for a reply and show the app. */
function EndCard({ locale, allowComments }: { locale: Locale; allowComments: boolean }) {
  const d = t(locale);
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="end-card">
      <div className="end-title">{d.endTitle}</div>
      <div className="end-actions">
        {allowComments && (
          <button className="btn btn-ghost btn-sm" onClick={() => scroll('comments')}>
            {d.endComment}
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => scroll('app')}
        >
          {d.endApp}
        </button>
      </div>
    </div>
  );
}

function Header({ hand, title, locale, viewCount, spoilers }: Props & { spoilers: boolean }) {
  const d = t(locale);
  const tour = hand.tournament;
  const stakes = `${formatAmount(hand.blinds.sb, hand.blinds.bb, 'chips', locale)}/${formatAmount(hand.blinds.bb, hand.blinds.bb, 'chips', locale)}${
    hand.blinds.ante ? ` · ante ${formatAmount(hand.blinds.ante, hand.blinds.bb, 'chips', locale)}` : ''
  }`;
  const meta = [
    hand.format === 'tournament' ? tour?.name || d.tournament : d.cash,
    tour?.level ? `${d.level} ${tour.level}` : null,
    stakes,
    tour?.stage ? d.stage[tour.stage] : null,
    tour?.playersLeft ? `${tour.playersLeft} ${d.playersLeft}${tour.paidPlaces ? ` · ${tour.paidPlaces} ${d.paid}` : ''}` : null,
  ].filter(Boolean);

  return (
    <header className="hand-head">
      <div className="hand-kicker">
        <span>{d.sharedBy}</span>
        {hand.location && <span>· {hand.location}</span>}
        {viewCount > 0 && (
          <span>
            · {viewCount} {d.views}
          </span>
        )}
      </div>
      <h1 className="hand-title">{title || (hand.game === 'PLO' ? 'PLO' : "Hold'em")}</h1>
      <div className="hand-meta">{meta.join(' · ')}</div>
      {spoilers && !!hand.tags?.length && (
        <div className="tags">
          {hand.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      {spoilers && hand.notes && (
        <blockquote className="notes">
          <span className="notes-label">{d.notes}</span>
          {hand.notes}
        </blockquote>
      )}
    </header>
  );
}

function ShareButtons({ url, locale, title }: { url: string; locale: Locale; title: string | null }) {
  const d = t(locale);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== 'undefined' && !!navigator.share), []);
  return (
    <div className="share-row">
      {canShare && (
        <button className="btn btn-ghost" onClick={() => navigator.share({ url, title: title ?? undefined }).catch(() => {})}>
          {d.shareNative}
        </button>
      )}
      <button
        className="btn btn-ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {}
        }}
      >
        {copied ? d.copied : d.copyLink}
      </button>
    </div>
  );
}

function ReportHand({ shareId, locale }: { shareId: string; locale: Locale }) {
  const d = t(locale);
  const [done, setDone] = useState(false);
  return (
    <div className="report-hand">
      {done ? (
        <span>{d.reported}</span>
      ) : (
        <button
          className="report"
          onClick={() => {
            setDone(true);
            fetch(`/api/hands/${shareId}/report`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ reporterId: voterId() }),
            }).catch(() => {});
          }}
        >
          {d.reportHand}
        </button>
      )}
    </div>
  );
}

function ActionLog({
  steps,
  index,
  bb,
  mode,
  locale,
  onPick,
}: {
  steps: ReplayStep[];
  index: number;
  bb: number;
  mode: AmountMode;
  locale: Locale;
  onPick: (i: number) => void;
}) {
  const groups: { street: ReplayStep['street']; cards: ReplayStep['board']; at: number; items: { step: ReplayStep; i: number }[] }[] = [];
  steps.forEach((step, i) => {
    if (step.kind === 'start') return groups.push({ street: 'preflop', cards: [], at: i, items: [] });
    if (step.kind === 'street') {
      const cards = step.street === 'flop' ? step.board.slice(0, 3) : step.board.slice(-1);
      return groups.push({ street: step.street, cards, at: i, items: [] });
    }
    groups[groups.length - 1].items.push({ step, i });
  });
  return (
    <section className="log">
      {groups.map((g, gi) => (
        <div key={gi} className="log-group">
          <button className="log-street" onClick={() => onPick(g.at)}>
            {streetLabel(g.street, locale)}
            {g.cards.length > 0 && (
              <span className="log-board">
                {g.cards.map((c) => (
                  <PlayingCard key={c} card={c} size="xs" />
                ))}
              </span>
            )}
          </button>
          <ol>
            {g.items.map(({ step, i }) => (
              <li key={i}>
                <button
                  className={`log-item${i === index ? ' active' : ''}${i > index ? ' future' : ''} log-${kindClass(step)}`}
                  onClick={() => onPick(i)}
                >
                  {describeStep(step, bb, mode, locale)}
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function kindClass(step: ReplayStep): ActionType | 'street' | 'result' {
  if (step.action) return step.action.type;
  return step.kind === 'street' ? 'street' : 'result';
}

function Icon({ name }: { name: 'first' | 'prev' | 'play' | 'pause' | 'next' | 'last' }) {
  const paths: Record<string, string> = {
    first: 'M6 5h2v14H6zM20 5v14L9 12z',
    prev: 'M18 5v14L7 12z',
    play: 'M8 5v14l11-7z',
    pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
    next: 'M6 5v14l11-7z',
    last: 'M16 5h2v14h-2zM4 5v14l11-7z',
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d={paths[name]} fill="currentColor" />
    </svg>
  );
}

