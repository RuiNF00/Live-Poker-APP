// Pieces of the app drawn in HTML for the landing page: cards with the app's cream face and
// 4-colour deck, position chips and a phone showing the hand-entry screen.

const SUIT: Record<string, { sym: string; color: string }> = {
  s: { sym: '♠', color: '#1B1D1C' },
  h: { sym: '♥', color: '#D93A3A' },
  d: { sym: '♦', color: '#2F6FE0' },
  c: { sym: '♣', color: '#1F9D57' },
};

const POS: Record<string, string> = {
  BTN: '#F5B83D',
  CO: '#5AA9FF',
  HJ: '#B07CFF',
  LJ: '#7C8CFF',
  UTG: '#FF5A5F',
  'UTG+1': '#FF8A7A',
  SB: '#9DB3AA',
  BB: '#9DB3AA',
};

export function Card({ code, size = 'md', down }: { code?: string; size?: 'sm' | 'md' | 'lg'; down?: boolean }) {
  if (down || !code) return <span className={`lpc lpc-${size} lpc-down`} aria-hidden />;
  const rank = code[0] === 'T' ? '10' : code[0];
  const s = SUIT[code[1]];
  return (
    <span className={`lpc lpc-${size}`} style={{ color: s.color }} aria-label={`${rank}${s.sym}`}>
      <b>{rank}</b>
      <i>{s.sym}</i>
    </span>
  );
}

export function Pos({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className={`lp-pos${active ? ' on' : ''}`} style={{ ['--pc' as string]: POS[label] ?? '#7F8D87' }}>
      {label}
    </span>
  );
}

type Seat = { pos: string; stack: string; x: number; y: number; folded?: boolean; bet?: string; hero?: boolean };

const SEATS: Seat[] = [
  { pos: 'UTG', stack: '38k', x: 14, y: 30, folded: true },
  { pos: 'UTG+1', stack: '52k', x: 50, y: 9, folded: true },
  { pos: 'LJ', stack: '41k', x: 86, y: 30, folded: true },
  { pos: 'HJ', stack: '18.5k', x: 88, y: 66, bet: 'All-in' },
  { pos: 'CO', stack: '27k', x: 12, y: 66, folded: true },
  { pos: 'BTN', stack: '61k', x: 50, y: 88, hero: true },
];

/** The app's hand-entry screen at the turn decision, inside a phone frame. */
export function PhoneMock({ m }: { m: { session: string; street: string; pot: string; you: string; fold: string; call: string; dec: string } }) {
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-phone-screen">
        <div className="lp-phone-notch" />
        <div className="lp-app-top">
          <span className="lp-app-x">✕</span>
          <span className="lp-app-session">
            <span className="lp-dot" /> {m.session}
          </span>
          <span className="lp-app-bb">BB</span>
        </div>
        <div className="lp-table">
          <div className="lp-felt-oval">
            <span className="lp-felt-brand">SWEATBOOK</span>
            <span className="lp-felt-street">{m.street}</span>
            <div className="lp-board">
              <Card code="Ks" size="sm" />
              <Card code="9h" size="sm" />
              <Card code="4h" size="sm" />
              <Card code="2c" size="sm" />
              <span className="lpc lpc-sm lpc-slot" />
            </div>
            <span className="lp-pot-chip">
              <span className="lp-chip-dot" /> {m.pot}
            </span>
          </div>
          {SEATS.map((s) => (
            <div
              key={s.pos}
              className={`lp-seat${s.folded ? ' folded' : ''}${s.hero ? ' hero' : ''}${s.bet ? ' acting' : ''}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              {s.hero && (
                <div className="lp-hero-cards">
                  <Card code="Ah" size="sm" />
                  <Card code="Qh" size="sm" />
                </div>
              )}
              <span className="lp-seat-pos" style={{ ['--pc' as string]: POS[s.pos] }}>
                {s.hero ? m.you : s.pos}
              </span>
              {/* 18.5k reads 18,5k where the comma is the decimal mark. */}
              <span className="lp-seat-stack">{s.stack.replace('.', m.dec)}</span>
              {s.bet && <span className="lp-seat-bet">{s.bet}</span>}
            </div>
          ))}
        </div>
        <div className="lp-dock">
          <div className="lp-dock-title">
            {m.street} · <em>{m.you}</em>
          </div>
          <div className="lp-dock-row">
            <span className="lp-dock-btn">{m.fold}</span>
            <span className="lp-dock-btn main">{m.call}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
