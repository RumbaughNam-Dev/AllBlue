const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

const load = level => loadModule('features/tour/ProfileTours.tsx', {
  react: { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
  'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: x => x } },
  '@/constants/Colors': { default: { brand: { white: '#fff' } }, __esModule: true },
  '@/contexts/AuthContext': { useAuth: () => ({ user: { level } }) },
  './TourCards': { StatusBadge: 'StatusBadge' },
  './ui': loadModule('features/tour/ui.ts', { 'react-native': { Alert: {} } }),
}).default;
const texts = tree => !tree ? [] : Array.isArray(tree) ? tree.flatMap(texts) : typeof tree === 'object' ? texts(tree.children) : [String(tree)];
const tours = [
  { id: 3, title: '보라카이 펀다이빙', countryName: '필리핀', startDate: '2026-10-24', endDate: '2026-10-27', capacity: 8, recruitedCount: 7 },
  { id: 1, title: '다합 트레이닝', countryName: '이집트', startDate: '2026-07-05', endDate: '2026-07-12', capacity: 8, recruitedCount: 6 },
];

test("slide 13: '진행한 투어 n' lists completed tours with country, period and recruitment", () => {
  const all = texts(load('A')({ tours })).join('|');
  assert.match(all, /진행한 투어 \|2/);
  assert.match(all, /보라카이 펀다이빙\|필리핀\| · \|10\.24 - 10\.27\|7\/8명/);
  assert.match(all, /다합 트레이닝/);
});

test('hidden with no completed tours, and for non-admins while the tour tab is admin-only', () => {
  assert.equal(load('A')({ tours: [] }), null);
  assert.equal(load('5')({ tours }), null);
});
