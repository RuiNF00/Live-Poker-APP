# Publicação nas lojas

Tudo o que é preciso para pôr a app na App Store e na Google Play. O objetivo é que, quando o código estiver pronto e os acessos existirem, publicar seja correr um workflow.

## O que está nesta pasta

| Ficheiro | Para quê |
|---|---|
| `config.env` | Nome da app, domínio, email, IDs. Muda aqui e corre `scripts/fill.sh`. |
| `listing/pt-PT.md`, `listing/en-US.md` | Textos das fichas (nome, subtítulo, descrição, palavras-chave), dentro dos limites. |
| `web/` | Páginas públicas: privacidade, termos, suporte, eliminação de conta (PT e EN). |
| `eas/eas.json` | Perfis de build e submissão EAS. Vai para a raiz do repositório. |
| `eas/app-config-for-main-thread.md` | Campos do `app.json` que a publicação precisa. |
| `privacy-forms.md` | Respostas prontas para a etiqueta de privacidade da Apple, Data safety da Google, classificação etária. |
| `review-risks.md` | O que pode levar a rejeição numa app de póquer e como evitamos. Inclui as notas para o revisor. |
| `screenshots.md` | Tamanhos e plano das 6 capturas. |
| `../.github/workflows/release.yml` | Botão "Release" no GitHub Actions: build + envio para as duas lojas. |

## Comandos

```bash
./store/scripts/fill.sh                                # preenche os {{TOKENS}} → store/out/
python3 store/scripts/check-lengths.py store/out/listing/*.md   # confirma limites de caracteres
```

## Passo a passo da publicação

### Uma vez só (precisa do Rui, ~20 min)

1. **Expo**: criar conta em expo.dev (ou usar a existente) e gerar um *access token* (Account settings → Access tokens). Guardar como secret `EXPO_TOKEN` no GitHub (Settings → Secrets → Actions).
2. **Apple**: em App Store Connect → Users and Access → Integrations → App Store Connect API, criar uma chave com papel **App Manager**. Precisamos de: ficheiro `.p8`, Key ID, Issuer ID e o Team ID (Membership). Com isto o EAS cria certificados e perfis sozinho e envia builds sem códigos de 2FA.
3. **Google Play**:
   - Criar a app no Play Console (nome, idioma PT, App, Grátis). A API não consegue criar a app.
   - Google Cloud → criar conta de serviço → chave JSON. No Play Console → Users and permissions → convidar o email da conta de serviço com permissão de *Release* na app.
   - O **primeiro** AAB tem de ser carregado à mão no Play Console (limitação da Google). Daí em diante o EAS envia sozinho.
4. Criar o registo da app no App Store Connect (nome, bundle ID `{{IOS_BUNDLE_ID}}`, SKU). Reserva o nome; fazer logo que o nome esteja escolhido.

### Cada versão (sem o Rui)

1. GitHub → Actions → Release → Run workflow (plataforma `all`, submit ligado).
2. iOS: a build aparece no TestFlight; em App Store Connect escolher a build na versão, preencher o que está em `listing/` e `privacy-forms.md`, carregar capturas, **Submit for Review**.
3. Android: a build entra no track *internal*. Promover para *closed testing* / *production* no Play Console.

## Riscos de calendário (resumo, detalhe em `review-risks.md`)

- **Google Play, contas pessoais criadas depois de novembro 2023**: produção só depois de um teste fechado com 12 testers durante 14 dias seguidos. Se for o caso do Rui, no dia 1 conseguimos ter o teste fechado a correr, não a app pública.
- **Apple**: revisão normalmente em menos de 24 h. A app tem de estar completa (sem ecrãs "em breve").

## Alojamento das páginas

As páginas de `web/` são servidas pela app web de partilha de mãos (pasta `web/` na raiz do repositório, projeto Vercel único em `https://sweatbook.poker`), nos caminhos `/privacy`, `/terms`, `/support` e `/delete-account`. Os HTML daqui são a fonte: depois de alterar, correr `scripts/fill.sh` e copiar `out/web/` para `web/public/`.

## Conta de demonstração para os revisores

Criar no Supabase de produção: `review@{{WEB_DOMAIN}}` com ~20 mãos de exemplo. Colocar email e password em App Store Connect → App Review Information e em Play Console → App access. Não guardar a password neste repositório.
