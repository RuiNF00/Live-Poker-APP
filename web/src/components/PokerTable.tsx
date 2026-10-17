'use client';

import { actionLabel, formatAmount, type AmountMode, type ReplayStep, type SeatState } from '@livepoker/hand-format';
import type { Locale } from '@/lib/i18n';
import { PlayingCard } from './PlayingCard';

interface Props {
  step: ReplayStep;
  tableSize: number;
  bb: number;
  mode: AmountMode;
  locale: Locale;
  potLabel: string;
}

/** Seat coordinates (percent of the felt), on the rail, rotated so the hero sits at the bottom. */
function seatLayout(seats: SeatState[], tableSize: number) {
  const size = Math.max(tableSize, seats.length, 2);
  const anchor = seats.find((s) => s.isHero)?.seat ?? seats[0].seat;
  return new Map(
    seats.map((s) => {
      const offset = (((s.seat - anchor) % size) + size) % size;
      const angle = Math.PI / 2 + (offset * 2 * Math.PI) / size;
      return [
        s.seat,
        {
          x: 50 + 49 * Math.cos(angle),
          y: 50 + 50 * Math.sin(angle),
          bx: 50 + 31 * Math.cos(angle),
          by: 50 + 30 * Math.sin(angle),
        },
      ];
    }),
  );
}

export function PokerTable({ step, tableSize, bb, mode, locale, potLabel }: Props) {
  const layout = seatLayout(step.seats, tableSize);
  const winners = new Map((step.winners ?? []).map((w) => [w.seat, w]));
  const fmt = (n: number) => formatAmount(n, bb, mode, locale);
  const board = step.board;

  return (
    <div className="table-wrap">
      <div className="table-felt">
        <div className="table-rail" />
        <div className="board">
          <div className="pot">
            {potLabel} <strong>{fmt(step.kind === 'showdown' || step.kind === 'end' ? step.pot : step.totalPot)}</strong>
          </div>
          <div className="board-cards">
            {[0, 1, 2, 3, 4].map((i) =>
              board[i] ? (
                <PlayingCard key={`${i}-${board[i]}`} card={board[i]} size="md" />
              ) : (
                <span key={i} className="card card-md card-slot" />
              ),
            )}
          </div>
        </div>

        {step.seats.map((s) => {
          const pos = layout.get(s.seat)!;
          const acting = step.actingSeat === s.seat;
          const win = winners.get(s.seat);
          return (
            <div key={s.seat}>
              {s.committed > 0 && (
                <div className="bet" style={{ left: `${pos.bx}%`, top: `${pos.by}%` }}>
                  <span className="chip" />
                  {fmt(s.committed)}
                </div>
              )}
              <div
                className={`seat${acting ? ' seat-acting' : ''}${s.folded ? ' seat-folded' : ''}${win ? ' seat-winner' : ''}${s.isHero ? ' seat-hero' : ''}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                <div className="seat-cards">
                  {s.folded ? null : s.cards && s.showCards ? (
                    s.cards.map((c) => <PlayingCard key={c} card={c} size="sm" />)
                  ) : (
                    <>
                      <PlayingCard faceDown size="sm" />
                      <PlayingCard faceDown size="sm" />
                    </>
                  )}
                </div>
                <div className="seat-plate">
                  <div className="seat-name">
                    {s.isButton && <span className="dealer">D</span>}
                    <span className="seat-name-text">{s.name}</span>
                  </div>
                  <div className="seat-stack">
                    {s.name !== s.position && <span className="seat-pos">{s.position}</span>}
                    {s.allIn && s.stack === 0 ? 'All-in' : fmt(s.stack)}
                  </div>
                </div>
                {win ? (
                  <div className="seat-tag seat-tag-win">
                    +{fmt(win.amount)}
                    {s.handLabel ? ` · ${s.handLabel}` : ''}
                  </div>
                ) : s.handLabel && !s.folded ? (
                  <div className="seat-tag">{s.handLabel}</div>
                ) : s.lastAction ? (
                  <div className={`seat-tag seat-tag-${s.lastAction.type}`}>{actionLabel(s.lastAction.type, locale)}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
