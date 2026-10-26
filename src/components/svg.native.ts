// Phones: Hermes runs one bundle with no chunks, so react-native-svg is there from the
// first frame and every drawing renders as it always did. The web copy (svg.tsx) loads it later.

export { Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';

/** Already loaded on phones; kept so callers needn't know the platform. */
export function preloadSvg(): Promise<void> {
  return Promise.resolve();
}
