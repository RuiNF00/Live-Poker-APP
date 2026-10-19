import type { HelpLocale } from '../../lib/help/articles';
import { SUPPORT_EMAIL } from '../../lib/help/articles';
import type { BackupDeleteCopy } from './BackupDeleteForm';
import type { DeleteFormCopy } from './DeleteRequestForm';

// Text of /delete-account (the store deletion page) in the four help languages.

export interface DeleteCopy {
  meta: string;
  title: string;
  lede: string;
  inApp: { h: string; steps: string[]; after: string };
  noApp: { h: string; p: string; mail: string; linkOnly: string; form: DeleteFormCopy };
  backup: { h: string; p: string; lost: string; form: BackupDeleteCopy };
  table: { h: string; what: string; when: string; rows: [string, string][] };
  kept: { h: string; items: string[] };
  cancel: { text: string; link: string };
}

export const DELETE_COPY: Record<HelpLocale, DeleteCopy> = {
  pt: {
    meta: 'Apagar os teus dados',
    title: 'Apagar os teus dados',
    lede: 'A Sweatbook não tem contas: não há email nem palavra-passe. Os teus dados vivem no teu telemóvel e, só se usares essas funcionalidades, em cópias nos nossos servidores. Podes apagar tudo de uma vez.',
    inApp: {
      h: 'Na app (o mais rápido)',
      steps: ['Abre a Sweatbook.', 'Definições → Os teus dados → Apagar todos os meus dados.', 'Toca em Apagar tudo.'],
      after: 'Apaga tudo no telemóvel e nos nossos servidores. Se estiveres sem rede, os pedidos para apagar seguem assim que houver sinal. Não se pode desfazer: se quiseres guardar alguma coisa, usa antes Exportar tudo.',
    },
    noApp: {
      h: 'Sem a app',
      p: 'Já não tens a app ou o telemóvel? A cópia na nuvem apaga-se aqui em baixo com o código de recuperação. Para o resto, pede-nos por email: como não há contas, precisamos do link do que queres apagar (mãos partilhadas, o teu perfil, os teus swaps). Respondemos a confirmar e apagamos em até 30 dias.',
      mail: 'Pedir por email',
      linkOnly: 'Basta o link. Nunca te pedimos códigos nem chaves.',
      form: {
        legend: 'O que queres apagar?',
        items: {
          links: 'Mãos partilhadas por link (junta os links)',
          profile: 'O meu perfil público (junta o link)',
          swaps: 'Os meus swaps (junta os links)',
          other: 'Outra coisa',
        },
        details: 'Links ou outra informação',
        placeholder: 'Cola aqui os links…',
        send: 'Abrir no email',
        hint: `Abre a tua app de email com o pedido pronto. Não abre? Escreve para ${SUPPORT_EMAIL}.`,
        subject: 'Sweatbook · Pedido para apagar dados',
      },
    },
    backup: {
      h: 'Apagar a cópia na nuvem com o código',
      p: 'O código fica neste browser: a página faz o mesmo que a app e só envia ao servidor uma chave que prova que a cópia é tua. Nunca nos envies o código por email.',
      lost: 'Perdeste o código? Sem ele ninguém consegue encontrar nem ler a cópia, nem nós. É apagada sozinha 18 meses depois da última atualização.',
      form: {
        label: 'Código de recuperação',
        placeholder: 'XXXXX-XXXXX-XXXXXXXXXXXXXXXX',
        button: 'Apagar a cópia',
        working: 'A apagar…',
        done: 'Apagada. A cópia saiu dos nossos servidores.',
        notFound: 'Não existe nenhuma cópia com este código, ou já foi apagada.',
        invalid: 'O código tem 26 letras e números. Confirma e tenta outra vez.',
        busy: 'Demasiadas tentativas. Tenta daqui a uma hora.',
        failed: 'Não foi possível apagar agora. Tenta outra vez daqui a pouco.',
      },
    },
    table: {
      h: 'O que é apagado e quando',
      what: 'Dados',
      when: 'Quando',
      rows: [
        ['Mãos, sessões, notas de jogadores, bankroll, staking, definições e bloqueio no telemóvel', 'De imediato.'],
        ['Cópia na nuvem', 'De imediato. Uma cópia que não é atualizada durante 18 meses é apagada sozinha.'],
        ['Tudo o que partilhaste por link: mãos (com comentários e votos), sessões em direto, páginas fixas para backers, conjuntos de mãos, perfil público, links para o coach e acordos enviados a backers', 'Os links deixam de funcionar de imediato. Os registos saem dos servidores em até 60 dias.'],
        ['Comentários que escreveste na app nas mãos de outros jogadores', 'Apagados do servidor de imediato, ou assim que houver rede.'],
        ['Os convites deste telemóvel (os que fizeste e o que aceitaste)', 'Apagados do servidor de imediato, ou assim que houver rede.'],
        ['Swaps e grupos de swaps', 'O teu nome e a tua chave de acesso são apagados do servidor de imediato. Um swap que nunca foi confirmado é apagado logo, e um grupo que criaste é apagado logo para todos. Num swap confirmado, os outros jogadores ficam no servidor com uma cópia só de leitura dos valores que registaram juntos durante 90 dias, e depois é apagada. As cópias nos telemóveis dos outros jogadores não são tocadas.'],
      ],
    },
    kept: {
      h: 'O que fica',
      items: [
        'Mesmo sem apagares nada, um swap ou grupo por confirmar sai do servidor 30 dias depois de criado, e um confirmado 400 dias depois da última atividade.',
        'Estatísticas de utilização anónimas (por exemplo "mão guardada"), com um ID aleatório da instalação. Não identificam ninguém e são apagadas ao fim de 12 meses.',
        'Os registos de compra, na Apple e na Google, pelo tempo que a lei exige.',
        'Fica no servidor, até 400 dias, um código irreversível (hash) do ID da RevenueCat com quantos convites esse ID já usou, para o desconto não se repetir depois de apagares os dados. Não tem a tua instalação nem as tuas compras.',
        'Se alguém bloqueou os teus comentários numa mão, fica com essa mão um código irreversível que impede novos comentários teus. Sai quando a mão é apagada.',
        'No teu telemóvel ficam o ID aleatório da instalação e se já usaste o teste grátis e o convite, para não os repetir. Saem quando apagas a app. No iPhone, o ID aleatório da instalação fica no porta-chaves mesmo depois de apagares a app, para uma reinstalação não repetir o convite; sai quando repões o iPhone.',
        'O registo na RevenueCat (um ID aleatório e as compras) pode ser apagado: escreve para support@sweatbook.poker com o ID da encomenda do recibo que a Apple ou a Google te enviaram por email, e apagamo-lo em até 30 dias. A Apple e a Google guardam os seus próprios registos de compra.',
        'Um comentário que escreveste no site, num browser, não está ligado à app: pede-nos por email com o link da mão.',
      ],
    },
    cancel: { text: 'Apagar os dados não cancela o Pro.', link: 'Como cancelar' },
  },
  br: {
    meta: 'Excluir os seus dados',
    title: 'Excluir os seus dados',
    lede: 'O Sweatbook não tem contas: não há email nem senha. Seus dados ficam no seu celular e, só se você usar esses recursos, em cópias nos nossos servidores. Você pode excluir tudo de uma vez.',
    inApp: {
      h: 'No app (o jeito mais rápido)',
      steps: ['Abra o Sweatbook.', 'Configurações → Seus dados → Excluir todos os meus dados.', 'Toque em Excluir tudo.'],
      after: 'Exclui tudo no celular e nos nossos servidores. Se você estiver sem internet, os pedidos de exclusão seguem assim que houver sinal. Não dá para desfazer: se quiser guardar alguma coisa, use antes Exportar tudo.',
    },
    noApp: {
      h: 'Sem o app',
      p: 'Não tem mais o app ou o celular? A cópia na nuvem é excluída aqui embaixo com o código de recuperação. Para o resto, peça por email: como não há contas, precisamos do link do que você quer excluir (mãos compartilhadas, seu perfil, seus swaps). Respondemos confirmando e excluímos em até 30 dias.',
      mail: 'Pedir por email',
      linkOnly: 'Basta o link. Nunca pedimos códigos nem chaves.',
      form: {
        legend: 'O que você quer excluir?',
        items: {
          links: 'Mãos compartilhadas por link (inclua os links)',
          profile: 'Meu perfil público (inclua o link)',
          swaps: 'Meus swaps (inclua os links)',
          other: 'Outra coisa',
        },
        details: 'Links ou outra informação',
        placeholder: 'Cole aqui os links…',
        send: 'Abrir no email',
        hint: `Abre o seu app de email com o pedido pronto. Não abriu? Escreva para ${SUPPORT_EMAIL}.`,
        subject: 'Sweatbook · Pedido de exclusão de dados',
      },
    },
    backup: {
      h: 'Excluir a cópia na nuvem com o código',
      p: 'O código fica neste navegador: a página faz o mesmo que o app e só envia ao servidor uma chave que prova que a cópia é sua. Nunca envie o código por email.',
      lost: 'Perdeu o código? Sem ele ninguém consegue encontrar nem ler a cópia, nem a gente. Ela é excluída automaticamente 18 meses depois da última atualização.',
      form: {
        label: 'Código de recuperação',
        placeholder: 'XXXXX-XXXXX-XXXXXXXXXXXXXXXX',
        button: 'Excluir a cópia',
        working: 'Excluindo…',
        done: 'Excluída. A cópia saiu dos nossos servidores.',
        notFound: 'Não existe nenhuma cópia com este código, ou ela já foi excluída.',
        invalid: 'O código tem 26 letras e números. Confira e tente de novo.',
        busy: 'Muitas tentativas. Tente de novo daqui a uma hora.',
        failed: 'Não foi possível excluir agora. Tente de novo daqui a pouco.',
      },
    },
    table: {
      h: 'O que é excluído e quando',
      what: 'Dados',
      when: 'Quando',
      rows: [
        ['Mãos, sessões, notas de jogadores, bankroll, staking, configurações e bloqueio no celular', 'Na hora.'],
        ['Cópia na nuvem', 'Na hora. Uma cópia que não é atualizada por 18 meses é excluída automaticamente.'],
        ['Tudo o que você compartilhou por link: mãos (com comentários e votos), sessões ao vivo, páginas fixas para backers, conjuntos de mãos, perfil público, links para o coach e acordos enviados a backers', 'Os links param de funcionar na hora. Os registros saem dos servidores em até 60 dias.'],
        ['Comentários que você escreveu no app nas mãos de outros jogadores', 'Excluídos do servidor na hora, ou assim que houver conexão.'],
        ['Os convites deste celular (os que você fez e o que aceitou)', 'Excluídos do servidor na hora, ou assim que houver conexão.'],
        ['Swaps e grupos de swaps', 'Seu nome e sua chave de acesso são excluídos do servidor na hora. Um swap que nunca foi confirmado é excluído na hora, e um grupo que você criou é excluído na hora para todos. Num swap confirmado, os outros jogadores ficam no servidor com uma cópia só de leitura dos valores que vocês registraram por 90 dias, e depois ela é excluída. As cópias nos celulares dos outros jogadores não são afetadas.'],
      ],
    },
    kept: {
      h: 'O que fica',
      items: [
        'Mesmo sem você excluir nada, um swap ou grupo não confirmado sai do servidor 30 dias depois de criado, e um confirmado 400 dias depois da última atividade.',
        'Estatísticas de uso anônimas (por exemplo "mão salva"), com um ID aleatório da instalação. Não identificam ninguém e são excluídas depois de 12 meses.',
        'Os registros de compra, na Apple e no Google, pelo tempo que a lei exige.',
        'Fica no servidor, por até 400 dias, um código irreversível (hash) do ID da RevenueCat com quantos convites esse ID já usou, para o desconto não se repetir depois que você excluir os dados. Não tem a sua instalação nem as suas compras.',
        'Se alguém bloqueou os seus comentários numa mão, fica com essa mão um código irreversível que impede novos comentários seus. Ele sai quando a mão é excluída.',
        'No seu celular ficam o ID aleatório da instalação e se você já usou o teste grátis e o convite, para não serem oferecidos de novo. São excluídos quando você apaga o app. No iPhone, o ID aleatório da instalação fica no Keychain mesmo depois de você apagar o app, para uma reinstalação não repetir o convite; ele é excluído quando você redefine o iPhone.',
        'O registro na RevenueCat (um ID aleatório e as compras) pode ser excluído: escreva para support@sweatbook.poker com o ID do pedido do recibo que a Apple ou o Google enviaram por email, e excluímos em até 30 dias. A Apple e o Google guardam os próprios registros de compra.',
        'Um comentário que você escreveu no site, num navegador, não está ligado ao app: peça por email com o link da mão.',
      ],
    },
    cancel: { text: 'Excluir os dados não cancela o Pro.', link: 'Como cancelar' },
  },
  es: {
    meta: 'Eliminar tus datos',
    title: 'Eliminar tus datos',
    lede: 'Sweatbook no tiene cuentas: no hay email ni contraseña. Tus datos viven en tu teléfono y, solo si usas esas funciones, en copias en nuestros servidores. Puedes eliminarlo todo de una vez.',
    inApp: {
      h: 'En la app (lo más rápido)',
      steps: ['Abre Sweatbook.', 'Ajustes → Tus datos → Eliminar todos mis datos.', 'Toca Eliminar todo.'],
      after: 'Elimina todo en el teléfono y en nuestros servidores. Si estás sin conexión, las peticiones para eliminar salen en cuanto haya señal. No se puede deshacer: si quieres guardar algo, usa antes Exportar todo.',
    },
    noApp: {
      h: 'Sin la app',
      p: '¿Ya no tienes la app o el teléfono? La copia en la nube se elimina aquí abajo con el código de recuperación. Para lo demás, pídenoslo por email: como no hay cuentas, necesitamos el link de lo que quieres eliminar (manos compartidas, tu perfil, tus swaps). Te respondemos para confirmar y lo eliminamos en un plazo máximo de 30 días.',
      mail: 'Pedirlo por email',
      linkOnly: 'Basta con el link. Nunca te pedimos códigos ni llaves.',
      form: {
        legend: '¿Qué quieres eliminar?',
        items: {
          links: 'Manos compartidas por link (añade los links)',
          profile: 'Mi perfil público (añade el link)',
          swaps: 'Mis swaps (añade los links)',
          other: 'Otra cosa',
        },
        details: 'Links u otra información',
        placeholder: 'Pega aquí los links…',
        send: 'Abrir en el email',
        hint: `Abre tu app de email con la petición lista. ¿No se abre? Escribe a ${SUPPORT_EMAIL}.`,
        subject: 'Sweatbook · Petición para eliminar datos',
      },
    },
    backup: {
      h: 'Eliminar la copia en la nube con el código',
      p: 'El código se queda en este navegador: la página hace lo mismo que la app y solo envía al servidor una llave que prueba que la copia es tuya. Nunca nos envíes el código por email.',
      lost: '¿Perdiste el código? Sin él nadie puede encontrar ni leer la copia, ni nosotros. Se elimina sola 18 meses después de la última actualización.',
      form: {
        label: 'Código de recuperación',
        placeholder: 'XXXXX-XXXXX-XXXXXXXXXXXXXXXX',
        button: 'Eliminar la copia',
        working: 'Eliminando…',
        done: 'Eliminada. La copia ya no está en nuestros servidores.',
        notFound: 'No hay ninguna copia con este código, o ya se eliminó.',
        invalid: 'El código tiene 26 letras y números. Revísalo y vuelve a intentarlo.',
        busy: 'Demasiados intentos. Vuelve a intentarlo dentro de una hora.',
        failed: 'No se pudo eliminar ahora. Vuelve a intentarlo en un rato.',
      },
    },
    table: {
      h: 'Qué se elimina y cuándo',
      what: 'Datos',
      when: 'Cuándo',
      rows: [
        ['Manos, sesiones, notas de jugadores, bankroll, staking, ajustes y bloqueo en el teléfono', 'Al momento.'],
        ['Copia en la nube', 'Al momento. Una copia que no se actualiza durante 18 meses se elimina sola.'],
        ['Todo lo que compartiste por link: manos (con comentarios y votos), sesiones en directo, páginas fijas para backers, conjuntos de manos, perfil público, links para el coach y acuerdos enviados a backers', 'Los links dejan de funcionar al momento. Los registros salen de los servidores en un plazo máximo de 60 días.'],
        ['Comentarios que escribiste en la app en manos de otros jugadores', 'Se eliminan del servidor al momento, o en cuanto haya conexión.'],
        ['Las invitaciones de este teléfono (las que hiciste y la que aceptaste)', 'Se eliminan del servidor al momento, o en cuanto haya conexión.'],
        ['Swaps y grupos de swaps', 'Tu nombre y tu llave de acceso se eliminan del servidor al momento. Un swap que nunca se confirmó se elimina al momento, y un grupo que creaste se elimina al momento para todos. En un swap confirmado, los otros jugadores conservan en el servidor una copia de solo lectura de los importes que registraron juntos durante 90 días, y después se elimina. Las copias en los teléfonos de los otros jugadores no se tocan.'],
      ],
    },
    kept: {
      h: 'Qué se conserva',
      items: [
        'Aunque no elimines nada, un swap o grupo sin confirmar sale del servidor 30 días después de crearse, y uno confirmado 400 días después de la última actividad.',
        'Estadísticas de uso anónimas (por ejemplo "mano guardada"), con un ID aleatorio de la instalación. No identifican a nadie y se eliminan a los 12 meses.',
        'Los registros de compra, en Apple y Google, durante el tiempo que exige la ley.',
        'Se queda en el servidor, hasta 400 días, un código irreversible (hash) del ID de RevenueCat con cuántas invitaciones ya usó ese ID, para que el descuento no se repita después de eliminar tus datos. No incluye tu instalación ni tus compras.',
        'Si alguien bloqueó tus comentarios en una mano, se queda con esa mano un código irreversible que impide nuevos comentarios tuyos. Se elimina cuando se borra la mano.',
        'En tu teléfono quedan el ID aleatorio de la instalación y si ya usaste la prueba gratis y la invitación, para no repetirlas. Se eliminan al borrar la app. En el iPhone, el ID aleatorio de la instalación se queda en el llavero aunque borres la app, para que una reinstalación no repita la invitación; se elimina al restablecer el iPhone.',
        'El registro en RevenueCat (un ID aleatorio y las compras) se puede eliminar: escribe a support@sweatbook.poker con el ID de pedido del recibo que Apple o Google te enviaron por email, y lo eliminamos en un máximo de 30 días. Apple y Google guardan sus propios registros de compra.',
        'Un comentario que escribiste en la web, en un navegador, no está vinculado a la app: pídenoslo por email con el link de la mano.',
      ],
    },
    cancel: { text: 'Eliminar los datos no cancela Pro.', link: 'Cómo cancelar' },
  },
  en: {
    meta: 'Delete your data',
    title: 'Delete your data',
    lede: 'Sweatbook has no accounts: no email, no password. Your data lives on your phone and, only if you use those features, in copies on our servers. You can delete it all at once.',
    inApp: {
      h: 'In the app (fastest)',
      steps: ['Open Sweatbook.', 'Settings → Your data → Delete all my data.', 'Tap Delete everything.'],
      after: "It deletes everything on your phone and on our servers. If you're offline, the delete requests go out as soon as you have signal. It can't be undone: to keep anything, use Export everything first.",
    },
    noApp: {
      h: 'Without the app',
      p: 'Don\'t have the app or the phone any more? Delete your cloud backup right here with its recovery code. For everything else, ask us by email: with no accounts, we need the link to what you want deleted (shared hands, your profile, your swaps). We reply to confirm and delete within 30 days.',
      mail: 'Ask by email',
      linkOnly: 'The link is enough. We\'ll never ask for codes or keys.',
      form: {
        legend: 'What do you want deleted?',
        items: {
          links: 'Hands shared by link (add the links)',
          profile: 'My public profile (add the link)',
          swaps: 'My swaps (add the links)',
          other: 'Something else',
        },
        details: 'Links or other details',
        placeholder: 'Paste the links here…',
        send: 'Open in email',
        hint: `Opens your email app with the request ready. Nothing opens? Write to ${SUPPORT_EMAIL}.`,
        subject: 'Sweatbook · Data deletion request',
      },
    },
    backup: {
      h: 'Delete your cloud backup with its code',
      p: 'The code stays in this browser: the page does what the app does and only sends our server a key that proves the backup is yours. Never email us the code.',
      lost: 'Lost the code? Without it no one can find or read the backup, not even us. It\'s deleted automatically 18 months after its last update.',
      form: {
        label: 'Recovery code',
        placeholder: 'XXXXX-XXXXX-XXXXXXXXXXXXXXXX',
        button: 'Delete the backup',
        working: 'Deleting…',
        done: 'Deleted. The backup is off our servers.',
        notFound: 'There\'s no backup with this code, or it was already deleted.',
        invalid: 'The code has 26 letters and numbers. Check it and try again.',
        busy: 'Too many tries. Try again in an hour.',
        failed: 'Couldn\'t delete it right now. Try again shortly.',
      },
    },
    table: {
      h: 'What is deleted, and when',
      what: 'Data',
      when: 'When',
      rows: [
        ['Hands, sessions, player notes, bankroll, staking, settings and the app lock on your phone', 'Straight away.'],
        ['Cloud backup', 'Straight away. A backup not updated for 18 months is deleted automatically.'],
        ['Everything you shared by link: hands (with comments and votes), live sessions, fixed backer pages, hand packs, public profile, coach links and agreements sent to backers', 'The links stop working straight away. The records leave our servers within 60 days.'],
        ['Comments you wrote in the app on other players\' hands', 'Deleted from the server straight away, or as soon as there is signal.'],
        ['Invites from this phone (the ones you sent and the one you accepted)', 'Deleted from the server straight away, or as soon as there is signal.'],
        ['Swaps and swap groups', 'Your name and access token are deleted from the server immediately. A swap that was never confirmed is deleted at once, and a group you created is deleted for everyone at once. For a confirmed swap, the other player(s) keep a read-only copy of the amounts you both recorded on the server for 90 days, then it is deleted. The copies on the other players\' phones are not touched.'],
      ],
    },
    kept: {
      h: 'What we keep',
      items: [
        'Even if you delete nothing, an unconfirmed swap or group is deleted from the server 30 days after creation, and a confirmed one 400 days after the last activity.',
        'Anonymous usage statistics (for example "hand saved"), with a random install ID. They identify no one and are deleted after 12 months.',
        'Purchase records, at Apple and Google, for as long as the law requires.',
        'An irreversible code (hash) of the RevenueCat ID stays on our server for up to 400 days, with how many invites that ID has used, so the discount isn\'t repeated after you delete your data. It doesn\'t include your install or your purchases.',
        'If someone blocked your comments on a hand, an irreversible code stays with that hand so you can\'t comment there again. It goes when the hand is deleted.',
        'Your phone keeps the random install ID and whether you already used the free trial and the invite, so they aren\'t offered twice. They\'re removed when you delete the app. On an iPhone, the random install ID stays in the keychain even after you delete the app, so a reinstall doesn\'t repeat the invite; it goes when you reset the iPhone.',
        'Your RevenueCat record (a random ID and your purchases) can be deleted: email support@sweatbook.poker with the Order ID from the receipt Apple or Google emailed you, and we delete it within 30 days. Apple and Google keep their own purchase records.',
        'A comment you wrote on the website, in a browser, isn\'t tied to the app: email us with the hand\'s link.',
      ],
    },
    cancel: { text: 'Deleting your data does not cancel Pro.', link: 'How to cancel' },
  },
};

