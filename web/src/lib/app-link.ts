'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/config/brand';

/**
 * A link that opens the app at `path` (e.g. "h/abc?r=CODE"). On Android it is an intent:// link:
 * Instagram's and Facebook's in-app browsers drop a bare sweatbook:// link, but hand an intent to
 * the system, and Chrome sends it to the Play Store when the app isn't installed.
 */
export function appHref(path: string, android: boolean): string {
  if (!android) return `${brand.appScheme}://${path}`;
  return `intent://${path}#Intent;scheme=${brand.appScheme};package=${brand.androidPackage};end`;
}

/** After hydration (the server can't know the phone): true on Android. */
export function useAndroid(): boolean {
  const [android, setAndroid] = useState(false);
  useEffect(() => setAndroid(/Android/i.test(navigator.userAgent)), []);
  return android;
}
