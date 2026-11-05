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
