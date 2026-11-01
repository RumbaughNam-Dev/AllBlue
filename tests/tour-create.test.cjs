const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const form = loadModule('features/tour/tourForm.ts', {});

const filled = {
  ...form.EMPTY_TOUR_FORM,
  images: [{ uri: 'file://a.jpg', mimeType: 'image/jpeg' }], title: ' 세부   펀다이빙 3박 4일 ', continentCode: 'ASIA', countryCode: 'PH',
  startDate: '2026-11-20', endDate: '2026-11-24', capacity: '8', fee: '1200000', included: [' 숙박 4박 ', '   '], excluded: ['항공권'],
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

test('moving a photo changes the order and the first one is the cover', () => {
  assert.deepEqual(plain(form.moveItem(['a', 'b', 'c', 'd'], 3, 0)), ['d', 'a', 'b', 'c']);
  assert.deepEqual(plain(form.moveItem(['a', 'b', 'c'], 0, 2)), ['b', 'c', 'a']);
  assert.deepEqual(plain(form.moveItem(['a', 'b'], 1, 9)), ['a', 'b']);
});

test('the request sent to the server trims text and drops empty lines', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(form.toTourRequest(filled, ['https://x/allblue/tour/a.jpg']))), {
    images: ['https://x/allblue/tour/a.jpg'], title: '세부 펀다이빙 3박 4일', continentCode: 'ASIA', countryCode: 'PH',
    startDate: '2026-11-20', endDate: '2026-11-24', capacity: 8, fee: 1200000, included: ['숙박 4박'], excluded: ['항공권'],
  });
  assert.equal(form.toTourRequest({ ...filled, fee: '' }, []).fee, null);
  assert.equal(form.localToday(new Date(2026, 0, 5)), '2026-01-05');
});
