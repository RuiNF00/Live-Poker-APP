// The one-time «Aceito» before anything the player publishes for others to read: the first
// comment, the first public hand link, the public profile (App Store 1.2: users agree to terms
// with no tolerance for objectionable content or abusive users before they can post). Kept apart
// from React Native so it can be tested; the sheet that asks is UgcTermsHost.

export const UGC_TERMS_KEY = 'rl.ugc-terms.v1';

interface Kv {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}

/** `ask` shows the sheet and resolves with the answer; null while no sheet is mounted. */
export function ugcTerms(kv: Kv) {
  let accepted = false;
  let ask: (() => Promise<boolean>) | null = null;
  let pending: Promise<boolean> | null = null;

  async function run(): Promise<boolean> {
    if (accepted) return true;
    if (await kv.getItem(UGC_TERMS_KEY).catch(() => null)) return (accepted = true);
    // No sheet to ask with: nothing gets published without the «Aceito».
    if (!ask) return false;
    if (!(await ask())) return false;
    accepted = true;
    await kv.setItem(UGC_TERMS_KEY, String(Date.now())).catch(() => {});
    return true;
  }

  return {
    setAsker(a: (() => Promise<boolean>) | null) {
      ask = a;
    },
    /** True once the player accepted (asked at most once at a time); false when they said no. */
    accept(): Promise<boolean> {
      pending ??= run().finally(() => (pending = null));
      return pending;
    },
    /** After «Apagar todos os meus dados»: the key is gone, so the next post asks again. */
    forget() {
      accepted = false;
    },
  };
}
