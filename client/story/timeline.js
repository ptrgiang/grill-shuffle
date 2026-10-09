// Story timelines, pure (no DOM, no canvas): actor tracks and camera keys evaluated at a time t. Pantomime grammar
// (docs/STORY.md): positions ease between keys; a pose snaps in ~0.12 s and then holds.
//
// A track is a list of keys sorted by t: { t, x, face, pose, move?, prop?, set? }
//   move: true        the actor walks from the previous key's x to this one (walk pose while moving)
//   prop              overrides the pose's prop ('flyer' on 'read' = reading the flyer); null = empty hands
//   set               extra pose fields ({ noLanyard: 1 })
// Camera keys: { t, x, y, z } in stage units; `cut: true` jumps instead of panning.

export const SNAP = 0.12;

export const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

const withKey = (pose, k) => (k.prop !== undefined || k.set ? { ...pose, ...(k.prop !== undefined ? { prop: k.prop } : {}), ...k.set } : pose);

/**
 * Evaluate a track at time t -> { x, face, pose } (null before its first key).
 * `poses`: pose name -> pose; `blend(a, b, k)` mixes two poses during the snap.
 */
export function track(keys, t, poses, blend) {
  let i = -1;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  if (i < 0) return null;
  const k = keys[i], n = keys[i + 1], prev = keys[i - 1];
  if (n?.move) {
    const x = k.x + (n.x - k.x) * ease(clamp((t - k.t) / (n.t - k.t)));
    const walk = poses[n.walk ?? 'walk'];
    return { x, face: Math.sign(n.x - k.x) || k.face, pose: withKey(walk, n) };
  }
  let pose = withKey(poses[k.pose], k);
  if (prev && !k.move) pose = blend(withKey(poses[prev.pose], prev), pose, clamp((t - k.t) / SNAP));
  return { x: k.x, face: k.face, pose };
}

/** Camera at time t: eases toward each next key over at most 1.2 s, then holds. */
export function camAt(keys, t) {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  const k = keys[i], n = keys[i + 1];
  const prev = keys[i - 1];
  if (!prev || k.cut) return { x: k.x, y: k.y, z: k.z };
  const e = ease(clamp((t - k.t) / 1.2));
  return { x: prev.x + (k.x - prev.x) * e, y: prev.y + (k.y - prev.y) * e, z: prev.z + (k.z - prev.z) * e };
}
