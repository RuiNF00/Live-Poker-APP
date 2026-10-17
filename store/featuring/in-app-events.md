# Eventos nas lojas: um por festival do planeador

# Eventos nas lojas: um por festival do planeador

Rascunho de 2026-10-17. Nada foi submetido. Quem submete é o fio das lojas; o fio do pt-BR e espanhol faz a revisão nativa. Substitui, para as 4 línguas, a tabela das Bahamas em launch/festival-bahamas/lojas/evento-lojas.md (EN e PT ficaram iguais) e o rascunho do evento em marketing/lancamento-brasil.md.

**Os festivais** são os 4 do planeador (`src/poker/festivals.ts`, ramo do fio do ecrã bloqueado): `bahamas-dez-2026`, `las-vegas-dez-2026`, `bahia-jan-2027` (só datas, ainda sem torneios) e `barcelona-mar-2027` (sem datas).

**Regras** (verificadas com script): nome até 30, descrição curta até 50, longa até 120; na Play, tagline até 80 (até 48 para entrar no Spotlight; todas cabem) e descrição de 100 a 500. Só cidades e países, nunca o nome da série, sala, resort ou organizador; nenhuma palavra de aposta; badge **Special Event**, nunca Competition nem Challenge. Staking e swaps ficam de fora: o evento mostra o planeador e as mãos.

**Comum a todos (App Store):**
- Badge Special Event; Event purpose: Attract new users e Keep active users informed; Priority: Normal.
- Deep link `sweatbook://festival?id=<id>` (rota `src/app/festival.tsx`). Quando o AASA de sweatbook.poker incluir `/festival`, passar a `https://sweatbook.poker/festival/<id>`.
- A Apple deixa publicar até 14 dias antes do início, cada evento dura no máximo 31 dias, há no máximo 5 no ar e 10 aprovados ao mesmo tempo, e o evento só se submete com uma versão da app aprovada.
- Imagens: cartão 16:9 (1920×1080) e detalhe 9:16 (1080×1920), sem texto, com dados de demonstração. As das Bahamas existem; as outras três geram-se como essas (fio das lojas).
- Cada língua só aparece onde a ficha dessa língua existe. A app tem as 4 desde o lançamento, por isso o ideal é as fichas também.

**Comum a todos (Google Play, Promotional Content):** tipo Time-limited event, mesma imagem 16:9 (até 1 MB, sem texto). A Google só dá esta ferramenta a apps que cumpram os critérios das "Premium growth tools" e reduz a visibilidade de conteúdo ligado a jogo a dinheiro. Se a opção não aparecer, o texto vai para as notas da versão ("What's new"). Submeter com mais de 24 horas de antecedência; os prazos abaixo dão margem para a revisão.

## 1. Bahamas, dezembro (`bahamas-dez-2026`)

Viagem do Rui e lançamento a sério. Já tinha EN e PT em launch/festival-bahamas/lojas/evento-lojas.md; aqui ficam iguais e juntam-se pt-BR e es.

- **Datas do evento:** 1 dez 2026 00:00 a 17 dez 2026 23:59, hora de Nassau (America/Nassau)
- **Publicação na App Store:** 17 nov 2026 (14 dias antes)
- **Submeter:** 10 nov 2026, ou logo que a versão for aprovada
- **Países:** Todos onde a app está
- **Reference name:** `bahamas-dec-2026-festival-planner`
- **Deep link:** `sweatbook://festival?id=bahamas-dez-2026`

### App Store: In-App Event

| Campo | Limite | EN | PT-PT | pt-BR | es |
| --- | --- | --- | --- | --- | --- |
| Nome | 30 | Bahamas: Log Every Hand (23) | Bahamas: regista cada mão (25) | Bahamas: registre cada mão (26) | Bahamas: registra cada mano (27) |
| Descrição curta | 50 | Festival schedule, your plan and every hand. (44) | Calendário, o teu plano e cada mão registada. (45) | Programa, o seu plano e cada mão registrada. (44) | Calendario, tu plan y cada mano registrada. (43) |
| Descrição longa | 120 | Plan your December festival events against your bankroll, get late-reg reminders and log a typical hand in 11 taps. (115) | Planeia os torneios de dezembro com a tua banca, recebe lembretes de inscrição e regista uma mão típica em 11 toques. (117) | Planeje os torneios de dezembro com a sua banca, receba lembretes de late reg e registre uma mão típica em 11 toques. (117) | Planifica los torneos de diciembre con tu bankroll, recibe avisos de late reg y registra una mano típica en 11 toques. (112) |

### Google Play: conteúdo promocional

- Datas: 1 a 17 dez 2026. Submeter até 10 nov 2026.

| Língua | Tagline (7) | Descrição (500) |
| --- | --- | --- |
| EN | Plan the festival. Log every hand. (34) | Heading to the December festival in the Bahamas? Pick the events you plan to play, see the total against your bankroll and get a reminder before each start and before late registration closes. Log a typical hand in 11 taps and replay it later. 18+. (244) |
| PT-PT | Planeia o festival. Regista cada mão. (37) | Vais ao festival de dezembro nas Bahamas? Escolhe os torneios que queres jogar, vê o total comparado com a tua banca e recebe um lembrete antes de cada início e antes de fechar a inscrição tardia. Regista uma mão típica em 11 toques e revê-a depois. 18+. (248) |
| pt-BR | Planeje o festival. Registre cada mão. (38) | Vai ao festival de dezembro nas Bahamas? Escolha os torneios que quer jogar, veja o total comparado com a sua banca e receba um lembrete antes de cada início e antes de fechar o late reg. Registre uma mão típica em 11 toques e reveja depois. 18+. (240) |
| es | Planifica el festival. Registra cada mano. (42) | ¿Vas al festival de diciembre en Bahamas? Elige los torneos que quieres jugar, mira el total frente a tu bankroll y recibe un aviso antes de cada inicio y antes de que cierre el late reg. Registra una mano típica en 11 toques y repásala después. 18+. (244) |

## 2. Las Vegas, dezembro (`las-vegas-dez-2026`)

O festival de Las Vegas é o teste de Apple Ads (marketing/apple-ads-bahamas.md, campanha A). Sobrepõe-se ao das Bahamas; a Apple aceita até 5 eventos ao mesmo tempo.

- **Datas do evento:** 27 nov 2026 00:00 a 21 dez 2026 23:59, hora de Las Vegas (America/Los_Angeles); 25 dias
- **Publicação na App Store:** 17 nov 2026 (no dia do lançamento; a Apple deixa até 14 dias antes, mas a app ainda não está na loja antes)
- **Submeter:** logo que a versão for aprovada (até 10 nov)
- **Países:** EUA e Canadá, se o App Store Connect deixar escolher; senão todos
- **Reference name:** `las-vegas-dec-2026-festival-planner`
- **Deep link:** `sweatbook://festival?id=las-vegas-dez-2026`

### App Store: In-App Event

| Campo | Limite | EN | PT-PT | pt-BR | es |
| --- | --- | --- | --- | --- | --- |
| Nome | 30 | Las Vegas: Log Every Hand (25) | Las Vegas: regista cada mão (27) | Las Vegas: registre cada mão (28) | Las Vegas: registra cada mano (29) |
| Descrição curta | 50 | Four weeks of events, one plan, every hand. (43) | Quatro semanas de torneios, um plano, cada mão. (47) | Quatro semanas de torneios, um plano, cada mão. (47) | Cuatro semanas de torneos, un plan, cada mano. (46) |
| Descrição longa | 120 | Pick your December events in Las Vegas, see the total against your bankroll, get late-reg reminders and log each hand. (118) | Escolhe os torneios de dezembro em Las Vegas, vê o total com a tua banca, recebe lembretes e regista cada mão. (110) | Escolha os torneios de dezembro em Las Vegas, veja o total com a sua banca, receba lembretes e registre cada mão. (113) | Elige tus torneos de diciembre en Las Vegas, mira el total frente a tu bankroll, recibe avisos y registra cada mano. (116) |

### Google Play: conteúdo promocional

- Datas: 27 nov a 21 dez 2026. Submeter até 10 nov 2026.

| Língua | Tagline (7) | Descrição (500) |
| --- | --- | --- |
| EN | Your Las Vegas December, planned. (33) | Playing the December festival in Las Vegas? The schedule is already in the app: pick your events, see the total against your bankroll and get a reminder before each start and before late registration closes. Log a typical hand in 11 taps between levels and share the big ones as a link. 18+. (287) |
| PT-PT | O teu dezembro em Las Vegas, planeado. (38) | Vais jogar o festival de dezembro em Las Vegas? O calendário já está na app: escolhe os torneios, vê o total comparado com a tua banca e recebe um lembrete antes de cada início e antes de fechar a inscrição tardia. Regista uma mão típica em 11 toques entre níveis e partilha as grandes num link. 18+. (294) |
| pt-BR | Seu dezembro em Las Vegas, tudo planejado. (42) | Vai jogar o festival de dezembro em Las Vegas? O programa já está no app: escolha os torneios, veja o total comparado com a sua banca e receba um lembrete antes de cada início e antes de fechar o late reg. Registre uma mão típica em 11 toques entre os níveis e compartilhe as grandes em um link. 18+. (294) |
| es | Tu diciembre en Las Vegas, todo planificado. (44) | ¿Juegas el festival de diciembre en Las Vegas? El calendario ya está en la app: elige tus torneos, mira el total frente a tu bankroll y recibe un aviso antes de cada inicio y antes de que cierre el late reg. Registra una mano típica en 11 toques entre niveles y comparte las grandes con un link. 18+. (294) |

## 3. Bahia, janeiro (`bahia-jan-2027`)

Lançamento pt-BR (marketing/lancamento-brasil.md). Substitui o rascunho "Verão: registre cada mão" desse plano; em pt-BR passa a "Verão na Bahia: cada mão", igual ao PT-PT (revisão nativa). **Só tem datas:** os torneios entram no planeador quando o organizador publicar o programa. Se não estiverem lá a 1 jan, usar a descrição longa alternativa (abaixo), sem lembretes.

- **Datas do evento:** 22 jan 2027 00:00 a 30 jan 2027 23:59, hora de Brasília (America/Bahia)
- **Publicação na App Store:** 8 jan 2027 (14 dias antes)
- **Submeter:** 1 jan 2027 (D−21), com a versão de 15 jan aprovada antes ou com a versão atual
- **Países:** Brasil (pt-BR principal); Portugal e restantes com as outras línguas
- **Reference name:** `bahia-jan-2027-festival-planner`
- **Deep link:** `sweatbook://festival?id=bahia-jan-2027`

### App Store: In-App Event

| Campo | Limite | EN | PT-PT | pt-BR | es |
| --- | --- | --- | --- | --- | --- |
| Nome | 30 | Brazil Summer: Log Every Hand (29) | Verão na Bahia: cada mão (24) | Verão na Bahia: cada mão (24) | Verano en Bahía: cada mano (26) |
| Descrição curta | 50 | Brazil's summer series: plan it, log every hand. (48) | A série de verão no Brasil, mão a mão. (38) | Planeje o festival e salve cada mão. (36) | La serie de verano en Brasil, mano a mano. (42) |
| Descrição longa | 120 | Pick your events at Brazil's summer series in Bahia, check them against your bankroll, log a typical hand in 11 taps. (117) | Escolhe os torneios da série de verão na Bahia, compara com a tua banca e regista uma mão típica em 11 toques. (110) | Escolha os torneios do festival de verão, compare com a sua banca e registre uma mão típica em 11 toques. (105) | Elige tus torneos de la serie de verano en Bahía, compáralos con tu bankroll y registra una mano típica en 11 toques. (111) |
| Longa, sem torneios | 120 | Brazil's summer series in Bahia, 22 to 30 January: log a typical hand in 11 taps, replay it and share it as a link. (115) | Série de verão na Bahia, de 22 a 30 de janeiro: regista uma mão típica em 11 toques, revê-a e partilha-a num link. (114) | Festival de verão na Bahia, de 22 a 30 de janeiro: registre uma mão típica em 11 toques e compartilhe em um link. (113) | Serie de verano en Bahía, del 22 al 30 de enero: registra una mano típica en 11 toques, repásala y compártela con un link. (116) |

### Google Play: conteúdo promocional

- Datas: 22 a 30 jan 2027. Submeter até 15 jan 2027.

| Língua | Tagline (7) | Descrição (500) |
| --- | --- | --- |
| EN | Summer in Bahia. Every hand logged. (35) | Going to Brazil's summer series in Bahia? Pick the events you plan to play and see the total against your bankroll. Log a typical hand in 11 taps between levels, or leave a 10-second voice note and finish it later, then share the big ones as a link anyone can open. 18+. (266) |
| PT-PT | Verão na Bahia. Cada mão registada. (35) | Vais à série de verão na Bahia? Escolhe os torneios que queres jogar e vê o total comparado com a tua banca. Regista uma mão típica em 11 toques entre níveis, ou deixa uma nota de voz de 10 segundos e acaba depois, e partilha as grandes num link que qualquer pessoa abre. 18+. (270) |
| pt-BR | Verão na Bahia. Cada mão registrada. (36) | Vai ao festival de verão na Bahia? Escolha os torneios que quer jogar e veja o total comparado com a sua banca. Registre uma mão típica em 11 toques entre os níveis, ou deixe uma nota de voz de 10 segundos e termine depois, e compartilhe as grandes em um link que qualquer pessoa abre. 18+. (284) |
| es | Verano en Bahía. Cada mano registrada. (38) | ¿Vas a la serie de verano en Bahía? Elige los torneos que quieres jugar y mira el total frente a tu bankroll. Registra una mano típica en 11 toques entre niveles, o deja una nota de voz de 10 segundos y termínala después, y comparte las grandes con un link que cualquiera abre. 18+. (276) |

## 4. Barcelona, março (datas a confirmar) (`barcelona-mar-2027`)

Lançamento em espanhol (marketing/lancamento-espanhol.md). Sem datas, não se submete: a Apple pede início e fim.

- **Datas do evento:** **a confirmar.** O organizador ainda não publicou 2027 (em 2026 foi de 4 a 15 de março). Usar as datas oficiais, hora de Madrid (Europe/Madrid), até 31 dias
- **Publicação na App Store:** 14 dias antes do início
- **Submeter:** 21 dias antes do início, quando as datas estiverem no planeador
- **Países:** Espanha (es principal); restantes com as outras línguas
- **Reference name:** `barcelona-mar-2027-festival-planner`
- **Deep link:** `sweatbook://festival?id=barcelona-mar-2027`

### App Store: In-App Event

| Campo | Limite | EN | PT-PT | pt-BR | es |
| --- | --- | --- | --- | --- | --- |
| Nome | 30 | Barcelona: Log Every Hand (25) | Barcelona: regista cada mão (27) | Barcelona: registre cada mão (28) | Barcelona: registra cada mano (29) |
| Descrição curta | 50 | Spain's national series: plan it, log every hand. (49) | A etapa de Barcelona, mão a mão. (32) | A etapa de Barcelona, mão a mão. (32) | La etapa de Barcelona, mano a mano. (35) |
| Descrição longa | 120 | Pick your events at the Barcelona stop, see the total against your bankroll, get late-reg reminders and log each hand. (118) | Escolhe os torneios da etapa de Barcelona, vê o total com a tua banca, recebe lembretes e regista cada mão. (107) | Escolha os torneios da etapa de Barcelona, veja o total com a sua banca, receba lembretes e registre cada mão. (110) | Elige tus torneos de la etapa de Barcelona, mira el total frente a tu bankroll, recibe avisos y registra cada mano. (115) |

### Google Play: conteúdo promocional

- Datas: as mesmas do evento Apple. Submeter até 7 dias antes do início.

| Língua | Tagline (7) | Descrição (500) |
| --- | --- | --- |
| EN | Barcelona in March, planned. (28) | Playing the national series stop in Barcelona? Pick your events, see the total against your bankroll and get a reminder before each start and before late registration closes. Log a typical hand in 11 taps between levels and share the big ones as a link anyone can open. 18+. (270) |
| PT-PT | Barcelona em março, planeado. (29) | Vais jogar a etapa de Barcelona? Escolhe os torneios, vê o total comparado com a tua banca e recebe um lembrete antes de cada início e antes de fechar a inscrição tardia. Regista uma mão típica em 11 toques entre níveis e partilha as grandes num link que qualquer pessoa abre. 18+. (275) |
| pt-BR | Barcelona em março, tudo planejado. (35) | Vai jogar a etapa de Barcelona? Escolha os torneios, veja o total comparado com a sua banca e receba um lembrete antes de cada início e antes de fechar o late reg. Registre uma mão típica em 11 toques entre os níveis e compartilhe as grandes em um link que qualquer pessoa abre. 18+. (277) |
| es | Barcelona en marzo, todo planificado. (37) | ¿Juegas la etapa de Barcelona? Elige tus torneos, mira el total frente a tu bankroll y recibe un aviso antes de cada inicio y antes de que cierre el late reg. Registra una mano típica en 11 toques entre niveles y comparte las grandes con un link que cualquiera abre. 18+. (265) |

## Calendário para o fio das lojas

| Quando | O quê |
| --- | --- |
| Logo que a versão de lançamento for aprovada (até 10 nov) | Submeter Bahamas e Las Vegas na App Store e na Play |
| 17 nov | Os dois eventos publicados na App Store |
| 27 nov | Las Vegas no ar |
| 1 dez | Bahamas no ar |
| 1 jan | Submeter Bahia (com torneios no planeador, ou com a longa alternativa) |
| 8 jan | Bahia publicado na App Store |
| 15 jan | Bahia na Play |
| 22 jan | Bahia no ar |
| Quando sair o calendário de 2027 | Pôr as datas de Barcelona no planeador e submeter 21 dias antes |

## Fontes

- [Apple: Offer In-App Events](https://developer.apple.com/help/app-store-connect/offer-in-app-events/offer-in-app-events/)
- [Apple: In-app event badges](https://developer.apple.com/help/app-store-connect/reference/in-app-event-badges/)
- [Google Play: promotional content](https://support.google.com/googleplay/android-developer/answer/12929944)
- `src/poker/festivals.ts` (ramo claude/sessao-ecra-bloqueado-tnwzdr): ids e datas dos festivais
