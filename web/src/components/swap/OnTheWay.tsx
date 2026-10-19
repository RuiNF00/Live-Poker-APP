'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// A link sent before its swap reached us (made without signal, id from the app's token): the page
// looks again every 30 s, and on the button, until the swap is there.
export function OnTheWay({ title, body, retry }: { title: string; body: string; retry: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30000);
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
