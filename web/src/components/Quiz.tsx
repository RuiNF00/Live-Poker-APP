'use client';

import { useEffect, useRef, useState } from 'react';
import type { AmountMode, HandRecord, ReplayStep } from '@livepoker/hand-format';
import { actionLabel, formatAmount } from '@/lib/hand-i18n';
import { t, type Locale } from '@/lib/i18n';
import type { VoteChoice } from '@/lib/types';
import { voterId, writeLocal } from '@/lib/local';

interface Props {
  shareId: string;
  step: ReplayStep;
  bb: number;
  mode: AmountMode;
  locale: Locale;
  onDone: () => void;
  /** The whole hand, sent back with the vote (a challenge page only has it up to the decision). */
  onHand?: (hand: HandRecord) => void;
  /** The step's action is a stand-in until the whole hand arrives: don't call it the real play. */
  hideAnswer?: boolean;
}

/** "What do you do here?": friends vote before the player's real decision is revealed. */
export function Quiz({ shareId, step, bb, mode, locale, onDone, onHand, hideAnswer }: Props) {
  const d = t(locale);
  const facing = step.facing ?? 0;
  const actor = step.seats.find((s) => s.seat === step.actingSeat);
  // `step` is the hero's real action: undo what it paid to get the stack the friend decides with.
  const behind = actor ? actor.stack + (step.action?.paid ?? 0) : 0;
  // Short of a call there is no raise to make: calling is already all-in.
  const choices: VoteChoice[] =
    facing > 0 ? (behind && behind <= facing ? ['fold', 'allin'] : ['fold', 'call', 'raise', 'allin']) : ['check', 'bet', 'allin'];
  const [counts, setCounts] = useState<Partial<Record<VoteChoice, number>> | null>(null);
  const [mine, setMine] = useState<VoteChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // On a phone the question sits under the table: bring the choices on screen.
  useEffect(() => {
    const t = setTimeout(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350);
    return () => clearTimeout(t);
  }, []);

  const vote = async (choice: VoteChoice) => {
    if (busy) return;
    setBusy(true);
    setMine(choice);
    writeLocal(`quiz:${shareId}`, choice);
    try {
      const res = await fetch(`/api/hands/${shareId}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voterId: voterId(), choice }),
      });
      const data = await res.json();
      if (data.hand) onHand?.(data.hand as HandRecord);
      setCounts(data.counts ?? { [choice]: 1 });
    } catch {
      setCounts({ [choice]: 1 });
    } finally {
      setBusy(false);
    }
  };

  const total = counts ? Object.values(counts).reduce((n, v) => n + (v ?? 0), 0) : 0;
  const played = hideAnswer ? undefined : step.action?.type;

  return (
    <div className="quiz" role="dialog" aria-label={d.quizTitle} ref={box}>
      <div className="quiz-card">
        <div className="quiz-title">{d.quizTitle}</div>
        <div className="quiz-sub">
          {actor?.name}
          {actor && actor.name !== actor.position && ` (${actor.position})`}
          {actor && ` · ${formatAmount(behind, bb, mode, locale)}`}
          {facing > 0 && (
            <>
              {' · '}
              {d.quizFacing} {formatAmount(facing, bb, mode, locale)}
            </>
          )}
          {' · '}
          {d.pot} {formatAmount(step.totalPot - (step.action?.paid ?? 0), bb, mode, locale)}
        </div>
        <div className="quiz-choices">
          {choices.map((c) => {
            const n = counts?.[c] ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <button
                key={c}
                className={`quiz-choice${mine === c ? ' mine' : ''}${counts && played === c ? ' played' : ''}`}
                onClick={() => vote(c)}
                disabled={!!counts}
              >
                {counts && <span className="quiz-bar" style={{ width: `${pct}%` }} />}
                <span className="quiz-label">
                  {actionLabel(c, locale)}
                  {c === 'call' && facing > 0 && <span className="quiz-amt"> {formatAmount(Math.min(facing, behind || facing), bb, mode, locale)}</span>}
                </span>
                {counts && <span className="quiz-pct">{pct}%</span>}
              </button>
            );
          })}
        </div>
        {counts ? (
          <>
            <div className="quiz-foot">
              {played && mine ? (
                <strong className="quiz-verdict">{(mine === played ? d.quizSame : d.quizDiff)(actionLabel(played, locale))}</strong>
              ) : (
                d.quizThanks
              )}{' '}
              {total} {total === 1 ? d.quizVote : d.quizVotes}.
            </div>
            <button className="btn btn-primary quiz-go" onClick={onDone}>
              {d.quizContinue}
            </button>
          </>
        ) : (
          <button className="quiz-skip" onClick={onDone}>
            {d.quizSkip}
          </button>
        )}
      </div>
    </div>
  );
}
