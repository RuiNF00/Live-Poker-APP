import { ImageResponse } from 'next/og';
import { formatChips, type Card, type HandRecord } from '@livepoker/hand-format';
import { brand } from '@/config/brand';
import { loadShare } from '@/lib/store';
import { resolveHand } from '@/lib/hand';
import { SUIT_COLORS, SUIT_PATHS } from '@/components/PlayingCard';
import { MARK_LINES, MARK_PATH } from '@/components/Brand';

export const alt = 'Mão de póquer partilhada';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function OgCard({ card, w }: { card?: Card | null; w: number }) {
  const h = Math.round(w * 1.4);
  if (!card) {
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: w * 0.12,
          background: 'linear-gradient(135deg, #263241, #121a24)',
          border: '3px solid rgba(255,255,255,0.18)',
          display: 'flex',
        }}
      />
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

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await loadShare(id);
  const hand = share ? resolveHand(share.payload)?.hand : undefined;
  const hero = hand?.players.find((p) => p.isHero);
  const board = hand ? boardOf(hand) : [];
  const stakes = hand
    ? `${formatChips(hand.blinds.sb)}/${formatChips(hand.blinds.bb)}${hand.blinds.ante ? ` (${formatChips(hand.blinds.ante)})` : ''}`
    : '';
  const wordmark = /^(.*?)(book)$/i.exec(brand.name);
  const where = hand?.tournament?.name || hand?.location || (hand?.format === 'cash' ? 'Cash game' : '');

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
          padding: '48px 64px',
          fontFamily: 'sans-serif',
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
          <div style={{ fontSize: 30, opacity: 0.85, display: 'flex' }}>{stakes}</div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 70 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {(hero?.cards?.length ? hero.cards : [null, null]).map((c, i) => (
              <OgCard key={i} card={c} w={150} />
            ))}
          </div>
          {board.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              {board.map((c, i) => (
                <OgCard key={i} card={c} w={96} />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 46, fontWeight: 800, display: 'flex' }}>{share?.title || 'Como jogavas esta mão?'}</div>
          <div style={{ fontSize: 28, opacity: 0.8, display: 'flex' }}>
            {[where, 'Toca para ver o replay e comentar'].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
