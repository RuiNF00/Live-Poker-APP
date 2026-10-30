// "Novidades" in Settings: newest release first. Every line must be something
// the player can find in the app today; strings are pt-PT keys for t().

export type Release = { version: string; items: { icon: string; title: string; body: string }[] };

export const WHATS_NEW: Release[] = [
  // The 1st update. Its store version may end up 1.0.1 or 1.1.0: the entry covers both (releaseFor).
  // The first line is the one on the home card.
  {
    version: '1.0.1',
    items: [
      { icon: 'cash-outline', title: 'Cash ao vivo', body: 'Rebuys do valor que meteres, mudar de stakes a meio da sessão e um stop-loss diário que já não volta a zero à meia-noite.' },
      { icon: 'analytics-outline', title: 'Análise Pro mais honesta', body: 'Win rate e variância com a margem de erro certa, e insights que dizem quando um resultado ainda pode ser sorte.' },
      { icon: 'person-outline', title: 'Notas sobre jogadores', body: 'Na sessão ao vivo, «Procurar um jogador» encontra a nota pelo nome, aspeto ou tag, mesmo sem acentos.' },
      { icon: 'pie-chart-outline', title: 'ICM e deals', body: 'Equity mais precisa e mais rápida, e um chip chop que nunca paga mais do que o 1.º prémio.' },
      { icon: 'flash-outline', title: 'Mais rápida com anos de mãos', body: 'O Resumo, a lista de Mãos e a pesquisa respondem logo, mesmo com milhares de mãos.' },
    ],
  },
  {
    version: '1.0.0',
    items: [
      { icon: 'flash-outline', title: 'Mãos em segundos', body: 'Posição, cartas e ação com poucos toques, com straddles, bomb pots e run it twice.' },
      { icon: 'play-circle-outline', title: 'Replayer e links', body: 'Revê cada mão rua a rua e partilha um link para os amigos votarem.' },
      { icon: 'folder-outline', title: 'Pastas de estudo', body: 'Toca sem largar numa mão para escolher várias e guardá-las numa pasta.' },
      { icon: 'calculator-outline', title: 'Calculadora de equity', body: 'A tua mão contra cartas ou um range, a partir do topo da lista de mãos.' },
      { icon: 'flame-outline', title: 'Semanas seguidas', body: 'Conta as semanas em que registas, com gelos que se ganham e modo pausa para viagens.' },
      { icon: 'wallet-outline', title: 'Bankroll e viagens', body: 'Resultados por sala e jogo, despesas de viagem, impostos por país e PDF para o contabilista.' },
      { icon: 'people-outline', title: 'Staking e swaps', body: 'Regista a ação vendida e os swaps confirmados por link, e acerta contas no fim. Nenhum dinheiro passa pela app.' },
      { icon: 'lock-closed-outline', title: 'Privacidade', body: 'Bloqueio da app (Face ID, impressão digital ou código) e modo que esconde os valores em toda a app.' },
    ],
  },
];
