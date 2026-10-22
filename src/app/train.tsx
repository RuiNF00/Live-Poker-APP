// «Treino da semana» (the Sunday notice, the Resumo card): opens the first of up to 3 hands that ask
// «O que fazes aqui?» (poker/drill), each offering the next. With none left, the hands list.
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { drillQueue, DRILL_MAX } from '@/poker/drill';
import { readDrill } from '@/store/drill-store';
import { useStore } from '@/store/store';

export default function Train() {
  const { hands, ready } = useStore();
  const [first, setFirst] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    // The queue as it stands once the hands are loaded (a notice can open the app cold).
    if (!ready || first !== undefined) return;
    void readDrill().then((d) => setFirst(drillQueue(hands, d, Date.now())[0]?.id ?? null));
  }, [ready, hands, first]);
  if (first === undefined) return null;
  if (!first) return <Redirect href="/hands" />;
  return <Redirect href={{ pathname: '/hand/[id]', params: { id: first, q: 'train', k: String(DRILL_MAX) } }} />;
}
