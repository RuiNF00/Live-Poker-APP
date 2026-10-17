import type { Card } from '@livepoker/hand-format';

export const SUIT_PATHS: Record<string, string> = {
  h: 'M50 90C20 66 5 49 5 30 5 15 17 5 30 5c10 0 17 6 20 13 3-7 10-13 20-13 13 0 25 10 25 25 0 19-15 36-45 60Z',
  d: 'M50 3 88 50 50 97 12 50Z',
  s: 'M50 4C36 24 8 39 8 60c0 14 11 22 23 22 7 0 13-3 16-8-1 10-5 17-12 22h30c-7-5-11-12-12-22 3 5 9 8 16 8 12 0 23-8 23-22C92 39 64 24 50 4Z',
  c: 'M50 8a19 19 0 0 0-17 28 19 19 0 1 0 13 30c-1 12-5 22-13 30h34c-8-8-12-18-13-30a19 19 0 1 0 13-30A19 19 0 0 0 50 8Z',
};

/** Four-colour deck: easier to read suits at a glance on small screens. */
export const SUIT_COLORS: Record<string, string> = {
  s: '#1b1d22',
  h: '#d42c3f',
  d: '#2563d9',
  c: '#1c9a52',
};

export function SuitIcon({ suit, size = 14 }: { suit: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d={SUIT_PATHS[suit]} fill="currentColor" />
    </svg>
  );
}

const SUIT_NAME: Record<string, string> = { s: 'espadas', h: 'copas', d: 'ouros', c: 'paus' };

export function PlayingCard({
  card,
  size = 'md',
  faceDown = false,
  dim = false,
  highlight = false,
}: {
  card?: Card | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  dim?: boolean;
  highlight?: boolean;
}) {
  if (!card || faceDown) {
    return <span className={`card card-${size} card-back${dim ? ' card-dim' : ''}`} aria-label="carta escondida" />;
  }
  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = card[1];
  return (
    <span
      className={`card card-${size}${dim ? ' card-dim' : ''}${highlight ? ' card-hi' : ''}`}
      style={{ background: SUIT_COLORS[suit] }}
      aria-label={`${rank} de ${SUIT_NAME[suit]}`}
    >
      <span className="card-rank">{rank}</span>
      <span className="card-suit">
        <SuitIcon suit={suit} size={size === 'lg' ? 22 : size === 'md' ? 14 : size === 'sm' ? 10 : 8} />
      </span>
    </span>
  );
}
