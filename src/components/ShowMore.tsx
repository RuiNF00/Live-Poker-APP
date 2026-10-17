// Long lists inside a scrolling screen (years of sessions, hundreds of hands
// against one player) draw a page at a time: thousands of rows mounted at once
// freeze the screen on a mid-range phone.

import React, { useState } from 'react';

import { t } from '@/i18n';

import { Button } from './ui';

/** Rows drawn per page. */
export const PAGE = 50;

/** The first pages of `list`, and a button for the next page (null when all are shown). */
export function usePaged<T>(list: readonly T[], page = PAGE): { shown: readonly T[]; more: React.ReactNode } {
  const [pages, setPages] = useState(1);
  const shown = list.length > pages * page ? list.slice(0, pages * page) : list;
  const left = list.length - shown.length;
  const more = left > 0 ? <Button kind="ghost" size="md" icon="chevron-down" title={t('Mostrar mais ({n})', { n: left })} onPress={() => setPages((p) => p + 1)} /> : null;
  return { shown, more };
}
