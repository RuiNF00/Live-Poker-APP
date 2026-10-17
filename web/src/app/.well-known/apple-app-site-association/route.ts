import { NextResponse } from 'next/server';

// iOS universal links: /h/<id> (shared hand), /r/<code> (invite), /live/<id> (backer page) and /swap/<id>
// open the app when installed; everything else, and the demo hand, stays in the browser.
// Needs APPLE_TEAM_ID (Apple Developer > Membership) on the host.
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const bundle = process.env.IOS_BUNDLE_ID || 'com.ruinf.sweatbook';
  const apps = team ? [`${team}.${bundle}`] : [];
  return NextResponse.json({
    applinks: {
      details: [
        {
          appIDs: apps,
          components: [
            { '/': '/h/demo', exclude: true, comment: 'Demo hand lives on the site only' },
            { '/': '/h/*/og', exclude: true },
            { '/': '/h/*' },
            { '/': '/live/*/og', exclude: true },
            { '/': '/r/*' },
            { '/': '/live/*' },
            { '/': '/swap/*' },
          ],
        },
      ],
    },
    webcredentials: { apps },
  });
}
