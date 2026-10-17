'use client';

import { useState } from 'react';
import { authKey, parseCode } from '@/lib/backup-code';

export interface BackupDeleteCopy {
  label: string;
  placeholder: string;
  button: string;
  working: string;
  done: string;
  notFound: string;
  invalid: string;
  busy: string;
  failed: string;
}

type State = 'idle' | 'working' | 'done' | 'notFound' | 'invalid' | 'busy' | 'failed';

/**
 * Deletes a cloud backup with its recovery code, as the app does: the code is read and the
 * auth key derived here in the browser, so the secret that decrypts the backup never leaves it.
 */
export function BackupDeleteForm({ c }: { c: BackupDeleteCopy }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState<State>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseCode(code);
    if (!parsed) return setState('invalid');
    setState('working');
    try {
      const res = await fetch(`/api/backup/${parsed.id}`, { method: 'DELETE', headers: { 'x-backup-key': await authKey(parsed.secret) } });
      setState(res.ok ? 'done' : res.status === 404 ? 'notFound' : res.status === 429 ? 'busy' : 'failed');
    } catch {
      setState('failed');
    }
    setCode('');
  }

  const message = state === 'idle' ? '' : c[state];
  return (
    <form className="hc-form" onSubmit={submit}>
      <label>
        <span>{c.label}</span>
        <input
          className="hc-input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (state !== 'working') setState('idle');
          }}
          placeholder={c.placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
        />
      </label>
      <button className="hc-btn" type="submit" disabled={state === 'working' || !code.trim()}>
        {c.button}
      </button>
      <p className="hc-hint" role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
