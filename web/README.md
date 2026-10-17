# Sweatbook · partilha de mãos (web)

Página pública `/h/<id>` que reproduz uma mão partilhada a partir da app: replayer, comentários dos amigos (sem conta), votação "O que fazias aqui?" e imagem de pré-visualização para WhatsApp/Telegram/X.

## Correr localmente

```bash
cd web
npm install
npm run dev        # http://localhost:3000/h/demo
```

Sem variáveis do Supabase, os dados ficam num ficheiro local (`web/.data/store.json`).

## API para a app

Contrato usado por `src/lib/share-api.ts` da app. O corpo `hand` é o `Hand` da app (v1) tal e qual; também aceita um `HandRecord` de `packages/hand-format`.

| Pedido | Resposta |
|---|---|
| `POST /api/hands` `{ hand, title?, quiz?: { action: n }, revealAll?, allowComments? }` | `201 { id, token, url }` |
| `GET /api/hands/<id>` | `{ id, hand, title, quiz, createdAt }` |
| `DELETE /api/hands/<id>` com header `x-edit-token: <token>` | `{ deleted }` |
| `GET /api/hands/<id>/comments` | `{ comments: [{ id, name, text, createdAt (ms), stepIndex }] }` |
| `POST /api/hands/<id>/comments` `{ name, text, stepIndex? }` | `201 { comment }` |
| `POST /api/hands/<id>/vote` `{ voterId (uuid), choice }` | `{ counts }` (inclui comentários "🗳️ <escolha>" da app) |
| `POST /api/hands/<id>/report` `{ reporterId (uuid), reason? }` | `{ reported }` (5 denúncias tiram a mão do ar) |
| `POST /api/hands/<id>/comments/<commentId>/report` `{ reporterId }` | `{ reported }` (3 denúncias escondem o comentário) |

Links de desafio: `/h/<id>?q=1` pára na última ação do herói e pergunta "O que fazias aqui?". Até a pessoa votar, a página esconde notas, tags, ações seguintes e comentários. `quiz: { action: n }` no upload fixa outro ponto.

O motor de replay, o avaliador e o conversor do `Hand` da app estão em `packages/hand-format`.

## Pôr online

1. Supabase: criar projeto, correr `supabase/migrations/*.sql` (SQL editor ou `supabase db push`).
2. Vercel: importar o repositório com **Root Directory = `web`**.
3. Variáveis (ver `web/.env.example`, inclui `APPLE_TEAM_ID` e `ANDROID_CERT_SHA256` para os links abrirem a app): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (por defeito `https://sweatbook.vercel.app`), e quando existirem `NEXT_PUBLIC_APP_STORE_URL` e `NEXT_PUBLIC_PLAY_STORE_URL`.

## Testes

- `cd packages/hand-format && npm test` (motor de replay, potes, side pots, avaliador)
- `cd web && npm test` (filtro de linguagem ofensiva)
- `supabase/tests/run.sh` com um Postgres local (políticas RLS e funções)

## Páginas legais

`/privacy`, `/terms`, `/support` e `/delete-account` são os HTML gerados a partir de `store/web` (`store/scripts/fill.sh`) e copiados para `web/public/`. Se o texto mudar, volta a gerar e copia.
