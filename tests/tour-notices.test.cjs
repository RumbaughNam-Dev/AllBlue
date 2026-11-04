const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { tourNoticeDestination } = loadModule('features/tour/notices.ts', {});
const go = (code, id = 9) => JSON.parse(JSON.stringify(tourNoticeDestination(code, id)));

test('slide 21: each tour notice opens its screen', () => {
  assert.deepEqual(go('REQUEST_CREATE'), { pathname: '/tour-requests', params: { focusTourId: '9' } });
  assert.deepEqual(go('REQUEST_UPDATE'), { pathname: '/tour-requests', params: { focusTourId: '9' } });
  assert.deepEqual(go('REPORT_RECEIVED'), { pathname: '/tour-reports', params: { focusTourId: '9' } });
  assert.deepEqual(go('CREATE_APPROVED'), { pathname: '/tour-detail', params: { id: '9' } });
  assert.deepEqual(go('UPDATE_APPROVED'), { pathname: '/tour-detail', params: { id: '9' } });
  for (const code of ['CREATE_REJECTED', 'UPDATE_REJECTED', 'REPORT_TAKEN_DOWN', 'TOUR_ENDED', 'PROCESS_DEADLINE']) {
    assert.deepEqual(go(code), { pathname: '/tour-manage', params: {} });
  }
});

test('schedule invites and malformed data are not tour notices', () => {
  assert.deepEqual(go('WISH_OFFER'), { pathname: '/tour-detail', params: { id: '9' } }, 'the diver answers on the tour detail');
  for (const code of ['WISH_ACCEPTED', 'WISH_DECLINED', 'WISH_APPROVED_WAITING']) assert.deepEqual(go(code), { pathname: '/tour-manage', params: {} });
  assert.deepEqual(go('TOUR_WISH', 0), { pathname: '/tour-wishes', params: {} }, 'tour wishes have no tour and open the wish list');
  assert.equal(tourNoticeDestination('SCHEDULE_INVITE', 9), null);
  assert.equal(tourNoticeDestination(undefined, 9), null);
  assert.equal(tourNoticeDestination('CREATE_APPROVED', null), null);
  assert.equal(tourNoticeDestination('CREATE_APPROVED', '0'), null);
});
