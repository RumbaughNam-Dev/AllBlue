const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { hookDriver } = require('./notice-test-helpers.cjs');

function load(api) {
  const h = hookDriver();
  const mod = loadModule('hooks/useAdminPendingCounts.ts', { react: h.react, '@/services/api': { api } });
  return { mod, use: isAdmin => h.render(() => mod.useAdminPendingCounts(isAdmin)) };
}
const counts = { getInquiryPendingCount: async () => ({ count: 1 }), getCertPendingCount: async () => ({ count: 2 }),
  getPendingOrganizations: async () => ({ organizations: [{}] }), getTourRequests: async () => ({ requests: [{}, {}] }) };

test('slide 16: the home photo shows the admin total, hidden at 0 and 99+ from 100', () => {
  const { mod } = load(counts);
  assert.equal(mod.adminBadgeText(0), null);
  assert.equal(mod.adminBadgeText(7), '7');
  assert.equal(mod.adminBadgeText(99), '99');
  assert.equal(mod.adminBadgeText(100), '99+');
});

test('admins load every count into one total; one failing count keeps its last value; non-admins get nothing', async () => {
  let failTours = false;
  const f = load({ ...counts, getTourRequests: async () => { if (failTours) throw new Error('x'); return { requests: [{}, {}] }; } });
  await f.use(true).reload();
  assert.equal(f.use(true).total, 6);
  failTours = true;
  await f.use(true).reload();
  assert.equal(f.use(true).counts.tourRequests, 2);
  let called = false;
  const g = load({ ...counts, getInquiryPendingCount: async () => { called = true; return { count: 1 }; } });
  await g.use(false).reload();
  assert.equal(g.use(false).total, 0);
  assert.equal(called, false);
});
