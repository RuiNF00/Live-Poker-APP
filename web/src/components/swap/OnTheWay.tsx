'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// A link sent before its swap reached us (made without signal, id from the app's token): the page
// looks again every 30 s while it's in view, for 10 minutes (a forgotten tab stops), and on the button.
export function OnTheWay({ title, body, retry }: { title: string; body: string; retry: string }) {
  const router = useRouter();
  useEffect(() => {
    const until = Date.now() + 10 * 60000;
    const t = setInterval(() => {
      if (Date.now() > until) clearInterval(t);
      else if (!document.hidden) router.refresh();
    }, 30000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <main className="page page-center">
      <h1 className="hand-title">{title}</h1>
      <p className="muted">{body}</p>
      <button type="button" className="btn btn-primary" onClick={() => router.refresh()}>
        {retry}
      </button>
    </main>
  );
}
