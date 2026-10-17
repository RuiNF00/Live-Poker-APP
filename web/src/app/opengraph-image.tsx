import { ImageResponse } from 'next/og';
import { brand } from '@/config/brand';
import { MARK_LINES, MARK_PATH } from '@/components/Brand';

export const alt = 'Sweatbook';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Preview for the bare site link (Instagram bio, WhatsApp). Shared hands have their own. */
export default function Image() {
  const m = /^(.*?)(book)$/i.exec(brand.name);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 90px',
          background: `radial-gradient(circle at 85% 40%, #1C4A3C 0%, ${brand.colors.bg} 60%)`,
          color: '#EEF2EF',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="96" height="96" viewBox="0 2 64 64">
            <path d={MARK_PATH} fill={brand.colors.accent} />
            <path d={MARK_LINES} stroke={brand.colors.bg} strokeWidth="3.2" strokeLinecap="round" />
          </svg>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>
            {m ? m[1] : brand.name}
            {m && <span style={{ color: brand.colors.accent }}>{m[2]}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          <span>Grava a mão</span>
          <span style={{ color: brand.colors.accent }}>antes do próximo deal.</span>
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 30, color: '#B3BEB9' }}>
          Replayer para póquer live. Partilha com os amigos e recebe opinião.
        </div>
      </div>
    ),
    size,
  );
}
