const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadModule, storage } = require('./helpers.cjs');

function apiHarness(fetch, overrides = {}) {
  const store = storage({ authToken: 'session-a' });
  const alerts = [];
  let expired = 0;
  const module = loadModule('services/api.ts', {
    '@/constants/Environment': { API_BASE_URL: 'https://api-dev.rumbaugh.co.kr/allblue' },
    'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
    '@react-native-async-storage/async-storage': store,
    'expo-file-system': {
      File: class { upload() { return Promise.resolve({ status: 401, body: '<html>Unauthorized</html>' }); } },
      UploadType: { MULTIPART: 'multipart' },
    },
  }, { fetch, ...overrides });
  module.setSessionExpiredHandler(async () => { expired++; });
  return { ...module, store, alerts, get expired() { return expired; } };
}
const response = (status, body = '') => ({ status, text: async () => body });

test('concurrent non-JSON 401 responses expire a session and alert only once', async () => {
  const h = apiHarness(async () => response(401, '<html>Unauthorized</html>'));
  const results = await Promise.allSettled([h.api.getProfile(), h.api.getProfile(), h.api.getProfile()]);
  assert.ok(results.every((r) => r.status === 'rejected' && r.reason.status === 401 && r.reason._handled));
  assert.equal(h.expired, 1);
  assert.equal(h.alerts.length, 1);
});

test('a late 401 from an old login does not expire the new session', async () => {
  let finish;
  const h = apiHarness(() => new Promise((resolve) => { finish = resolve; }));
  const pending = h.api.getProfile();
  await new Promise(setImmediate);
  await h.store.setItem('authToken', 'session-b');
  finish(response(401));
  await assert.rejects(pending, (e) => e.status === 401);
  assert.equal(h.expired, 0);
  assert.equal(h.alerts.length, 0);
});

test('temporary registration credentials do not log out an existing session', async () => {
  let authorization;
  const h = apiHarness(async (_, options) => {
    authorization = options.headers.Authorization;
    return response(401);
  });
  await assert.rejects(h.api.verifyCode('01012345678', '1234', 'temporary'), (e) => e.status === 401 && !e._handled);
  assert.equal(authorization, 'Bearer temporary');
  assert.equal(h.expired, 0);
});

test('push revocation uses captured credentials and suppresses session-expired handling', async () => {
  let authorization;
  const h = apiHarness(async (_, options) => {
    authorization = options.headers.Authorization;
    return response(401);
  });
  await h.store.setItem('authToken', 'session-b');
  await assert.rejects(h.api.unregisterPushToken('device-token', 'session-a'));
  assert.equal(authorization, 'Bearer session-a');
  assert.equal(h.expired, 0);
  assert.equal(h.alerts.length, 0);
});

test('native upload 401s follow the same session handling even with HTML bodies', async () => {
  const h = apiHarness(() => { throw new Error('Unexpected fetch'); });
  await assert.rejects(h.api.uploadProfileImage('file:///photo.jpg'), (e) => e.status === 401 && e._handled);
  assert.equal(h.expired, 1);
});

test('empty successful responses and invalid server responses are handled', async () => {
  const h = apiHarness(async () => response(204));
  assert.equal(await h.api.withdrawAccount(), undefined);
  const invalid = apiHarness(async () => response(502, '<html>Bad gateway</html>'));
  await assert.rejects(invalid.api.getProfile(), (e) => e.status === 502 && typeof e.message === 'string');
});

test('a stalled request is aborted after the configured timeout', async () => {
  let timeout;
  let cleared = false;
  const h = apiHarness((_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')));
  }), {
    setTimeout(fn, ms) { assert.equal(ms, 15000); timeout = fn; return 123; },
    clearTimeout(id) { assert.equal(id, 123); cleared = true; },
  });
  const pending = h.api.getProfile();
  await new Promise(setImmediate);
  timeout();
  await assert.rejects(pending, (e) => e.message.includes('지연'));
  assert.equal(cleared, true);
});

function authHarness(store, push = {}) {
  const states = [];
  const effects = [];
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (_, props) => props.value,
    useContext: () => {},
    useState(value) { const i = states.length; states.push(value); return [value, (next) => { states[i] = next; }]; },
    useRef: (current) => ({ current }),
    useCallback: (callback) => callback,
    useEffect: (effect) => effects.push(effect),
  };
  const { AuthProvider } = loadModule('contexts/AuthContext.tsx', {
    react,
    '@react-native-async-storage/async-storage': store,
    '@/services/api': { setSessionExpiredHandler() {} },
    '@/services/push': { registerForPushNotifications: async () => null, unregisterPushToken: async () => {}, ...push },
  });
  return { auth: AuthProvider({ children: null }), effects, states };
}

test('logout clears local credentials without waiting for a stalled push revocation', async () => {
  const store = storage({ authToken: 'session-a', user: '{}', pushToken: 'device-token' });
  let revoked;
  const h = authHarness(store, {
    unregisterPushToken(token, authToken) { revoked = [token, authToken]; return new Promise(() => {}); },
  });
  await h.auth.logout();
  assert.equal(store.values.size, 0);
  assert.deepEqual(revoked, ['device-token', 'session-a']);
  assert.equal(h.states[0], false);
  assert.equal(h.states[1], null);
});

test('push registration finishing after logout cannot restore the saved device token', async () => {
  const store = storage();
  let finish;
  let revoked;
  const h = authHarness(store, {
    registerForPushNotifications: () => new Promise((resolve) => { finish = resolve; }),
    unregisterPushToken: async (...args) => { revoked = args; },
  });
  await h.auth.login('session-a', { id: '1', nickname: 'diver' });
  await h.auth.logout();
  finish('device-token');
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  assert.equal(store.values.size, 0);
  assert.deepEqual(revoked, ['device-token', 'session-a']);
});


test('onboarding completion is restored without a login token', async () => {
  const h = authHarness(storage({ hasSeenOnboarding: 'true' }));
  h.effects[1]();
  await new Promise(setImmediate);
  assert.equal(h.states[2], true);
  assert.equal(h.states[0], false);
  assert.equal(h.states[3], false);
});

test('a new installation still displays onboarding', async () => {
  const h = authHarness(storage());
  h.effects[1]();
  await new Promise(setImmediate);
  assert.equal(h.states[2], false);
});

test('restoring an existing login persists onboarding completion across logout', async () => {
  const store = storage({ authToken: 'session-a', user: JSON.stringify({ id: '1', nickname: 'diver' }) });
  const h = authHarness(store);
  h.effects[1]();
  await new Promise(setImmediate);
  await h.auth.logout();
  assert.equal(store.values.get('hasSeenOnboarding'), 'true');
});

for (const filter of ['instructor', 'closeFriend', 'group_7']) {
  test(`daily timeline preserves the calendar's ${filter} scope and selected date`, async () => {
    let requested;
    const h = apiHarness(async (url) => {
      requested = url;
      return response(200, JSON.stringify({ schedules: [
        { id: 1, scheduleDate: '2026-09-14', title: 'Selected day' },
        { id: 2, scheduleDate: '2026-09-15', title: 'Other day' },
      ] }));
    });
    const result = await h.api.getDailySchedules('2026-09-14', filter);
    assert.ok(requested.endsWith(`/schedule/monthly?year=2026&month=9&filter=${filter}`));
    assert.equal(result.schedules.length, 1);
    assert.equal(result.schedules[0].id, 1);
  });
}

test('my daily timeline retains the daily endpoint', async () => {
  let requested;
  const h = apiHarness(async (url) => {
    requested = url;
    return response(200, JSON.stringify({ schedules: [] }));
  });
  await h.api.getDailySchedules('2026-09-14');
  assert.ok(requested.endsWith('/schedule/daily?date=2026-09-14'));
});

test('schedule detail forwards the calendar access scope', async () => {
  const urls = [];
  const h = apiHarness(async (url) => {
    urls.push(url);
    return response(200, JSON.stringify({ schedule: { id: 12 } }));
  });
  for (const filter of ['mine', 'instructor', 'closeFriend', 'group_7']) {
    await h.api.getScheduleDetail(12, filter);
    assert.ok(urls.at(-1).endsWith(`/schedule/12?filter=${filter}`));
  }
});

test('demo authentication never sends an existing user token or expires that session', async () => {
  let sent;
  const h = apiHarness(async (url, options) => { sent = { url, options }; return response(401); });
  await assert.rejects(h.api.demoLogin('review-code'), e => e.status === 401);
  assert.ok(sent.url.endsWith('/auth/demo'));
  assert.equal(sent.options.headers.Authorization, undefined);
  assert.equal(JSON.parse(sent.options.body).code, 'review-code');
  assert.equal(h.expired, 0);
});

test('a demo login registers the device for notifications', async () => {
  let registrations = 0;
  const h = authHarness(storage(), { registerForPushNotifications: async () => { registrations++; return null; } });
  await h.auth.login('demo-token', { id: '42', nickname: '데모', demo: true });
  assert.equal(h.states[0], true);
  assert.equal(registrations, 1);
});

test('restoring a demo login refreshes push registration', async () => {
  let registrations = 0;
  const store = storage({ authToken: 'demo-token', user: JSON.stringify({ id: '42', nickname: '데모', demo: true }) });
  const h = authHarness(store, { registerForPushNotifications: async () => { registrations++; return null; } });
  h.effects[1]();
  await new Promise(setImmediate);
  assert.equal(h.states[0], true);
  assert.equal(registrations, 1);
});
