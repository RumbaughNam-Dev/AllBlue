const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');

test('slide 19: a report needs a reason, and 기타 needs the details written', () => {
  const popup = loadModule('features/tour/TourReportPopup.tsx', {
    react: { createElement: () => null, useEffect() {}, useState: v => [v, () => {}] },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', StyleSheet: { create: x => x } },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/constants/Colors': { default: { brand: { white: '#fff' } }, __esModule: true },
    './TourManagePopups': { Buttons: 'Buttons', Popup: 'Popup' },
  });
  assert.equal(popup.canSubmitReport(null, ''), false);
  assert.equal(popup.canSubmitReport('NO_CONTACT', ''), true);
  assert.equal(popup.canSubmitReport('ETC', '  '), false);
  assert.equal(popup.canSubmitReport('ETC', '사진이 투어와 관계없어요'), true);
  assert.equal(popup.canSubmitReport('FALSE_INFO', 'x'.repeat(201)), false);
  assert.equal(popup.REPORT_REASONS.map(r => r.code).join(), 'INAPPROPRIATE,FALSE_INFO,NO_CONTACT,ETC');
});

test('slide 22: a banner needs an image, a tour and a valid period before it can be saved', () => {
  const b = loadModule('features/tour/banners.ts', {});
  const ok = { imageUri: 'file://a.jpg', remote: false, mimeType: 'image/jpeg', tourId: 9, startDate: '2026-11-01', endDate: '2026-11-30', isEnabled: true };
  assert.equal(b.bannerFormError(ok), null);
  assert.equal(b.bannerFormError({ ...ok, imageUri: '' }), '배너 이미지를 올려 주세요');
  assert.equal(b.bannerFormError({ ...ok, tourId: null }), '연결할 투어를 골라 주세요');
  assert.equal(b.bannerFormError({ ...ok, endDate: '' }), '노출 기간을 골라 주세요');
  assert.equal(b.bannerFormError({ ...ok, endDate: '2026-10-31' }), '종료일이 시작일보다 빨라요');
  assert.equal(b.shortDay('2026-11-01'), '11.01');
  assert.equal(Object.keys(b.BANNER_STATE).sort().join(), 'ENDED,HIDDEN,LIVE,OFF,SCHEDULED');
});

test('slide 24: shared text is title · country · period plus the link (no price or recruitment)', () => {
  const ui = loadModule('features/tour/ui.ts', { 'react-native': { Alert: {} } });
  const tour = { title: '보홀 프리다이빙 캠프', countryName: '필리핀', startDate: '2026-11-20', endDate: '2026-11-24' };
  const url = 'https://api.rumbaugh.co.kr/allblue/t/4';
  const ios = ui.shareContent(tour, url, 'ios');
  assert.equal(ios.message, '보홀 프리다이빙 캠프\n필리핀 · 11.20 - 11.24');
  assert.equal(ios.url, url);
  assert.equal(ui.shareContent(tour, url, 'android').message, `보홀 프리다이빙 캠프\n필리핀 · 11.20 - 11.24\n${url}`);
});
