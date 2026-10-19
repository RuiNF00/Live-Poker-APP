// Whether VoiceOver or TalkBack is on, kept current: timed things (an «Anular» that goes away)
// wait for a tap instead while it is.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
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
