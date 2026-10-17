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

// Inputs are uploads, so ffmpeg must not guess what they are: each one is read by a single
// named demuxer from a local file only (no playlists, concat lists or URLs).
const VOICE_DEMUXER: Record<string, string> = { m4a: 'mov', '3gp': 'mov', aac: 'aac', mp3: 'mp3', webm: 'matroska', ogg: 'ogg' };

export function ffmpegArgs(frame: string, voice: string, out: string, slot: Slot | null): string[] {
  const voiceFormat = VOICE_DEMUXER[path.extname(voice).slice(1).toLowerCase()] ?? 'mov';
  // The waveform branch is normalised so a quiet voice still moves the bars;
  // the audio itself goes out untouched.
  const filter = slot
    ? `[0:v]scale=${STORY_W}:${STORY_H},setsar=1[bg];` +
      `[1:a]asplit[a][b];` +
      `[b]aformat=channel_layouts=mono,dynaudnorm=f=75:p=0.95,volume=3,showwaves=s=${slot.w}x${slot.h}:mode=cline:rate=24:colors=0xFF6A3D:scale=sqrt[w];` +
      `[bg][w]overlay=${slot.x}:${slot.y}:shortest=1,format=yuv420p[v]`
    : `[0:v]scale=${STORY_W}:${STORY_H},setsar=1,format=yuv420p[v];[1:a]anull[a]`;
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
