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
        social: Share.Social.INSTAGRAM_STORIES,
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
