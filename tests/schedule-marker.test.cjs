const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { getScheduleMarkerColor } = loadModule('utils/scheduleMarker.ts', {});

test('calendar uses course colors regardless of held level or pending invitation', () => {
  for (const [categoryCode, minCourseLevel, expected] of [
    ['EXPERIENCE', 5, '#FFFFFF'],
    ['CERTIFICATION', 2, '#FFE500'],
    ['CERTIFICATION', 3, '#33CC33'],
    ['CERTIFICATION', 4, '#FF9500'],
    ['CERTIFICATION', 5, '#3B92C5'],
    ['TRAINING', 2, '#7B2FBE'],
    ['LECTURE', 3, '#7B2FBE'],
    ['FUN_DIVE', 4, '#7B2FBE'],
    ['ETC', null, '#7B2FBE'],
    ['CERTIFICATION', null, '#7B2FBE'],
  ]) {
    for (const invitationStatus of ['pending', 'accepted']) {
      assert.equal(getScheduleMarkerColor({ categoryCode, minCourseLevel, minLevel: '0', invitationStatus }), expected);
    }
  }
});
