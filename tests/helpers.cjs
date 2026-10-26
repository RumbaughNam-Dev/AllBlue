const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the real modules with native adapters replaced; no network or device is needed.
function loadModule(file, modules, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, console, AbortController, setTimeout, clearTimeout, __DEV__: true,
    require(name) {
      if (name === '@/features/split/SplitPane' && !(name in modules)) return splitShim(modules['expo-router']);
      // Tests run as a regular phone, not an iPhone Duo.
      if (name === '@/utils/foldable' && !(name in modules)) return { isIPhoneDuo: false };
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
    ...globals,
  }, { filename });
  return exports;
}

// Not unfolded: the split-aware router and params behave exactly like expo-router's.
function splitShim(router = {}) {
  return {
    useAppRouter: () => router.useRouter?.(),
    useScreenParams: () => router.useLocalSearchParams?.() ?? {},
    useIsPaneRoot: () => false,
    useIsSplit: () => false,
    usePaneDefault() {},
    useIsInPane: () => false,
    useActivePane: () => ({ activeTab: 'index', route: null }),
    SplitScene: ({ children }) => children,
    SplitProvider: ({ children }) => children,
    PaneHost: () => null,
  };
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    multiGet: async (keys) => keys.map((key) => [key, values.get(key) ?? null]),
    multiSet: async (entries) => { entries.forEach(([key, value]) => values.set(key, value)); },
    multiRemove: async (keys) => { keys.forEach((key) => values.delete(key)); },
  };
}


module.exports = { loadModule, storage };
