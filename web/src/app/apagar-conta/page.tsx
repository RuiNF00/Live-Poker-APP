import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { HELP_BASE, HELP_INDEXED, helpLocale, LANG_TAG } from '@/components/help/copy';
import { DeleteRequestForm, type DeleteFormCopy } from '@/components/help/DeleteRequestForm';
import { HelpShell, sameIn } from '@/components/help/HelpShell';
import { articles, SUPPORT_EMAIL, textOf, type HelpLocale } from '@/lib/help/articles';

// sweatbook.poker/apagar-conta: the deletion page Google Play asks for (Data safety → delete
// account URL). Sweatbook has no accounts, so it explains "Apagar todos os meus dados" in the
// app and, for someone without the app, builds a request email. Nothing is stored here.
// Language: ?lang=pt|pt-BR|es|en, else the browser's. /pt-br/apagar-conta, /es/eliminar-cuenta
// and /delete-data redirect here (next.config.ts).
type Search = Record<string, string | string[] | undefined>;

interface Copy {
  meta: string;
  title: string;
  lede: string;
  inApp: { h: string; steps: string[]; after: string };
  noApp: { h: string; p: string; form: DeleteFormCopy };
  table: { h: string; what: string; when: string; rows: [string, string][] };
  kept: { h: string; items: string[] };
  cancel: { text: string; link: string };
}

const COPY: Record<HelpLocale, Copy> = {
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
      p: 'Já não tens a app ou o telemóvel? Pede-nos por email. Como não há contas, precisamos de algo que nos leve aos teus dados: os links que partilhaste, o link do teu perfil ou dos teus swaps, ou o código de recuperação da cópia na nuvem (só o usamos para a encontrar e apagar). Respondemos a confirmar e apagamos em até 30 dias.',
      form: {
        legend: 'O que queres apagar?',
        items: {
          backup: 'A cópia na nuvem (junta o código de recuperação)',
          links: 'Mãos partilhadas por link (junta os links)',
          profile: 'O meu perfil público (junta o link)',
          swaps: 'Os meus swaps (junta os links)',
          other: 'Outra coisa',
        },
        details: 'Links, código ou outra informação',
        placeholder: 'Cola aqui os links ou o código…',
        send: 'Abrir no email',
        hint: `Abre a tua app de email com o pedido pronto. Não abre? Escreve para ${SUPPORT_EMAIL}.`,
        subject: 'Sweatbook · Pedido para apagar dados',
      },
    },
    table: {
      h: 'O que é apagado e quando',
      what: 'Dados',
      when: 'Quando',
      rows: [
        ['Mãos, sessões, notas de jogadores, bankroll, staking, definições e bloqueio no telemóvel', 'De imediato.'],
        ['Cópia na nuvem', 'De imediato. Uma cópia que não é atualizada durante 18 meses é apagada sozinha.'],
        ['Tudo o que partilhaste por link: mãos (com comentários e votos), sessões em direto, perfil público, links para o coach e acordos enviados a backers', 'Os links deixam de funcionar de imediato. Os registos saem dos servidores em até 60 dias.'],
        ['Swaps ainda por confirmar', 'De imediato.'],
        ['Swaps confirmados', 'O teu nome sai de imediato. O outro jogador fica com uma cópia só de leitura, com os valores e a nota de que apagaste os teus dados, para saber como ficam as contas dele. Essa cópia sai dos servidores 400 dias depois da última atividade.'],
      ],
    },
    kept: {
      h: 'O que fica',
      items: [
        'Estatísticas de utilização anónimas (por exemplo "mão guardada"), com um ID aleatório da instalação. Não identificam ninguém e são apagadas ao fim de 12 meses.',
        'Os registos de compra, na Apple, na Google e na RevenueCat (o estado da subscrição), pelo tempo que a lei exige.',
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
      p: 'Não tem mais o app ou o celular? Peça por email. Como não há contas, precisamos de algo que nos leve aos seus dados: os links que você compartilhou, o link do seu perfil ou dos seus swaps, ou o código de recuperação da cópia na nuvem (só usamos para encontrá-la e excluí-la). Respondemos confirmando e excluímos em até 30 dias.',
      form: {
        legend: 'O que você quer excluir?',
        items: {
          backup: 'A cópia na nuvem (inclua o código de recuperação)',
          links: 'Mãos compartilhadas por link (inclua os links)',
          profile: 'Meu perfil público (inclua o link)',
          swaps: 'Meus swaps (inclua os links)',
          other: 'Outra coisa',
        },
        details: 'Links, código ou outra informação',
        placeholder: 'Cole aqui os links ou o código…',
        send: 'Abrir no email',
        hint: `Abre o seu app de email com o pedido pronto. Não abriu? Escreva para ${SUPPORT_EMAIL}.`,
        subject: 'Sweatbook · Pedido de exclusão de dados',
      },
    },
    table: {
      h: 'O que é excluído e quando',
      what: 'Dados',
      when: 'Quando',
      rows: [
        ['Mãos, sessões, notas de jogadores, bankroll, staking, configurações e bloqueio no celular', 'Na hora.'],
        ['Cópia na nuvem', 'Na hora. Uma cópia que não é atualizada por 18 meses é excluída automaticamente.'],
        ['Tudo o que você compartilhou por link: mãos (com comentários e votos), sessões ao vivo, perfil público, links para o coach e acordos enviados a backers', 'Os links param de funcionar na hora. Os registros saem dos servidores em até 60 dias.'],
        ['Swaps ainda não confirmados', 'Na hora.'],
        ['Swaps confirmados', 'Seu nome sai na hora. O outro jogador fica com uma cópia só de leitura, com os valores e a nota de que você excluiu seus dados, para saber como ficam as contas dele. Essa cópia sai dos servidores 400 dias depois da última atividade.'],
      ],
    },
    kept: {
      h: 'O que fica',
      items: [
        'Estatísticas de uso anônimas (por exemplo "mão salva"), com um ID aleatório da instalação. Não identificam ninguém e são excluídas depois de 12 meses.',
        'Os registros de compra, na Apple, no Google e na RevenueCat (o status da assinatura), pelo tempo que a lei exige.',
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
      p: '¿Ya no tienes la app o el teléfono? Pídenoslo por email. Como no hay cuentas, necesitamos algo que nos lleve a tus datos: los links que compartiste, el link de tu perfil o de tus swaps, o el código de recuperación de la copia en la nube (solo lo usamos para encontrarla y eliminarla). Te respondemos para confirmar y lo eliminamos en un plazo máximo de 30 días.',
      form: {
        legend: '¿Qué quieres eliminar?',
        items: {
          backup: 'La copia en la nube (añade el código de recuperación)',
          links: 'Manos compartidas por link (añade los links)',
          profile: 'Mi perfil público (añade el link)',
          swaps: 'Mis swaps (añade los links)',
          other: 'Otra cosa',
        },
        details: 'Links, código u otra información',
        placeholder: 'Pega aquí los links o el código…',
        send: 'Abrir en el email',
        hint: `Abre tu app de email con la petición lista. ¿No se abre? Escribe a ${SUPPORT_EMAIL}.`,
        subject: 'Sweatbook · Petición para eliminar datos',
      },
    },
    table: {
      h: 'Qué se elimina y cuándo',
      what: 'Datos',
      when: 'Cuándo',
      rows: [
        ['Manos, sesiones, notas de jugadores, bankroll, staking, ajustes y bloqueo en el teléfono', 'Al momento.'],
        ['Copia en la nube', 'Al momento. Una copia que no se actualiza durante 18 meses se elimina sola.'],
        ['Todo lo que compartiste por link: manos (con comentarios y votos), sesiones en directo, perfil público, links para el coach y acuerdos enviados a backers', 'Los links dejan de funcionar al momento. Los registros salen de los servidores en un plazo máximo de 60 días.'],
        ['Swaps sin confirmar', 'Al momento.'],
        ['Swaps confirmados', 'Tu nombre se elimina al momento. El otro jugador conserva una copia de solo lectura, con los importes y la nota de que eliminaste tus datos, para saber cómo quedan sus cuentas. Esa copia sale de los servidores 400 días después de la última actividad.'],
      ],
    },
    kept: {
      h: 'Qué se conserva',
      items: [
        'Estadísticas de uso anónimas (por ejemplo "mano guardada"), con un ID aleatorio de la instalación. No identifican a nadie y se eliminan a los 12 meses.',
        'Los registros de compra, en Apple, Google y RevenueCat (el estado de la suscripción), durante el tiempo que exige la ley.',
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
      p: "Don't have the app or the phone any more? Ask us by email. With no accounts, we need something that leads us to your data: the links you shared, the link to your profile or your swaps, or your cloud backup's recovery code (we only use it to find and delete the backup). We reply to confirm and delete within 30 days.",
      form: {
        legend: 'What do you want deleted?',
        items: {
          backup: 'My cloud backup (add the recovery code)',
          links: 'Hands shared by link (add the links)',
          profile: 'My public profile (add the link)',
          swaps: 'My swaps (add the links)',
          other: 'Something else',
        },
        details: 'Links, code or other details',
        placeholder: 'Paste the links or the code here…',
        send: 'Open in email',
        hint: `Opens your email app with the request ready. Nothing opens? Write to ${SUPPORT_EMAIL}.`,
        subject: 'Sweatbook · Data deletion request',
      },
    },
    table: {
      h: 'What is deleted, and when',
      what: 'Data',
      when: 'When',
      rows: [
        ['Hands, sessions, player notes, bankroll, staking, settings and the app lock on your phone', 'Straight away.'],
        ['Cloud backup', 'Straight away. A backup not updated for 18 months is deleted automatically.'],
        ['Everything you shared by link: hands (with comments and votes), live sessions, public profile, coach links and agreements sent to backers', 'The links stop working straight away. The records leave our servers within 60 days.'],
        ['Swaps not yet confirmed', 'Straight away.'],
        ['Confirmed swaps', 'Your name goes straight away. The other player keeps a read-only copy, with the amounts and a note that you deleted your data, so they still know where their accounts stand. That copy leaves our servers 400 days after its last activity.'],
      ],
    },
    kept: {
      h: 'What we keep',
      items: [
        'Anonymous usage statistics (for example "hand saved"), with a random install ID. They identify no one and are deleted after 12 months.',
        'Purchase records, at Apple, Google and RevenueCat (your subscription status), for as long as the law requires.',
      ],
    },
    cancel: { text: 'Deleting your data does not cancel Pro.', link: 'How to cancel' },
  },
};

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

async function localeFor(search: Search): Promise<HelpLocale> {
  const fromParam = helpLocale(one(search.lang));
  if (fromParam) return fromParam;
  const first = (await headers()).get('accept-language')?.split(',')[0];
  return helpLocale(first) ?? 'pt';
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const locale = await localeFor(await searchParams);
  return { title: COPY[locale].meta, robots: HELP_INDEXED ? undefined : { index: false, follow: false } };
}

export default async function DeleteDataPage({ searchParams }: { searchParams: Promise<Search> }) {
  const locale = await localeFor(await searchParams);
  const c = COPY[locale];
  const cancel = articles().find((a) => a.id === 'cancel');

  return (
    <HelpShell locale={locale} hrefs={sameIn((l) => `/apagar-conta?lang=${LANG_TAG[l]}`)}>
      <section className="hc-hero">
        <h1>{c.title}</h1>
        <p className="hc-lede">{c.lede}</p>
      </section>

      <section className="hc-cat">
        <h2>{c.inApp.h}</h2>
        <ol className="hc-steps">
          {c.inApp.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="hc-plain">{c.inApp.after}</p>
      </section>

      <section className="hc-cat">
        <h2>{c.noApp.h}</h2>
        <p className="hc-plain">{c.noApp.p}</p>
        <DeleteRequestForm to={SUPPORT_EMAIL} c={c.noApp.form} />
      </section>

      <section className="hc-cat">
        <h2>{c.table.h}</h2>
        <dl className="hc-table">
          {c.table.rows.map(([what, when]) => (
            <div key={what}>
              <dt>{what}</dt>
              <dd>{when}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="hc-cat">
        <h2>{c.kept.h}</h2>
        <ul className="hc-bullets">
          {c.kept.items.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="hc-note">
          {c.cancel.text}{' '}
          {cancel ? <Link href={`${HELP_BASE[locale]}/${textOf(cancel, locale).slug}`}>{c.cancel.link}</Link> : null}
        </p>
      </section>
    </HelpShell>
  );
}
