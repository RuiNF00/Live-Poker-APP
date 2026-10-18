// A backer's live link (sweatbook.poker/live/<id>) opened in the app: the same
// stack, level and result as the web page, refreshed while the screen is open.
// The player's own link goes straight to their session instead.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';

import { Amount, Button, Card, Empty, IconButton, Pill, Row, Stat, StatGrid, T, Wordmark } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { fetchLive, type LiveSnapshot } from '@/lib/live-link';
import { claimInvite } from '@/lib/referrals';
import { chips, duration, money, timeOf } from '@/poker/format';
import { STAGES } from '@/poker/types';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

const POLL_MS = 20000;
/** No update for this long while "playing": say so instead of claiming it's live. */
const STALE_MS = 45 * 60000;

export default function BackerLive() {
  const { id, r } = useLocalSearchParams<{ id: string; r?: string }>();
  const insets = useSafeAreaInsets();
  const { sessions } = useStore();
  const own = sessions.find((s) => s.live?.id === id);
  const [data, setData] = useState<{ snapshot: LiveSnapshot; updatedAt: number } | null>(null);
  const [gone, setGone] = useState(false);
  // No signal before the first answer: said, with a retry, instead of «A carregar…» for good.
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!id) return;
    track('link_opened', { kind: 'live', live_id: String(id) });
    if (r) claimInvite(String(r), 'share');
  }, [id, r]);

  // Your own link: the session screen has everything, and more.
  useEffect(() => {
    if (own && !own.endedAt) router.replace('/session');
  }, [own]);

  useEffect(() => {
    if (!id || gone) return;
    let alive = true;
    const load = () =>
      fetchLive(String(id))
        .then((d) => {
          if (!alive) return;
          setOffline(false);
          if (d) setData(d);
          else setGone(true);
        })
        .catch(() => alive && setOffline(true));
    load();
    const poll = setInterval(() => AppState.currentState === 'active' && load(), POLL_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
      sub.remove();
    };
  }, [id, gone, attempt]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const s = data?.snapshot;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Row style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.gutter, paddingBottom: S.sm, justifyContent: 'space-between' }}>
        <IconButton name="close" onPress={close} label={t('Fechar')} />
        <Wordmark size={20} />
        <View style={{ width: 44 }} />
      </Row>
      {gone ? (
        <Empty icon="radio-outline" title={t('Este link já não está ativo')} body={t('O jogador desligou-o, ou a sessão terminou há muito tempo.')} />
      ) : (!s || !data) && offline ? (
        <Empty
          icon="cloud-offline-outline"
          title={t('Sem ligação')}
          body={t('Tenta outra vez quando tiveres rede.')}
          action={<Button kind="secondary" size="md" icon="refresh" title={t('Tentar outra vez')} onPress={() => (setOffline(false), setAttempt((n) => n + 1))} />}
        />
      ) : !s || !data ? (
        <T v="small" style={{ padding: S.gutter }}>
          {t('A carregar…')}
        </T>
      ) : (
        <LiveBody s={s} updatedAt={data.updatedAt} now={now} insetBottom={insets.bottom} />
      )}
    </View>
  );
}

function LiveBody({ s, updatedAt, now, insetBottom }: { s: LiveSnapshot; updatedAt: number; now: number; insetBottom: number }) {
  const mtt = s.kind === 'mtt';
  const ended = !!s.endedAt;
  const stale = !ended && now - updatedAt > STALE_MS;
  // The app sends the time played when it last saved; the clock keeps running here.
  const played = s.playedMs + (ended || s.paused || stale ? 0 : Math.max(0, now - s.updatedAt));
  const first = s.stackLog[0]?.stack ?? s.stack;
  // Cash: against what went in, so a rebuy doesn't read as a win.
  const delta = mtt ? s.stack - first : s.stack - s.invested;
  const bb = s.bb ? Math.round((s.stack / s.bb) * 10) / 10 : null;
  const result = s.cashOut - s.invested;
  const m = (n: number) => money(n, s.currency);
  const kind = mtt ? t('Torneio') : t('Cash game');
  const state = ended
    ? { label: t('Terminada'), color: C.muted }
    : stale
      ? { label: t('Sem atualizações'), color: C.warn }
      : s.paused
        ? { label: t('Em pausa'), color: C.warn }
        : { label: t('Em direto'), color: C.good };
  const agoMin = Math.max(0, Math.round((now - updatedAt) / 60000));
  const ago = agoMin < 1 ? t('agora mesmo') : agoMin < 60 ? t('há {n} min', { n: agoMin }) : t('há {n} h', { n: Math.round(agoMin / 60) });
  const stage = s.stage ? STAGES.find((x) => x.id === s.stage)?.label ?? s.stage : null;

  return (
    <ScrollView contentContainerStyle={{ padding: S.gutter, paddingBottom: insetBottom + S.xxl, gap: S.md }}>
      <View style={{ gap: S.xs }}>
        <Row gap={S.sm}>
          <T v="label" style={{ flexShrink: 1 }} numberOfLines={1}>
            {[kind, s.venue].filter(Boolean).join(' · ')}
          </T>
          <Pill label={state.label} color={state.color} icon="ellipse" />
        </Row>
        <T v="title">{s.name || kind}</T>
        <T v="small">{[s.player, t('começou às {time}', { time: timeOf(s.startedAt) })].filter(Boolean).join(' · ')}</T>
      </View>

      {ended ? (
        <Card style={{ gap: S.xs }}>
          <T v="label">{mtt ? (s.cashOut ? t('Prémio') : t('Eliminado')) : t('Cash-out')}</T>
          {s.cashOut || !mtt ? <T v="monoXL">{m(s.cashOut)}</T> : null}
          {s.finish ? <T v="h2">{s.field ? t('{n}.º de {field}', { n: s.finish, field: s.field }) : t('{n}.º lugar', { n: s.finish })}</T> : null}
          <Row gap={S.xs}>
            <T v="small">{t('Resultado')}</T>
            <Amount value={result} text={m(result)} />
          </Row>
        </Card>
      ) : (
        <Card style={{ gap: S.xs }}>
          <T v="label">Stack</T>
          <T v="monoXL">{chips(s.stack)}</T>
          <Row gap={S.md}>
            {bb !== null ? <T v="mono" color={C.textDim}>{`${bb} BB`}</T> : null}
            {delta ? (
              <Row gap={4}>
                <Amount value={delta} text={chips(delta)} />
                <T v="tiny">{t('desde o início')}</T>
              </Row>
            ) : null}
          </Row>
          {s.stackLog.length > 1 ? <Spark points={s.stackLog.map((p) => p.stack)} /> : null}
        </Card>
      )}

      <StatGrid cols={2}>
        <Stat label={s.level ? t('Nível {n}', { n: s.level }) : 'Blinds'} value={`${chips(s.sb)}/${chips(s.bb)}`} sub={s.ante ? `ante ${chips(s.ante)}` : undefined} />
        <Stat label={t('Tempo de jogo')} value={duration(played)} />
        <Stat label={t('Entradas')} value={`${s.entries} × ${m(s.buyIn)}`} sub={s.addOn ? `+ add-on ${m(s.addOn)}` : undefined} />
        <Stat label={t('Buy-ins')} value={m(s.invested)} />
        {mtt && stage ? <Stat label={t('Fase')} value={stage} /> : null}
        {s.hands ? <Stat label={t('Mãos registadas')} value={String(s.hands)} /> : null}
      </StatGrid>

      {s.sold ? (
        <Row gap={S.sm} style={{ backgroundColor: C.accentSoft, borderRadius: R.md, padding: S.md }}>
          <Ionicons name="people" size={16} color={C.accent} />
          <T v="small" color={C.text}>
            {t('{n}% da ação vendida', { n: s.sold })}
          </T>
        </Row>
      ) : null}
      <T v="tiny" style={{ textAlign: 'center' }}>
        {t('Atualizado {ago}', { ago })}
        {ended ? '' : ' · ' + t('Atualiza sozinho.')}
      </T>
      <Button kind="ghost" size="md" icon="radio-outline" title={t('Criar o meu link para backers')} onPress={() => router.replace('/session')} />
    </ScrollView>
  );
}

/** Stack line, scaled to its own range, with the start as a dashed reference. */
function Spark({ points }: { points: number[] }) {
  const w = 320;
  const h = 84;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - 6 - ((v - min) / span) * (h - 12);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const col = points[points.length - 1] >= points[0] ? C.good : C.bad;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: S.sm }}>
      <Line x1={0} x2={w} y1={y(points[0])} y2={y(points[0])} stroke={C.borderStrong} strokeDasharray="4 4" />
      <Path d={`${d} L${w},${h} L0,${h} Z`} fill={col} fillOpacity={0.12} />
      <Path d={d} stroke={col} strokeWidth={2} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}
