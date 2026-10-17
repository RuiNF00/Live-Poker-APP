// Settings: your name and defaults, backups (file, CSV, cloud code), purchases
// and the legal pages the stores require.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { CloudBackup } from '@/components/CloudBackup';
import { inputStyle } from '@/components/entry/ContextSheet';
import { Button, Chip, Panel, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { pickTextFile, saveTextFile } from '@/lib/files';
import { canEnterCode, claimInvite, type ClaimResult } from '@/lib/referrals';
import { buildBackup, parseBackup, sessionsCsv } from '@/store/backup';
import { useStore } from '@/store/store';
import { BRAND, C } from '@/theme';

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
      note(t('Cópia importada'), t('Novos: {h} mãos · {s} sessões · {p} jogadores. O que já tinhas ficou.', { h: n.hands, s: n.sessions, p: n.players }));
    } catch {
      note(t('Ficheiro inválido'), t('Escolhe um ficheiro .json exportado pelo Sweatbook.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Definições') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Panel style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <T v="label">{t('O teu nome nos comentários')}</T>
            <TextInput value={settings.nickname} onChangeText={(nickname) => setSettings({ nickname: nickname.slice(0, 40) })} placeholder={t('Ex.: Rui')} placeholderTextColor={C.muted} style={inputStyle} />
          </View>
          <View style={{ gap: 6 }}>
            <T v="label">{t('Moeda')}</T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} active={settings.currency === c} onPress={() => setSettings({ currency: c })} />
              ))}
            </Row>
          </View>
          <View style={{ gap: 6 }}>
            <T v="label">{t('Jogadores na mesa por defeito')}</T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {[6, 7, 8, 9, 10].map((n) => (
                <Chip key={n} label={String(n)} active={settings.defaultTableSize === n} onPress={() => setSettings({ defaultTableSize: n })} />
              ))}
            </Row>
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="body">{t('Mostrar valores em big blinds')}</T>
            <Switch value={settings.inBB} onValueChange={(inBB) => setSettings({ inBB })} trackColor={{ true: C.accent, false: C.surface3 }} />
          </Row>
        </Panel>

        <T v="h2">{t('Cópia de segurança')}</T>
        <T v="small" style={{ marginTop: -8 }}>
          {t('Tudo fica só neste telemóvel. Faz uma cópia para não perderes as mãos se trocares de telemóvel.')}
        </T>
        <CloudBackup />
        <Panel style={{ gap: 0, padding: 0 }}>
          <Item icon="download-outline" label={t('Exportar tudo (ficheiro)')} hint={t('{h} mãos · {s} sessões · {p} jogadores', { h: hands.length, s: sessions.length, p: players.length })} onPress={exportAll} />
          <Item icon="cloud-upload-outline" label={busy ? t('A importar…') : t('Importar ficheiro')} hint={t('Junta ao que já tens, não apaga nada')} onPress={importFile} />
          <Item icon="grid-outline" label={t('Sessões em CSV') + (pro.isPro ? '' : ' · Pro')} hint={t('Para Excel, Google Sheets ou o contabilista')} onPress={exportCsv} last />
        </Panel>

        <T v="h2">{t('Ferramentas')}</T>
        <Panel style={{ gap: 0, padding: 0 }}>
          <Item icon="gift-outline" label={t('Convidar amigos')} hint={t('Ganham os dois 7 dias de Pro')} onPress={() => router.push('/invite')} />
          <Item icon="pie-chart-outline" label={t('Calculadora de deal (ICM)')} hint={t('Para dividir o prémio na mesa final')} onPress={() => router.push('/chop')} last />
        </Panel>
        <InviteCodeField />

        <T v="h2">{t('Conta')}</T>
        <Panel style={{ gap: 0, padding: 0 }}>
          {!pro.isPro ? <Item icon="flash-outline" label={t('Ver o Sweatbook Pro')} onPress={() => pro.paywall('generic')} /> : null}
          <Item
            icon="refresh-outline"
            label={t('Restaurar compras')}
            onPress={async () => {
              const ok = await pro.restore();
              note(ok ? t('Pro restaurado') : t('Não encontrámos compras nesta conta da loja.'));
            }}
          />
          <Item icon="help-circle-outline" label={t('Ajuda e contacto')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/support`)} />
          <Item icon="shield-checkmark-outline" label={t('Privacidade')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/privacy`)} />
          <Item icon="document-text-outline" label={t('Termos')} onPress={() => WebBrowser.openBrowserAsync(`${BRAND.webUrl}/terms`)} last />
        </Panel>
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
    <Panel style={{ gap: 8 }}>
      <T v="label">{t('Tenho um código de convite')}</T>
      <Row gap={8}>
        <TextInput value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="a1b2c3d4e5" placeholderTextColor={C.muted} style={[inputStyle, { flex: 1 }]} />
        <Button
          small
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
    </Panel>
  );
}

function Item({ icon, label, hint, onPress, last }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; hint?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.border, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={20} color={C.text} />
      <View style={{ flex: 1 }}>
        <T v="body">{label}</T>
        {hint ? <T v="tiny">{hint}</T> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </Pressable>
  );
}
