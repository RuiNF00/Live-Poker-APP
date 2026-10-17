// What a new swap is probably for, one tap away: the tournament you're in, the events you
// planned for today or tomorrow, festivals on now or next, then recent tournaments.

import { useMemo, useState } from 'react';

import { t } from '@/i18n';
import { eventDay, eventTitle } from '@/poker/festivals';
import { festivalName, planned, usePlans } from '@/store/festival-plan';
import { dayKey, notOver, useFestivals } from '@/store/my-festivals';
import { useStore } from '@/store/store';

export interface SwapSuggestion {
  title: string;
  venue: string;
  currency: string;
  scope: 'event' | 'series';
  /** live: the tournament you're in; plan: an event you planned for today or tomorrow. */
  from: 'live' | 'plan' | 'festival' | 'recent';
}

export function useSwapSuggestions(): SwapSuggestion[] {
  const { sessions, activeSession } = useStore();
  const festivals = useFestivals();
  const plans = usePlans();
  const [today] = useState(() => dayKey(Date.now()));
  const [tomorrow] = useState(() => dayKey(Date.now() + 86400000));
  return useMemo(() => {
    const out: SwapSuggestion[] = [];
    const add = (o: SwapSuggestion) => {
      if (o.title && !out.some((x) => x.title.toLowerCase() === o.title.toLowerCase())) out.push(o);
    };
    const live = activeSession?.kind === 'mtt' ? activeSession : null;
    if (live?.name) add({ title: live.name, venue: live.venue, currency: live.currency, scope: 'event', from: 'live' });
    const on = festivals.filter((f) => notOver(f, today));
    // Planned events, without the flight: one swap covers every flight of the event.
    for (const f of on) {
      const plan = plans[f.id];
      if (!plan) continue;
      for (const e of planned(f, plan)) {
        const day = eventDay(e);
        if (!e.day2 && (day === today || day === tomorrow)) add({ title: eventTitle(e), venue: f.venue, currency: f.currency, scope: 'event', from: 'plan' });
      }
    }
    for (const f of on.slice(0, 3)) add({ title: plans[f.id] ? festivalName(f, plans[f.id]) : t(f.name), venue: f.venue, currency: f.currency, scope: 'series', from: 'festival' });
    for (const s of sessions) {
      if (out.filter((o) => o.scope === 'event').length >= 6) break;
      if (s.kind === 'mtt' && s.name) add({ title: s.name, venue: s.venue, currency: s.currency, scope: 'event', from: 'recent' });
    }
    return out;
  }, [activeSession, festivals, plans, sessions, today, tomorrow]);
}
