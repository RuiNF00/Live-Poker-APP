// Which column of an exported CSV holds which part of a Sweatbook session.
// Known apps get a fixed mapping recognised from their header; any other CSV
// is mapped by column names (English, Portuguese, Spanish, French, German)
// and the player can fix the mapping before importing.

import { norm, type Table } from './csv';

export const FIELDS = [
  'start',
  'time',
  'end',
  'hours',
  'minutes',
  'breakMinutes',
  'kind',
  'format',
  'name',
  'game',
  'limit',
  'stakes',
  'sb',
  'bb',
  'venue',
  'currency',
  'buyIn',
  'rebuyCost',
  'addOn',
  'cashOut',
  'profit',
  'expenses',
  'tips',
  'handsDealt',
  'finish',
  'field',
  'tableSize',
  'notes',
  'tags',
  // Only in Sweatbook's own CSV: never guessed from another app's headers.
  'id',
  'bankroll',
  'country',
  'day',
  'makeupCut',
] as const;
export type Field = (typeof FIELDS)[number];

/** Column index per field; missing fields are left out. */
export type Mapping = Partial<Record<Field, number>>;

export type SourceId = 'pbt' | 'pokerbase' | 'pokeranalytics' | 'sweatbook' | 'generic';

// Exact header names, after norm(). Order matters: the first match wins.
const SYN: Record<Field, string[]> = {
  start: ['starttime', 'startdate', 'startdatetime', 'start', 'started', 'startedat', 'begin', 'inicio', 'datainicio', 'datadeinicio', 'debut', 'datedebut', 'datededebut', 'fechainicio', 'fechadeinicio', 'beginn', 'date', 'data', 'datetime', 'day', 'dia', 'fecha', 'datum', 'sessiondate'],
  time: ['time', 'hora', 'horainicio', 'heure', 'uhrzeit', 'starthour'],
  end: ['endtime', 'enddate', 'enddatetime', 'end', 'ended', 'endedat', 'finished', 'fim', 'datafim', 'datadefim', 'horafim', 'fin', 'datefin', 'datedefin', 'fechafin', 'fechadefin', 'ende'],
  hours: ['hours', 'hoursplayed', 'playinghours', 'horas', 'duration', 'duracao', 'duracion', 'duree', 'dauer', 'length', 'timeplayed'],
  minutes: ['playingminutes', 'minutes', 'minutesplayed', 'minutos', 'mins', 'durationminutes'],
  breakMinutes: ['breakminutes', 'breaks', 'break', 'pausa', 'pausas'],
  kind: ['variant', 'sessiontype', 'kind', 'format', 'gametype', 'cashortournament', 'tipo', 'tipodejogo', 'type', 'modalidade'],
  format: ['gameformat', 'liveonline', 'onlinelive', 'liveoronline', 'setting', 'environment', 'venuetype', 'locationtype', 'formato'],
  name: ['mttname', 'tournamentname', 'tournament', 'torneio', 'torneo', 'tournoi', 'event', 'eventname', 'title', 'name', 'nome'],
  game: ['game', 'jogo', 'juego', 'jeu', 'spiel', 'gamename', 'pokergame'],
  limit: ['limit', 'limite', 'bettinglimit', 'limittype'],
  stakes: ['stakes', 'blinds', 'stake', 'cegas'],
  sb: ['smallblind', 'sb'],
  bb: ['bigblind', 'bb'],
  venue: ['location', 'venue', 'casino', 'casinoname', 'local', 'sala', 'room', 'cardroom', 'club', 'site', 'ort', 'lieu'],
  currency: ['currency', 'moeda', 'moneda', 'devise', 'wahrung', 'curr'],
  buyIn: ['buyin', 'buyins', 'totalbuyin', 'buyintotal', 'entryfee', 'entry', 'invested', 'investment', 'cost', 'totalcost', 'entrada', 'custo', 'inversion', 'einsatz'],
  rebuyCost: ['rebuycosts', 'rebuycost', 'rebuyamount', 'rebuystotal', 'rebuy', 'recompras'],
  addOn: ['addoncosts', 'addoncost', 'addon', 'addons'],
  cashOut: ['cashout', 'cashedout', 'winnings', 'prize', 'prizemoney', 'payout', 'won', 'return', 'premio', 'ganhos', 'ganancias', 'gains', 'gewinn', 'saida'],
  profit: ['netprofit', 'profit', 'net', 'netresult', 'result', 'results', 'profitloss', 'pl', 'winloss', 'amount', 'lucro', 'resultado', 'ganancia', 'benefice', 'resultat', 'netto'],
  expenses: ['expenses', 'expense', 'despesas', 'gastos', 'frais', 'ausgaben'],
  tips: ['tips', 'tip', 'dealertips', 'tokes', 'toke', 'gorjetas', 'gorjeta', 'propinas', 'pourboires', 'trinkgeld'],
  handsDealt: ['hands', 'handsdealt', 'handsplayed', 'numhands', 'maos', 'maosjogadas', 'manos', 'mains', 'hande'],
  finish: ['place', 'finish', 'finishposition', 'position', 'rank', 'posicao', 'lugar', 'lugarfinal', 'classificacao', 'puesto', 'platz'],
  field: ['player', 'players', 'entrants', 'field', 'fieldsize', 'totalplayers', 'jogadores', 'jugadores', 'joueurs', 'spieler'],
  tableSize: ['tablesize', 'seats', 'maxplayers', 'tamanhodamesa'],
  notes: ['sessionnote', 'notes', 'note', 'comment', 'comments', 'notas', 'nota', 'observacoes', 'comentarios', 'remarques', 'notizen'],
  tags: ['tags', 'tag', 'labels', 'etiquetas'],
  id: [],
  bankroll: [],
  country: [],
  day: [],
  makeupCut: [],
};

const ALL_SYN = new Set(Object.values(SYN).flat());

/** True for a header name (already norm()ed) that some field uses. */
export function knownHeader(h: string): boolean {
  return ALL_SYN.has(h);
}

/** Maps every field whose name appears in the header; a column is used once. */
export function autoMap(headers: string[]): Mapping {
  const n = headers.map(norm);
  const used = new Set<number>();
  const m: Mapping = {};
  for (const f of FIELDS) {
    for (const syn of SYN[f]) {
      const i = n.findIndex((h, k) => h === syn && !used.has(k));
      if (i >= 0) {
        m[f] = i;
        used.add(i);
        break;
      }
    }
  }
  // "date" and "time" in two columns, or just a start: fine. A lone "time"
  // column that means duration is caught later by its values.
  return m;
}

function idx(headers: string[], ...names: string[]): number | undefined {
  const n = headers.map(norm);
  for (const name of names) {
    const i = n.indexOf(name);
    if (i >= 0) return i;
  }
  return undefined;
}

function strip(m: Mapping): Mapping {
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)) as Mapping;
}

/** Recognises the app that wrote the file from its header (and the PBT title line). */
export function detectSource(text: string, t: Table): SourceId {
  const h = new Set(t.headers.map(norm));
  if (/PBT Bankroll Export/i.test(text.slice(0, 400)) || (h.has('starttime') && h.has('netprofit') && h.has('variant'))) return 'pbt';
  if (h.has('buyin') && h.has('totalcost') && h.has('cashout') && h.has('profit') && h.has('type')) return 'sweatbook';
  if (h.has('date') && h.has('location') && h.has('profit') && (h.has('expense') || h.has('expenses')) && !h.has('starttime')) return 'pokerbase';
  return 'generic';
}

/** Mapping for a known app; anything it doesn't cover falls back to the names. */
export function mappingFor(source: SourceId, headers: string[]): Mapping {
  const auto = autoMap(headers);
  if (source === 'pbt')
    return strip({
      start: idx(headers, 'starttime'),
      end: idx(headers, 'endtime'),
      minutes: idx(headers, 'playingminutes'),
      breakMinutes: idx(headers, 'breakminutes'),
      // PBT's "type" is the kind of venue (Casino, Club); cash or tournament is "variant".
      kind: idx(headers, 'variant'),
      // ...and "type" says Casino, Club or Online.
      format: idx(headers, 'type'),
      name: idx(headers, 'mttname'),
      game: idx(headers, 'game'),
      limit: idx(headers, 'limit'),
      sb: idx(headers, 'smallblind'),
      bb: idx(headers, 'bigblind'),
      venue: idx(headers, 'location'),
      currency: idx(headers, 'currency'),
      buyIn: idx(headers, 'buyin'),
      rebuyCost: idx(headers, 'rebuycosts'),
      addOn: idx(headers, 'addoncosts'),
      cashOut: idx(headers, 'cashout'),
      profit: idx(headers, 'netprofit'),
      expenses: idx(headers, 'expenses'),
      finish: idx(headers, 'place'),
      field: idx(headers, 'player'),
      tableSize: idx(headers, 'tablesize'),
      notes: idx(headers, 'sessionnote'),
      tags: idx(headers, 'tags'),
    });
  if (source === 'sweatbook') {
    // Files from before started_at/ended_at have the date and the start time apart.
    const exact = idx(headers, 'startedat');
    return strip({
      start: exact ?? idx(headers, 'date'),
      time: exact === undefined ? idx(headers, 'starttime') : undefined,
      end: idx(headers, 'endedat'),
      id: idx(headers, 'id'),
      bankroll: idx(headers, 'bankroll'),
      country: idx(headers, 'country'),
      day: idx(headers, 'mttday'),
      makeupCut: idx(headers, 'makeupcut'),
      hours: idx(headers, 'hours'),
      handsDealt: idx(headers, 'hands'),
      kind: idx(headers, 'type'),
      format: idx(headers, 'format'),
      name: idx(headers, 'game'),
      venue: idx(headers, 'venue'),
      currency: idx(headers, 'currency'),
      // total_cost already counts every entry and the add-on.
      buyIn: idx(headers, 'totalcost'),
      cashOut: idx(headers, 'cashout'),
      profit: idx(headers, 'profit'),
      expenses: idx(headers, 'expenses'),
      tips: idx(headers, 'tips'),
      finish: idx(headers, 'place'),
      field: idx(headers, 'field'),
      notes: idx(headers, 'notes'),
    });
  }
  return auto;
}
