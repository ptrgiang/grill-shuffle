import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuzzCase } from '../helpers/fuzz.js';
import { makeCandidate } from '../../solver/generator.js';

test('fuzz: 400 random boards played randomly keep every invariant', () => {
  let steps = 0;
  for (let seed = 1; seed <= 400; seed++) steps += fuzzCase(seed);
  assert.ok(steps > 2000, `only ${steps} steps were played`);
});

test('same seed -> identical level', () => {
  for (let seed = 1; seed < 50; seed++) assert.deepEqual(makeCandidate({}, seed), makeCandidate({}, seed));
});
