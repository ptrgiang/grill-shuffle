import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEVELS_DIR } from '../../scripts/lib/content.js';

// Story share codes shipped before the share index existed encoded the pack order of these ten levels. Their
// positions must never change; new entries only go after them. Extend this list when a release ships more.
const SHIPPED = ['street-001', 'street-002', 'street-003', 'street-004', 'street-005', 'street-006', 'street-007', 'street-008', 'street-009', 'street-010'];

test('share index keeps every shipped story code position', () => {
  const { levels } = JSON.parse(readFileSync(join(LEVELS_DIR, 'share-index.json'), 'utf8'));
  assert.deepEqual(levels.slice(0, SHIPPED.length), SHIPPED);
  assert.equal(new Set(levels).size, levels.length);
});
