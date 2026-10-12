const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, storage } = require('./helpers.cjs');
const { hookDriver } = require('./notice-test-helpers.cjs');
const types = loadModule('features/notices/types.ts', {});
const flush = () => new Promise(setImmediate);
const nodes = value => !value ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === 'object' ? [value, ...nodes(value.children)] : [];
const items = [{ id: 'a', kind: 'notice', title: 'A', content: '내용' }, { id: 'b', kind: 'image', title: 'B', imageUrl: 'https://example.com/ad.png' }];

test('list previews collapse line breaks and hiding uses the local calendar date', () => {
  assert.equal(types.noticePreview('첫째\r\n둘째\n\n셋째'), '첫째 둘째 셋째');
  assert.equal(types.localDay(new Date(2026, 9, 9, 23, 59)), '2026-10-9');
  assert.equal(types.localDay(new Date(2026, 9, 10, 0, 0)), '2026-10-10');
});
function carousel(count = 2) {
  const h = hookDriver(), timers = new Map(), animations = [];
  let timerId = 0, appState, animationDone, handlers;
  class Value { setValue() {} }
  const native = Object.fromEntries(['View', 'Text', 'Modal', 'ScrollView', 'Pressable', 'Image'].map(name => [name, name]));
  const Screen = loadModule('features/notices/PopupCarousel.tsx', {
    react: { ...h.react, createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
    'react-native': { ...native, useWindowDimensions: () => ({ width: 400, height: 800 }),
      AppState: { currentState: 'active', addEventListener: (_, fn) => { appState = fn; return { remove() {} }; } },
      Animated: { View: 'AnimatedView', Value, timing: (_, options) => ({ start: fn => { animations.push(options); animationDone = fn; }, stop() {} }) },
      PanResponder: { create: value => { handlers = value; return { panHandlers: value }; } },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 34 }) },
    '@/components/PopupBackdrop': 'Backdrop', './ui': { styles: {} },
  }, {
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: id => timers.delete(id),
  }).default;
  const render = () => h.render(() => Screen({ items: items.slice(0, count), onClose() {}, onHideToday() {} }));
  render();
  return { render, timers, animations, handlers: () => handlers, appState: value => appState(value), finish: () => animationDone({ finished: true }), unmount: h.unmount,
    tick() { const [key, timer] = [...timers][0]; timers.delete(key); assert.equal(timer.delay, 5000); timer.fn(); render(); },
  };
}
test('carousel advances right every five seconds and wraps to first slide', () => {
  const f = carousel();
  f.tick(); assert.equal(f.animations[0].toValue, 360); assert.equal(f.animations[0].useNativeDriver, true);
  assert.equal(f.timers.size, 0);
  f.finish(); let tree = f.render();
  assert.ok(nodes(tree).some(node => node.props.accessibilityLabel === '2개 중 2번째'));
  assert.ok(nodes(tree).some(node => node.type === 'Image'));
  f.tick(); f.finish(); tree = f.render();
  assert.ok(nodes(tree).some(node => node.props.accessibilityLabel === '2개 중 1번째'));
  f.unmount(); assert.equal(f.timers.size, 0);
});
test('carousel pauses while touching or backgrounded and single slide never loops', () => {
  const f = carousel();
  nodes(f.render()).find(node => node.props.onTouchStart).props.onTouchStart(); f.render();
  assert.equal(f.timers.size, 0);
  nodes(f.render()).find(node => node.props.onTouchEnd).props.onTouchEnd(); f.render(); assert.equal(f.timers.size, 1);
  f.appState('background'); f.render(); assert.equal(f.timers.size, 0);
  f.appState('active'); f.render(); assert.equal(f.timers.size, 1);
  f.unmount();
  const single = carousel(1); assert.equal(single.timers.size, 0); single.unmount();
});
async function startup(initial = {}, response = items) {
  const h = hookDriver(), store = storage(initial); let requests = 0;
  const Screen = loadModule('features/notices/StartupPopups.tsx', {
    react: { ...h.react, createElement: (type, props, ...children) => ({ type, props, children }) },
    'react-native': { Alert: { alert() {} } }, '@react-native-async-storage/async-storage': store,
    '@/services/api': { api: { getNoticePopups: async () => { requests++; return { items: response }; } } },
    './types': types, './PopupCarousel': 'Carousel',
  }).default;
  const render = () => h.render(() => Screen({ userId: 'user' }));
  render(); await flush();
  return { render, store, requests: () => requests, unmount: h.unmount };
}
test('hide today persists for this account and blocks startup popup fetching until next day', async () => {
  const f = await startup(); assert.equal(f.requests(), 1);
  f.render().props.onHideToday(); await flush();
  assert.equal(f.render(), null);
  assert.equal(f.store.values.get('startup-popups-hidden-day:user'), types.localDay()); f.unmount();
  const suppressed = await startup({ 'startup-popups-hidden-day:user': types.localDay() });
  assert.equal(suppressed.requests(), 0); assert.equal(suppressed.render(), null); suppressed.unmount();
  const expired = await startup({ 'startup-popups-hidden-day:user': '2000-1-1' });
  assert.equal(expired.requests(), 1); assert.ok(expired.render()); expired.unmount();
});
test('close hides the popup without saving a daily suppression', async () => {
  const f = await startup(); f.render().props.onClose(); assert.equal(f.render(), null);
  assert.equal(f.store.values.size, 0); f.unmount();
});
function screenFixture(file, admin, params = {}, createdAt = '2026-10-09T01:00:00Z') {
  const h = hookDriver(), alerts = [], navigation = [], calls = [];
  const notice = { id: 1, title: 'Title', content: 'First\nSecond', pinned: true, popup: false, authorName: 'Admin', createdAt };
  const native = Object.fromEntries(['View', 'Text', 'FlatList', 'Pressable', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].map(name => [name, name]));
  const router = { back: () => navigation.push('back'), push: route => navigation.push(route), replace: route => navigation.push(route) };
  const Screen = loadModule(file, {
    react: { ...h.react, createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
    'react-native': { ...native, Platform: { OS: 'ios' }, Alert: { alert: (...args) => alerts.push(args) } },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => params, useFocusEffect: fn => h.react.useEffect(fn, [fn]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 30 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/features/notices/types': types,
    '@/features/notices/ui': { NoticeHeader: 'Header', NoticeError: 'Error', styles: {} },
    '@/services/api': { api: {
      getNotices: async () => ({ notices: [notice], hasMore: false, canManage: admin }),
      getNotice: async () => ({ notice, canManage: admin }),
      deleteNotice: async id => { calls.push(['delete', id]); return { success: true }; },
      updateNotice: async (id, data) => { calls.push(['update', id, data]); return { success: true }; },
      createNotice: async data => { calls.push(['create', data]); return { notice }; },
    } },
  }).default;
  const render = () => h.render(() => Screen()); render();
  const text = tree => tree == null ? '' : Array.isArray(tree) ? tree.map(text).join('') : typeof tree === 'object' ? text(tree.children) : String(tree);
  return { render, calls, alerts, navigation, nodes, text, unmount: h.unmount };
}
test('list admin pencil visibility, one-line preview, and detail navigation', async () => {
  for (const admin of [true, false]) {
    const f = screenFixture('app/notices.tsx', admin); await flush(); const tree = f.render();
    assert.equal(nodes(tree).some(node => node.props.accessibilityLabel === '공지사항 작성'), admin);
    const list = nodes(tree).find(node => node.type === 'FlatList');
    const row = list.props.renderItem({ item: list.props.data[0] });
    assert.ok(nodes(row).some(node => node.props.numberOfLines === 1 && f.text(node) === 'First Second'));
    row.props.onPress(); assert.equal(f.navigation[0].pathname, '/notice-detail'); f.unmount();
  }
});
test('detail scroll includes title/body, hides admin actions for members and confirms deletion', async () => {
  for (const admin of [true, false]) {
    const f = screenFixture('app/notice-detail.tsx', admin, { id: '1' }); await flush(); const tree = f.render();
    const scroll = nodes(tree).find(node => node.type === 'ScrollView');
    assert.ok(f.text(scroll).includes('Title')); assert.ok(f.text(scroll).includes('First\nSecond'));
    const remove = nodes(tree).find(node => node.type === 'Pressable' && f.text(node) === '삭제');
    assert.equal(!!remove, admin);
    if (admin) {
      remove.props.onPress(); assert.equal(f.calls.length, 0);
      await f.alerts[0][2].find(action => action.text === '삭제').onPress();
      assert.deepEqual(f.calls, [['delete', 1]]); assert.deepEqual(f.navigation, ['back']);
    }
    f.unmount();
  }
});
test('editor saves all four fields and blocks non-admin direct access', async () => {
  const blocked = screenFixture('app/notice-edit.tsx', false); await flush();
  assert.ok(nodes(blocked.render()).some(node => node.type === 'Error' && node.props.message.includes('관리자'))); blocked.unmount();
  const f = screenFixture('app/notice-edit.tsx', true); await flush(); let tree = f.render();
  nodes(tree).find(node => node.props.accessibilityLabel === '제목').props.onChangeText('공지 제목');
  nodes(tree).find(node => node.props.accessibilityLabel === '내용').props.onChangeText('공지 내용');
  nodes(tree).find(node => node.props.accessibilityRole === 'radio').props.onPress();
  nodes(tree).find(node => node.props.accessibilityRole === 'checkbox').props.onPress(); tree = f.render();
  await nodes(tree).find(node => node.type === 'Pressable' && f.text(node) === '저장').props.onPress();
  assert.equal(f.calls[0][0], 'create');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0][1])), { title: '공지 제목', content: '공지 내용', pinned: true, popup: true });
  f.unmount();
});

test('notice dates format ISO values and never display NaN or epoch for invalid server values', () => {
  assert.equal(types.noticeDate('2026-10-09T12:00:00'), '2026.10.09');
  for (const value of [{}, null, undefined, '', ' ', 'invalid', 0, [], '2026-99-99']) {
    assert.equal(types.noticeDate(value), '날짜 확인 불가');
  }
  assert.match(types.noticeDate('2026-10-09T01:00:00.000Z'), /^2026\.10\.\d{2}$/);
});

test('list and detail safely render the old server empty-object date response', async () => {
  for (const file of ['app/notices.tsx', 'app/notice-detail.tsx']) {
    const f = screenFixture(file, false, { id: '1' }, {}); await flush();
    const tree = f.render();
    const list = nodes(tree).find(node => node.type === 'FlatList');
    const displayed = list ? list.props.renderItem({ item: list.props.data[0] }) : tree;
    assert.ok(f.text(displayed).includes('날짜 확인 불가'));
    assert.equal(f.text(displayed).includes('NaN'), false);
    f.unmount();
  }
});
