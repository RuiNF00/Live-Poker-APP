/** True the first time for `key`, false after: a second tap on «Guardar» before the screen moves on does nothing. */
export function claimOnce(ref: { current: string | null }, key: string): boolean {
  if (ref.current === key) return false;
  ref.current = key;
  return true;
}
