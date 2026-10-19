# Formato da mão (v1)

Fonte da verdade: `src/poker/types.ts` (`Hand`). Uma mão guarda só os inputs
(mesa, blinds, ações, cartas); tudo o que é derivado (potes, stacks, vencedores,
timeline do replayer) sai de `src/poker/engine.ts`, para a app, o replayer web e
os exports nunca discordarem.

- `players[]` em ordem horária; `button` e `hero` são índices nesse array.
- `actions[]` é a sequência completa da mão, sem campo de street: o motor sabe
  quando cada street fecha. `to` (bet/raise) = total posto nessa street após a ação.
- Valores em fichas (inteiros). Mostrar em BB = valor / `game.bb`.
- `board` tem 0–5 cartas, códigos "As", "Td", "9c".
- `players[i].cards` só existe quando as cartas são conhecidas (herói sempre).
- `winners` só é usado quando há showdown sem cartas conhecidas.

Para partilhar: o JSON da mão vai tal e qual (sem `sessionId`, `shareToken`).
