// "Novidades" in Settings: newest release first. Every line must be something
// the player can find in the app today; strings are pt-PT keys for t().

export type Release = { version: string; items: { icon: string; title: string; body: string }[] };

export const WHATS_NEW: Release[] = [
  {
    version: '1.0.0',
    items: [
      { icon: 'flash-outline', title: 'Mãos em segundos', body: 'Posição, cartas e ação com poucos toques, com straddles, bomb pots e run it twice.' },
      { icon: 'play-circle-outline', title: 'Replayer e links', body: 'Revê cada mão rua a rua e partilha um link para os amigos votarem.' },
      { icon: 'folder-outline', title: 'Pastas de estudo', body: 'Toca sem largar numa mão para escolher várias e guardá-las numa pasta.' },
      { icon: 'calculator-outline', title: 'Calculadora de odds', body: 'A tua mão contra cartas ou um range, a partir do topo da lista de mãos.' },
      { icon: 'flame-outline', title: 'Semanas seguidas', body: 'Conta as semanas em que registas, com gelos que se ganham e modo pausa para viagens.' },
      { icon: 'wallet-outline', title: 'Bankroll e viagens', body: 'Resultados por sala e jogo, despesas de viagem, impostos por país e PDF para o contabilista.' },
      { icon: 'people-outline', title: 'Staking e swaps', body: 'Regista a ação que vendes, faz swaps confirmados por link e acerta contas no fim.' },
      { icon: 'lock-closed-outline', title: 'Privacidade', body: 'Bloqueio com Face ID e modo que esconde os valores em toda a app.' },
    ],
  },
];
