import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FIRST_ACTION_LABEL, FIRST_CURRENCIES, firstAction, fourWeeks, GOALS, ONBOARDING_KEY, planFor, PLAYS, VOLUMES, type Answers, type FirstAction, type Goal } from '@/billing/onboarding';
import { usePro } from '@/billing/pro';
import { InvitePaste } from '@/components/InvitePaste';
import { Replayer } from '@/components/Replayer';
import { Button, Chip, ChipRow, Row, T, tap, type IconName } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { useReduceMotion } from '@/lib/motion';
import { sampleHand } from '@/poker/sample';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

// The currency is no longer a step: it comes from the phone's region and can be changed on the plan.
const STEPS = ['hero', 'goals', 'plays', 'volume', 'plan'] as const;

/**
 * First run: a sample hand replaying (the "aha" before anything else), four
 * one-tap questions and a plan built from them. No paywall: the trial waits
 * for the first live session.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { settings, setSettings, firstBankrollIn } = useStore();
  const { isPro } = usePro();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ goals: [], plays: null, volume: null });
  const sample = useMemo(() => sampleHand('sample'), []);
  const plan = planFor(a);
  const play = PLAYS.find((p) => p.key === a.plays);
  const volume = VOLUMES.find((v) => v.key === a.volume);
  const at = STEPS[step];
  const [skipped, setSkipped] = useState(false);
  // A beat between the last answer and the plan (Opal's «calculating»): the answers visibly turn into something.
  const [preparing, setPreparing] = useState(false);
  const [pickingCur, setPickingCur] = useState(false);
  const reduce = useReduceMotion();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const viewH = useRef(0);
  // Scroll only as far as needed for the whole question (the table above keeps the hand's context); the replayer sits at the top of the content.
  const showQuiz = (top: number, height: number) => {
    const y = Math.min(S.gutter + top - S.sm, S.gutter + top + height + S.md - viewH.current);
    if (y > 0) scroll.current?.scrollTo({ y, animated: !reduce });
  };
  useEffect(() => {
    if (!preparing) return;
    const id = setTimeout(() => setPreparing(false), reduce ? 300 : 900);
    return () => clearTimeout(id);
  }, [preparing, reduce]);
  // One event per screen reached, so the funnel shows where people stop.
  useEffect(() => track('onboarding_step', { step: at, index: step }), [at, step]);
  // A tap moves to the next step at once: VoiceOver and TalkBack go to its question, not to a button that is gone.
  const head = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (step === 0) return;
    const id = setTimeout(() => {
      // No native node on the web (findNodeHandle throws there).
      if (Platform.OS === 'web') return;
      const node = head.current && findNodeHandle(head.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 150);
    return () => clearTimeout(id);
  }, [step]);
  // Closed any other way (Android's back button): the answers so far are saved too, so the
  // install counts as used (app-lock-core lockIsThisInstalls) and nothing typed is lost.
  const answers = useRef(a);
  useEffect(() => {
    answers.current = a;
  }, [a]);
  useEffect(() => () => void AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(answers.current)).catch(() => {}), []);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const open = (go: FirstAction) => {
    if (go === 'past') router.navigate({ pathname: '/bankroll', params: { add: 'session' } });
    else if (go === 'festival') router.push('/festival');
    else router.push('/hand/new');
  };
  // The plan ends on its first action, not on an empty list; «Ver a app primeiro» is the plain way out.
  // A second tap would stack the destination twice: the first one wins.
  const done = useRef(false);
  const finish = (go?: FirstAction) => {
    if (done.current) return;
    done.current = true;
    pickCurrency(settings.currency);
    AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(a)).catch(() => {});
    track('onboarding_step', { step: 'done', index: STEPS.length, skipped, goals: a.goals.join(','), plays: a.plays ?? '', volume: a.volume ?? '', next: go ?? 'app' });
    // No paywall here: the trial is offered once, at the first live session or
    // the first saved hand (TrialFollowUp, useWelcomeOffer), so its days are spent playing.
    router.back();
    if (go) setTimeout(() => open(go), 350);
  };
  // At the table, or skipping: close with no paywall. The questions don't block anyone.
  const close = (path: 'sessao' | 'mesa' | 'saltar') => {
    if (done.current) return;
    done.current = true;
    AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(a)).catch(() => {});
    setSkipped(true);
    track('onboarding_step', { step: path === 'sessao' ? 'session' : path === 'mesa' ? 'table' : 'skip', index: step, path });
    router.back();
    if (path === 'sessao') setTimeout(() => router.navigate('/session'), 350);
    if (path === 'mesa') setTimeout(() => router.push('/hand/new'), 350);
  };
  // Coming from another app: the history first (the import is free), the questions can wait.
  const switchApp = () => {
    AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(a)).catch(() => {});
    track('onboarding_step', { step: 'switch', index: step });
    router.back();
    setTimeout(() => router.push('/import'), 350);
  };
  const pickCurrency = (c: string) => {
    setSettings({ currency: c });
    // The bankroll made on first launch is still empty: it becomes one in this currency.
    firstBankrollIn(c);
  };
  const toggle = (g: Goal) => setA((x) => ({ ...x, goals: x.goals.includes(g) ? x.goals.filter((y) => y !== g) : [...x.goals, g] }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.sm, paddingBottom: insets.bottom + S.sm }}>
      {step > 0 ? (
        <Row style={{ paddingHorizontal: S.gutter, minHeight: 44 }} gap={S.md}>
          <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Voltar')}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </Pressable>
          <View accessible accessibilityLabel={t('Passo {n} de {total}', { n: step, total: STEPS.length - 1 })} style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {STEPS.slice(1).map((s, i) => (
              <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? C.accent : C.surface3 }} />
            ))}
          </View>
          {at !== 'plan' ? (
            <Pressable
              onPress={() => close('saltar')}
              hitSlop={10}
              style={{ minHeight: 44, justifyContent: 'center' }}
              accessibilityRole="button">
              <T v="small" color={C.textDim}>
                {t('Saltar')}
              </T>
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </Row>
      ) : null}

      <ScrollView ref={scroll} onLayout={(e) => (viewH.current = e.nativeEvent.layout.height)} contentContainerStyle={{ flexGrow: 1, padding: S.gutter, gap: S.xl }}>
        {at === 'hero' ? (
          <>
            {/* Same side margin as the hand screen: the controls keep their rounded ends. */}
            <View style={{ marginHorizontal: S.md - S.gutter }}>
              {/* Doing, not watching (Brilliant): the hand plays up to hero's decision and asks. */}
              {/* On an iPhone SE, or with large text, the question lands under the buttons: scroll it into view. */}
              <Replayer hand={sample} autoPlay quiz playToQuiz onQuiz={showQuiz} onVote={(c) => track('onboarding_step', { step: 'hero_quiz', index: 0, choice: c })} />
            </View>
            <View style={{ gap: S.sm }}>
              <T v="title">{t('A tua mão, revista em 30 segundos')}</T>
              <T v="callout">{t('Decide o que farias e vê o resto da mão. É assim que revês as tuas.')}</T>
            </View>
            {/* Invited on an iPhone: the code survives the App Store through the clipboard, then straight to the first hand. */}
            <InvitePaste onClaimed={() => close('mesa')} />
          </>
        ) : null}

        {at === 'goals' ? (
          <Question head={head} title={t('O que queres da Sweatbook?')} hint={t('Escolhe uma ou mais.')}>
            {GOALS.map((g) => (
              <Option key={g.key} icon={g.icon as IconName} label={t(g.label)} sub={a.goals.includes(g.key) ? t(g.sub) : undefined} active={a.goals.includes(g.key)} multi onPress={() => toggle(g.key)} />
            ))}
          </Question>
        ) : null}

        {at === 'plays' ? (
          <Question head={head} title={t('O que jogas mais?')}>
            {(['Cash', 'Torneios'] as const).map((g) => (
              <View key={g} style={{ gap: S.sm }}>
                <T v="label" style={{ paddingTop: g === 'Cash' ? 0 : S.sm }}>
                  {t(g)}
                </T>
                {PLAYS.filter((p) => p.group === g).map((p) => (
                  <Option
                    key={p.key}
                    compact
                    label={g === 'Torneios' ? t('Buy-in {stakes}', { stakes: p.stakes }) : p.stakes}
                    active={a.plays === p.key}
                    onPress={() => {
                      setA((x) => ({ ...x, plays: p.key }));
                      next();
                    }}
                  />
                ))}
              </View>
            ))}
          </Question>
        ) : null}

        {at === 'volume' ? (
          <Question head={head} title={t('Quantas sessões jogas?')}>
            {VOLUMES.map((v) => (
              <Option
                key={v.key}
                label={t(v.label)}
                active={a.volume === v.key}
                onPress={() => {
                  setA((x) => ({ ...x, volume: v.key }));
                  setPreparing(true);
                  next();
                }}
              />
            ))}
          </Question>
        ) : null}

        {at === 'plan' && preparing ? (
          <View accessible accessibilityLiveRegion="polite" accessibilityLabel={t('A preparar o teu plano')} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md }}>
            <ActivityIndicator color={C.accent} />
            <T v="callout">{t('A preparar o teu plano')}</T>
          </View>
        ) : null}

        {at === 'plan' && !preparing ? (
          <View style={{ gap: S.xl }}>
            <View ref={head} accessible accessibilityRole="header" style={{ gap: S.sm }}>
              <T v="label" color={C.accent}>
                {t('O teu plano está pronto')}
              </T>
              <T v="title">{t(plan.title)}</T>
            </View>
            {/* The plan in three lines, one per answer (Runna). The currency came from the phone's region: changed here, not in a step of its own. */}
            <View style={{ gap: S.md }}>
              {play ? <Line icon="layers-outline" label={t('Jogo')} value={t(play.label)} /> : null}
              {volume ? <Line icon="calendar-outline" label={t('Ritmo')} value={t(volume.label)} /> : null}
              <Line
                icon="cash-outline"
                label={t('Moeda')}
                value={FIRST_CURRENCIES.find((c) => c.code === settings.currency)?.sym ?? settings.currency}
                action={t('Mudar')}
                open={pickingCur}
                onPress={() => setPickingCur((x) => !x)}
              />
              {pickingCur ? (
                <ChipRow>
                  {FIRST_CURRENCIES.map((c) => (
                    <Chip
                      key={c.code}
                      label={c.sym}
                      active={settings.currency === c.code}
                      onPress={() => {
                        pickCurrency(c.code);
                        setPickingCur(false);
                      }}
                    />
                  ))}
                </ChipRow>
              ) : null}
            </View>
            {fourWeeks(a.volume) ? <Forecast n={fourWeeks(a.volume)!} /> : null}
            <T v="label">{t('Porquê este plano')}</T>
            <View style={{ gap: S.md }}>
              {plan.points.map((p) => (
                <Row key={p} gap={S.md}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={16} color={C.accent} />
                  </View>
                  <T v="body" style={{ flex: 1 }}>
                    {t(p)}
                  </T>
                </Row>
              ))}
            </View>
            {isPro ? null : (
              <View style={{ gap: S.sm }}>
                <T v="label">{t('O Pro junta')}</T>
                {plan.pro.map((p) => (
                  <Row key={p} gap={S.md}>
                    <Ionicons name="flash" size={16} color={C.accent} />
                    <T v="callout" style={{ flex: 1 }}>
                      {t(p)}
                    </T>
                  </Row>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm }}>
        {at === 'hero' ? (
          <View style={{ gap: S.xs }}>
            {/* One main action, the fastest to something useful: a live session (its start is also where the trial is offered). */}
            {/* One main action (Ladder): three questions to a plan that ends on a first action. At the table, one tap to the session. */}
            <Button title={t('Criar o meu plano')} iconRight="chevron-forward" onPress={next} lines={2} />
            {/* Stacked, full width: side by side they broke into two lines at 320 px and at large text. */}
            <Button kind="ghost" size="sm" icon="play" title={t('Estou à mesa agora')} onPress={() => close('sessao')} lines={2} />
            <Button kind="ghost" size="sm" title={t('Vens de outra app?')} onPress={switchApp} lines={2} />
          </View>
        ) : null}
        {at === 'goals' ? <Button title={t('Continuar')} disabled={!a.goals.length} onPress={next} /> : null}
        {at === 'plan' ? (
          <View style={{ gap: S.xs }}>
            <Button title={t(FIRST_ACTION_LABEL[firstAction(a)])} iconRight="chevron-forward" onPress={() => finish(firstAction(a))} lines={2} />
            <Button kind="ghost" size="sm" title={t('Ver a app primeiro')} onPress={() => finish()} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Question({ head, title, hint, children }: { head: React.RefObject<React.ComponentRef<typeof View> | null>; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: S.lg }}>
      <View ref={head} accessible accessibilityRole="header" style={{ gap: S.xs }}>
        <T v="title">{title}</T>
        {hint ? <T v="callout">{hint}</T> : null}
      </View>
      <View style={{ gap: S.sm }}>{children}</View>
    </View>
  );
}

function Option({ label, sub, icon, badge, active, multi, compact, onPress }: { label: string; sub?: string; icon?: IconName; badge?: string; active: boolean; multi?: boolean; compact?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: active }}
      style={({ pressed }) => ({
        minHeight: compact ? 52 : 60,
        paddingHorizontal: S.lg,
        paddingVertical: S.md,
        borderRadius: R.lg,
        borderWidth: 1.5,
        borderColor: active ? C.accent : C.border,
        backgroundColor: active ? C.accentSoft : C.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.md,
        opacity: pressed ? 0.85 : 1,
      })}>
      {icon ? <Ionicons name={icon} size={20} color={active ? C.accent : C.textDim} /> : null}
      {badge ? (
        <T v="mono" color={active ? C.accent : C.text} style={{ width: 48 }}>
          {badge}
        </T>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3">{label}</T>
        {sub ? <T v="small">{sub}</T> : null}
      </View>
      {multi ? <Ionicons name={active ? 'checkbox' : 'square-outline'} size={22} color={active ? C.accent : C.muted} /> : null}
      {!multi && active ? <Ionicons name="checkmark-circle" size={22} color={C.accent} /> : null}
    </Pressable>
  );
}

/** One answer of the plan: icon, what it is, the answer; the currency line can be changed. */
function Line({ icon, label, value, action, open, onPress }: { icon: IconName; label: string; value: string; action?: string; open?: boolean; onPress?: () => void }) {
  return (
    <Row gap={S.md}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={C.accent} />
      </View>
      {/* One stop for VoiceOver: «Jogo: Cash 1/2 a 2/5», not the label and the answer apart. */}
      <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, gap: 2 }}>
        <T v="tiny" color={C.muted}>
          {label}
        </T>
        <T v="h3">{value}</T>
      </View>
      {action && onPress ? (
        <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${action}: ${label}`} accessibilityState={{ expanded: !!open }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T v="small" color={C.accent}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </Row>
  );
}

/** The effect of the answers as one number (Opal), worked out from the pace they gave, never invented. */
function Forecast({ n }: { n: number }) {
  const says = [`${n} ${t('sessões nas próximas 4 semanas, ao teu ritmo')}`, t('Chega para a tua curva de resultados começar a dizer alguma coisa.'), t('Segundo as tuas respostas')];
  return (
    <View accessible accessibilityLabel={says.join('. ')} style={{ borderRadius: R.lg, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: S.lg, gap: S.xs }}>
      <T v="monoXL" color={C.accent}>
        {n}
      </T>
      <T v="h3">{t('sessões nas próximas 4 semanas, ao teu ritmo')}</T>
      <T v="small">{t('Chega para a tua curva de resultados começar a dizer alguma coisa.')}</T>
      <T v="tiny" color={C.muted} style={{ paddingTop: S.xs }}>
        {t('Segundo as tuas respostas')}
      </T>
    </View>
  );
}
