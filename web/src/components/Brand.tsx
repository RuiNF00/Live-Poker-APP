import { brand } from '@/config/brand';

export const MARK_PATH = 'M32 12.5 L44.73 25.27 A18 18 0 1 1 19.27 25.27 Z';
export const MARK_LINES = 'M24 36 H40 M24 42 H40 M24 48 H34';

/** Sweatbook mark: a drop with notebook lines. */
export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 2 64 64" aria-hidden>
      <path d={MARK_PATH} fill="var(--accent)" />
      <path d={MARK_LINES} stroke="var(--bg)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** "Sweat" in text colour, "book" in accent. Other names render plain. */
export function Wordmark({ className = '' }: { className?: string }) {
  const m = /^(.*?)(book)$/i.exec(brand.name);
  return (
    <span className={`wordmark ${className}`}>
      {m ? (
        <>
          {m[1]}
          <span>{m[2]}</span>
        </>
      ) : (
        brand.name
      )}
    </span>
  );
}
