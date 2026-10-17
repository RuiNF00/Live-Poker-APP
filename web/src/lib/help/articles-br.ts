// Brazilian Portuguese ("você") help articles, by article id. Menu labels follow the app's pt-BR strings.
import type { ArticleText } from './articles';

export const BR: Record<string, ArticleText> = {
  'getting-started': {
    slug: 'primeiros-passos',
    title: 'Primeiros passos',
    summary: 'Sem conta, sem email: você instala e registra a primeira mão.',
    body: [
      'O Sweatbook não pede conta nem email. Tudo o que você registra fica no seu celular, e só vai para a nuvem se você ativar o backup.',
      {
        steps: [
          'Na primeira vez, o app mostra uma mão de exemplo e pergunta o que você joga, quantas sessões faz e em que moeda. Você pode tocar em Pular.',
          'Toque no + no centro, embaixo (Nova mão), para registrar a primeira mão.',
          'Na tela inicial aparece o cartão Primeira semana com os próximos passos.',
        ],
      },
      'Embaixo ficam as abas Mãos, Sessão, Bankroll e Jogadores. As Configurações estão na engrenagem, no topo da aba Mãos.',
    ],
  },
  'log-a-hand': {
    slug: 'registrar-uma-mao',
    title: 'Registrar uma mão rápido',
    summary: 'Posição, duas cartas e a ação, tudo em uma tela.',
    body: [
      {
        steps: [
          'Toque no + (Nova mão).',
          'Escolha sua posição e suas duas cartas. Os folds até você são automáticos.',
          'Registre a ação com um toque por jogada. Há tamanhos prontos e atalhos como Só X paga, Todos fold e Todos check. Se alguém entrou na mão, toque no lugar dele na mesa.',
          'Quando uma rua fecha, escolha as cartas do board.',
          'No final, toque em Salvar e ver replay.',
        ],
      },
      'O jogo, os blinds e o número de jogadores aparecem no topo. Com uma sessão em andamento, a mão usa esses dados. Para mudar, toque nessa barra (Contexto da mão): torneio ou cash, sala, blinds, ante, jogadores na mesa e, em torneio, a fase, o nível e os jogadores restantes.',
      'O número de lugares padrão (6 a 10) muda em Configurações → Perfil → Jogadores na mesa.',
      { note: 'Sem tempo? Salvar já salva a mão como está, e Voz grava uma nota de voz e salva a mão quando você para. Você termina depois.' },
    ],
  },
  'unfinished-hands': {
    slug: 'maos-pela-metade',
    title: 'Mãos pela metade e a completar',
    summary: 'Fechou no meio ou salvou com pressa? Nada se perde.',
    body: [
      'Se você fechar a tela com o X depois de ter preenchido algo, a mão fica como rascunho. Na tela inicial aparece Mão pela metade: toque para continuar ou em Descartar.',
      'As mãos salvas com Salvar já ou Voz ficam marcadas A completar. Há um filtro com esse nome na lista de mãos, e na página da mão o aviso Mão a completar leva direto para a edição.',
      { note: 'No plano grátis, a 4ª mão nova do dia fica salva como rascunho até você ter mãos livres ou o Pro.' },
    ],
  },
  'straddle-bomb-pot': {
    slug: 'straddle-e-bomb-pot',
    title: 'Straddles e bomb pots',
    summary: 'No cash, escolha em Contexto da mão → Esta mão.',
    body: [
      {
        steps: [
          'Na tela da mão, toque na barra do topo (Contexto da mão).',
          'Em Esta mão, escolha Normal, Straddle, Re-straddle, Straddle no botão ou Bomb pot.',
          'No bomb pot, digite quanto cada jogador coloca (começa em 2 big blinds).',
        ],
      },
      'Essas opções aparecem só no cash.',
    ],
  },
  'run-it-twice': {
    slug: 'rodar-duas-vezes',
    title: 'Rodar duas vezes',
    summary: 'Num all-in antes do river, toque em Rodar 2 vezes.',
    body: [
      'Quando há um all-in com dois ou mais jogadores e o board ainda não está completo, aparece o botão Rodar 2 vezes (também no showdown).',
      { steps: ['Toque em Rodar 2 vezes.', 'Escolha as cartas da 2ª vez.', 'Diga quem ganhou a 1ª e a 2ª vez. O pote é dividido sozinho.'] },
    ],
  },
  'share-a-hand': {
    slug: 'compartilhar-uma-mao',
    title: 'Compartilhar uma mão',
    summary: 'Um link que os amigos abrem no navegador, sem instalar nada.',
    body: [
      'Na página da mão, em Compartilhar, toque em Compartilhar com amigos. Quem abrir o link vê o replay rua a rua e pode comentar, sem o app.',
      {
        list: [
          'Desafio · Votação: o replay para antes da sua decisão e cada pessoa vota antes de ver o resto. Os votos aparecem no app, em Comentários.',
          'Story · Instagram: imagem ou vídeo para o Story (veja o artigo sobre Stories).',
          'Texto · Fórum: a mão em texto, com ou sem o link do replay.',
          'Solver · PokerStars: a mão no formato PokerStars para solvers e trackers.',
        ],
      },
      'Compartilhar por link é ilimitado, também no plano grátis. Sem internet, o link fica pronto quando o sinal voltar.',
      { note: 'Para desativar um link: na página da mão, em Comentários, toque em Apagar link. O link para de funcionar e os comentários são apagados; a mão continua no seu caderno.' },
    ],
  },
  'what-a-link-shows': {
    slug: 'o-que-o-link-mostra',
    title: 'O que um link mostra',
    summary: 'As cartas, as fichas e suas notas. Os nomes dos outros, não.',
    body: [
      'Um link mostra a mão: as cartas, a ação, as fichas e os stacks, e o seu nome de jogador. Nunca leva a sessão, a nota de voz, suas pastas nem suas anotações sobre adversários.',
      'O resto você escolhe em Configurações → Mãos que você compartilha:',
      { list: ['Nomes dos adversários: desligado por padrão, aparecem só as posições.', 'Minhas notas da mão: ligado por padrão.'] },
      'Essas opções valem para os links novos; os que já existem continuam como estavam.',
    ],
  },
  'stories-session-card': {
    slug: 'stories-e-card-da-sessao',
    title: 'Stories e card da sessão',
    summary: 'A mão ou a sessão no Instagram, com os valores escondidos se quiser.',
    body: [
      'Mão: na página da mão, toque em Story · Instagram. Há três modos: Pergunta (para antes da decisão), Resultado e Vídeo (15 a 30 segundos, também para Reels, TikTok e WhatsApp). Precisa de internet.',
      'Sessão: no resumo da sessão, toque em Compartilhar sessão (ou abra a sessão em Bankroll e toque em Compartilhar). Escolha o visual Noite, Brasa ou Sticker (fundo transparente para colocar por cima de uma foto) e ligue Esconder valores para mostrar só horas, mãos e potes em big blinds.',
      { note: 'No Pro você pode gravar sua voz por cima e tirar a marca Sweatbook.' },
    ],
  },
  'privacy-lock': {
    slug: 'esconder-valores-e-bloquear',
    title: 'Esconder valores e bloquear o app',
    summary: 'Mostre o app na mesa sem mostrar seus números.',
    body: [
      'Configurações → Privacidade → Esconder valores: em todo o app aparece ••• no lugar do dinheiro.',
      'Configurações → Privacidade → Bloquear o app: pede Face ID, digital ou a senha do celular ao abrir e quando você volta depois de 30 segundos fora. Também dá para usar um PIN de 4 dígitos.',
      { note: 'Um PIN esquecido não tem como ser recuperado. Antes de ligar, ative o backup na nuvem e guarde o código de recuperação.' },
    ],
  },
  'public-profile': {
    slug: 'perfil-publico',
    title: 'Perfil público',
    summary: 'Uma página sua com as mãos e sessões que você escolher.',
    body: [
      'Configurações → Ferramentas → Perfil público. Escolha o nome de usuário, o nome exibido e uma bio, e toque em Criar perfil público. A página fica em sweatbook.poker/u/nome.',
      'Só entram as mãos que você já compartilhou por link e as sessões encerradas que escolher (até 30). Esconder valores tira resultados e buy-ins.',
      { note: 'Se você mudar o nome de usuário, o link antigo para de funcionar. Apagar perfil tira a página do ar.' },
    ],
  },
  staking: {
    slug: 'staking-e-backers',
    title: 'Staking: registrar a ação vendida e as contas dos backers',
    summary: 'Só registro e contas. Nenhum dinheiro passa pelo Sweatbook.',
    body: [
      'O Sweatbook guarda o que você combinou com seus backers e faz as contas. Os pagamentos continuam sendo feitos entre vocês, como sempre.',
      {
        steps: [
          'Na sessão, toque em Staking e, em Ação vendida, adicione o backer.',
          'Escolha o acordo (só esta sessão ou um pacote), a porcentagem e o markup, e se ele já pagou.',
          'Em Bankroll → Staking você vê o saldo e o makeup de cada backer, e os jogadores que você banca.',
        ],
      },
      'Para mandar as contas, abra o backer e toque em Enviar contas. O link leva só a parte desse backer (até 30 sessões), sem notas, mãos nem outros backers, e os números vão no próprio link: o servidor não vê.',
      'Link ao vivo: em Staking, toque em Criar link para esta sessão. Os backers veem o stack, o nível e o resultado atualizando, sem notas, mãos nem nomes.',
      { note: 'A gestão do staking (saldos, makeup e extratos dos backers) faz parte do Pro.' },
    ],
  },
  swaps: {
    slug: 'swaps',
    title: 'Swaps entre jogadores',
    summary: 'Os dois confirmam os termos por link; o app faz as contas.',
    body: [
      {
        steps: [
          'Em Bankroll → Swaps, toque em Novo swap.',
          'Escolha com quem, a porcentagem (desligue A mesma porcentagem para um swap desigual, por exemplo 3% por 2%) e se é para Um evento ou para a Série inteira.',
          'Toque em Criar e enviar link e mande só para o outro jogador.',
          'Ele toca em Confirmo o swap no navegador, com ou sem o app. A partir daí, os termos e o horário ficam fixados e os dois recebem o código do acordo.',
        ],
      },
      'Quando alguém forra, toque em Forrei e registre o prêmio. O app mostra quem deve quanto a quem; quando você pagar, registre em Paguei. Compartilhar as contas manda o resumo para o outro jogador.',
      'Criar swaps e fazer o acerto faz parte do Pro. Confirmar um swap pelo link é sempre grátis.',
      { note: 'Só registro e contas: nenhum dinheiro passa pelo Sweatbook, os pagamentos são feitos entre vocês. Só para maiores de 18 anos.' },
    ],
  },
  taxes: {
    slug: 'impostos',
    title: 'Impostos e recibos',
    summary: 'Resultados por país e imposto retido, prontos para o contador.',
    body: [
      'Ao editar uma sessão, toque em Impostos e recibos. Escolha o país (fica salvo para essa sala), o imposto retido na fonte e o status (A recuperar, Recuperado ou Fica pago), e anexe fotos ou arquivos dos recibos. Os recibos ficam no celular, não vão para a nuvem.',
      'O relatório fica em Configurações → Backup → Relatório PDF e CSV (Pro). O PDF tem os resultados por país e o imposto retido a recuperar.',
      { note: 'Isto não é consultoria tributária. São os números que você registrou, organizados por país. Confirme sempre com um contador.' },
    ],
  },
  backup: {
    slug: 'backup',
    title: 'Backup e celular novo',
    summary: 'Um código de recuperação e todas as suas mãos voltam.',
    body: [
      'Configurações → Backup → Ativar backup na nuvem. Você recebe um código de recuperação de 26 caracteres: guarde num lugar seguro. O backup é criptografado no celular com esse código antes de sair, e se atualiza sozinho.',
      { steps: ['No celular novo, instale o Sweatbook.', 'Vá em Configurações → Backup → Recuperar com código.', 'Cole o código e toque em Recuperar.'] },
      'Você também pode salvar um arquivo: Exportar tudo cria um .json com tudo, sempre grátis. Importar arquivo junta esse arquivo ao que você já tem, sem apagar nada.',
      { note: 'Sem o código ninguém consegue ler o backup, nem nós. Se você perder o código, não há como recuperar.' },
    ],
  },
  import: {
    slug: 'importar-de-outro-app',
    title: 'Importar de outro app',
    summary: 'Traga seu histórico de sessões e bankroll.',
    body: [
      'Configurações → Backup → Importar de outro app. Funciona com Poker Bankroll Tracker, Pokerbase, Poker Analytics, qualquer CSV (você confere as colunas antes de importar) e backups .json do Sweatbook.',
      'Entram sessões, depósitos e saques. Mãos de outros apps não são importadas.',
    ],
  },
  export: {
    slug: 'exportar',
    title: 'Exportar para solver, PDF e CSV',
    summary: 'Uma mão para o GTO Wizard ou o ano inteiro em PDF.',
    body: [
      'Uma mão: na página da mão, toque em Solver · PokerStars e depois em Copiar texto ou Salvar arquivo .txt. O formato PokerStars abre no GTO Wizard, PioSolver, Hold’em Manager e PokerTracker. Só funciona com mãos completas.',
      'Várias mãos de uma vez: selecione na lista de mãos e toque em Exportar para solver (Pro).',
      'Relatórios: Configurações → Backup → Relatório PDF e CSV. Escolha o período e exporte o relatório em PDF, ou as sessões ou as mãos em CSV (Pro). O backup completo em .json é grátis.',
    ],
  },
  'erase-all': {
    slug: 'apagar-tudo',
    title: 'Apagar todos os meus dados',
    summary: 'Apaga tudo do celular e dos nossos servidores.',
    body: [
      'Configurações → Seus dados → Apagar todos os meus dados → Apagar tudo.',
      {
        list: [
          'No celular: mãos, sessões, notas de jogadores, bankroll, staking, configurações, o bloqueio e as notificações.',
          'Nos servidores: o backup na nuvem, os links de mãos, as páginas ao vivo, o perfil público e os links de contas. Se você estiver sem internet, é apagado quando o sinal voltar.',
        ],
      },
      'Não dá para desfazer. Se quiser guardar algo, use antes Exportar tudo.',
      { note: 'Apagar os dados não cancela o Pro. Para isso, cancele na App Store ou no Google Play (veja Cancelar o Pro).' },
    ],
  },
  'free-plan': {
    slug: 'plano-gratis',
    title: 'O que tem no plano grátis',
    summary: '3 mãos novas por dia e compartilhamento ilimitado, para sempre.',
    body: [
      {
        list: [
          '3 mãos novas por dia (a 4ª fica salva como rascunho).',
          'Compartilhamento por link ilimitado, com replay e votação.',
          'Importar de outros apps.',
          'Segurança: backup na nuvem, esconder valores e bloqueio do app.',
          'A sessão na tela de bloqueio, a calculadora de odds e o planejador do festival.',
          'Um bankroll e uma viagem.',
          'Exportar uma mão para solver, e o backup completo em .json.',
        ],
      },
      'O Pro tira o limite de mãos e adiciona: vários bankrolls com filtros e o total em várias moedas, a gestão do staking (contas e extratos dos backers), o relatório de impostos, relatórios PDF e CSV, exportação de várias mãos, viagens ilimitadas e Stories com a sua voz e sem marca.',
    ],
  },
  pro: {
    slug: 'sweatbook-pro',
    title: 'Sweatbook Pro: preços e teste grátis',
    summary: 'Mensal ou anual, com 7 dias grátis no anual.',
    body: [
      { list: ['Mensal: US$ 29,99 por mês.', 'Anual: US$ 199,99 por ano, com 7 dias grátis.'] },
      'O preço na sua moeda é o que aparece na App Store ou no Google Play. O pagamento é feito pela loja e renova sozinho até você cancelar. No teste grátis, avisamos antes da cobrança.',
    ],
  },
  'restore-purchases': {
    slug: 'restaurar-compras',
    title: 'Restaurar compras',
    summary: 'Pagou o Pro e o app não reconhece?',
    body: [
      'Configurações → Conta → Restaurar compras (também fica no final da tela do Pro). Use a mesma conta Apple ou Google com que você pagou.',
      'Num celular novo, restaure primeiro as compras e depois as suas mãos com o código de recuperação (veja Backup).',
    ],
  },
  cancel: {
    slug: 'cancelar-o-pro',
    title: 'Cancelar o Pro',
    summary: 'O cancelamento é feito na loja; suas mãos ficam.',
    body: [
      {
        steps: [
          'Configurações → Conta → Sua assinatura.',
          'Toque em Cancelar na App Store (ou no Google Play). Abre a página de assinaturas da loja.',
          'Cancele lá. O Pro continua ativo até o fim do período pago.',
        ],
      },
      'Depois você volta às 3 mãos novas por dia. Nada do que você registrou é apagado.',
    ],
  },
  'no-lifetime': {
    slug: 'plano-vitalicio',
    title: 'Existe um plano vitalício?',
    summary: 'Não. Há o mensal e o anual.',
    body: ['Por enquanto não há pagamento único. O plano anual é o mais barato por mês e tem 7 dias grátis.', 'O plano grátis não expira: você pode usar para sempre.'],
  },
  lifetime: {
    slug: 'plano-vitalicio',
    title: 'Existe um plano vitalício?',
    summary: 'Existe, para quem não quer assinatura. Aparece ao cancelar.',
    body: [
      'O Pro é uma assinatura mensal ou anual. Para quem prefere pagar uma vez, existe o Pro para sempre, por US$ 499 (o preço na sua moeda é o da loja).',
      'Ele não está na tela do Pro. Aparece quando você cancela e escolhe «Não quero uma assinatura»:',
      {
        steps: [
          'Configurações → Conta → Sua assinatura.',
          'Em «Por que você quer cancelar?», escolha Não quero uma assinatura.',
          'Toque em Comprar uma vez.',
          'Depois cancele a assinatura na App Store ou no Google Play, para não pagar as duas coisas.',
        ],
      },
      { note: 'O pagamento único não cancela a assinatura sozinho. Cancele na loja logo em seguida.' },
    ],
  },
  invite: {
    slug: 'convidar-amigos',
    title: 'Convidar amigos',
    summary: 'Os dois ganham 7 dias de Pro.',
    body: [
      'Configurações → Ferramentas → Convidar amigos → Compartilhar convite.',
      'Quando o amigo instala e salva a primeira mão nos 7 dias seguintes, os dois ganham 7 dias de Pro. Você ganha com até 10 amigos por ano.',
      'Recebeu um código em vez de um link? Em Configurações, toque em Tenho um código de convite e depois em Usar (só nos primeiros 7 dias depois de instalar).',
    ],
  },
  contact: {
    slug: 'contato',
    title: 'Fale com a gente',
    summary: 'Escreva para nós; quem responde é quem faz o app.',
    body: [
      'Escreva para support@sweatbook.poker. Quem responde é quem faz o Sweatbook, normalmente em 2 dias úteis.',
      'Se for um problema, diga o modelo do celular, a versão do app (no fim das Configurações) e o que você estava fazendo. Um print da tela ajuda muito.',
      'Ideias também são bem-vindas: muitas das novidades do app vieram de pedidos de jogadores.',
      { note: 'O Sweatbook é para maiores de 18 anos. É um app de registro: não tem jogo a dinheiro e nenhum dinheiro passa por ele.' },
    ],
  },
};
