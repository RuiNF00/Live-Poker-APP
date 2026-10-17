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
    return path;
  } catch {
    return path;
  }
}
