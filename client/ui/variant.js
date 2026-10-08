// Design variants (CONTRIBUTING.md step 0): a UI change is prototyped as numbered variants behind `?variant=<n>`,
// captured with `npm run variant-shots`, and the owner picks one in the issue. Prototypes read the number here and
// nowhere else; once the pick is implemented its branch drops the switch. 0 = no variant (the shipped look).
export const MAX_VARIANT = 9;

let current = 0;
let query = '';

/**
 * The variant of this page load (0 when none). `set`: one of several decisions in the same issue
 * (`npm run variant-shots -- --set font` puts `v-font=<n>` in the query).
 */
export const variant = (set) => (set ? variantFrom(query, `v-${set}`) : current);

/** The requested variant 1..9 from a query string, else 0. */
export function variantFrom(search, param = 'variant') {
  const v = Number(new URLSearchParams(search ?? '').get(param));
  return Number.isInteger(v) && v >= 1 && v <= MAX_VARIANT ? v : 0;
}

/** The variant of this page load (read once at boot) and `data-variant` on <html> so CSS prototypes can switch too. */
export function initVariant(loc = globalThis.location, root = globalThis.document?.documentElement) {
  query = loc?.search ?? '';
  const v = variantFrom(query);
  current = v;
  if (v && root) root.dataset.variant = String(v);
  return v;
}

