import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Turns a story frame (the app's 1080×1920 PNG) plus the player's voice note
// into an Instagram-ready MP4. A live waveform is drawn into the slot the app
// reserved on the frame, so the story moves while they talk.

export const STORY_W = 1080;
export const STORY_H = 1920;
export const MAX_SECONDS = 30;

export interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

// Frames are RGB; converted and tagged as BT.709 (limited range) so iPhone, Android, Instagram and
// WhatsApp all show the same colours. Untagged, players guess: the brand orange came out lighter.
const TO_YUV = `scale=${STORY_W}:${STORY_H}:out_color_matrix=bt709:out_range=tv`;
const COLOR_TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

/** Clamp the waveform slot to the frame; null if it makes no sense. */
export function parseSlot(raw: unknown): Slot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const n = (k: string) => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? (r[k] as number) : NaN);
  const x = Math.round(n('x'));
  const y = Math.round(n('y'));
  const w = even(n('w'));
  const h = even(n('h'));
  if ([x, y, w, h].some(Number.isNaN) || x < 0 || y < 0 || w < 20 || h < 10) return null;
  if (x + w > STORY_W || y + h > STORY_H) return null;
  return { x, y, w, h };
}

/** Where the face clip goes on a replay video: a circle of diameter `d` at x, y. */
export interface FaceSlot {
  x: number;
  y: number;
  d: number;
}

/** Clamp the face circle to the frame; null if it makes no sense. */
export function parseFaceSlot(raw: unknown): FaceSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const n = (k: string) => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? Math.round(r[k] as number) : NaN);
  const x = n('x');
  const y = n('y');
  const d = even(n('d'));
  if ([x, y, d].some(Number.isNaN) || x < 0 || y < 0 || d < 60 || d > 600) return null;
  if (x + d > STORY_W || y + d > STORY_H) return null;
  return { x, y, d };
}

/** An MP4/QuickTime file starts with a box whose type is 'ftyp' (bytes 4–7). */
export const isMp4 = (b: Uint8Array) => b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;

// Inputs are uploads, so ffmpeg must not guess what they are: each one is read by a single
// named demuxer from a local file only (no playlists, concat lists or URLs).
const VOICE_DEMUXER: Record<string, string> = { m4a: 'mov', '3gp': 'mov', aac: 'aac', mp3: 'mp3', webm: 'matroska', ogg: 'ogg' };

export function ffmpegArgs(frame: string, voice: string, out: string, slot: Slot | null): string[] {
  const voiceFormat = VOICE_DEMUXER[path.extname(voice).slice(1).toLowerCase()] ?? 'mov';
  // The waveform branch is normalised so a quiet voice still moves the bars;
  // the audio itself goes out untouched.
  const filter = slot
    ? `[0:v]${TO_YUV},setsar=1,format=yuv420p[bg];` +
      `[1:a]asplit[a][b];` +
      `[b]aformat=channel_layouts=mono,dynaudnorm=f=75:p=0.95,volume=3,showwaves=s=${slot.w}x${slot.h}:mode=cline:rate=24:colors=0xFF6A3D:scale=sqrt[w];` +
      `[bg][w]overlay=${slot.x}:${slot.y}:shortest=1,format=yuv420p[v]`
    : `[0:v]${TO_YUV},setsar=1,format=yuv420p[v];[1:a]anull[a]`;
  return [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-protocol_whitelist', 'file',
    '-f', 'image2',
    '-pattern_type', 'none',
    '-c:v', 'png',
    '-loop', '1',
    '-framerate', '24',
    '-i', frame,
    '-protocol_whitelist', 'file',
    '-f', voiceFormat,
    '-i', voice,
    '-filter_complex', filter,
    '-map', '[v]',
    '-map', '[a]',
    '-t', String(MAX_SECONDS),
    '-shortest',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '26',
    '-profile:v', 'high',
    ...COLOR_TAGS,
    '-c:a', 'aac',
    '-b:a', '96k',
    '-ar', '44100',
    '-movflags', '+faststart',
    out,
  ];
}

/** Most frames a replay video takes, and the crossfade between them. */
export const MAX_FRAMES = 24;
const FADE = 0.25;

/** Seconds per frame from the app; null unless there is one sane value per frame. */
export function parseDurations(raw: unknown, frames: number): number[] | null {
  if (!Array.isArray(raw) || raw.length !== frames || frames < 1) return null;
  const out = raw.map((d) => (typeof d === 'number' && Number.isFinite(d) ? d : NaN));
  if (out.some((d) => Number.isNaN(d) || d < 0.3 || d > 12)) return null;
  if (out.reduce((a, d) => a + d, 0) > MAX_SECONDS + 0.5) return null;
  return out;
}

/**
 * Replay video: each JPEG frame held for its duration with a short crossfade
 * into the next, over the voice note (waveform in `slot`), the face clip (in a
 * circle at `face.slot`, its sound as the audio) or silence.
 */
export function replayArgs(
  frames: string[],
  durations: number[],
  voice: string | null,
  out: string,
  slot: Slot | null,
  face: { file: string; slot: FaceSlot } | null = null,
): string[] {
  const n = frames.length;
  const total = Math.min(MAX_SECONDS, durations.reduce((a, d) => a + d, 0));
  const inputs: string[] = [];
  frames.forEach((f, i) => {
    // Every frame but the last runs a fade longer, so the fades don't eat into the total.
    const len = durations[i] + (i < n - 1 ? FADE : 0);
    // Read at 4 fps (the picture doesn't change) and doubled up to 24 below: each JPEG is decoded
    // a few times instead of 24 times a second, the slowest part of the render.
    inputs.push('-protocol_whitelist', 'file', '-f', 'image2', '-pattern_type', 'none', '-c:v', 'mjpeg', '-loop', '1', '-framerate', '4', '-t', len.toFixed(2), '-i', f);
  });
  const parts = frames.map((_, i) => `[${i}:v]${TO_YUV},setsar=1,fps=24,format=yuv420p,settb=AVTB[f${i}]`);
  let cur = 'f0';
  let at = 0;
  for (let i = 1; i < n; i++) {
    at += durations[i - 1];
    parts.push(`[${cur}][f${i}]xfade=transition=fade:duration=${FADE}:offset=${at.toFixed(2)}[x${i}]`);
    cur = `x${i}`;
  }
  const T = total.toFixed(2);
  if (face) {
    const { x, y, d } = face.slot;
    // Square crop of the selfie, scaled into the circle; the last frame holds if the clip is shorter.
    inputs.push('-protocol_whitelist', 'file', '-f', 'mov', '-i', face.file);
    parts.push(
      `[${n}:v]crop='min(iw,ih)':'min(iw,ih)',scale=${d}:${d},fps=24,tpad=stop_mode=clone:stop_duration=${MAX_SECONDS},format=yuva420p[fv]`,
      // The circle is drawn once (one frame) and held: alphamerge repeats the mask's last frame.
      `color=c=black:s=${d}x${d}:r=1:d=1,format=gray,geq=lum='if(lte(hypot(X-${d / 2},Y-${d / 2}),${d / 2}),255,0)'[mask]`,
      `[fv][mask]alphamerge[fc]`,
      `[${cur}][fc]overlay=${x}:${y}:shortest=1,format=yuv420p[v]`,
      `[${n}:a]apad,atrim=0:${T}[a]`,
    );
  } else if (voice) {
    const voiceFormat = VOICE_DEMUXER[path.extname(voice).slice(1).toLowerCase()] ?? 'mov';
    inputs.push('-protocol_whitelist', 'file', '-f', voiceFormat, '-i', voice);
    if (slot) {
      parts.push(
        `[${n}:a]apad,atrim=0:${T},asplit[a][b]`,
        `[b]aformat=channel_layouts=mono,dynaudnorm=f=75:p=0.95,volume=3,showwaves=s=${slot.w}x${slot.h}:mode=cline:rate=24:colors=0xFF6A3D:scale=sqrt[w]`,
        `[${cur}][w]overlay=${slot.x}:${slot.y}:shortest=1,format=yuv420p[v]`,
      );
    } else parts.push(`[${n}:a]apad,atrim=0:${T}[a]`, `[${cur}]null[v]`);
  } else {
    // A silent track: some apps (WhatsApp status, older Android players) reject video-only files.
    parts.push(`anullsrc=r=44100:cl=mono,atrim=0:${T}[a]`, `[${cur}]null[v]`);
  }
  return [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    ...inputs,
    '-filter_complex', parts.join(';'),
    '-map', '[v]',
    '-map', '[a]',
    '-t', T,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '24',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    ...COLOR_TAGS,
    '-c:a', 'aac',
    '-b:a', '96k',
    '-ar', '44100',
    '-movflags', '+faststart',
    out,
  ];
}

function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bin = require('ffmpeg-static') as string | null;
  if (!bin) throw new Error('ffmpeg binary not available');
  return bin;
}

function run(bin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${err}`));
    });
  });
}

export async function renderStoryVideo(input: { frame: Uint8Array; voice: Uint8Array; voiceExt: string; slot: Slot | null }): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'story-'));
  try {
    const frame = path.join(dir, 'frame.png');
    const voice = path.join(dir, 'voice.' + input.voiceExt);
    const out = path.join(dir, 'story.mp4');
    await writeFile(frame, input.frame);
    await writeFile(voice, input.voice);
    await run(ffmpegPath(), ffmpegArgs(frame, voice, out, input.slot), 50_000);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function renderReplayVideo(input: {
  frames: Uint8Array[];
  durations: number[];
  voice: Uint8Array | null;
  voiceExt: string;
  slot: Slot | null;
  face?: { bytes: Uint8Array; slot: FaceSlot } | null;
}): Promise<Buffer> {
  // The voice and face live only in this temp folder, removed below whatever happens.
  const dir = await mkdtemp(path.join(os.tmpdir(), 'replay-'));
  try {
    const frames = await Promise.all(
      input.frames.map(async (f, i) => {
        const p = path.join(dir, `f${String(i).padStart(2, '0')}.jpg`);
        await writeFile(p, f);
        return p;
      }),
    );
    let voice: string | null = null;
    if (input.voice) {
      voice = path.join(dir, 'voice.' + input.voiceExt);
      await writeFile(voice, input.voice);
    }
    let face: { file: string; slot: FaceSlot } | null = null;
    if (input.face) {
      face = { file: path.join(dir, 'face.mov'), slot: input.face.slot };
      await writeFile(face.file, input.face.bytes);
    }
    const out = path.join(dir, 'replay.mp4');
    await run(ffmpegPath(), replayArgs(frames, input.durations, face ? null : voice, out, voice ? input.slot : null, face), 55_000);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
