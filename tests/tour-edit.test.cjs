const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const edit = loadModule('features/tour/edit.ts', {});
const plain = v => JSON.parse(JSON.stringify(v));

test('slide 18: changed items read as labels for the admin card', () => {
  assert.equal(edit.changedLabels(['images', 'fee']), '소개 이미지 · 참가비');
  assert.equal(edit.changedLabels(['region', 'period', 'links']), '지역 · 투어 기간 · 문의 링크');
});

test('the admin sees the proposed version on top of the public tour', () => {
  const detail = {
    tour: { id: 9, title: '옛 이름', continentCode: 'ASIA', continentName: '아시아', countryCode: 'PH', countryName: '필리핀', startDate: '2026-11-20', endDate: '2026-11-24', capacity: 8, recruitedCount: 3, fee: 1500000, images: ['a'], included: [], excluded: [], status: 'RECRUITING' },
    instructor: { nickname: '럼바우' }, links: [{ name: 'a', url: 'https://a.com' }],
  };
  const payload = { title: '새 이름', continentCode: 'ASIA', countryCode: 'JP', startDate: '2026-11-21', endDate: '2026-11-24', capacity: 10, fee: null, images: ['b'], included: ['숙박'], excluded: [], links: [{ name: 'b', url: 'https://b.com' }] };
  const shown = plain(edit.withEdit(detail, payload, code => ({ ASIA: '아시아', JP: '일본' })[code] ?? ''));
  assert.equal(shown.tour.title, '새 이름');
  assert.equal(shown.tour.countryName, '일본');
  assert.equal(shown.tour.recruitedCount, 3, 'recruitment stays live, not from the edit');
  assert.equal(shown.tour.fee, null);
  assert.deepEqual(shown.links, [{ name: 'b', url: 'https://b.com' }]);
});

test('the instructor card explains a waiting or returned edit', () => {
  assert.equal(edit.editNotice(null), null);
  assert.match(edit.editNotice({ status: 'PENDING', reviewNote: null }), /승인을 기다리고/);
  assert.equal(edit.editNotice({ status: 'REJECTED', reviewNote: '참가비를 확인해 주세요' }), '수정 내용에 보완 요청이 있어요\n“참가비를 확인해 주세요”');
});
