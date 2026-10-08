// Theme packages (shared/themes.js): schema, defaults, the shipped Street BBQ look, and a dummy theme that is data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_DEFAULTS, resolveTheme, validateTheme } from '../../shared/themes.js';
import { ambienceLoop } from '../../client/audio/synth.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const street = read('../../content/themes/street_bbq.json');
const mint = read('../fixtures/themes/test_mint.json');
const look = ({ id, name, description, foods, mechanics, ...rest }) => rest;

test('themes: Street BBQ and the test fixture are valid', () => {
  assert.deepEqual(validateTheme(street), []);
  assert.deepEqual(validateTheme(mint), []);
});

test('themes: Street BBQ is exactly the default look (the refactor changed nothing on screen)', () => {
  assert.deepEqual(look(resolveTheme(street)), JSON.parse(JSON.stringify(THEME_DEFAULTS)));
});

test('themes: a partial theme is completed from the defaults; its own values win', () => {
  const t = resolveTheme(mint);
  assert.equal(t.palette.background, '#0f2a2e');
  assert.equal(t.grill.grate, THEME_DEFAULTS.grill.grate, 'missing key filled in');
  assert.equal(t.grill.ember.hot, '#9ff7ff', 'nested override');
  assert.deepEqual(t.backdrop.colors, ['#7af5ff', '#b9fffa', '#5ad1ff'], 'arrays replace, not merge');
  assert.equal(t.backdrop.preset, 'bokeh');
  assert.equal(t.unlock.stars, 40);
  for (const k of ['palette', 'lights', 'grill', 'table', 'backdrop']) assert.notDeepEqual(t[k], THEME_DEFAULTS[k], `${k} differs`);
});

test('themes: validation catches typos, bad colours, unknown foods / mechanics / presets', () => {
  const bad = (patch) => validateTheme({ ...mint, ...patch });
  assert.match(bad({ pallete: {} }).join(), /unknown key pallete/);
  assert.match(bad({ palette: { background: 'red' } }).join(), /palette.background must be a #rrggbb colour/);
  assert.match(bad({ grill: { ember: { hott: '#ffffff' } } }).join(), /unknown key grill.ember.hott/);
  assert.match(bad({ foods: ['tofu'] }).join(), /unknown food tofu/);
  assert.match(bad({ mechanics: ['lava'] }).join(), /unknown mechanic lava/);
  assert.match(bad({ mechanics: undefined }).join(), /mechanics\[\] is required/);
  assert.match(bad({ backdrop: { preset: 'fireworks' } }).join(), /backdrop.preset/);
  assert.match(bad({ backdrop: { colors: [] } }).join(), /backdrop.colors/);
  assert.match(bad({ lights: { exposure: -1 } }).join(), /lights.exposure/);
  assert.match(bad({ unlock: { stars: 2.5 } }).join(), /unlock.stars/);
  assert.match(bad({ id: 'Beach Grill' }).join(), /id must be/);
});

test('themes: ambience defaults reproduce the shipped loop; params change it', () => {
  const sr = 4000;
  const base = ambienceLoop(sr);
  assert.deepEqual(ambienceLoop(sr, THEME_DEFAULTS.ambience), base);
  assert.notDeepEqual(ambienceLoop(sr, resolveTheme(mint).ambience), base);
});
