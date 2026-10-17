// The report as a printable A4 page (HTML for expo-print). Light paper look,
// the brand only in the header: it goes to accountants and backers, so it
// reads like a statement, not like the app. Pure, so it can be tested.

import { locale, t } from '@/i18n';
import { duration, money } from '@/poker/format';
import { cost, playedMs, profit, type Breakdown } from '@/store/session-math';

import { countryName, flag } from '@/tax/countries';
import type { TaxReport } from '@/tax/tax-math';

import type { CurrencyReport, Report } from './report';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const day = (ts: number) => new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
const hours = (h: number) => h.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (n: number, cur: string) => (n > 0 ? '+' : '') + money(Math.round(n * 100) / 100, cur);
const cls = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

function period(r: Report): string {
  const from = r.range.from ?? r.first;
  const to = r.range.to ?? r.last;
  if (!from || !to) return t('Sem sessões no período');
  return t('{from} a {to}', { from: day(from), to: day(to) });
}

function table(title: string, rows: Breakdown[], cur: string, label = (k: string) => k): string {
  if (rows.length < 2 && title !== t('Por mês')) return '';
  return `
    <h3>${esc(title)}</h3>
    <table>
      <thead><tr><th></th><th class="n">${esc(t('Sessões'))}</th><th class="n">${esc(t('Horas'))}</th><th class="n">${esc(t('Por hora'))}</th><th class="n">${esc(t('Resultado'))}</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (b) =>
              `<tr><td>${esc(label(b.key))}</td><td class="n">${b.sessions}</td><td class="n">${hours(b.hours)}</td><td class="n">${b.hours >= 0.25 ? esc(money(Math.round(b.hourly), cur)) : '—'}</td><td class="n ${cls(b.profit)}">${esc(signed(b.profit, cur))}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function currencyBlock(c: CurrencyReport, many: boolean): string {
  const cur = c.currency;
  const tt = c.totals;
  const tiles: [string, string, string?][] = [
    [t('Resultado'), signed(tt.profit, cur), cls(tt.profit)],
    [t('Horas'), hours(tt.hours)],
    [t('Por hora'), tt.hours >= 0.25 ? money(Math.round(tt.hourly), cur) : '—'],
    [t('Sessões'), String(tt.sessions)],
  ];
  if (c.mtt.sessions) {
    tiles.push([t('ROI torneios'), tt.roi === null ? '—' : `${tt.roi.toFixed(0)}%`]);
    tiles.push(['ITM', tt.itm === null ? '—' : `${tt.itm.toFixed(0)}%`]);
  }
  if (c.deposits || c.withdrawals) {
    tiles.push([t('Depósitos'), money(c.deposits, cur)]);
    tiles.push([t('Levantamentos'), money(c.withdrawals, cur)]);
  }
  if (c.owedToBackers) tiles.push([t('Pago a backers'), money(Math.round(c.owedToBackers * 100) / 100, cur)]);

  const split =
    c.cash.sessions && c.mtt.sessions
      ? `<p class="muted">${esc(
          t('Cash: {n}, {h} h, {p}. Torneios: {m}, {b} em buy-ins, {c}, {q}.', {
            n: c.cash.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: c.cash.sessions }),
            h: hours(c.cash.hours),
            p: signed(c.cash.profit, cur),
            m: c.mtt.sessions === 1 ? t('1 entrada') : t('{n} entradas', { n: c.mtt.sessions }),
            b: money(Math.round(c.mtt.buyIns), cur),
            c: c.mtt.cashes === 1 ? t('1 prémio') : t('{n} prémios', { n: c.mtt.cashes }),
            q: signed(c.mtt.profit, cur),
          }),
        )}</p>`
      : '';

  const sessions = c.sessions
    .map(
      (s) =>
        `<tr><td>${esc(day(s.startedAt))}</td><td>${esc(s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash'))}${s.kind === 'mtt' && s.finish ? ` <span class="muted">· ${s.finish}º${s.field ? '/' + s.field : ''}</span>` : ''}</td><td>${esc(s.venue)}</td><td class="n">${esc(duration(playedMs(s)))}</td><td class="n">${esc(money(Math.round(cost(s) * 100) / 100, cur))}</td><td class="n">${esc(money(Math.round((s.cashOut || 0) * 100) / 100, cur))}</td><td class="n ${cls(profit(s))}">${esc(signed(profit(s), cur))}</td></tr>`,
    )
    .join('');

  return `
    <section>
      ${many ? `<h2>${esc(t('Em {currency}', { currency: cur }))}</h2>` : ''}
      <div class="tiles">${tiles.map(([l, v, k]) => `<div class="tile"><div class="l">${esc(l)}</div><div class="v ${k ?? ''}">${esc(v)}</div></div>`).join('')}</div>
      ${split}
      ${table(t('Por bankroll'), c.byBankroll, cur)}
      ${table(t('Live e online'), c.byFormat, cur)}
      ${table(t('Por jogo'), c.byGame, cur)}
      ${table(t('Por sala'), c.byVenue, cur)}
      ${c.byMonth.length > 1 ? table(t('Por mês'), c.byMonth, cur, monthLabel) : ''}
      ${
        c.sessions.length
          ? `<h3>${esc(t('Sessões'))}</h3>
      <table class="sessions">
        <thead><tr><th>${esc(t('Data'))}</th><th>${esc(t('Jogo'))}</th><th>${esc(t('Sala'))}</th><th class="n">${esc(t('Tempo'))}</th><th class="n">Buy-in</th><th class="n">Cash-out</th><th class="n">${esc(t('Resultado'))}</th></tr></thead>
        <tbody>${sessions}</tbody>
      </table>`
          : ''
      }
    </section>`;
}

function taxBlock(x: TaxReport): string {
  if (!x.rows.some((r) => r.country || r.withheld)) return '';
  const rows = x.rows
    .map(
      (r) =>
        `<tr><td>${esc(r.country ? `${flag(r.country)} ${countryName(r.country)}` : countryName(undefined))}</td><td class="n">${r.sessions}</td><td class="n">${esc(money(r.wins, r.currency))}</td><td class="n">${esc(money(r.losses, r.currency))}</td><td class="n ${cls(r.net)}">${esc(signed(r.net, r.currency))}</td><td class="n">${r.withheld ? esc(money(r.withheld, r.currency)) : '—'}</td><td class="n">${r.toRecover ? esc(money(r.toRecover, r.currency)) : '—'}</td></tr>`,
    )
    .join('');
  const us = x.us
    ? `
    <h3>${esc(t('Se declaras impostos nos EUA'))}</h3>
    <table>
      <thead><tr><th></th><th class="n">${esc(t('Ganhos'))}</th><th class="n">${esc(t('Perdas'))}</th><th class="n">${esc(t('Perdas dedutíveis'))}</th><th class="n">${esc(t('Fica a tributar'))}</th></tr></thead>
      <tbody>${x.us
        .map(
          (u) =>
            `<tr><td>${esc(u.currency)}</td><td class="n">${esc(money(u.wins, u.currency))}</td><td class="n">${esc(money(u.losses, u.currency))}</td><td class="n">${esc(money(u.deductible, u.currency))}</td><td class="n">${esc(money(u.taxable, u.currency))}</td></tr>`,
        )
        .join('')}</tbody>
    </table>
    <p class="muted">${esc(t('A partir de 2026 só 90% das perdas são dedutíveis, e nunca mais do que os ganhos. Quem declara nos EUA precisa de cada sessão documentada: data, local, jogo, buy-ins e cash-outs.'))}${x.us.some((u) => u.lostToCap) ? ' ' + esc(t('Neste período, {amount} de perdas ficam por deduzir por causa desta regra.', { amount: x.us.filter((u) => u.lostToCap).map((u) => money(u.lostToCap, u.currency)).join(' + ') })) : ''}</p>`
    : '';
  return `
    <section>
      <h2>${esc(t('Impostos por país'))}</h2>
      <table>
        <thead><tr><th>${esc(t('País'))}</th><th class="n">${esc(t('Sessões'))}</th><th class="n">${esc(t('Ganhos'))}</th><th class="n">${esc(t('Perdas'))}</th><th class="n">${esc(t('Resultado'))}</th><th class="n">${esc(t('Retido'))}</th><th class="n">${esc(t('A recuperar'))}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted">${esc(t('Ganhos e perdas somam as sessões que ganhaste e as que perdeste, antes de despesas. Retido: imposto que o casino reteve no prémio (W-2G, 1042-S).'))}</p>
      ${us}
      <p class="note">${esc(t('Isto não é aconselhamento fiscal. São os números que registaste, arrumados por país. Confirma com um contabilista as regras do teu país e de onde jogaste.'))}</p>
    </section>`;
}

export function reportHtml(r: Report, opts: { player?: string; now?: number; tax?: TaxReport } = {}): string {
  const many = r.currencies.length > 1;
  return `<!doctype html>
<html lang="${locale.slice(0, 2)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(t('Relatório de póquer'))}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: #15201C; font-size: 10.5pt; line-height: 1.4; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #15201C; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-weight: 800; font-size: 15pt; letter-spacing: -0.3px; }
  .brand span { color: #E85A30; }
  h1 { font-size: 20pt; margin: 6px 0 2px; letter-spacing: -0.4px; }
  h2 { font-size: 13pt; margin: 22px 0 8px; }
  h3 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.8px; color: #5B6B64; margin: 18px 0 6px; }
  .muted { color: #5B6B64; }
  .meta { text-align: right; color: #5B6B64; font-size: 9.5pt; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 6px; }
  .tile { border: 1px solid #D9E0DC; border-radius: 8px; padding: 8px 10px; }
  .tile .l { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.8px; color: #5B6B64; }
  .tile .v { font-size: 14pt; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th { text-align: left; font-size: 8.5pt; color: #5B6B64; font-weight: 600; border-bottom: 1px solid #C9D2CD; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #EDF1EE; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .n { text-align: right; white-space: nowrap; }
  .pos { color: #13803D; }
  .neg { color: #C03A2B; }
  .sessions td { font-size: 9.5pt; }
  .note { border: 1px solid #F0C9B8; background: #FDF3EE; border-radius: 8px; padding: 8px 10px; font-size: 9pt; margin-top: 10px; }
  footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #D9E0DC; font-size: 8.5pt; color: #5B6B64; }
</style>
</head>
<body>
  <header>
    <div>
      <div class="brand">Sweat<span>book</span></div>
      <h1>${esc(t('Relatório de póquer'))}</h1>
      <div class="muted">${esc(period(r))} · ${esc(r.scopeName)}</div>
    </div>
    <div class="meta">${opts.player ? esc(opts.player) + '<br/>' : ''}${esc(t('Gerado a {date}', { date: day(opts.now ?? Date.now()) }))}</div>
  </header>
  ${r.currencies.length ? r.currencies.map((c) => currencyBlock(c, many)).join('') : `<p>${esc(t('Sem sessões no período'))}</p>`}
  ${opts.tax ? taxBlock(opts.tax) : ''}
  <footer>${esc(t('Resultados registados pelo jogador no Sweatbook. O resultado de cada sessão já desconta buy-ins, despesas e a parte dos backers.'))}</footer>
</body>
</html>`;
}
