// URL <-> screen, pure (no DOM): `story` is the play order (content.js STORY).
//   /                 menu
//   /levels           level select
//   /level/<n>        story level n (1-based play position, the number shown on screen)
//   /play             the next unfinished story level
//   /play/<id>        old id URL: opens the level, the client rewrites it to /level/<n>
//   /daily            today's daily puzzle
//   /p/<code>         shared challenge (story codes go through the share index, not the play order)

/** -> { name, id?, code?, missing? } */
export function parseRoute(path, story) {
  const p = path.replace(/\/+$/, '') || '/';
  let m;
  if (p === '/') return { name: 'menu' };
  if (p === '/levels') return { name: 'levels' };
  if (p === '/daily') return { name: 'daily' };
  if (p === '/play') return { name: 'play' };
  if ((m = /^\/level\/(\d{1,4})$/.exec(p))) {
    const id = story[Number(m[1]) - 1];
    return id ? { name: 'play', id } : { name: 'play', missing: true };
  }
  if ((m = /^\/play\/([a-z0-9-]+)$/.exec(p))) return { name: 'play', id: m[1] };
  if ((m = /^\/p\/([A-Za-z0-9-]+)$/.exec(p))) return { name: 'code', code: m[1] };
  return { name: 'menu' };
}

/** Canonical URL of a story level, or null when the id is not in the story. */
export function levelPath(story, id) {
  const i = story.indexOf(id);
  return i >= 0 ? `/level/${i + 1}` : null;
}
