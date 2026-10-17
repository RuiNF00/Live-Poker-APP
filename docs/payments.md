# Pagamentos: Sweatbook Pro

## Planos

| Plano | Preço | Notas |
|---|---|---|
| Grátis | 0 | 3 mãos novas por dia, partilha por link ilimitada, replayer, sessões, bankroll básico, notas |
| Pro mensal | 29,99 US$ / mês | `sweatbook_pro_monthly` |
| Pro anual | 199,99 US$ / ano | `sweatbook_pro_annual`, 7 dias grátis (oferta introdutória), fica a 16,67 US$/mês, poupa 44% |

A App Store e o Google Play só aceitam preços na grelha deles; 29,90 US$ não existe nos EUA, por isso usamos 29,99 US$ e 199,99 US$. As lojas convertem para euros e outras moedas.

Tudo o que é preço, limite ou texto do paywall está em `src/billing/plans.ts`.

## Como converte

1. **O limite cai no momento de maior vontade.** À 4.ª mão do dia, a meio de uma sessão, o paywall abre. A mão não se perde: fica como rascunho, e o paywall diz isso. Perder trabalho faz desinstalar; adiar faz pagar.
2. **A partilha fica grátis e ilimitada.** Cada link é publicidade gratuita para amigos que ainda não têm a app (é o canal de aquisição). Para limitar, muda `FREE.sharesPerDay` para `1`; o código já trata disso.
3. **Anual pré-selecionado com 7 dias grátis.** O preço mensal serve de âncora; o anual aparece como "16,67 US$ por mês, poupa 44%".
4. **Contador visível.** Na lista de mãos aparece "2 mãos grátis hoje · Pro sem limites" e, quando acaba, "Já usaste as mãos grátis de hoje".
5. **Paywall com texto do contexto.** Cada gatilho (`hands`, `shares`, `stats`, `story`) tem título próprio.
6. **Filtros de bankroll por período são Pro.** O total e o gráfico ficam grátis.

Próximos passos recomendados (depois do lançamento): testar um preço mais baixo com RevenueCat Experiments, oferta de recuperação a quem cancela, e paywall suave depois do primeiro comentário de um amigo.

## Implementação

- RevenueCat (`react-native-purchases`) trata das duas lojas, recibos e renovações. Entitlement `pro`.
- `src/billing/purchases.ts`: sem chave da RevenueCat (Expo Go, web, desenvolvimento) usa uma loja de demonstração com os preços acima. Em produção sem chave, o botão diz "Ainda não disponível".
- `src/billing/pro.tsx`: instala as regras com `setGate()` (o `gate('save' | 'share')` da app em `src/lib/gate.ts`); `usePro()` dá `isPro`, `handsLeft`, `canSaveHand()`, `canShare()`, `record()`, `paywall(reason)`. O estado Pro fica em cache para funcionar offline na sala.
- `src/app/paywall.tsx`: ecrã modal. Mostra o período de teste só se a loja disser que o jogador ainda tem direito a ele (exigência da Apple).
- Página de preços: `landing/index.html` (estática, pronta para `sweatbook.poker`).
- Depois do login com Supabase, chamar `identify(userId)` para ligar a subscrição à conta.

## O que o Rui tem de configurar

### App Store Connect
1. Assinar o contrato **Paid Applications** (Business > Agreements) e preencher dados bancários e fiscais. Sem isto as subscrições não funcionam.
2. App > Monetização > Subscrições: criar o grupo **Sweatbook Pro** com dois produtos:
   - `sweatbook_pro_monthly`, 1 mês, 29,99 US$
   - `sweatbook_pro_annual`, 1 ano, 199,99 US$, oferta introdutória grátis de 1 semana
3. Em cada produto: nome visível, descrição e uma captura do paywall (pede-se na revisão).
4. Users and Access > Integrations > **In-App Purchase key** (ficheiro .p8) para a RevenueCat.
5. Criar uma conta Sandbox para testar compras.

### Google Play Console
1. Perfil de pagamentos (Settings > Payments profile).
2. Carregar primeiro um build com o billing (track interno) para desbloquear as subscrições.
3. Monetize > Subscriptions: `sweatbook_pro_monthly` (base plan mensal, 29,99 US$) e `sweatbook_pro_annual` (base plan anual, 199,99 US$, oferta com 7 dias grátis para novos clientes).
4. Criar uma service account com acesso financeiro e dar o JSON à RevenueCat.
5. Adicionar testers de licença.

### RevenueCat (grátis até 2.500 US$ de receita por mês)
1. Criar conta e projeto Sweatbook, apps iOS (`com.ruinf.sweatbook`) e Android.
2. Ligar a chave .p8 da Apple e o JSON da Google.
3. Criar o entitlement `pro`, juntar os dois produtos, e uma offering `default` com os pacotes Monthly e Annual.
4. Copiar as chaves públicas da SDK para o EAS:
   - `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (começa por `appl_`)
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (começa por `goog_`)

Nota: as compras não funcionam no Expo Go; é preciso um development build (`eas build --profile development`).
