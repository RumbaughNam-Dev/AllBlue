const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { hookDriver } = require('./notice-test-helpers.cjs');

test('toolbar refreshes cached levels on focus and foreground, ignoring old responses and account changes', async () => {
  const h = hookDriver(), pending = [], updates = [];
  let user = { id: 'first', level: '1', badgeLevel: '1' }, onState, focused = true;
  const react = { ...h.react, createElement: () => null };
  const modules = {
    react,
    'react-native': { StyleSheet: { create: x => x }, AppState: { addEventListener: (_, fn) => {
      onState = fn; return { remove() { onState = null; } };
    } } },
    'expo-router': { Tabs: { Screen: 'Screen' }, useRouter: () => ({}), useFocusEffect: fn => h.react.useEffect(() => focused ? fn() : undefined, [fn, focused]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@/constants/Colors': { brand: {} },
    '@/contexts/AuthContext': { useAuth: () => ({ user, updateUser: async data => { updates.push(data); user = { ...user, ...data }; } }) },
    '@/services/api': { api: { getProfile: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } },
  };
  for (const name of ['features/notices/StartupPopups', 'features/notifications/NotificationBell', 'components/CustomTabBar', 'components/SideSheet', 'components/ProfileAvatar', 'components/GlassCircle']) modules[`@/${name}`] = name;
  const Screen = loadModule('app/(tabs)/_layout.tsx', modules).default;
  const render = () => h.render(Screen);
  const flush = () => new Promise(setImmediate);
  render();
  assert.equal(pending.length, 1, 'cached level must not suppress fetching');
  pending.shift().resolve({ profile: { level: '2', badgeLevel: '2' } });
  await flush(); render();
  assert.equal(user.badgeLevel, '2');
  assert.equal(pending.length, 0, 'updating the auth user must not cause a fetch loop');
  onState('active'); onState('active');
  pending[1].resolve({ profile: { level: 'A', badgeLevel: '4' } });
  pending[0].resolve({ profile: { level: '2', badgeLevel: '2' } });
  pending.length = 0;
  await flush(); render();
  assert.equal(user.badgeLevel, '4');
  assert.equal(user.level, 'A');
  onState('active');
  const stale = pending.shift();
  user = { id: 'second', level: '1' }; render();
  stale.resolve({ profile: { level: 'A', badgeLevel: '5' } });
  pending.shift().reject(Error('offline'));
  await flush();
  assert.equal(user.level, '1');
  assert.equal(updates.length, 2);
  focused = false; render();
  focused = true; render();
  pending.shift().resolve({ profile: { level: '3', badgeLevel: '3' } });
  await flush();
  assert.equal(user.badgeLevel, '3', 'returning to tabs refreshes the badge again');
  h.unmount();
  assert.equal(onState, null);
});
