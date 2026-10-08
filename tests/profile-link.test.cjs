const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadModule } = require('./helpers.cjs');

for (const [id, expected] of [['self', '/profile'], ['member-login-id', { pathname: '/profile-view', params: { userId: 'member-login-id' } }], [null, undefined]]) {
  test(`profile link routes ${id ?? 'guest'} without triggering parent actions`, () => {
    const calls=[];
    const Link = loadModule('components/ProfileLink.tsx', {
      react: { createElement: (type, props, ...children) => ({type, props, children}) },
      'react-native': { Pressable: 'Pressable' },
      'expo-router': { useRouter: () => ({ push: route => calls.push(JSON.parse(JSON.stringify(route))) }) },
      '@/contexts/AuthContext': { useAuth: () => ({ user: { id: 'self' } }) },
    }).default;
    let stopped=false, closed=false;
    const tree=Link({ userId:id, label:'닉네임 (이름)', beforeOpen:()=>{ closed=true; }, children:'photo/name' });
    assert.equal(tree.props.disabled, !id);
    tree.props.onPress({ stopPropagation:()=>{ stopped=true; } });
    assert.equal(stopped,true);
    assert.equal(closed,!!id);
    assert.equal(calls.length,id ? 1 : 0);
    if(id) assert.deepEqual(calls[0],expected);
  });
}
