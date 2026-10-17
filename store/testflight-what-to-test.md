# TestFlight: "What to Test" for the first build

Goes in App Store Connect → TestFlight → the build → Test Details → "What to Test", one version per language (limit 4000 characters each). Testers see it in the TestFlight app before installing. Based on `marketing/beta-recrutamento.md` §5. Change it on each new build when there is something specific to try. Android closed-test release notes stay in that file (Play has no "What to Test" field). Those Android notes also ask testers to check the keyboard doesn't cover a text field near the bottom of the screen (hand note, swap amount, stack), from #245's Android pass, which no emulator here can verify; if it fails, the fix is `behavior="padding"` on Android or react-native-keyboard-controller. TestFlight testers only have iPhones, so that line isn't here.

Real-phone checks behind the video and link lines (from Instagram, 17 Oct): (1) time from "Criar vídeo da mão" to the Instagram editor on a mid-range iPhone; estimate ~0.45 s per captured frame (12-16 frames) + ~2 MB upload + ~10 s server render (12 s with the face); (2) the table fully drawn in every frame (280 ms fade-in wait per frame, could be shortened if devices look fine); (3) link previews (hand, live, invite, swap, staking) in real WhatsApp/X/iMessage chats on the public domain: large image, title in the sender's language, stack visible in the live link's small square thumbnail. (4) From Instagram's in-app browser (open a link from an Instagram DM or bio), the App Store and Google Play buttons on /h, /r and /b open the store apps, not a web page inside Instagram. Points (3) and (4) need the domain live first, and (4) also the store URLs: until those exist the buttons read "Em breve". Point (2) is also in the tester lines below, with and without the face. The "Partilhar stack" tester line needs #281 in the build; drop it from all 4 languages if the build predates #281.

Purchases on the first build (buy, renew, cancel, billing failure, restore, lifetime, −40% offer) follow the sandbox script in `launch/teste-pagamentos.md` (shared folder), run by Rui and us, not by every tester.

Tab names match `src/i18n` (Mãos partilhadas / Mãos compartilhadas / Manos compartidas / Shared hands).

## PT-PT

> Obrigado por testares o Sweatbook!
>
> O que testar: regista mãos à mesa (ou de memória), revê-as no replayer e partilha uma por link. Abre uma mão que um amigo te mande: fica em Mãos partilhadas, com os comentários rua a rua. Quando jogares, começa uma sessão e vê o stack e o nível no ecrã bloqueado.
>
> Novo nesta versão:
> • Ao registar uma mão: "Check até ao fim" e "Mais limps?" poupam toques.
> • Bankroll → "Sessão passada": junta uma sessão já jogada em 3 toques.
> • Festivais: filtra os eventos (Satélites, Turbo, NLH, PLO…), marca os que vais jogar e escolhe a hora do late reg para receberes o aviso.
> • Partilhar: Instagram, WhatsApp, X e copiar link na mesma folha, em mãos, sessões e festivais.
> • Swaps: quando todos os resultados entram, aparece "falta acertar".
> • Definições → "Exportar sessões em CSV", grátis.
> • Partilha uma mão e pede a um amigo que comente: recebes um aviso (nunca entre as 23h e as 12h, sem valores).
> • Com uma sessão de torneio a decorrer, o ecrã bloqueado e a Dynamic Island aberta mostram "Partilhar stack" ao lado de "Nova mão": toca e confirma que abre a partilha do stack. Em cash não aparece.
> • Cria o vídeo de uma mão ("Criar vídeo da mão"), com e sem a tua cara, e diz-nos quanto demorou até abrir o Instagram e se a mesa aparece inteira em todo o vídeo. Manda um link de uma mão no WhatsApp ou no iMessage e vê se aparece a imagem grande e o título.
>
> Como reportar: faz uma captura de ecrã dentro da app e o TestFlight pergunta se a queres enviar. Diz o que fizeste, o que esperavas e o que aconteceu. Se a app fechar sozinha, aceita enviar o relatório.
>
> Nenhum dinheiro passa pela Sweatbook: são só registos. As compras no TestFlight são de teste e não pagas nada.

## pt-BR

> Valeu por testar o Sweatbook!
>
> O que testar: registre mãos na mesa (ou de memória), reveja no replayer e compartilhe uma por link. Abra uma mão que um amigo mandar: ela fica em Mãos compartilhadas, com os comentários street a street. Quando jogar, comece uma sessão e veja o stack e o nível na tela bloqueada.
>
> Novo nesta versão:
> • Ao registrar uma mão: "Check até o fim" e "Mais limps?" economizam toques.
> • Bankroll → "Sessão passada": adicione uma sessão já jogada em 3 toques.
> • Festivais: filtre os eventos (Satélites, Turbo, NLH, PLO…), marque os que vai jogar e escolha o horário do late reg para receber o aviso.
> • Compartilhar: Instagram, WhatsApp, X e copiar link na mesma tela, em mãos, sessões e festivais.
> • Swaps: quando todos os resultados entram, aparece "falta acertar as contas".
> • Configurações → "Exportar sessões em CSV", grátis.
> • Compartilhe uma mão e peça para um amigo comentar: você recebe um aviso (nunca entre 23h e 12h, sem valores).
> • Com uma sessão de torneio rolando, a tela bloqueada e a Dynamic Island aberta mostram "Compartilhar stack" ao lado de "Nova mão": toque e confira se abre o compartilhamento do stack. Em cash não aparece.
> • Crie o vídeo de uma mão ("Criar vídeo da mão"), com e sem o seu rosto, e conte quanto demorou até abrir o Instagram e se a mesa aparece inteira no vídeo todo. Mande o link de uma mão no WhatsApp ou no iMessage e veja se aparece a imagem grande e o título.
>
> Como reportar: tire um print dentro do app e o TestFlight pergunta se você quer enviar. Conte o que fez, o que esperava e o que aconteceu. Se o app fechar sozinho, aceite enviar o relatório.
>
> Nenhum dinheiro passa pela Sweatbook: são só registros. As compras no TestFlight são de teste e você não paga nada.

## es

> ¡Gracias por probar Sweatbook!
>
> Qué probar: registra manos en la mesa (o de memoria), repásalas en el replayer y comparte una con un link. Abre una mano que te mande un amigo: queda en Manos compartidas, con los comentarios calle a calle. Cuando juegues, empieza una sesión y mira el stack y el nivel en la pantalla bloqueada.
>
> Nuevo en esta versión:
> • Al registrar una mano: "Check hasta el final" y "¿Más limps?" ahorran toques.
> • Bankroll → "Sesión pasada": añade una sesión ya jugada en 3 toques.
> • Festivales: filtra los eventos (Satélites, Turbo, NLH, PLO…), marca los que vas a jugar y elige la hora del late reg para recibir el aviso.
> • Compartir: Instagram, WhatsApp, X y copiar link en la misma hoja, en manos, sesiones y festivales.
> • Swaps: cuando entran todos los resultados, aparece "falta saldar cuentas".
> • Ajustes → "Exportar sesiones en CSV", gratis.
> • Comparte una mano y pide a un amigo que comente: recibes un aviso (nunca entre las 23 h y las 12 h, sin importes).
> • Con una sesión de torneo en curso, la pantalla bloqueada y la Dynamic Island abierta muestran "Compartir stack" junto a "Nueva mano": tócalo y comprueba que abre la opción de compartir el stack. En cash no aparece.
> • Crea el video de una mano ("Crear video de la mano"), con y sin tu cara, y cuéntanos cuánto tardó en abrirse Instagram y si la mesa se ve entera en todo el video. Manda el link de una mano por WhatsApp o iMessage y mira si aparece la imagen grande y el título.
>
> Cómo reportar: haz una captura de pantalla dentro de la app y TestFlight te pregunta si quieres enviarla. Cuenta qué hiciste, qué esperabas y qué pasó. Si la app se cierra sola, acepta enviar el informe.
>
> Ningún dinero pasa por Sweatbook: solo son registros. Las compras en TestFlight son de prueba y no pagas nada.

## EN (English US and UK)

> Thanks for testing Sweatbook!
>
> What to test: log hands at the table (or from memory), replay them and share one as a link. Open a hand a friend sends you: it stays in Shared hands, with street-by-street comments. When you play, start a session and check the stack and level on the Lock Screen.
>
> New in this build:
> • When logging a hand: "Check it down" and "More limps?" save taps.
> • Bankroll → "Past session": add a session you already played in 3 taps.
> • Festivals: filter events (Satellites, Turbo, NLH, PLO…), mark the ones you'll play and pick the late reg time to get the reminder.
> • Share: Instagram, WhatsApp, X and copy link on one sheet, for hands, sessions and festivals.
> • Swaps: once every result is in, "time to settle up" shows.
> • Settings → "Export sessions as CSV", free.
> • Share a hand and ask a friend to comment: you get a notice (never between 11 pm and noon, no amounts).
> • With a tournament session running, the Lock Screen and the expanded Dynamic Island show "Share stack" next to "New hand": tap it and check it opens the stack share. Cash sessions don't show it.
> • Make a hand video ("Make hand video"), with and without your face, and tell us how long it took to reach Instagram and whether the table is fully drawn throughout. Send a hand link in WhatsApp or iMessage and check the large image and title show.
>
> How to report: take a screenshot inside the app and TestFlight will ask if you want to send it. Say what you did, what you expected and what happened. If the app crashes, accept sending the report.
>
> No money moves through Sweatbook: it only keeps records. TestFlight purchases are test purchases and cost nothing.
