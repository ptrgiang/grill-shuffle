// Story engine, pure (no DOM, like unlock.js): which beats play and which keepsakes unlock on an event (docs/STORY.md).
// Beats never touch the simulation; they play after a win or at app start, never during play.
//
// content/story/<pack>.json   { pack, beats: [...], keepsakes: [...] }  (bundled: client/game/content.js STORY_FILES)
//   beat      { id, at, cast, scene, title, lines, style?, reward? }
//             style: 'present' (default) | 'past': Bà Năm's past, drawn as a Đông Hồ print (client/story/style.js)
//             at: { on: 'firstLaunch' }               the cold open (first pack only)
//                 { level, on: 'firstWin' }           the first win of a level of this pack
//                 { pack, on: 'unlock' | 'complete' } this pack opens (arrival) / every level of it has a star
//             reward: { recipePage: n } | { keepsake: id } | { booster: id }
//   keepsake  { id, level, kind, art, lines }         the meso layer: unlocked by the first win of `level`
//
// Seen state: the ids of beats played and keepsakes given (save key 'storySeen', synced through /api/progress). A seen
// id never plays again.
//
// Events:
//   { on: 'launch' }          app start: the cold open once, plus ONE recap ("memories": stills) of every beat that is
//                             already passed but was never seen (a player who was past chapters before the story
//                             existed, or progress synced from another device), and the keepsakes they earned.
//                             Never a backlog of full beats.
//   { on: 'win', level }      after the win is recorded: the level's beats, its pack's 'complete' beat, the 'unlock'
//                             beat of every pack that is open now, and the level's keepsakes.
import { packStatus } from './unlock.js';
import { BOOSTERS } from '../../shared/boosters.js';

export const RECAP_ID = 'recap';
/** Story beats play by default (on since the art direction, #106, was finished; `?story=off` for a visit). */
export const STORY_DEFAULT_ON = true;
export const KEEPSAKE_KINDS = Object.freeze(['postcard', 'photo', 'note', 'date']);
// the recurring cast (docs/STORY.md "Cast"); page keepers join with their stop
export const CAST = Object.freeze(['ut', 'ba-nam', 'muc', 'co-sau', 'khang', 'chu-tu']);
export const STORY_LIMITS = Object.freeze({ title: 28, line: 80, beatLines: 1, keepsakeLines: 3 });
export const STORY_STYLES = Object.freeze(['present', 'past']);

const starred = (progress, id) => (progress?.[id]?.stars ?? 0) > 0;

/** Story files in pack order (packs without a file have no beats). */
const inOrder = (story, packs) => packs.map((p) => story.find((s) => s.pack === p.id)).filter(Boolean);

/** Has this beat's trigger already happened, judging by progress alone? */
function passed(beat, progress, packs, themes) {
  const at = beat.at;
  if (at.on === 'firstWin') return starred(progress, at.level);
  const k = packs.findIndex((p) => p.id === at.pack);
  if (k < 0) return false;
  if (at.on === 'complete') return packs[k].levels.length > 0 && packs[k].levels.every((id) => starred(progress, id));
  if (at.on === 'unlock') return packStatus(packs, k, progress, themes).open;
  return false;
}

/**
 * Every beat and keepsake of the story in story order: per pack its arrival, then per level its beats and keepsakes,
 * then its 'complete' beat. -> [{ kind: 'beat' | 'keepsake', item }]
 */
function walk(story, packs) {
  const out = [];
  for (const file of inOrder(story, packs)) {
    const pack = packs.find((p) => p.id === file.pack);
    const beats = file.beats ?? [];
    const push = (kind, list) => list.forEach((item) => out.push({ kind, item }));
    push('beat', beats.filter((b) => b.at.on === 'firstLaunch' || b.at.on === 'unlock'));
    for (const id of pack.levels) {
      push('beat', beats.filter((b) => b.at.on === 'firstWin' && b.at.level === id));
      push('keepsake', (file.keepsakes ?? []).filter((k) => k.level === id));
    }
    push('beat', beats.filter((b) => b.at.on === 'complete'));
  }
  return out;
}

/**
 * What an event triggers. `save` = { progress (level id -> { stars }), seen (ids) }, `world` = { packs, themes }.
 * -> { beats, keepsakes, seen } in play order; `seen` = the ids to add to the save once they were shown (a recap
 * stands for the beats inside it).
 */
export function storyFor(event, save, story, { packs, themes = {} }) {
  const progress = save.progress ?? {};
  const seen = new Set(save.seen ?? []);
  const all = walk(story, packs).filter(({ item }) => !seen.has(item.id));
  const beats = [];
  const keepsakes = [];
  if (event.on === 'launch') {
    const cold = all.filter(({ kind, item }) => kind === 'beat' && item.at.on === 'firstLaunch');
    beats.push(...cold.map((x) => x.item));
    const memories = all.filter(({ kind, item }) => kind === 'beat' && item.at.on !== 'firstLaunch' && passed(item, progress, packs, themes)).map((x) => x.item);
    if (memories.length) beats.push({ id: RECAP_ID, recap: true, beats: memories });
    keepsakes.push(...all.filter(({ kind, item }) => kind === 'keepsake' && starred(progress, item.level)).map((x) => x.item));
  } else if (event.on === 'win') {
    // the level's own beats first, then what the win completed / opened (story order puts arrivals first)
    const due = all.filter(({ kind, item }) => kind === 'beat' && item.at.on !== 'firstLaunch' && passed(item, progress, packs, themes));
    beats.push(...due.filter(({ item }) => item.at.on === 'firstWin' && item.at.level === event.level).map((x) => x.item));
    beats.push(...due.filter(({ item }) => item.at.on === 'complete' && packs.find((p) => p.id === item.at.pack)?.levels.includes(event.level)).map((x) => x.item));
    beats.push(...due.filter(({ item }) => item.at.on === 'unlock').map((x) => x.item));
    keepsakes.push(...all.filter(({ kind, item }) => kind === 'keepsake' && item.level === event.level && starred(progress, item.level)).map((x) => x.item));
  }
  const ids = [...beats.flatMap((b) => (b.recap ? b.beats.map((m) => m.id) : [b.id])), ...keepsakes.map((k) => k.id)];
  return { beats, keepsakes, seen: ids };
}

/** The beats an event plays, in order (a recap is one entry). */
export const beatsFor = (event, save, story, world) => storyFor(event, save, story, world).beats;

/** Seen ids after adding some: unique, sorted (stable for saving and syncing). */
export const addSeen = (seen = [], ids = []) => [...new Set([...seen, ...ids])].sort();

/**
 * Structural check of the story files against the packs. Pure; `validate:levels` runs it with the content text check
 * (scripts/lib/content-rules.js checkText) and adds the append-only check against the base revision. -> error strings.
 * packs: [{ id, levels, looks? }] (looks: the names of the pack theme's looks, to check the per-level `looks` map)
 */
export function validateStory(story, packs, { checkText }) {
  const errors = [];
  const ids = new Map();
  const levelPack = new Map(packs.flatMap((p) => p.levels.map((id) => [id, p.id])));
  const idOk = (id) => typeof id === 'string' && /^[a-z0-9]+([.-][a-z0-9]+)*$/.test(id);
  const own = (file, what, id) => {
    if (!idOk(id)) return errors.push(`${file}: ${what} id "${id}" must be lowercase letters, digits, dots and dashes`);
    if (id === RECAP_ID) return errors.push(`${file}: "${RECAP_ID}" is reserved`);
    if (ids.has(id)) errors.push(`${file}: duplicate id ${id} (also in ${ids.get(id)})`);
    ids.set(id, file);
  };
  const texts = (at, lines, max) => {
    if (!Array.isArray(lines)) return errors.push(`${at}: lines must be an array`);
    if (lines.length > max) errors.push(`${at}: at most ${max} line(s)`);
    lines.forEach((l, i) => errors.push(...checkStoryText(`${at}: line ${i + 1}`, l, STORY_LIMITS.line, checkText)));
  };
  const firstPack = packs[0]?.id;
  const launches = [];
  for (const s of story) {
    const file = `content/story/${s.pack}.json`;
    const pack = packs.find((p) => p.id === s.pack);
    if (!pack) {
      errors.push(`${file}: no pack ${s.pack}`);
      continue;
    }
    if (s.looks !== undefined) {
      // the stage's look per level (#95): a look of the pack's theme for every level of the pack, none for others
      if (typeof s.looks !== 'object' || s.looks === null || Array.isArray(s.looks)) errors.push(`${file}: looks must be { levelId: look }`);
      else {
        for (const [id, look] of Object.entries(s.looks)) {
          if (levelPack.get(id) !== s.pack) errors.push(`${file}: looks: ${id} is not a level of ${s.pack}`);
          if (pack.looks && !pack.looks.includes(look)) errors.push(`${file}: looks: ${id} wears "${look}", not a look of the theme (${pack.looks.join(', ')})`);
        }
        for (const id of pack.levels) if (!Object.hasOwn(s.looks, id)) errors.push(`${file}: looks: ${id} has no look`);
      }
    }
    for (const b of s.beats ?? []) {
      own(file, 'beat', b.id);
      const at = `${file}: beat ${b.id}`;
      const on = b.at?.on;
      if (on === 'firstLaunch') {
        launches.push(b.id);
        if (s.pack !== firstPack) errors.push(`${at}: firstLaunch belongs to the first pack (${firstPack})`);
      } else if (on === 'firstWin') {
        if (levelPack.get(b.at.level) !== s.pack) errors.push(`${at}: level ${b.at.level} is not a level of ${s.pack}`);
      } else if (on === 'unlock' || on === 'complete') {
        if (b.at.pack !== s.pack) errors.push(`${at}: pack ${b.at.pack} is not this file's pack ${s.pack}`);
        if (on === 'unlock' && s.pack === firstPack) errors.push(`${at}: the first pack is always open (use firstLaunch)`);
      } else errors.push(`${at}: at.on must be firstLaunch, firstWin, unlock or complete`);
      if (!Array.isArray(b.cast) || !b.cast.length) errors.push(`${at}: cast needs at least one character`);
      else for (const c of b.cast) if (!CAST.includes(c)) errors.push(`${at}: unknown cast member ${c} (${CAST.join(', ')})`);
      if (!idOk(b.scene)) errors.push(`${at}: scene must be an id`);
      if (b.style !== undefined && !STORY_STYLES.includes(b.style)) errors.push(`${at}: style must be one of ${STORY_STYLES.join(', ')}`);
      errors.push(...checkStoryText(`${at}: title`, b.title, STORY_LIMITS.title, checkText, true));
      texts(at, b.lines, STORY_LIMITS.beatLines);
    }
    for (const k of s.keepsakes ?? []) {
      own(file, 'keepsake', k.id);
      const at = `${file}: keepsake ${k.id}`;
      if (levelPack.get(k.level) !== s.pack) errors.push(`${at}: level ${k.level} is not a level of ${s.pack}`);
      if (!KEEPSAKE_KINDS.includes(k.kind)) errors.push(`${at}: kind must be one of ${KEEPSAKE_KINDS.join(', ')}`);
      if (!idOk(k.art)) errors.push(`${at}: art must be an id`);
      texts(at, k.lines, STORY_LIMITS.keepsakeLines);
      if (!k.lines?.length) errors.push(`${at}: needs a caption line`);
    }
  }
  if (launches.length > 1) errors.push(`content/story: more than one firstLaunch beat (${launches.join(', ')})`);
  for (const s of story) {
    for (const b of s.beats ?? []) {
      const r = b.reward;
      if (r == null) continue;
      const at = `content/story/${s.pack}.json: beat ${b.id}`;
      const keys = Object.keys(r);
      if (keys.length !== 1) errors.push(`${at}: reward is one of recipePage, keepsake, booster`);
      else if (keys[0] === 'recipePage') {
        if (!Number.isInteger(r.recipePage) || r.recipePage < 1) errors.push(`${at}: recipePage must be a page number`);
      } else if (keys[0] === 'keepsake') {
        if (!story.some((o) => (o.keepsakes ?? []).some((k) => k.id === r.keepsake))) errors.push(`${at}: no keepsake ${r.keepsake}`);
      } else if (keys[0] === 'booster') {
        if (!Object.hasOwn(BOOSTERS, r.booster)) errors.push(`${at}: unknown booster ${r.booster} (${Object.keys(BOOSTERS).join(', ')})`);
      } else errors.push(`${at}: unknown reward ${keys[0]}`);
    }
  }
  return errors;
}

// story text is always { vi, en } (never the legacy English-only string)
function checkStoryText(what, value, max, checkText, required = false) {
  if (value == null) return required ? [`${what}: missing`] : [];
  if (typeof value === 'string') return [`${what}: must be { "vi": …, "en": … }`];
  return checkText(what, value, max).errors;
}

/** Every beat and keepsake id (the Worker keeps only these in a player's seen list). */
export const storyIds = (story) => story.flatMap((s) => [...(s.beats ?? []), ...(s.keepsakes ?? [])].map((x) => x.id));
