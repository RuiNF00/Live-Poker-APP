# Passagem da infraestrutura para a equipa de IT (Polarize)

Para: João (IT, Polarize). Escrito a 13 nov 2026.

Daqui para a frente, tudo o que é contas e infraestrutura da Sweatbook (GitHub, Supabase, Vercel, Expo/EAS, Sentry, RevenueCat, Firebase, App Store Connect, Google Play Console, domínio, chaves, builds e publicação) é tratado pela equipa de IT. O Rui só desenvolve features e melhora o produto. Só se lhe pede alguma coisa quando um passo exige mesmo o login ou o 2FA dele, como dono da conta, e nesse caso diz-se numa linha onde tocar.

Este documento diz o que existe, onde está, o que mudar para as contas da Polarize e o que falta para o lançamento. Não tem valores de chaves, só nomes. As chaves novas vão diretamente para cada consola; nunca para o repositório nem para conversas.

---

## 1. A app em 1 minuto

| | |
|---|---|
| Nome | Sweatbook (registo de sessões e mãos de póquer ao vivo, bankroll, staking, partilha de mãos) |
| App | Expo SDK 58 (React Native), TypeScript, na raiz do repositório |
| Site | Next.js na pasta `web/` (partilha de mãos, páginas legais, `/support`, `/delete-account`, webhooks) |
| Pacote partilhado | `packages/hand-format` (usado pela app e pelo site) |
| Base de dados | Supabase (Postgres), região Frankfurt. Migrações em `supabase/migrations/`, testes SQL em `supabase/tests/` |
| Pagamentos | RevenueCat (App Store e Google Play). Entitlement `pro` |
| Erros | Sentry, região UE |
| Builds | EAS (Expo Application Services), perfis em `eas.json` |
| Bundle ID / pacote | `com.ruinf.sweatbook` (iOS e Android). **Não muda**: fica para sempre na app publicada |
| iOS | Só iPhone, iOS 16.4+ |
| Domínio | `sweatbook.poker` (do Rui, registado fora da Vercel) |
| Vendedor | DAILY CONQUESTS, LDA. (o Rui é gerente). A conta Apple ainda é individual, em nome do Rui |

Branch de integração: `claude/live-poker-app-mvp-kdke3g` (PR #3 para `main`). Só o Rui faz o merge desse PR, porque é decisão de produto. O `main` ainda está no commit inicial, e é por isso que o site em produção nunca foi publicado (ver §4).

Cada alteração ao texto da app leva sempre PT-PT, pt-BR e es (além de en).

---

## 2. O caminho escolhido

1. **GitHub**: o repositório passa da conta do Rui para a organização da Polarize no GitHub (transferência; o histórico, PRs, issues e branches vão juntos, e os links antigos redirecionam).
2. **Serviços com conta própria** (Supabase, Vercel, Expo/EAS, Sentry, RevenueCat, Firebase): passam para contas da Polarize. Onde o serviço deixa transferir o projeto, transfere-se; onde não deixa, cria-se de novo e trocam-se as chaves (§3).
3. **Lojas**: a app fica na conta Apple e na conta Google Play do Rui, porque está registada em nome dele. O Rui convida-te uma vez nas duas. A transferência da app para uma conta da empresa só é possível depois da primeira versão publicada (a Apple exige uma versão lançada).

### O que o Rui faz (uma vez, cerca de 5 minutos)

- **GitHub**: tu convidas o Rui (`RuiNF00`) para a organização da Polarize com permissão para criar repositórios. Ele aceita o convite e faz: github.com/RuiNF00/Live-Poker-APP → Settings → General → Danger Zone → **Transfer** → nome da organização da Polarize.
- **App Store Connect**: appstoreconnect.apple.com → Users and Access → **+** → o teu email → papel **Admin** (com acesso a Certificates, Identifiers & Profiles se a opção aparecer).
- **Google Play Console**: play.google.com/console → Users and permissions → **Invite new users** → o teu email (tem de ser uma conta Google) → **Admin (all permissions)**.

Tudo o resto fazes tu.

---

## 3. Serviço a serviço

### 3.1 GitHub

- Depois da transferência: Settings → Secrets and variables → Actions → criar **`EXPO_TOKEN`** (token de acesso da conta/organização Expo da Polarize, §3.4). É o único secret que os workflows usam.
- Workflows: `.github/workflows/ci.yml` (tipos, lint, testes da app, do pacote, do site e das migrações, em cada push e PR) e `.github/workflows/release.yml` (botão manual: build EAS + envio para as lojas).
- **Claude**: o trabalho do Claude neste projeto usa a GitHub App «Claude». Depois da transferência, instala-a na organização da Polarize com acesso a este repositório: https://github.com/apps/claude/installations/select_target . Sem isso o Claude deixa de conseguir abrir PRs.
- Proteção do `main`: recomendado exigir PR e o CI verde.

### 3.2 Supabase (base de dados)

Estado: existe um projeto `sweatbook` (Frankfurt) na conta do Rui, com as 39 primeiras migrações. Como o site em produção nunca foi publicado, este projeto não deve ter dados de utilizadores. **Confirmar antes de decidir** (Table Editor: `shared_hands`, `app_backups`, `invite_offer_codes`, `referrals`).

Duas formas, por ordem de preferência:

- **A. Projeto novo na organização da Polarize (recomendado, se o antigo estiver vazio)**
  1. supabase.com → organização Polarize → New project → nome `sweatbook`, região **Frankfurt (eu-central-1)**, password forte.
  2. Correr todas as migrações por ordem. Com a CLI: `supabase link --project-ref <ref>` e `supabase db push` na raiz do repositório. Sem CLI: SQL Editor com o conteúdo de `supabase/migrations/*.sql` por ordem do nome.
  3. A migração **`20261019105500` (moderação de comentários)** vem com a versão 34 da app e ainda não está no branch de integração. Tem de estar aplicada **antes** de publicar o site da v34. Já foi ensaiada numa base nova sem erros, e há um script para a desfazer.
  4. Se o projeto antigo tiver dados: `pg_dump --data-only` do antigo e restauro no novo, antes de ligar a Vercel.
- **B. Transferir o projeto existente**: Project Settings → General → **Transfer project** para a organização da Polarize. Pede que o dono (Rui) seja membro das duas organizações; usar só se houver dados a preservar e o dump não servir.

Ordem obrigatória em cada versão: **migrações primeiro, site depois**. Para desfazer: primeiro Instant Rollback na Vercel, depois o script de reverter. Ao contrário, o site fica sem as funções de que precisa (o webhook da RevenueCat passa a dar 503 e a confirmação dos backers falha).

O que levar daqui para a Vercel: **Project URL** e a chave **service_role** (Settings → API). A chave anon não é usada (o site é o único cliente; a migração `20261017090000` tira-lhe todos os acessos).

### 3.3 Vercel (site `sweatbook.poker`)

Estado: o projeto `sweatbook` está na conta pessoal do Rui. **O site em produção dá 404**: a produção ainda é o commit inicial do `main`, e os builds do branch de integração falham porque faltam `MODERATION_WEBHOOK_URL` e `SUPABASE_SERVICE_ROLE_KEY` (o `next.config` recusa de propósito o build de produção sem `MODERATION_WEBHOOK_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`).

Fazer de novo na equipa Vercel da Polarize (mais simples do que transferir):

1. vercel.com/new → importar o repositório (já na organização Polarize) → **Root Directory: `web`** → Framework Next.js (deteta sozinho). Não pôr `vercel.json` na raiz do repositório (estraga o build). A opção «Include files outside the root directory» tem de estar ligada (o site usa `packages/hand-format`).
2. Variáveis de ambiente (Production; secretas marcadas como Sensitive). Lista completa em `web/.env.example`:

| Variável | Obrigatória | Secreta | De onde vem |
|---|---|---|---|
| `SUPABASE_URL` | Sim | Não | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | **Sim** | Supabase → Settings → API → service_role |
| `MODERATION_WEBHOOK_URL` | Sim | **Sim** | Webhook (Slack, Discord, ou Zapier/Make → email) que recebe as denúncias de mãos, comentários e perfis. As lojas exigem resposta a denúncias em 24 h |
| `REVENUECAT_WEBHOOK_AUTH` | Sim | **Sim** | Texto aleatório comprido. O mesmo texto vai no header Authorization do webhook da RevenueCat para `https://sweatbook.poker/api/revenuecat` |
| `REVENUECAT_SECRET_KEY` | Sim | **Sim** | RevenueCat → Project settings → API keys → Secret |
| `ABUSE_HASH_SECRET` | Recomendada | **Sim** | Texto aleatório comprido |
| `NEXT_PUBLIC_SITE_URL` | Sim | Não | `https://sweatbook.poker` |
| `APPLE_TEAM_ID` | Sim | Não | developer.apple.com → Membership. Sem ele, os links partilhados não abrem a app no iPhone |
| `ANDROID_CERT_SHA256` | Quando houver Play | Não | Play Console → Integridade da app → certificado da chave de assinatura → SHA-256 |
| `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` | No lançamento | Não | Fichas das lojas |
| `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` | Opcional | Não | App Store Connect |
| `POSTHOG_KEY`, `POSTHOG_HOST` | Opcional | Não | PostHog UE (`https://eu.i.posthog.com`). Sem eles não há números do funil |

   Já têm valor por defeito e não é preciso pôr: `REVENUECAT_ENTITLEMENT` (`pro`), `IOS_BUNDLE_ID` e `ANDROID_PACKAGE` (`com.ruinf.sweatbook`), `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_APP_SCHEME` (`sweatbook`). **Nenhuma chave secreta pode ter `NEXT_PUBLIC_` no nome.**

3. Branch de produção: o `main` só tem o código depois do merge do PR #3 (decisão do Rui). Até lá, para pôr o site no ar, apontar a produção para o branch de integração (Settings → Git → Production Branch) ou promover um deploy de pré-visualização desse branch.
4. Domínio: Settings → Domains → `sweatbook.poker` (+ `www` a redirecionar) e copiar os registos DNS para o registrador onde o domínio está. Depois, no projeto antigo do Rui, retirar o domínio. O domínio em si pode ser transferido para a Polarize mais tarde; o importante é o DNS.
5. Verificar: `https://sweatbook.poker/support`, `/delete-account`, `/privacy`, `/terms`, `/.well-known/apple-app-site-association` e `/.well-known/assetlinks.json` devem responder 200. As duas lojas exigem que as páginas de privacidade e suporte estejam no ar.
6. Teste das denúncias: denunciar uma mão de teste no site e confirmar que o aviso chega ao webhook.

### 3.4 Expo / EAS (builds e atualizações pelo ar)

Estado: projeto na conta Expo `ruinf` (`app.json` → `owner: "ruinf"`, `extra.eas.projectId` e `updates.url`).

- **Recomendado: transferir o projeto** para uma organização Expo da Polarize (expo.dev → projeto → Settings → Transfer project; o Rui tem de ser membro da organização de destino). Mantém o projectId, as credenciais guardadas e o canal de atualizações. Depois mudar `owner` no `app.json` para o nome da organização.
- Alternativa: `eas init` numa conta Polarize cria um projectId novo; obriga a mudar `owner`, `extra.eas.projectId` e `updates.url` no `app.json`, e as builds já instaladas deixam de receber atualizações pelo ar.
- Variáveis no ambiente **production** do EAS (expo.dev → projeto → Environment variables): `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (secreta), `SENTRY_ORG`, `SENTRY_PROJECT`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_APPLE_APP_ID` (`6824088230`), `EXPO_PUBLIC_META_APP_ID` (opcional, para partilhar nas Stories do Instagram). `EXPO_PUBLIC_REVENUECAT_IOS_KEY` está no `eas.json` (é uma chave pública). Se a RevenueCat mudar de projeto, estas duas chaves públicas mudam.
- Nunca pôr `EXPO_PUBLIC_LOCAL_PRO` numa build EAS (o `app.config.js` recusa).
- Credenciais das lojas no EAS: Apple via chave da App Store Connect API (`.p8`, Key ID, Issuer ID, papel App Manager ou Admin); Google via conta de serviço JSON com permissão de Release na app (o `eas.json` espera-a em `./secrets/play-service-account.json`, que não está no repositório; melhor carregá-la nas credenciais do EAS).
- Criar o token `EXPO_TOKEN` para o GitHub Actions (§3.1).

Perfis do `eas.json`:

| Perfil | Para quê |
|---|---|
| `development`, `preview` | Builds internas |
| `production` | Loja. Android `.aab` para o track internal (rascunho) |
| `testflight` | iOS para a TestFlight (`EXPO_PUBLIC_BUILD_CHANNEL=testflight`) |
| `play-test` | Android para o teste fechado (track alpha) |

Comandos: `eas build --platform ios --profile testflight --auto-submit` e `eas build --platform android --profile play-test --auto-submit`. Ou GitHub → Actions → Release.

### 3.5 Sentry

Projeto novo na organização Sentry da Polarize, região **UE** (plataforma React Native). Pôr o DSN e o token nas variáveis do EAS (§3.4). Não há dados a trazer.

### 3.6 RevenueCat

- Pedir à RevenueCat a transferência do projeto para a conta da Polarize, ou convidar a conta da Polarize como colaborador Admin no projeto atual (Project settings → Collaborators). Recriar obriga a refazer produtos, ofertas, ligações às lojas e webhooks, por isso evitar.
- Configuração a manter: entitlement **`pro`**; produtos Pro mensal **$29.99**, anual **$199.99**, vitalício **$499.99** (este só aparece no fluxo de cancelamento); 3 dias grátis uma vez, depois da primeira sessão ou mão guardada; ofertas Android com ID exato `sweatbook-invite-50` (convite, 50% no 1.º mês) e `sweatbook-retention-40` (retenção, −40%). A app procura as ofertas pelo ID.
- Webhook para `https://sweatbook.poker/api/revenuecat` com o header Authorization = `REVENUECAT_WEBHOOK_AUTH`.
- Apple: chave de compras in-app (`.p8`) e App Store Server Notifications apontadas para a RevenueCat. Google: conta de serviço e notificações em tempo real (Pub/Sub; a conta de serviço precisa do papel Pub/Sub Admin).

### 3.7 Firebase (só notificações no Android)

Opcional na v1. Projeto «Sweatbook» na conta Google da Polarize, sem Analytics, app Android `com.ruinf.sweatbook`. O `google-services.json` e a chave da conta de serviço FCM vão para as credenciais do EAS. Sem isto, só os avisos de comentários não chegam no Android.

### 3.8 App Store Connect (conta do Rui, tu como Admin)

- App já registada: Sweatbook, Apple ID `6824088230`, SKU `sweatbook`.
- Capacidades no App ID `com.ruinf.sweatbook`: App Groups (`group.com.ruinf.sweatbook`, também no alvo `com.ruinf.sweatbook.ExpoWidgetsTarget`) e Declared Age Range (só na app).
- TestFlight: testers internos (utilizadores da conta) e **link público** para testers externos (precisa de uma revisão beta da Apple na primeira build).
- Notas: desligar as compras para grupos (multiseat) nas duas subscrições; 18+; nada de valores em dinheiro nas imagens da loja.

### 3.9 Google Play Console (conta do Rui, tu como Admin)

- App `com.ruinf.sweatbook`. O primeiro `.aab` tem de ser carregado à mão; depois o EAS envia sozinho.
- Testers: **Internal testing** para a equipa e um teste fechado. Se a conta for pessoal e criada depois de nov 2023, a Google exige 12 testers durante 14 dias seguidos antes de pedir acesso à produção.
- License testing para os testers comprarem o Pro sem pagar.
- Público-alvo 18+, só telemóveis (excluir tablets).

---

## 4. O que bloqueia o lançamento hoje (13 nov)

Por ordem:

1. **Site em produção (404)**: Supabase + Vercel na Polarize, com as variáveis da §3.3. Sem o site não há página de privacidade nem de suporte, e as lojas recusam.
2. **Migrações**: base nova com todas as migrações + a `20261019105500` antes do site da v34.
3. **Apple, área Business (só o Rui pode, é o titular da conta)**: contrato Paid Apps, formulário de impostos (W-8BEN), conta bancária e a conversão da conta individual para a empresa (caso aberto na Apple). Tu acompanhas e dizes ao Rui exatamente onde tocar.
4. **Builds**: iOS TestFlight (`testflight`) e Android (`play-test`) a partir da versão que o Rui aprovar. Hoje está no iPhone do Rui a 1.1.0 (`94d5a003`).
5. **Testers**: link público da TestFlight e Internal testing da Play.

Depois do lançamento: transferir a app para uma conta Apple da empresa, se a Apple não converter a conta do Rui.

---

## 5. Regras que não mudam

- Nunca guardar chaves no repositório, em ficheiros ou em conversas. Só nas consolas.
- Nunca gravar no repositório o IBAN da empresa nem o código da certidão permanente.
- Migrações antes do site; desfazer com o Instant Rollback da Vercel primeiro.
- O Rui decide o produto (o que entra numa versão e o merge do PR #3). A IT decide e faz tudo o que é infraestrutura.
