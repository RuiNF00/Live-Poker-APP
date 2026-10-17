import { NextResponse } from 'next/server';

// iOS universal links: https://sweatbook.poker/h/<id> opens the app when installed.
// Needs APPLE_TEAM_ID (Apple Developer > Membership) on the host.
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const bundle = process.env.IOS_BUNDLE_ID || 'com.ruinf.sweatbook';
  const apps = team ? [`${team}.${bundle}`] : [];
  return NextResponse.json({
    applinks: { details: [{ appIDs: apps, components: [{ '/': '/h/*' }] }] },
    webcredentials: { apps },
  });
}
