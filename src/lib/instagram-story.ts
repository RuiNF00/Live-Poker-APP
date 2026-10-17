// Web build: Instagram's story editor is only reachable from the phone apps,
// so the story screen shows a preview and asks to open the app instead.
// The real implementation is instagram-story.native.ts (same exports).

import type React from 'react';
import type { View } from 'react-native';

import { uploadHand } from '@/lib/share-api';
import type { ShareOptions } from '@/poker/privacy';
import type { Hand } from '@/poker/types';

export const canShareStory = false;

export async function ensureShareId(hand: Hand, save: (h: Hand) => void, opts?: ShareOptions): Promise<string> {
  if (hand.shareId) return hand.shareId;
  const { id, token } = await uploadHand(hand, opts);
  save({ ...hand, shareId: id, shareToken: token });
  return id;
}

export async function captureStory(_ref: React.RefObject<React.ComponentRef<typeof View> | null>): Promise<string> {
  throw new Error('Story capture needs the iOS or Android app');
}

export type StoryTarget = 'instagram' | 'sheet';

export async function renderVoiceStory(_frame: string, _voice: string, _slot: { x: number; y: number; w: number; h: number }): Promise<string> {
  throw new Error('Voice stories need the iOS or Android app');
}

export async function shareStory(_file: string, _link: string, _kind: 'image' | 'video' = 'image'): Promise<StoryTarget> {
  throw new Error('Story sharing needs the iOS or Android app');
}

export async function captureFrame(_ref: React.RefObject<React.ComponentRef<typeof View> | null>): Promise<string> {
  throw new Error('Hand videos need the iOS or Android app');
}

export async function renderReplayVideo(
  _frames: string[],
  _durations: number[],
  _voice: string | null,
  _slot: { x: number; y: number; w: number; h: number } | null,
): Promise<string> {
  throw new Error('Hand videos need the iOS or Android app');
}

export async function shareVideo(_file: string, _link: string): Promise<void> {
  throw new Error('Hand videos need the iOS or Android app');
}

export async function captureSticker(_ref: React.RefObject<React.ComponentRef<typeof View> | null>, _w: number, _h: number): Promise<string> {
  throw new Error('Stickers need the iOS or Android app');
}

export async function shareSticker(_file: string, _link: string): Promise<StoryTarget> {
  throw new Error('Stickers need the iOS or Android app');
}
