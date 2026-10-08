const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { parseSta, splitSta, formatSta } = loadModule('utils/sta.ts', {});

test('STA minute/second input survives numeric API storage and editing', () => {
  for (const [min, sec, stored, label] of [
    ['4', '1', 4.01, '4분 1초'], ['4', '01', 4.01, '4분 1초'],
    ['4', '10', 4.1, '4분 10초'], ['4', '30', 4.3, '4분 30초'],
    ['4', '', 4, '4분 0초'], ['', '9', 0.09, '0분 9초'],
    ['0', '0', 0, '0분 0초'], ['99', '59', 99.59, '99분 59초'],
  ]) {
    assert.equal(parseSta(min, sec), stored);
    const value = JSON.parse(JSON.stringify(stored));
    assert.equal(formatSta(value), label);
    const parts = splitSta(value);
    assert.equal(parseSta(parts.minutes, parts.seconds), stored);
  }
});

test('empty STA clears the record and invalid seconds cannot be saved', () => {
  assert.equal(parseSta(' ', ''), null);
  assert.equal(formatSta(null), '--');
  for (const input of [['4', '60'], ['4', '99'], ['-1', '2'], ['1', '1.5'], ['100', '0']]) {
    assert.throws(() => parseSta(...input));
  }
});
