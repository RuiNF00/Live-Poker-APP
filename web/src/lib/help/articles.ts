// Help center articles (/ajuda in Portuguese, /help in English). Menu labels match the app's
// own strings (src/i18n): PT as written in the app, EN as in src/i18n/en.ts.
import { BR } from './articles-br';
import { ES } from './articles-es';

/** Help pages also come in Spanish and Brazilian Portuguese (the app adds both next). */
export type HelpLocale = 'pt' | 'en' | 'es' | 'br';
export const HELP_LOCALES: HelpLocale[] = ['pt', 'br', 'es', 'en'];

export type Block = string | { steps: string[] } | { list: string[] } | { note: string };

export interface ArticleText {
  slug: string;
  title: string;
  summary: string;
  body: Block[];
}

export type CategoryId = 'start' | 'hands' | 'sharing' | 'staking' | 'data' | 'plans' | 'contact';

export interface Article {
  id: string;
  cat: CategoryId;
  /** Shown only once this feature is in the store build. */
  feature?: keyof typeof LIVE_FEATURES;
  /** Shown only until this feature is in the store build. */
  unless?: keyof typeof LIVE_FEATURES;
  pt: ArticleText;
  en: ArticleText;
}

/**
 * Features whose articles wait for the store build. Both are in the integration branch now
 * (swaps #90, the cancel-flow lifetime plan #106); set one to false to hide its article.
 * closedTest: the Google Play closed test before launch (launch/plano-android.md); false once Android is public.
 */
export const LIVE_FEATURES = { swaps: true, lifetime: true, closedTest: true };

export const CATEGORIES: Record<CategoryId, Record<HelpLocale, string>> = {
  start: { pt: 'Começar', en: 'Getting started', es: 'Empezar', br: 'Começar' },
  hands: { pt: 'Registar mãos', en: 'Logging hands', es: 'Registrar manos', br: 'Registrar mãos' },
  sharing: { pt: 'Partilha e privacidade', en: 'Sharing and privacy', es: 'Compartir y privacidad', br: 'Compartilhamento e privacidade' },
  staking: { pt: 'Staking e swaps', en: 'Staking and swaps', es: 'Staking y swaps', br: 'Staking e swaps' },
  data: { pt: 'Os teus dados', en: 'Your data', es: 'Tus datos', br: 'Seus dados' },
  plans: { pt: 'Planos e pagamentos', en: 'Plans and billing', es: 'Planes y pagos', br: 'Planos e pagamentos' },
  contact: { pt: 'Contacto', en: 'Contact', es: 'Contacto', br: 'Contato' },
};

export const SUPPORT_EMAIL = 'support@sweatbook.poker';

const ARTICLES: Article[] = [
  {
    id: 'getting-started',
    cat: 'start',
    pt: {
      slug: 'primeiros-passos',
      title: 'Primeiros passos',
      summary: 'Sem conta, sem email: instalas e registas a primeira mão.',
      body: [
        'A Sweatbook não pede conta nem email. Tudo o que registas fica no teu telemóvel, e só vai para a nuvem se ligares a cópia de segurança.',
        {
          steps: [
            'Na primeira vez, a app mostra uma mão de exemplo e pergunta o que jogas, quantas sessões fazes e em que moeda. Podes tocar em Saltar.',
            'Toca no + ao centro, em baixo (Nova mão), para registar a primeira mão.',
            'No ecrã inicial aparece o cartão Primeira semana com os próximos passos.',
          ],
        },
        'Em baixo tens os separadores Mãos, Sessão, Bankroll e Jogadores. As Definições estão na roda dentada, no topo do separador Mãos.',
      ],
    },
    en: {
      slug: 'getting-started',
      title: 'Getting started',
      summary: 'No account, no email: install it and log your first hand.',
      body: [
        "Sweatbook doesn't ask for an account or an email. Everything you log stays on your phone, and only goes to the cloud if you turn on backup.",
        {
          steps: [
            'The first time, the app shows a sample hand and asks what you play, how often and in which currency. You can tap Skip.',
            'Tap the + in the middle at the bottom (New hand) to log your first hand.',
            'The home screen shows a First week card with your next steps.',
          ],
        },
        'The tabs at the bottom are Hands, Session, Bankroll and Players. Settings is the gear at the top of the Hands tab.',
      ],
    },
  },
  {
    id: 'late-reg-reminder',
    cat: 'start',
    pt: {
      slug: 'lembrete-late-reg',
      title: 'Lembrete do late reg',
      summary: 'Marca os torneios do festival e avisamos-te antes de fechar.',
      body: [
        'Sessão → Festivais → escolhe o festival e toca nos eventos que vais jogar. Avisamos-te 30 min antes de cada um e antes de fechar o late reg.',
        'Se o organizador não publicou o fecho, toca em Hora do late reg no evento. Desliga em Definições → Notificações → Torneios planeados.',
      ],
    },
    en: {
      slug: 'late-reg-reminder',
      title: 'Late reg reminder',
      summary: "Mark the festival's tournaments and we remind you before it closes.",
      body: [
        "Session → Festivals → pick the festival and tap the events you'll play. We remind you 30 min before each one and before late reg closes.",
        "If the organiser hasn't published the close, tap Late reg time on the event. Turn it off in Settings → Notifications → Planned tournaments.",
      ],
    },
  },
  {
    id: 'log-a-hand',
    cat: 'hands',
    pt: {
      slug: 'registar-uma-mao',
      title: 'Registar uma mão depressa',
      summary: 'Posição, duas cartas e a ação, tudo num ecrã.',
      body: [
        {
          steps: [
            'Toca no + (Nova mão).',
            'Escolhe a tua posição e as tuas duas cartas. Os folds até ti são automáticos.',
            'Regista a ação com um toque por jogada. Há tamanhos prontos e atalhos como Só X paga, Todos fold e Todos check. Se alguém entrou na mão, toca no lugar dele na mesa.',
            'Quando uma rua fecha, escolhe as cartas do board.',
            'No fim, toca em Guardar e ver replay.',
          ],
        },
        'O jogo, as blinds e o número de jogadores aparecem no topo. Se tiveres uma sessão a correr, a mão herda esses dados. Para mudar, toca nesse topo (Contexto da mão): torneio ou cash, sala, blinds, ante, jogadores na mesa e, em torneio, a fase, o nível e os jogadores restantes.',
        'O número de lugares por defeito (6 a 10) muda-se em Definições → Perfil → Jogadores na mesa.',
        { note: 'Sem tempo? Guardar já guarda a mão como está, e Voz grava uma nota de voz e guarda a mão quando paras. Acabas depois.' },
      ],
    },
    en: {
      slug: 'log-a-hand',
      title: 'Log a hand fast',
      summary: 'Position, two cards and the action, all on one screen.',
      body: [
        {
          steps: [
            'Tap the + (New hand).',
            'Pick your position and your two cards. Folds up to you are filled in for you.',
            'Enter the action with one tap per move. There are size presets and shortcuts such as Only X calls, Everyone folds and Check around. If someone joined the hand, tap their seat on the table.',
            'When a street closes, pick the board cards.',
            'At the end, tap Save and watch replay.',
          ],
        },
        'The game, blinds and number of players show at the top. With a session running, the hand takes them from the session. To change them, tap that top bar (Hand context): tournament or cash, room, blinds, ante, players at the table and, in tournaments, the stage, level and players left.',
        'The default number of seats (6 to 10) is in Settings → Profile → Players at the table.',
        { note: 'No time? Save now saves the hand as it is, and Voice records a voice note and saves the hand when you stop. Finish it later.' },
      ],
    },
  },
  {
    id: 'unfinished-hands',
    cat: 'hands',
    pt: {
      slug: 'maos-a-meio',
      title: 'Mãos a meio e por completar',
      summary: 'Fechaste a meio ou guardaste à pressa? Nada se perde.',
      body: [
        'Se fechares o ecrã com o X depois de teres escrito alguma coisa, a mão fica como rascunho. No ecrã inicial aparece Mão a meio: toca para continuar ou em Descartar.',
        'As mãos guardadas com Guardar já ou Voz ficam marcadas Por completar. Há um filtro com esse nome na lista de mãos, e na página da mão o aviso Mão por completar leva-te direto à edição.',
        { note: 'No plano grátis, a 4.ª mão nova do dia fica guardada como rascunho até teres mãos livres ou o Pro.' },
      ],
    },
    en: {
      slug: 'unfinished-hands',
      title: 'Unfinished hands',
      summary: 'Closed it halfway or saved in a hurry? Nothing is lost.',
      body: [
        'If you close the screen with the X after entering anything, the hand is kept as a draft. The home screen shows Unfinished hand: tap it to carry on, or Discard.',
        'Hands saved with Save now or Voice are marked Unfinished. The hands list has a filter with that name, and on the hand page the Unfinished hand banner takes you straight back to editing.',
        { note: 'On the free plan, the 4th new hand of the day is kept as a draft until you have free hands again or go Pro.' },
      ],
    },
  },
  {
    id: 'straddle-bomb-pot',
    cat: 'hands',
    pt: {
      slug: 'straddle-e-bomb-pot',
      title: 'Straddles e bomb pots',
      summary: 'Em cash game, escolhe-se em Contexto da mão → Esta mão.',
      body: [
        {
          steps: [
            'No ecrã da mão, toca no topo (Contexto da mão).',
            'Em Esta mão, escolhe Normal, Straddle, Re-straddle, Straddle no botão ou Bomb pot.',
            'No bomb pot, escreve quanto põe cada jogador (começa em 2 big blinds).',
          ],
        },
        'Estas opções aparecem só em cash game.',
      ],
    },
    en: {
      slug: 'straddles-and-bomb-pots',
      title: 'Straddles and bomb pots',
      summary: 'In cash games, set them in Hand context → This hand.',
      body: [
        {
          steps: [
            'On the hand screen, tap the top bar (Hand context).',
            'Under This hand, pick Normal, Straddle, Re-straddle, Button straddle or Bomb pot.',
            'For a bomb pot, enter what each player puts in (it starts at 2 big blinds).',
          ],
        },
        'These options show in cash games only.',
      ],
    },
  },
  {
    id: 'run-it-twice',
    cat: 'hands',
    pt: {
      slug: 'correr-duas-vezes',
      title: 'Correr duas vezes',
      summary: 'Num all-in antes do river, toca em Correr 2 vezes.',
      body: [
        'Quando há um all-in com dois ou mais jogadores e o board ainda não está completo, aparece o botão Correr 2 vezes (também no showdown).',
        {
          steps: [
            'Toca em Correr 2 vezes.',
            'Escolhe as cartas da 2.ª vez.',
            'Diz quem ganhou a 1.ª e a 2.ª vez. O pote divide-se sozinho.',
          ],
        },
      ],
    },
    en: {
      slug: 'run-it-twice',
      title: 'Run it twice',
      summary: 'In an all-in before the river, tap Run it twice.',
      body: [
        'When two or more players are all in and the board is not complete, a Run it twice button appears (at showdown too).',
        {
          steps: [
            'Tap Run it twice.',
            'Pick the cards for the second run.',
            'Say who won the first and the second run. The pot is split for you.',
          ],
        },
      ],
    },
  },
  {
    id: 'share-a-hand',
    cat: 'sharing',
    pt: {
      slug: 'partilhar-uma-mao',
      title: 'Partilhar uma mão',
      summary: 'Um link que os amigos abrem no browser, sem instalar nada.',
      body: [
        'Na página da mão, em Partilhar, toca em Partilhar com amigos. Quem abrir o link vê o replay rua a rua e pode comentar, sem app.',
        {
          list: [
            'Desafio · Votação: o replay para antes da tua decisão e cada pessoa vota antes de ver o resto. Os votos aparecem na app, em Comentários.',
            'Story · Instagram: imagem ou vídeo para a Story (ver o artigo sobre Stories).',
            'Texto · Fórum: a mão em texto, com ou sem o link do replay.',
            'Exportar para solver: a mão em formato hand history (.txt) para solvers e trackers.',
          ],
        },
        'Partilhar por link é ilimitado, também no plano grátis. Sem rede, o link fica pronto quando houver sinal.',
        { note: 'Para desligar um link: na página da mão, em Comentários, toca em Apagar partilha. O link deixa de funcionar e os comentários são apagados; a mão fica no teu caderno.' },
      ],
    },
    en: {
      slug: 'share-a-hand',
      title: 'Share a hand',
      summary: 'A link your friends open in the browser, no app needed.',
      body: [
        'On the hand page, under Share, tap Share with friends. Whoever opens the link sees the replay street by street and can comment, without the app.',
        {
          list: [
            'Challenge · Poll: the replay stops before your decision and everyone votes before seeing the rest. Votes show in the app under Comments.',
            'Story · Instagram: an image or video for your Story (see the Stories article).',
            'Text · Forum: the hand as text, with or without the replay link.',
            'Export for solver: the hand in hand history format (.txt) for solvers and trackers.',
          ],
        },
        'Link sharing is unlimited, on the free plan too. Offline, the link is ready once you have signal.',
        { note: 'To turn a link off: on the hand page, under Comments, tap Delete share. The link stops working and the comments are deleted; the hand stays in your notebook.' },
      ],
    },
  },
  {
    id: 'comments',
    cat: 'sharing',
    pt: {
      slug: 'comentarios',
      title: 'Comentários nas mãos partilhadas',
      summary: 'Quem abre o link comenta; tu decides o que fica.',
      body: [
        'Os comentários aparecem na página da mão, em Comentários. Em cada um, Apagar tira esse comentário e Bloquear impede a pessoa de voltar a comentar nesta mão (ela não é avisada).',
        'Recebes uma notificação por mão até a abrires, só com a street. Entre as 23h e as 12h fica à espera e chega às 12h. Liga ou desliga em Definições → Notificações → Comentários nas tuas mãos.',
      ],
    },
    en: {
      slug: 'comments',
      title: 'Comments on shared hands',
      summary: 'Whoever opens the link can comment; you decide what stays.',
      body: [
        'Comments show on the hand page, under Comments. On each one, Delete removes that comment and Block stops that person commenting on this hand again (they are not told).',
        'You get one notification per hand until you open it, naming only the street. Between 11 pm and 12 noon it waits and arrives at noon. Turn it on or off in Settings → Notifications → Comments on your hands.',
      ],
    },
  },
  {
    id: 'what-a-link-shows',
    cat: 'sharing',
    pt: {
      slug: 'o-que-o-link-mostra',
      title: 'O que um link mostra',
      summary: 'As cartas, as fichas e as tuas notas. Os nomes dos outros não.',
      body: [
        'Um link mostra a mão: as cartas, a ação, as fichas e os stacks, e o teu nome de jogador. Nunca leva a sessão, a nota de voz, as pastas nem as fichas dos adversários.',
        'Escolhes o resto em Definições → Mãos que partilhas:',
        {
          list: [
            'Nomes dos adversários: desligado por defeito, aparecem só as posições.',
            'As minhas notas da mão: ligado por defeito.',
          ],
        },
        'Estas opções contam para os links novos; os que já existem ficam como estavam.',
      ],
    },
    en: {
      slug: 'what-a-link-shows',
      title: 'What a link shows',
      summary: "Cards, chips and your notes. Other players' names, no.",
      body: [
        "A link shows the hand: cards, action, chips and stacks, and your player name. It never includes the session, the voice note, your folders or your notes on opponents.",
        'You choose the rest in Settings → Hands you share:',
        {
          list: [
            "Opponents' names: off by default, only positions show.",
            'My notes on the hand: on by default.',
          ],
        },
        'These settings apply to new links; existing ones stay as they were.',
      ],
    },
  },
  {
    id: 'stories-session-card',
    cat: 'sharing',
    pt: {
      slug: 'stories-e-cartao-da-sessao',
      title: 'Stories e cartão da sessão',
      summary: 'A mão ou a sessão no Instagram, com os valores escondidos se quiseres.',
      body: [
        'Mão: na página da mão, toca em Story · Instagram. Há três modos: Pergunta (para antes da decisão), Resultado e Vídeo (15 a 30 segundos, também para Reels, TikTok e WhatsApp). Precisa de rede.',
        'Sessão: no resumo da sessão, toca em Partilhar sessão (ou em Bankroll, abre a sessão e toca em Partilhar). Escolhe o look Noite, Brasa ou Sticker (fundo transparente para pôr por cima de uma foto) e liga Esconder valores para mostrar só horas, mãos e potes em big blinds.',
        { note: 'No Pro podes gravar a tua voz por cima e tirar a marca Sweatbook.' },
      ],
    },
    en: {
      slug: 'stories-and-session-cards',
      title: 'Stories and session cards',
      summary: 'Your hand or session on Instagram, with amounts hidden if you like.',
      body: [
        'Hand: on the hand page, tap Story · Instagram. There are three modes: Question (stops before your decision), Result and Video (15 to 30 seconds, also for Reels, TikTok and WhatsApp). It needs a connection.',
        'Session: on the session summary, tap Share session (or open the session in Bankroll and tap Share). Pick the Noite, Brasa or Sticker look (transparent, to put over a photo) and turn on Hide amounts to show only hours, hands and pots in big blinds.',
        { note: 'With Pro you can add your voice and remove the Sweatbook brand.' },
      ],
    },
  },
  {
    id: 'privacy-lock',
    cat: 'sharing',
    pt: {
      slug: 'esconder-valores-e-bloquear',
      title: 'Esconder valores e bloquear a app',
      summary: 'Mostra a app à mesa sem mostrar os teus números.',
      body: [
        'Definições → Privacidade → Esconder valores: em toda a app aparece ••• em vez de dinheiro.',
        'Definições → Privacidade → Bloquear a app: pede Face ID, impressão digital ou o código do telemóvel ao abrir e quando voltas depois de 30 segundos fora. Também podes usar um PIN de 4 dígitos.',
        { note: 'Um PIN esquecido não se recupera. Antes de o ligar, ativa a cópia na nuvem e guarda o código de recuperação.' },
      ],
    },
    en: {
      slug: 'hide-amounts-and-app-lock',
      title: 'Hide amounts and lock the app',
      summary: 'Show the app at the table without showing your numbers.',
      body: [
        'Settings → Privacy → Hide amounts: the whole app shows ••• instead of money.',
        "Settings → Privacy → Lock the app: asks for Face ID, fingerprint or your phone's passcode when the app opens and when you come back after 30 seconds away. You can also use a 4-digit PIN.",
        { note: "A forgotten PIN can't be recovered. Before turning it on, enable cloud backup and keep the recovery code." },
      ],
    },
  },
  {
    id: 'public-profile',
    cat: 'sharing',
    pt: {
      slug: 'perfil-publico',
      title: 'Perfil público',
      summary: 'Uma página tua com as mãos e sessões que escolheres.',
      body: [
        'Definições → Ferramentas → Perfil público. Escolhe o nome de utilizador, o nome a mostrar e uma bio, e toca em Criar perfil público. A página fica em sweatbook.poker/u/nome.',
        'Só entram as mãos que já partilhaste por link e as sessões terminadas que escolheres (até 30). Esconder montantes tira resultados e buy-ins.',
        { note: 'Se mudares o nome de utilizador, o link antigo deixa de funcionar. Apagar perfil tira a página do ar.' },
      ],
    },
    en: {
      slug: 'public-profile',
      title: 'Public profile',
      summary: 'A page of your own with the hands and sessions you pick.',
      body: [
        'Settings → Tools → Public profile. Choose a username, display name and bio, and tap Create public profile. The page lives at sweatbook.poker/u/name.',
        'Only hands you already shared by link and finished sessions you pick are included (up to 30). Hide amounts removes results and buy-ins.',
        { note: 'If you change the username, the old link stops working. Delete profile takes the page down.' },
      ],
    },
  },
  {
    id: 'staking',
    cat: 'staking',
    pt: {
      slug: 'staking-e-backers',
      title: 'Staking: registar ação vendida e as contas dos backers',
      summary: 'Registo e contas apenas. Nenhum dinheiro passa pela Sweatbook.',
      body: [
        'A Sweatbook guarda o que combinaste com os teus backers e faz as contas. Os pagamentos continuam a ser feitos por vocês, como sempre.',
        {
          steps: [
            'Na sessão, toca em Staking e, em Ação vendida, adiciona o backer.',
            'Escolhe o acordo (só esta sessão ou um pacote), a percentagem e o markup, e se já pagou.',
            'Em Bankroll → Staking vês o saldo e o makeup de cada backer, e os jogadores que tu bancas.',
          ],
        },
        'Para mandar as contas, abre o backer e toca em Enviar contas. O link leva só a parte desse backer (até 30 sessões), sem notas, mãos nem outros backers, e os números vão no próprio link: o servidor não os vê.',
        'Link em direto: em Staking, toca em Criar link para esta sessão. Os backers veem o stack, o nível e o resultado a atualizar, sem notas, mãos nem nomes.',
        { note: 'A gestão do staking (saldos, makeup e extratos dos backers) faz parte do Pro.' },
      ],
    },
    en: {
      slug: 'staking-and-backers',
      title: 'Staking: log the action you sold and your backer accounts',
      summary: 'Records and accounts only. No money moves through Sweatbook.',
      body: [
        "Sweatbook keeps what you agreed with your backers and does the maths. Payments are still made between you, as always.",
        {
          steps: [
            'In the session, tap Staking and, under Action sold, add the backer.',
            'Choose the deal (this session only or a package), the percentage and markup, and whether they have paid.',
            'Bankroll → Staking shows each backer’s balance and makeup, and the players you back.',
          ],
        },
        "To send the accounts, open the backer and tap Send statement. The link carries only that backer's part (up to 30 sessions), with no notes, hands or other backers, and the numbers ride in the link itself: the server never sees them.",
        'Live link: in Staking, tap Create a link for this session. Backers see your stack, level and result update, with no notes, hands or names.',
        { note: 'Staking management (backer balances, makeup and statements) is part of Pro.' },
      ],
    },
  },
  {
    id: 'swaps',
    cat: 'staking',
    feature: 'swaps',
    pt: {
      slug: 'swaps',
      title: 'Swaps entre jogadores',
      summary: 'Os dois confirmam os termos por link; a app faz as contas.',
      body: [
        {
          steps: [
            'Em Bankroll → Swaps, toca em Novo swap.',
            'Escolhe com quem, a percentagem (desliga A mesma percentagem para um swap desigual, por exemplo 3% por 2%) e se é para Um evento ou para a Série inteira.',
            'Toca em Criar e enviar link e manda-o só ao outro jogador.',
            'Ele toca em Confirmo o swap no browser, com ou sem a app. A partir daí, os termos e a hora ficam fixados e os dois recebem o código do acordo.',
          ],
        },
        'Quando alguém cobra, toca em Cobrei e regista o prémio. A app diz quem deve quanto a quem; quando pagares, regista em Paguei. Partilhar as contas manda o resumo ao outro jogador.',
        'Se vendeste ação, o swap sai só da tua parte: os teus backers continuam com a percentagem deles do prémio inteiro.',
        'Criar swaps e registar resultados é grátis. O acerto (quem deve a quem) e o histórico fazem parte do Pro. Confirmar um swap pelo link é sempre grátis.',
        { note: 'Registo e contas apenas: nenhum dinheiro passa pela Sweatbook, os pagamentos fazem-se entre vocês. Só para maiores de 18 anos.' },
      ],
    },
    en: {
      slug: 'swaps',
      title: 'Swaps between players',
      summary: 'You both confirm the terms by link; the app does the maths.',
      body: [
        {
          steps: [
            'In Bankroll → Swaps, tap New swap.',
            'Pick who with, the percentage (turn off Same percentage for an uneven swap, say 3% for 2%) and whether it covers One event or the Whole series.',
            'Tap Create and send link and send it only to the other player.',
            'They tap I confirm the swap in the browser, with or without the app. From then on the terms and time are fixed and you both get the deal code.',
          ],
        },
        'When someone cashes, tap I cashed and log the prize. The app shows who owes whom; when you pay, log it under I paid. Share the balance sends the summary to the other player.',
        'If you sold action, the swap comes only out of your own share: your backers keep their percentage of the whole prize.',
        'Creating swaps and recording results is free. Settling up (who owes whom) and the history are part of Pro. Confirming a swap by link is always free.',
        { note: 'Records and accounts only: no money moves through Sweatbook, payments are made between you. 18+ only.' },
      ],
    },
  },
  {
    id: 'taxes',
    cat: 'data',
    pt: {
      slug: 'impostos',
      title: 'Impostos e recibos',
      summary: 'Resultados por país e imposto retido, prontos para o contabilista.',
      body: [
        'Ao editar uma sessão, toca em Impostos e recibos. Escolhe o país (fica guardado para essa sala), o imposto retido na fonte e o estado (A recuperar, Recuperado ou Fica pago), e junta fotos ou ficheiros dos recibos. Os recibos ficam no telemóvel, não vão para a nuvem.',
        'O relatório está em Definições → Cópia de segurança → Relatório PDF e CSV (Pro). O PDF tem os resultados por país e o imposto retido a recuperar.',
        { note: 'Isto não é aconselhamento fiscal. São os números que registaste, arrumados por país. Confirma sempre com um contabilista.' },
      ],
    },
    en: {
      slug: 'taxes',
      title: 'Taxes and receipts',
      summary: 'Results by country and tax withheld, ready for your accountant.',
      body: [
        "When editing a session, tap Taxes and receipts. Pick the country (remembered for that venue), the tax withheld and its status (To recover, Recovered or Stays paid), and attach photos or files of your receipts. Receipts stay on the phone; they don't go to the cloud.",
        'The report is in Settings → Backup → PDF report and CSV (Pro). The PDF shows results by country and withheld tax to recover.',
        { note: "This isn't tax advice. It's the numbers you logged, sorted by country. Always check with an accountant." },
      ],
    },
  },
  {
    id: 'backup',
    cat: 'data',
    pt: {
      slug: 'copia-de-seguranca',
      title: 'Cópia de segurança e telemóvel novo',
      summary: 'Um código de recuperação e as tuas mãos voltam todas.',
      body: [
        'Definições → Cópia de segurança → Ativar cópia na nuvem. Recebes um código de recuperação de 26 caracteres: guarda-o num sítio seguro. A cópia é cifrada no telemóvel com esse código antes de sair, e atualiza-se sozinha.',
        {
          steps: [
            'No telemóvel novo, instala a Sweatbook.',
            'Vai a Definições → Cópia de segurança → Recuperar com código.',
            'Cola o código e toca em Recuperar.',
          ],
        },
        'Também podes guardar um ficheiro: Exportar tudo cria um .json com tudo, sempre grátis. Importar ficheiro junta esse ficheiro ao que já tens, sem apagar nada.',
        'A cópia leva mãos, sessões, notas de jogadores, bankroll, staking e definições. Os recibos ficam só no telemóvel. Se aparecer «A cópia é grande demais para a nuvem», usa Exportar tudo.',
        'Dois telemóveis com o mesmo código partilham uma só cópia, e o último a enviar substitui a anterior. No segundo, toca primeiro em Recuperar com código: junta tudo e fica a versão mais recente de cada item.',
        { note: 'Sem o código ninguém consegue ler a cópia, nem nós. Se o perderes, não há forma de a recuperar.' },
      ],
    },
    en: {
      slug: 'backup-and-new-phone',
      title: 'Backup and moving to a new phone',
      summary: 'One recovery code and all your hands come back.',
      body: [
        'Settings → Backup → Turn on cloud backup. You get a 26-character recovery code: keep it somewhere safe. The backup is encrypted on your phone with that code before it leaves, and it updates by itself.',
        {
          steps: [
            'On the new phone, install Sweatbook.',
            'Go to Settings → Backup → Restore with code.',
            'Paste the code and tap Restore.',
          ],
        },
        'You can also keep a file: Export everything creates a .json with all your data, always free. Import file adds that file to what you already have, without deleting anything.',
        'The backup holds hands, sessions, player notes, bankroll, staking and settings. Receipts stay on the phone only. If you see "The backup is too big for the cloud", use Export everything.',
        'Two phones with the same code share one backup, and the last one to upload replaces it. On the second phone, tap Restore with code first: it merges everything and keeps the newest version of each item.',
        { note: "Without the code nobody can read the backup, us included. If you lose it, the backup can't be recovered." },
      ],
    },
  },
  {
    id: 'import',
    cat: 'data',
    pt: {
      slug: 'importar-de-outra-app',
      title: 'Importar de outra app',
      summary: 'Traz o teu histórico de sessões e bankroll.',
      body: [
        'Definições → Cópia de segurança → Importar. Escolhe a app de onde vens, ou «Outra app ou Excel» para qualquer CSV, e o ficheiro que essa app exportou (até 20 MB). Também lê cópias .json da Sweatbook.',
        'Antes de importar vês as colunas que lemos e podes mudar qualquer uma. Datas em vários formatos, vírgula ou ponto nos decimais, vírgula, ponto e vírgula ou tab entre colunas e várias moedas são lidos sozinhos, e cada moeda fica na sua banca.',
        'Entram sessões, depósitos e levantamentos. Mãos de outras apps não são importadas.',
        {
          list: [
            'Nada é apagado nem alterado: o que importas junta-se ao que já tens. Importar o mesmo ficheiro outra vez não duplica nada.',
            'Uma sessão com o mesmo dia e o mesmo resultado de uma que já tens (a mesma noite registada nas duas apps, por exemplo) fica de fora. Para a importar na mesma, toca nela, ou liga «Importar também as que parecem repetidas».',
            'Uma linha que não dá para ler fica de fora com o número e o motivo: sem data, data que não se lê, valor que não é um número, linha incompleta (partida em duas), sessão que acaba mais de 14 dias depois de começar, ou sessão ainda a decorrer. Corrige o ficheiro e importa outra vez: o que já entrou não se repete.',
            'Se alguma coisa não ficar bem lida, toca em «Enviar ao suporte» no ecrã de importação.',
          ],
        },
      ],
    },
    en: {
      slug: 'import-from-another-app',
      title: 'Import from another app',
      summary: 'Bring your session and bankroll history.',
      body: [
        'Settings → Backup → Import. Pick the app you are coming from, or «Another app or Excel» for any CSV, and the file that app exported (up to 20 MB). Sweatbook .json backups work too.',
        'Before importing you see the columns we read, and you can change any of them. Dates in many formats, comma or point decimals, comma, semicolon or tab between columns and several currencies are read on their own, and each currency goes to its own bankroll.',
        "Sessions, deposits and withdrawals come in. Hands from other apps aren't imported.",
        {
          list: [
            'Nothing is deleted or changed: what you import is added to what you already have. Importing the same file again adds nothing twice.',
            'A session on the same day and with the same result as one you already have (the same night logged in both apps, for example) is left out. To import it anyway, tap it, or turn on «Also import the ones that look repeated».',
            "A row that can't be read is left out with its line number and the reason: no date, a date that can't be read, a value that isn't a number, an incomplete line (split in two), a session that ends more than 14 days after it starts, or a session still running. Fix the file and import again: what already came in isn't repeated.",
            "If something isn't read right, tap «Send to support» on the import screen.",
          ],
        },
      ],
    },
  },
  {
    id: 'export',
    cat: 'data',
    pt: {
      slug: 'exportar',
      title: 'Exportar para solver, PDF e CSV',
      summary: 'Uma mão para o GTO Wizard ou o ano inteiro em PDF.',
      body: [
        'Uma mão: na página da mão, toca em Exportar para solver e depois Copiar texto ou Guardar ficheiro .txt. O formato hand history abre no GTO Wizard, PioSolver, Hold’em Manager e PokerTracker. Só funciona com mãos completas.',
        'Várias mãos de uma vez: seleciona-as na lista de mãos e toca em Exportar para solver (Pro).',
        'Todas as sessões em CSV, grátis: Definições → Exportar sessões em CSV. Abre no Excel e volta a entrar pelo Importar.',
        'Relatórios (Pro): Definições → Cópia de segurança → Relatório PDF e CSV. Escolhe um período ou um bankroll e exporta o PDF, as sessões ou as mãos em CSV. A cópia completa em .json é grátis.',
      ],
    },
    en: {
      slug: 'export',
      title: 'Export to solvers, PDF and CSV',
      summary: 'One hand for GTO Wizard or the whole year as a PDF.',
      body: [
        'One hand: on the hand page, tap Export for solver, then Copy text or Save .txt file. The hand history format opens in GTO Wizard, PioSolver, Hold’em Manager and PokerTracker. Complete hands only.',
        'Several hands at once: select them in the hands list and tap Export for solver (Pro).',
        'Every session as CSV, free: Settings → Export sessions as CSV. It opens in Excel and comes back in through Import.',
        'Reports (Pro): Settings → Backup → PDF report and CSV. Pick a period or a bankroll and export the PDF, sessions or hands as CSV. The full .json copy is free.',
      ],
    },
  },
  {
    id: 'erase-all',
    cat: 'data',
    pt: {
      slug: 'apagar-tudo',
      title: 'Apagar todos os meus dados',
      summary: 'Apaga tudo do telemóvel e dos nossos servidores.',
      body: [
        'Definições → Os teus dados → Apagar todos os meus dados → Apagar tudo.',
        {
          list: [
            'No telemóvel: mãos, sessões, notas de jogadores, bankroll, staking, definições, o bloqueio e as notificações.',
            'Nos servidores: a cópia na nuvem, os links de mãos, as páginas em direto, o perfil público e os links de contas. Se estiveres sem rede, é apagado quando voltar o sinal.',
          ],
        },
        'Não se pode desfazer. Faz antes uma cópia com Exportar tudo se quiseres guardar alguma coisa.',
        'No Android, se reinstalares a app logo a seguir, a cópia automática do Google pode ainda trazer os dados antigos durante um dia.',
        { note: 'Apagar os dados não cancela o Pro. Para isso, cancela na App Store ou no Google Play (ver Cancelar o Pro).' },
      ],
    },
    en: {
      slug: 'erase-all',
      title: 'Delete all my data',
      summary: 'Deletes everything from your phone and our servers.',
      body: [
        'Settings → Your data → Delete all my data → Delete everything.',
        {
          list: [
            'On the phone: hands, sessions, player notes, bankroll, staking, settings, app lock and notifications.',
            "On our servers: the cloud backup, hand links, live pages, public profile and statement links. If you're offline, they're deleted once you have signal.",
          ],
        },
        "It can't be undone. Use Export everything first if you want to keep anything.",
        "On Android, if you reinstall the app right away, Google's automatic backup may still bring back the old data for about a day.",
        { note: "Deleting your data doesn't cancel Pro. To do that, cancel in the App Store or Google Play (see Cancel Pro)." },
      ],
    },
  },
  {
    id: 'free-plan',
    cat: 'plans',
    pt: {
      slug: 'plano-gratis',
      title: 'O que tem o plano grátis',
      summary: '3 mãos novas por dia e partilha ilimitada, para sempre.',
      body: [
        {
          list: [
            '3 mãos novas por dia (a 4.ª fica guardada como rascunho).',
            'Partilha por link ilimitada, com replay e votação.',
            'Importar de outras apps.',
            'Segurança: cópia na nuvem, esconder valores e bloqueio da app.',
            'A sessão no ecrã bloqueado, a calculadora de odds, o ICM e o planeador do festival com os horários.',
            'Criar swaps e registar resultados.',
            'Partilhar a contagem de fichas.',
            'Um bankroll e uma viagem.',
            'Exportar uma mão para solver, todas as sessões em CSV e a cópia completa em .json.',
          ],
        },
        'O Pro tira o limite de mãos e junta: a gestão do staking (contas e extratos dos backers), o acerto e o histórico dos swaps, o relatório de impostos, o total em várias moedas, vários bankrolls com filtros, as leituras do bankroll (variância, comparação de meses e risco de ruína), o range editável, o relatório PDF e o CSV por período e das mãos, exportação de várias mãos, viagens ilimitadas e Stories com a tua voz ou a tua cara e sem marca.',
      ],
    },
    en: {
      slug: 'free-plan',
      title: "What's in the free plan",
      summary: '3 new hands a day and unlimited sharing, forever.',
      body: [
        {
          list: [
            '3 new hands a day (the 4th is kept as a draft).',
            'Unlimited link sharing, with replay and voting.',
            'Import from other apps.',
            'Security: cloud backup, hide amounts and app lock.',
            'Your session on the lock screen, the odds calculator, ICM and the festival planner with schedules.',
            'Creating swaps and recording results.',
            'Sharing your chip count.',
            'One bankroll and one trip.',
            'Single-hand solver export, every session as CSV and the full .json copy.',
          ],
        },
        'Pro removes the hand limit and adds: staking management (backer accounts and statements), swap settlement and history, the tax report, a total across currencies, multiple bankrolls with filters, bankroll insights (variance, month comparison and risk of ruin), the editable range, the PDF report and CSV by period and of hands, multi-hand export, unlimited trips and Stories with your voice or your face and no brand.',
      ],
    },
  },
  {
    id: 'pro',
    cat: 'plans',
    pt: {
      slug: 'sweatbook-pro',
      title: 'Sweatbook Pro: preços e teste grátis',
      summary: 'Mensal ou anual, com 3 dias grátis no anual.',
      body: [
        {
          list: [
            'Mensal: 29,99 US$ por mês.',
            'Anual: 199,99 US$ por ano, com 3 dias grátis.',
          ],
        },
        'O preço na tua moeda é o que aparece na App Store ou no Google Play. O pagamento é feito pela loja e renova sozinho até cancelares. No teste grátis, avisamos antes da cobrança.',
      ],
    },
    en: {
      slug: 'sweatbook-pro',
      title: 'Sweatbook Pro: prices and free trial',
      summary: 'Monthly or yearly, with 3 days free on the annual plan.',
      body: [
        {
          list: [
            'Monthly: US$29.99 a month.',
            'Annual: US$199.99 a year, with 3 days free.',
          ],
        },
        "The price in your currency is the one the App Store or Google Play shows. Payment goes through the store and renews until you cancel. During the free trial we remind you before you're charged.",
      ],
    },
  },
  {
    id: 'restore-purchases',
    cat: 'plans',
    pt: {
      slug: 'restaurar-compras',
      title: 'Restaurar compras',
      summary: 'Pagaste o Pro e a app não o reconhece?',
      body: [
        'Definições → Subscrição → Restaurar compras (também está no fundo do ecrã do Pro). Usa a mesma conta Apple ou Google com que pagaste.',
        'Num telemóvel novo, restaura primeiro as compras e depois as tuas mãos com o código de recuperação (ver Cópia de segurança).',
      ],
    },
    en: {
      slug: 'restore-purchases',
      title: 'Restore purchases',
      summary: "Paid for Pro and the app doesn't see it?",
      body: [
        'Settings → Subscription → Restore purchases (also at the bottom of the Pro screen). Use the same Apple or Google account you paid with.',
        'On a new phone, restore purchases first and then your hands with your recovery code (see Backup).',
      ],
    },
  },
  {
    id: 'cancel',
    cat: 'plans',
    pt: {
      slug: 'cancelar-o-pro',
      title: 'Cancelar o Pro',
      summary: 'Cancela-se na loja; as tuas mãos ficam.',
      body: [
        {
          steps: [
            'Definições → Subscrição → Gerir subscrição.',
            'Toca em Cancelar na App Store / Google Play. Abre a página de subscrições da loja.',
            'Cancela lá. O Pro fica ativo até ao fim do período pago.',
          ],
        },
        'Depois voltas às 3 mãos novas por dia. Nada do que registaste é apagado.',
      ],
    },
    en: {
      slug: 'cancel-pro',
      title: 'Cancel Pro',
      summary: 'You cancel in the store; your hands stay.',
      body: [
        {
          steps: [
            'Settings → Subscription → Manage subscription.',
            "Tap Cancel in the App Store (or Google Play). It opens the store's subscriptions page.",
            'Cancel there. Pro stays on until the end of the period you paid for.',
          ],
        },
        "After that you're back to 3 new hands a day. Nothing you logged is deleted.",
      ],
    },
  },
  {
    id: 'no-lifetime',
    cat: 'plans',
    unless: 'lifetime',
    pt: {
      slug: 'plano-vitalicio',
      title: 'Há um plano vitalício?',
      summary: 'Não. Há o mensal e o anual.',
      body: [
        'Por agora não há pagamento único. O plano anual é o mais barato por mês e tem 3 dias grátis.',
        'O plano grátis não tem prazo: podes usá-lo para sempre.',
      ],
    },
    en: {
      slug: 'lifetime-plan',
      title: 'Is there a lifetime plan?',
      summary: 'No. There are monthly and annual plans.',
      body: [
        "There's no one-off payment for now. The annual plan is the cheapest per month and has 3 days free.",
        "The free plan doesn't expire: you can use it forever.",
      ],
    },
  },
  {
    id: 'lifetime',
    cat: 'plans',
    feature: 'lifetime',
    pt: {
      slug: 'plano-vitalicio',
      title: 'Há um plano vitalício?',
      summary: 'Há, para quem não quer uma subscrição. Aparece ao cancelar.',
      body: [
        'O Pro é uma subscrição mensal ou anual. Para quem prefere pagar uma vez, há o Pro para sempre. O preço é o que a loja mostra na tua moeda.',
        'Não está no ecrã do Pro. Aparece quando cancelas e escolhes «Não quero uma subscrição»:',
        {
          steps: [
            'Definições → Subscrição → Gerir subscrição.',
            'Em «Porque queres cancelar?», escolhe Não quero uma subscrição.',
            'Toca em Pagar uma vez.',
            'Depois cancela a subscrição na App Store ou no Google Play, para não pagares as duas coisas.',
          ],
        },
        { note: 'O pagamento único não cancela a subscrição sozinho. Cancela-a na loja logo a seguir.' },
      ],
    },
    en: {
      slug: 'lifetime-plan',
      title: 'Is there a lifetime plan?',
      summary: "Yes, for people who don't want a subscription. It shows when you cancel.",
      body: [
        'Pro is a monthly or annual subscription. If you prefer to pay once, there is Pro for good. The price is the one the store shows in your currency.',
        "It isn't on the Pro screen. It shows when you cancel and pick “I don't want a subscription”:",
        {
          steps: [
            'Settings → Subscription → Manage subscription.',
            "Under “Why do you want to cancel?”, pick I don't want a subscription.",
            'Tap Pay once.',
            "Then cancel the subscription in the App Store or Google Play, so you don't pay for both.",
          ],
        },
        { note: "The one-off payment doesn't cancel the subscription by itself. Cancel it in the store right after." },
      ],
    },
  },
  {
    id: 'invite',
    cat: 'plans',
    pt: {
      slug: 'convidar-amigos',
      title: 'Convidar amigos',
      summary: 'Os dois recebem 50% no primeiro mês do Pro.',
      body: [
        'Definições → Ferramentas → Convidar amigos → Partilhar convite.',
        'Quando o amigo instala e guarda a primeira mão nos 7 dias seguintes, os dois recebem 50% no primeiro mês do Pro, para usar nas 72 horas seguintes. No iPhone o desconto é um código da App Store que a app abre por ti. Conta para até 10 amigos por ano.',
        'O amigo recebeu um código em vez de um link? Em Definições, toca em Tenho um código de convite e depois em Usar (só nos primeiros 7 dias depois de instalar).',
      ],
    },
    en: {
      slug: 'invite-friends',
      title: 'Invite friends',
      summary: 'You both get 50% off your first month of Pro.',
      body: [
        'Settings → Tools → Invite friends → Share invite.',
        'When your friend installs and saves a first hand within 7 days, you both get 50% off your first month of Pro, to use within the next 72 hours. On iPhone the discount is an App Store code the app opens for you. It counts for up to 10 friends a year.',
        'Got a code instead of a link? In Settings, tap I have an invite code, then Use (only in the first 7 days after installing).',
      ],
    },
  },
  {
    id: 'android-beta',
    cat: 'start',
    feature: 'closedTest',
    pt: {
      slug: 'testar-no-android',
      title: 'Testar a Sweatbook no Android',
      summary: 'Três passos para entrar no teste e ficar 14 dias.',
      body: [
        {
          steps: [
            'Abre o link de adesão que te enviámos, com a conta Google da Play Store (a mesma que nos deste).',
            'Toca em Tornar-me testador.',
            'Instala a Sweatbook na Play Store a partir desse link e abre-a.',
          ],
        },
        'A Google só aprova a app se todos ficarmos inscritos durante 14 dias seguidos. Não saias do teste nem desinstales a app até à data que te demos, mesmo nos dias em que não jogas. Abrir a app e registar uma mão chega.',
        'Durante o teste tens o Pro e não pagas nada: a tua conta está na lista de teste da loja. Se a Play Store te pedir um pagamento real, não continues e escreve-nos.',
        `Encontraste um erro? Uma captura de ecrã e uma frase no grupo dos testers, ou para ${SUPPORT_EMAIL}.`,
      ],
    },
    en: {
      slug: 'test-on-android',
      title: 'Testing Sweatbook on Android',
      summary: 'Three steps to join the test and stay for 14 days.',
      body: [
        {
          steps: [
            'Open the opt-in link we sent you, signed in with your Play Store Google account (the one you gave us).',
            'Tap Become a tester.',
            'Install Sweatbook from the Play Store through that link and open it.',
          ],
        },
        "Google only approves the app if we all stay enrolled for 14 days in a row. Please don't leave the test or uninstall the app before the date we gave you, even on days you don't play. Opening the app and logging a hand is enough.",
        "During the test you have Pro and pay nothing: your account is on the store's test list. If the Play Store ever asks for a real payment, stop and write to us.",
        `Found a bug? A screenshot and one line in the testers' group, or to ${SUPPORT_EMAIL}.`,
      ],
    },
  },
  {
    id: 'contact',
    cat: 'contact',
    pt: {
      slug: 'contacto',
      title: 'Falar connosco',
      summary: 'Escreve-nos; responde quem faz a app.',
      body: [
        `Escreve para ${SUPPORT_EMAIL}. Responde quem faz a Sweatbook, normalmente em 2 dias úteis.`,
        'Para um problema, diz-nos o modelo do telemóvel, a versão da app (Definições, em baixo) e o que estavas a fazer. Uma captura de ecrã ajuda muito.',
        'Ideias também são bem-vindas: muitas das novidades da app vieram de pedidos de jogadores.',
        { note: 'Sweatbook é para maiores de 18 anos. É uma app de registo: não tem jogo a dinheiro e nenhum dinheiro passa por ela.' },
      ],
    },
    en: {
      slug: 'contact',
      title: 'Contact us',
      summary: 'Write to us; the person who builds the app replies.',
      body: [
        `Write to ${SUPPORT_EMAIL}. The person who builds Sweatbook replies, usually within 2 working days.`,
        "For a problem, tell us your phone model, the app version (bottom of Settings) and what you were doing. A screenshot helps a lot.",
        'Ideas are welcome too: much of what is new in the app came from players asking.',
        { note: 'Sweatbook is for adults 18+. It is a record-keeping app: it has no real-money games and no money moves through it.' },
      ],
    },
  },
];

export function articles(): Article[] {
  return ARTICLES.filter((a) => (!a.feature || LIVE_FEATURES[a.feature]) && !(a.unless && LIVE_FEATURES[a.unless]));
}

/** The article in that language (Spanish and Brazilian texts live in their own files, by id). */
export function textOf(a: Article, locale: HelpLocale): ArticleText {
  if (locale === 'es') return ES[a.id] ?? a.en;
  if (locale === 'br') return BR[a.id] ?? a.pt;
  return a[locale];
}

export function findArticle(locale: HelpLocale, slug: string): Article | undefined {
  return articles().find((a) => textOf(a, locale).slug === slug);
}

/** Plain text of an article, for search. */
export function plainText(t: ArticleText): string {
  const parts = t.body.map((b) =>
    typeof b === 'string' ? b : 'steps' in b ? b.steps.join(' ') : 'list' in b ? b.list.join(' ') : b.note,
  );
  return [t.title, t.summary, ...parts].join(' ');
}
