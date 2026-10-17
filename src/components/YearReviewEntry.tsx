import { router } from 'expo-router';
import React, { useMemo } from 'react';

import { ListGroup, ListItem } from '@/components/ui';
import { t } from '@/i18n';
import { defaultYear } from '@/share/year-review';
import { useStore } from '@/store/store';
import { C } from '@/theme';

/** Row that opens "O meu ano no póquer", once a year has enough sessions to look back on. */
export function YearReviewEntry() {
  const { sessions } = useStore();
  const year = useMemo(() => defaultYear(sessions), [sessions]);
  if (!year) return null;
  return (
    <ListGroup>
      <ListItem
        icon="sparkles-outline"
        iconColor={C.accent}
        title={t('O meu ano no póquer')}
        subtitle={t('{year} em cartões para partilhar', { year })}
        chevron
        onPress={() => router.push({ pathname: '/year', params: { y: String(year) } })}
      />
    </ListGroup>
  );
}
