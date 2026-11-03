const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const form = loadModule('features/tour/tourForm.ts', {});

const filled = {
  ...form.EMPTY_TOUR_FORM,
  images: [{ uri: 'file://a.jpg', mimeType: 'image/jpeg' }], title: ' 세부   펀다이빙 3박 4일 ', continentCode: 'ASIA', countryCode: 'PH',
  startDate: '2026-11-20', endDate: '2026-11-24', capacity: '8', fee: '1200000', included: [' 숙박 4박 ', '   '], excluded: ['항공권'],
  links: [{ name: '카카오톡 오픈채팅', url: 'https://open.kakao.com/o/x' }],
};
const today = '2026-11-02';
// Values from the sandboxed module come from another realm; compare as plain data.
const plain = value => JSON.parse(JSON.stringify(value));

test('a filled form has no errors and a fresh form is not dirty', () => {
  assert.deepEqual(plain(form.tourFormErrors(filled, today)), {});
  assert.equal(form.isTourFormDirty(form.EMPTY_TOUR_FORM), false);
  assert.equal(form.isTourFormDirty({ ...form.EMPTY_TOUR_FORM, title: '세' }), true);
});

test('slide 5 messages for each wrong field', () => {
  const errors = patch => form.tourFormErrors({ ...filled, ...patch }, today);
  assert.equal(errors({ images: [] }).images, '1장 이상 올려 주세요');
  assert.equal(errors({ title: ' 세 ' }).title, '2~40자로 입력해 주세요');
  assert.equal(errors({ countryCode: '' }).region, '대륙과 나라를 골라 주세요');
  assert.equal(errors({ endDate: '' }).period, '시작일과 종료일을 골라 주세요');
  assert.equal(errors({ startDate: '2026-11-01', endDate: '2026-11-03' }).period, '시작일은 오늘 이후로 골라 주세요');
  assert.equal(errors({ endDate: '2026-11-17' }).period, '종료일이 시작일보다 빨라요');
  assert.equal(errors({ startDate: today, endDate: today }).period, undefined, 'a one-day tour starting today is fine');
  for (const capacity of ['1', '21', '', 'a']) assert.equal(errors({ capacity }).capacity, '2~20명');
});

test('fee shows thousands separators and only digits are kept', () => {
  assert.equal(form.formatFee('1200000'), '1,200,000');
  assert.equal(form.formatFee('001,2a00'), '1,200');
  assert.equal(form.formatFee(''), '');
  assert.equal(form.digitsOnly('1,200원'), '1200');
});

test('contact links: at least one, and addresses follow the profile link rules (slides 14 · 17)', () => {
  assert.equal(form.tourFormErrors({ ...filled, links: [] }, today).links, '1개 이상 넣어 주세요');
  assert.equal(form.normalizeLinkUrl(' blog.naver.com/allblue '), 'https://blog.naver.com/allblue');
  assert.equal(form.normalizeLinkUrl('http://open.kakao.com/o/x'), 'https://open.kakao.com/o/x');
  for (const bad of ['', 'kakao', 'https://', 'a b.com']) assert.equal(form.normalizeLinkUrl(bad), null);
  assert.deepEqual(plain(form.linkErrors('', '')), {}, 'empty fields are not flagged yet');
  assert.deepEqual(plain(form.linkErrors('x'.repeat(21), 'kakao')), { name: '20자까지 넣을 수 있어요', url: '주소를 다시 확인해 주세요' });
});

test('moving a photo changes the order and the first one is the cover', () => {
  assert.deepEqual(plain(form.moveItem(['a', 'b', 'c', 'd'], 3, 0)), ['d', 'a', 'b', 'c']);
  assert.deepEqual(plain(form.moveItem(['a', 'b', 'c'], 0, 2)), ['b', 'c', 'a']);
  assert.deepEqual(plain(form.moveItem(['a', 'b'], 1, 9)), ['a', 'b']);
});

test('the request sent to the server trims text and drops empty lines', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(form.toTourRequest(filled, ['https://x/allblue/tour/a.jpg']))), {
    images: ['https://x/allblue/tour/a.jpg'], title: '세부 펀다이빙 3박 4일', continentCode: 'ASIA', countryCode: 'PH',
    startDate: '2026-11-20', endDate: '2026-11-24', capacity: 8, fee: 1200000, included: ['숙박 4박'], excluded: ['항공권'],
    links: [{ name: '카카오톡 오픈채팅', url: 'https://open.kakao.com/o/x' }],
  });
  assert.equal(form.toTourRequest({ ...filled, fee: '' }, []).fee, null);
  assert.equal(form.localToday(new Date(2026, 0, 5)), '2026-01-05');
});

const { hookDriver } = require('./notice-test-helpers.cjs');
const nodes = value => !value ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === 'object' ? [value, ...nodes(value.children)] : [];
const element = (type, props, ...children) => ({ type, props: props || {}, children });
const flush = () => new Promise(setImmediate);

function searchScreen(params, pages) {
  const h = hookDriver(), calls = [];
  const codes = { continents: [{ code: 'ASIA', name: 'Asia', nameKo: '아시아' }], countries: [{ code: 'PH', name: 'Philippines', nameKo: '필리핀', extraValue: 'ASIA' }] };
  const Screen = loadModule('features/tour/TourSearchScreen.tsx', {
    react: { ...h.react, createElement: element },
    'react-native': {
      ...Object.fromEntries(['View', 'Text', 'Pressable', 'FlatList', 'ActivityIndicator', 'RefreshControl'].map(n => [n, n])),
      StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 390 }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => 'list', setItem: async () => {} } },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/constants/Colors': { brand: { primary: '#144A84', white: '#fff' } },
    '@/services/api': { api: { searchTours: (conditions, sort, offset = 0) => { calls.push({ conditions, sort, offset }); return Promise.resolve(pages.shift()); } } },
    '@/components/BottomSheet': { __esModule: true, default: 'BottomSheet' },
    '@/components/GlassChip': { __esModule: true, default: 'GlassChip' },
    '@/features/split/SplitPane': { useAppRouter: () => ({}), useIsPaneRoot: () => false, useScreenParams: () => params },
    '@/hooks/useLatestRequest': loadModule('hooks/useLatestRequest.ts', { react: h.react, '@/utils/latestRequest': loadModule('utils/latestRequest.ts', {}) }),
    './TourSearchPopup': { __esModule: true, default: 'TourSearchPopup', EMPTY_SEARCH: { title: '', instructor: '', continent: '', country: '', from: '', to: '' } },
    './TourCards': { TourCardItem: 'TourCardItem', TourRow: 'TourRow', TourEmpty: 'TourEmpty' },
    './ui': { showTourComingSoon() {} },
    './useTourRegions': { useTourRegions: () => codes, regionName: (list, code) => list.find(c => c.code === code)?.nameKo ?? '' },
  }).default;
  return { render: () => nodes(h.render(Screen)), calls };
}
const texts = all => all.filter(n => n.type === 'Text').map(n => n.children.flat().join(''));
const tour = id => ({ id, title: `t${id}` });

test('search results summarize the conditions and use the opened sort', async () => {
  const f = searchScreen({ title: '세부', continent: 'ASIA', country: 'PH', from: '2026-11-01', to: '2026-11-30', sort: 'START_ASC' },
    [{ total: 1, sort: 'START_ASC', tours: [tour(1)], hasMore: false }]);
  f.render(); await flush(); await flush();
  const all = f.render();
  assert.ok(texts(all).includes("'세부' · 아시아 › 필리핀"));
  assert.ok(texts(all).includes('11.01 ~ 11.30 · 인솔 강사 전체'));
  assert.ok(texts(all).includes('검색 결과 1개'));
  assert.equal(f.calls[0].sort, 'START_ASC');
  assert.equal(f.calls[0].conditions.country, 'PH');
  assert.deepEqual(JSON.parse(JSON.stringify(all.find(n => n.type === 'BottomSheet').props.items.map(i => i.value))),
    ['DEADLINE', 'START_ASC', 'START_DESC', 'CAPACITY_ASC', 'CAPACITY_DESC']);
  assert.equal(all.find(n => n.type === 'FlatList').props.numColumns, 1, 'the remembered list view is used');
});

test("home '전체보기' opens without conditions, adds its own sort, pages and shows the empty state", async () => {
  const f = searchScreen({ sort: 'RECENT' }, [
    { total: 21, sort: 'RECENT', tours: Array.from({ length: 20 }, (_, i) => tour(i + 1)), hasMore: true },
    { total: 21, sort: 'RECENT', tours: [tour(21)], hasMore: false },
  ]);
  f.render(); await flush(); await flush();
  let all = f.render();
  assert.ok(texts(all).includes('모든 지역의 투어'));
  assert.equal(all.find(n => n.type === 'BottomSheet').props.items[0].value, 'RECENT');
  await all.find(n => n.type === 'FlatList').props.onEndReached(); await flush();
  all = f.render();
  assert.equal(f.calls[1].offset, 20);
  assert.equal(all.find(n => n.type === 'FlatList').props.data.length, 21);

  const empty = searchScreen({}, [{ total: 0, sort: 'DEADLINE', tours: [], hasMore: false }]);
  empty.render(); await flush(); await flush();
  assert.equal(empty.render().find(n => n.type === 'FlatList').props.ListEmptyComponent.props.message, '검색된 투어가 없어요.');
});
