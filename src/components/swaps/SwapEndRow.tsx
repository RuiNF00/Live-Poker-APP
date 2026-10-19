// Ending a tournament that has swaps: one switch in "Terminar sessão", on by default, and
// Guardar sends my own result (prize or bust, and the place) to each of them. Only mine: the
// other players still record theirs. With it off, the sheet after the session asks as before.

import React, { useState } from 'react';

import { ListGroup, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { groupsForSession } from '@/store/swap-groups';
import { useGroups } from '@/store/swap-groups-store';
import { other, swapNames, swapsForSession } from '@/store/swaps';
import { useSwaps } from '@/store/swaps-store';
import type { Session } from '@/store/types';

import { record } from './SwapReminder';

export function useSwapEnd(s: Session) {
  const { swaps } = useSwaps();
  const { groups } = useGroups();
  const [on, setOn] = useState(true);
  // Matched as if it were over (still running: any end will do), as on the live screen.
  const now = { ...s, endedAt: Number.MAX_SAFE_INTEGER };
  const pairs = swapsForSession(swaps, now).filter((x) => !x.left);
  const gl = groupsForSession(groups, now).filter((g) => !g.removed && !g.seats.some((x) => x.name === '-'));
  const names = [...pairs.map((x) => swapNames(x)[other(x.side)]), ...gl.map((g) => g.terms.title)];
  const row = names.length ? (
    <ListGroup>
      <ToggleItem icon="swap-horizontal" title={t('Enviar o meu resultado para o swap')} subtitle={names.join(', ')} value={on} onChange={setOn} />
    </ListGroup>
  ) : null;
  /** After the session is saved: the ended session, with its prize and place. */
  const send = (ended: Session) => {
    if (on && names.length) void record(ended, pairs, gl);
  };
  return { row, send };
}
