// Casino chips in 2.5D (face + side wall with edge spots), stacked by denomination,
// the same chips as the app's replayer.

const DENOMS = [
  { v: 1_000_000, c: '#E4C164', e: '#6B4C14' },
  { v: 100_000, c: '#8A57DD', e: '#341F63' },
  { v: 25_000, c: '#D0403F', e: '#5C1413' },
  { v: 5_000, c: '#219684', e: '#0C4137' },
  { v: 1_000, c: '#DA842D', e: '#5F340C' },
  { v: 500, c: '#3A76CC', e: '#143A63' },
  { v: 100, c: '#B6BCC6', e: '#4C505A' },
  { v: 25, c: '#2F9D54', e: '#0F4726' },
  { v: 5, c: '#D1596F', e: '#571826' },
  { v: 1, c: '#E8E0CC', e: '#8A8470' },
];

/** Columns of chips that add up to roughly `amount` (largest denominations first). */
export function chipColumns(amount: number, maxPerCol = 4, maxCols = 3) {
  let rem = Math.round(amount);
  const cols: { c: string; e: string; n: number }[] = [];
  for (const d of DENOMS) {
    if (rem < d.v) continue;
    const n = Math.min(Math.floor(rem / d.v), maxPerCol);
    rem -= n * d.v;
    cols.push({ c: d.c, e: d.e, n });
    if (cols.length >= maxCols) break;
  }
  return cols;
}

/** `size` is the chip width in px at scale 1; the svg scales with the `--k` of the table. */
export function ChipStack({ amount, size = 14 }: { amount: number; size?: number }) {
  const cols = chipColumns(amount);
  if (!cols.length) return null;
  const W = size;
  const ry = W * 0.3;
  const wall = Math.max(2.5, W * 0.26);
  const H = Math.ceil(ry * 2 + wall * 4 + 2);
  const total = cols.length * W + (cols.length - 1) * 2;
  return (
    <svg className="rt-chips" viewBox={`0 0 ${total} ${H}`} style={{ width: `calc(var(--k) * ${total})`, height: `calc(var(--k) * ${H})` }} aria-hidden>
      {cols.map((col, ci) => {
        const x0 = ci * (W + 2);
        return (
          <g key={ci}>
            <ellipse cx={x0 + W / 2} cy={H - ry + 1} rx={W * 0.55} ry={ry * 0.7} fill="rgba(0,0,0,0.5)" />
            {Array.from({ length: col.n }).map((_, i) => {
              const y = H - wall * (i + 1) - ry - 1;
              return (
                <g key={i}>
                  <ellipse cx={x0 + W / 2} cy={y + wall} rx={W / 2} ry={ry} fill={col.e} />
                  <rect x={x0} y={y} width={W} height={wall} fill={col.e} />
                  {[0.22, 0.5, 0.78].map((fx) => (
                    <rect key={fx} x={x0 + W * fx - W * 0.05} y={y + wall * 0.2} width={W * 0.1} height={wall * 0.6} fill="rgba(244,237,216,0.9)" />
                  ))}
                  <ellipse cx={x0 + W / 2} cy={y} rx={W / 2} ry={ry} fill={col.c} stroke="rgba(0,0,0,0.5)" strokeWidth={0.6} />
                  <ellipse cx={x0 + W / 2} cy={y} rx={W * 0.32} ry={ry * 0.62} fill="none" stroke="rgba(255,248,228,0.55)" strokeWidth={0.8} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
