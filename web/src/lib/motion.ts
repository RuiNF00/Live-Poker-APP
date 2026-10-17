/** Smooth scrolling, or a jump when the viewer asked the system for reduced motion. */
export function scrollMode(): ScrollBehavior {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
