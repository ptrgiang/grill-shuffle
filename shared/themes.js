// Theme format: a theme is a content package (content/themes/<id>.json), pure data. It decides how a pack looks and
// sounds (palette, lights, grills, table, backdrop, ambience), which foods and mechanics its levels may use, and what
// unlocks it. Nothing here touches the simulation: rules only ever see food ids. See docs/LEVELS.md "Theme format".
//
// A theme file only lists what differs from THEME_DEFAULTS (Street BBQ's look); resolveTheme fills in the rest.

import { isFood } from './foods.js';
import { MODIFIERS } from './levels.js';

export const BACKDROP_PRESETS = Object.freeze(['bokeh', 'none']);
export const AMBIENCE_PRESETS = Object.freeze(['grill']);

// Looks (#95): named dressings of a theme's stage, picked per story level (content/story/<pack>.json `looks`). A look
// swaps the surface under the grills, may cast an overlay on it, puts code-drawn props beside the board, and may tune
// the lights, palette and backdrop. The client draws them (client/render/decor.js); here only the names.
export const LOOK_SURFACES = Object.freeze(['wood', 'gach_bong', 'steel', 'cement', 'tablecloth', 'sand', 'sand_warm', 'boat_planks']);
export const LOOK_OVERLAYS = Object.freeze(['wires', 'tin_roof']);
export const LOOK_PROPS = Object.freeze(['stool', 'tea_cup', 'salt_bowl', 'fan', 'briquette', 'briquette_lit', 'basket_boat', 'floats', 'net', 'shells', 'bucket']);
export const PROP_SIDES = Object.freeze(['left', 'right', 'far', 'near']);
const LOOK_TUNES = ['lights', 'palette', 'backdrop'];

export const THEME_DEFAULTS = Object.freeze({
  palette: { background: '#1b1420', vignette: '#0a040c' },
  lights: { sky: '#ffd6b0', ground: '#3a2030', key: '#ffe3c4', rim: '#ff9a5a', skyIntensity: 1.25, keyIntensity: 2.1, rimIntensity: 0.7, exposure: 1.05 },
  grill: {
    body: '#3a3440',
    grate: '#1e1b20',
    grateGlow: '#3a0f00',
    handle: '#7a4a2a',
    lid: '#5c6670',
    chain: '#9aa3ad',
    layerPlate: '#4a4250',
    tray: '#c89660',
    trayRim: '#8a5a34',
    ember: { bed: '#2a0d05', hot: '#ffbe5a', warm: '#ff5a14', glow: '#a01e05', fade: '#280802', coal: '#140c0a' },
  },
  // wooden planks: per-plank hsl(hue + 0..6, saturation + 0..8 %, lightness + 0..8 %), seeded
  table: { color: '#9a8070', hue: 28, saturation: 22, lightness: 34, planks: 6, seed: 11 },
  // bokeh: soft additive light sprites drifting along the far edge of the table (string lights, lanterns)
  backdrop: { preset: 'bokeh', colors: ['#ffcf7a', '#ffb35c', '#ffe9a8', '#ff8f5c'], count: 26, opacity: 0.35, size: 0.55, height: 1.2 },
  // grill: hiss (level), low rumble (level), crackle pops per second; seed picks the noise
  ambience: { preset: 'grill', hiss: 0.14, rumble: 2.2, crackle: 7, seed: 21 },
  unlock: { stars: 0 },
  // story beats (client/story/player.js): the stop's signature transition, docs/STORY.md "The five stops"
  story: { transition: 'lights' },
  // name -> look (see LOOK_SURFACES above); none: the plain theme
  looks: {},
});

/** Story transitions a theme can pick (client/story/player.js draws them). */
export const STORY_TRANSITIONS = Object.freeze(['lights', 'wave', 'fade']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
  return out;
}

/** A theme file merged onto the defaults: every look / sound field is present. */
export function resolveTheme(theme = {}) {
  return deepMerge(THEME_DEFAULTS, theme);
}

/** A resolved theme dressed in one of its looks (by name): lights / palette / backdrop tuned, `look` set (or null). */
export function withLook(t, name) {
  const look = (name && t.looks?.[name]) || null;
  if (!look) return { ...t, look: null };
  const out = { ...t, look: { name, ...look } };
  for (const k of LOOK_TUNES) if (look[k]) out[k] = deepMerge(t[k], look[k]);
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;
const TOP = ['id', 'name', 'description', 'foods', 'mechanics', ...Object.keys(THEME_DEFAULTS)];

/**
 * Structural check of a theme file (before resolveTheme). Returns a list of errors (empty = valid).
 * Unknown keys are errors too: a typo would otherwise silently fall back to the default look.
 */
export function validateTheme(theme) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!isObj(theme)) return ['theme must be an object'];
  if (typeof theme.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(theme.id)) err('id must be a snake_case string');
  if (typeof theme.name !== 'string' || !theme.name) err('name is required');
  for (const k of Object.keys(theme)) if (!TOP.includes(k)) err(`unknown key ${k}`);
  if (!Array.isArray(theme.foods) || !theme.foods.length) err('foods[] catalog is required');
  else for (const f of theme.foods) if (!isFood(f)) err(`unknown food ${f}`);
  if (!Array.isArray(theme.mechanics)) err('mechanics[] is required (may be empty)');
  else for (const m of theme.mechanics) if (!MODIFIERS.includes(m)) err(`unknown mechanic ${m}`);

  // nested sections: same keys and value kinds as the defaults
  const walk = (val, def, path) => {
    if (isObj(def)) {
      if (!isObj(val)) return err(`${path} must be an object`);
      for (const [k, v] of Object.entries(val)) {
        if (!(k in def)) err(`unknown key ${path}.${k}`);
        else walk(v, def[k], `${path}.${k}`);
      }
    } else if (Array.isArray(def)) {
      if (!Array.isArray(val) || !val.length || !val.every((c) => HEX.test(c))) err(`${path} must be a non-empty list of #rrggbb colours`);
    } else if (typeof def === 'string' && HEX.test(def)) {
      if (typeof val !== 'string' || !HEX.test(val)) err(`${path} must be a #rrggbb colour`);
    } else if (typeof def === 'number') {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) err(`${path} must be a number >= 0`);
    } else if (typeof val !== typeof def) err(`${path} must be a ${typeof def}`);
  };
  for (const k of Object.keys(THEME_DEFAULTS)) if (theme[k] !== undefined && k !== 'looks') walk(theme[k], THEME_DEFAULTS[k], k);
  if (theme.looks !== undefined) {
    if (!isObj(theme.looks)) err('looks must be an object');
    else for (const [name, look] of Object.entries(theme.looks)) errors.push(...validateLook(look, `looks.${name}`, walk, name));
  }

  errors.push(...backdropLimits(theme.backdrop, 'backdrop'));
  if (theme.ambience?.preset !== undefined && !AMBIENCE_PRESETS.includes(theme.ambience.preset)) err(`ambience.preset must be one of ${AMBIENCE_PRESETS.join(', ')}`);
  if (theme.table?.planks !== undefined && (!Number.isInteger(theme.table.planks) || theme.table.planks < 1 || theme.table.planks > 16)) err('table.planks must be an integer 1..16');
  if (theme.unlock?.stars !== undefined && !Number.isInteger(theme.unlock.stars)) err('unlock.stars must be an integer');
  if (theme.story?.transition !== undefined && !STORY_TRANSITIONS.includes(theme.story.transition)) err(`story.transition must be one of ${STORY_TRANSITIONS.join(', ')}`);
  return errors;
}

/** The backdrop's preset and sprite count, for a theme and for a look's override. */
function backdropLimits(b, path) {
  const errors = [];
  if (b?.preset !== undefined && !BACKDROP_PRESETS.includes(b.preset)) errors.push(`${path}.preset must be one of ${BACKDROP_PRESETS.join(', ')}`);
  if (b?.count !== undefined && (!Number.isInteger(b.count) || b.count > 80)) errors.push(`${path}.count must be an integer 0..80`);
  return errors;
}

function validateLook(look, path, walk, name) {
  const errors = [];
  const err = (m) => errors.push(`${path}: ${m}`);
  if (!/^[a-z][a-z0-9_]*$/.test(name)) err('a look name is snake_case');
  if (!isObj(look)) return [`${path} must be an object`];
  for (const k of Object.keys(look)) if (!['surface', 'overlay', 'props', ...LOOK_TUNES].includes(k)) err(`unknown key ${k}`);
  if (look.surface !== undefined && !LOOK_SURFACES.includes(look.surface)) err(`surface must be one of ${LOOK_SURFACES.join(', ')}`);
  if (look.overlay !== undefined && !LOOK_OVERLAYS.includes(look.overlay)) err(`overlay must be one of ${LOOK_OVERLAYS.join(', ')}`);
  if (look.props !== undefined) {
    if (!Array.isArray(look.props) || look.props.length > 8) err('props must be a list of at most 8');
    else
      look.props.forEach((p, i) => {
        const at = `props[${i}]`;
        if (!isObj(p)) return err(`${at} must be an object`);
        for (const k of Object.keys(p)) if (!['prop', 'side', 'at', 'gap', 'turn', 'size'].includes(k)) err(`${at}: unknown key ${k}`);
        if (!LOOK_PROPS.includes(p.prop)) err(`${at}: prop must be one of ${LOOK_PROPS.join(', ')}`);
        if (!PROP_SIDES.includes(p.side)) err(`${at}: side must be one of ${PROP_SIDES.join(', ')}`);
        if (typeof p.at !== 'number' || p.at < 0 || p.at > 1) err(`${at}: at must be 0..1 (along the side)`);
        if (typeof p.gap !== 'number' || p.gap < 0 || p.gap > 4) err(`${at}: gap must be 0..4 (world units from the board)`);
        if (p.turn !== undefined && (typeof p.turn !== 'number' || Math.abs(p.turn) > Math.PI * 2)) err(`${at}: turn must be radians`);
        if (p.size !== undefined && (typeof p.size !== 'number' || p.size <= 0 || p.size > 3)) err(`${at}: size must be 0..3`);
      });
  }
  for (const k of LOOK_TUNES) if (look[k] !== undefined) walk(look[k], THEME_DEFAULTS[k], `${path}.${k}`); // reports into the theme's list
  errors.push(...backdropLimits(look.backdrop, `${path}.backdrop`));
  return errors;
}

/** Size limit for a theme icon (content/themes/<id>.svg): it is inlined into the level select. */
export const ICON_MAX_BYTES = 8192;

/**
 * Check a theme icon's SVG markup. It is inlined into the page, so: one <svg> with viewBox "0 0 48 48", no scripts,
 * event handlers, links, embedded images or foreign objects, at most ICON_MAX_BYTES. Returns errors (empty = valid).
 */
export function validateThemeIcon(svg) {
  const errors = [];
  if (typeof svg !== 'string') return ['icon must be SVG text'];
  const s = svg.trim();
  if (!/^<svg\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(s) || !s.endsWith('</svg>')) errors.push('icon must be a single <svg xmlns="http://www.w3.org/2000/svg"> element');
  if (!/^<svg\b[^>]*\bviewBox="0 0 48 48"/.test(s)) errors.push('icon needs viewBox="0 0 48 48" (square, drawn on a 48 grid)');
  if (/<script|<foreignObject|<image|\bon[a-z]+\s*=|href\s*=|url\(/i.test(s)) errors.push('icon may not contain scripts, event handlers, links, images or url() references');
  if (s.length > ICON_MAX_BYTES) errors.push(`icon is ${s.length} bytes, at most ${ICON_MAX_BYTES}`);
  return errors;
}
