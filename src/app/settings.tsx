// Settings: your name and defaults, backups (file, CSV, cloud code), purchases
// and the legal pages the stores require.

import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { manageSubscription } from '@/billing/purchases';
import { lockChanged } from '@/components/AppLock';
import { AppLockSetting } from '@/components/AppLockSetting';
import { CURRENCIES } from '@/components/BankrollSheets';
import { CloudBackup } from '@/components/CloudBackup';
import { Button, Card, Chip, ChipRow, confirmAction, Field, ListGroup, ListItem, Pill, Row, Section, Segmented, T, tap, ToggleItem, Wordmark } from '@/components/ui';
import { LANG_KEY, t, VARIANT_NAME, VARIANTS, variant, type Variant } from '@/i18n';
import { lockSupported } from '@/lib/app-lock';
import { pickTextFile, saveTextFile } from '@/lib/files';
import { canEnterCode, claimInvite, type ClaimResult } from '@/lib/referrals';
import { buildBackup, importSummary, parseBackup } from '@/store/backup';
import { useStore } from '@/store/store';
import { BRAND, C, F, S } from '@/theme';


function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

/** What support needs to reproduce a bug, and nothing about the player. */
// The help centre in each app language (web /ajuda, /pt-br/ajuda, /es/ayuda, /help).
const HELP_PATH: Record<Variant, string> = { 'pt-PT': 'ajuda', 'pt-BR': 'pt-br/ajuda', es: 'es/ayuda', en: 'help' };

function deviceLine() {
  return `Sweatbook ${Constants.expoConfig?.version ?? ''} · ${Platform.OS} ${Platform.Version} · ${variant}`;
}

const MAIL_SUBJECT = { bug: 'Problema na Sweatbook', suggestion: 'Sugestão para a Sweatbook', support: 'Pedido de suporte' } as const;

/**
 * Opens an email to support with the app version, system and language
 * already filled in. No mail app (or the web): the support page instead.
 */
function mailSupport(topic: keyof typeof MAIL_SUBJECT) {
  const subject = encodeURIComponent(t(MAIL_SUBJECT[topic]));
  const body = encodeURIComponent(`\n\n\n— ${deviceLine()}`);
  const page = () => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/support`).catch(() => {});
  if (Platform.OS === 'web') return void page();
  Linking.openURL(`mailto:${BRAND.supportEmail}?subject=${subject}&body=${body}`).catch(page);
}

/**
 * Phones pick the app's language in the system settings (iOS and Android 13+
 * list it per app), so the row takes you there. On the web it flips here.
 */
function switchLanguage() {
  if (Platform.OS !== 'web') {
    Linking.openSettings().catch(() => {});
    return;
  }
  try {
    // Web has no system per-app language: each tap moves to the next one.
    localStorage.setItem(LANG_KEY, VARIANTS[(VARIANTS.indexOf(variant) + 1) % VARIANTS.length]);
    location.reload();
  } catch {
    // Storage blocked: nothing to remember the choice in.
  }
}

export default function SettingsScreen() {
  const store = useStore();
  const { settings, setSettings, hands, sessions, players } = store;
  const pro = usePro();
  const [busy, setBusy] = useState(false);
  const stamp = new Date().toISOString().slice(0, 10);

  const exportAll = async () => {
    tap();
    try {
      await saveTextFile(`sweatbook-${stamp}.json`, JSON.stringify(buildBackup(store)), 'application/json');
    } catch {
      note(t('Não deu para exportar'), t('Tenta outra vez.'));
    }
  };
  const importFile = async () => {
    tap();
    setBusy(true);
    try {
      const text = await pickTextFile();
      if (text === null) return;
      const n = store.importData(parseBackup(text));
      note(t('Cópia importada'), importSummary(n));
    } catch {
      note(t('Ficheiro inválido'), t('Escolhe um ficheiro .json exportado pelo Sweatbook.'));
    } finally {
      setBusy(false);
    }
  };

  const eraseAll = () => {
    tap();
    confirmAction(
      t('Apagar todos os teus dados?'),
      t('Mãos, sessões, notas de jogadores, bankroll, staking e definições saem deste telemóvel. A cópia na nuvem, as mãos partilhadas, as páginas para backers e o teu perfil público também são apagados (sem rede, assim que houver sinal). Não dá para desfazer. A subscrição Pro continua: cancela-a na App Store ou no Google Play.'),
      t('Apagar tudo'),
      async () => {
        setBusy(true);
        try {
          await store.eraseAll();
          lockChanged();
          router.replace('/');
          note(t('Dados apagados'), t('A app está como nova.'));
        } finally {
          setBusy(false);
        }
      },
    );
  };

  const counts = [hands.length === 1 ? t('1 mão') : t('{n} mãos', { n: hands.length }), sessions.length === 1 ? t('1 sessão') : t('{n} sessões', { n: sessions.length }), players.length === 1 ? t('1 jogador') : t('{n} jogadores', { n: players.length })].join(' · ');
  return (
    <>
      <Stack.Screen options={{ title: t('Definições') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!pro.isPro ? (
          <Card tone="accent" onPress={() => pro.paywall('generic')} style={{ gap: 4 }}>
            <Row gap={10}>
              <Ionicons name="flash" size={18} color={C.accent} />
              <T v="h2" style={{ flex: 1 }}>
                Sweatbook Pro
              </T>
              <Ionicons name="chevron-forward" size={17} color={C.accent} />
            </Row>
            <T v="small">{pro.trialDays ? t('Mãos sem limite, bankroll completo e stories com voz. {days} dias grátis.', { days: pro.trialDays }) : t('Mãos sem limite, bankroll completo e stories com voz.')}</T>
          </Card>
        ) : null}

        <Section title={t('Perfil')}>
          <Card style={{ gap: S.lg }}>
            <Field label={t('O teu nome nos comentários')} value={settings.nickname} onChangeText={(nickname) => setSettings({ nickname: nickname.slice(0, 40) })} placeholder={t('Ex.: Rui')} />
            <View style={{ gap: S.sm }}>
              <T v="label">{t('Moeda')}</T>
              <ChipRow>
                {CURRENCIES.map((c) => (
                  <Chip key={c} label={c} active={settings.currency === c} onPress={() => setSettings({ currency: c })} style={{ minWidth: 48 }} />
                ))}
              </ChipRow>
            </View>
            <View style={{ gap: S.sm }}>
              <T v="label">{t('Jogadores na mesa')}</T>
              <Segmented options={[6, 7, 8, 9, 10].map((n) => ({ key: n, label: String(n) }))} value={settings.defaultTableSize} onChange={(defaultTableSize) => setSettings({ defaultTableSize })} />
            </View>
          </Card>
          <ListGroup>
            <ToggleItem icon="calculator-outline" title={t('Valores em big blinds')} subtitle={t('Nas mãos, em vez de fichas')} value={settings.inBB} onChange={(inBB) => setSettings({ inBB })} />
            <ToggleItem icon="phone-portrait-outline" title={t('Vibração')} subtitle={t('Só quando conta: guardar uma mão, fechar uma sessão')} value={settings.haptics !== false} onChange={(haptics) => setSettings({ haptics })} />
            <ListItem icon="language-outline" title={t('Idioma')} subtitle={VARIANT_NAME[variant]} value={Platform.OS === 'web' ? undefined : t('No telemóvel')} onPress={switchLanguage} />
          </ListGroup>
        </Section>

        <Section title={t('Mãos que partilhas')} hint={t('Vale para links novos. Uma mão já partilhada fica como estava.')}>
          <ListGroup>
            <ToggleItem icon="person-outline" title={t('Nomes dos adversários')} subtitle={settings.shareNames ? t('Os nomes que lhes deste aparecem no link') : t('Aparecem como BTN, SB, BB…')} value={settings.shareNames} onChange={(shareNames) => setSettings({ shareNames })} />
            <ToggleItem icon="document-text-outline" title={t('As minhas notas da mão')} value={settings.shareNotes} onChange={(shareNotes) => setSettings({ shareNotes })} />
          </ListGroup>
        </Section>

        <Section title={t('Privacidade')}>
          <ListGroup>
            <ToggleItem icon="eye-off-outline" title={t('Esconder valores')} subtitle={t('Em toda a app, ••• em vez de dinheiro. Para veres a app à mesa.')} value={!!settings.hideAmounts} onChange={(hideAmounts) => setSettings({ hideAmounts })} />
            <ToggleItem icon="apps-outline" title={t('Mostrar o resultado no widget')} subtitle={t('Desligado, o widget mostra ••• em vez do resultado da semana. O ecrã principal vê-se à mesa.')} value={!!settings.widgetResult} onChange={(widgetResult) => setSettings({ widgetResult })} />
            {lockSupported ? <AppLockSetting /> : null}
          </ListGroup>
        </Section>

        <Section title={t('Cópia de segurança')} hint={t('Tudo fica guardado neste telemóvel. Faz uma cópia para não perderes nada se o trocares.')}>
          <CloudBackup />
          <ListGroup>
            <ListItem icon="download-outline" title={t('Exportar tudo')} subtitle={counts} onPress={exportAll} />
            <ListItem icon="push-outline" title={busy ? t('A importar…') : t('Importar ficheiro')} subtitle={t('Junta ao que já tens, não apaga nada')} onPress={importFile} />
            <ListItem icon="swap-horizontal-outline" iconColor={C.info} title={t('Importar de outra app')} subtitle={t('Poker Bankroll Tracker, Pokerbase, Poker Analytics ou CSV')} onPress={() => router.push('/import')} />
            <ListItem icon="document-text-outline" title={t('Relatório PDF e CSV')} subtitle={t('Por ano ou datas: sessões, mãos, resultados')} right={pro.isPro ? undefined : <Pill label="Pro" color={C.accent} />} onPress={() => router.push('/export')} />
          </ListGroup>
        </Section>

        <Section title={t('Ferramentas')}>
          <ListGroup>
            <ListItem icon="school-outline" iconColor={C.accent} title={t('Links para o coach')} subtitle={t('Mãos que enviaste a rever e os comentários')} onPress={() => router.push('/coach')} />
            <ListItem icon="albums-outline" iconColor={C.accent} title={t('Links de várias mãos')} subtitle={t('Torneios e pastas que partilhaste num só link')} onPress={() => router.push('/pack')} />
            <ListItem icon="globe-outline" iconColor={C.accent} title={t('Perfil público')} subtitle={t('As mãos e sessões que escolheres, num link')} onPress={() => router.push('/profile')} />
            <ListItem icon="gift-outline" iconColor={C.accent} title={t('Convidar amigos')} subtitle={t('Ganham os dois 7 dias de Pro')} onPress={() => router.push('/invite')} />
            <ListItem icon="calculator-outline" iconColor={C.info} title={t('Calculadora de odds')} subtitle={t('A tua mão contra cartas ou um range')} onPress={() => router.push('/odds')} />
            <ListItem icon="pie-chart-outline" iconColor={C.info} title={t('Calculadora de deal (ICM)')} subtitle={t('Para dividir o prémio na mesa final')} onPress={() => router.push('/chop')} />
          </ListGroup>
          <InviteCodeField />
        </Section>

        <Section title={t('Subscrição')}>
          <ListGroup>
            <ListItem
              icon="card-outline"
              iconColor={pro.isPro ? C.accent : undefined}
              title={t('Gerir subscrição')}
              subtitle={pro.isPro ? 'Sweatbook Pro' : t('Mudar de plano ou cancelar na loja')}
              onPress={() => (pro.isPro ? router.push('/cancel') : manageSubscription())}
            />
            <ListItem
              icon="refresh-outline"
              title={t('Restaurar compras')}
              subtitle={t('Já pagaste noutro telemóvel')}
              onPress={async () => {
                const ok = await pro.restore();
                note(ok ? t('Pro restaurado') : t('Não encontrámos compras nesta conta da loja.'));
              }}
            />
          </ListGroup>
        </Section>

        <Section title={t('Sugestões e suporte')} hint={t('Lemos todas as mensagens.')}>
          <ListGroup>
            <ListItem icon="bulb-outline" title={t('Enviar uma sugestão')} subtitle={t('O que falta ou o que mudavas')} onPress={() => mailSupport('suggestion')} />
            <ListItem icon="bug-outline" title={t('Reportar um problema')} subtitle={t('Vai com a versão da app e do telemóvel')} onPress={() => mailSupport('bug')} />
            <ListItem icon="book-outline" title={t('Ajuda')} subtitle={t('Respostas às dúvidas mais comuns')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/${HELP_PATH[variant]}`)} />
            <ListItem icon="help-buoy-outline" title={t('Falar com o suporte')} subtitle={t('Uma dúvida ou um pedido')} onPress={() => mailSupport('support')} />
            <ListItem icon="sparkles-outline" title={t('Novidades')} subtitle={t('O que mudou em cada versão')} onPress={() => router.push('/novidades')} />
            <ListItem icon="shield-checkmark-outline" title={t('Privacidade')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/privacy`)} />
            <ListItem icon="document-outline" title={t('Termos')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/terms`)} />
          </ListGroup>
        </Section>

        <Section title={t('Os teus dados')} hint={t('Antes de apagar, podes guardar tudo com «Exportar tudo».')}>
          <ListGroup>
            <ListItem icon="trash-outline" destructive title={busy ? t('A apagar…') : t('Apagar todos os meus dados')} subtitle={t('Neste telemóvel, na nuvem e nos links públicos')} onPress={busy ? undefined : eraseAll} />
          </ListGroup>
        </Section>
        <View style={{ alignItems: 'center', gap: 4, paddingTop: S.sm }}>
          <Wordmark size={18} />
          <T v="tiny">{BRAND.tagline}</T>
          {Constants.expoConfig?.version ? <T v="tiny" color={C.muted}>{t('Versão {v}', { v: Constants.expoConfig.version })}</T> : null}
        </View>
      </ScrollView>
    </>
  );
}

const CLAIM_COPY: Partial<Record<ClaimResult, string>> = {
  queued: 'Sem rede agora: o convite fica guardado e é ativado sozinho quando houver sinal.',
  ok: 'Convite ativado. Guarda uma mão e ganham os dois 7 dias de Pro.',
  already: 'Já tens um convite ativo.',
  self: 'Esse é o teu próprio código.',
  too_late: 'Os convites só contam nos 7 dias depois de instalar.',
  unknown_code: 'Não encontrámos esse código.',
  disabled: 'Os convites ainda não estão disponíveis.',
};

/** Shown only in the first 7 days, until a code is accepted. */
function InviteCodeField() {
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    canEnterCode().then(setShow);
  }, []);
  if (!show) return null;
  return (
    <Card style={{ gap: S.sm }}>
      <T v="label">{t('Tenho um código de convite')}</T>
      <Row gap={S.sm}>
        <Field value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="a1b2c3d4e5" style={{ flex: 1 }} inputStyle={{ fontFamily: F.mono }} />
        <Button
          size="md"
          title={busy ? '…' : t('Usar')}
          disabled={busy || !code.trim()}
          onPress={async () => {
            setBusy(true);
            const r = await claimInvite(code, 'manual');
            setBusy(false);
            note(t(CLAIM_COPY[r] ?? 'Sem ligação. Tenta outra vez quando tiveres rede.'));
            if (r === 'ok' || r === 'already') setShow(false);
          }}
        />
      </Row>
    </Card>
  );
}
