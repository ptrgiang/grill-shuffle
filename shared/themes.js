// Theme format: a theme is a content package (content/themes/<id>.json), pure data. It decides how a pack looks and
// sounds (palette, lights, grills, table, backdrop, ambience), which foods and mechanics its levels may use, and what
// unlocks it. Nothing here touches the simulation: rules only ever see food ids. See docs/LEVELS.md "Theme format".
//
// A theme file only lists what differs from THEME_DEFAULTS (Street BBQ's look); resolveTheme fills in the rest.

import { isFood } from './foods.js';
import { MODIFIERS } from './levels.js';

export const BACKDROP_PRESETS = Object.freeze(['bokeh', 'none']);
export const AMBIENCE_PRESETS = Object.freeze(['grill']);

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
});

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
  for (const k of Object.keys(THEME_DEFAULTS)) if (theme[k] !== undefined) walk(theme[k], THEME_DEFAULTS[k], k);

  if (theme.backdrop?.preset !== undefined && !BACKDROP_PRESETS.includes(theme.backdrop.preset)) err(`backdrop.preset must be one of ${BACKDROP_PRESETS.join(', ')}`);
  if (theme.ambience?.preset !== undefined && !AMBIENCE_PRESETS.includes(theme.ambience.preset)) err(`ambience.preset must be one of ${AMBIENCE_PRESETS.join(', ')}`);
  if (theme.backdrop?.count !== undefined && (!Number.isInteger(theme.backdrop.count) || theme.backdrop.count > 80)) err('backdrop.count must be an integer 0..80');
  if (theme.table?.planks !== undefined && (!Number.isInteger(theme.table.planks) || theme.table.planks < 1 || theme.table.planks > 16)) err('table.planks must be an integer 1..16');
  if (theme.unlock?.stars !== undefined && !Number.isInteger(theme.unlock.stars)) err('unlock.stars must be an integer');
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
