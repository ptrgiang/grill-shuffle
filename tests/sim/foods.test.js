import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, FOOD_IDS, foodCode, foodFromCode } from '../../shared/foods.js';
import { createState, serializeState, deserializeState } from '../../shared/state.js';
import { level } from '../helpers/levels.js';

// Codes are part of serialized states and canonical hashes: shipped ones never change, new ones are appended.
const SHIPPED = { beef: 'b', shrimp: 's', chicken: 'c', corn: 'k', carrot: 'r', salmon: 'l', bread: 'd', sausage: 'u', mushroom: 'm', pepper: 'p', skewer: 'w', squid: 'q', scallop: 'v', pineapple: 'n' };

test('food codes: shipped codes unchanged, catalog append-only', () => {
  for (const [id, code] of Object.entries(SHIPPED)) assert.equal(foodCode(id), code, id);
  assert.deepEqual(FOOD_IDS.slice(0, Object.keys(SHIPPED).length), Object.keys(SHIPPED));
});

test('food codes: unique single characters that do not collide with state syntax', () => {
  const codes = Object.values(FOODS).map((f) => f.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.match(c, /^[a-z]$/);
  for (const id of FOOD_IDS) assert.equal(foodFromCode(foodCode(id)), id);
});

test('new foods round-trip through state serialization', () => {
  const s = createState(level(['uuu', 'mmm', 'ppp', 'www', '...']));
  assert.deepEqual(serializeState(deserializeState(serializeState(s))), serializeState(s));
});
