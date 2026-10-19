const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers.cjs');
function harness(list = true) {
  const events = new Map(), frames = new Map(), calls = [];
  let next = 0, cleanup;
  const { useVisibleKeyboardInput } = loadModule('hooks/useVisibleKeyboardInput.ts', {
    react: {useRef: current => ({current}),useCallback: fn => fn,useEffect: fn => {cleanup=fn();}},
    'react-native': {Keyboard:{addListener:(name,fn)=>{events.set(name,fn);return {remove:()=>events.delete(name)};}}},
  }, {requestAnimationFrame: fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)});
  const hook=useVisibleKeyboardInput();
  const viewport={top:100,height:500};
  const scroll={getNativeScrollRef:()=>({measureInWindow:fn=>fn(0,viewport.top,390,viewport.height)}),scrollTo:args=>calls.push(args)};
  if(list)hook.listRef.current={getScrollResponder:()=>scroll};else hook.scrollRef.current=scroll;
  const input=(top,height)=>({measureInWindow:fn=>fn(0,top,300,height)});
  const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  return {hook,events,calls,viewport,input,flush,cleanup:()=>cleanup(),frames};
}
test('keyboard-resized viewport scrolls the focused measurement above its bottom edge',()=>{
 const h=harness();h.hook.onScroll({nativeEvent:{contentOffset:{y:200}}});
 h.hook.focus(h.input(520,40));h.flush();assert.equal(h.calls.length,0);
 h.viewport.height=250;h.events.get('keyboardDidShow')();h.flush();
 assert.equal(h.calls[0].y,422);
});
test('switching fields while keyboard is open reveals only the latest input',()=>{
 const h=harness();h.viewport.height=250;
 h.hook.focus(h.input(620,40));h.hook.focus(h.input(200,40));h.flush();assert.equal(h.calls.length,0);
 const field=h.input(620,40);h.hook.focus(field);h.hook.blur(field);h.flush();assert.equal(h.calls.length,0);
});
test('long memo footer and memo-only scroll view use the visible viewport',()=>{
 for(const list of [true,false]){
  const h=harness(list);h.viewport.height=280;h.hook.focus(h.input(400,120));h.flush();
  assert.equal(h.calls[0].y,152);
 }
});
test('sticky heading clearance, resize and unmount are handled',()=>{
 const h=harness();h.hook.onScroll({nativeEvent:{contentOffset:{y:100}}});
 h.hook.focus(h.input(110,40));h.flush();assert.equal(h.calls[0].y,66);
 h.hook.onLayout();assert.equal(h.frames.size,1);h.cleanup();
 assert.equal(h.events.size,0);assert.equal(h.frames.size,0);
});
