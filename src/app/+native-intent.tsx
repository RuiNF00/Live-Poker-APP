// Links from sweatbook.poker that open the app (universal links / App Links) arrive
// here first. The site's demo hand has no share id behind it, so it opens the
// sample hand instead of an empty replay. Everything else routes as is.

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const { pathname } = new URL(path, 'https://sweatbook.poker');
    if (pathname === '/h/demo' || pathname === '/h/demo/') return '/hand/sample';
    return path;
  } catch {
    return path;
  }
}
