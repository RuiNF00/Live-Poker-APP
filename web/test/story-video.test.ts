import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ffmpegArgs, parseSlot, renderStoryVideo } from '../src/lib/story-video';

describe('parseSlot', () => {
  it('accepts a slot inside the frame and rounds to even sizes', () => {
    expect(parseSlot({ x: 642, y: 207, w: 371, h: 61 })).toEqual({ x: 642, y: 207, w: 372, h: 62 });
  });
  it('rejects slots outside the frame or malformed', () => {
    expect(parseSlot({ x: 900, y: 10, w: 300, h: 60 })).toBeNull();
    expect(parseSlot({ x: 'a', y: 10, w: 300, h: 60 })).toBeNull();
    expect(parseSlot(null)).toBeNull();
  });
});

describe('ffmpegArgs', () => {
  it('draws the waveform only when there is a slot', () => {
    expect(ffmpegArgs('f.png', 'v.m4a', 'o.mp4', { x: 10, y: 20, w: 300, h: 60 }).join(' ')).toContain('showwaves=s=300x60');
    expect(ffmpegArgs('f.png', 'v.m4a', 'o.mp4', null).join(' ')).not.toContain('showwaves');
  });
});

describe('renderStoryVideo', () => {
  it('renders an MP4 as long as the voice note', async () => {
    const ff = (process.env.FFMPEG_PATH || require('ffmpeg-static')) as string;
    const dir = mkdtempSync(path.join(os.tmpdir(), 'story-test-'));
    const png = path.join(dir, 'f.png');
    const m4a = path.join(dir, 'v.m4a');
    execFileSync(ff, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x0C1311:s=1080x1920', '-frames:v', '1', png]);
    execFileSync(ff, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', '-c:a', 'aac', m4a]);
    const mp4 = await renderStoryVideo({
      frame: readFileSync(png),
      voice: readFileSync(m4a),
      voiceExt: 'm4a',
      slot: { x: 642, y: 207, w: 372, h: 62 },
    });
    expect(mp4.subarray(4, 8).toString()).toBe('ftyp');
    const out = path.join(dir, 'o.mp4');
    require('node:fs').writeFileSync(out, mp4);
    const probe = execFileSync(ff, ['-i', out, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    expect(probe).toBeDefined();
    const plain = await renderStoryVideo({ frame: readFileSync(png), voice: readFileSync(m4a), voiceExt: 'm4a', slot: null });
    expect(plain.subarray(4, 8).toString()).toBe('ftyp');
  }, 60_000);
});
