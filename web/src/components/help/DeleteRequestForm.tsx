'use client';

import { useState } from 'react';

export const DELETE_ITEMS = ['backup', 'links', 'profile', 'swaps', 'other'] as const;
export type DeleteItem = (typeof DELETE_ITEMS)[number];

export interface DeleteFormCopy {
  legend: string;
  items: Record<DeleteItem, string>;
  details: string;
  placeholder: string;
  send: string;
  hint: string;
  subject: string;
}

/**
 * A deletion request for someone who no longer has the app. Like /support it only builds an
 * email in the visitor's own mail app: nothing is sent to or kept on our server.
 */
export function DeleteRequestForm({ to, c }: { to: string; c: DeleteFormCopy }) {
  const [picked, setPicked] = useState<Set<DeleteItem>>(new Set());
  const [msg, setMsg] = useState('');
  const toggle = (k: DeleteItem) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const list = DELETE_ITEMS.filter((k) => picked.has(k)).map((k) => `- ${c.items[k]}`);
  const body = [...list, ...(list.length ? [''] : []), msg].join('\n').trim();
  const href = `mailto:${to}?subject=${encodeURIComponent(c.subject)}&body=${encodeURIComponent(body)}`;

  return (
    <form className="hc-form" action={href} method="get" onSubmit={(e) => { e.preventDefault(); window.location.href = href; }}>
      <fieldset className="hc-checks">
        <legend>{c.legend}</legend>
        {DELETE_ITEMS.map((k) => (
          <label key={k}>
            <input type="checkbox" checked={picked.has(k)} onChange={() => toggle(k)} />
            <span>{c.items[k]}</span>
          </label>
        ))}
      </fieldset>
      <label>
        <span>{c.details}</span>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={c.placeholder} rows={5} maxLength={4000} />
      </label>
      <button className="hc-btn" type="submit">
        {c.send}
      </button>
      <p className="hc-hint">{c.hint}</p>
    </form>
  );
}
