// Definições → Os teus dados: the crash-report switch. Shown only in builds
// that can send reports (a Sentry DSN, on a phone).

import React, { useEffect, useState } from 'react';

import { t } from '@/i18n';
import { crashReportsAvailable, crashReportsOn, setCrashReports } from '@/lib/crash-report';

import { ToggleItem } from './ui';

export function CrashReportsToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    crashReportsOn().then(setOn);
  }, []);
  if (!crashReportsAvailable) return null;
  return (
    <ToggleItem
      icon="bug-outline"
      title={t('Enviar relatórios de erros')}
      subtitle={t('Só o que falhou e a versão, para corrigirmos depressa. Sem nomes, mãos nem montantes.')}
      value={on}
      onChange={(v) => {
        setOn(v);
        setCrashReports(v);
      }}
    />
  );
}
