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
      reviseTourRequest: async (id, note) => { calls.push(['revise', id, note]); if (fail) throw fail; },
      dismissTourReports: async id => { calls.push(['ok', id]); if (fail) throw fail; },
      takeDownTour: async (id, note) => { calls.push(['down', id, note]); if (fail) throw fail; },
    } },
  });
  return { mod, calls, alerts };
}

test('slide 15: approving goes through a confirm; 보완 요청 sends the written note', async () => {
  const ok = load({ press: '승인' });
  assert.equal(await ok.mod.confirmApprove(31, '보홀 캠프'), true);
  assert.equal(ok.alerts[0].title, '투어를 승인할까요?');
  const cancel = load({ press: '취소' });
  assert.equal(await cancel.mod.confirmApprove(31, '보홀 캠프'), false);
  assert.equal(cancel.calls.length, 0);
  const revise = load();
  assert.equal(await revise.mod.sendRevision(31, '일정표 이미지를 추가해 주세요'), true);
  assert.equal(JSON.stringify(revise.calls), JSON.stringify([['revise', 31, '일정표 이미지를 추가해 주세요']]));
});

test('a request another admin already handled still leaves the list; other errors keep it', async () => {
  const raced = load({ press: '승인', fail: { code: 'PROCESSED' } });
  assert.equal(await raced.mod.confirmApprove(31, 't'), true);
  assert.equal(raced.alerts[1].message, '이미 처리된 요청이에요.');
  const broken = load({ fail: { message: '서버 오류' } });
  assert.equal(await broken.mod.sendRevision(31, '보완'), false);
});

test('slide 19: 문제 없음 goes through a confirm; 내리고 보완 요청 sends the note', async () => {
  const f = load({ press: '문제 없음' });
  assert.equal(await f.mod.confirmDismissReports(4, '오키나와'), true);
  assert.equal(await f.mod.sendTakeDown(9, '사진을 바꿔 주세요'), true);
  assert.equal(JSON.stringify(f.calls), JSON.stringify([['ok', 4], ['down', 9, '사진을 바꿔 주세요']]));
});

test('request time shows as MM.DD HH:mm', () => {
  const { mod } = load();
  const local = new Date(2026, 9, 28, 14, 20).toISOString();
  assert.equal(mod.formatRequestedAt(local), '10.28 14:20');
});
