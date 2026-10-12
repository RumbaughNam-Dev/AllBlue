const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

function fixture() {
  const states = [], springs = [], frames = new Map(), cleanups = [], reordered = [], dragging = [];
  let frameId = 0, scroll = 0, haptics = 0;
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation() {}
  }
  const Screen = loadModule('features/friends/PinnedFriendsList.tsx', {
    react: {
      createElement: (type, props, ...children) => ({ type, props, children }),
      useRef: current => ({ current }),
      useState: value => [value, next => states.push(next)],
      useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
    },
    'react-native': {
      View: 'View', Animated: { View: 'AnimatedView', Value,
        spring: (value, options) => ({ start: () => { springs.push(options); value.setValue(options.toValue); } }),
      },
      StyleSheet: { create: x => x }, AccessibilityInfo: { announceForAccessibility() {} },
    },
    '@expo/vector-icons': {},
    '@/utils/haptics': { notifyHoldProgress: async () => { haptics++; } },
    '@/utils/pinnedFriends': loadModule('utils/pinnedFriends.ts', {}),
  }, {
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  }).default;
  const tree = Screen({
    friends: ['a', 'b', 'c'].map(userId => ({ userId, nickname: userId, pinned: true })),
    disabled: false, renderFriend: (_, handle) => handle,
    onReorder: ids => reordered.push(Array.from(ids)), onDraggingChange: value => dragging.push(value),
    getScrollOffset: () => scroll, autoScroll() {},
  });
  const rows = tree.children[0];
  rows.forEach((row, index) => row.props.onLayout({ nativeEvent: { layout: { y: index * 80, height: 80 } } }));
  return { rows, states, springs, frames, reordered, dragging,
    hapticCount: () => haptics,
    handle: rows[0].children[0].props,
    setScroll: value => { scroll = value; },
    frame: () => { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(16); },
    unmount: () => cleanups.forEach(fn => fn()),
  };
}

test('pointer moves update only animated positions; crossing rows uses native springs', () => {
  const f = fixture();
  f.handle.onStart();
  for (let dy = 1; dy <= 170; dy++) f.handle.onMove(dy, 200 + dy);
  assert.equal(f.states.length, 1, 'no React state updates per pointer move');
  assert.equal(f.rows[0].props.style.transform[0].translateY.value, 170);
  assert.ok(f.springs.length > 0);
  assert.ok(f.springs.every(s => s.useNativeDriver));
  f.handle.onEnd(false);
  assert.deepEqual(f.reordered, [['b', 'c', 'a']]);
  assert.deepEqual(f.dragging, [true, false]);
  assert.equal(f.frames.size, 0);
});

test('scrolling offsets the dragged card without re-rendering and cancellation does not save', () => {
  const f = fixture();
  f.handle.onStart();
  f.handle.onMove(10, 500);
  f.setScroll(80); f.frame();
  assert.equal(f.rows[0].props.style.transform[0].translateY.value, 90);
  assert.equal(f.states.length, 1);
  f.handle.onEnd(true);
  assert.equal(f.frames.size, 0);
  assert.deepEqual(f.reordered, []);
  assert.equal(f.rows[0].props.style.transform[0].translateY.value, 0);
});

test('unmount cancels the animation loop and releases list scrolling', () => {
  const f = fixture();
  f.handle.onStart(); f.unmount();
  assert.equal(f.frames.size, 0);
  assert.deepEqual(f.dragging, [true, false]);
});

test('drag activation, movement and finish do not emit extra hold haptics', () => {
  const f = fixture();
  assert.equal(f.hapticCount(), 0);
  f.handle.onStart();
  f.handle.onStart(); // Ignore duplicate activation while already dragging.
  for (let dy = 1; dy <= 170; dy++) f.handle.onMove(dy, 200 + dy);
  f.handle.onEnd(false);
  assert.equal(f.hapticCount(), 0);
  f.handle.onStart();
  f.handle.onEnd(true);
  assert.equal(f.hapticCount(), 0);
  f.handle.onStep(1);
  assert.equal(f.hapticCount(), 0);
});
