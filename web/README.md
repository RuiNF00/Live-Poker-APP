# Partilha de mãos (web)

Página pública `/h/<id>` que reproduz uma mão partilhada a partir da app: replayer, comentários dos amigos (sem conta), votação "O que fazias aqui?" e imagem de pré-visualização para WhatsApp/Telegram/X.

## Correr localmente

```bash
cd web
npm install
npm run dev        # http://localhost:3000/h/demo
```

Sem variáveis do Supabase, os dados ficam num ficheiro local (`web/.data/store.json`).

## API para a app

`POST /api/share`

```json
{ "hand": HandRecord, "title": "AQ vs 3-bet", "quiz": { "street": "turn", "actionIndex": 1 }, "revealAll": false, "allowComments": true }
```

Resposta `201 { "id", "url", "editToken" }`. A app guarda o `editToken` para apagar depois com `DELETE /api/share/<id>` e o header `x-edit-token`.

`HandRecord`, o motor de replay e o avaliador de mãos estão em `packages/hand-format` (partilhado com a app).

## Pôr online

1. Supabase: criar projeto, correr `supabase/migrations/*.sql` (SQL editor ou `supabase db push`).
2. Vercel: importar o repositório com **Root Directory = `web`**.
3. Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (domínio final), e quando existirem `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL`, `NEXT_PUBLIC_BRAND_NAME`.

## Testes

- `cd packages/hand-format && npm test` (motor de replay, potes, side pots, avaliador)
- `supabase/tests/run.sh` com um Postgres local (políticas RLS e funções)
