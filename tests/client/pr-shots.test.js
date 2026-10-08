// scripts/pr-shots.js: page specs and the PR-body section (the capture itself runs in a browser, not here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, withSection } from '../../scripts/pr-shots.js';

test('pr-shots: page specs', () => {
  const p = parsePage('/saigon-alley/27@390x844m+select');
  assert.deepEqual([p.name, p.w, p.h, p.mobile, p.select], ['saigon-alley-27-390x844-select', 390, 844, true, true]);
  assert.equal(p.url, '/saigon-alley/27?freeze=1&quality=high&coach=0');
  const d = parsePage('/sandbox/board?level=street-003@1280x800');
  assert.deepEqual([d.name, d.mobile, d.select], ['sandbox-board-level-street-003-1280x800', false, false]);
  assert.equal(d.url, '/sandbox/board?level=street-003&freeze=1&quality=high&coach=0');
  assert.equal(parsePage('/@390x844m').name, 'menu-390x844');
  assert.equal(parsePage('/levels?fixtures=1#pack-test_mint@390x844m').url, '/levels?fixtures=1&freeze=1&quality=high&coach=0#pack-test_mint', 'flags before the #fragment');
  assert.throws(() => parsePage('/saigon-alley/1'));
  const b = parsePage('/fishing-village/37@390x844m+unlock+tap=[data-booster=fan]');
  assert.deepEqual([b.name, b.unlock, b.tap, b.select], ['fishing-village-37-390x844-tap-data-booster-fan', true, '[data-booster=fan]', false]);
  assert.equal(b.url, '/fishing-village/37?freeze=1&quality=high&coach=0');
});

test('pr-shots: the section is replaced in place, else inserted before the footer', () => {
  const foot = '🤖 Generated with [Claude Code](https://claude.com/claude-code)';
  const first = withSection(`Closes #1\n\n## What\nx\n\n${foot}`, 'A');
  assert.match(first, /## What\nx\n\n<!-- pr-shots:start -->\nA\n<!-- pr-shots:end -->\n\n🤖/);
  const again = withSection(first, 'B');
  assert.ok(again.includes('<!-- pr-shots:start -->\nB\n<!-- pr-shots:end -->') && !again.includes('\nA\n'));
  assert.equal(again.match(/pr-shots:start/g).length, 1);
  assert.equal(withSection('plain', 'C'), 'plain\n\n<!-- pr-shots:start -->\nC\n<!-- pr-shots:end -->\n');
});
