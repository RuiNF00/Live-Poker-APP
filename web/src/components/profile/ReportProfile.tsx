'use client';

import { useState } from 'react';

/** Small link at the bottom: three different people hide the profile for review. */
export function ReportProfile({ handle, label, done }: { handle: string; label: string; done: string }) {
  const [sent, setSent] = useState(false);
  if (sent) return <span>{done}</span>;
  return (
    <button
      type="button"
      className="pf-report"
      onClick={() => {
        setSent(true);
        fetch(`/api/profiles/${encodeURIComponent(handle)}/report`, { method: 'POST' }).catch(() => {});
      }}
    >
      {label}
    </button>
  );
}
