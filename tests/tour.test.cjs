const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

const ui = loadModule('features/tour/ui.ts', {});
const edit = loadModule('features/tour/edit.ts', {});
const mine = loadModule('features/tour/mine.ts', { './edit': edit, './ui': ui });
const notices = loadModule('features/tour/notices.ts', {});
const form = loadModule('features/tour/tourForm.ts', {});
const plain = value => JSON.parse(JSON.stringify(value));

// 목록 카드 하나 (서버 card()와 같은 모양)
const card = (extra = {}) => ({
  id: 5, status: 'RECRUITING', registerRole: 'PARTICIPANT', title: null, name: '태국 · 다이빙 + 관광', continentCode: 'ASIA', countryCode: 'TH',
  countryName: '태국', place: null, startDate: '2026-12-03', endDate: '2026-12-07', tourStyle: 'DIVING_SIGHTSEEING', capacity: 6, count: 5, fee: null,
  coverUrl: 'https://cdn/x.jpg', registrant: { userId: 'me', nickname: '나' }, leader: null, proposalCount: 0, ...extra,
});
const labels = view => plain(view.menu.map(m => m.label));

test('slide 3: card lines — recruiting shows the leader or "인솔자 구함", seeking shows people gathered and proposals', () => {
  assert.deepEqual(plain(ui.cardLines(card())), { where: '태국', meta: '12.03 - 12.07', lead: '인솔자 구함', leadColor: ui.LAVENDER, count: '5/6명' });
  // 투어 장소가 있으면 '나라 · 장소' (길면 이쪽만 줄어들고 기간은 늘 보임)
  assert.equal(ui.cardLines(card({ place: '푸켓' })).where, '태국 · 푸켓');
  assert.equal(ui.placeLabel({ countryName: '필리핀', place: '세부' }), '필리핀 · 세부');
  assert.equal(ui.cardLines(card({ leader: { userId: 'l', nickname: '럼바우' } })).lead, '인솔 럼바우');
  assert.deepEqual(plain(ui.cardLines(card({ status: 'SEEKING_LEADER', count: 6, proposalCount: 2 }))),
    { meta: '12.03 - 12.07 · 6명 모임', lead: '받은 제안 2', leadColor: ui.LAVENDER, count: null });
  assert.equal(ui.formatTourPeriod('2026-12-03', '2026-12-03'), '12.03');
  assert.equal(ui.formatStay('2026-11-20', '2026-11-24'), '4박 5일');
  assert.equal(ui.formatStay('2026-11-20', '2026-11-20'), '당일');
  assert.equal(ui.formatFee(1200000), '1,200,000원');
});

test('slide 24: two cards a row, four once the list is at least 600pt wide', () => {
  assert.equal(ui.gridColumns(599), 2);
  assert.equal(ui.gridColumns(600), 4);
  assert.equal(ui.cardWidthFor(350), 170);
  assert.equal(ui.cardWidthFor(800), 192);
});

test('slide 10: registered tours — one button by status, edit · delete in the "⋯" menu, ended tours view only', () => {
  let view = mine.mineCard('REGISTERED', card({ pendingApplications: 2 }));
  assert.equal(view.badge.label, '참여자 모집중');
  assert.equal(view.lines.meta, '12.03 - 12.07 · 5 / 6명');
  assert.deepEqual(plain(view.button), { label: '참여 신청 2', kind: 'primary', go: 'applications' });
  assert.deepEqual(labels(view), ['수정', '삭제']);
  assert.equal(view.ended, false);

  view = mine.mineCard('REGISTERED', card({ status: 'SEEKING_LEADER', count: 6, proposalCount: 2 }));
  assert.equal(view.lines.meta, '12.03 - 12.07 · 6명 모임');
  assert.deepEqual(plain(view.button), { label: '받은 제안 2', kind: 'primary', go: 'proposals' });

  view = mine.mineCard('REGISTERED', card({ status: 'REVISION', registerRole: 'LEADER', reviewNote: '일정표를 추가해 주세요' }));
  assert.equal(view.lines.note.text, '관리자: “일정표를 추가해 주세요”');
  assert.deepEqual(plain(view.noteDetail), { title: '관리자 보완 요청', body: '일정표를 추가해 주세요' });
  assert.deepEqual(plain(view.button), { label: '보완 후 재요청', kind: 'salmon', go: 'edit' });
  assert.deepEqual(plain(view.menu), [{ label: '등록 취소', action: 'delete' }]);

  view = mine.mineCard('REGISTERED', card({ status: 'PENDING', registerRole: 'LEADER' }));
  assert.deepEqual(plain(view.button), { label: '수정', kind: 'dark', go: 'edit' });
  assert.deepEqual(labels(view), ['삭제']);

  // 공개 중인 인솔자 투어의 수정본: 한 줄 안내 + '수정 취소'
  view = mine.mineCard('REGISTERED', card({ registerRole: 'LEADER', editRequest: { status: 'PENDING', reviewNote: null } }));
  assert.equal(view.lines.note.text, '수정 내용 승인 대기 중');
  assert.deepEqual(labels(view), ['수정', '수정 취소', '삭제']);
  view = mine.mineCard('REGISTERED', card({ registerRole: 'LEADER', editRequest: { status: 'REJECTED', reviewNote: '사진을 바꿔 주세요' } }));
  assert.equal(view.noteDetail.body, '사진을 바꿔 주세요');

  view = mine.mineCard('REGISTERED', card({ status: 'CLOSED', count: 6, leader: { userId: 'l', nickname: '럼바우' } }));
  assert.equal(view.lines.lead, '인솔 럼바우');
  assert.deepEqual(plain(view.button), { label: '투어 보기', kind: 'dark', go: 'detail' });
  assert.deepEqual(plain(view.menu), []);
  assert.equal(view.ended, true);
  assert.equal(mine.mineCard('REGISTERED', card({ status: 'EXPIRED' })).ended, true);
});

test('slide 10: joined tours — 신청 중 / 참여 확정 badges, cancel the request any time, leave only before it closes', () => {
  let view = mine.mineCard('JOINED', card({ applicationStatus: 'PENDING' }));
  assert.equal(view.badge.label, '신청 중');
  assert.deepEqual(plain(view.menu), [{ label: '신청 취소', action: 'cancelApply' }]);
  view = mine.mineCard('JOINED', card({ status: 'SEEKING_LEADER', applicationStatus: 'ACCEPTED' }));
  assert.equal(view.badge.label, '참여 확정');
  assert.equal(view.lines.lead, '인솔자를 찾는 중');
  assert.deepEqual(plain(view.menu), [{ label: '참여 취소', action: 'leave' }]);
  view = mine.mineCard('JOINED', card({ status: 'CLOSED', applicationStatus: 'ACCEPTED', leader: { userId: 'l', nickname: '럼바우' } }));
  assert.equal(view.badge.label, '모집 마감');
  assert.deepEqual(plain(view.menu), []);
  assert.equal(view.ended, true);
});

test('slide 10: proposed tours — 승낙 대기 · 보류 · 승낙됨 · 마감, edit or withdraw only before acceptance', () => {
  const proposal = extra => card({ status: 'SEEKING_LEADER', proposal: { id: 9, status: 'WAITING', closedReason: null, title: '보홀 4박', fee: 1200000, ...extra } });
  let view = mine.mineCard('PROPOSED', proposal());
  assert.equal(view.badge.label, '승낙 대기');
  assert.equal(view.lines.lead, '내 제안 1,200,000원');
  assert.deepEqual(plain(view.button), { label: '제안 수정', kind: 'primary', go: 'proposalEdit' });
  assert.deepEqual(plain(view.menu), [{ label: '제안 취소', action: 'withdraw' }]);
  assert.equal(view.ended, false);
  assert.equal(mine.mineCard('PROPOSED', proposal({ status: 'HELD' })).lines.lead, '인원을 다시 모으는 중');
  view = mine.mineCard('PROPOSED', proposal({ status: 'ACCEPTED' }));
  assert.equal(view.lines.lead, '모집 마감 · 내가 인솔');
  assert.deepEqual(plain(view.menu), []);
  assert.equal(view.ended, true);
  assert.equal(mine.mineCard('PROPOSED', proposal({ status: 'CLOSED', closedReason: 'OTHER_ACCEPTED' })).lines.lead, '다른 강사님의 제안으로 마감');
  assert.equal(mine.mineCard('PROPOSED', proposal({ status: 'CLOSED', closedReason: 'EXPIRED' })).lines.lead, '출발일까지 모이지 않아 만료');
});

test('slide 10: the 제안한 tab is for instructors and admins only; every menu action asks first', () => {
  assert.deepEqual(plain(mine.mineTabs(false).map(t => t.label)), ['등록한', '참여한']);
  assert.deepEqual(plain(mine.mineTabs(true).map(t => t.label)), ['등록한', '참여한', '제안한']);
  assert.equal(mine.MINE_TABS.find(t => t.tab === 'JOINED').empty, '참여한 투어가 없어요.');
  assert.equal(mine.mineConfirm('delete', card({ status: 'REVISION' })).button, '등록 취소');
  assert.match(mine.mineConfirm('delete', card()).message, /참여자 · 신청자 · 제안한 강사에게 알림/);
  assert.match(mine.mineConfirm('delete', card({ status: 'PENDING' })).message, /등록 요청도 함께 취소/);
  for (const action of ['cancelEdit', 'cancelApply', 'leave', 'withdraw']) assert.equal(mine.mineConfirm(action, card()).destructive, true);
  assert.equal(mine.mineConfirm('edit', card()), null);
});

test('slide 22: every tour notice opens its screen; a deleted tour only marks the notice read', () => {
  const go = (code, id = 7) => plain(notices.tourNoticeDestination(code, id));
  assert.deepEqual(go('TOUR_REQUEST'), { pathname: '/tour-requests', params: { focusTourId: '7' } });
  assert.deepEqual(go('TOUR_EDIT_REQUEST'), { pathname: '/tour-requests', params: { focusTourId: '7' } });
  assert.deepEqual(go('TOUR_REPORT'), { pathname: '/tour-reports', params: { focusTourId: '7' } });
  assert.deepEqual(go('TOUR_APPLY'), { pathname: '/tour-applications', params: { id: '7' } });
  assert.deepEqual(go('TOUR_PROPOSAL'), { pathname: '/tour-proposals', params: { id: '7' } });
  for (const code of ['TOUR_APPROVED', 'TOUR_EDIT_APPROVED', 'TOUR_ACCEPTED', 'TOUR_REJECTED', 'TOUR_APPLY_CLOSED', 'TOUR_SEEKING_LEADER', 'TOUR_CLOSED', 'TOUR_PROPOSAL_ACCEPTED', 'TOUR_UPDATED']) {
    assert.deepEqual(go(code), { pathname: '/tour-detail', params: { id: '7' } }, code);
  }
  for (const code of ['TOUR_REVISION', 'TOUR_EDIT_REVISION', 'TOUR_TAKEN_DOWN', 'TOUR_LEFT']) {
    assert.deepEqual(go(code), { pathname: '/tour-mine', params: { tab: 'REGISTERED' } }, code);
  }
  assert.deepEqual(go('TOUR_PROPOSAL_CLOSED'), { pathname: '/tour-mine', params: { tab: 'PROPOSED' } });
  assert.deepEqual(go('TOUR_EXPIRED'), { pathname: '/tour-mine', params: { focusTourId: '7' } });
  assert.equal(notices.tourNoticeDestination('TOUR_DELETED', 7), null);
  assert.equal(notices.tourNoticeDestination('COMMUNITY_COMMENT', 7), null);
  assert.equal(notices.tourNoticeDestination('TOUR_APPLY', null), null);
  assert.equal(notices.tourNoticeDestination('TOUR_APPLY', '0'), null);
});

test('slides 4 · 5: registration rules — photos, region, period, style and counts; leaders also need a name and a contact link', () => {
  const today = '2026-11-06';
  const filled = {
    ...form.emptyTourForm(), images: [{ uri: 'a', mimeType: 'image/jpeg' }, { uri: 'b', mimeType: 'image/jpeg' }], coverUri: 'b',
    continentCode: 'ASIA', countryCode: 'TH', place: ' 푸켓   빠통 ', startDate: '2026-12-03', endDate: '2026-12-07', tourStyle: 'DIVING_ONLY', capacity: 6, baseCount: 2,
  };
  assert.deepEqual(plain(form.tourFormErrors(filled, today)), {});
  // 사진: 참여자로는 선택, 인솔자로(소개 이미지)는 1장 이상
  assert.deepEqual(Object.keys(form.tourFormErrors(form.emptyTourForm(), today)).sort(), ['period', 'place', 'region', 'style']);
  assert.deepEqual(plain(form.tourFormErrors({ ...filled, images: [], coverUri: '' }, today)), {});
  assert.equal(form.tourFormErrors({ ...filled, role: 'LEADER', baseCount: 0, images: [], coverUri: '' }, today).images, '1장 이상 올려 주세요');
  // 투어 장소: 참여자로 · 인솔자로 모두 필수 (공백만이면 빈 칸)
  assert.equal(form.tourFormErrors({ ...filled, place: '   ' }, today).place, '도시 이름을 입력해 주세요');
  assert.equal(form.tourFormErrors({ ...filled, role: 'LEADER', place: '' }, today).place, '도시 이름을 입력해 주세요');
  assert.equal(form.tourFormErrors({ ...filled, startDate: '2026-11-05' }, today).period, '시작일은 오늘 이후로 골라 주세요');
  assert.equal(form.tourFormErrors({ ...filled, baseCount: 0 }, today).counts, '지금 모인 인원은 총 인원까지예요');
  assert.equal(form.tourFormErrors({ ...filled, capacity: 4, baseCount: 2 }, today, 3).counts, '확정된 5명보다 적게 못 줄여요');
  const leader = { ...filled, role: 'LEADER', baseCount: 0 };
  assert.deepEqual(Object.keys(form.tourFormErrors(leader, today)).sort(), ['links', 'title']);
  // 남은 자리: 참여자로 다 차면 인솔자 모집중, 인솔자로 다 차면 모집 마감
  assert.equal(form.registerOutcome({ role: 'PARTICIPANT', capacity: 6, baseCount: 6 }), 'SEEKING_LEADER');
  assert.equal(form.registerOutcome({ role: 'LEADER', capacity: 6, baseCount: 6 }), 'CLOSED');
  assert.equal(form.registerOutcome({ role: 'LEADER', capacity: 6, baseCount: 0 }), 'RECRUITING');
  // 보내는 값: 대표 사진은 순서 번호로, 참여자로는 인솔 정보 없이
  assert.deepEqual(plain(form.toTourInput(filled, ['u1', 'u2'])), {
    role: 'PARTICIPANT', images: ['u1', 'u2'], coverIndex: 1, continentCode: 'ASIA', countryCode: 'TH', place: '푸켓 빠통', startDate: '2026-12-03', endDate: '2026-12-07',
    tourStyle: 'DIVING_ONLY', capacity: 6, baseCount: 2,
  });
  const sent = form.toTourInput({ ...leader, title: ' 세부   펀다이빙 ', fee: '', included: ['숙박', ' '], links: [{ name: '오픈채팅', url: 'https://open.kakao.com/o/x' }] }, ['u1', 'u2']);
  assert.equal(sent.title, '세부 펀다이빙');
  assert.equal(sent.fee, null);
  assert.deepEqual(plain(sent.included), ['숙박']);
});

test('slide 8: a proposal needs photos, a name, a fee and a contact link; the message is optional', () => {
  const base = { ...form.EMPTY_PROPOSAL_FORM, images: [{ uri: 'a', mimeType: 'image/jpeg' }], coverUri: 'a', title: '보홀 4박', fee: '1200000', links: [{ name: '채팅', url: 'https://x.kr' }] };
  assert.deepEqual(plain(form.proposalErrors(base)), {});
  assert.deepEqual(Object.keys(form.proposalErrors(form.EMPTY_PROPOSAL_FORM)).sort(), ['fee', 'images', 'links', 'title']);
  assert.equal(form.toProposalInput({ ...base, fee: '1,200,000', message: '  잘 부탁해요 ' }, ['u']).fee, 1200000);
  assert.equal(form.toProposalInput({ ...base, message: '  잘 부탁해요 ' }, ['u']).message, '잘 부탁해요');
  assert.equal(form.normalizeLinkUrl('open.kakao.com/o/abc'), 'https://open.kakao.com/o/abc');
  assert.equal(form.normalizeLinkUrl('not a link'), null);
  assert.equal(form.feeDigits('0012000'), '12,000');
});
