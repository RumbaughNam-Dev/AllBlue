const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

for (const platform of ['android', 'ios', 'web']) {
  test(`drag start uses one short platform haptic on ${platform}`, async () => {
    const calls = [];
    const { notifyHoldProgress } = loadModule('utils/haptics.ts', {
      'react-native': { Platform: { OS: platform } },
      'expo-haptics': {
        AndroidHaptics: { Segment_Frequent_Tick: 'tick' },
        ImpactFeedbackStyle: { Light: 'light' },
        performAndroidHapticsAsync: async style => calls.push(style),
        selectionAsync: async () => calls.push('selection'),
      },
    });
    await notifyHoldProgress();
    assert.deepEqual(calls, platform === 'android' ? ['tick'] : platform === 'ios' ? ['selection'] : []);
  });
}

test('unavailable native haptics does not interrupt drag', async () => {
  const { notifyHoldProgress } = loadModule('utils/haptics.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-haptics': {
      AndroidHaptics: { Segment_Frequent_Tick: 'tick' },
      performAndroidHapticsAsync: async () => { throw new Error('Native module unavailable'); },
    },
  });
  await assert.doesNotReject(notifyHoldProgress());
});
