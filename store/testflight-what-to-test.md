# TestFlight: "What to Test" for the first build

Goes in App Store Connect → TestFlight → the build → Test Details → "What to Test", one version per language (limit 4000 characters each). Testers see it in the TestFlight app before installing. Based on `marketing/beta-recrutamento.md` §5. Change it on each new build when there is something specific to try. Android closed-test release notes stay in that file (Play has no "What to Test" field). Those Android notes also ask testers to check the keyboard doesn't cover a text field near the bottom of the screen (hand note, swap amount, stack), from #245's Android pass, which no emulator here can verify; if it fails, the fix is `behavior="padding"` on Android or react-native-keyboard-controller. TestFlight testers only have iPhones, so that line isn't here.

Real-phone checks behind the video and link lines (from Instagram, 17 Oct): (1) time from "Criar vídeo da mão" to the Instagram editor on a mid-range iPhone; estimate ~0.45 s per captured frame (12-16 frames) + ~2 MB upload + ~10 s server render (12 s with the face); (2) the table fully drawn in every frame (280 ms fade-in wait per frame, could be shortened if devices look fine); (3) link previews (hand, live, invite, swap, staking) in real WhatsApp/X/iMessage chats on the public domain: large image, title in the sender's language, stack visible in the live link's small square thumbnail. (4) From Instagram's in-app browser (open a link from an Instagram DM or bio), the App Store and Google Play buttons on /h, /r and /b open the store apps, not a web page inside Instagram. Points (3) and (4) need the domain live first, and (4) also the store URLs: until those exist the buttons read "Em breve". Point (2) is also in the tester lines below, with and without the face. The "Partilhar stack" tester line needs #281 in the build; drop it from all 4 languages if the build predates #281.

Purchases on the first build follow the sandbox script in `launch/teste-pagamentos.md` (shared folder), run by Rui and us, not by every tester: buy, renew, cancel, restore, lifetime, the −40% offer, and from Ponto 7 (bab47ad1) the failed-renewal notice with "Atualizar pagamento", "Renova a {data}" / "Termina a {data}", and on Android monthly → annual leaving a single subscription. The "Algo correu mal · Voltar" screen is checked there too, in the store build only. These lines stay out of the tester text: testers can't trigger a billing failure.

Tab names match `src/i18n` (Mãos partilhadas / Mãos compartilhadas / Manos compartidas / Shared hands).

**First build (19 Oct):** no «new in this version» block, because testers have nothing to compare it with, and no lines that need the site while sweatbook.poker is not live (link sharing, comments, the hand video, link previews, cloud backup). When the site is live, add the line marked «Com o site» in each language.

## PT-PT

> Obrigado por testares o Sweatbook! Esta é a primeira versão.
>
> O que testar:
> • Regista mãos à mesa (ou de memória) e revê-as no replayer, rua a rua.
> • Começa uma sessão de torneio ou de cash e vê o tempo, o stack e o nível no ecrã bloqueado e no widget.
> • Bankroll: junta uma sessão já jogada e vê os resultados por sala.
> • Festivais: abre um calendário, marca os eventos que vais jogar e começa uma sessão a partir de um deles.
> • Pro: podes ativá-lo no paywall. Na TestFlight a compra é de teste e não pagas nada.
>
> Como reportar: faz uma captura de ecrã dentro da app e o TestFlight pergunta se a queres enviar. Diz o que fizeste, o que esperavas e o que aconteceu. Se a app fechar sozinha, aceita enviar o relatório.
>
> Nenhum dinheiro passa pela Sweatbook: são só registos.

Com o site: «• Partilha uma mão por link e pede a um amigo que comente; cria o vídeo da mão para o Instagram e diz-nos quanto demorou.»

## pt-BR

> Valeu por testar o Sweatbook! Esta é a primeira versão.
>
> O que testar:
> • Registre mãos na mesa (ou de memória) e reveja no replayer, street a street.
> • Comece uma sessão de torneio ou de cash e veja o tempo, o stack e o nível na tela bloqueada e no widget.
> • Bankroll: adicione uma sessão já jogada e veja os resultados por sala.
> • Festivais: abra um calendário, marque os eventos que vai jogar e comece uma sessão a partir de um deles.
> • Pro: você pode ativar no paywall. No TestFlight a compra é de teste e você não paga nada.
>
> Como reportar: tire um print dentro do app e o TestFlight pergunta se você quer enviar. Diga o que fez, o que esperava e o que aconteceu. Se o app fechar sozinho, aceite enviar o relatório.
>
> Nenhum dinheiro passa pelo Sweatbook: são só registros.

Com o site: «• Compartilhe uma mão por link e peça para um amigo comentar; crie o vídeo da mão para o Instagram e conte quanto tempo levou.»

## es

> ¡Gracias por probar Sweatbook! Esta es la primera versión.
>
> Qué probar:
> • Registra manos en la mesa (o de memoria) y repásalas en el replayer, calle a calle.
> • Empieza una sesión de torneo o de cash y mira el tiempo, el stack y el nivel en la pantalla bloqueada y en el widget.
> • Bankroll: añade una sesión ya jugada y mira los resultados por sala.
> • Festivales: abre un calendario, marca los eventos que vas a jugar y empieza una sesión desde uno de ellos.
> • Pro: puedes activarlo en el paywall. En TestFlight la compra es de prueba y no pagas nada.
>
> Cómo avisarnos: haz una captura de pantalla dentro de la app y TestFlight te pregunta si quieres enviarla. Cuenta qué hiciste, qué esperabas y qué pasó. Si la app se cierra sola, acepta enviar el informe.
>
> Ningún dinero pasa por Sweatbook: solo son registros.

Com o site: «• Comparte una mano por link y pide a un amigo que la comente; crea el vídeo de la mano para Instagram y dinos cuánto tardó.»

## EN (English US and UK)

> Thanks for testing Sweatbook! This is the first build.
>
> What to test:
> • Log hands at the table (or from memory) and replay them street by street.
> • Start a tournament or cash session and check the time, stack and level on the Lock Screen and in the widget.
> • Bankroll: add a session you already played and see results by venue.
> • Festivals: open a schedule, mark the events you'll play and start a session from one of them.
> • Pro: you can turn it on from the paywall. In TestFlight the purchase is a test and you pay nothing.
>
> How to report: take a screenshot inside the app and TestFlight asks whether to send it. Say what you did, what you expected and what happened. If the app closes on its own, agree to send the report.
>
> No money moves through Sweatbook: it's records only.

Com o site: «• Share a hand by link and ask a friend to comment; make the hand video for Instagram and tell us how long it took.»
