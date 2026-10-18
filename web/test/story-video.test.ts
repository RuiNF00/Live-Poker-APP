import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ffmpegArgs, isMp4, parseDurations, parseFaceSlot, parseSlot, renderReplayVideo, renderStoryVideo, replayArgs } from '../src/lib/story-video';

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

describe('colour', () => {
  it('converts the RGB frames as BT.709 and tags the video so every player shows the same colours', () => {
    for (const args of [ffmpegArgs('f.png', 'v.m4a', 'o.mp4', null), replayArgs(['a.jpg', 'b.jpg'], [2, 2], null, 'o.mp4', null)]) {
      expect(args.join(' ')).toContain('out_color_matrix=bt709');
      for (const flag of ['-colorspace', '-color_primaries', '-color_trc']) expect(args[args.indexOf(flag) + 1]).toBe('bt709');
      expect(args[args.indexOf('-color_range') + 1]).toBe('tv');
    }
  });
});

describe('ffmpeg input hardening', () => {
  it('forces a demuxer per input and only local files', () => {
    const args = ffmpegArgs('/t/frame.png', '/t/voice.mp3', '/t/o.mp4', null);
    const before = (flag: string, value: string, input: string) => {
      const i = args.indexOf(input);
      return args.slice(0, i).lastIndexOf(flag) >= 0 && args[args.slice(0, i).lastIndexOf(flag) + 1] === value;
    };
    expect(before('-f', 'image2', '/t/frame.png')).toBe(true);
    expect(before('-c:v', 'png', '/t/frame.png')).toBe(true);
    expect(before('-f', 'mp3', '/t/voice.mp3')).toBe(true);
    expect(args.filter((a) => a === '-protocol_whitelist')).toHaveLength(2);
    expect(ffmpegArgs('f.png', 'v.m4a', 'o.mp4', null)).toContain('mov');
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

describe('parseDurations', () => {
  it('takes one sane duration per frame, 30 s at most in total', () => {
    expect(parseDurations([1, 1.5, 3], 3)).toEqual([1, 1.5, 3]);
    expect(parseDurations([1, 1], 3)).toBeNull();
    expect(parseDurations([0.1, 2], 2)).toBeNull();
    expect(parseDurations([12, 12, 12], 3)).toBeNull();
    expect(parseDurations(['1'], 1)).toBeNull();
  });
});

describe('replayArgs', () => {
  it('crossfades frames at their cumulative times and forces a demuxer per frame', () => {
    const args = replayArgs(['/t/a.jpg', '/t/b.jpg', '/t/c.jpg'], [1, 2, 3], null, '/t/o.mp4', null);
    const filter = args[args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('offset=1.00');
    expect(filter).toContain('offset=3.00');
    expect(filter).toContain('anullsrc');
    expect(args[args.indexOf('-t', args.indexOf('-filter_complex')) + 1]).toBe('6.00');
    expect(args.filter((a) => a === 'mjpeg')).toHaveLength(3);
    expect(args.filter((a) => a === '-protocol_whitelist')).toHaveLength(3);
  });
  it('draws the waveform over the voice only with a slot', () => {
    expect(replayArgs(['a.jpg'], [2], 'v.m4a', 'o.mp4', { x: 10, y: 20, w: 300, h: 60 }).join(' ')).toContain('showwaves=s=300x60');
    expect(replayArgs(['a.jpg'], [2], 'v.m4a', 'o.mp4', null).join(' ')).not.toContain('showwaves');
  });
});

describe('face clip', () => {
  it('takes a sane circle inside the frame only', () => {
    expect(parseFaceSlot({ x: 762, y: 180, d: 276 })).toEqual({ x: 762, y: 180, d: 276 });
    expect(parseFaceSlot({ x: 900, y: 180, d: 276 })).toBeNull();
    expect(parseFaceSlot({ x: 10, y: 10, d: 20 })).toBeNull();
    expect(parseFaceSlot({ x: 'a', y: 10, d: 200 })).toBeNull();
    expect(parseFaceSlot(null)).toBeNull();
  });
  it('only accepts MP4/QuickTime bytes', () => {
    expect(isMp4(new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20, 0]))).toBe(true);
    expect(isMp4(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
  });
  it('puts the face in a circle and uses its sound, not the voice note', () => {
    const args = replayArgs(['a.jpg'], [2], null, 'o.mp4', null, { file: 'f.mov', slot: { x: 762, y: 180, d: 276 } }).join(' ');
    expect(args).toContain('-f mov -i f.mov');
    expect(args).toContain('overlay=762:180');
    expect(args).toContain('[1:a]apad');
    expect(args).not.toContain('anullsrc');
  });
});

describe('renderReplayVideo', () => {
  it('renders the frames for the total of their durations, with or without voice', async () => {
    const ff = (process.env.FFMPEG_PATH || require('ffmpeg-static')) as string;
    const dir = mkdtempSync(path.join(os.tmpdir(), 'replay-test-'));
    const jpg = (c: string) => {
      const p = path.join(dir, c + '.jpg');
      execFileSync(ff, ['-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x${c}:s=1080x1920`, '-frames:v', '1', p]);
      return readFileSync(p);
    };
    const m4a = path.join(dir, 'v.m4a');
    execFileSync(ff, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', '-c:a', 'aac', m4a]);
    const frames = [jpg('0C1311'), jpg('141D1A'), jpg('FF6A3D')];
    const length = (mp4: Buffer) => {
      const out = path.join(dir, 'o.mp4');
      require('node:fs').writeFileSync(out, mp4);
      const log = require('node:child_process').spawnSync(ff, ['-i', out, '-f', 'null', '-'], { encoding: 'utf8' }).stderr as string;
      const m = /time=(\d+):(\d+):([\d.]+)/g;
      let last = 0;
      for (const x of log.matchAll(m)) last = +x[1] * 3600 + +x[2] * 60 + +x[3];
      return last;
    };
    const silent = await renderReplayVideo({ frames, durations: [1, 1, 2], voice: null, voiceExt: 'm4a', slot: null });
    expect(silent.subarray(4, 8).toString()).toBe('ftyp');
    expect(length(silent)).toBeCloseTo(4, 0);
    const voiced = await renderReplayVideo({ frames, durations: [1, 1, 2], voice: readFileSync(m4a), voiceExt: 'm4a', slot: { x: 648, y: 219, w: 342, h: 48 } });
    expect(length(voiced)).toBeCloseTo(4, 0);
    const mov = path.join(dir, 'face.mov');
    execFileSync(ff, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=480x360:d=3', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=3', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', mov]);
    const withFace = await renderReplayVideo({ frames, durations: [1, 1, 2], voice: null, voiceExt: 'm4a', slot: null, face: { bytes: readFileSync(mov), slot: { x: 762, y: 180, d: 276 } } });
    expect(length(withFace)).toBeCloseTo(4, 0);
    if (process.env.FACE_OUT) require('node:fs').writeFileSync(process.env.FACE_OUT, withFace);
  }, 60_000);
});
