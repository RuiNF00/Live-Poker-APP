import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { buildReplay, formatChips, type Card, type HandRecord } from '@livepoker/hand-format';
import { brand } from '@/config/brand';
import { heroLastSpot, resolveHand } from '@/lib/hand';
import type { QuizSpot, SharedHand } from '@/lib/types';
import { SUIT_COLORS, SUIT_PATHS } from '@/components/PlayingCard';
import { MARK_LINES, MARK_PATH } from '@/components/Brand';

export const OG_SIZE = { width: 1200, height: 630 };

type OgFont = { name: string; data: Buffer; weight: 500 | 800; style: 'normal' };
let fonts: Promise<OgFont[]> | null = null;

/** Hanken Grotesk, the brand font (OFL). Falls back to the built-in font if the files are missing. */
function brandFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all(
    ([
      [500, 'HankenGrotesk_500Medium.ttf'],
      [800, 'HankenGrotesk_800ExtraBold.ttf'],
    ] as const).map(async ([weight, file]) => ({
      name: 'Hanken Grotesk',
      data: await readFile(join(process.cwd(), 'assets/fonts', file)),
      weight,
      style: 'normal' as const,
    })),
  ).catch(() => []);
  return fonts;
}

const BOARD_AT: Record<QuizSpot['street'], number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

function OgCard({ card, w, hidden }: { card?: Card | null; w: number; hidden?: boolean }) {
  const h = Math.round(w * 1.4);
  if (!card || hidden) {
    // A card still to come in a challenge: an empty slot with a question mark.
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: w * 0.12,
          background: hidden ? 'rgba(0,0,0,0.28)' : 'linear-gradient(135deg, #263241, #121a24)',
          border: hidden ? '3px dashed rgba(255,255,255,0.28)' : '3px solid rgba(255,255,255,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.45)',
          fontSize: w * 0.5,
          fontWeight: 800,
        }}
      >
        {hidden ? '?' : ''}
      </div>
    );
  }
  const rank = card[0] === 'T' ? '10' : card[0];
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: w * 0.12,
        background: SUIT_COLORS[card[1]],
        border: '3px solid rgba(255,255,255,0.35)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ fontSize: w * 0.62, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>{rank}</div>
      <svg width={w * 0.42} height={w * 0.42} viewBox="0 0 100 100" style={{ marginTop: w * 0.06 }}>
        <path d={SUIT_PATHS[card[1]]} fill="white" />
      </svg>
    </div>
  );
}

function boardOf(hand: HandRecord): Card[] {
  const b = hand.board;
  return [...(b?.flop ?? []), ...(b?.turn ? [b.turn] : []), ...(b?.river ? [b.river] : [])];
}

const oneLine = { display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 1072 } as const;

const bbs = (n: number, bb: number) => `${Math.round((n / bb) * 10) / 10} BB`.replace('.', ',');

/** What the hero faces at the challenge spot, without giving the answer away. */
function spotLine(hand: HandRecord, quiz: QuizSpot): string | null {
  const steps = buildReplay(hand, { revealAll: false, locale: 'pt' });
  const k = steps.findIndex((s) => s.action && s.street === quiz.street && s.action.index === quiz.actionIndex);
  if (k < 1) return null;
  const step = steps[k];
  const hero = steps[k - 1].seats.find((s) => s.seat === step.actingSeat);
  if (!hero) return null;
  const facing = step.facing ?? 0;
  const pot = step.totalPot - (step.action?.paid ?? 0);
  const bb = hand.blinds.bb;
  return [
    `${hero.position} com ${bbs(hero.stack + hero.committed, bb)}`,
    facing > 0 ? `a pagar ${formatChips(facing)}` : 'a decidir primeiro',
    `pote ${formatChips(pot)}`,
  ].join(' · ');
}

/**
 * Link preview for a shared hand (WhatsApp, Instagram, iMessage...).
 * For a challenge it stops at the hero's decision: board cards still to come
 * are shown as "?" so the preview never spoils the result.
 */
export async function handOgImage(share: SharedHand | null, challenge: boolean): Promise<ImageResponse> {
  const resolved = share ? resolveHand(share.payload) : null;
  const hand = resolved?.hand;
  const quiz = hand && challenge ? (share?.quiz ?? heroLastSpot(resolved!, share!.payload)) : null;
  const hero = hand?.players.find((p) => p.isHero);
  const board = hand ? boardOf(hand) : [];
  const shown = quiz ? Math.min(board.length, BOARD_AT[quiz.street]) : board.length;
  const slots = quiz ? Math.max(board.length, shown) : board.length;
  const stakes = hand
    ? `${formatChips(hand.blinds.sb)}/${formatChips(hand.blinds.bb)}${hand.blinds.ante ? ` (${formatChips(hand.blinds.ante)})` : ''}`
    : '';
  const wordmark = /^(.*?)(book)$/i.exec(brand.name);
  const where = hand?.tournament?.name || hand?.location || (hand?.format === 'cash' ? 'Cash game' : '');
  const heroCards = hero?.cards?.length ? hero.cards : [null, null];
  // PLO (4 cards) and a full board must fit side by side in 1072px.
  const heroW = heroCards.length > 2 ? 104 : 150;
  const boardW = heroCards.length > 2 ? 84 : 96;
  const situation = hand && quiz ? spotLine(hand, quiz) : null;
  const headline = quiz ? 'O que fazes aqui?' : share?.title || 'Como jogavas esta mão?';
  const subline = quiz
    ? // The spot is what makes a friend tap; the title is already in the link's text.
      [situation, share?.title].filter(Boolean).join(' · ')
    : [where, 'Vê o replay e diz como jogavas'].filter(Boolean).join(' · ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: `radial-gradient(ellipse at 50% 40%, ${brand.colors.felt} 0%, ${brand.colors.feltDark} 55%, ${brand.colors.bg} 100%)`,
          color: 'white',
          padding: '44px 64px',
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontWeight: 500,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width={56} height={56} viewBox="0 2 64 64">
              <path d={MARK_PATH} fill={brand.colors.accent} />
              <path d={MARK_LINES} stroke={brand.colors.bg} strokeWidth="3.2" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: 36, fontWeight: 700, display: 'flex' }}>
              {wordmark ? (
                <>
                  <span>{wordmark[1]}</span>
                  <span style={{ color: brand.colors.accent }}>{wordmark[2]}</span>
                </>
              ) : (
                brand.name
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {quiz && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: brand.colors.bg,
                  background: brand.colors.accent,
                  padding: '8px 18px',
                  borderRadius: 999,
                }}
              >
                DESAFIO
              </div>
            )}
            <div style={{ fontSize: 30, opacity: 0.85, display: 'flex' }}>{stakes}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 64 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {heroCards.map((c, i) => (
              <OgCard key={i} card={c} w={heroW} />
            ))}
          </div>
          {slots > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              {Array.from({ length: slots }, (_, i) => (
                <OgCard key={i} card={board[i]} w={boardW} hidden={i >= shown} />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 50, fontWeight: 800, color: quiz ? brand.colors.accent : 'white', ...oneLine }}>{headline}</div>
          <div style={{ fontSize: 28, opacity: 0.85, ...oneLine }}>{subline}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await brandFonts(), headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
