const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

function fixture() {
  let now = 0, id = 0, starts = 0, ticks = 0;
  const timers = new Map(), origins = [], animations = [], ends = [];
  class Value {
    setValue() {} stopAnimation() {} interpolate() {}
  }
  const { DragHandle } = loadModule('features/friends/PinnedFriendsList.tsx', {
    react: {
      createElement: (type, props, ...children) => ({ type, props, children }),
      useRef: current => ({ current }), useState: value => [value, next => origins.push(next)], useEffect: fn => fn(),
    },
    'react-native': {
      View: 'View', Animated: { Value, timing: (_, options) => ({ start: () => animations.push(options) }) },
      Easing: { linear: 'linear' }, StyleSheet: { create: value => value },
      PanResponder: { create: handlers => ({ panHandlers: handlers }) },
    },
    '@expo/vector-icons': {}, '@/utils/pinnedFriends': {},
    '@/utils/haptics': { notifyHoldProgress: async () => { ticks++; } },
  }, {
    setTimeout: (fn, delay) => { timers.set(++id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const tree = DragHandle({ label: 'friend', disabled: false, onStart: () => starts++, onMove() {}, onEnd: value => ends.push(value), onStep() {} });
  return {
    handlers: tree.props, origins, animations, ends, starts: () => starts, ticks: () => ticks,
    advance(to) {
      while (true) {
        const entry = [...timers].filter(([, task]) => task.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        const [key, task] = entry; now = task.at; timers.delete(key); task.fn();
      }
      now = to;
    },
  };
}
const event = { nativeEvent: { locationX: 13, locationY: 22 } };
test('touch-centered progress and ticks stop at the long press threshold', () => {
  const f = fixture();
  f.handlers.onPanResponderGrant(event);
  assert.equal(f.origins.at(-1).x, 13);
  assert.equal(f.origins.at(-1).y, 22);
  assert.equal(f.animations[0].duration, 350);
  assert.equal(f.animations[0].useNativeDriver, true);
  f.advance(349);
  assert.equal(f.ticks(), 4);
  assert.equal(f.starts(), 0);
  f.advance(350);
  assert.equal(f.starts(), 1);
  assert.equal(f.origins.at(-1), null);
  f.handlers.onPanResponderMove(null, { dy: 100, moveY: 300 });
  f.advance(1000);
  assert.equal(f.ticks(), 4);
});
for (const action of ['release', 'terminate', 'scroll']) {
  test(`${action} cancels pending progress, haptics and activation`, () => {
    const f = fixture();
    f.handlers.onPanResponderGrant(event);
    f.advance(90);
    if (action === 'scroll') f.handlers.onPanResponderMove(null, { dx: 0, dy: 10 });
    else if (action === 'release') f.handlers.onPanResponderRelease();
    else f.handlers.onPanResponderTerminate();
    f.advance(1000);
    assert.equal(f.ticks(), 1);
    assert.equal(f.starts(), 0);
    assert.equal(f.origins.at(-1), null);
  });
}
