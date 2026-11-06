const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

const rows = loadModule('features/community/listRows.ts', {});
const windowed = loadModule('features/community/useWindowedList.ts', {
  react: { useCallback: fn => fn, useRef: value => ({ current: value }), useState: value => [value, () => {}] },
});
const plain = value => JSON.parse(JSON.stringify(value));

// 목록 전체에서 g번째 글 (최근 순이라 id가 줄어듦)
const post = g => ({ id: 1000 - g });
const range = (from, to) => Array.from({ length: to - from }, (_, i) => post(from + i));
const ids = row => row.items.map(p => p.id);

test('bar and folded screens keep today\'s layout; unfolded shows essays and free posts 4 a row, promos 2', () => {
  for (const inner of [335, 599]) {
    assert.equal(rows.boardColumns('ESSAY', inner), 2);
    assert.equal(rows.boardColumns('FREE', inner), 1);
    assert.equal(rows.boardColumns('PROMO', inner), 1);
  }
  for (const inner of [600, 650, 789]) {
    assert.equal(rows.boardColumns('ESSAY', inner), 4);
    assert.equal(rows.boardColumns('FREE', inner), 4);
    assert.equal(rows.boardColumns('PROMO', inner), 2);
  }
  assert.equal(rows.cellWidth(650, 4), 155);
  assert.equal(rows.cellWidth(335, 2), 162);
  assert.equal(rows.cellWidth(0, 4), 0);
});

test('4 a row: adding or trimming 10 at either end keeps the other rows as they were (the screen does not jump)', () => {
  const anchors = new Map();
  let win = { items: range(0, 10), base: 0, epoch: 1 };
  for (let k = 10; k < 100; k += 10) win = windowed.withOlder(win, range(k, k + 10)).win;
  assert.equal(win.items.length, 100);
  const before = rows.gridRows(win.items, win.base, 4, anchors);
  assert.deepEqual(plain(before.slice(0, 2).map(ids)), [[1000, 999, 998, 997], [996, 995, 994, 993]]);

  // 맨 아래까지 내림: 더 예전 10개가 붙고 위 10개를 덜어냄
  const older = windowed.withOlder(win, range(100, 110));
  assert.equal(older.trimmed, true);
  assert.equal(older.win.base, 10);
  const after = rows.gridRows(older.win.items, older.win.base, 4, anchors);
  const byKey = new Map(before.map(r => [r.key, ids(r)]));
  const kept = after.filter(r => byKey.has(r.key) && r.items.length === 4);
  assert.equal(kept.length, 22);
  for (const r of kept) assert.deepEqual(plain(ids(r)), plain(byKey.get(r.key)));
  // 덜어낸 경계만 위에 짧은 줄 (화면 밖), 맨 앞부터 줄을 다시 나누지 않음
  assert.deepEqual(plain(ids(after[0])), [990, 989]);

  // 다시 올림: 같은 10개가 돌아오면 줄도 처음과 똑같음
  const newer = windowed.withNewer(older.win, range(0, 10));
  assert.equal(newer.trimmed, true);
  assert.equal(newer.win.base, 0);
  const restored = rows.gridRows(newer.win.items, newer.win.base, 4, anchors);
  assert.deepEqual(plain(restored.map(r => [r.key, ids(r)])), plain(before.map(r => [r.key, ids(r)])));
});

test('windowing keeps at most 100 and counts where the first post sits', () => {
  let win = { items: range(0, 100), base: 0, epoch: 1 };
  const older = windowed.withOlder(win, [...range(95, 100), ...range(100, 105)]); // 겹친 5개는 한 번만
  assert.equal(older.trimmed, true);
  assert.equal(older.win.items.length, 95);
  assert.equal(older.win.base, 10);
  assert.equal(older.win.items[0].id, 990);
  win = { items: range(0, 30), base: 0, epoch: 1 };
  const small = windowed.withOlder(win, range(30, 40));
  assert.equal(small.trimmed, false);
  assert.equal(small.win.base, 0);
});

test('essays: a small date line per day, then 4 a row (2 on a bar phone); rows start fresh each day and stay put when the top is trimmed', () => {
  const essay = (id, day) => ({ id, createdAt: `${day}T12:00:00` });
  const a = [1, 2, 3, 4, 5, 6].map(id => essay(id, '2026-11-06'));
  const b = [7, 8, 9].map(id => essay(id, '2026-11-05'));
  const shape = list => list.map(r => ('date' in r ? r.date : r.posts.map(p => p.id)));

  const anchors = new Map();
  assert.deepEqual(plain(shape(rows.essayRows([...a, ...b], 0, 4, anchors))), ['2026-11-06', [1, 2, 3, 4], [5, 6], '2026-11-05', [7, 8, 9]]);
  assert.deepEqual(plain(shape(rows.essayRows([...a, ...b], 0, 2, new Map()))), ['2026-11-06', [1, 2], [3, 4], [5, 6], '2026-11-05', [7, 8], [9]]);

  // 위 두 개를 덜어내도 그날의 나머지 줄과 다음 날 줄은 그대로
  const trimmed = rows.essayRows([...a.slice(2), ...b], 2, 4, anchors);
  assert.deepEqual(plain(shape(trimmed)), ['2026-11-06', [3, 4], [5, 6], '2026-11-05', [7, 8, 9]]);
  const keys = rows.essayRows([...a, ...b], 0, 4, anchors).map(r => r.key);
  assert.ok(trimmed.every(r => keys.includes(r.key)));
});

test('date line: today, this year, other years', () => {
  assert.equal(rows.dayLabel('2026-11-06', '2026-11-06'), '오늘 · 11월 6일 (금)');
  assert.equal(rows.dayLabel('2026-11-05', '2026-11-06'), '11월 5일 (목)');
  assert.equal(rows.dayLabel('2025-12-31', '2026-11-06'), '2025년 12월 31일 (수)');
});

test('search conditions on top of the list: empty means every post; a start date pulls the end date only when it is earlier', () => {
  assert.equal(rows.hasConditions(rows.NO_CONDITIONS), false);
  assert.equal(rows.hasConditions({ ...rows.NO_CONDITIONS, author: '바다' }), true);
  assert.equal(rows.hasConditions({ ...rows.NO_CONDITIONS, to: '2026-11-06' }), true);
  const none = { from: '', to: '', q: '', author: '' };
  assert.deepEqual(plain(rows.pickFrom(none, '2026-11-01')), { from: '2026-11-01', to: '' });
  assert.deepEqual(plain(rows.pickFrom({ ...none, to: '2026-10-01' }, '2026-11-01')), { from: '2026-11-01', to: '2026-11-01' });
  assert.deepEqual(plain(rows.pickFrom({ ...none, to: '2026-11-03' }, '2026-11-01')), { from: '2026-11-01', to: '2026-11-03' });
  assert.equal(rows.dateText('', 'from'), '처음');
  assert.equal(rows.dateText('', 'to'), '오늘');
  assert.equal(rows.dateText('2026-11-06', 'from'), '2026.11.06');
  assert.equal(rows.dateText('2026-11-06', 'to', true), '26.11.06');
});
