/**
 * A hand saves itself on the tap that ends it: `before` is whether it was already over before this change
 * (null on opening). A reopened draft that opened already over (hero had folded) waits for «Guardar».
 */
export function endsNow(before: boolean | null, over: boolean): boolean {
  return before === false && over;
}
