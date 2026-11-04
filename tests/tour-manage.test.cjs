const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const manage = loadModule('features/tour/manage.ts', {});
const form = loadModule('features/tour/tourForm.ts', {});
const plain = value => JSON.parse(JSON.stringify(value));

test('processing deadline counts from the day after the end date (slide 10)', () => {
  assert.equal(manage.processDaysLeft('RECRUITING', '2026-11-01', '2026-11-01'), null, 'still on the last day');
  assert.equal(manage.processDaysLeft('RECRUITING', '2026-11-01', '2026-11-02'), 6);
  assert.equal(manage.processDaysLeft('CLOSED', '2026-11-01', '2026-11-08'), 0);
  assert.equal(manage.processDaysLeft('CLOSED', '2026-11-01', '2026-11-20'), 0);
  assert.equal(manage.processDaysLeft('PENDING', '2026-11-01', '2026-11-05'), null, 'only public tours');
});

test('card notices', () => {
  assert.match(manage.manageNotice('PENDING', '2026-12-01', '2026-11-01'), /승인을 기다리고/);
  assert.equal(manage.manageNotice('REJECTED', '2026-12-01', '2026-11-01', '일정표 이미지를 추가해 주세요'), '관리자가 보완을 요청했어요\n“일정표 이미지를 추가해 주세요”');
  assert.match(manage.manageNotice('REJECTED', '2026-12-01', '2026-11-01'), /보완해서 다시 요청/);
  assert.match(manage.manageNotice('PREPARING', '2026-11-01', '2026-11-03'), /D-5$/);
  assert.match(manage.manageNotice('PREPARING', '2026-11-01', '2026-11-08'), /D-DAY$/);
  assert.equal(manage.manageNotice('RECRUITING', '2026-12-01', '2026-11-01'), null);
});

test('actions per status', () => {
  assert.deepEqual(plain(manage.manageActions('RECRUITING')), { adjust: true, process: true, edit: true, editLabel: '수정', remove: true, removeLabel: '삭제' });
  assert.deepEqual(plain(manage.manageActions('REJECTED')), { adjust: false, process: false, edit: true, editLabel: '보완 후 재요청', remove: true, removeLabel: '등록 취소' });
  assert.deepEqual(plain(manage.manageActions('COMPLETED')), { adjust: false, process: false, edit: false, editLabel: '수정', remove: true, removeLabel: '삭제' });
});

test('editing a saved tour: form round trip, dirty check and recruited minimum', () => {
  const tour = {
    images: ['https://x/a.jpg'], title: '세부 투어', continentCode: 'ASIA', countryCode: 'PH',
    startDate: '2026-11-20', endDate: '2026-11-24', capacity: 8, fee: null, included: ['숙박'], excluded: [],
  };
  const initial = form.formFromTour(tour, [{ name: '블로그', url: 'https://blog.naver.com/x' }]);
  assert.deepEqual(plain(initial.links), [{ name: '블로그', url: 'https://blog.naver.com/x' }]);
  assert.deepEqual(plain(initial.images), [{ uri: 'https://x/a.jpg', mimeType: '', remote: true }]);
  assert.equal(initial.capacity, '8');
  assert.equal(initial.fee, '');
  assert.equal(form.isTourFormDirty(initial, initial), false);
  assert.equal(form.isTourFormDirty({ ...initial, title: '세부 투어!' }, initial), true);
  const errors = form.tourFormErrors({ ...initial, capacity: '3' }, '2026-11-02', 5);
  assert.equal(errors.capacity, '이미 모집된 5명보다 적게 못 줄여요');
  assert.equal(form.tourFormErrors({ ...initial, capacity: '5' }, '2026-11-02', 5).capacity, undefined);
});

test('tours made from a wish explain where the diver\'s answer stands', () => {
  const deadline = new Date(2026, 10, 5, 1, 0).toISOString(); // 11월 5일 01:00 (기기 시간대)
  assert.equal(manage.wishNotice('PENDING', { status: 'WAITING', deadline }), '역제안으로 만든 투어예요. 제안자가 11월 5일 01:00까지 응하면 정식 투어가 돼요.');
  assert.equal(manage.wishNotice('WISH_WAITING', { status: 'WAITING', deadline }), "승인됐어요. 제안자가 11월 5일 01:00까지 응하면 '준비중'으로 공개돼요.");
  assert.equal(manage.wishNotice('PENDING', { status: 'ACCEPTED', deadline }), '제안자가 응했어요. 관리자 승인이 끝나면 공개돼요.');
  assert.equal(manage.wishNotice('WISH_DECLINED', { status: 'DECLINED', deadline }), '제안자가 응하지 않아 투어가 열리지 않았어요.');
  assert.equal(manage.wishNotice('PREPARING', { status: 'ACCEPTED', deadline }), null);
  assert.equal(manage.wishNotice('PENDING', null), null);
  // 응답 대기 · 제안 거부: 수정 · 처리 · 인원 조정 없이 삭제만
  for (const status of ['WISH_WAITING', 'WISH_DECLINED']) {
    const a = manage.manageActions(status);
    assert.deepEqual([a.adjust, a.process, a.edit, a.remove], [false, false, false, true]);
  }
});
