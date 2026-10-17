import { NextResponse } from 'next/server';

import { cors } from '@/lib/cors';
import { limited } from '@/lib/abuse';
import { hasPro, revenueCatConfigured } from '@/lib/revenuecat';
import { parseSlot, renderStoryVideo } from '@/lib/story-video';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FRAME = 4 * 1024 * 1024;
const MAX_VOICE = 3 * 1024 * 1024;
// Each voice type maps to the one ffmpeg demuxer allowed to read it (see ffmpegArgs).
const VOICE_EXT: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/3gpp': '3gp',
};

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * Renders a voice story for Instagram. Called by the app
 * (src/lib/story-video.ts): multipart form with `frame` (PNG 1080×1920),
 * `voice` (m4a/aac, up to 30 s) and optional `slot` (JSON {x,y,w,h} in
 * pixels where the waveform goes) and `rcUserId` (RevenueCat app user id) -> 200 video/mp4.
 * Voice stories are Pro: 403 pro_required unless RevenueCat says the user has Pro now.
 */
export async function POST(req: Request) {
  if (await limited(req, 'story', 30, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const form = await req.formData().catch(() => null);
  const rcUserId = form?.get('rcUserId');
  if (revenueCatConfigured()) {
    if (typeof rcUserId !== 'string' || !rcUserId || rcUserId.length > 100 || !(await hasPro(rcUserId))) {
      return NextResponse.json({ error: 'pro_required' }, { status: 403, headers: cors });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Without the RevenueCat key the server can't tell who is Pro: don't render for anyone.
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: cors });
  }
  const frame = form?.get('frame');
  const voice = form?.get('voice');
  if (!(frame instanceof Blob) || !(voice instanceof Blob)) {
    return NextResponse.json({ error: 'missing_files' }, { status: 400, headers: cors });
  }
  if (frame.size > MAX_FRAME || voice.size > MAX_VOICE) {
    return NextResponse.json({ error: 'too_large' }, { status: 413, headers: cors });
  }
  const frameBytes = new Uint8Array(await frame.arrayBuffer());
  const isPng = frameBytes[0] === 0x89 && frameBytes[1] === 0x50 && frameBytes[2] === 0x4e && frameBytes[3] === 0x47;
  const voiceExt = VOICE_EXT[voice.type.split(';')[0]] ?? 'm4a';
  if (!isPng) return NextResponse.json({ error: 'invalid_frame' }, { status: 422, headers: cors });

  let slot = null;
  const rawSlot = form?.get('slot');
  if (typeof rawSlot === 'string') {
    try {
      slot = parseSlot(JSON.parse(rawSlot));
    } catch {
      slot = null;
    }
  }

  try {
    const mp4 = await renderStoryVideo({ frame: frameBytes, voice: new Uint8Array(await voice.arrayBuffer()), voiceExt, slot });
    return new NextResponse(new Uint8Array(mp4), {
      headers: { ...cors, 'content-type': 'video/mp4', 'content-length': String(mp4.length), 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'render_failed' }, { status: 500, headers: cors });
  }
}
