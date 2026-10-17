import { NextResponse } from 'next/server';

import { cors } from '@/lib/cors';
import { limited } from '@/lib/abuse';
import { hasPro, revenueCatConfigured } from '@/lib/revenuecat';
import { MAX_FRAMES, parseDurations, parseSlot, renderReplayVideo } from '@/lib/story-video';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FRAME = 600 * 1024;
const MAX_VOICE = 3 * 1024 * 1024;
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

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * Renders a hand's replay as a vertical video (Reels, TikTok, WhatsApp status).
 * Called by the app (src/lib/instagram-story.native.ts): multipart form with
 * `frame0`…`frameN` (JPEG 1080×1920, captured from the replayer), `durations`
 * (JSON seconds per frame), and optionally `voice` + `slot` + `rcUserId`.
 * Anyone can render the video; adding a voice note is Pro.
 */
export async function POST(req: Request) {
  if (await limited(req, 'replay', 20, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'missing_files' }, { status: 400, headers: cors });

  const frames: Uint8Array[] = [];
  for (let i = 0; i < MAX_FRAMES; i++) {
    const f = form.get('frame' + i);
    if (!(f instanceof Blob)) break;
    if (f.size > MAX_FRAME) return NextResponse.json({ error: 'too_large' }, { status: 413, headers: cors });
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (!isJpeg(bytes)) return NextResponse.json({ error: 'invalid_frame' }, { status: 422, headers: cors });
    frames.push(bytes);
  }
  if (!frames.length) return NextResponse.json({ error: 'missing_files' }, { status: 400, headers: cors });

  let durations: number[] | null = null;
  try {
    durations = parseDurations(JSON.parse(String(form.get('durations') ?? '')), frames.length);
  } catch {
    durations = null;
  }
  if (!durations) return NextResponse.json({ error: 'invalid_durations' }, { status: 422, headers: cors });

  const voice = form.get('voice');
  let voiceBytes: Uint8Array | null = null;
  let voiceExt = 'm4a';
  let slot = null;
  if (voice instanceof Blob) {
    const rcUserId = form.get('rcUserId');
    if (revenueCatConfigured()) {
      if (typeof rcUserId !== 'string' || !rcUserId || rcUserId.length > 100 || !(await hasPro(rcUserId))) {
        return NextResponse.json({ error: 'pro_required' }, { status: 403, headers: cors });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: cors });
    }
    if (voice.size > MAX_VOICE) return NextResponse.json({ error: 'too_large' }, { status: 413, headers: cors });
    voiceBytes = new Uint8Array(await voice.arrayBuffer());
    voiceExt = VOICE_EXT[voice.type.split(';')[0]] ?? 'm4a';
    const rawSlot = form.get('slot');
    if (typeof rawSlot === 'string') {
      try {
        slot = parseSlot(JSON.parse(rawSlot));
      } catch {
        slot = null;
      }
    }
  }

  try {
    const mp4 = await renderReplayVideo({ frames, durations, voice: voiceBytes, voiceExt, slot });
    return new NextResponse(new Uint8Array(mp4), {
      headers: { ...cors, 'content-type': 'video/mp4', 'content-length': String(mp4.length), 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'render_failed' }, { status: 500, headers: cors });
  }
}
