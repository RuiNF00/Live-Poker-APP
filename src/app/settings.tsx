// Settings: your name and defaults, backups (file, CSV, cloud code), purchases
// and the legal pages the stores require.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { CloudBackup } from '@/components/CloudBackup';
import { Button, Card, Field, ListGroup, ListItem, Pill, Row, Section, Segmented, T, tap, ToggleItem, Wordmark } from '@/components/ui';
import { t } from '@/i18n';
import { pickTextFile, saveTextFile } from '@/lib/files';
import { canEnterCode, claimInvite, type ClaimResult } from '@/lib/referrals';
import { buildBackup, importSummary, parseBackup, sessionsCsv } from '@/store/backup';
import { useStore } from '@/store/store';
import { BRAND, C, F, S } from '@/theme';

const CURRENCIES = ['€', '$', '£', 'R$', 'CHF'];

function note(title: string, body?: string) {
  if (Platform.OS === 'web') window.alert(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
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
      await saveTextFile(`sweatbook-${stamp}.json`, JSON.stringify(buildBackup({ hands, sessions, players, settings })), 'application/json');
    } catch {
      note(t('Não deu para exportar'), t('Tenta outra vez.'));
    }
  };
  const exportCsv = async () => {
    tap();
    if (!pro.isPro) return pro.paywall('stats');
    try {
      await saveTextFile(`sweatbook-sessoes-${stamp}.csv`, sessionsCsv(sessions), 'text/csv');
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
              <Segmented options={CURRENCIES.map((c) => ({ key: c, label: c }))} value={settings.currency} onChange={(currency) => setSettings({ currency })} />
            </View>
            <View style={{ gap: S.sm }}>
              <T v="label">{t('Jogadores na mesa')}</T>
              <Segmented options={[6, 7, 8, 9, 10].map((n) => ({ key: n, label: String(n) }))} value={settings.defaultTableSize} onChange={(defaultTableSize) => setSettings({ defaultTableSize })} />
            </View>
          </Card>
          <ListGroup>
            <ToggleItem icon="calculator-outline" title={t('Valores em big blinds')} subtitle={t('Nas mãos, em vez de fichas')} value={settings.inBB} onChange={(inBB) => setSettings({ inBB })} />
          </ListGroup>
        </Section>

        <Section title={t('Mãos que partilhas')} hint={t('Vale para links novos. Uma mão já partilhada fica como estava.')}>
          <ListGroup>
            <ToggleItem icon="person-outline" title={t('Nomes dos adversários')} subtitle={t('Desligado, aparecem como posições. As tuas alcunhas nunca saem do telemóvel.')} value={settings.shareNames} onChange={(shareNames) => setSettings({ shareNames })} />
            <ToggleItem icon="document-text-outline" title={t('As minhas notas da mão')} value={settings.shareNotes} onChange={(shareNotes) => setSettings({ shareNotes })} />
          </ListGroup>
        </Section>

        <Section title={t('Cópia de segurança')} hint={t('Tudo fica guardado neste telemóvel. Faz uma cópia para não perderes nada se o trocares.')}>
          <CloudBackup />
          <ListGroup>
            <ListItem icon="download-outline" title={t('Exportar tudo')} subtitle={counts} onPress={exportAll} />
            <ListItem icon="push-outline" title={busy ? t('A importar…') : t('Importar ficheiro')} subtitle={t('Junta ao que já tens, não apaga nada')} onPress={importFile} />
            <ListItem icon="grid-outline" title={t('Sessões em CSV')} subtitle={t('Para Excel ou Google Sheets')} right={pro.isPro ? undefined : <Pill label="Pro" color={C.accent} />} onPress={exportCsv} />
          </ListGroup>
        </Section>

        <Section title={t('Ferramentas')}>
          <ListGroup>
            <ListItem icon="gift-outline" iconColor={C.accent} title={t('Convidar amigos')} subtitle={t('Ganham os dois 7 dias de Pro')} onPress={() => router.push('/invite')} />
            <ListItem icon="pie-chart-outline" iconColor={C.info} title={t('Calculadora de deal (ICM)')} subtitle={t('Para dividir o prémio na mesa final')} onPress={() => router.push('/chop')} />
          </ListGroup>
          <InviteCodeField />
        </Section>

        <Section title={t('Conta')}>
          <ListGroup>
            <ListItem
              icon="refresh-outline"
              title={t('Restaurar compras')}
              onPress={async () => {
                const ok = await pro.restore();
                note(ok ? t('Pro restaurado') : t('Não encontrámos compras nesta conta da loja.'));
              }}
            />
            <ListItem icon="help-buoy-outline" title={t('Ajuda e contacto')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/support`)} />
            <ListItem icon="shield-checkmark-outline" title={t('Privacidade')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/privacy`)} />
            <ListItem icon="document-outline" title={t('Termos')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/terms`)} />
          </ListGroup>
        </Section>
        <View style={{ alignItems: 'center', gap: 4, paddingTop: S.sm }}>
          <Wordmark size={18} />
          <T v="tiny">{BRAND.tagline}</T>
        </View>
      </ScrollView>
    </>
  );
}

const CLAIM_COPY: Partial<Record<ClaimResult, string>> = {
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
