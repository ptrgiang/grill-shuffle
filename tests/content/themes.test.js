// Theme packages (shared/themes.js): schema, defaults, the shipped Street BBQ look, and a dummy theme that is data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_DEFAULTS, resolveTheme, validateTheme, validateThemeIcon, withLook } from '../../shared/themes.js';
import { ambienceLoop } from '../../client/audio/synth.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const street = read('../../content/themes/street_bbq.json');
const beach = read('../../content/themes/beach_grill.json');
const mint = read('../fixtures/themes/test_mint.json');
const look = ({ id, name, description, foods, mechanics, looks, ...rest }) => rest; // the plain stage (looks: #95)

test('themes: Street BBQ and the test fixture are valid', () => {
  assert.deepEqual(validateTheme(street), []);
  assert.deepEqual(validateTheme(mint), []);
});

test('themes: Street BBQ is exactly the default look (the refactor changed nothing on screen)', () => {
  assert.deepEqual(look(resolveTheme(street)), look(JSON.parse(JSON.stringify(THEME_DEFAULTS))));
});

test('themes: five looks per shipped theme (#95), valid; a look tunes lights / palette / backdrop on top', () => {
  assert.deepEqual(validateTheme(beach), []);
  assert.deepEqual(Object.keys(street.looks), ['sidewalk', 'stall', 'cart', 'night', 'quan']);
  assert.deepEqual(Object.keys(beach.looks), ['sand', 'nets', 'shack', 'boat', 'dusk']);
  const t = resolveTheme(beach);
  const dusk = withLook(t, 'dusk');
  assert.equal(dusk.look.name, 'dusk');
  assert.equal(dusk.lights.key, '#ffc890', 'the late sun');
  assert.equal(dusk.lights.sky, '#ffe0b8');
  assert.equal(dusk.lights.rimIntensity, t.lights.rimIntensity, 'untouched keys stay the theme’s');
  assert.equal(withLook(t, null).look, null);
  assert.equal(withLook(t, 'nope').look, null, 'an unknown look is the plain theme');
  assert.deepEqual(withLook(t, null).lights, t.lights);
});

test('themes: look validation catches unknown surfaces, props, sides and tunes', () => {
  const bad = (looks) => validateTheme({ ...mint, looks }).join();
  assert.equal(bad({ ok: { surface: 'sand', props: [{ prop: 'stool', side: 'left', at: 0.5, gap: 0.8 }] } }), '');
  assert.match(bad({ a: { surface: 'marble' } }), /looks.a: surface must be one of/);
  assert.match(bad({ a: { overlay: 'rain' } }), /overlay must be one of/);
  assert.match(bad({ a: { props: [{ prop: 'piano', side: 'left', at: 0.5, gap: 1 }] } }), /prop must be one of/);
  assert.match(bad({ a: { props: [{ prop: 'stool', side: 'up', at: 2, gap: 1 }] } }), /side must be one of.*at must be 0..1/);
  assert.match(bad({ a: { lights: { keyy: 1 } } }), /unknown key looks.a.lights.keyy/);
  assert.match(bad({ a: { tilt: 1 } }), /unknown key tilt/);
  assert.match(bad({ 'Bad-Name': {} }), /snake_case/);
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

test('themes: every shipped theme icon (and the fixture) is a safe 48x48 SVG', () => {
  for (const p of ['../../content/themes/street_bbq.svg', '../../content/themes/beach_grill.svg', '../fixtures/themes/test_mint.svg']) {
    assert.deepEqual(validateThemeIcon(readFileSync(new URL(p, import.meta.url), 'utf8')), [], p);
  }
});

test('themes: icon validation rejects scripts, handlers, links, wrong grid, oversize', () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48"/></svg>';
  assert.deepEqual(validateThemeIcon(ok), []);
  assert.match(validateThemeIcon(ok.replace('<rect', '<script>alert(1)</script><rect')).join(), /scripts/);
  assert.match(validateThemeIcon(ok.replace('<rect', '<rect onclick="x()"')).join(), /event handlers/);
  assert.match(validateThemeIcon(ok.replace('<rect', '<image href="https://x/y.png"/><rect')).join(), /images/);
  assert.match(validateThemeIcon(ok.replace('0 0 48 48', '0 0 24 24')).join(), /viewBox/);
  assert.match(validateThemeIcon(ok.replace('</svg>', `<!--${'x'.repeat(9000)}--></svg>`)).join(), /at most 8192/);
  assert.match(validateThemeIcon('<div/>').join(), /single <svg/);
});
