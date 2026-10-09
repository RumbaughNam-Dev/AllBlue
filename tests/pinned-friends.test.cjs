const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { readPinnedOrder, sortPinnedFriends, movePinnedId } = loadModule('utils/pinnedFriends.ts', {});

const friends = [
  { userId: 'normal-1' }, { userId: 'a', pinned: true },
  { userId: 'normal-2' }, { userId: 'b', pinned: true }, { userId: 'new', pinned: true },
];
test('saved order moves only pinned friends and retains new and unpinned friends', () => {
  assert.deepEqual(Array.from(sortPinnedFriends(friends, ['deleted', 'b', 'a']), f => f.userId),
    ['b', 'a', 'new', 'normal-1', 'normal-2']);
  assert.equal(friends[0].userId, 'normal-1', 'does not mutate API response');
});
test('moving pinned IDs supports both directions without dropping IDs', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(Array.from(movePinnedId(ids, 0, 2)), ['b', 'c', 'a']);
  assert.deepEqual(Array.from(movePinnedId(ids, 2, 0)), ['c', 'a', 'b']);
  assert.deepEqual(Array.from(movePinnedId(ids, 0, -1)), ids);
  assert.deepEqual(Array.from(movePinnedId(ids, 0, 3)), ids);
});
test('invalid or obsolete local order data is safe to read', () => {
  assert.deepEqual(Array.from(readPinnedOrder('{bad')), []);
  assert.deepEqual(Array.from(readPinnedOrder(null)), []);
  assert.deepEqual(Array.from(readPinnedOrder('{}')), []);
  assert.deepEqual(Array.from(readPinnedOrder('["a", "a", 1, "b"]')), ['a', 'b']);
});
