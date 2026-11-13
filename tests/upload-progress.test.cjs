const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadModule } = require('./helpers.cjs');
const { hookDriver } = require('./notice-test-helpers.cjs');

const flush = () => new Promise(setImmediate);

// 업로드 진행 팝업 (components/UploadProgress.tsx): 타이머는 가짜로 돌려 '0.4초 뒤에 뜸'을 확인.
// 팝업(Modal)이 다 떴다 · 다 닫혔다는 알림은 테스트가 popup.onShow() · popup.onDismiss()로 대신 보냄
function harness(os = 'ios') {
  const h = hookDriver();
  const timers = [];
  const native = Object.fromEntries(['Image', 'Modal', 'ScrollView', 'Text', 'View'].map(name => [name, name]));
  const mod = loadModule('components/UploadProgress.tsx', {
    react: { ...h.react, createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
    'react-native': {
      ...native, Platform: { OS: os }, StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390, height: 844 }),
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    '@/constants/Colors': { __esModule: true, default: { brand: { accent: '#00B4D8', deep: '#023E73', white: '#FFFFFF' } } },
    '@/components/PopupBackdrop': { __esModule: true, default: 'PopupBackdrop' },
    '@/components/Spinner': { __esModule: true, default: 'Spinner' },
  }, {
    setTimeout: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].cleared = true; },
  });
  const render = () => h.render(() => mod.useUploadProgress());
  return { mod, timers, render };
}

// 함수 컴포넌트까지 펼쳐서 화면 글자를 모음
function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (node && typeof node === 'object' && typeof node.type === 'function') return expand(node.type({ ...node.props, children: node.children }));
  if (node && typeof node === 'object') return { ...node, children: expand(node.children) };
  return node;
}
const text = tree => (tree == null || typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(text).join('|')
  : typeof tree === 'object' ? text(tree.children) : String(tree));

test('upload progress: files go one by one with their own progress, the popup waits 0.4s and closes when done', async () => {
  const { mod, timers, render } = harness();
  const progress = [], finish = [];
  const running = render().run([{ label: '사진 1', uri: 'a' }, { label: '사진 2', uri: 'b' }], (file, onProgress, index) => new Promise(resolve => {
    progress[index] = onProgress; finish[index] = () => resolve(`url-${file.uri}`);
  }));
  let state = render();
  assert.deepEqual(state.popup.items.map(i => i.status), ['uploading', 'waiting']);
  assert.equal(state.popup.visible, false);
  assert.equal(timers[0].ms, 400);
  timers[0].fn();
  state = render();
  assert.equal(state.popup.visible, true);
  state.popup.onShow();

  progress[0]({ bytesSent: 50, totalBytes: 100 });
  state = render();
  assert.deepEqual([state.popup.items[0].sent, state.popup.items[0].total], [50, 100]);
  // 같은 %면 다시 그리지 않음
  progress[0]({ bytesSent: 50.4, totalBytes: 100 });
  assert.equal(render().popup.items[0].sent, 50);

  // 화면 글자: 진행 중인 사진은 %, 기다리는 사진은 '대기'
  const shown = text(expand(mod.UploadProgressPopup(render().popup)));
  assert.match(shown, /사진 올리는 중/);
  assert.match(shown, /0 \/ 2장 올렸어요/);
  assert.match(shown, /50%/);
  assert.match(shown, /대기/);

  finish[0]();
  await flush();
  state = render();
  assert.deepEqual(state.popup.items.map(i => i.status), ['done', 'uploading']);
  finish[1]();
  await flush();
  state = render();
  assert.equal(state.popup.visible, false);
  assert.deepEqual(state.popup.items.map(i => i.status), ['done', 'done']);
  // 팝업이 다 닫힌 뒤에 끝남 (부르는 쪽의 포커스 · 화면 이동이 닫히는 애니메이션과 겹치지 않게)
  let ended = false;
  running.then(() => { ended = true; });
  await flush();
  assert.equal(ended, false);
  state.popup.onDismiss();
  // 결과 배열은 모듈 쪽에서 만들어져서 펼쳐서 비교
  assert.deepEqual([...await running], ['url-a', 'url-b']);
});

test('upload progress: a popup still opening closes only after it has opened, and run ends after it has closed', async () => {
  const { timers, render } = harness();
  let finish;
  const running = render().run([{ label: '사진', uri: 'a' }], () => new Promise(resolve => { finish = () => resolve('url'); }), { showAfterMs: 1000 });
  // 사진 피커를 닫자마자 올릴 때: 피커가 다 닫힌 뒤에만 뜸
  assert.equal(timers[0].ms, 1000);
  timers[0].fn();
  assert.equal(render().popup.visible, true);
  // 다 뜨기 전에 업로드가 끝나도 뜨는 도중에는 닫지 않음
  finish();
  await flush();
  assert.equal(render().popup.visible, true);
  render().popup.onShow();
  await flush();
  assert.equal(render().popup.visible, false);
  let ended = false;
  running.then(() => { ended = true; });
  await flush();
  assert.equal(ended, false);
  render().popup.onDismiss();
  assert.deepEqual([...await running], ['url']);
});

test('upload progress: without open / close reports from the popup, each wait gives up after 1s', async () => {
  const { timers, render } = harness();
  let finish;
  const running = render().run([{ label: '사진', uri: 'a' }], () => new Promise(resolve => { finish = () => resolve('url'); }));
  timers[0].fn();
  finish();
  await flush();
  const opening = timers[timers.length - 1];
  assert.equal(opening.ms, 1000);
  opening.fn();
  await flush();
  assert.equal(render().popup.visible, false);
  const closing = timers[timers.length - 1];
  assert.notEqual(closing, opening);
  assert.equal(closing.ms, 1000);
  closing.fn();
  assert.deepEqual([...await running], ['url']);
});

test('upload progress: on Android run ends as soon as the popup is told to close (no close report there)', async () => {
  const { timers, render } = harness('android');
  let finish;
  const running = render().run([{ label: '사진', uri: 'a' }], () => new Promise(resolve => { finish = () => resolve('url'); }));
  timers[0].fn();
  render().popup.onShow();
  finish();
  assert.deepEqual([...await running], ['url']);
  assert.equal(render().popup.visible, false);
});

test('upload progress: a quick upload never shows the popup, a failure closes it and passes the error on', async () => {
  const { timers, render } = harness();
  assert.deepEqual([...await render().run([], async () => 'x')], []);
  assert.equal(timers.length, 0);

  assert.deepEqual([...await render().run([{ label: '프로필 사진', uri: 'p' }], async () => 'ok')], ['ok']);
  assert.equal(timers[0].cleared, true);
  assert.equal(render().popup.visible, false);

  await assert.rejects(render().run([{ label: '자격증 사진', uri: 'c' }], async () => { throw new Error('업로드 실패'); }), /업로드 실패/);
  assert.equal(timers[1].cleared, true);
  assert.equal(render().popup.visible, false);
});

test('upload progress: unknown size shows the spinner, files show a document icon, sizes read as KB / MB', () => {
  const { mod } = harness();
  const row = (extra) => ({ label: '문의.pdf', uri: 'f', kind: 'file', status: 'uploading', sent: 0, total: 0, ...extra });
  const tree = expand(mod.UploadProgressPopup({ visible: true, items: [row()] }));
  const shown = text(tree);
  assert.match(shown, /파일 올리는 중/);
  assert.match(shown, /준비 중/);
  assert.match(JSON.stringify(tree), /"Spinner"/);
  assert.match(JSON.stringify(tree), /document-text-outline/);
  assert.match(text(expand(mod.UploadProgressPopup({ visible: true, items: [row({ sent: 3 * 1024 * 1024, total: 12 * 1024 * 1024 })] }))), /3\.0MB \/ 12\.0MB/);
  assert.equal(mod.formatBytes(300), '1KB');
  assert.equal(mod.formatBytes(48 * 1024), '48KB');
});

test('tour photos: only new photos upload, labelled by their place on screen, and urls keep the screen order', async () => {
  const sent = [];
  const photos = loadModule('features/tour/photos.ts', {
    'react-native': { Alert: { alert() {} } },
    'expo-image-picker': {},
    '@/services/api': { api: { uploadTourImage: async (uri, mimeType, onProgress) => { sent.push([uri, mimeType, typeof onProgress]); return { url: `https://cdn/${uri}` }; } } },
  });
  const labels = [];
  const run = async (files, upload) => {
    labels.push(...files.map(f => f.label));
    const out = [];
    for (const [index, file] of files.entries()) out.push(await upload(file, () => {}, index));
    return out;
  };
  const urls = await photos.uploadPhotos([
    { uri: 'https://cdn/old.jpg', mimeType: '', remote: true },
    { uri: 'a.jpg', mimeType: 'image/jpeg' },
    { uri: 'b.png', mimeType: 'image/png' },
  ], run, '소개 이미지');
  assert.deepEqual(labels, ['소개 이미지 2', '소개 이미지 3']);
  assert.deepEqual(urls, ['https://cdn/old.jpg', 'https://cdn/a.jpg', 'https://cdn/b.png']);
  assert.deepEqual(sent, [['a.jpg', 'image/jpeg', 'function'], ['b.png', 'image/png', 'function']]);
});
