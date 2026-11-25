import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhotoDeck } from './album.js';
test('shows every photo once per cycle, including albums with hundreds of photos', () => {
  const deck = new PhotoDeck(() => .31); deck.set(Array.from({ length: 300 }, (_, i) => ({ id: String(i) })));
  for (let round = 0; round < 3; round++) { const ids = Array.from({ length: 300 }, () => deck.next().id); assert.equal(new Set(ids).size, 300); }
});
test('does not immediately repeat at the boundary between shuffled cycles', () => {
  const deck = new PhotoDeck(() => .99); deck.set([{ id: 'a' }, { id: 'b' }]);
  const ids = Array.from({ length: 20 }, () => deck.next().id);
  ids.slice(1).forEach((id, i) => assert.notEqual(id, ids[i]));
});
test('previous and next retrace history without consuming a new photo', () => {
  const deck = new PhotoDeck(); deck.set([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const first = deck.next(), second = deck.next(); assert.equal(deck.previous(), first); assert.equal(deck.next(), second);
});
test('empty and single-photo albums work, and replacing an album clears history', () => {
  const deck = new PhotoDeck(); assert.equal(deck.next(), null); assert.equal(deck.previous(), null);
  deck.set([{ id: 'one' }]); assert.equal(deck.next().id, 'one'); assert.equal(deck.next().id, 'one');
  deck.set([{ id: 'new' }]); assert.equal(deck.previous().id, 'new');
});
