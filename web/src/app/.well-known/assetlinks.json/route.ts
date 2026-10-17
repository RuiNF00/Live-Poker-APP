import { NextResponse } from 'next/server';

// Android App Links for https://sweatbook.poker/h/, /r/, /live/, /swap/ and /b (paths are in the app's
// intent filter, app.json). Needs ANDROID_CERT_SHA256
// (comma-separated, from Play Console > App signing) on the host.
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || '').split(',').map((s) => s.trim()).filter(Boolean);
  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: process.env.ANDROID_PACKAGE || 'com.ruinf.sweatbook',
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
