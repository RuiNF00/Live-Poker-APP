// Spanish (neutral, "tú") help articles, by article id. Menu labels follow the app's es strings.
import type { ArticleText } from './articles';

export const ES: Record<string, ArticleText> = {
  'getting-started': {
    slug: 'primeros-pasos',
    title: 'Primeros pasos',
    summary: 'Sin cuenta ni email: instalas y registras tu primera mano.',
    body: [
      'Sweatbook no pide cuenta ni email. Todo lo que registras se queda en tu teléfono, y solo va a la nube si activas la copia de seguridad.',
      {
        steps: [
          'La primera vez, la app muestra una mano de ejemplo y pregunta qué juegas, cuántas sesiones haces y en qué moneda. Puedes tocar Omitir.',
          'Toca el + en el centro, abajo (Nueva mano), para registrar tu primera mano.',
          'En la pantalla de inicio aparece la tarjeta Primera semana con los siguientes pasos.',
        ],
      },
      'Abajo tienes las pestañas Manos, Sesión, Bankroll y Jugadores. Los Ajustes están en el engranaje, arriba en la pestaña Manos.',
    ],
  },
  'late-reg-reminder': {
    slug: 'recordatorio-late-reg',
    title: 'Recordatorio del late reg',
    summary: 'Marca los torneos del festival y te avisamos antes del cierre.',
    body: [
      'Sesión → Festivales → elige el festival y toca los eventos que vas a jugar. Te avisamos 30 min antes de cada uno y antes de que cierre el late reg.',
      'Si el organizador no publicó el cierre, toca Hora del late reg en el evento. Desactívalo en Ajustes → Notificaciones → Torneos planeados.',
    ],
  },
  'log-a-hand': {
    slug: 'registrar-una-mano',
    title: 'Registrar una mano rápido',
    summary: 'Posición, dos cartas y la acción, todo en una pantalla.',
    body: [
      {
        steps: [
          'Toca el + (Nueva mano).',
          'Elige tu posición y tus dos cartas. Los folds hasta ti se completan solos.',
          'Registra la acción con un toque por jugada. Hay tamaños listos y atajos como Solo X paga, Todos fold y Todos check. Si alguien entró en la mano, toca su asiento en la mesa.',
          'Cuando se cierra una calle, elige las cartas del board.',
          'Al final, toca Guardar y ver replay.',
        ],
      },
      'El juego, las ciegas y el número de jugadores aparecen arriba. Si tienes una sesión en curso, la mano usa esos datos. Para cambiarlos, toca esa barra (Contexto de la mano): torneo o cash, sala, ciegas, ante, jugadores en la mesa y, en torneo, la fase, el nivel y los jugadores que quedan.',
      'El número de asientos por defecto (6 a 10) se cambia en Ajustes → Perfil → Jugadores en la mesa.',
      { note: '¿Sin tiempo? Guardar ya guarda la mano tal como está, y Voz graba una nota de voz y guarda la mano cuando paras. La terminas después.' },
    ],
  },
  'unfinished-hands': {
    slug: 'manos-a-medias',
    title: 'Manos a medias y por completar',
    summary: '¿Cerraste a medias o guardaste con prisa? No se pierde nada.',
    body: [
      'Si cierras la pantalla con la X después de escribir algo, la mano queda como borrador. En la pantalla de inicio aparece Mano a medias: tócala para seguir o toca Descartar.',
      'Las manos guardadas con Guardar ya o Voz quedan marcadas Sin completar. Hay un filtro con ese nombre en la lista de manos, y en la página de la mano el aviso Mano por completar te lleva directo a editarla.',
      { note: 'En el plan gratis, la 4.ª mano nueva del día queda guardada como borrador hasta que tengas manos libres o el Pro.' },
    ],
  },
  'straddle-bomb-pot': {
    slug: 'straddle-y-bomb-pot',
    title: 'Straddles y bomb pots',
    summary: 'En cash, se eligen en Contexto de la mano → Esta mano.',
    body: [
      {
        steps: [
          'En la pantalla de la mano, toca la barra de arriba (Contexto de la mano).',
          'En Esta mano, elige Normal, Straddle, Re-straddle, Straddle en el botón o Bomb pot.',
          'En un bomb pot, escribe cuánto pone cada jugador (empieza en 2 ciegas grandes).',
        ],
      },
      'Estas opciones aparecen solo en cash.',
    ],
  },
  'run-it-twice': {
    slug: 'correr-dos-veces',
    title: 'Correr dos veces',
    summary: 'En un all-in antes del river, toca Correr 2 veces.',
    body: [
      'Cuando hay un all-in con dos o más jugadores y el board no está completo, aparece el botón Correr 2 veces (también en el showdown).',
      {
        steps: ['Toca Correr 2 veces.', 'Elige las cartas de la 2.ª vez.', 'Indica quién ganó la 1.ª y la 2.ª vez. El bote se reparte solo.'],
      },
    ],
  },
  'share-a-hand': {
    slug: 'compartir-una-mano',
    title: 'Compartir una mano',
    summary: 'Un link que tus amigos abren en el navegador, sin instalar nada.',
    body: [
      'En la página de la mano, en Compartir, toca Compartir con amigos. Quien abra el link ve el replay calle a calle y puede comentar, sin la app.',
      {
        list: [
          'Reto · Votación: el replay se detiene antes de tu decisión y cada persona vota antes de ver el resto. Los votos aparecen en la app, en Comentarios.',
          'Story · Instagram: imagen o video para tu Story (ver el artículo sobre Stories).',
          'Texto · Foro: la mano en texto, con o sin el link del replay.',
          'Exportar al solver: la mano en formato hand history (.txt) para solvers y trackers.',
        ],
      },
      'Compartir por link es ilimitado, también en el plan gratis. Sin conexión, el link queda listo cuando vuelva la señal.',
      { note: 'Para desactivar un link: en la página de la mano, en Comentarios, toca Dejar de compartir. El link deja de funcionar y se borran los comentarios; la mano se queda en tu cuaderno.' },
    ],
  },
  comments: {
    slug: 'comentarios',
    title: 'Comentarios en manos compartidas',
    summary: 'Quien abre el link comenta; tú decides qué se queda.',
    body: [
      'Los comentarios aparecen en la página de la mano, en Comentarios. En cada uno, Eliminar quita ese comentario y Bloquear impide que esa persona vuelva a comentar en esta mano (no se le avisa).',
      'Recibes una notificación por mano hasta que la abres, solo con la street. Entre las 23 h y las 12 h espera y llega a las 12 h. Actívala o desactívala en Ajustes → Notificaciones → Comentarios en tus manos.',
    ],
  },
  'what-a-link-shows': {
    slug: 'que-muestra-un-link',
    title: 'Qué muestra un link',
    summary: 'Las cartas, las fichas y tus notas. Los nombres de los demás, no.',
    body: [
      'Un link muestra la mano: las cartas, la acción, las fichas y los stacks, y tu nombre de jugador. Nunca incluye la sesión, la nota de voz, tus carpetas ni tus notas sobre rivales.',
      'El resto lo eliges en Ajustes → Manos que compartes:',
      { list: ['Nombres de los rivales: desactivado por defecto, solo se ven las posiciones.', 'Mis notas de la mano: activado por defecto.'] },
      'Estas opciones cuentan para los links nuevos; los que ya existen se quedan como estaban.',
    ],
  },
  'stories-session-card': {
    slug: 'stories-y-tarjeta-de-sesion',
    title: 'Stories y tarjeta de sesión',
    summary: 'Tu mano o tu sesión en Instagram, con los importes ocultos si quieres.',
    body: [
      'Mano: en la página de la mano, toca Story · Instagram. Hay tres modos: Pregunta (se detiene antes de la decisión), Resultado y Video (15 a 30 segundos, también para Reels, TikTok y WhatsApp). Necesita conexión.',
      'Sesión: en el resumen de la sesión, toca Compartir sesión (o abre la sesión en Bankroll y toca Compartir). Elige el estilo Noite, Brasa o Sticker (fondo transparente para ponerlo sobre una foto) y activa Ocultar cantidades para mostrar solo horas, manos y botes en ciegas grandes.',
      { note: 'Con Pro puedes añadir tu voz y quitar la marca Sweatbook.' },
    ],
  },
  'privacy-lock': {
    slug: 'ocultar-importes-y-bloquear',
    title: 'Ocultar importes y bloquear la app',
    summary: 'Enseña la app en la mesa sin enseñar tus números.',
    body: [
      'Ajustes → Privacidad → Ocultar cantidades: en toda la app aparece ••• en lugar de dinero.',
      'Ajustes → Privacidad → Bloquear la app: pide Face ID, huella o el código del teléfono al abrir la app y cuando vuelves tras 30 segundos fuera. También puedes usar un PIN de 4 dígitos.',
      { note: 'Un PIN olvidado no se puede recuperar. Antes de activarlo, activa la copia en la nube y guarda el código de recuperación.' },
    ],
  },
  'public-profile': {
    slug: 'perfil-publico',
    title: 'Perfil público',
    summary: 'Una página tuya con las manos y sesiones que elijas.',
    body: [
      'Ajustes → Herramientas → Perfil público. Elige tu nombre de usuario, el nombre que se muestra y una bio, y toca Crear perfil público. La página queda en sweatbook.poker/u/nombre.',
      'Solo entran las manos que ya compartiste por link y las sesiones terminadas que elijas (hasta 30). Ocultar montos quita resultados y buy-ins.',
      { note: 'Si cambias el nombre de usuario, el link antiguo deja de funcionar. Eliminar perfil quita la página.' },
    ],
  },
  staking: {
    slug: 'staking-y-backers',
    title: 'Staking: registrar la acción vendida y las cuentas de los backers',
    summary: 'Solo registro y cuentas. Ningún dinero pasa por Sweatbook.',
    body: [
      'Sweatbook guarda lo que acordaste con tus backers y hace las cuentas. Los pagos se siguen haciendo entre ustedes, como siempre.',
      {
        steps: [
          'En la sesión, toca Staking y, en Acción vendida, añade al backer.',
          'Elige el acuerdo (solo esta sesión o un paquete), el porcentaje y el markup, y si ya pagó.',
          'En Bankroll → Staking ves el saldo y el makeup de cada backer, y los jugadores a los que respaldas.',
        ],
      },
      'Para enviar las cuentas, abre al backer y toca Enviar cuentas. El link lleva solo la parte de ese backer (hasta 30 sesiones), sin notas, manos ni otros backers, y los números van en el propio link: el servidor no los ve.',
      'Link en vivo: en Staking, toca Crear link para esta sesión. Tus backers ven tu stack, el nivel y el resultado actualizarse, sin notas, manos ni nombres.',
      { note: 'La gestión del staking (saldos, makeup y extractos de los backers) es parte del Pro.' },
    ],
  },
  swaps: {
    slug: 'swaps',
    title: 'Swaps entre jugadores',
    summary: 'Los dos confirman los términos por link; la app hace las cuentas.',
    body: [
      {
        steps: [
          'En Bankroll → Swaps, toca Nuevo swap.',
          'Elige con quién, el porcentaje (desactiva El mismo porcentaje para un swap desigual, por ejemplo 3% por 2%) y si es para Un evento o para la Serie completa.',
          'Toca Crear y enviar link y envíaselo solo al otro jugador.',
          'Él toca Confirmo el swap en el navegador, con o sin la app. Desde ese momento, los términos y la hora quedan fijados y los dos reciben el código del acuerdo.',
        ],
      },
      'Cuando alguien cobra, toca Cobré y registra el premio. La app indica quién debe cuánto a quién; cuando pagues, regístralo en Pagué. Compartir las cuentas envía el resumen al otro jugador.',
      'Si vendiste acción, el swap sale solo de tu parte: tus backers siguen con su porcentaje del premio entero.',
      'Crear swaps y registrar resultados es gratis. La liquidación (quién le debe a quién) y el historial son parte del Pro. Confirmar un swap por link siempre es gratis.',
      { note: 'Solo registro y cuentas: ningún dinero pasa por Sweatbook, los pagos se hacen entre ustedes. Solo para mayores de 18 años.' },
    ],
  },
  taxes: {
    slug: 'impuestos',
    title: 'Impuestos y recibos',
    summary: 'Resultados por país e impuesto retenido, listos para tu asesor.',
    body: [
      'Al editar una sesión, toca Impuestos y recibos. Elige el país (se recuerda para esa sala), el impuesto retenido y su estado (Por recuperar, Recuperado o Queda pagado), y adjunta fotos o archivos de los recibos. Los recibos se quedan en el teléfono, no van a la nube.',
      'El informe está en Ajustes → Copia de seguridad → Informe PDF y CSV (Pro). El PDF muestra los resultados por país y el impuesto retenido por recuperar.',
      { note: 'Esto no es asesoramiento fiscal. Son los números que registraste, ordenados por país. Confírmalo siempre con un asesor.' },
    ],
  },
  backup: {
    slug: 'copia-de-seguridad',
    title: 'Copia de seguridad y teléfono nuevo',
    summary: 'Un código de recuperación y vuelven todas tus manos.',
    body: [
      'Ajustes → Copia de seguridad → Activar copia en la nube. Recibes un código de recuperación de 26 caracteres: guárdalo en un lugar seguro. La copia se cifra en tu teléfono con ese código antes de salir, y se actualiza sola.',
      {
        steps: ['En el teléfono nuevo, instala Sweatbook.', 'Ve a Ajustes → Copia de seguridad → Recuperar con código.', 'Pega el código y toca Recuperar.'],
      },
      'También puedes guardar un archivo: Exportar todo crea un .json con todo, siempre gratis. Importar archivo junta ese archivo con lo que ya tienes, sin borrar nada.',
      'La copia lleva manos, sesiones, notas de jugadores, bankroll, staking y ajustes. Los recibos se quedan solo en el teléfono. Si ves «La copia es demasiado grande para la nube», usa Exportar todo.',
      'Dos teléfonos con el mismo código comparten una sola copia, y el último en enviar reemplaza la anterior. En el segundo, toca primero Recuperar con código: junta todo y se queda la versión más reciente de cada cosa.',
      { note: 'Sin el código nadie puede leer la copia, ni nosotros. Si lo pierdes, no hay forma de recuperarla.' },
    ],
  },
  import: {
    slug: 'importar-de-otra-app',
    title: 'Importar de otra app',
    summary: 'Trae tu historial de sesiones y bankroll.',
    body: [
      'Ajustes → Copia de seguridad → Importar de otra app. Funciona con Poker Bankroll Tracker, Pokerbase, Poker Analytics, cualquier CSV (revisas las columnas antes de importar) y copias .json de Sweatbook.',
      'Entran sesiones, depósitos y retiradas. Las manos de otras apps no se importan.',
    ],
  },
  export: {
    slug: 'exportar',
    title: 'Exportar a solver, PDF y CSV',
    summary: 'Una mano para GTO Wizard o todo el año en PDF.',
    body: [
      'Una mano: en la página de la mano, toca Exportar al solver y luego Copiar texto o Guardar archivo .txt. El formato hand history se abre en GTO Wizard, PioSolver, Hold’em Manager y PokerTracker. Solo funciona con manos completas.',
      'Varias manos a la vez: selecciónalas en la lista de manos y toca Exportar al solver (Pro).',
      'Todas las sesiones en CSV, gratis: Ajustes → Exportar sesiones en CSV. Se abre en Excel y vuelve a entrar por Importar.',
      'Informes (Pro): Ajustes → Copia de seguridad → Informe PDF y CSV. Elige un periodo o un bankroll y exporta el PDF, las sesiones o las manos en CSV. La copia completa en .json es gratis.',
    ],
  },
  'erase-all': {
    slug: 'borrar-todo',
    title: 'Eliminar todos mis datos',
    summary: 'Borra todo de tu teléfono y de nuestros servidores.',
    body: [
      'Ajustes → Tus datos → Eliminar todos mis datos → Eliminar todo.',
      {
        list: [
          'En el teléfono: manos, sesiones, notas de jugadores, bankroll, staking, ajustes, el bloqueo y las notificaciones.',
          'En nuestros servidores: la copia en la nube, los links de manos, las páginas en vivo, el perfil público y los links de cuentas. Si estás sin conexión, se borran cuando vuelva la señal.',
        ],
      },
      'No se puede deshacer. Si quieres guardar algo, usa antes Exportar todo.',
      'En Android, si reinstalas la app justo después, la copia automática de Google todavía puede traer los datos antiguos durante un día.',
      { note: 'Borrar tus datos no cancela el Pro. Para eso, cancélalo en la App Store o en Google Play (ver Cancelar el Pro).' },
    ],
  },
  'free-plan': {
    slug: 'plan-gratis',
    title: 'Qué incluye el plan gratis',
    summary: '3 manos nuevas al día y compartir sin límite, para siempre.',
    body: [
      {
        list: [
          '3 manos nuevas al día (la 4.ª queda guardada como borrador).',
          'Compartir por link sin límite, con replay y votación.',
          'Importar de otras apps.',
          'Seguridad: copia en la nube, ocultar importes y bloqueo de la app.',
          'La sesión en la pantalla de bloqueo, la calculadora de odds, el ICM y el planificador del festival con los horarios.',
          'Crear swaps y registrar resultados.',
          'Compartir tu conteo de fichas.',
          'Un bankroll y un viaje.',
          'Exportar una mano para solver, todas las sesiones en CSV y la copia completa en .json.',
        ],
      },
      'El Pro quita el límite de manos y añade: la gestión del staking (cuentas y extractos de los backers), la liquidación y el historial de los swaps, el informe de impuestos, el total en varias monedas, varios bankrolls con filtros, las lecturas del bankroll (varianza, comparación de meses y riesgo de ruina), el rango editable, el informe PDF y el CSV por periodo y de las manos, exportar varias manos, viajes ilimitados y Stories con tu voz o tu cara y sin marca.',
    ],
  },
  pro: {
    slug: 'sweatbook-pro',
    title: 'Sweatbook Pro: precios y prueba gratis',
    summary: 'Mensual o anual, con 3 días gratis en el anual.',
    body: [
      { list: ['Mensual: 29,99 US$ al mes.', 'Anual: 199,99 US$ al año, con 3 días gratis.'] },
      'El precio en tu moneda es el que muestra la App Store o Google Play. El pago se hace en la tienda y se renueva solo hasta que canceles. Durante la prueba gratis, te avisamos antes del cobro.',
    ],
  },
  'restore-purchases': {
    slug: 'restaurar-compras',
    title: 'Restaurar compras',
    summary: '¿Pagaste el Pro y la app no lo reconoce?',
    body: [
      'Ajustes → Cuenta → Restaurar compras (también está al final de la pantalla del Pro). Usa la misma cuenta de Apple o Google con la que pagaste.',
      'En un teléfono nuevo, restaura primero las compras y luego tus manos con el código de recuperación (ver Copia de seguridad).',
    ],
  },
  cancel: {
    slug: 'cancelar-el-pro',
    title: 'Cancelar el Pro',
    summary: 'Se cancela en la tienda; tus manos se quedan.',
    body: [
      {
        steps: [
          'Ajustes → Cuenta → Tu suscripción.',
          'Toca Cancelar en la App Store (o en Google Play). Se abre la página de suscripciones de la tienda.',
          'Cancela allí. El Pro sigue activo hasta el final del periodo pagado.',
        ],
      },
      'Después vuelves a 3 manos nuevas al día. No se borra nada de lo que registraste.',
    ],
  },
  'no-lifetime': {
    slug: 'plan-vitalicio',
    title: '¿Hay un plan vitalicio?',
    summary: 'No. Hay plan mensual y anual.',
    body: ['Por ahora no hay pago único. El plan anual es el más barato por mes y tiene 3 días gratis.', 'El plan gratis no caduca: puedes usarlo siempre.'],
  },
  lifetime: {
    slug: 'plan-vitalicio',
    title: '¿Hay un plan vitalicio?',
    summary: 'Sí, para quien no quiere suscripción. Aparece al cancelar.',
    body: [
      'El Pro es una suscripción mensual o anual. Si prefieres pagar una vez, existe Pro para siempre, por 499 US$ (el precio en tu moneda es el de la tienda).',
      'No está en la pantalla del Pro. Aparece cuando cancelas y eliges «No quiero una suscripción»:',
      {
        steps: [
          'Ajustes → Cuenta → Tu suscripción.',
          'En «¿Por qué quieres cancelar?», elige No quiero una suscripción.',
          'Toca Comprar una vez.',
          'Después cancela la suscripción en la App Store o en Google Play, para no pagar las dos cosas.',
        ],
      },
      { note: 'El pago único no cancela la suscripción por sí solo. Cancélala en la tienda justo después.' },
    ],
  },
  invite: {
    slug: 'invitar-amigos',
    title: 'Invitar amigos',
    summary: 'Los dos reciben un 50% en el primer mes de Pro.',
    body: [
      'Ajustes → Herramientas → Invitar amigos → Compartir invitación.',
      'Cuando tu amigo instala y guarda su primera mano en los 7 días siguientes, los dos reciben un 50% en el primer mes de Pro, para usar en las 72 horas siguientes. En iPhone el descuento es un código de la App Store que la app abre por ti. Cuenta para hasta 10 amigos al año.',
      '¿Te llegó un código en vez de un link? En Ajustes, toca Tengo un código de invitación y luego Usar (solo en los primeros 7 días después de instalar).',
    ],
  },
  contact: {
    slug: 'contacto',
    title: 'Hablar con nosotros',
    summary: 'Escríbenos; responde quien hace la app.',
    body: [
      'Escribe a support@sweatbook.poker. Responde quien hace Sweatbook, normalmente en 2 días hábiles.',
      'Si es un problema, dinos el modelo de tu teléfono, la versión de la app (abajo en Ajustes) y qué estabas haciendo. Una captura de pantalla ayuda mucho.',
      'Las ideas también son bienvenidas: muchas de las novedades de la app vinieron de pedidos de jugadores.',
      { note: 'Sweatbook es para mayores de 18 años. Es una app de registro: no tiene juego con dinero y ningún dinero pasa por ella.' },
    ],
  },
};
