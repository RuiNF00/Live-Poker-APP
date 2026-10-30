// Whether VoiceOver or TalkBack is on, kept current: timed things (an «Anular» that goes away)
// wait for a tap instead while it is.

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // react-native-web always answers true, which would keep every «Anular» on screen for everyone.
    if (Platform.OS === 'web') return;
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => live && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

/**
 * Said once the new screen has settled. VoiceOver reads the new screen first and drops an
 * announcement made during the change, so it waits and joins the queue. Returns the cancel.
 */
export function announceAfterChange(message: string): () => void {
  if (Platform.OS === 'web') return () => {};
  const id = setTimeout(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    else AccessibilityInfo.announceForAccessibility(message);
  }, 700);
  return () => clearTimeout(id);
}
