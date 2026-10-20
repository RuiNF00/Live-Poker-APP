// Settings › Notificações: one switch per kind, the same list as the Android
// channels (lib/notify-policy). The notice before a charge has no switch: it
// protects the player, and whoever doesn't want it turns notifications off in
// the system.

import React, { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { ListGroup, ListItem, Section, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { commentPushAvailable, turnOffCommentPush, turnOnCommentPush } from '@/lib/comment-push';
import { useCommentPushReady } from '@/lib/comment-push-ready';
import { notifications } from '@/lib/lock-screen/reminder';
import { kindOn, type NotifyKind } from '@/lib/notify-policy';
import { useStore } from '@/store/store';
import { C } from '@/theme';

type IconName = React.ComponentProps<typeof ToggleItem>['icon'];

// A function, so t() runs in the current language and the strings checker sees each one.
const rows = (): { kind: NotifyKind; title: string; subtitle: string; icon: IconName }[] => [
  { kind: 'levels', title: t('Níveis e intervalos'), subtitle: t('Quando o nível sobe e o intervalo acaba'), icon: 'trending-up-outline' },
  { kind: 'festival', title: t('Torneios planeados'), subtitle: t('30 min antes e quando o late reg fecha'), icon: 'calendar-outline' },
  { kind: 'money', title: t('Swaps e staking'), subtitle: t('Novidades nos swaps e acertos por fazer'), icon: 'people-outline' },
  { kind: 'coach', title: t('Coach'), subtitle: t('Quando o coach comenta as tuas mãos'), icon: 'school-outline' },
  { kind: 'comments', title: t('Comentários nas tuas mãos'), subtitle: t('Quando alguém comenta uma mão que partilhaste'), icon: 'chatbubbles-outline' },
  { kind: 'recap', title: t('Resumo do mês'), subtitle: t('No dia 1, se jogaste nesse mês'), icon: 'stats-chart-outline' },
  { kind: 'tips', title: t('Lembretes para registar'), subtitle: t('A tua semana ao domingo, e se passares uns dias sem registar'), icon: 'create-outline' },
];

/** null on web or while checking; false when the system said no. */
function useSystemAllowed(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const n = notifications();
    if (!n) return;
    const check = () =>
      n
        .getPermissionsAsync()
        .then((p) => setOk(p.granted || p.canAskAgain))
        .catch(() => {});
    check();
    // Back from the system settings: read it again.
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => sub.remove();
  }, []);
  return ok;
}

export function NotificationSettings() {
  const { settings, setSettings, hands } = useStore();
  const allowed = useSystemAllowed();
  const set = (kind: NotifyKind, v: boolean) => {
    if (kind === 'recap') return setSettings({ monthRecap: v });
    setSettings({ notify: { ...settings.notify, [kind]: v } });
    // Comment notices are a push from the server: off means it forgets this phone's token.
    const shared = hands.filter((h) => h.shareId && h.shareToken);
    if (kind === 'comments') void (v ? Promise.all(shared.map(turnOnCommentPush)) : turnOffCommentPush(shared));
  };
  const push = commentPushAvailable();
  // Android without a push token yet (no Firebase): no row at all, back by itself once there is one.
  const ready = useCommentPushReady();

  return (
    <Section title={t('Notificações')}>
      {allowed === false ? (
        <ListGroup>
          <ListItem
            icon="notifications-off-outline"
            iconColor={C.warn}
            title={t('Notificações desligadas no telemóvel')}
            subtitle={t('Liga-as nas definições do sistema para receberes os avisos que escolheres aqui.')}
            value={t('Abrir definições')}
            onPress={() => Linking.openSettings().catch(() => {})}
          />
        </ListGroup>
      ) : null}
      <ListGroup>
        {rows()
          .filter((r) => r.kind !== 'comments' || !push || ready)
          .map((r) =>
            r.kind === 'comments' && !push ? (
              <ListItem key={r.kind} icon={r.icon} iconColor={C.textDim} title={r.title} subtitle={t('Disponível na versão da loja')} chevron={false} />
            ) : (
              <ToggleItem key={r.kind} icon={r.icon} title={r.title} subtitle={r.subtitle} value={kindOn(settings, r.kind)} onChange={(v) => set(r.kind, v)} />
            ),
          )}
        <ListItem icon="card-outline" title={t('Aviso antes de cobrar')} subtitle={t('Durante o teste grátis avisamos-te antes de cobrar.')} />
      </ListGroup>
      <ListGroup>
        <ToggleItem icon="cash-outline" title={t('Mostrar valores nas notificações')} subtitle={t('Aparecem no ecrã bloqueado.')} value={!!settings.notifyAmounts} onChange={(notifyAmounts) => setSettings({ notifyAmounts })} />
        <ToggleItem
          icon="moon-outline"
          title={t('Silenciar durante a sessão')}
          subtitle={t('O resto chega quando paras ou acabas. Os níveis tocam sempre.')}
          value={settings.notifyHoldInSession !== false}
          onChange={(notifyHoldInSession) => setSettings({ notifyHoldInSession })}
        />
      </ListGroup>
    </Section>
  );
}
