// Where the board may draw: the screen minus what the HUD / menu covers, measured from the real DOM after layout
// (never fixed pixel guesses), so short phones, landscape and notches all leave the board the largest free area.

/** Phones held sideways: the HUD moves into side columns (style.css uses the same query). */
export const SHORT_LANDSCAPE = '(orientation: landscape) and (max-height: 520px)';
export const isShortLandscape = () => typeof matchMedia === 'function' && matchMedia(SHORT_LANDSCAPE).matches;

/**
 * Pure. Margins (px) that keep the board clear of every rect in `edges`: rects in `top` push the top margin below
 * them, `bottom` above them, `left` / `right` sideways. `base` is the minimum on each side; `gap` the breathing room.
 * Hidden rects (zero size) are ignored.
 */
export function marginsFrom(W, H, { top = [], bottom = [], left = [], right = [] }, base, gap = 8) {
  const shown = (r) => r && r.width > 0 && r.height > 0;
  const m = { ...base };
  for (const r of top.filter(shown)) m.marginTop = Math.max(m.marginTop, r.bottom + gap);
  for (const r of bottom.filter(shown)) m.marginBottom = Math.max(m.marginBottom, H - r.top + gap);
  for (const r of left.filter(shown)) m.marginLeft = Math.max(m.marginLeft, r.right + gap);
  for (const r of right.filter(shown)) m.marginRight = Math.max(m.marginRight, W - r.left + gap);
  return m;
}

/** The device's safe-area insets in px (notch, home indicator, rounded corners). */
export function safeInsets() {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.append(p);
  const cs = getComputedStyle(p);
  const out = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  p.remove();
  return out;
}

/** Minimum margins: the safe area plus a little room. */
export function baseMargins(side = 10, edge = 8) {
  const s = safeInsets();
  return { marginTop: s.top + edge, marginBottom: s.bottom + edge, marginLeft: s.left + side, marginRight: s.right + side };
}

export const rects = (root, selector) => [...root.querySelectorAll(selector)].map((e) => e.getBoundingClientRect());
