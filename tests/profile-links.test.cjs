const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
const { hookDriver } = require('./notice-test-helpers.cjs');

function editor(initial) {
  const h = hookDriver();
  let links = initial;
  const element = (type, props, ...children) => ({ type, props: props || {}, children });
  const nodes = tree => !tree ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.children)] : [];
  const Editor = loadModule('components/ProfileLinksEditor.tsx', {
    react: { ...h.react, createElement: element },
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x },
      Animated: { View: 'Animated.View', Value: class { setValue() {} } }, PanResponder: { create: () => ({ panHandlers: {} }) },
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/constants/Colors': { default: { brand: { white: '#fff' } }, __esModule: true },
    '@/components/ProfileLinkPopup': { __esModule: true, default: 'ProfileLinkPopup' },
    '@/utils/profileLinks': loadModule('utils/profileLinks.ts', {}),
  }).default;
  const render = () => nodes(h.render(() => Editor({ links, onChange: next => { links = JSON.parse(JSON.stringify(next)); }, onDragChange() {} })));
  const popup = () => render().find(n => n.type === 'ProfileLinkPopup').props;
  const press = label => render().find(n => n.props.accessibilityLabel === label || (n.type === 'Pressable' && n.children.flat().some(c => c?.children?.flat().includes(label)))).props.onPress();
  return { render, popup, press, get links() { return links; } };
}
const kakao = { name: '카카오톡 오픈채팅', url: 'https://open.kakao.com/o/x' };
const insta = { name: '인스타그램', url: 'https://instagram.com/a' };

test("slide 14: '＋ 링크 추가' adds to the bottom, tapping a link edits it in place, and 삭제 removes it", () => {
  const e = editor([kakao]);
  assert.equal(e.popup().visible, false);
  e.press('＋ 링크 추가');
  assert.equal(e.popup().visible, true);
  assert.equal(e.popup().initial, null, 'a new link opens empty');
  e.popup().onAdd(insta);
  assert.deepEqual(e.links, [kakao, insta]);

  e.press('카카오톡 오픈채팅 수정');
  assert.deepEqual(JSON.parse(JSON.stringify(e.popup().initial)), kakao, 'opens filled in');
  e.popup().onAdd({ name: '오픈채팅', url: kakao.url });
  assert.deepEqual(e.links, [{ name: '오픈채팅', url: kakao.url }, insta], 'edited in place');

  e.press('인스타그램 수정');
  e.popup().onDelete();
  assert.deepEqual(e.links, [{ name: '오픈채팅', url: kakao.url }]);
  assert.equal(e.popup().visible, false);
});

test('link icons: instagram, youtube and kakaotalk addresses get their own icon, other addresses keep the link icon', () => {
  const { linkBrand } = loadModule('utils/profileLinks.ts', {});
  assert.equal(linkBrand('https://www.instagram.com/allblue'), 'instagram');
  assert.equal(linkBrand('https://instagr.am/p/x'), 'instagram');
  assert.equal(linkBrand('https://m.youtube.com/@allblue'), 'youtube');
  assert.equal(linkBrand('https://youtu.be/abc'), 'youtube');
  assert.equal(linkBrand('https://music.youtube.com/x'), 'youtube');
  assert.equal(linkBrand('https://open.kakao.com/o/abc'), 'kakaotalk');
  assert.equal(linkBrand('https://pf.kakao.com/_abc'), 'kakaotalk');
  assert.equal(linkBrand('open.kakao.com/o/abc'), 'kakaotalk');
  assert.equal(linkBrand('HTTPS://WWW.YOUTUBE.COM/watch?v=1'), 'youtube');
  // 다른 카카오 서비스 · 비슷한 이름 · 다른 사이트는 링크 아이콘
  assert.equal(linkBrand('https://map.kakao.com/x'), null);
  assert.equal(linkBrand('https://notinstagram.com'), null);
  assert.equal(linkBrand('https://instagram.com.evil.kr'), null);
  assert.equal(linkBrand('https://blog.naver.com/x'), null);
  assert.equal(linkBrand(''), null);
});

test('profile link chips: up to two links show as chips, three or more add 더보기 that opens a popup with every link', () => {
  const h = hookDriver();
  const opened = [];
  const element = (type, props, ...children) => ({ type, props: props || {}, children });
  const nodes = tree => !tree ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.children)] : [];
  const content = tree => tree == null || typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(content).join('') : typeof tree === 'object' ? content(tree.children) : String(tree);
  const Chips = loadModule('components/LinkChips.tsx', {
    react: { ...h.react, createElement: element },
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x },
      Linking: { openURL: async url => { opened.push(url); } }, Alert: { alert() {} },
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/constants/Colors': { default: { brand: { white: '#fff' } }, __esModule: true },
    '@/components/LinkIcon': { __esModule: true, default: 'LinkIcon' },
    '@/components/LinksPopup': { __esModule: true, default: 'LinksPopup' },
  }).default;
  const links = n => Array.from({ length: n }, (_, i) => ({ name: `링크${i + 1}`, url: `https://site${i + 1}.kr` }));
  const render = n => h.render(() => Chips({ links: links(n) }));
  const buttons = tree => nodes(tree).filter(n => n.type === 'Pressable').map(content);

  assert.equal(render(0), null);
  assert.deepEqual(buttons(render(2)), ['링크1', '링크2']);
  // 3개부터: 앞의 2개 + 더보기, 팝업에는 전부
  let tree = render(4);
  assert.deepEqual(buttons(tree), ['링크1', '링크2', '더보기']);
  let popup = nodes(tree).find(n => n.type === 'LinksPopup');
  assert.equal(popup.props.visible, false);
  assert.equal(popup.props.links.length, 4);
  nodes(tree).find(n => n.type === 'Pressable' && content(n) === '더보기').props.onPress();
  tree = render(4);
  popup = nodes(tree).find(n => n.type === 'LinksPopup');
  assert.equal(popup.props.visible, true);
  popup.props.onOpen('https://site4.kr');
  assert.deepEqual(opened, ['https://site4.kr']);
  popup.props.onClose();
  assert.equal(nodes(render(4)).find(n => n.type === 'LinksPopup').props.visible, false);
});
