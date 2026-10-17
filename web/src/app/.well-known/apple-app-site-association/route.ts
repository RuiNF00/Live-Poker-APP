import { NextResponse } from 'next/server';

// iOS universal links: /h/<id> (shared hand) and /r/<code> (invite) open the app when installed.
// Needs APPLE_TEAM_ID (Apple Developer > Membership) on the host.
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const bundle = process.env.IOS_BUNDLE_ID || 'com.ruinf.sweatbook';
  const apps = team ? [`${team}.${bundle}`] : [];
  return NextResponse.json({
    applinks: { details: [{ appIDs: apps, components: [{ '/': '/h/*' }, { '/': '/r/*' }] }] },
    webcredentials: { apps },
  });
}
