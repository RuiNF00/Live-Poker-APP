'use client';

import { useState } from 'react';
import { actionLabel, formatAmount, type AmountMode, type ReplayStep } from '@livepoker/hand-format';
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
}

/** "What do you do here?": friends vote before the player's real decision is revealed. */
export function Quiz({ shareId, step, bb, mode, locale, onDone }: Props) {
  const d = t(locale);
  const facing = step.facing ?? 0;
  const choices: VoteChoice[] = facing > 0 ? ['fold', 'call', 'raise', 'allin'] : ['check', 'bet', 'allin'];
  const actor = step.seats.find((s) => s.seat === step.actingSeat);
  const [counts, setCounts] = useState<Partial<Record<VoteChoice, number>> | null>(null);
  const [mine, setMine] = useState<VoteChoice | null>(null);
  const [busy, setBusy] = useState(false);

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
      setCounts(data.counts ?? { [choice]: 1 });
    } catch {
      setCounts({ [choice]: 1 });
    } finally {
      setBusy(false);
    }
  };

  const total = counts ? Object.values(counts).reduce((n, v) => n + (v ?? 0), 0) : 0;
  const played = step.action?.type;

  return (
    <div className="quiz" role="dialog" aria-label={d.quizTitle}>
      <div className="quiz-card">
        <div className="quiz-title">{d.quizTitle}</div>
        <div className="quiz-sub">
          {actor?.name}
          {facing > 0 && (
            <>
              {' · '}
              {d.quizFacing} {formatAmount(facing, bb, mode)}
            </>
          )}
          {' · '}
          {d.pot} {formatAmount(step.totalPot - (step.action?.paid ?? 0), bb, mode)}
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
                <span className="quiz-label">{actionLabel(c, locale)}</span>
                {counts && <span className="quiz-pct">{pct}%</span>}
              </button>
            );
          })}
        </div>
        {counts ? (
          <>
            <div className="quiz-foot">
              {d.quizThanks} {total} {d.quizVotes}.
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
