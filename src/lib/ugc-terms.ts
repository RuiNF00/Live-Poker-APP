// The one-time «Aceito» before anything the player publishes for others to read: the first
// comment, the first public hand link, the public profile (App Store 1.2: users agree to terms
// with no tolerance for objectionable content or abusive users before they can post). Kept apart
// from React Native so it can be tested; the sheet that asks is useUgcTerms.

export const UGC_TERMS_KEY = "rl.ugc-terms.v1";

interface Kv {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}

export function ugcTerms(kv: Kv) {
  let accepted = false;
  let pending: Promise<boolean> | null = null;

  async function run(ask: () => Promise<boolean>): Promise<boolean> {
    if (accepted) return true;
    if (await kv.getItem(UGC_TERMS_KEY).catch(() => null))
      return (accepted = true);
    if (!(await ask())) return false;
    accepted = true;
    await kv.setItem(UGC_TERMS_KEY, String(Date.now())).catch(() => {});
    return true;
  }

  return {
    /** True once the player accepted; `ask` shows the sheet (one at a time). False when they closed it. */
    accept(ask: () => Promise<boolean>): Promise<boolean> {
      pending ??= run(ask).finally(() => (pending = null));
      return pending;
    },
    /** After «Apagar todos os meus dados»: the key is gone, so the next post asks again. */
    forget() {
      accepted = false;
    },
  };
}
