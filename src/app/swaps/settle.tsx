// Settling up with one player across several swaps: one net amount changes hands, and each
// swap is closed to 0,00 with entries that are mine to record (my payment where I owe, that I
// received where they owe). They see the same entries in each swap.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { withPro } from '@/components/ProGate';
import { Button, Card, Empty, ListGroup, Screen, Section, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { notice } from '@/lib/notice';
import { money } from '@/poker/format';
import { HALF_CENT } from '@/store/swap-groups';
import { settleGroups, settleNet, settleSteps, swapLedger } from '@/store/swaps';
import { addEntry, syncAllSwaps, useSwaps } from '@/store/swaps-store';
import { C, S } from '@/theme';

function SettleScreen() {
  const { name, cur } = useLocalSearchParams<{ name?: string; cur?: string }>();
  const { swaps } = useSwaps();
  const key = String(name ?? '').trim().toLocaleLowerCase();
  const group = settleGroups(swaps).find((g) => g.name.trim().toLocaleLowerCase() === key && g.currency === cur);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // The latest from the server first: both phones then settle the same balances, so a «Paguei» on
  // one and a «Recebi» on the other match and count once (see paidBySide).
  // The button waits for it, at most 3 s (no signal: settle with what the phone has).
  const [syncing, setSyncing] = useState(true);
  useEffect(() => {
    const done = () => setSyncing(false);
    const id = setTimeout(done, 3000);
    syncAllSwaps().catch(() => {}).finally(done);
    return () => clearTimeout(id);
  }, []);

  if (!group)
    return (
      <Screen>
        <Stack.Screen options={{ title: t('Acertar contas'), headerBackTitle: t('Voltar') }} />
        <Empty icon="checkmark-done-outline" title={t('Tudo acertado')} body={t('Já não há swaps por acertar com este jogador.')} />
      </Screen>
    );

  const c = group.currency;
  const chosen = group.swaps.filter((s) => !off.has(s.id));
  const net = settleNet(chosen);
  const steps = settleSteps(chosen);
  const even = Math.abs(net) < HALF_CENT;

  async function settle() {
    setBusy(true);
    let queued = false;
    for (const st of steps) {
      const res = await addEntry(st.id, { kind: st.kind, amount: st.amount, event: '', finish: null });
      if (res === 'queued') queued = true;
    }
    tap('success');
    if (queued) notice(t('Sem rede'), t('O que registares fica guardado e é enviado quando houver sinal.'));
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: t('Acertar contas'), headerBackTitle: t('Voltar') }} />
      <Screen contentStyle={{ paddingTop: S.lg }}>
        <Card tone="raised" style={{ gap: S.xs, paddingVertical: S.xl }}>
          <T v="label">{even ? t('Com {name}', { name: group.name }) : net > 0 ? t('{name} paga-te', { name: group.name }) : t('Pagas a {name}', { name: group.name })}</T>
          <T v="monoXL" color={even ? C.textDim : net > 0 ? C.good : C.warn} numberOfLines={1} adjustsFontSizeToFit>
            {even ? t('Uma coisa paga a outra') : money(Math.abs(net), c)}
          </T>
          <T v="small">{chosen.length === 1 ? t('1 swap') : t('{n} swaps', { n: chosen.length })}</T>
        </Card>

        <Section title={t('Swaps com {name}', { name: group.name })} hint={t('Desliga um swap para o deixar de fora.')}>
          <ListGroup>
            {group.swaps.map((s) => {
              const b = swapLedger(s).balance;
              return (
                <ToggleItem
                  key={s.id}
                  title={s.terms.title}
                  subtitle={b > 0 ? t('deve-te {amount}', { amount: money(b, c) }) : t('deves {amount}', { amount: money(-b, c) })}
                  value={!off.has(s.id)}
                  onChange={(v) =>
                    setOff((o) => {
                      const n = new Set(o);
                      if (v) n.delete(s.id);
                      else n.add(s.id);
                      return n;
                    })
                  }
                />
              );
            })}
          </ListGroup>
        </Section>

        <Card tone="inset" style={{ paddingVertical: S.md }}>
          <T v="small">{t('Cada swap fica a 0,00: onde deves fica o teu pagamento, onde te devem fica que recebeste. {name} vê o mesmo em cada swap.', { name: group.name })}</T>
        </Card>

        <View style={{ gap: S.sm }}>
          <Button
            lines={2}
            title={even ? t('Acertar sem pagamentos') : net > 0 ? t('Recebi {amount} de {name}', { amount: money(net, c), name: group.name }) : t('Paguei {amount} a {name}', { amount: money(-net, c), name: group.name })}
            icon="checkmark-done-outline"
            disabled={busy || syncing || !steps.length}
            onPress={settle}
          />
          <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
            {t('Registo e contas apenas. Nenhum dinheiro passa pela Sweatbook: os pagamentos fazem-se entre vocês.')}
          </T>
        </View>
      </Screen>
    </>
  );
}

export default withPro('swaps', t('Acertar contas'), SettleScreen);
