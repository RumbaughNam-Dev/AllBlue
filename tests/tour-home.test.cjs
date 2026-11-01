const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { hookDriver } = require('./notice-test-helpers.cjs');
const nodes = value => !value ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === 'object' ? [value, ...nodes(value.children)] : [];
const element = (type, props, ...children) => ({ type, props: props || {}, children });
const flush = () => new Promise(setImmediate);
const alerts = [];
const ui = loadModule('features/tour/ui.ts', { 'react-native': { Alert: { alert: (...args) => alerts.push(args) } } });

const card = (id, extra = {}) => ({
  id, title: `투어 ${id}`, status: 'RECRUITING', continentCode: 'ASIA', countryCode: 'PH', countryName: '필리핀',
  startDate: '2026-11-14', endDate: '2026-11-17', capacity: 8, recruitedCount: 3, imageUrl: null, instructor: { userId: 'i', nickname: '럼바우' }, ...extra,
});

test('tour period, recruitment and status labels', () => {
  assert.equal(ui.formatTourPeriod('2026-11-14', '2026-11-17'), '11.14 - 11.17');
  assert.equal(ui.formatTourPeriod('2026-11-30', '2026-11-30'), '11.30');
  assert.equal(ui.formatRecruitment(3, 8), '3/8명');
  assert.deepEqual(Object.keys(ui.TOUR_STATUS), ['PENDING', 'REJECTED', 'PREPARING', 'RECRUITING', 'CLOSED', 'CANCELED', 'COMPLETED', 'UNPROCESSED']);
  assert.equal(ui.TOUR_STATUS.CLOSED.label, '모집 마감');
  ui.showTourComingSoon();
  assert.equal(alerts[0][0], '준비 중이에요');
});

function homeHook(responses) {
  const h = hookDriver();
  const { useTourHome } = loadModule('features/tour/useTourHome.ts', {
    react: h.react,
    'expo-router': { useFocusEffect: fn => h.react.useEffect(fn, [fn]) },
    '@/services/api': { api: { getTourHome: () => responses.shift()() } },
    '@/hooks/useLatestRequest': loadModule('hooks/useLatestRequest.ts', { react: h.react, '@/utils/latestRequest': loadModule('utils/latestRequest.ts', {}) }),
  });
  return { render: () => h.render(useTourHome), unmount: h.unmount };
}

test('tour home loads, keeps shown data when a refresh fails, and ignores late answers', async () => {
  const first = { canCreate: false, banners: [], recent: [card(1)], popular: [] };
  let resolveSlow;
  const responses = [() => Promise.resolve(first), () => Promise.reject(Error('offline')), () => new Promise(r => { resolveSlow = r; }), () => Promise.resolve({ ...first, recent: [card(2)] })];
  const f = homeHook(responses);
  let view = f.render();
  assert.equal(view.loading, true);
  await flush(); view = f.render();
  assert.equal(view.loading, false); assert.equal(view.home.recent[0].id, 1);
  await view.refresh(); view = f.render();
  assert.equal(view.error, true, 'the failure is remembered');
  assert.equal(view.home.recent[0].id, 1, 'but what was shown stays');
  assert.equal(view.refreshing, false);
  view.refresh(); view.retry(); await flush(); view = f.render();
  assert.equal(view.home.recent[0].id, 2); assert.equal(view.error, false);
  resolveSlow({ ...first, recent: [card(9)] }); await flush(); view = f.render();
  assert.equal(view.home.recent[0].id, 2, 'an older answer arriving late is ignored');
  f.unmount();
});

function screen(state) {
  const h = hookDriver();
  const Screen = loadModule('features/tour/TourHomeScreen.tsx', {
    react: { ...h.react, createElement: element },
    'react-native': {
      ...Object.fromEntries(['View', 'Text', 'ScrollView', 'FlatList', 'Pressable', 'Image', 'ActivityIndicator', 'RefreshControl'].map(n => [n, n])),
      StyleSheet: { create: x => x }, Platform: { OS: 'ios' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 34, right: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/constants/Colors': { brand: { primary: '#144A84', white: '#fff' } },
    '@/components/GlassChip': { __esModule: true, default: 'GlassChip' },
    '@/utils/tabBarLayout': loadModule('utils/tabBarLayout.ts', {}),
    './TourBanner': { __esModule: true, default: 'TourBanner' },
    './ui': ui,
    './useTourHome': { useTourHome: () => ({ refreshing: false, error: false, retry() {}, refresh() {}, loading: false, ...state }) },
  }).default;
  // First render measures nothing; lay the screen out at phone width like onLayout would.
  let tree = h.render(Screen);
  nodes(tree).find(n => n.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 390 } } });
  tree = h.render(Screen);
  return nodes(tree);
}
const named = (all, name) => all.filter(n => n.type?.name === name);

test('tour home shows create and manage only to instructors, search to everyone', () => {
  const home = { canCreate: true, banners: [], recent: [card(1)], popular: [] };
  assert.deepEqual(named(screen({ home }), 'ActionChip').map(n => n.props.label), ['투어 만들기', '투어 관리', '투어 검색']);
  assert.deepEqual(named(screen({ home: { ...home, canCreate: false } }), 'ActionChip').map(n => n.props.label), ['투어 검색']);
});

test('tour home sections appear only with content; 16:9 banner capped at a third of the screen', () => {
  const banners = [{ id: 1, imageUrl: 'b', tourId: 1 }];
  let all = screen({ home: { canCreate: false, banners, recent: [card(1), card(2)], popular: [card(3)] } });
  const banner = all.find(n => n.type === 'TourBanner');
  assert.equal(banner.props.width, 350);
  assert.equal(banner.props.height, 350 * 9 / 16);
  assert.deepEqual(named(all, 'SectionHeader').map(n => n.props.title), ['최근 등록된 투어', '최근 관심이 많은 투어']);
  assert.equal(all.find(n => n.type === 'FlatList').props.data.length, 2);
  assert.equal(named(all, 'TourRow').length, 1);

  all = screen({ home: { canCreate: false, banners: [], recent: [], popular: [card(3)] } });
  assert.equal(all.find(n => n.type === 'TourBanner'), undefined);
  assert.deepEqual(named(all, 'SectionHeader').map(n => n.props.title), ['최근 관심이 많은 투어']);
});

test('tour home empty, loading and error states', () => {
  const texts = all => all.filter(n => n.type === 'Text').flatMap(n => n.children).filter(c => typeof c === 'string');
  assert.ok(texts(screen({ home: { canCreate: false, banners: [], recent: [], popular: [] } })).includes('등록된 투어가 없어요.'));
  assert.ok(screen({ home: null, loading: true }).some(n => n.type === 'ActivityIndicator'));
  assert.ok(texts(screen({ home: null, error: true })).some(t => t.includes('다시 시도')));
});
