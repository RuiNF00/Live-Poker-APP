// The session summary asks for at most two things at once (Design): a pile of cards after a long
// session reads as noise and none gets done. The ones that can't wait come first: marked hands
// while they're fresh, half-saved hands before they're forgotten; then Pro, then the next day.

export type SummaryPrompt = 'review' | 'unfinished' | 'pro' | 'nextPlay';

const ORDER: readonly SummaryPrompt[] = ['review', 'unfinished', 'pro', 'nextPlay'];
export const SUMMARY_PROMPTS_MAX = 2;

/** Which of the prompts that apply to this summary are shown. */
export function summaryPrompts(apply: Partial<Record<SummaryPrompt, boolean>>, max = SUMMARY_PROMPTS_MAX): Set<SummaryPrompt> {
  return new Set(ORDER.filter((k) => apply[k]).slice(0, max));
}
