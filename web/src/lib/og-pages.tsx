import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { brand } from '@/config/brand';
import { MARK_LINES, MARK_PATH } from '@/components/Brand';
import { SUIT_PATHS } from '@/components/PlayingCard';
import type { LiveSnapshot } from '@/lib/live-snapshot';

// Link previews (WhatsApp, Instagram, iMessage) for the site, invites and backer live pages,
// in the app's "Noite" design. Shared hands have their own in lib/og.tsx.

export const OG_SIZE = { width: 1200, height: 630 };

const K = {
  bg: '#0C1311',
  surface: '#141D1A',
  surface2: '#1A2521',
  border: 'rgba(238,242,239,0.10)',
  text: '#F1F4F2',
  dim: '#B4BFBA',
  muted: '#7F8D87',
  accent: '#FF6A3D',
  accentSoft: 'rgba(255,106,61,0.14)',
  accentLine: 'rgba(255,106,61,0.45)',
  good: '#4ADE80',
  bad: '#FF8A7A',
  warn: '#F5B83D',
  felt: '#1C4A3C',
  feltEdge: '#163D31',
  cream: '#F6F2E8',
  suit: { s: '#1B1D1C', h: '#D93A3A', d: '#2F6FE0', c: '#1F9D57' } as Record<string, string>,
};

type OgFont = { name: string; data: Buffer; weight: 500 | 800; style: 'normal' };
let fonts: Promise<OgFont[]> | null = null;

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

async function render(node: React.ReactElement, maxAge = 86400) {
  return new ImageResponse(node, {
    ...OG_SIZE,
    fonts: await brandFonts(),
    headers: { 'cache-control': `public, max-age=${maxAge}, s-maxage=${maxAge}` },
  });
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: `radial-gradient(circle at 82% 48%, ${K.felt} 0%, ${K.bg} 58%)`,
        color: K.text,
        fontFamily: 'Hanken Grotesk',
        padding: '64px 72px',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}

function Logo() {
  const m = /^(.*?)(book)$/i.exec(brand.name);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width="52" height="52" viewBox="0 2 64 64">
        <path d={MARK_PATH} fill={K.accent} />
        <path d={MARK_LINES} stroke={K.bg} strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
        {m ? m[1] : brand.name}
        {m ? <span style={{ color: K.accent }}>{m[2]}</span> : null}
      </div>
    </div>
  );
}

function Eyebrow({ label, color = K.accent }: { label: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        alignSelf: 'flex-start',
        padding: '8px 18px',
        borderRadius: 999,
        border: `2px solid ${color}66`,
        background: `${color}22`,
        color,
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}
    >
      <div style={{ width: 12, height: 12, borderRadius: 6, background: color }} />
      {label}
    </div>
  );
}

/** A cream card from the app's four-colour deck. */
function CreamCard({ code, w, rotate = 0 }: { code: string; w: number; rotate?: number }) {
  const rank = code[0] === 'T' ? '10' : code[0];
  const col = K.suit[code[1]];
  return (
    <div
      style={{
        width: w,
        height: Math.round(w * 1.4),
        borderRadius: w * 0.11,
        background: K.cream,
        display: 'flex',
        flexDirection: 'column',
        padding: w * 0.09,
        color: col,
        boxShadow: '0 24px 50px rgba(0,0,0,0.5)',
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div style={{ fontSize: w * 0.5, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>{rank}</div>
      <svg width={w * 0.34} height={w * 0.34} viewBox="0 0 100 100" style={{ marginTop: w * 0.04 }}>
        <path d={SUIT_PATHS[code[1]]} fill={col} />
      </svg>
      <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        <svg width={w * 0.5} height={w * 0.5} viewBox="0 0 100 100">
          <path d={SUIT_PATHS[code[1]]} fill={col} />
        </svg>
      </div>
    </div>
  );
}

function Hand() {
  return (
    <div style={{ display: 'flex', position: 'absolute', right: 96, top: 150, gap: 0 }}>
      <CreamCard code="Ah" w={190} rotate={-8} />
      <div style={{ display: 'flex', marginLeft: -60, marginTop: 18 }}>
        <CreamCard code="Qh" w={190} rotate={7} />
      </div>
    </div>
  );
}

/** The bare site link (Instagram bio, WhatsApp). */
export function siteOgImage() {
  return render(
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', width: 760, justifyContent: 'space-between' }}>
        <Logo />
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 70, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2.5 }}>
          <span>Grava a mão</span>
          <span style={{ color: K.accent }}>antes do próximo deal.</span>
        </div>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 500, color: K.dim }}>Regista, revê e partilha as tuas mãos live.</div>
      </div>
      <Hand />
    </Frame>,
    604800,
  );
}

/** An invite (/r/<code>): the same for every code, so it caches like a static file. */
export function inviteOgImage(days: number) {
  return render(
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', width: 720, justifyContent: 'space-between' }}>
        <Logo />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <Eyebrow label="Convite" />
          <div style={{ display: 'flex', fontSize: 68, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2.5 }}>Um amigo convidou-te para o Sweatbook</div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            alignSelf: 'flex-start',
            padding: '18px 28px',
            borderRadius: 22,
            background: K.accentSoft,
            border: `2px solid ${K.accentLine}`,
          }}
        >
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: K.accent, letterSpacing: -2 }}>+{days}</div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 28, fontWeight: 500, color: K.dim, lineHeight: 1.2 }}>
            <span>dias de Pro</span>
            <span>para cada um</span>
          </div>
        </div>
      </div>
      <Hand />
    </Frame>,
    604800,
  );
}

const fmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const num = (n: number) => fmt.format(n);
const money = (n: number, cur: string) => `${n < 0 ? '−' : ''}${num(Math.abs(n))}${cur}`;

/** A backer live page (/live/<id>): the session as it stands. Short cache, it changes. */
export function liveOgImage(s: LiveSnapshot | null) {
  if (!s) return siteOgImage();
  const mtt = s.kind === 'mtt';
  const ended = !!s.endedAt;
  const kind = mtt ? 'Torneio' : 'Cash game';
  const title = s.name || kind;
  const sub = [s.player, s.venue].filter(Boolean).join(' · ');
  const first = s.stackLog[0]?.stack ?? s.stack;
  const delta = s.stack - first;
  const bb = s.bb ? Math.round((s.stack / s.bb) * 10) / 10 : null;
  const result = s.cashOut - s.invested;
  const tiles: [string, string][] = [
    [s.level ? `Nível ${s.level}` : 'Blinds', `${num(s.sb)}/${num(s.bb)}`],
    ['Entradas', `${s.entries} × ${money(s.buyIn, s.currency)}`],
    ...(s.sold ? ([['Ação vendida', `${num(s.sold)}%`]] as [string, string][]) : []),
  ];
  return render(
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo />
          <Eyebrow label={ended ? 'Terminada' : s.paused ? 'Em pausa' : 'Em direto'} color={ended ? K.muted : s.paused ? K.warn : K.good} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, maxWidth: 1056 }}>{title.slice(0, 48)}</div>
          {sub ? <div style={{ display: 'flex', fontSize: 30, fontWeight: 500, color: K.dim }}>{sub.slice(0, 70)}</div> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '22px 30px',
              borderRadius: 22,
              background: K.surface,
              border: `2px solid ${K.border}`,
              minWidth: 420,
            }}
          >
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, letterSpacing: 2, color: K.muted }}>
              {ended ? (mtt ? (s.cashOut ? 'PRÉMIO' : 'ELIMINADO') : 'CASH-OUT') : 'STACK'}
            </div>
            <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>
              {ended ? (s.cashOut || !mtt ? money(s.cashOut, s.currency) : s.finish ? `${s.finish}º` : '—') : num(s.stack)}
            </div>
            <div style={{ display: 'flex', gap: 18, fontSize: 26, fontWeight: 500, color: K.dim }}>
              {ended ? (
                <span style={{ color: result >= 0 ? K.good : K.bad }}>
                  Resultado {result > 0 ? '+' : ''}
                  {money(result, s.currency)}
                </span>
              ) : (
                <>
                  {bb !== null ? <span>{num(bb)} BB</span> : null}
                  {delta ? (
                    <span style={{ color: delta > 0 ? K.good : K.bad, marginLeft: 18 }}>
                      {delta > 0 ? '+' : '−'}
                      {num(Math.abs(delta))}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tiles.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1.5, color: K.muted, textTransform: 'uppercase' }}>{k}</span>
                <span style={{ fontSize: 32, fontWeight: 800 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>,
    60,
  );
}
