'use client';

import { useState } from 'react';

export interface SupportFormCopy {
  message: string;
  placeholder: string;
  attached: string;
  send: string;
  hint: string;
  copy: string;
  copied: string;
}

/**
 * Builds an email in the visitor's own mail app: nothing is sent to or kept on our server.
 * The app version, OS and language ride along so a bug report needs no back and forth.
 */
export function SupportForm({ to, subject, details, c }: { to: string; subject: string; details: [string, string][]; c: SupportFormCopy }) {
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const footer = details.length ? `\n\n---\n${details.map(([k, v]) => `${k}: ${v}`).join('\n')}` : '';
  const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg + footer)}`;

  return (
    <form className="hc-form" action={href} method="get" onSubmit={(e) => { e.preventDefault(); window.location.href = href; }}>
      <label>
        <span>{c.message}</span>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={c.placeholder} rows={6} maxLength={4000} />
      </label>
      {details.length ? (
        <div className="hc-details">
          <span>{c.attached}</span>
          <ul>
            {details.map(([k, v]) => (
              <li key={k}>
                {k}: <code>{v}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button className="hc-btn" type="submit">
        {c.send}
      </button>
      <p className="hc-hint">
        {c.hint}{' '}
        <button
          type="button"
          className="hc-link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(to);
              setCopied(true);
            } catch {
              /* clipboard blocked: the address is on screen */
            }
          }}
        >
          {copied ? c.copied : c.copy}
        </button>
      </p>
    </form>
  );
}
