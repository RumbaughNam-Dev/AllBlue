const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

function load({ press, fail } = {}) {
  const calls = [], alerts = [];
  const mod = loadModule('features/tour/requests.ts', {
    'react-native': { Alert: { alert: (title, message, buttons) => {
      alerts.push({ title, message });
      const button = buttons?.find(b => b.text === press);
      button?.onPress?.();
    } } },
    '@/services/api': { api: {
      approveTourRequest: async id => { calls.push(['approve', id]); if (fail) throw fail; },
      rejectTourRequest: async id => { calls.push(['reject', id]); if (fail) throw fail; },
    } },
  });
  return { mod, calls, alerts };
}

test('slide 15: approve and reject go through a confirm, and cancelling changes nothing', async () => {
  const ok = load({ press: '승인' });
  assert.equal(await ok.mod.confirmTourRequest(31, '보홀 캠프', 'approve'), true);
  assert.deepEqual(ok.calls, [['approve', 31]]);
  assert.equal(ok.alerts[0].title, '투어를 승인할까요?');

  const no = load({ press: '불허' });
  assert.equal(await no.mod.confirmTourRequest(31, '보홀 캠프', 'reject'), true);
  assert.deepEqual(no.calls, [['reject', 31]]);

  const cancel = load({ press: '취소' });
  assert.equal(await cancel.mod.confirmTourRequest(31, '보홀 캠프', 'approve'), false);
  assert.deepEqual(cancel.calls, []);
});

test('a request another admin already handled still leaves the list; other errors keep it', async () => {
  const raced = load({ press: '승인', fail: { code: 'PROCESSED' } });
  assert.equal(await raced.mod.confirmTourRequest(31, 't', 'approve'), true);
  assert.equal(raced.alerts[1].message, '이미 처리된 요청이에요.');
  const broken = load({ press: '승인', fail: { message: '서버 오류' } });
  assert.equal(await broken.mod.confirmTourRequest(31, 't', 'approve'), false);
});

test('request time shows as MM.DD HH:mm', () => {
  const { mod } = load();
  const local = new Date(2026, 9, 28, 14, 20).toISOString();
  assert.equal(mod.formatRequestedAt(local), '10.28 14:20');
});

test('slide 19: 문제 없음 / 불허로 내리기 go through a confirm', async () => {
  const calls = [];
  const mod = loadModule('features/tour/requests.ts', {
    'react-native': { Alert: { alert: (title, message, buttons) => buttons?.find(b => b.text === '내리기' || b.text === '문제 없음')?.onPress?.() } },
    '@/services/api': { api: { takeDownTour: async id => calls.push(['down', id]), dismissTourReports: async id => calls.push(['ok', id]) } },
  });
  assert.equal(await mod.confirmTourReports(9, '다합', 'takeDown'), true);
  assert.equal(await mod.confirmTourReports(4, '오키나와', 'dismiss'), true);
  assert.deepEqual(calls, [['down', 9], ['ok', 4]]);
});
