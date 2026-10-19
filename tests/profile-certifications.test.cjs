const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { groupProfileCertifications } = loadModule('utils/profileCertifications.ts', {});
const aida = { code: 'AIDA', name: 'AIDA International', nameKo: null };
const padi = { code: 'PADI', name: 'PADI', nameKo: null };
const cert = (id, levelOrder, name, isInstructor = 0, association = aida) => ({ id, levelOrder, name, nameKo: null, isInstructor, association });
const result = (owned, catalog = owned) => JSON.parse(JSON.stringify(groupProfileCertifications(owned, catalog)));
test('shows highest owned ordinary qualification per association, not highest catalog qualification', () => {
  const owned = [cert(1, 2, 'AIDA 2'), cert(2, 4, 'AIDA 4'), cert(3, 2, 'PADI Freediver', 0, padi)];
  assert.deepEqual(result(owned, [...owned, cert(4, 5, 'Instructor', 1)]), [
    { association: 'AIDA International', labels: ['AIDA Level 4'] }, { association: 'PADI', labels: ['PADI Freediver'] },
  ]);
});
test('keeps every distinct instructor qualification and hides ordinary levels in that association', () => {
  const instructor = cert(2, 5, 'AIDA Instructor', 1);
  assert.deepEqual(result([cert(1, 4, 'AIDA 4'), instructor, instructor, cert(3, 6, 'Trainer Instructor', 1), cert(4, 5, 'Youth Instructor', 1)]), [
    { association: 'AIDA International', labels: ['AIDA Instructor', 'AIDA Trainer Instructor', 'AIDA Youth Instructor'] },
  ]);
});
test('empty holdings stay empty even with catalog entries', () => {
  assert.deepEqual(result([], [cert(1, 4, 'AIDA 4')]), []);
});
test('uses English names even when Korean names exist or the catalog is unavailable', () => {
  const owned = { ...cert(1, 4, 'AIDA 4'), nameKo: 'AIDA 4레벨' };
  assert.deepEqual(result([owned]), [{ association: 'AIDA International', labels: ['AIDA Level 4'] }]);
  assert.deepEqual(result([{ id: owned.id, name: owned.name, nameKo: owned.nameKo }], []), [{ association: '', labels: ['AIDA 4'] }]);
});

test('images follow the selected qualification, never a lower or different qualification', () => {
  const owned = [{ ...cert(1, 2, 'AIDA 2'), imageUrl: 'lower.jpg' }, cert(2, 4, 'AIDA 4'), { ...cert(3, 5, 'PADI Instructor', 1, padi), imageUrl: 'padi.jpg' }];
  const groups = result(owned);
  assert.equal(groups[0].imageUrls, undefined);
  assert.deepEqual(groups[1].imageUrls, ['padi.jpg']);
});
test('multiple instructor images keep their own positions, and catalog fallback preserves the image', () => {
  const owned = [{ ...cert(1, 5, 'Instructor', 1), imageUrl: 'instructor.jpg' }, cert(2, 5, 'Youth Instructor', 1), { ...cert(3, 6, 'Trainer', 1), imageUrl: 'trainer.jpg' }];
  assert.deepEqual(result(owned)[0].imageUrls, ['instructor.jpg', null, 'trainer.jpg']);
  assert.deepEqual(result([owned[0]], [])[0].imageUrls, ['instructor.jpg']);
});

const aidaInstructor = (id, code, name, imageUrl) => ({ ...cert(id, 5, name, 1), code, imageUrl });
const base = aidaInstructor(10, 'AIDA-INST', 'AIDA Instructor', 'base.jpg');
const master = aidaInstructor(11, 'AIDA-MASTER-INST', 'AIDA Master Instructor', 'master.jpg');
const trainer = aidaInstructor(12, 'AIDA-INST-TRAINER', 'AIDA Instructor Trainer', 'trainer.jpg');
const youth = aidaInstructor(13, 'AIDA-YOUTH-INST', 'AIDA Youth Instructor', 'youth.jpg');
for (const [owned, labels, images] of [
  [[base, master, trainer, youth], ['Instructor Trainer', 'Youth Instructor'], ['trainer.jpg', 'youth.jpg']],
  [[youth, master, base], ['Master Instructor', 'Youth Instructor'], ['master.jpg', 'youth.jpg']],
  [[base, youth], ['Instructor', 'Youth Instructor'], ['base.jpg', 'youth.jpg']],
  [[trainer, master], ['Instructor Trainer'], ['trainer.jpg']],
  [[youth], ['Youth Instructor'], ['youth.jpg']],
]) test(`AIDA hierarchy: ${labels.join(' + ')}`, () => {
  assert.deepEqual(result(owned, []), [{ association: 'AIDA International', labels: labels.map(label => `AIDA ${label}`), imageUrls: images }]);
});
test('AIDA hierarchy also works with a legacy profile response and current catalog', () => {
  const owned = [base, master, trainer, youth];
  const legacy = owned.map(({ id, name, nameKo, imageUrl }) => ({ id, name, nameKo, imageUrl }));
  assert.deepEqual(result(legacy, owned), result(owned, []));
});
