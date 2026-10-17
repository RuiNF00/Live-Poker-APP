// The top of a screen first, the rest a frame later. Long screens (years of
// sessions, a festival's whole schedule) take most of their first frame laying
// out charts and lists below the fold; drawing the numbers people came for
// first keeps a tap feeling instant on a mid-range phone.

import React, { useEffect, useState } from "react";
import { View } from "react-native";

/** False on the first frame, true once it has been drawn. */
export function useAfterFirstFrame(): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => setDone(true), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (t) clearTimeout(t);
    };
  }, []);
  return done;
}

/** Renders `children` after the first frame, and an empty block of `height` until then (so nothing jumps). */
export function Deferred({
  children,
  height = 0,
}: {
  children: React.ReactNode;
  height?: number;
}) {
  const done = useAfterFirstFrame();
  return done ? <>{children}</> : height ? <View style={{ height }} /> : null;
}
