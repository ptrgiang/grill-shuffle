// Page actions shared by the screenshot scripts (shot.js, pr-shots.js). Game pages only (window.__gs).

/** Tap (touch) the first food that has somewhere to go and at least one grill it cannot go to, else any movable food. */
export async function tapSelect(page) {
  const at = await page.evaluate(() => {
    const { app, view } = window.__gs;
    const s = app.session;
    let pick = null;
    s.state.grills.forEach((g, gi) =>
      g.slots.forEach((it, si) => {
        if (!it || !s.canPick(gi, si)) return;
        const n = s.targetsFor({ grill: gi, slot: si }).length;
        const score = n > 0 ? (n < s.state.grills.length - 1 ? 2 : 1) : 0;
        if (!pick || score > pick.score) pick = { gi, si, score };
      }),
    );
    return pick && view.slotScreen(pick.gi, pick.si, 0.3);
  });
  if (at) await page.touchscreen.tap(at.x, at.y);
  return !!at;
}
