import test from 'node:test';
import assert from 'node:assert/strict';
import { createGiftLayout } from './gift-layout.js';

function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }; }

test('random gift layouts cover 360 degrees without overlapping, on desktop and mobile', () => {
  for (const mobile of [false, true]) for (let seed = 1; seed <= 120; seed++) {
    const gifts = createGiftLayout({ mobile, random: seeded(seed) }), count = mobile ? 18 : 24;
    assert.equal(gifts.length, count);
    assert.equal(new Set(gifts.map(g => Math.floor(g.angle / (Math.PI * 2) * count))).size, count);
    for (let i = 0; i < count; i++) for (let j = 0; j < i; j++)
      assert.ok(Math.hypot(gifts[i].x - gifts[j].x, gifts[i].z - gifts[j].z) >= gifts[i].footprint + gifts[j].footprint + .054);
  }
});
test('gifts have visibly varied radii, sizes, rotations and wrapping, rather than a uniform row', () => {
  const gifts = createGiftLayout({ random: seeded(724) });
  assert.ok(Math.max(...gifts.map(g => g.radius)) - Math.min(...gifts.map(g => g.radius)) > .7);
  assert.ok(Math.max(...gifts.map(g => g.w)) - Math.min(...gifts.map(g => g.w)) > .25);
  assert.ok(Math.max(...gifts.map(g => g.rotation)) - Math.min(...gifts.map(g => g.rotation)) > Math.PI);
  assert.ok(new Set(gifts.map(g => g.paper)).size >= 4);
});
