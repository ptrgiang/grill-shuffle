// Staging of each story beat (content/story/*.json ids) as pantomime: who stands where, which pose when, the camera,
// the scene's state. Text (title, line) comes from the content files; this is only the motion. A beat without staging
// here falls back to a still of the cart (new content can ship before its scene is drawn).
//
// Stage: 400 × 300 units, ground at y 250 (scene.js). Times in seconds. `panels`: three moments for the recap
// ("memories") and reduced motion (anticipation, action, reaction).
import { STAGE } from './scene.js';
import { track } from './timeline.js';
import { POSES, blendPose } from './rig.js';
import { inset, window01, phoneCard, photoCard } from './insets.js';

const G = STAGE.ground;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const at = (keys, t) => track(keys, t, POSES, blendPose);
// Mực on the ground beside the cart (owner, 2026-10-09: not on the grill); `rolling`: he trots along
const onCart = (x, rolling = false) => ({ x: x + 62, y: G, pose: rolling ? 'walk' : 'sit', face: rolling ? 1 : -1 });

// owner pick (#82: 3 + 2): Út walks in on the phone, Bà Năm's missed calls; the cart under a tarp; Út pulls it off, the
// string lights come on, her postcard was under it
const COLD_UT = [
  { t: 1.6, x: -40, face: 1, pose: 'phone' },
  { t: 5.6, x: 108, face: 1, pose: 'phone', move: true },
  { t: 9.6, x: 108, face: 1, pose: 'stand' },
  { t: 10.2, x: 108, face: 1, pose: 'reach' },
  { t: 12, x: 108, face: 1, pose: 'stand' },
  { t: 12.8, x: 150, face: 1, pose: 'reach', move: true },
  { t: 13.4, x: 150, face: 1, pose: 'read' },
  { t: 15.6, x: 150, face: -1, pose: 'read' },
  { t: 16.2, x: 150, face: -1, pose: 'shock' },
  { t: 17, x: 150, face: -1, pose: 'slump' },
];
const TARP = [10.4, 12]; // pulled off between these (s)

const PAGE_UT = [
  { t: 0, x: 160, face: 1, pose: 'stand', set: { noLanyard: 1 } },
  { t: 1.8, x: 160, face: 1, pose: 'take', prop: 'page', set: { noLanyard: 1 } },
  { t: 2.6, x: 160, face: 1, pose: 'read', prop: 'page', set: { noLanyard: 1 } },
  { t: 4.6, x: 160, face: 1, pose: 'smile', set: { noLanyard: 1 } },
  { t: 6, x: 140, face: 1, pose: 'push', set: { noLanyard: 1 } },
  { t: 11.6, x: 470, face: 1, pose: 'push', move: true, walk: 'pushWalk', set: { noLanyard: 1 } },
];
const pageCart = (t) => (t < 6 ? 196 : at(PAGE_UT, t).x + 56); // Út takes the handle at 6 s

const ARRIVE_UT = [
  { t: 0, x: -120, face: 1, pose: 'push' },
  { t: 5, x: 100, face: 1, pose: 'push', move: true, walk: 'pushWalk' },
  { t: 5.6, x: 100, face: 1, pose: 'stand' },
  { t: 6.4, x: 100, face: 1, pose: 'smile' },
];
const arriveCart = (t) => (at(ARRIVE_UT, t)?.x ?? -120) + 56;

export const BEATS = {
  // the empty alley at dusk: Bà Năm's missed calls, the cart under its tarp, the postcard, the notice on the wall (18 s)
  'street.cold-open': {
    length: 18,
    panels: [7.4, 11.2, 16.8],
    linesAt: 13.4, // her words when Út reads the postcard
    cam: [{ t: 0, x: 200, y: 150, z: 1 }, { t: 4.8, x: 165, y: 175, z: 1.3 }, { t: 9.8, x: 182, y: 175, z: 1.25 }, { t: 13.6, x: 200, y: 190, z: 1.55 }, { t: 17.4, x: 195, y: 165, z: 1.12 }],
    actors: [{ who: 'ut', keys: COLD_UT }],
    cat: (t) => (t < 13.6 ? null : t < 14.6 ? { x: 330 - (t - 13.6) * 72, y: G, pose: 'walk', face: -1 } : onCart(196)), // Mực trots in and sits by the cart
    scene: (t) => ({ lightsFrom: TARP[0] + 0.5, glow: t < TARP[0] ? 0.3 : 0.35, postcardOnCart: t > 11.2 && t < 13.4, tarp: clamp01((t - TARP[0]) / (TARP[1] - TARP[0])), ringing: t > 4.4 && t < 9.4 ? 108 : null }),
    // the phone close-up: her name, five missed calls, a sixth ringing out
    inset: (ctx, t, w, h) => inset(ctx, w, h, window01(t, 4.4, 9.4), phoneCard, { ratio: 1.2, tilt: 0.04 }),
  },
  // the notebook opens: the missing pages
  'street.notebook': {
    length: 7,
    panels: [1.8, 3.8, 5.8],
    cam: [{ t: 0, x: 195, y: 190, z: 1.5 }],
    actors: [{ who: 'ut', keys: [
      { t: 0, x: 150, face: 1, pose: 'stand' },
      { t: 0.8, x: 150, face: 1, pose: 'reach' },
      { t: 1.5, x: 150, face: 1, pose: 'read', prop: 'notebook' },
      { t: 3.4, x: 150, face: 1, pose: 'shock', prop: 'notebook' },
      { t: 5, x: 150, face: 1, pose: 'smile', prop: 'notebook' },
    ] }],
    cat: () => onCart(196),
    scene: () => ({ lightsFrom: -5, glow: 0.5, phone: 'buzz' }),
  },
  // level 10: Út burns a skewer; Cô Sáu shows the woven fan; the phone face-down
  'street.fan': {
    length: 8,
    panels: [1.2, 3.9, 6.4],
    cam: [{ t: 0, x: 205, y: 185, z: 1.35 }, { t: 5, x: 200, y: 180, z: 1.45 }],
    actors: [
      { who: 'co-sau', keys: [{ t: 0.9, x: 430, face: -1, pose: 'stand' }, { t: 2.6, x: 252, face: -1, pose: 'point', move: true }, { t: 3.3, x: 252, face: -1, pose: 'fan' }] },
      { who: 'ut', keys: [{ t: 0, x: 150, face: 1, pose: 'cough' }, { t: 3.6, x: 150, face: 1, pose: 'stand' }, { t: 5.2, x: 150, face: 1, pose: 'smile' }] },
    ],
    cat: () => ({ x: 304, y: G - 26, pose: 'sit', face: -1 }),
    scene: (t) => ({ lightsFrom: -5, glow: Math.min(1, Math.max(0, (t - 3.3) / 1.6)) * 0.6 + 0.12, phone: 'dark' }),
  },
  // level 20: the regulars come back; Út forgets the phone all evening
  'street.regulars': {
    length: 8,
    panels: [1.4, 3.4, 6],
    cam: [{ t: 0, x: 228, y: 190, z: 1.25 }],
    actors: [
      { who: 'regular-a', keys: [{ t: 0, x: 298, face: -1, pose: 'sit' }, { t: 3, x: 298, face: -1, pose: 'eat' }] },
      { who: 'regular-b', keys: [{ t: 0.5, x: 440, face: -1, pose: 'stand' }, { t: 2.5, x: 318, face: -1, pose: 'wave', move: true }, { t: 4, x: 318, face: -1, pose: 'smile' }] },
      { who: 'ut', keys: [{ t: 0, x: 150, face: 1, pose: 'stand' }, { t: 1.2, x: 150, face: 1, pose: 'serve' }, { t: 3, x: 150, face: 1, pose: 'smile' }, { t: 5.5, x: 150, face: 1, pose: 'nod' }] },
    ],
    cat: () => ({ x: 236, y: G - 25, pose: 'sleep', face: -1 }), // asleep on Út's laptop bag, left on the ground all evening
    scene: () => ({ lightsFrom: -5, glow: 0.6, phone: 'dark', laptopBag: 236 }),
  },
  // level 30: Khang's tasting visit; his flyer carries Út's own slogan
  'street.flyer': {
    length: 8,
    panels: [2, 3.6, 5.4],
    cam: [{ t: 0, x: 212, y: 188, z: 1.3 }, { t: 4.4, x: 205, y: 186, z: 1.4 }],
    actors: [
      { who: 'khang', keys: [{ t: 0, x: 440, face: -1, pose: 'stand' }, { t: 2.2, x: 274, face: -1, pose: 'give', prop: 'flyer', move: true }, { t: 3, x: 274, face: -1, pose: 'nod', prop: null }] },
      { who: 'ut', keys: [{ t: 0, x: 150, face: 1, pose: 'stand' }, { t: 2.6, x: 150, face: 1, pose: 'take', prop: 'flyer' }, { t: 3.2, x: 150, face: 1, pose: 'read', prop: 'flyer' }, { t: 4.6, x: 150, face: 1, pose: 'shock', prop: 'flyer' }, { t: 6.2, x: 150, face: 1, pose: 'slump', prop: 'flyer' }] },
    ],
    cat: () => onCart(196),
    scene: (t) => ({ lightsFrom: -5, glow: 0.5, phone: t > 4.6 ? 'buzz' : null }),
  },
  // level 40: the lanyard on Cô Sáu's nail; the phone rings out
  'street.lanyard': {
    length: 8,
    panels: [1.8, 3.2, 6],
    cam: [{ t: 0, x: 135, y: 180, z: 1.4 }],
    actors: [
      { who: 'co-sau', keys: [{ t: 0, x: 62, face: 1, pose: 'stand' }, { t: 3.4, x: 62, face: 1, pose: 'nod' }] },
      { who: 'ut', keys: [
        { t: 0, x: 140, face: -1, pose: 'stand' },
        { t: 1.6, x: 140, face: -1, pose: 'hang' },
        { t: 2.6, x: 140, face: -1, pose: 'stand', set: { noLanyard: 1 } },
        { t: 4, x: 140, face: -1, pose: 'smile', set: { noLanyard: 1 } },
      ] },
    ],
    cat: () => null,
    scene: (t) => ({ lightsFrom: -5, glow: 0.5, lanyardOnNail: t >= 2.6, phone: t < 5 ? 'buzz' : 'dark' }),
  },
  // level 50: Cô Sáu gives the first page; Út pushes the cart out of the alley at dawn
  'street.first-page': {
    length: 12,
    panels: [1.6, 3.4, 9],
    cam: [{ t: 0, x: 205, y: 185, z: 1.3 }, { t: 6.6, x: 290, y: 175, z: 1.1 }],
    actors: [
      { who: 'co-sau', keys: [{ t: 0, x: 250, face: -1, pose: 'stand' }, { t: 1, x: 250, face: -1, pose: 'give', prop: 'page' }, { t: 2.6, x: 250, face: -1, pose: 'nod' }, { t: 7, x: 250, face: 1, pose: 'wave' }] },
      { who: 'ut', keys: PAGE_UT },
    ],
    cat: (t) => onCart(pageCart(t), t > 6),
    scene: (t) => ({ dawn: true, glow: 0.3, cartX: pageCart(t) }),
    // tucked in the page: young Bà Năm on her father's boat, the clue to the coast
    inset: (ctx, t, w, h) => inset(ctx, w, h, window01(t, 2.8, 5.6), (c, cw, ch) => photoCard(c, cw, ch, t), { ratio: 0.8, tilt: 0.05 }),
  },
  // Fishing Village: arrival; Chú Tư by the boats: "she was here last week"
  'beach.arrival': {
    length: 10,
    beach: true,
    panels: [2.5, 5.8, 8],
    cam: [{ t: 0, x: 182, y: 190, z: 1.25 }],
    actors: [
      { who: 'chu-tu', keys: [{ t: 0, x: 262, face: -1, pose: 'stand' }, { t: 5.6, x: 262, face: -1, pose: 'wave' }, { t: 7.5, x: 262, face: -1, pose: 'nod' }] },
      { who: 'ut', keys: ARRIVE_UT },
    ],
    cat: (t) => onCart(arriveCart(t), t < 5),
    scene: (t) => ({ cartX: arriveCart(t), glow: 0.3 }),
  },
};

// Fishing Village, level 20 (style: past): Chú Tư remembers a girl selling her father's catch at dawn
BEATS['beach.fish-seller'] = {
  length: 9,
  beach: true,
  cart: false,
  panels: [2, 5.4, 7.6],
  cam: [{ t: 0, x: 225, y: 185, z: 1.2 }, { t: 5, x: 220, y: 190, z: 1.3 }],
  actors: [{ who: 'ba-nam-young', keys: [
    { t: 0, x: 440, face: -1, pose: 'carry' },
    { t: 5, x: 272, face: -1, pose: 'carry', move: true, walk: 'carryWalk' },
    { t: 6.6, x: 272, face: 1, pose: 'carry' },
  ] }],
  cat: () => null,
  scene: () => ({}),
};

// Fishing Village, level 10: Chú Tư points out the old boat with painted eyes
BEATS['beach.boat'] = {
  length: 7,
  beach: true,
  panels: [1.6, 3.2, 5.4],
  cam: [{ t: 0, x: 225, y: 188, z: 1.3 }],
  actors: [
    { who: 'chu-tu', keys: [{ t: 0, x: 258, face: -1, pose: 'stand' }, { t: 1.2, x: 258, face: -1, pose: 'point', prop: null }, { t: 3.8, x: 258, face: 1, pose: 'nod' }] },
    { who: 'ut', keys: [{ t: 0, x: 304, face: -1, pose: 'stand' }, { t: 2, x: 304, face: -1, pose: 'shock', prop: null }, { t: 4.4, x: 304, face: -1, pose: 'smile' }] },
  ],
  cat: () => ({ x: 150, y: 208, pose: 'sit', face: 1 }),
  scene: () => ({ cartX: 420 }),
};

// level 30: the storm; Út helps haul the boat up the sand
const STORM_BOAT = (t) => -Math.min(1, Math.max(0, (t - 1.2) / 4.4)) * 34;
BEATS['beach.storm'] = {
  length: 8,
  beach: true,
  panels: [1.2, 3.6, 6.4],
  cam: [{ t: 0, x: 215, y: 185, z: 1.25 }],
  actors: [
    { who: 'chu-tu', keys: [{ t: 0, x: 252, face: -1, pose: 'push' }, { t: 6, x: 252, face: -1, pose: 'nod' }] },
    { who: 'ut', keys: [{ t: 0, x: 300, face: -1, pose: 'stand' }, { t: 0.8, x: 290, face: -1, pose: 'push', move: true }, { t: 6.2, x: 290, face: -1, pose: 'smile' }] },
  ],
  cat: () => null,
  scene: (t) => ({ storm: true, boatX: STORM_BOAT(t), cartX: 460 }),
};

// level 40: Khang wants the whole catch for the tower; Chú Tư waves him off and keeps a basket for Út
BEATS['beach.khang'] = {
  length: 8,
  beach: true,
  panels: [2, 4.4, 6.4],
  cam: [{ t: 0, x: 220, y: 188, z: 1.25 }],
  actors: [
    { who: 'khang', keys: [{ t: 0, x: 440, face: -1, pose: 'stand' }, { t: 2, x: 306, face: -1, pose: 'give', prop: null, move: true }, { t: 4, x: 306, face: -1, pose: 'stand' }] },
    { who: 'chu-tu', keys: [{ t: 0, x: 240, face: 1, pose: 'stand' }, { t: 2.6, x: 240, face: 1, pose: 'wave' }, { t: 4, x: 240, face: -1, pose: 'give', prop: 'basket' }, { t: 5, x: 240, face: -1, pose: 'nod' }] },
    { who: 'ut', keys: [{ t: 0, x: 168, face: 1, pose: 'stand' }, { t: 4.6, x: 168, face: 1, pose: 'take', prop: 'basket' }, { t: 5.6, x: 168, face: 1, pose: 'smile', prop: 'basket' }] },
  ],
  cat: () => onCart(90),
  scene: () => ({ cartX: 90 }),
};

// level 50: the second page, a tiny paper lantern folded in it; Út pushes the cart on toward Lantern Town
const PAGE2_UT = [
  { t: 0, x: 170, face: 1, pose: 'stand' },
  { t: 1.8, x: 170, face: 1, pose: 'take', prop: 'lanternPage' },
  { t: 2.6, x: 170, face: 1, pose: 'read', prop: 'lanternPage' },
  { t: 4.6, x: 170, face: 1, pose: 'smile' },
  { t: 6, x: 64, face: 1, pose: 'push', move: true }, // walks back to the cart's handle (cart at 120 = 64 + 56)
  { t: 11, x: 470, face: 1, pose: 'push', move: true, walk: 'pushWalk' },
];
const page2Cart = (t) => (t < 6 ? 120 : at(PAGE2_UT, t).x + 56);
BEATS['beach.second-page'] = {
  length: 11,
  beach: true,
  panels: [1.4, 3.4, 8.6],
  cam: [{ t: 0, x: 215, y: 188, z: 1.3 }, { t: 6.6, x: 290, y: 180, z: 1.1 }],
  actors: [
    { who: 'chu-tu', keys: [{ t: 0, x: 262, face: -1, pose: 'stand' }, { t: 1, x: 262, face: -1, pose: 'give', prop: 'lanternPage' }, { t: 2.6, x: 262, face: -1, pose: 'nod' }, { t: 7, x: 262, face: 1, pose: 'wave' }] },
    { who: 'ut', keys: PAGE2_UT },
  ],
  cat: (t) => onCart(page2Cart(t), t > 6),
  scene: (t) => ({ cartX: page2Cart(t) }),
};

/** A still for beats without staging yet: the cart in the alley, Út beside it. */
export const FALLBACK = {
  length: 4,
  panels: [1, 2, 3],
  cam: [{ t: 0, x: 200, y: 185, z: 1.3 }],
  actors: [{ who: 'ut', keys: [{ t: 0, x: 150, face: 1, pose: 'smile' }] }],
  cat: () => onCart(196),
  scene: () => ({ lightsFrom: -5, glow: 0.5 }),
};

export const stagingFor = (id) => BEATS[id] ?? FALLBACK;
export { at as actorAt };
