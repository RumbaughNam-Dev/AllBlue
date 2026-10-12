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
    { association: 'AIDA International', labels: ['4'] }, { association: 'PADI', labels: ['Freediver'] },
  ]);
});
test('keeps every distinct instructor qualification and hides ordinary levels in that association', () => {
  const instructor = cert(2, 5, 'AIDA Instructor', 1);
  assert.deepEqual(result([cert(1, 4, 'AIDA 4'), instructor, instructor, cert(3, 6, 'Trainer Instructor', 1), cert(4, 5, 'Youth Instructor', 1)]), [
    { association: 'AIDA International', labels: ['Instructor', 'Trainer Instructor', 'Youth Instructor'] },
  ]);
});
test('empty holdings stay empty even with catalog entries', () => {
  assert.deepEqual(result([], [cert(1, 4, 'AIDA 4')]), []);
});
test('preserves Korean names and qualifications missing from catalog', () => {
  const owned = { ...cert(1, 4, 'AIDA 4'), nameKo: 'AIDA 4레벨' };
  assert.deepEqual(result([owned]), [{ association: 'AIDA International', labels: ['4레벨'] }]);
  assert.deepEqual(result([owned], []), [{ association: '', labels: ['AIDA 4레벨'] }]);
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
