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
  'late-reg-reminder': {
    slug: 'lembrete-late-reg',
    title: 'Lembrete do late reg',
    summary: 'Marque os torneios do festival e a gente avisa antes de fechar.',
    body: [
      'Sessão → Festivais → escolha o festival e toque nos eventos que você vai jogar. A gente avisa 30 min antes de cada um e antes de fechar o late reg.',
      'Se o organizador não publicou o fechamento, toque em Horário do late reg no evento. Desative em Configurações → Notificações → Torneios planejados.',
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
      { note: 'Sem tempo? Salvar agora salva a mão como está, e Voz grava uma nota de voz e salva a mão quando você para. Você termina depois.' },
    ],
  },
  'unfinished-hands': {
    slug: 'maos-incompletas',
    title: 'Mãos incompletas',
    summary: 'Fechou no meio ou salvou com pressa? Nada se perde.',
    body: [
      'Se você fechar a tela com o X depois de ter preenchido algo, a mão fica como rascunho. Na tela inicial aparece Mão incompleta: toque para continuar ou em Descartar.',
      'As mãos salvas com Salvar agora ou Voz ficam marcadas Incompleta. Há um filtro com esse nome na lista de mãos, e na página da mão o aviso Mão incompleta leva direto para a edição.',
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
      'Na página da mão, em Compartilhar, toque em Compartilhar com amigos. Quem abrir o link vê o replay street a street e pode comentar, sem o app.',
      {
        list: [
          'Desafio · Votação: o replay para antes da sua decisão e cada pessoa vota antes de ver o resto. Os votos aparecem no app, em Comentários.',
          'Story · Instagram: imagem ou vídeo para o Story (veja o artigo sobre Stories).',
          'Texto · Fórum: a mão em texto, com ou sem o link do replay.',
          'Exportar para solver: a mão em formato hand history (.txt) para solvers e trackers.',
        ],
      },
      'Compartilhar por link é ilimitado, também no plano grátis. Sem internet, o link fica pronto quando o sinal voltar.',
      { note: 'Para desativar um link: na página da mão, em Comentários, toque em Excluir compartilhamento. O link para de funcionar e os comentários são apagados; a mão continua no seu caderno.' },
    ],
  },
  comments: {
    slug: 'comentarios',
    title: 'Comentários nas mãos compartilhadas',
    summary: 'Quem abre o link comenta; você decide o que fica.',
    body: [
      'Os comentários aparecem na página da mão, em Comentários. Em cada um, Excluir tira esse comentário e Bloquear impede a pessoa de comentar de novo nessa mão (ela não é avisada).',
      'Você recebe uma notificação por mão até abrir, só com a street. Entre 23h e 12h ela espera e chega às 12h. Ative ou desative em Configurações → Notificações → Comentários nas suas mãos.',
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
      { note: 'Se você mudar o nome de usuário, o link antigo para de funcionar. Excluir perfil tira a página do ar.' },
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
      'Quando alguém ganhar prêmio, toque em Ganhei prêmio e registre o valor. O app mostra quem deve quanto a quem; quando você pagar, registre em Paguei. Compartilhar as contas manda o resumo para o outro jogador.',
      'Se você vendeu ação, o swap sai só da sua parte: seus backers continuam com a porcentagem deles do prêmio inteiro.',
      'Criar swaps e registrar resultados é grátis. O acerto (quem deve a quem) e o histórico fazem parte do Pro. Confirmar um swap pelo link é sempre grátis.',
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
      { steps: ['No celular novo, instale o Sweatbook.', 'Vá em Configurações → Backup → Restaurar com código.', 'Cole o código e toque em Restaurar.'] },
      'Você também pode salvar um arquivo: Exportar tudo cria um .json com tudo, sempre grátis. Importar arquivo junta esse arquivo ao que você já tem, sem apagar nada.',
      'O backup leva mãos, sessões, notas de jogadores, bankroll, staking e configurações. Os recibos ficam só no celular. Se aparecer "O backup é grande demais para a nuvem", use Exportar tudo.',
      'Dois celulares com o mesmo código dividem um só backup, e o último a enviar substitui o anterior. No segundo, toque primeiro em Restaurar com código: ele junta tudo e fica a versão mais recente de cada item.',
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
      'Uma mão: na página da mão, toque em Exportar para solver e depois em Copiar texto ou Salvar arquivo .txt. O formato hand history abre no GTO Wizard, PioSolver, Hold’em Manager e PokerTracker. Só funciona com mãos completas.',
      'Várias mãos de uma vez: selecione na lista de mãos e toque em Exportar para solver (Pro).',
      'Todas as sessões em CSV, grátis: Configurações → Exportar sessões em CSV. Abre no Excel e volta a entrar pelo Importar.',
      'Relatórios (Pro): Configurações → Backup → Relatório PDF e CSV. Escolha um período ou um bankroll e exporte o PDF, as sessões ou as mãos em CSV. O backup completo em .json é grátis.',
    ],
  },
  'erase-all': {
    slug: 'apagar-tudo',
    title: 'Excluir todos os meus dados',
    summary: 'Apaga tudo do celular e dos nossos servidores.',
    body: [
      'Configurações → Seus dados → Excluir todos os meus dados → Excluir tudo.',
      {
        list: [
          'No celular: mãos, sessões, notas de jogadores, bankroll, staking, configurações, o bloqueio e as notificações.',
          'Nos servidores: o backup na nuvem, os links de mãos, as páginas ao vivo, o perfil público e os links de contas. Se você estiver sem internet, é apagado quando o sinal voltar.',
        ],
      },
      'Não dá para desfazer. Se quiser guardar algo, use antes Exportar tudo.',
      'No Android, se você reinstalar o app logo depois, o backup automático do Google ainda pode trazer os dados antigos por até um dia.',
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
          'A sessão na tela de bloqueio, a calculadora de odds, o ICM e o planejador do festival com os horários.',
          'Criar swaps e registrar resultados.',
          'Compartilhar a contagem de fichas.',
          'Um bankroll e uma viagem.',
          'Exportar uma mão para solver, todas as sessões em CSV e o backup completo em .json.',
        ],
      },
      'O Pro tira o limite de mãos e adiciona: a gestão do staking (contas e extratos dos backers), o acerto e o histórico dos swaps, o relatório de impostos, o total em várias moedas, vários bankrolls com filtros, as leituras do bankroll (variância, comparação de meses e risco de ruína), o range editável, o relatório PDF e o CSV por período e das mãos, exportação de várias mãos, viagens ilimitadas e Stories com a sua voz ou o seu rosto e sem marca.',
    ],
  },
  pro: {
    slug: 'sweatbook-pro',
    title: 'Sweatbook Pro: preços e teste grátis',
    summary: 'Mensal ou anual, com 3 dias grátis no anual.',
    body: [
      { list: ['Mensal: US$ 29,99 por mês.', 'Anual: US$ 199,99 por ano, com 3 dias grátis.'] },
      'O preço na sua moeda é o que aparece na App Store ou no Google Play. O pagamento é feito pela loja e renova sozinho até você cancelar. No teste grátis, avisamos antes da cobrança.',
    ],
  },
  'restore-purchases': {
    slug: 'restaurar-compras',
    title: 'Restaurar compras',
    summary: 'Pagou o Pro e o app não reconhece?',
    body: [
      'Configurações → Assinatura → Restaurar compras (também fica no final da tela do Pro). Use a mesma conta Apple ou Google com que você pagou.',
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
          'Configurações → Assinatura → Gerenciar assinatura.',
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
    body: ['Por enquanto não há pagamento único. O plano anual é o mais barato por mês e tem 3 dias grátis.', 'O plano grátis não expira: você pode usar para sempre.'],
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
          'Configurações → Assinatura → Gerenciar assinatura.',
          'Em «Por que você quer cancelar?», escolha Não quero uma assinatura.',
          'Toque em Pagar uma vez.',
          'Depois cancele a assinatura na App Store ou no Google Play, para não pagar as duas coisas.',
        ],
      },
      { note: 'O pagamento único não cancela a assinatura sozinho. Cancele na loja logo em seguida.' },
    ],
  },
  invite: {
    slug: 'convidar-amigos',
    title: 'Convidar amigos',
    summary: 'Os dois recebem 50% no primeiro mês do Pro.',
    body: [
      'Configurações → Ferramentas → Convidar amigos → Compartilhar convite.',
      'Quando o amigo instala e salva a primeira mão nos 7 dias seguintes, os dois recebem 50% no primeiro mês do Pro, para usar nas 72 horas seguintes. No iPhone o desconto é um código da App Store que o app abre para você. Vale para até 10 amigos por ano. Só conta o primeiro convite de cada amigo.',
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
  'android-beta': {
    slug: 'testar-no-android',
    title: 'Testar o Sweatbook no Android',
    summary: 'Três passos para entrar no teste e ficar 14 dias.',
    body: [
      {
        steps: [
          'Abra o link de inscrição que mandamos, com a conta Google da Play Store (a mesma que você nos passou).',
          'Toque em Tornar-se testador.',
          'Instale o Sweatbook pela Play Store a partir desse link e abra.',
        ],
      },
      'O Google só aprova o app se todos ficarmos inscritos por 14 dias seguidos. Não saia do teste nem desinstale o app antes da data que passamos, mesmo nos dias em que você não jogar. Abrir o app e registrar uma mão já basta.',
      'Durante o teste você tem o Pro e não paga nada: sua conta está na lista de teste da loja. Se a Play Store pedir um pagamento real, não continue e escreva para a gente.',
      'Achou um erro? Um print e uma frase no grupo dos testadores, ou para support@sweatbook.poker.',
    ],
  },
};
