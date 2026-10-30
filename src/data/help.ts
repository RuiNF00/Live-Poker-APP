// The «?» next to a feature that isn't obvious: a title and two or three short lines.
// Strings are pt-PT keys for t(); a test checks each has English, Spanish and Brazilian text.

export const HELP = {
  icm: {
    title: 'ICM e deals',
    lines: [
      'O ICM converte as fichas em dinheiro, tendo em conta os prémios que faltam. Metade das fichas vale menos do que metade do prize pool.',
      'O chip chop dá a cada um o último prémio que falta pagar e divide o resto pelas fichas. Nunca passa do 1.º prémio.',
      'Um deal justo costuma ficar entre os dois. É só uma referência: vale o que a mesa aceitar.',
    ],
  },
  staking: {
    title: 'Como funciona o staking',
    lines: [
      'Um backer paga uma % do teu buy-in e recebe a mesma % do prémio. Com markup paga mais pela ação: 1,10 quer dizer 10% acima.',
      'Num pacote com makeup, as perdas vão-se somando e só há lucro a dividir depois de as recuperares.',
      'Os pagamentos fazem-se fora da app: aqui só registas quem pagou e quem deve.',
    ],
  },
  settle: {
    title: 'Acertar contas',
    lines: [
      'O saldo junta a parte do backer em cada prémio, menos a ação que ainda não te pagou e o que já pagaram um ao outro.',
      '«Marcar como pago» regista um só pagamento que deixa o saldo a zero. Toca numa sessão para ver as contas dela passo a passo.',
    ],
  },
  variance: {
    title: 'Variância',
    lines: [
      'O desvio padrão mede quanto um resultado costuma fugir da tua média. Quanto maior, mais longas as fases boas e as más.',
      'Com o win rate e o desvio padrão, mostramos onde fica o resultado 2 em cada 3 vezes e 19 em cada 20 vezes.',
      'Uma fase má dentro destes valores pode ser só variância, mesmo para quem ganha.',
    ],
  },
  interval: {
    title: 'Intervalo de 95%',
    lines: [
      'O teu win rate é uma estimativa feita com as sessões que jogaste. O valor verdadeiro está dentro do intervalo de 95% em 19 de cada 20 casos.',
      'Com poucas horas o intervalo é largo. Se ainda passa pelo zero, ainda não se sabe se ganhas.',
      'Encolhe com mais horas: para ficar com metade da largura são precisas 4 vezes mais horas.',
    ],
  },
  ruin: {
    title: 'Risco de ruína',
    lines: [
      'A probabilidade de perderes o bankroll todo se jogares sempre nessa stake, sem nunca descer.',
      'Usamos o limite de baixo do teu win rate e o teu desvio padrão: é a conta prudente.',
      'Mais buy-ins baixam o risco. Usamos 5% como referência para subir de stake.',
    ],
  },
  import: {
    title: 'Que ficheiros entram',
    lines: [
      'CSV de outras apps ou de uma folha de cálculo, com vírgulas ou ponto e vírgula. Do Excel, guarda primeiro como CSV.',
      'Lemos as colunas sozinhos. Se alguma ficar mal, tocas em «Rever» e escolhes a certa.',
      'Importar o mesmo ficheiro outra vez não repete sessões. Uma cópia do Sweatbook (.json) traz tudo, incluindo as mãos.',
    ],
  },
} as const;

export type HelpKey = keyof typeof HELP;
