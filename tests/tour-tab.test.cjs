const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
// Stable reference: the toolbar's focus effect depends on reload.
const ADMIN_COUNTS = { total: 0, reload: async () => {} };
const { hookDriver } = require('./notice-test-helpers.cjs');
const nodes = value => !value ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === 'object' ? [value, ...nodes(value.children)] : [];
const element = (type, props, ...children) => ({ type, props: props || {}, children });

function tabBar(stripWidth) {
  const h = hookDriver(), springs = [], navigated = [];
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }
  const Bar = loadModule('components/CustomTabBar.tsx', {
    react: { ...h.react, createElement: element },
    'react-native': {
      View: 'View', Image: 'Image', Pressable: 'Pressable', Platform: { OS: 'ios' }, StyleSheet: { create: x => x }, Easing: {},
      Animated: { View: 'AnimatedView', Value, spring: (value, options) => ({ start() { springs.push(options.toValue); value.setValue(options.toValue); } }) },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
    'expo-blur': { BlurView: 'BlurView' },
    '@/utils/liquidGlass': { LiquidGlassView: null },
    '@/utils/tabBarLayout': loadModule('utils/tabBarLayout.ts', {}),
    '@/constants/Colors': { brand: { white: '#fff' } },
    '@expo/vector-icons': { Ionicons: 'Ionicons', MaterialCommunityIcons: 'MaterialCommunityIcons' },
    '@/assets/images/icon-snorkel-tab.png': 'snorkel',
  }).default;
  // names: the routes the navigator passes, focused: the selected one, hidden: routes still in state but hidden.
  const render = (names, focused, hidden = []) => {
    const routes = names.map(name => ({ key: `${name}-key`, name }));
    const descriptors = Object.fromEntries(routes.map(route => [route.key, { options: { hidden: hidden.includes(route.name) } }]));
    return h.render(() => Bar({
      state: { index: names.indexOf(focused), routes }, descriptors, insets: {}, stripWidth,
      emitter: { emit: () => ({ defaultPrevented: false }) }, navigateToTab: key => navigated.push(key),
    }));
  };
  const icons = tree => nodes(tree).filter(node => node.props.tab).map(node => [node.props.tab.icon || node.props.tab.image, node.props.focused]);
  const highlight = tree => nodes(tree).find(node => node.type === 'AnimatedView')?.props.style[1];
  const layout = (tree, size) => nodes(tree).find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: size } });
  return { render, icons, highlight, layout, springs, navigated };
}

test('tab bar draws icons by route name, only for shown tabs', () => {
  const f = tabBar();
  assert.deepEqual(f.icons(f.render(['index', 'b', 'c'], 'c')), [['calendar', false], ['snorkel', false], ['people', true]]);
  assert.deepEqual(f.icons(f.render(['index', 'b', 'c', 'tour'], 'tour')), [['calendar', false], ['snorkel', false], ['people', false], ['bag-suitcase', true]]);
  // A hidden route left in state gets no slot and doesn't shift the others or the focus.
  const tree = f.render(['index', 'tour', 'b', 'c'], 'c', ['tour']);
  assert.deepEqual(f.icons(tree), [['calendar', false], ['snorkel', false], ['people', true]]);
  assert.equal(nodes(tree).filter(node => node.type === 'Pressable').length, 3);
});

test('highlight follows the focused tab and resizes when the tour tab appears', () => {
  const f = tabBar();
  let tree = f.render(['index', 'b', 'c'], 'c');
  assert.equal(f.highlight(tree), undefined, 'no highlight before the bar is measured');
  f.layout(tree, { width: 308, height: 56 });
  tree = f.render(['index', 'b', 'c'], 'c');
  assert.equal(f.highlight(tree).width, 100);
  assert.equal(f.highlight(tree).transform[0].translateX.value, 200);
  // Profile refresh turns the account into an admin: four tabs share the same row.
  tree = f.render(['index', 'b', 'c', 'tour'], 'c');
  assert.equal(f.highlight(tree).width, 75);
  assert.equal(f.highlight(tree).transform[0].translateX.value, 150);
  nodes(tree).filter(node => node.type === 'Pressable')[3].props.onPress();
  assert.deepEqual(f.navigated, ['tour-key']);
  tree = f.render(['index', 'b', 'c', 'tour'], 'tour');
  assert.equal(f.highlight(tree).transform[0].translateX.value, 225);
});

test('vertical strip bar keeps square tabs whether three or four are shown', () => {
  const f = tabBar(60);
  let tree = f.render(['index', 'b', 'c', 'tour'], 'tour');
  f.layout(tree, { width: 56, height: 4 * 48 + 8 });
  tree = f.render(['index', 'b', 'c', 'tour'], 'tour');
  assert.deepEqual([f.highlight(tree).width, f.highlight(tree).height], [48, 48]);
  assert.equal(f.highlight(tree).transform[0].translateY.value, 144);
  tree = f.render(['index', 'b', 'c'], 'b');
  assert.equal(f.highlight(tree).height, 48);
  assert.equal(f.highlight(tree).transform[0].translateY.value, 48);
});

function tabScreens(user) {
  const h = hookDriver();
  const modules = {
    react: { ...h.react, createElement: element },
    'react-native': { StyleSheet: { create: x => x }, Platform: { OS: 'ios' } },
    'expo-router': { Tabs: Object.assign(() => null, { Screen: 'TabsScreen', Protected: 'TabsProtected' }), useRouter: () => ({}), useFocusEffect() {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, right: 0 }) },
    '@/constants/Colors': { brand: {} },
    '@/contexts/AuthContext': { useAuth: () => ({ user, updateUser: async () => {} }) },
    '@/services/api': { api: {} },
    'expo-router/native-tabs': { NativeTabs: { BottomAccessory: {} } },
    '@expo/vector-icons': { Ionicons: 'Ionicons', MaterialCommunityIcons: 'MaterialCommunityIcons' },
    '@/utils/tabBarLayout': { hasSideTabStrip: () => false },
    '@/components/StripTabBarHost': { StripTabBarRelay: () => null, useStripTabBarSetter: () => null },
    '@/hooks/useAdminPendingCounts': { useAdminPendingCounts: () => ADMIN_COUNTS, adminBadgeText: () => null },
  };
  for (const name of ['features/notices/StartupPopups', 'features/notifications/NotificationBell', 'components/CustomTabBar', 'components/SideSheet', 'components/ProfileAvatar', 'components/GlassCircle']) modules[`@/${name}`] = name;
  const TabLayout = loadModule('app/(tabs)/_layout.tsx', modules).default;
  const body = nodes(h.render(TabLayout)).find(node => node.type?.name === 'TabsBody');
  const tree = body.type(body.props);
  // 투어 · 커뮤니티 탭은 각자 guard로 막힘: 투어 탭을 감싼 guard를 봄
  const guards = nodes(tree).filter(node => node.type === 'TabsProtected');
  const named = guard => nodes(guard.children).filter(node => node.type === 'TabsScreen').map(node => node.props.name);
  const guard = guards.find(g => named(g).includes('tour'));
  return {
    screens: nodes(tree).filter(node => node.type === 'TabsScreen').map(node => node.props.name),
    guarded: named(guard),
    guard: guard.props.guard,
    community: guards.find(g => named(g).includes('community'))?.props.guard,
  };
}

test('tour tab is declared behind a guard that only admin accounts pass', () => {
  const admin = tabScreens({ id: 'a', level: 'A' });
  assert.deepEqual(admin.screens, ['index', 'b', 'c', 'community', 'tour']);
  assert.deepEqual(admin.guarded, ['tour']);
  assert.equal(admin.guard, true);
  assert.equal(admin.community, true);
  for (const user of [{ id: 'i', level: '5' }, { id: 'n', level: 5 }, { id: 'u', level: '1' }, { id: 'x' }, null]) {
    assert.equal(tabScreens(user).guard, false, `level ${user?.level} must not see the tour tab`);
    assert.equal(tabScreens(user).community, true, `level ${user?.level} sees the community tab (open to everyone since 2026-11-06)`);
  }
});
