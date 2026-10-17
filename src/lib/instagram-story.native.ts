// Instagram Stories sharing. The story frame is captured from <StoryCard> at
// 1080×1920 and handed straight to Instagram's story editor with the hand's
// link pre-filled in a link sticker. Without a Meta app id, or without
// Instagram installed, it falls back to the system share sheet (Instagram
// still shows up there as "Stories"). Pro players can add their voice: the
// story then goes out as a video rendered by the share server.

import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type React from 'react';
import { Linking, Platform, type View } from 'react-native';
import type RNShare from 'react-native-share';
import type { Social } from 'react-native-share';
import { captureRef } from 'react-native-view-shot';

import { t } from '@/i18n';
import { API, uploadHand } from '@/lib/share-api';
import { appUserId } from '@/billing/purchases';
import type { ShareOptions } from '@/poker/privacy';
import type { Hand } from '@/poker/types';

// react-native-share is not in Expo Go, and importing it there throws. Load it
// on first use; without it, stories go out through the system share sheet.
let shareMod: typeof RNShare | null | undefined;
function nativeShare(): typeof RNShare | null {
  if (shareMod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      shareMod = (require('react-native-share') as { default: typeof RNShare }).default;
    } catch {
      shareMod = null;
    }
  }
  return shareMod;
}

/** Meta (Facebook) app id. Required by Instagram for direct story sharing since 2023. */
const META_APP_ID = process.env.EXPO_PUBLIC_META_APP_ID as string | undefined;

export const canShareStory = Platform.OS === 'ios' || Platform.OS === 'android';

/** Upload the hand once and return its public share id. */
export async function ensureShareId(hand: Hand, save: (h: Hand) => void, opts?: ShareOptions): Promise<string> {
  if (hand.shareId) return hand.shareId;
  const { id, token } = await uploadHand(hand, opts);
  save({ ...hand, shareId: id, shareToken: token });
  return id;
}

export async function captureStory(ref: React.RefObject<React.ComponentRef<typeof View> | null>): Promise<string> {
  return captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' });
}

async function instagramInstalled(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') return !!(await nativeShare()?.isPackageInstalled('com.instagram.android'))?.isInstalled;
    return await Linking.canOpenURL('instagram-stories://share');
  } catch {
    return false;
  }
}

export type StoryTarget = 'instagram' | 'sheet';

/**
 * Voice story: the server (web/src/app/api/story-video) lays the voice note over
 * the frame and draws a live waveform in `slot`. Returns a local MP4.
 */
export async function renderVoiceStory(frame: string, voice: string, slot: { x: number; y: number; w: number; h: number }): Promise<string> {
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for files on disk.
  form.append('frame', { uri: frame, name: 'frame.png', type: 'image/png' } as unknown as Blob);
  form.append('voice', { uri: voice, name: 'voice.m4a', type: 'audio/mp4' } as unknown as Blob);
  form.append('slot', JSON.stringify(slot));
  // The server checks the Pro entitlement for this RevenueCat user.
  const rcUserId = await appUserId();
  if (rcUserId) form.append('rcUserId', rcUserId);
  const res = await fetch(`${API}/api/story-video`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('story-video ' + res.status);
  const out = new File(Paths.cache, `sweatbook-story-${Date.now()}.mp4`);
  await out.write(new Uint8Array(await res.arrayBuffer()));
  return out.uri;
}

/** A transparent PNG of the session sticker, at 3x its size. */
export async function captureSticker(ref: React.RefObject<React.ComponentRef<typeof View> | null>, w: number, h: number): Promise<string> {
  return captureRef(ref, { format: 'png', quality: 1, width: w * 3, height: h * 3, result: 'tmpfile' });
}

/**
 * Opens Instagram's story editor with the sticker on top, so the player puts
 * it over a photo of the table. Falls back to the share sheet (save the PNG,
 * then add it as a sticker).
 */
export async function shareSticker(file: string, link: string): Promise<StoryTarget> {
  await Clipboard.setStringAsync(link).catch(() => {});
  const Share = nativeShare();
  if (Share && META_APP_ID && (await instagramInstalled())) {
    try {
      await Share.shareSingle({
        social: Share.Social.INSTAGRAM_STORIES as Social,
        appId: META_APP_ID,
        stickerImage: file,
        backgroundTopColor: '#0C1311',
        backgroundBottomColor: '#080E0C',
        linkUrl: link,
        attributionURL: link,
      });
      return 'instagram';
    } catch {
      // fall through to the share sheet
    }
  }
  await Sharing.shareAsync(file, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('Partilhar sticker') });
  return 'sheet';
}

/** One replay frame for the hand video. JPEG keeps a 20-frame upload under the server's limit. */
export async function captureFrame(ref: React.RefObject<React.ComponentRef<typeof View> | null>): Promise<string> {
  return captureRef(ref, { format: 'jpg', quality: 0.82, width: 1080, height: 1920, result: 'tmpfile' });
}

/**
 * Hand video (Reels, TikTok, WhatsApp status): the server (web/src/app/api/replay-video)
 * holds each frame for its duration with a crossfade, over the voice note when
 * there is one. Returns a local MP4.
 */
export async function renderReplayVideo(
  frames: string[],
  durations: number[],
  voice: string | null,
  slot: { x: number; y: number; w: number; h: number } | null,
): Promise<string> {
  const form = new FormData();
  frames.forEach((uri, i) => form.append('frame' + i, { uri, name: `f${i}.jpg`, type: 'image/jpeg' } as unknown as Blob));
  form.append('durations', JSON.stringify(durations));
  if (voice) {
    form.append('voice', { uri: voice, name: 'voice.m4a', type: 'audio/mp4' } as unknown as Blob);
    if (slot) form.append('slot', JSON.stringify(slot));
    const rcUserId = await appUserId();
    if (rcUserId) form.append('rcUserId', rcUserId);
  }
  const res = await fetch(`${API}/api/replay-video`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('replay-video ' + res.status);
  const out = new File(Paths.cache, `sweatbook-mao-${Date.now()}.mp4`);
  await out.write(new Uint8Array(await res.arrayBuffer()));
  return out.uri;
}

/** The system share sheet: Reels, TikTok, WhatsApp and the rest pick up an MP4 from here. */
export async function shareVideo(file: string, link: string): Promise<void> {
  await Clipboard.setStringAsync(link).catch(() => {});
  await Sharing.shareAsync(file, { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: t('Partilhar vídeo da mão') });
}

/**
 * Opens Instagram's story editor with the image. The link is also copied, so
 * if Instagram drops the pre-filled sticker the player pastes it into a Link
 * sticker in one tap.
 */
export async function shareStory(file: string, link: string, kind: 'image' | 'video' = 'image'): Promise<StoryTarget> {
  await Clipboard.setStringAsync(link).catch(() => {});
  const Share = nativeShare();
  if (Share && META_APP_ID && (await instagramInstalled())) {
    try {
      await Share.shareSingle({
        social: Share.Social.INSTAGRAM_STORIES as Social,
        appId: META_APP_ID,
        ...(kind === 'video' ? { backgroundVideo: file } : { backgroundImage: file }),
        linkUrl: link,
        linkText: t('Vota aqui'),
        attributionURL: link,
      });
      return 'instagram';
    } catch {
      // fall through to the share sheet
    }
  }
  await Sharing.shareAsync(
    file,
    kind === 'video'
      ? { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: t('Partilhar história') }
      : { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('Partilhar história') },
  );
  return 'sheet';
}
