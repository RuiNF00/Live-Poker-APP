// Instagram Stories sharing. The story frame is captured from <StoryCard> at
// 1080×1920 and handed straight to Instagram's story editor with the hand's
// link pre-filled in a link sticker. Without a Meta app id, or without
// Instagram installed, it falls back to the system share sheet (Instagram
// still shows up there as "Stories").

import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import type React from 'react';
import { Linking, Platform, type View } from 'react-native';
import Share, { Social } from 'react-native-share';
import { captureRef } from 'react-native-view-shot';

import { shareUrl, uploadHand } from '@/lib/share-api';
import type { Hand } from '@/poker/types';

/** Meta (Facebook) app id. Required by Instagram for direct story sharing since 2023. */
const META_APP_ID = process.env.EXPO_PUBLIC_META_APP_ID as string | undefined;

export const canShareStory = Platform.OS === 'ios' || Platform.OS === 'android';

/** Upload the hand once and return its public link. */
export async function ensureShareLink(hand: Hand, save: (h: Hand) => void): Promise<string> {
  if (hand.shareId) return shareUrl(hand.shareId);
  const { id, token } = await uploadHand(hand);
  save({ ...hand, shareId: id, shareToken: token });
  return shareUrl(id);
}

export async function captureStory(ref: React.RefObject<React.ComponentRef<typeof View> | null>): Promise<string> {
  return captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' });
}

async function instagramInstalled(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') return (await Share.isPackageInstalled('com.instagram.android')).isInstalled;
    return await Linking.canOpenURL('instagram-stories://share');
  } catch {
    return false;
  }
}

export type StoryTarget = 'instagram' | 'sheet';

/**
 * Opens Instagram's story editor with the image. The link is also copied, so
 * if Instagram drops the pre-filled sticker the player pastes it into a Link
 * sticker in one tap.
 */
export async function shareStory(file: string, link: string): Promise<StoryTarget> {
  await Clipboard.setStringAsync(link).catch(() => {});
  if (META_APP_ID && (await instagramInstalled())) {
    try {
      await Share.shareSingle({
        social: Social.InstagramStories,
        appId: META_APP_ID,
        backgroundImage: file,
        linkUrl: link,
        linkText: 'Vota aqui',
        attributionURL: link,
      });
      return 'instagram';
    } catch {
      // fall through to the share sheet
    }
  }
  await Sharing.shareAsync(file, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Partilhar história' });
  return 'sheet';
}
