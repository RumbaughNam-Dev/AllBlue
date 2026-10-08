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
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
    ...globals,
  }, { filename });
  return exports;
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
