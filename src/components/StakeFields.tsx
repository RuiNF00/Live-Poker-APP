// Staking and expenses for a session: who bought a piece, how much, at what
// markup or in which package, and costs outside the buy-in. Hidden behind one
// button so the common case stays short.

import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { money } from '@/poker/format';
import { stakesOf, stakingSummary } from '@/store/session-math';
import { lastStakeTerms, stakeCost } from '@/store/staking';
import { useStore } from '@/store/store';
import type { Session, Stake } from '@/store/types';

import { C, S } from '@/theme';

import { Avatar } from './Avatar';
import { blankBacker, MARKUPS, markupLabel, packageTerms, SHARES } from './staking/sheets';
import { Button, Card, Chip, ChipRow, Field, IconButton, ListGroup, ListItem, NumField, Row, Section, T, ToggleItem } from './ui';

export function StakeFields({ s, onChange, expenses = true }: { s: Session; onChange: (p: Partial<Session>) => void; expenses?: boolean }) {
  const stakes = stakesOf(s);
  const has = stakes.length > 0 || !!s.expenses;
  const [open, setOpen] = useState(has);
  const [adding, setAdding] = useState(false);
  const { backers, packages } = useStore();
  const sold = stakes.reduce((a, x) => a + x.share, 0);

  const setStakes = (next: Stake[]) => onChange({ stakes: next, staking: stakingSummary(next) });

  if (!open)
    return (
      <Button kind="ghost" size="sm" icon="add" style={{ alignSelf: 'flex-start' }} title={expenses ? t('Staking ou despesas') : 'Staking'} onPress={() => setOpen(true)} />
    );
  return (
    <View style={{ gap: S.lg }}>
      <Section title={sold ? t('Ação vendida · {n}%', { n: Math.round(sold * 10) / 10 }) : t('Ação vendida')}>
        {stakes.length > 0 && (
          <ListGroup>
            {stakes.map((x, i) => {
              const b = backers.find((y) => y.id === x.backerId);
              const p = packages.find((y) => y.id === x.packageId);
              return (
                <ListItem
                  key={i}
                  left={<Avatar name={b?.name ?? '?'} size={32} />}
                  title={b?.name ?? t('Sem nome')}
                  subtitle={[`${x.share}%`, p ? p.name : markupLabel(x.markup), x.unpaid ? t('por pagar') : ''].filter(Boolean).join(' · ')}
                  value={money(stakeCost(s, x), s.currency)}
                  chevron={false}
                  right={<IconButton name="close" size={30} label={t('Tirar')} onPress={() => setStakes(stakes.filter((_, k) => k !== i))} />}
                />
              );
            })}
          </ListGroup>
        )}
        {adding ? (
          <AddStake
            s={s}
            maxShare={Math.max(0, 100 - sold)}
            taken={stakes.map((x) => x.backerId).filter(Boolean) as string[]}
            onCancel={() => setAdding(false)}
            onAdd={(x) => {
              setStakes([...stakes, x]);
              setAdding(false);
            }}
          />
        ) : sold < 100 ? (
          <Button kind="outline" size="md" lines={2} icon="person-add-outline" title={stakes.length ? t('Registar outro backer') : t('Registar ação vendida')} onPress={() => setAdding(true)} />
        ) : null}
      </Section>
      {expenses && (
        <Card>
          <Row gap={S.sm}>
            <NumField label={t('Despesas ({currency})', { currency: s.currency })} value={s.expenses ?? 0} onChange={(v) => onChange({ expenses: v || undefined })} />
          </Row>
        </Card>
      )}
    </View>
  );
}

/** Pick a backer (or add one), then a package or plain % and markup. */
function AddStake({ s, maxShare, taken, onAdd, onCancel }: { s: Session; maxShare: number; taken: string[]; onAdd: (x: Stake) => void; onCancel: () => void }) {
  const { backers, packages, sessions, saveBacker } = useStore();
  // Backers used most recently first.
  const order = useMemo(() => {
    const last = new Map<string, number>();
    for (const x of sessions) for (const st of x.stakes ?? []) if (st.backerId) last.set(st.backerId, Math.max(last.get(st.backerId) ?? 0, x.startedAt));
    return [...backers].sort((a, b) => (last.get(b.id) ?? b.createdAt) - (last.get(a.id) ?? a.createdAt));
  }, [backers, sessions]);
  const [who, setWho] = useState<string | null>(order.find((b) => !taken.includes(b.id))?.id ?? null);
  const [naming, setNaming] = useState(backers.length === 0);
  const [name, setName] = useState('');
  const open = packages.filter((p) => p.backerId === who && !p.closedAt);
  const [pkgId, setPkgId] = useState<string | null>(open[0]?.id ?? null);
  const pkg = open.find((p) => p.id === pkgId);
  // Outside a package, start from what this backer took last time: the deal is usually the same.
  const last = who ? lastStakeTerms(who, sessions) : null;
  const fit = (n: number) => Math.min(n, maxShare) || maxShare;
  const [share, setShare] = useState(fit(last?.share ?? 20));
  const [markup, setMarkup] = useState(last?.markup ?? 1.1);
  const [paid, setPaid] = useState(!last?.unpaid);

  const pick = (id: string | null) => {
    setWho(id);
    setNaming(false);
    setPkgId(packages.find((p) => p.backerId === id && !p.closedAt)?.id ?? null);
    const prev = id ? lastStakeTerms(id, sessions) : null;
    if (prev) {
      setShare(fit(prev.share));
      setMarkup(prev.markup);
      setPaid(!prev.unpaid);
    }
  };
  const finalShare = Math.min(pkg ? pkg.share : share, maxShare);

  return (
    <Card tone="raised" style={{ gap: S.lg }}>
      <Section title={t('A quem')}>
        <ChipRow>
          {order.filter((b) => !taken.includes(b.id)).map((b) => (
            <Chip key={b.id} label={b.name} active={who === b.id && !naming} onPress={() => pick(b.id)} />
          ))}
          <Chip label={t('Sem nome')} active={who === null && !naming} onPress={() => pick(null)} />
          <Chip label={t('Novo')} icon="add" active={naming} onPress={() => setNaming(true)} />
        </ChipRow>
        {naming ? (
          <Row gap={S.sm} style={{ alignItems: 'flex-end' }}>
            <Field style={{ flex: 1 }} value={name} onChangeText={setName} placeholder={t('Nome do backer')} autoFocus maxLength={40} returnKeyType="done" />
            <Button
              size="md"
              title={t('Criar')}
              disabled={!name.trim()}
              onPress={() => {
                const b = blankBacker(name.trim());
                saveBacker(b);
                setName('');
                pick(b.id);
              }}
            />
          </Row>
        ) : null}
      </Section>

      {open.length > 0 ? (
        <Section title={t('Acordo')}>
          <ChipRow>
            {open.map((p) => (
              <Chip key={p.id} icon="layers-outline" label={p.name} active={pkgId === p.id} onPress={() => setPkgId(p.id)} />
            ))}
            <Chip label={t('Só esta sessão')} active={!pkg} onPress={() => setPkgId(null)} />
          </ChipRow>
          {pkg ? <T v="small">{packageTerms(pkg)}</T> : null}
        </Section>
      ) : null}

      {!pkg ? (
        <>
          <Section title={t('Percentagem')}>
            <ChipRow>
              {SHARES.filter((p) => p <= maxShare).map((p) => (
                <Chip key={p} label={`${p}%`} active={share === p} onPress={() => setShare(p)} />
              ))}
            </ChipRow>
          </Section>
          <Section title="Markup">
            <ChipRow>
              {MARKUPS.map((m) => (
                <Chip key={m} label={markupLabel(m)} active={markup === m} onPress={() => setMarkup(m)} />
              ))}
            </ChipRow>
          </Section>
        </>
      ) : pkg.share > maxShare ? (
        <T v="small" color={C.warn}>
          {t('Só restam {n}% da tua ação por registar: fica com {n}%.', { n: maxShare })}
        </T>
      ) : null}

      <ListGroup>
        <ToggleItem title={t('Já pagou')} subtitle={paid ? undefined : t('Fica a dever {amount}', { amount: money(stakeCost(s, { share: finalShare, markup: pkg ? pkg.markup : markup }), s.currency) })} value={paid} onChange={setPaid} />
      </ListGroup>

      <Row gap={S.sm}>
        <Button kind="ghost" size="md" title={t('Cancelar')} style={{ flex: 1 }} onPress={onCancel} />
        <Button
          size="md"
          style={{ flex: 1 }}
          title={t('Adicionar {n}%', { n: finalShare })}
          disabled={naming || !finalShare}
          onPress={() =>
            onAdd({
              backerId: who ?? undefined,
              packageId: pkg?.id,
              share: finalShare,
              markup: pkg ? pkg.markup : markup,
              unpaid: paid ? undefined : true,
            })
          }
        />
      </Row>
      {backers.length > 0 ? (
        <Button kind="plain" size="sm" title={t('Gerir backers e pacotes')} onPress={() => router.push('/staking')} />
      ) : null}
    </Card>
  );
}
