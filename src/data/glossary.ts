// One line per poker abbreviation, shown when the player taps the term.
// Strings are pt-PT keys for t(); a test checks each has English.

export const GLOSSARY = {
  VPIP: { name: 'Voluntarily put money in pot', line: 'Mãos em que pôs dinheiro no pote antes do flop sem ser obrigado (as blinds não contam).' },
  PFR: { name: 'Pre-flop raise', line: 'Mãos em que abriu ou subiu antes do flop. Perto do VPIP é agressivo; muito abaixo, paga muito.' },
  '3-bet': { name: '3-bet', line: 'Vezes que voltou a subir antes do flop, entre as vezes em que alguém abriu antes dele.' },
  SPR: { name: 'Stack-to-pot ratio', line: 'Stack efetivo a dividir pelo pote. Quanto mais baixo, mais perto do all-in está a mão.' },
  M: { name: 'M de Harrington', line: 'Quantas voltas aguentas só a pagar blinds e antes. Abaixo de 10 é hora de jogar push or fold.' },
  ICM: { name: 'Independent Chip Model', line: 'Converte fichas em dinheiro tendo em conta os prémios que faltam: duplicar o stack não duplica o valor.' },
  ROI: { name: 'Profit ÷ buy-ins', line: 'Lucro a dividir pelo total gasto em buy-ins. 20% quer dizer 20 cêntimos de lucro por cada euro de buy-in.' },
  ITM: { name: 'In the money', line: 'Percentagem de torneios em que acabaste nos prémios.' },
} as const;

export type TermKey = keyof typeof GLOSSARY;
