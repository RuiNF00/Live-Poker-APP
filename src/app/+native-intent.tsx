// Links from sweatbook.poker that open the app (universal links / App Links) arrive
// here first. The site's demo hand has no share id behind it, so it opens the
// sample hand instead of an empty replay. Everything else routes as is.

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const { pathname, hash, searchParams } = new URL(path, 'https://sweatbook.poker');
    if (pathname === '/h/demo' || pathname === '/h/demo/') return '/hand/sample';
    // A backer's statement (sweatbook.poker/b#data): the data is in the fragment.
    if ((pathname === '/b' || pathname === '/b/') && hash.length > 1) {
      const r = searchParams.get('r');
      return `/backing/add?d=${encodeURIComponent(hash.slice(1))}${r ? `&r=${encodeURIComponent(r)}` : ''}`;
    }
    // A swap link keeps its secrets in the fragment (#i= the group's invite, #k= a seat's or a
    // side's token), which the router drops: hand them to the screen as query params.
    if (pathname.startsWith('/swap/') && hash.length > 1) {
      const q = new URLSearchParams(searchParams);
      for (const [key, v] of new URLSearchParams(hash.slice(1))) if ((key === 'i' || key === 'k') && /^[a-f0-9]{32,128}$/.test(v)) q.set(key, v);
      const s = q.toString();
      return `${pathname}${s ? `?${s}` : ''}`;
    }
    return path;
  } catch {
    return path;
  }
}
