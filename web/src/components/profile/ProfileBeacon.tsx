'use client';

import { useEffect } from 'react';
import { writeLocal } from '@/lib/local';
import { track } from '@/lib/track';

/** Counts the visit, and keeps the player's invite code so a follower who installs credits them. */
export function ProfileBeacon({ handle, invite }: { handle: string; invite: string | null }) {
  useEffect(() => {
    track('share_viewed', { kind: 'profile', handle });
    if (invite) writeLocal('invite', invite);
  }, [handle, invite]);
  return null;
}
