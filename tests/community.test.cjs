const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

const essay = loadModule('features/community/essay.ts', {});
const notices = loadModule('features/community/notices.ts', {});
const greetings = loadModule('features/community/greetingDates.ts', {});
const { applyStyle, allHave, fromBody, insertImage, removeImage, spansText, spliceSpans, styleAt, textChange, toBody } = essay;
const plain = value => JSON.parse(JSON.stringify(value));

test('typing keeps the style at the caret and merges equal runs', () => {
  const spans = [{ t: '바다', b: true }, { t: '가 좋아' }];
  const change = textChange(spansText(spans), '바다아가 좋아');
  assert.deepEqual(plain(change), { start: 2, end: 2, inserted: '아' });
  assert.deepEqual(plain(spliceSpans(spans, change.start, change.end, change.inserted, styleAt(spans, change.start))),
    [{ t: '바다아', b: true }, { t: '가 좋아' }]);
  // deleting across both runs
  const removed = textChange('바다가 좋아', '바 좋아');
  assert.deepEqual(plain(spliceSpans(spans, removed.start, removed.end, removed.inserted, {})), [{ t: '바', b: true }, { t: ' 좋아' }]);
});

test('toolbar styles a selection: toggles flags, replaces size and color, drops defaults', () => {
  let spans = [{ t: '오늘 바다' }];
  spans = applyStyle(spans, 3, 5, { b: true, c: '#00b4d8' });
  assert.deepEqual(plain(spans), [{ t: '오늘 ' }, { t: '바다', b: true, c: '#00B4D8' }]);
  assert.equal(allHave(spans, 3, 5, 'b'), true);
  assert.equal(allHave(spans, 0, 5, 'b'), false);
  spans = applyStyle(spans, 0, 5, { b: false, c: '#FFFFFF', s: 'M' });
  assert.deepEqual(plain(spans), [{ t: '오늘 바다' }]);
});

test('a photo splits the paragraph at the caret and removing it joins them again', () => {
  const blocks = fromBody([{ type: 'p', spans: [{ t: '첫 줄\n둘째 줄' }] }]);
  const { blocks: withImage, focusKey } = insertImage(blocks, blocks[0].key, 4, { url: 'u', w: 4, h: 3 });
  assert.deepEqual(plain(toBody(withImage)), [
    { type: 'p', spans: [{ t: '첫 줄' }] }, { type: 'img', url: 'u', w: 4, h: 3 }, { type: 'p', spans: [{ t: '둘째 줄' }] },
  ]);
  assert.equal(focusKey, withImage[2].key);
  const image = withImage.find(b => b.type === 'img');
  assert.deepEqual(plain(toBody(removeImage(withImage, image.key))), [{ type: 'p', spans: [{ t: '첫 줄\n둘째 줄' }] }]);
});

test('loading a saved essay puts a text box around every photo', () => {
  const blocks = fromBody([{ type: 'img', url: 'a' }, { type: 'img', url: 'b' }]);
  assert.deepEqual(plain(blocks.map(b => b.type)), ['p', 'img', 'p', 'img', 'p']);
  assert.deepEqual(plain(toBody(blocks)), [{ type: 'img', url: 'a' }, { type: 'img', url: 'b' }]);
});

test('community notices open the post, removals open nothing, reports open the admin list', () => {
  assert.deepEqual(plain(notices.communityNoticeDestination('COMMUNITY_REPLY', 7)), { pathname: '/community-post', params: { id: '7' } });
  assert.equal(notices.communityNoticeDestination('COMMUNITY_REMOVED', 7), null);
  assert.deepEqual(plain(notices.communityNoticeDestination('COMMUNITY_REPORT', null)), { pathname: '/community-reports', params: {} });
  assert.equal(notices.communityNoticeDestination('CREATE_APPROVED', 7), null);
});

test('greeting dates move by day and month and the calendar starts on the right weekday', () => {
  assert.equal(greetings.shiftDay('2026-11-01', -1), '2026-10-31');
  assert.equal(greetings.shiftMonth('2026-01', -1), '2025-12');
  assert.equal(greetings.dayLabel('2026-11-02'), '11월 2일 (월)');
  const cells = greetings.monthCells('2026-11');
  assert.equal(cells[0], '2026-11-01'); // 2026-11-01 is a Sunday
  assert.equal(cells.length, 30);
});
