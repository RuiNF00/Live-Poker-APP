// A random id kept as a plain string under its own key (the referral code, the commenter id).
// Pure over the storage, so what older builds saved can be read in the tests.

interface KV {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}

/** The saved id, as it was saved; a new one (kept from now on) only when there is none. */
export async function keptOrNew(kv: KV, key: string, make: () => string): Promise<string> {
  const v = await kv.getItem(key);
  if (v) return v;
  const id = make();
  await kv.setItem(key, id);
  return id;
}
