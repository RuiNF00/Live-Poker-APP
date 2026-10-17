'use client';

// The shared hand's table, drawn like the app's replayer: charcoal felt with a thin rail,
// seats and bet spots placed by hand per table size (lib/tableLayout.ts, shared with the app),
// ivory cards, chip stacks and an action badge on each plate.

import { spokenBoard, spokenSeat } from '@/lib/spoken';
import type { ActionType, AmountMode, Card, ReplayStep, SeatState } from '@livepoker/hand-format';
import { formatAmount } from '@/lib/hand-i18n';
import type { Locale } from '@/lib/i18n';
import { BOARD_Y, BRAND_Y, dealerSpot, POT_Y, STAGE_RATIO, tableMap } from '@/lib/tableLayout';
import { ChipStack } from './ChipStack';
import { SuitIcon, SUIT_COLORS } from './PlayingCard';
import { cardLabel, hiddenCardLabel } from '@/lib/card-name';

interface Props {
  step: ReplayStep;
  tableSize: number;
  bb: number;
  mode: AmountMode;
  locale: Locale;
  potLabel: string;
}

/** One colour per position, the same as the app's theme (src/theme.ts POS). */
const POS: Record<string, string> = {
  BTN: '#F5B83D',
  CO: '#5AA9FF',
  HJ: '#B07CFF',
  LJ: '#7C8CFF',
  MP: '#B07CFF',
  'UTG+2': '#FF8A7A',
  'UTG+1': '#FF8A7A',
  UTG: '#FF5A5F',
  SB: '#9DB3AA',
  BB: '#9DB3AA',
};

const BADGE_WORD: Partial<Record<ActionType, string>> = {
  fold: 'FOLD',
  check: 'CHECK',
  call: 'CALL',
  bet: 'BET',
  raise: 'RAISE',
  allin: 'ALL-IN',
  post_sb: 'SB',
  post_bb: 'BB',
  post_straddle: 'STRADDLE',
};

/** Same marks as the tags beside the two boards. */
const RUN_MARK: Record<number, string> = { 1: '①', 2: '②' };


/** Ivory card with a serif rank, or the dark back with the brand mark. */
function TCard({ card, kind, locale }: { card?: Card | null; kind: 'board' | 'seat' | 'hero'; locale: Locale }) {
  if (!card) return <span className={`rt-card rt-card-${kind} rt-card-back`} role="img" aria-label={hiddenCardLabel(locale)} />;
  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = card[1];
  return (
    <span className={`rt-card rt-card-${kind}`} style={{ color: SUIT_COLORS[suit] }} role="img" aria-label={cardLabel(card, locale)}>
      <span className={`rt-rank${rank.length > 1 ? ' rt-rank-10' : ''}`}>{rank}</span>
      <span className="rt-suit">
        <SuitIcon suit={suit} size={100} />
      </span>
    </span>
  );
}

/** Visual slot of each seat: hero at the bottom, the others clockwise in seat order. */
function rotate(seats: SeatState[]) {
  const order = [...seats].sort((a, b) => a.seat - b.seat);
  const h = Math.max(0, order.findIndex((s) => s.isHero));
  return new Map(order.map((s, i) => [s.seat, (i - h + order.length) % order.length]));
}

export function PokerTable({ step, tableSize, bb, mode, locale, potLabel }: Props) {
  // tableSize only matters for empty seats, which a shared hand doesn't draw.
  void tableSize;
  const slot = rotate(step.seats);
  const map = tableMap(step.seats.length);
  const winners = new Map((step.winners ?? []).map((w) => [w.seat, w]));
  const fmt = (v: number) => formatAmount(v, bb, mode, locale);
  const pot = step.kind === 'showdown' || step.kind === 'end' ? step.pot : step.totalPot;
  const button = step.seats.find((s) => s.isButton);
  const pct = (p: { x: number; y: number }) => ({ left: `${p.x}%`, top: `${p.y}%` });

  return (
    <div className="table-wrap">
      <div className="rt-stage" style={{ aspectRatio: `1 / ${STAGE_RATIO}` }}>
        <svg className="rt-felt" viewBox="0 0 100 122" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id="rt-felt" cx="50%" cy="42%" r="62%">
              <stop offset="0%" stopColor="#183A30" />
              <stop offset="45%" stopColor="#11261F" />
              <stop offset="80%" stopColor="#0A1713" />
              <stop offset="100%" stopColor="#060D0B" />
            </radialGradient>
          </defs>
          <rect x="1.2" y="1.5" width="97.6" height="119" rx="46" ry="46" fill="none" stroke="rgba(245,237,216,0.07)" strokeWidth="1.6" />
          <rect x="3.5" y="3.7" width="93" height="114.6" rx="44" ry="44" fill="url(#rt-felt)" stroke="rgba(238,242,239,0.16)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
          <rect x="6.5" y="6.7" width="87" height="108.6" rx="40.5" ry="40.5" fill="none" stroke="rgba(238,242,239,0.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="rt-brand" style={{ top: `${BRAND_Y}%` }} aria-hidden>
          SWEATBOOK
        </div>

        {step.runs ? (
          // Run it twice: both boards, stacked, each tagged with its number.
          <div className="rt-board rt-board-twice" style={{ top: `${BOARD_Y}%` }}>
            {step.runs.map((r, k) => (
              <div key={k} className="rt-board-run" role="img" aria-label={`Board ${k + 1}. ${spokenBoard(r.board, locale)}`}>
                <span className="rt-run-tag">{k + 1}</span>
                {r.board.map((c, i) => (
                  <TCard locale={locale} key={`${i}-${c}`} card={c} kind="board" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="rt-board" style={{ top: `${BOARD_Y}%` }} role={step.board.length ? 'img' : undefined} aria-label={step.board.length ? spokenBoard(step.board, locale) : undefined} aria-hidden={step.board.length ? undefined : true}>
            {[0, 1, 2, 3, 4].map((i) =>
              step.board[i] ? <TCard locale={locale} key={`${i}-${step.board[i]}`} card={step.board[i]} kind="board" /> : <span key={i} className="rt-card rt-card-board rt-slot" />,
            )}
          </div>
        )}

        {pot > 0 && (
          <div className="rt-pot" style={{ top: `${POT_Y}%` }} role="img" aria-label={`${potLabel} ${fmt(pot)}`}>
            {step.pot > 0 && <ChipStack amount={step.pot} size={13} />}
            <span className="rt-pill rt-pill-strong">{fmt(pot)}</span>
          </div>
        )}

        {step.seats.map((s) =>
          s.committed > 0 ? (
            <div key={`b${s.seat}`} className="rt-bet" style={pct(map.bets[slot.get(s.seat)!])} aria-hidden>
              <ChipStack amount={s.committed} size={11} />
              <span className="rt-pill">{fmt(s.committed)}</span>
            </div>
          ) : null,
        )}

        {button && (
          <span className="rt-dealer" style={pct(dealerSpot(map.seats[slot.get(button.seat)!], map.bets[slot.get(button.seat)!]))} aria-hidden>
            D
          </span>
        )}

        {step.seats.map((s) => {
          const p = map.seats[slot.get(s.seat)!];
          const acting = step.actingSeat === s.seat;
          const win = winners.get(s.seat);
          const kind = s.isHero ? 'hero' : 'seat';
          const pos = [POS[s.position] ?? '#7F8D87', '#0C1311'];
          const a = s.lastAction;
          const badgeType = a ? (s.allIn && a.type !== 'fold' && a.type !== 'check' ? 'allin' : a.type) : null;
          // Run it twice: a player who won only one board says which.
          const runsWon = step.runs?.map((r, k) => (r.winners.some((w) => w.seat === s.seat) ? k + 1 : 0)).filter(Boolean) ?? [];
          const winNote = runsWon.length === 1 ? RUN_MARK[runsWon[0]] : s.handLabel;
          const badge = win
            ? { cls: 'win', text: `+${fmt(win.amount)}${winNote ? ` · ${winNote}` : ''}` }
            : s.handLabel && !s.folded && (step.kind === 'showdown' || step.kind === 'end')
              ? { cls: 'hand', text: s.handLabel }
              : badgeType && !s.folded && BADGE_WORD[badgeType]
                ? { cls: badgeType, text: `${BADGE_WORD[badgeType]}${a?.amount && badgeType !== 'check' ? ` ${fmt(a.amount)}` : ''}` }
                : null;
          return (
            <div
              key={s.seat}
              className={`rt-seat${s.isHero ? ' rt-seat-hero' : ''}${acting ? ' rt-seat-acting' : ''}${s.folded ? ' rt-seat-folded' : ''}${win ? ' rt-seat-win' : ''}`}
              style={pct(p)}
              role="img"
              aria-label={spokenSeat(s, fmt, locale, win?.amount)}
            >
              <div className="rt-seat-cards">
                {s.folded ? (
                  <span className="rt-fold">FOLD</span>
                ) : s.cards && s.showCards ? (
                  s.cards.map((c) => <TCard locale={locale} key={c} card={c} kind={kind} />)
                ) : (
                  <>
                    <TCard locale={locale} kind={kind} />
                    <TCard locale={locale} kind={kind} />
                  </>
                )}
              </div>
              <div className="rt-plate">
                <div className="rt-plate-top">
                  <span className="rt-name">{s.name}</span>
                  {s.name !== s.position && (
                    <span className="rt-pos" style={{ background: pos[0], color: pos[1] }}>
                      {s.position}
                    </span>
                  )}
                </div>
                <div className={`rt-stack${s.allIn && s.stack === 0 ? ' rt-stack-allin' : ''}`}>{s.allIn && s.stack === 0 ? 'ALL-IN' : fmt(s.stack)}</div>
              </div>
              {badge && <span className={`rt-badge rt-badge-${badge.cls}`}>{badge.text}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
