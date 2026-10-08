const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadModule } = require('./helpers.cjs');
const { mergeNotificationWindow } = loadModule('features/notifications/window.ts', {});
const page = (hi, lo) => Array.from({ length: hi - lo + 1 }, (_, i) => ({ id: hi - i }));

test('inbox stays bounded while paging down and back up without duplicates or lost boundaries', () => {
  let rows = page(100, 91);
  for (let high = 90; high >= 20; high -= 10) {
    const result = mergeNotificationWindow(rows, page(high, high - 9), 'older');
    rows = result.items;
    assert.ok(rows.length <= 50);
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  }
  assert.deepEqual(Array.from(rows, row => row.id), page(60, 11).map(row => row.id));
  const result = mergeNotificationWindow(rows, page(70, 61), 'newer');
  assert.equal(result.prepended, 10);
  assert.equal(result.trimmed, 10);
  assert.deepEqual(Array.from(result.items, row => row.id), page(70, 21).map(row => row.id));
  const partial = mergeNotificationWindow(page(55, 6), page(5, 1), 'older');
  assert.equal(partial.items.length, 45);
  assert.equal(partial.trimmed, 10);
});

test('duplicate boundary items are not appended to the inbox', () => {
  const result = mergeNotificationWindow(page(20, 11), page(12, 3), 'older');
  assert.deepEqual(Array.from(result.items, row => row.id), page(20, 3).map(row => row.id));
});

test('push taps route once across cold-start/live delivery and ignore malformed payloads', async () => {
  const callbacks = {}, opened = [];
  const response = { notification: { request: { identifier: 'push-1', content: { data: { type: 'schedule', scheduleId: 12, notificationId: 3 } } } } };
  const removals = [];
  const notification = {
    setNotificationHandler() {},
    addNotificationResponseReceivedListener(fn) { callbacks.response = fn; return { remove: () => removals.push('response') }; },
    addNotificationReceivedListener(fn) { callbacks.received = fn; return { remove: () => removals.push('received') }; },
    getLastNotificationResponseAsync: async () => response,
  };
  const { observeSchedulePushes } = loadModule('services/push.ts', {
    'react-native': { Platform: { OS: 'ios' } }, './api': { api: {} },
    'expo-notifications': notification, 'expo-device': {}, 'expo-constants': {},
  });
  const cleanup = observeSchedulePushes((...args) => opened.push(args), () => {});
  callbacks.response(response);
  await new Promise(setImmediate);
  assert.deepEqual(opened, [[12, 3]]);
  callbacks.response({ notification: { request: { identifier: 'bad', content: { data: { type: 'schedule', scheduleId: 'https://elsewhere' } } } } });
  assert.equal(opened.length, 1);
  cleanup();
  callbacks.response({ notification: { request: { identifier: 'after-unmount', content: { data: { type: 'schedule', scheduleId: 13 } } } } });
  assert.equal(opened.length, 1);
  assert.equal(removals.length, 2);
});

const { formatNotificationDate } = loadModule('features/notifications/date.ts', {});
test('notification date accepts ISO dates and hides malformed legacy values', () => {
  for (const value of [{}, null, undefined, '', 'invalid']) assert.equal(formatNotificationDate(value), '');
  const iso = '2026-09-23T03:04:00.000Z';
  const local = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  assert.equal(formatNotificationDate(iso), `2026.09.23 · ${pad(local.getHours())}:${pad(local.getMinutes())}`);
});

function pushRegistrationFixture(os = 'ios', status = 'granted') {
  const calls = [];
  let handler;
  const notifications = {
    setNotificationHandler(value) { handler = value; },
    AndroidImportance: { MAX: 5 },
    async setNotificationChannelAsync() { calls.push('channel'); },
    async getPermissionsAsync() { calls.push('permissions'); return { status }; },
    async requestPermissionsAsync() { calls.push('request'); return { status }; },
    async getExpoPushTokenAsync({ projectId }) {
      assert.equal(projectId, 'project-id');
      calls.push('token'); return { data: 'ExponentPushToken[test]' };
    },
  };
  const { registerForPushNotifications } = loadModule('services/push.ts', {
    'react-native': { Platform: { OS: os } },
    './api': { api: { async registerPushToken(token, authToken) {
      assert.equal(token, 'ExponentPushToken[test]');
      assert.equal(authToken, 'session-token'); calls.push('register');
    } } },
    'expo-notifications': notifications,
    'expo-device': { isDevice: true },
    'expo-constants': { default: { expoConfig: { extra: { eas: { projectId: 'project-id' } } } } },
  });
  return { calls, handler, registerForPushNotifications };
}

test('push registration reads the actual expo-constants default export and registers with the server', async () => {
  const fixture = pushRegistrationFixture();
  assert.equal(await fixture.registerForPushNotifications('session-token'), 'ExponentPushToken[test]');
  assert.deepEqual(fixture.calls, ['permissions', 'token', 'register']);
});

test('Android creates a notification channel before requesting permissions or a push token', async () => {
  const fixture = pushRegistrationFixture('android');
  await fixture.registerForPushNotifications('session-token');
  assert.deepEqual(fixture.calls, ['channel', 'permissions', 'token', 'register']);
});

test('foreground notifications explicitly enable banners and notification list entries', async () => {
  const behavior = await pushRegistrationFixture().handler.handleNotification();
  assert.equal(behavior.shouldShowBanner, true);
  assert.equal(behavior.shouldShowList, true);
});

test('denied notification permissions do not request or register a push token', async () => {
  const fixture = pushRegistrationFixture('ios', 'denied');
  assert.equal(await fixture.registerForPushNotifications('session-token'), null);
  assert.deepEqual(fixture.calls, ['permissions', 'request']);
});
