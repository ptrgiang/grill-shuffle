// client/i18n: both dictionaries complete and consistent, lookup / fallback / content picking, the landing HTML in
// sync with the English dictionary, the content text check, and no English literal left in the UI code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { t, pick, setLang, lang, detectLang, DICTS, LANGS, onLangChange } from '../../client/i18n/index.js';
import { checkText } from '../../scripts/lib/content-rules.js';

const kind = (v) => (Array.isArray(v) ? `array:${v.length}` : typeof v);
const holes = (v) => (typeof v === 'string' ? [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',') : '');

test('i18n: vi and en have the same keys, kinds and placeholders, nothing empty', () => {
  const { vi, en } = DICTS;
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  for (const k of Object.keys(en)) {
    assert.equal(kind(vi[k]), kind(en[k]), `${k}: same kind`);
    assert.equal(holes(vi[k]), holes(en[k]), `${k}: same placeholders`);
    for (const v of [vi[k], en[k]].flat()) if (typeof v === 'string') assert.ok(v.trim().length || k === 'replay.finalBoard', `${k}: empty`);
  }
});

test('i18n: lookup, params, functions, fallback, content picking', () => {
  assert.equal(lang(), 'en');
  assert.equal(t('level.label', { n: 12 }), 'Level 12');
  assert.equal(t('booster.idle', { name: 'Fan' }), 'Nothing for the fan to do right now.');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(pick('Low Tide'), 'Low Tide');
  assert.equal(pick({ vi: 'Nước ròng', en: 'Low Tide' }), 'Low Tide');
  assert.equal(pick(undefined), '');
  let heard = null;
  const off = onLangChange((l) => (heard = l));
  assert.equal(setLang('vi'), true);
  assert.equal(setLang('vi'), false, 'no change, no event');
  assert.equal(heard, 'vi');
  assert.equal(t('level.label', { n: 12 }), 'Màn 12');
  assert.equal(pick({ vi: 'Nước ròng', en: 'Low Tide' }), 'Nước ròng');
  assert.equal(pick({ en: 'Only English' }), 'Only English', 'falls back to en');
  assert.equal(setLang('fr'), false);
  setLang('en');
  off();
});

test('i18n: starting language', () => {
  assert.equal(detectLang('vi', ['en-US']), 'vi', 'saved choice wins');
  assert.equal(detectLang(null, ['vi-VN', 'en']), 'vi');
  assert.equal(detectLang(undefined, ['fr-FR', 'en-GB']), 'en');
  assert.equal(detectLang(null, ['ja']), 'en');
  assert.deepEqual([...LANGS], ['vi', 'en']);
});

test('i18n: the landing HTML is the English dictionary text (what crawlers read)', () => {
  const html = readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  let n = 0;
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-i18n(-html)?="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const [, , isHtml, key, inner] = m;
    assert.ok(key in DICTS.en, `${key} in the dictionary`);
    assert.equal(norm(inner), norm(isHtml ? DICTS.en[key] : DICTS.en[key].replace(/&/g, '&amp;')), key);
    n++;
  }
  assert.ok(n >= 25, `found ${n} tagged elements`);
});

test('content text: { vi, en } or a legacy string', () => {
  assert.deepEqual(checkText('name', { vi: 'Nước ròng', en: 'Low Tide' }, 28), { errors: [], legacy: false });
  assert.deepEqual(checkText('name', 'Low Tide', 28), { errors: [], legacy: true });
  assert.deepEqual(checkText('name', undefined, 28), { errors: [], legacy: false });
  assert.match(checkText('name', { en: 'Low Tide' }, 28).errors[0], /missing vi/);
  assert.match(checkText('name', { vi: 'x'.repeat(29), en: 'ok' }, 28).errors[0], /vi text longer than 28/);
  assert.match(checkText('name', { vi: 'a', en: 'b', fr: 'c' }, 28).errors[0], /unknown language "fr"/);
});

test('no English literal left in the UI code', () => {
  // text nodes and labels written as literals: h('…', 'Some text'), toast('…'), tip('…'), 'aria-label': '…', textContent = '…'
  const files = ['client/main.js', 'client/ui/install.js', 'client/ui/update.js', 'client/ui/coach.js', 'client/game/unlock.js', 'client/game/daily.js'];
  const pattern = /(?:\bh\('[^']*',\s*(?:\{[^}]*\},\s*)?|toast\(|tip\(|'aria-label':\s*|textContent\s*=\s*)(['"`])([A-Z][a-z]+[^'"`]*)\1/g;
  const found = [];
  for (const f of files) {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(pattern)) found.push(`${f}: ${m[2]}`);
  }
  assert.deepEqual(found, []);
});
