const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { hookDriver } = require('./notice-test-helpers.cjs');
const nodes = v => !v ? [] : Array.isArray(v) ? v.flatMap(nodes) : typeof v === 'object' ? [v, ...nodes(v.children)] : [];
const text = v => v == null ? '' : Array.isArray(v) ? v.map(text).join('') : typeof v === 'object' ? text(v.children) : String(v);
const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const native = Object.fromEntries(['View','Text','ScrollView','Pressable','Modal'].map(x => [x,x]));
const colors = { brand: { primary: '#144A84', accent: '#00B4D8' } };
test('business contact opens requested email and Instagram URLs', async () => {
  const urls = [], events = [];
  const Screen = loadModule('components/BusinessContactPopup.tsx', {
    react, 'react-native': { ...native, StyleSheet: { create: x => x }, Linking: { openURL: async url => { events.push('open'); urls.push(url); } }, Alert: { alert() {} } },
    '@expo/vector-icons': {}, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }, '@/constants/Colors': { default: colors, __esModule: true },
  }).default;
  const tree = Screen({ onClose() { events.push('close'); } });
  const buttons = nodes(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityRole === 'button');
  buttons.find(n => text(n).includes('메일 보내기')).props.onPress();
  buttons.find(n => text(n).includes('인스타 DM 보내기')).props.onPress();
  assert.deepEqual(urls, ['mailto:rumbau.studio@gmail.com', 'https://ig.me/m/rumbaugh.nam']);
  assert.deepEqual(events, ['close', 'open', 'close', 'open']);
});
test('business popup waits until the side menu finishes closing', () => {
  const h = hookDriver(); let props = { visible: true, onClose: () => { props.visible = false; } }, finish;
  class Value { setValue() {} }
  const Screen = loadModule('components/SideSheet.tsx', {
    react: { ...h.react, ...react },
    'react-native': { ...native, StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 400 }), BackHandler: { addEventListener: () => ({ remove() {} }) },
      Animated: { Value, View: 'AnimatedView', timing: () => ({}), parallel: () => ({ start: fn => { finish = fn; } }) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-router': { useRouter: () => ({}) }, '@/constants/Colors': { default: colors, __esModule: true },
    '@/contexts/AuthContext': { useAuth: () => ({}) }, '@/components/PopupBackdrop': 'Backdrop', '@/components/BusinessContactPopup': 'BusinessPopup',
  }).default;
  const render = () => h.render(() => Screen(props)); render(); let tree = render();
  const menu = nodes(tree).filter(n => n.type === 'Pressable');
  const logout = menu.findIndex(n => text(n) === '로그아웃');
  assert.deepEqual(menu.slice(logout, logout + 3).map(text), ['로그아웃', '광고 문의', '회원탈퇴']);
  assert.equal(menu.some(n => text(n) === '비즈니스 문의'), false);
  menu[logout + 1].props.onPress(); tree = render();
  assert.equal(nodes(tree).some(n => n.type === 'BusinessPopup'), false);
  finish({ finished: true }); tree = render();
  assert.ok(nodes(tree).some(n => n.type === 'BusinessPopup'));
  nodes(tree).find(n => n.type === 'BusinessPopup').props.onClose();
  assert.equal(render(), null); h.unmount();
});
