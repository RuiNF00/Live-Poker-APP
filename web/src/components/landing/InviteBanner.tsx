'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/config/brand';
import { writeLocal } from '@/lib/local';
import type { Locale } from '@/lib/i18n';
import { REWARD_DAYS_PUBLIC } from './copy';

/**
 * The friend's side of an invite. Android picks the code up from the Play referrer; on iPhone
 * the friend comes back to this link after installing, and the universal link (or the button)
 * opens the app with the code.
 */
export function InviteBanner({ code, locale }: { code: string; locale: Locale }) {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    writeLocal('invite', code);
  }, [code]);
  const pt = locale === 'pt';
  return (
    <div className="lp-invite" role="note">
      <span className="lp-invite-gift" aria-hidden>
        🎁
      </span>
      <div>
        <b>{pt ? 'Tens um convite para o Sweatbook' : "You're invited to Sweatbook"}</b>
        <p>
          {pt
            ? `Instala a app e guarda a tua primeira mão: tu e o amigo que te convidou ganham ${REWARD_DAYS_PUBLIC} dias de Pro.`
            : `Install the app and save your first hand: you and your friend both get ${REWARD_DAYS_PUBLIC} days of Pro.`}
        </p>
        {ios && (
          <p className="lp-invite-ios">
            {pt ? 'Já instalaste? ' : 'Already installed? '}
            <a href={`${brand.appScheme}://r/${code}`}>{pt ? 'Ativar o convite na app' : 'Activate the invite in the app'}</a>
          </p>
        )}
        <span className="lp-invite-code">
          {pt ? 'Código' : 'Code'} <code>{code}</code>
        </span>
      </div>
    </div>
  );
}
