const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadModule } = require('./helpers.cjs');
const flush = () => new Promise(setImmediate);

function temporaryLinkHarness(api, source = { id: 2, nickname: '임시 이름' }, platform = 'ios') {
  const h = hookDriver();
  const { createLatestRequest } = loadModule('utils/latestRequest.ts', {});
  const request = createLatestRequest();
  let closed = 0, linked = 0, dismissed = 0;
  const alerts = [];
  const native = Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  const component = loadModule('components/TemporaryUserLinkModal.tsx', {
    react: { ...h.react, createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
    'react-native': { ...native, StyleSheet: { create: value => value }, Platform: { OS: platform }, Keyboard: { dismiss() { dismissed++; } }, Alert: { alert: (...args) => alerts.push(args) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 34 }) },
    './PopupBackdrop': 'PopupBackdrop', './UserProfileView': 'UserProfileView', './ProfileAvatar': 'ProfileAvatar',
    '@/constants/Colors': { default: { brand: { primary: '#123456' } }, __esModule: true },
    '@/services/api': { api }, '@/hooks/useLatestRequest': { useLatestRequest: () => request },
    '@/hooks/useSearch': { useSearch: (query, search, enabled) => ({ searching: false, error: null, completedQuery: query,
      results: enabled ? [{ id: 3, userId: 'member', nickname: '가입 이름', name: '실명', phoneHint: '010-****-5142' }] : [] }) },
  }).default;
  const props = { visible: true, scheduleId: 1, source, onClose: () => closed++, onLinked: () => linked++ };
  const render = () => h.render(() => component(props));
  function nodes(tree) { return !tree ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.children)] : []; }
  function content(tree) { return tree == null || typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(content).join('') : typeof tree === 'object' ? content(tree.children) : String(tree); }
  const button = (tree, text) => nodes(tree).find(n => n.type === 'Pressable' && content(n) === text);
  render();
  return { render, nodes, content, button, props, alerts, get dismissed() { return dismissed; }, get closed() { return closed; }, get linked() { return linked; }, unmount: h.unmount };
}

const linkPreview = () => ({ source: { id: 2, nickname: '임시 이름' }, target: { id: 3, nickname: '가입 이름', name: '실명' },
  counts: { schedules: 2, courses: 1, forms: 1, debriefings: 1, achievements: 1 },
  duplicates: { schedules: 1, courses: 0, achievements: 0, contacts: 0 },
  schedules: [{ id: 1, title: '첫 일정', date: '2026-10-01' }, { id: 2, title: '다른 일정', date: '2026-10-02' }], confirmationToken: 'confirmed-token' });

test('temporary linking requires scope confirmation and submits only once while busy', async () => {
  const selection = deferred(), submission = deferred();
  let previews = 0, submissions = 0;
  const h = temporaryLinkHarness({ previewTemporaryLink: () => { previews++; return selection.promise; },
    linkTemporaryUser: (...args) => { submissions++; assert.deepEqual(args, [1, 2, 3, 'confirmed-token']); return submission.promise; } });
  let tree = h.render();
  assert.ok(h.nodes(tree).some(n => n.type === 'PopupBackdrop'));
  assert.ok(!h.content(tree).includes('프로필 확인'));
  assert.ok(!h.content(tree).includes('동명이인이 있다면'));
  assert.ok(h.content(tree).includes('010-****-5142'));
  assert.ok(h.button(tree, '프로필'));
  const choose = h.button(tree, '연결');
  const first = choose.props.onPress(); await choose.props.onPress();
  assert.equal(previews, 1);
  tree = h.render();
  assert.equal(h.button(tree, '프로필').props.disabled, true);
  h.button(tree, '프로필').props.onPress();
  assert.ok(!h.nodes(h.render()).some(n => n.type === 'UserProfileView'));
  selection.resolve(linkPreview()); await first;
  tree = h.render(); assert.ok(h.content(tree).includes('다른 일정'));
  assert.equal(h.button(tree, '전체 기록 연결').props.disabled, true);
  await h.button(tree, '전체 기록 연결').props.onPress(); assert.equal(submissions, 0);
  h.nodes(tree).find(n => n.props.accessibilityRole === 'checkbox').props.onPress();
  tree = h.render(); const commit = h.button(tree, '전체 기록 연결');
  const pending = commit.props.onPress(); await commit.props.onPress();
  assert.equal(submissions, 1);
  tree = h.render(); h.nodes(tree).find(n => n.type === 'Modal').props.onRequestClose(); assert.equal(h.closed, 0);
  submission.resolve({ success: true }); await pending;
  assert.equal(h.linked, 1); assert.equal(h.alerts.length, 1); h.unmount();
});

test('a changed-record conflict clears confirmation and requires a new preview', async () => {
  const h = temporaryLinkHarness({ previewTemporaryLink: async () => linkPreview(), linkTemporaryUser: async () => { throw new Error('기록이 변경되었습니다.'); } });
  await h.button(h.render(), '연결').props.onPress();
  let tree = h.render(); h.nodes(tree).find(n => n.props.accessibilityRole === 'checkbox').props.onPress();
  await h.button(h.render(), '전체 기록 연결').props.onPress();
  tree = h.render(); assert.ok(h.content(tree).includes('기록이 변경되었습니다.'));
  assert.equal(h.button(tree, '전체 기록 연결'), undefined); assert.equal(h.linked, 0);
  await h.button(tree, '연결').props.onPress();
  assert.equal(h.button(h.render(), '전체 기록 연결').props.disabled, true); h.unmount();
});

test('link popup has no audit history mode and ignores a preview arriving after close', async () => {
  const pending = deferred();
  const h = temporaryLinkHarness({ previewTemporaryLink: () => pending.promise });
  const opening = h.button(h.render(), '연결').props.onPress();
  h.props.visible = false; h.render();
  pending.resolve(linkPreview()); await opening;
  h.props.visible = true; h.render();
  const tree = h.render();
  assert.ok(!h.content(tree).includes('사용자 연결 이력'));
  assert.equal(h.button(tree, '전체 기록 연결'), undefined);
  assert.ok(h.button(tree, '연결')); h.unmount();
});

for (const platform of ['ios', 'android']) {
  test(`link popup adapts to the keyboard viewport and dismisses on open/submit (${platform})`, () => {
    const h = temporaryLinkHarness({}, undefined, platform);
    assert.equal(h.dismissed, 1, 'clear the underlying screen keyboard on open');
    let tree = h.render();
    assert.ok(h.content(tree).includes('가입 사용자로 연결'));
    assert.ok(!h.content(tree).includes('정식 사용자'));
    const modal = h.nodes(tree).find(n => n.type === 'Modal'); modal.props.onShow();
    assert.equal(h.dismissed, 2);
    const avoiding = h.nodes(tree).find(n => n.type === 'KeyboardAvoidingView');
    assert.equal(avoiding.props.behavior, platform === 'ios' ? 'padding' : 'height');
    const viewport = h.nodes(tree).find(n => n.type === 'View' && n.props.onLayout);
    for (const height of [640, 280, 720]) {
      viewport.props.onLayout({ nativeEvent: { layout: { height } } }); tree = h.render();
      const card = h.nodes(tree).find(n => n.props.accessibilityViewIsModal);
      const style = Object.assign({}, ...card.props.style);
      assert.equal(style.maxHeight, height - 24 - 34, 'card fits the remaining viewport including safe areas');
      const scroll = h.nodes(tree).find(n => n.type === 'ScrollView');
      assert.equal(scroll.props.style.flexShrink, 1, 'long results shrink into a scrollable body');
    }
    const input = h.nodes(tree).find(n => n.type === 'TextInput');
    assert.equal(input.props.submitBehavior, 'blurAndSubmit');
    input.props.onSubmitEditing(); assert.equal(h.dismissed, 3);
    h.nodes(tree).find(n => n.type === 'Modal').props.onRequestClose();
    assert.equal(h.dismissed, 4); assert.equal(h.closed, 1); h.unmount();
  });
}

test('profile opens above the link popup and closing/back preserves its search state', () => {
  const h = temporaryLinkHarness({});
  let tree = h.render();
  h.nodes(tree).find(n => n.type === 'TextInput').props.onChangeText('가입 이름');
  tree = h.render();
  const actions = h.nodes(tree).filter(n => n.type === 'Pressable' && ['프로필', '연결'].includes(h.content(n)));
  assert.deepEqual(actions.map(n => h.content(n)), ['프로필', '연결']);
  h.button(tree, '프로필').props.onPress(); tree = h.render();
  assert.equal(h.closed, 0);
  const profile = h.nodes(tree).find(n => n.type === 'UserProfileView');
  assert.equal(profile.props.userId, 'member');
  assert.equal(h.nodes(tree).find(n => n.type === 'Modal').props.visible, true);
  assert.equal(h.nodes(tree).find(n => n.type === 'TextInput').props.value, '가입 이름');
  assert.equal(h.nodes(tree).find(n => n.type === 'KeyboardAvoidingView').props.importantForAccessibility, 'no-hide-descendants');
  profile.props.onClose(); tree = h.render();
  assert.equal(h.closed, 0); assert.ok(!h.nodes(tree).some(n => n.type === 'UserProfileView'));
  assert.equal(h.nodes(tree).find(n => n.type === 'TextInput').props.value, '가입 이름');
  h.button(tree, '프로필').props.onPress(); tree = h.render();
  h.nodes(tree).find(n => n.type === 'Modal').props.onRequestClose();
  assert.equal(h.closed, 0); assert.ok(!h.nodes(h.render()).some(n => n.type === 'UserProfileView'));
  h.unmount();
});

test('profile route keeps its close and diving-log navigation after sharing the profile view', () => {
  const visits = []; let closed = 0;
  const screen = loadModule('app/profile-view.tsx', {
    react: { createElement: (type, props) => ({ type, props }) },
    'expo-router': { useLocalSearchParams: () => ({ userId: 'member' }), useRouter: () => ({ back: () => closed++, push: value => visits.push(value) }) },
    '@/components/UserProfileView': 'UserProfileView',
  }).default;
  const view = screen(); assert.equal(view.props.userId, 'member');
  view.props.onClose(); assert.equal(closed, 1);
  const params = { participantId: '3', profileUserId: 'member', participantName: '가입 이름', participantLevel: '1', modal: '1' };
  view.props.onOpenLog(params); assert.equal(visits[0].pathname, '/achievement'); assert.equal(visits[0].params, params);
});

test('profile remains dismissible during loading and after a failed request', async () => {
  const h = hookDriver(); const pending = deferred(); let closed = 0;
  const view = loadModule('components/UserProfileView.tsx', {
    react: { ...h.react, createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: x => x } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-status-bar': {}, '@/constants/Colors': { default: loadModule('constants/Colors.ts', {}).default, __esModule: true },
    '@/services/api': { api: { getUserProfile: () => pending.promise } },
    '@/components/Spinner': {}, '@/components/LevelBadge': {},
    '@/contexts/AuthContext': { useAuth: () => ({ user: { id: 1 } }) },
    '@/utils/userRole': loadModule('utils/userRole.ts', {}),
  }).default;
  function nodes(tree) { return !tree ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.children)] : []; }
  const render = () => h.render(() => view({ userId: 'member', onClose: () => closed++ }));
  nodes(render()).find(n => n.props.accessibilityLabel === '프로필 닫기').props.onPress(); assert.equal(closed, 1);
  pending.reject(new Error('offline')); await flush();
  nodes(render()).find(n => n.props.accessibilityLabel === '프로필 닫기').props.onPress(); assert.equal(closed, 2);
  h.unmount();
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// A deterministic hook driver for out-of-order API responses and effect cleanup.
function hookDriver() {
  const slots = [];
  let index = 0, effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = index++;
      slots[i] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, (next) => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }];
    },
    useRef(initial) { const i = index++; slots[i] ??= { current: initial }; return slots[i]; },
    useMemo(factory, deps) {
      const i = index++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { value: factory(), deps };
      return slots[i].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = index++;
      if (!same(slots[i]?.deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  return {
    react,
    render(fn) { index = 0; effects = []; const value = fn(); effects.forEach((run) => run()); return value; },
    unmount() { slots.forEach((slot) => slot.cleanup?.()); },
  };
}

for (const [name, dev, channel, env, production] of [
  ['local', true, null, undefined, false],
  ['local with production settings', true, 'production', 'production', false],
  ['preview build', false, 'preview', 'production', false],
  ['development build', false, 'development', undefined, false],
  ['production OTA without public env', false, 'production', undefined, true],
  ['production export', false, null, 'production', true],
  ['unconfigured local export', false, null, undefined, false],
]) {
  test(`${name}: API follows the environment and OAuth preserves the original callback`, () => {
    const config = loadModule('constants/Environment.ts', { 'expo-updates': { channel } }, {
      __DEV__: dev, process: { env: { EXPO_PUBLIC_APP_ENV: env } },
    });
    const base = production ? 'https://api.rumbaugh.co.kr/allblue' : 'https://api-dev.rumbaugh.co.kr/allblue';
    assert.equal(config.API_BASE_URL, base);
    for (const provider of ['kakao', 'google', 'naver', 'apple']) {
      assert.equal(config.authCallbackUrl(provider), `https://api.rumbaugh.co.kr/allblue/auth/${provider}/callback`);
    }
  });
}

test('only instructor and administrator levels have instructor UI access', () => {
  const { hasInstructorAccess } = loadModule('utils/userRole.ts', {});
  for (const level of [undefined, null, 0, 1, 2, 3, 4, '4']) assert.equal(hasInstructorAccess(level), false);
  for (const level of [5, '5', 'A']) assert.equal(hasInstructorAccess(level), true);
});

test('search ignores old results, clears pending work on empty input, and cancels on close', async () => {
  const h = hookDriver();
  const timers = new Map(); let timerId = 0;
  const { useSearch } = loadModule('hooks/useSearch.ts', { react: h.react, '@/services/api': { api: {} } }, {
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  const first = deferred(), second = deferred();
  const search = (query) => query === 'old' ? first.promise : second.promise;
  let query = 'old', enabled = true;
  const render = () => h.render(() => useSearch(query, search, enabled));
  render(); const firstTimer = timers.get(timerId)();
  query = 'new'; render(); const secondTimer = timers.get(timerId)();
  second.resolve(['new-result']); await secondTimer;
  first.resolve(['old-result']); await firstTimer;
  assert.equal(render().results[0], 'new-result');
  query = 'pending'; render();
  query = ''; render();
  assert.equal(timers.size, 0);
  assert.equal(render().results.length, 0);
  assert.equal(render().searching, false);
  query = 'new'; render(); enabled = false; render();
  assert.equal(timers.size, 0);
  h.unmount();
});

test('calendar filter changes cannot be overwritten by a late previous filter response', async () => {
  const h = hookDriver();
  const pending = [];
  let onAppStateChange;
  let removed = false;
  const latest = loadModule('utils/latestRequest.ts', {});
  const requestHook = loadModule('hooks/useLatestRequest.ts', { react: h.react, '@/utils/latestRequest': latest });
  const { useCalendarSchedules } = loadModule('hooks/useCalendarSchedules.ts', {
    react: h.react,
    'react-native': { AppState: {
      currentState: 'active',
      addEventListener(event, callback) {
        onAppStateChange = callback;
        return { remove() { removed = true; } };
      },
    } },
    'expo-router': { useFocusEffect: (fn) => h.react.useEffect(fn, [fn]) },
    './useLatestRequest': requestHook,
    '@/services/api': { api: {
      getFriendGroups: async () => ({ groups: [] }),
      getMonthlySchedules(year, month, filter) {
        const job = { ...deferred(), year, month, filter }; pending.push(job); return job.promise;
      },
    } },
  });
  const render = () => h.render(useCalendarSchedules);
  let view = render();
  const old = pending[0];
  view.handleFilterChange('instructor'); view = render();
  const current = pending.find((p) => p.filter === 'instructor' && p.month === old.month);
  current.resolve({ schedules: [{ scheduleDate: '2026-09-21', title: 'instructor' }] }); await flush();
  old.resolve({ schedules: [{ scheduleDate: '2026-09-21', title: 'mine' }] }); await flush();
  assert.equal(render().events[0].title, 'instructor');
  render().retry();
  const retry = pending.at(-1);
  retry.reject(new Error('Offline')); await flush();
  assert.equal(render().error, true);
  assert.equal(render().events[0].title, 'instructor');
  onAppStateChange('background');
  const beforeResume = pending.length;
  onAppStateChange('active');
  assert.ok(pending.length > beforeResume);
  const resumed = pending.slice(beforeResume).find((p) => p.month === old.month);
  resumed.resolve({ schedules: [{ scheduleDate: '2026-09-21', title: 'new invitation' }] });
  await flush();
  assert.equal(render().events[0].title, 'new invitation');
  assert.equal(render().error, false);
  removed = false;
  h.unmount();
  assert.equal(removed, true);
});

test('friend tabs ignore late old-tab results and refresh callbacks', async () => {
  const h = hookDriver();
  const close = deferred(), buddy = deferred();
  let closeCalls = 0;
  const latest = loadModule('utils/latestRequest.ts', {});
  const requestHook = loadModule('hooks/useLatestRequest.ts', { react: h.react, '@/utils/latestRequest': latest });
  const { useFriends } = loadModule('features/friends/useFriends.ts', {
    react: h.react,
    'react-native': {
      Animated: { Value: class { constructor(value) { this.value = value; } } },
      Platform: { OS: 'ios' }, Keyboard: { addListener: () => ({ remove() {} }) },
      useWindowDimensions: () => ({ height: 800 }),
    },
    'expo-router': { useRouter: () => ({}), useFocusEffect: (fn) => h.react.useEffect(fn, [fn]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/contexts/AuthContext': { useAuth: () => ({ user: { level: 1 } }) },
    '@/utils/userRole': loadModule('utils/userRole.ts', {}),
    '@/utils/format': loadModule('utils/format.ts', {}),
    '@/hooks/useLatestRequest': requestHook,
    '@/hooks/useSearch': { useUserSearch: query => ({ results: [], searching: false, error: false, completedQuery: query.trim() }) },
    '@/services/api': { api: {
      getFriendGroups: async () => ({ groups: [] }),
      getCloseFriends: () => { closeCalls++; return close.promise; },
      getDiveBuddies: () => buddy.promise,
    } },
  });
  const render = () => h.render(useFriends);
  const first = render();
  assert.equal(first.allTabs.some((tab) => tab.key === 'student'), false);
  first.switchTab('buddy'); render();
  buddy.resolve({ buddies: [{ userId: '2', nickname: 'buddy' }] }); await flush();
  close.resolve({ friends: [{ userId: '1', nickname: 'close' }] }); await flush();
  await first.fetchFriends();
  assert.equal(closeCalls, 1);
  assert.equal(render().sortedFriends[0].nickname, 'buddy');
  h.unmount();
});

test('schedule detail reloads on app return without a navigation focus change', async () => {
  const h = hookDriver();
  const listeners = new Set();
  const requests = [];
  const { createLatestRequest } = loadModule('utils/latestRequest.ts', {});
  const request = createLatestRequest();
  const colors = loadModule('constants/Colors.ts', {}).default;
  const screen = loadModule('app/schedule-detail.tsx', {
    react: { ...h.react, createElement: (type, props, ...children) => ({ type, props, children }) },
    'react-native': {
      StyleSheet: { create: (styles) => styles }, Platform: { OS: 'ios' },
      AppState: {
        currentState: 'active',
        addEventListener: (_event, listener) => {
          listeners.add(listener);
          return { remove: () => listeners.delete(listener) };
        },
      },
      Alert: { alert: () => {} },
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-blur': {}, '@/components/PopupBackdrop': {}, '@/components/TemporaryUserLinkModal': {}, 'expo-clipboard': {}, 'expo-web-browser': {},
    'expo-router': {
      useLocalSearchParams: () => ({ id: '42', filter: 'mine' }),
      useRouter: () => ({}),
      useFocusEffect: (callback) => h.react.useEffect(callback, [callback]),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-status-bar': {}, '@/constants/Colors': { default: colors, __esModule: true },
    '@/hooks/useLatestRequest': { useLatestRequest: () => request },
    '@/services/api': { api: { getScheduleDetail: () => {
      const pending = deferred(); requests.push(pending); return pending.promise;
    } } },
    '@/components/Spinner': {}, '@/components/ProfileAvatar': {}, '@/components/ProfileLink': {},
    '@/contexts/AuthContext': { useAuth: () => ({ user: { id: 'teacher', level: '5' } }) },
    '@/utils/userRole': loadModule('utils/userRole.ts', {}),
  }).default;
  const render = () => h.render(screen);
  const emit = (state) => listeners.forEach((listener) => listener(state));
  render();
  assert.equal(requests.length, 1);
  emit('active');
  assert.equal(requests.length, 1);
  emit('inactive'); emit('background');
  assert.equal(requests.length, 1, 'do not refresh while opening or using browser');
  emit('active');
  assert.equal(requests.length, 2, 'refresh on return even though route stayed focused');
  emit('active');
  assert.equal(requests.length, 2, 'ignore repeated active notifications');
  render();
  assert.equal(listeners.size, 1, 'rerenders must not duplicate the listener');
  emit('inactive'); emit('active');
  assert.equal(requests.length, 3, 'also refresh after inactive-only transitions');
  h.unmount();
  assert.equal(listeners.size, 0);
  emit('background'); emit('active');
  assert.equal(requests.length, 3);
  requests.forEach((pending) => pending.resolve({ schedule: null }));
  await flush();
});

for (const [overall, personal, status, expected, canViewDivingLog = true, viewerLevel = '5', owner = true] of [
  ['CERTIFICATION', 'LECTURE', 'accepted', ['다이빙 로그', '디브리핑']],
  ['CERTIFICATION', 'TRAINING', 'accepted', ['면책동의서', '의료진술서', '다이빙 로그', '디브리핑']],
  ['TRAINING', null, 'accepted', ['면책동의서', '의료진술서', '다이빙 로그', '디브리핑']],
  ['TRAINING', 'TRAINING', 'accepted', ['면책동의서', '의료진술서', '다이빙 로그', '디브리핑'], true, 'A'],
  ['TRAINING', 'TRAINING', 'accepted', [], true, '5', false],
  ['TRAINING', 'TRAINING', 'pending', ['일정등록 요청을 보냈어요!']],
  ['TRAINING', 'TRAINING', 'accepted', ['면책동의서', '의료진술서'], false],
  ['TRAINING', 'TRAINING', 'accepted', ['면책동의서', '의료진술서'], true, '0'],
  ['TRAINING', 'CERTIFICATION', 'accepted', ['면책동의서', '의료진술서', '다이빙 로그', '디브리핑']],
  ['CERTIFICATION', 'FUN_DIVE', 'accepted', []],
  ['CERTIFICATION', 'CERTIFICATION', 'accepted', ['면책동의서', '의료진술서'], false],
  ['CERTIFICATION', 'LECTURE', 'accepted', [], null],
  ['CERTIFICATION', 'LECTURE', 'accepted', [], true, '0'],
  ['CERTIFICATION', 'LECTURE', 'accepted', [], true, '4'],
  ['CERTIFICATION', 'CERTIFICATION', 'pending', ['일정등록 요청을 보냈어요!']],
  ['CERTIFICATION', 'CERTIFICATION', 'rejected', ['일정등록 요청을 거부했어요. 😢', '요청 지우기', '다시 요청하기']],
]) {
  test(`participant controls follow personal ${personal}/${status}, permission=${canViewDivingLog}, viewer=${viewerLevel}, owner=${owner}, not overall ${overall}`, async () => {
    const h = hookDriver();
    const { createLatestRequest } = loadModule('utils/latestRequest.ts', {});
    const request = createLatestRequest();
    const data = { id: 12, categoryCode: overall, isOwner: owner, scheduleDate: '2026-09-23', participants: [{ id: 2, nickname: 'Student', categoryCode: personal, invitationStatus: status, canViewDivingLog, canWriteDebriefing: canViewDivingLog }] };
    const Screen = loadModule('app/schedule-detail.tsx', {
      react: { ...h.react, createElement: (type, props, ...children) => ({ type, props, children }) },
      'react-native': { StyleSheet: { create: value => value }, Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} } },
      '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-blur': {}, '@/components/PopupBackdrop': {}, '@/components/TemporaryUserLinkModal': {}, 'expo-clipboard': {}, 'expo-web-browser': {},
      'expo-router': { useLocalSearchParams: () => ({ id: '12' }), useRouter: () => ({}), useFocusEffect: callback => h.react.useEffect(callback, [callback]) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }, 'expo-status-bar': {},
      '@/constants/Colors': { default: loadModule('constants/Colors.ts', {}).default, __esModule: true },
      '@/hooks/useLatestRequest': { useLatestRequest: () => request },
      '@/services/api': { api: { getScheduleDetail: async () => ({ schedule: data }) } },
      '@/components/Spinner': {}, '@/components/ProfileAvatar': {}, '@/components/ProfileLink': {},
    '@/contexts/AuthContext': { useAuth: () => ({ user: { id: 'teacher', level: viewerLevel } }) },
    '@/utils/userRole': loadModule('utils/userRole.ts', {}),
    }).default;
    h.render(Screen); await flush();
    const tree = h.render(Screen);
    const labels = [];
    const visit = value => {
      if (typeof value === 'string') labels.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value?.children) visit(value.children);
    };
    visit(tree);
    for (const label of ['면책동의서', '의료진술서', '다이빙 로그', '디브리핑', '일정등록 요청을 보냈어요!', '일정등록 요청을 거부했어요. 😢', '요청 지우기', '다시 요청하기']) {
      assert.equal(labels.includes(label), expected.includes(label), label);
    }
    h.unmount();
  });
}

for (const file of ['app/profile.tsx', 'components/UserProfileView.tsx']) {
  for (const certifications of [undefined, [
    { id: 9, name: 'PADI Master Freediver', nameKo: 'PADI 마스터 프리다이버' },
    { id: 5, name: 'AIDA Instructor', nameKo: null },
  ]]) {
    test(`${file}: displays only recorded certifications (${certifications ? 'multiple associations' : 'legacy level only'})`, async () => {
      const h = hookDriver();
      const result = { user: { id: 2, nickname: 'diver' }, profile: { level: '5' }, certifications, isMyStudent: true };
      const screen = loadModule(file, {
        react: { ...h.react, createElement: (type, props, ...children) => ({ type, props, children }) },
        'react-native': { StyleSheet: { create: x => x }, Platform: { OS: 'ios' } },
        'expo-router': { useRouter: () => ({}), useLocalSearchParams: () => ({ userId: 'diver' }), useFocusEffect: cb => h.react.useEffect(cb, [cb]) },
        'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
        'expo-status-bar': {},
        '@/constants/Colors': { default: loadModule('constants/Colors.ts', {}).default, __esModule: true },
        '@/contexts/AuthContext': { useAuth: () => ({ user: result.user, updateUser() {} }) },
        '@/components/Spinner': {}, '@/components/LevelBadge': {},
        '@/utils/userRole': loadModule('utils/userRole.ts', {}),
        '@/services/api': { api: {
          getProfile: async () => result, getUserProfile: async () => result,
          getCertPendingCount: async () => ({ count: 0 }), getInquiryPendingCount: async () => ({ count: 0 }),
          getPendingMembers: async () => ({ members: [] }),
        } },
      }).default;
      const renderProfile = () => screen({ userId: 'diver', onClose() {}, onOpenLog() {} });
      h.render(renderProfile); await flush();
      const texts = [];
      const walk = value => {
        if (typeof value === 'string') texts.push(value);
        else if (Array.isArray(value)) value.forEach(walk);
        else if (value?.children) walk(value.children);
      };
      walk(h.render(renderProfile));
      if (file === 'components/UserProfileView.tsx') assert.equal(texts.includes('다이빙 로그'), false, 'unqualified viewer must ignore stale isMyStudent=true');
      assert.equal(texts.includes('강사'), false);
      assert.equal(texts.includes('Lv.4'), false);
      assert.equal(texts.includes('PADI 마스터 프리다이버'), !!certifications);
      assert.equal(texts.includes('AIDA Instructor'), !!certifications);
    });
  }
}

function temporaryEditorFixture(overrides = {}, params = {}, searchState = {}) {
  const driver = hookDriver();
  const api = {
    getProfile: async () => ({ user: { id: 10 } }),
    getUserSettings: async () => ({ settings: {} }),
    getDivingPools: async () => ({ pools: [] }),
    getCloseFriends: async () => ({ friends: [] }),
    ...overrides,
  };
  const requests = loadModule('utils/latestRequest.ts', {});
  const latest = loadModule('hooks/useLatestRequest.ts', { react: driver.react, '@/utils/latestRequest': requests });
  const alerts = [];
  const keyboardEvents = new Map();
  let dismissCount = 0;
  const navigationEvents = [];
  let prevention;
  const router = { back() { navigationEvents.push('back'); }, push(value) { navigationEvents.push(value); } };
  const navigation = { dispatch(action) { navigationEvents.push(action); } };
  const hook = loadModule('features/schedule/useScheduleEditor.ts', {
    react: driver.react,
    'react-native': { Alert: { alert: (...args) => alerts.push(args) }, Keyboard: { dismiss() { dismissCount++; }, addListener: (event, callback) => { keyboardEvents.set(event, callback); return { remove() { keyboardEvents.delete(event); } }; } } },
    '@/contexts/AuthContext': { useAuth: () => ({ user: { id: '10', level: '5' } }) },
    '@/utils/userRole': { hasInstructorAccess: () => true },
    '@/utils/format': { maskPhone: value => value },
    'expo-router': { useLocalSearchParams: () => params, useRouter: () => router, useNavigation: () => navigation },
    'expo-router/react-navigation': { usePreventRemove: (enabled, callback) => { prevention = { enabled, callback }; } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/hooks/useSearch': { useUserSearch: query => ({ results: [], searching: false, error: false, completedQuery: query.trim(), ...searchState }) },
    '@/hooks/useLatestRequest': latest,
    '@/services/api': { api },
  });
  return { render: () => driver.render(hook.useScheduleEditor), alerts, keyboardEvents, navigationEvents, get prevention() { return prevention; }, get dismissCount() { return dismissCount; } };
}

test('temporary participant registration trims the name and prevents duplicate taps', async () => {
  const pending = deferred();
  const names = [];
  const editor = temporaryEditorFixture({ createTemporaryUser: name => { names.push(name); return pending.promise; } });
  editor.render().setTemporaryName('  홍길동  ');
  editor.render().setTemporaryCategory('LECTURE');
  const form = editor.render();
  const first = form.handleCreateTemporary();
  await form.handleCreateTemporary();
  assert.deepEqual(names, ['홍길동']);
  pending.resolve({ user: { id: 23, userId: 'temporary-23', nickname: '홍길동', isTemporary: true } });
  await first;
  assert.equal(editor.render().participants[0].user.id, 23);
  assert.equal(editor.render().participants[0].user.isTemporary, true);
  assert.equal(editor.render().participants[0].categoryCode, 'LECTURE');
  assert.equal(editor.render().currentUser, null);
  assert.equal(editor.render().searchQuery, '');
  assert.equal(editor.render().showTemporaryModal, false);
});

test('friend selection distinguishes two people with the same name', async () => {
  const editor = temporaryEditorFixture({ searchUsers: async () => ({ users: [
    { id: 1, userId: 'regular', nickname: '동명이인' },
    { id: 23, userId: 'temporary-23', nickname: '동명이인', isTemporary: true },
  ] }) });
  await editor.render().handleSelectFriend({ userId: 'temporary-23', nickname: '동명이인' });
  assert.equal(editor.render().currentUser.id, 23);
});

test('editing a schedule keeps a temporary participant’s common user ID and label', async () => {
  const editor = temporaryEditorFixture({ getScheduleDetail: async () => ({ schedule: {
    title: '교육', scheduleDate: '2026-10-01', startHour: 9, startMinute: 0,
    categoryCode: 'LECTURE', participants: [{ id: 23, userId: 'temporary-23', nickname: '임시', isTemporary: true, isGuest: false }],
  } }) }, { id: '1' });
  editor.render();
  await flush();
  const participant = editor.render().participants[0];
  assert.equal(participant.user.id, 23);
  assert.equal(participant.user.isTemporary, true);
});

test('failed temporary registration keeps the entered name and permits retry', async () => {
  const editor = temporaryEditorFixture({ createTemporaryUser: async () => { throw new Error('연결 실패'); } });
  editor.render().setTemporaryName('이름');
  editor.render().setTemporaryCategory('LECTURE');
  await editor.render().handleCreateTemporary();
  const state = editor.render();
  assert.equal(state.currentUser, null);
  assert.equal(state.temporaryName, '이름');
  assert.equal(state.creatingTemporary, false);
  assert.equal(editor.alerts[0][0], '등록 실패');
});

for (const [label, searchState, expected] of [
  ['completed empty search', {}, true],
  ['pending search', { searching: true }, false],
  ['failed search', { error: true }, false],
  ['outdated response', { completedQuery: 'previous' }, false],
  ['existing user', { results: [{ id: 20, nickname: '이름' }] }, false],
  ['already selected self', { results: [{ id: 10, nickname: '이름' }] }, false],
]) {
  test(`temporary registration offer: ${label}`, async () => {
    const editor = temporaryEditorFixture({}, {}, searchState);
    assert.equal(editor.render().canRegisterTemporary, false);
    editor.render().setSearchQuery('이름');
    await flush();
    assert.equal(editor.render().canRegisterTemporary, expected);
  });
}

test('temporary popup pre-fills the searched name and category; cancel adds nobody', () => {
  const editor = temporaryEditorFixture();
  editor.render().setSearchQuery('  이름  ');
  editor.render().setCategoryCode('TRAINING');
  editor.render().openTemporaryModal();
  let state = editor.render();
  assert.equal(state.temporaryName, '이름');
  assert.equal(state.temporaryCategory, 'TRAINING');
  assert.equal(state.showTemporaryModal, true);
  state.closeTemporaryModal();
  state = editor.render();
  assert.equal(state.showTemporaryModal, false);
  assert.equal(state.participants.length, 0);
  assert.equal(state.searchQuery, '  이름  ');
});

test('temporary popup validates category before creating a user', async () => {
  let calls = 0;
  const editor = temporaryEditorFixture({ createTemporaryUser: async () => { calls++; } });
  editor.render().setTemporaryName('이름');
  await editor.render().handleCreateTemporary();
  assert.equal(calls, 0);
  assert.equal(editor.alerts[0][0], '분류 확인');
});


test('participant reveal includes the card heading and enough bottom space after keyboard resizing', () => {
  const editor = temporaryEditorFixture();
  const calls = [];
  let state = editor.render();
  state.participantScrollRef.current = { scrollTo: value => calls.push(value) };
  state.handleParticipantLayout({ nativeEvent: { layout: { height: 600 } } });
  state.handleNewParticipantLayout({ nativeEvent: { layout: { y: 400, height: 240 } } });
  assert.equal(calls.length, 0);
  state.handleSearchFocus(); state = editor.render();
  assert.equal(state.participantBottomPadding, 344);
  assert.equal(calls.at(-1).y, 384, 'align the entire card, not the nested input');
  assert.equal(400 + 240 + state.participantBottomPadding - 600, 384);
  state.handleParticipantLayout({ nativeEvent: { layout: { height: 300 } } });
  state.handleNewParticipantLayout({ nativeEvent: { layout: { y: 400, height: 450 } } });
  state = editor.render();
  assert.equal(state.participantBottomPadding, 40, 'long cards remain scrollable');
  editor.keyboardEvents.get('keyboardDidHide')();
  state.handleParticipantLayout({ nativeEvent: { layout: { height: 700 } } });
  state = editor.render();
  assert.equal(state.participantBottomPadding, 234);
  assert.equal(calls.at(-1).y, 384);
  state.handleParticipantScrollBeginDrag(); const before = calls.length;
  state.scrollParticipantIntoView(); editor.keyboardEvents.get('keyboardDidHide')();
  assert.equal(calls.length, before, 'manual scrolling must not snap back');
});

test('tab taps reveal the whole card without input focus, including tapping the active tab', () => {
  const editor = temporaryEditorFixture(); const calls = [];
  let state = editor.render(); state.participantScrollRef.current = { scrollTo: value => calls.push(value) };
  state.handleNewParticipantLayout({ nativeEvent: { layout: { y: 360, height: 240 } } });
  state.handleParticipantTabChange('friends'); state = editor.render();
  assert.equal(state.participantTab, 'friends'); assert.equal(editor.dismissCount, 1);
  assert.equal(calls.at(-1).y, 344);
  state.handleParticipantScrollBeginDrag(); const before = calls.length;
  state.handleParticipantTabChange('friends'); assert.equal(calls.length, before + 1);
  state.handleNewParticipantLayout({ nativeEvent: { layout: { y: 420, height: 300 } } });
  assert.equal(calls.at(-1).y, 404, 'apply the updated layout after a tab changes');
  state.handleParticipantTabChange('search'); state = editor.render();
  assert.equal(state.participantTab, 'search'); assert.equal(calls.at(-1).y, 404);
});

for (const users of [[], [{ id: 23, nickname: '검색 결과' }]]) {
  test(`completed search reveals the card without focus (${users.length} results)`, () => {
    const search = { searching: true, completedQuery: null, results: [] };
    const editor = temporaryEditorFixture({}, {}, search); const calls = [];
    editor.render().setTitle('테스트'); editor.render().setCategoryCode('TRAINING');
    editor.render().handleNextStep(); let state = editor.render();
    state.participantScrollRef.current = { scrollTo: value => calls.push(value) };
    state.handleNewParticipantLayout({ nativeEvent: { layout: { y: 300, height: 260 } } });
    state.setSearchQuery('검색'); editor.render(); assert.equal(calls.length, 0);
    Object.assign(search, { searching: false, completedQuery: '검색', results: users });
    state = editor.render(); assert.equal(calls.at(-1).y, 284);
  });
}

test('search submit blurs and dismisses the keyboard then realigns after it closes', () => {
  const editor = temporaryEditorFixture(); const calls = []; let blurred = 0;
  const state = editor.render();
  state.searchInputRef.current = { blur: () => blurred++ };
  state.participantScrollRef.current = { scrollTo: value => calls.push(value) };
  state.handleNewParticipantLayout({ nativeEvent: { layout: { y: 280, height: 240 } } });
  state.handleSearchSubmit(); assert.equal(blurred, 1); assert.equal(editor.dismissCount, 1);
  editor.keyboardEvents.get('keyboardDidHide')(); assert.equal(calls.at(-1).y, 264);
});

function scheduleLinkResumeHarness() {
  const h = hookDriver();
  const destinations = [];
  const { useScheduleLinkResume } = loadModule('hooks/useScheduleLinkResume.ts', { react: h.react });
  const replace = value => destinations.push(value);
  return {
    destinations,
    render: props => h.render(() => useScheduleLinkResume({
      id: undefined, filter: undefined, isLoading: false, isLoggedIn: false, replace, ...props,
    })),
  };
}

test('schedule link survives onboarding and login and resumes once after login navigation', () => {
  const h = scheduleLinkResumeHarness();
  h.render({ route: 'schedule-detail', id: '42', filter: 'notification' });
  h.render({ route: 'onboarding' });
  h.render({ route: 'login' });
  h.render({ route: 'login', isLoggedIn: true });
  assert.equal(h.destinations.length, 0);
  h.render({ route: '(tabs)', isLoggedIn: true });
  assert.equal(h.destinations.length, 1);
  assert.equal(h.destinations[0].params.id, '42');
  assert.equal(h.destinations[0].params.filter, 'notification');
  h.render({ route: 'profile', isLoggedIn: true });
  h.render({ route: '(tabs)', isLoggedIn: true });
  assert.equal(h.destinations.length, 1);
});

test('restored session opening schedule directly does not reopen it after leaving', () => {
  const h = scheduleLinkResumeHarness();
  h.render({ route: 'schedule-detail', id: '42', isLoading: true });
  h.render({ route: 'schedule-detail', id: '42', isLoggedIn: true });
  h.render({ route: '(tabs)', isLoggedIn: true });
  assert.equal(h.destinations.length, 0);
});

test('invalid schedule destinations are not resumed', () => {
  for (const id of ['0', '-1', 'abc', ['42', '43'], '9007199254740992']) {
    const h = scheduleLinkResumeHarness();
    h.render({ route: 'schedule-detail', id });
    h.render({ route: '(tabs)', isLoggedIn: true });
    assert.equal(h.destinations.length, 0);
  }
});

test('new schedule link during login replaces earlier pending destination', () => {
  const h = scheduleLinkResumeHarness();
  h.render({ route: 'schedule-detail', id: '42' });
  h.render({ route: 'login' });
  h.render({ route: 'schedule-detail', id: '43' });
  h.render({ route: '(tabs)', isLoggedIn: true });
  assert.equal(h.destinations[0].params.id, '43');
});

test('schedule back returns from participants to info without removing the screen', async () => {
  const h = temporaryEditorFixture();
  let view = h.render(); await flush();
  view.setTitle('Training'); view.setCategoryCode('TRAINING');
  view = h.render(); view.handleNextStep(); view = h.render();
  assert.equal(view.step, 'participant');
  assert.equal(h.prevention.enabled, true);
  h.prevention.callback({ data: { action: { type: 'GO_BACK' } } });
  assert.equal(h.render().step, 'info');
  assert.equal(h.alerts.length, 0);
  assert.equal(h.navigationEvents.length, 0);
});

test('schedule discard prompt cancels safely and resumes the original action once', () => {
  const h = temporaryEditorFixture();
  let view = h.render();
  assert.equal(h.prevention.enabled, false);
  view.setTitle('Unsaved'); h.render();
  const action = { type: 'POP', payload: { count: 1 } };
  h.prevention.callback({ data: { action } });
  h.prevention.callback({ data: { action } });
  assert.equal(h.alerts.length, 1);
  h.alerts[0][2][0].onPress();
  assert.equal(h.navigationEvents.length, 0);
  h.prevention.callback({ data: { action } });
  h.alerts[1][2][1].onPress();
  assert.equal(h.navigationEvents.length, 1);
  assert.equal(h.navigationEvents[0], action);
});

for (const success of [true, false]) {
  test(`schedule save ${success ? 'releases prevention before navigation' : 'keeps unsaved input protected on failure'}`, async () => {
    const pending = deferred();
    const h = temporaryEditorFixture({ createSchedule: () => pending.promise });
    let view = h.render(); await flush();
    view.setTitle('Training'); view.setCategoryCode('TRAINING');
    view = h.render(); view.handleSave();
    const saving = h.alerts.at(-1)[2][1].onPress();
    h.render();
    assert.equal(h.prevention.enabled, true);
    const alertsBeforeBack = h.alerts.length;
    h.prevention.callback({ data: { action: { type: 'GO_BACK' } } });
    assert.equal(h.alerts.length, alertsBeforeBack);
    assert.equal(h.navigationEvents.length, 0);
    if (success) pending.resolve({ scheduleId: 123 });
    else pending.reject(new Error('Save failed'));
    await saving;
    assert.equal(h.navigationEvents.length, 0, 'wait for prevention state to render');
    view = h.render();
    assert.equal(h.prevention.enabled, !success);
    if (success) assert.equal(h.navigationEvents[0], 'back');
    else {
      assert.equal(view.title, 'Training');
      assert.equal(view.saving, false);
      assert.equal(h.navigationEvents.length, 0);
    }
  });
}

for (const isEdit of [false, true]) {
  test(`AIDA selection replaces content in the open picker (${isEdit ? 'edit' : 'create'})`, async () => {
    const response = deferred();
    const h = temporaryEditorFixture({
      getAssociations: async () => ({ associations: [{ id: 1, name: 'AIDA International' }] }),
      getAvailableLicenses: () => response.promise,
      getScheduleDetail: async () => ({ schedule: { title: '수정', scheduleDate: '2026-10-08', categoryCode: 'TRAINING', participants: [] } }),
    }, isEdit ? { id: '42' } : {});
    h.render(); await flush();
    h.render().handleSelectUser({ id: 23, nickname: 'Diver' });
    await h.render().handleAddLicense();
    const request = h.render().handleSelectAssociation(1);
    let view = h.render();
    assert.equal(view.showAssociationPicker, true, 'keep the same native modal open during the request');
    assert.equal(view.availableLicensesLoading, true);
    response.resolve({ licenses: [{ licenseId: 7, code: 'AIDA2', nameKo: 'AIDA 2' }] });
    await request;
    view = h.render();
    assert.equal(view.showAssociationPicker, false);
    assert.equal(view.showAvailableLicensePicker, true);
    assert.equal(view.availableLicensesLoading, false);
    view.handleSelectNewLicense(view.availableLicenses[0]);
    view.closeLicensePicker();
    view = h.render();
    assert.equal(view.currentNewLicenses[0].licenseId, 7);
    assert.equal(view.showAssociationPicker || view.showAvailableLicensePicker, false);
  });
}

test('closing the association picker ignores a late license response', async () => {
  const response = deferred();
  const h = temporaryEditorFixture({ getAssociations: async () => ({ associations: [] }), getAvailableLicenses: () => response.promise });
  h.render().handleSelectUser({ id: 23, nickname: 'Diver' });
  await h.render().handleAddLicense();
  const request = h.render().handleSelectAssociation(1);
  h.render().closeLicensePicker();
  response.resolve({ licenses: [{ licenseId: 7, nameKo: 'AIDA 2' }] });
  await request;
  const view = h.render();
  assert.equal(view.showAssociationPicker || view.showAvailableLicensePicker, false);
  assert.equal(view.availableLicensesLoading, false);
});

test('license request failure leaves the association picker available for retry', async () => {
  const h = temporaryEditorFixture({ getAssociations: async () => ({ associations: [] }), getAvailableLicenses: async () => { throw new Error('network'); } });
  h.render().handleSelectUser({ id: 23, nickname: 'Diver' });
  await h.render().handleAddLicense();
  await h.render().handleSelectAssociation(1);
  const view = h.render();
  assert.equal(view.showAssociationPicker, true);
  assert.equal(view.showAvailableLicensePicker, false);
  assert.equal(view.availableLicensesLoading, false);
  assert.equal(h.alerts.at(-1)[1], '자격증 목록을 불러올 수 없습니다.');
});
