'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real IPC handlers and JSON persistence, with no Electron
// window or scanner. A new context represents a fresh app launch.
const mainPath = path.join(__dirname, '../main.js');
function launch(profile) {
  const handlers = new Map();
  vm.runInNewContext(fs.readFileSync(mainPath, 'utf8'), {
    __dirname: path.dirname(mainPath),
    require(name) {
      if (name === 'electron') return {
        app: {
          getPath(key) { assert.equal(key, 'userData'); return profile; },
          setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}
        },
        ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }
      };
      if (name === './package.json') return { version: 'test' };
      if (name.startsWith('./src/')) return {};
      return require(name);
    }
  }, { filename: mainPath });
  return (channel, ...args) => handlers.get(channel)(null, ...args);
}

test('store categories default to enabled for new and existing profiles', (t) => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-grouping-'));
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));
  let call = launch(profile);
  assert.equal(call('boot').groupGamesByStore, true);
  assert.equal(call('settings').groupGamesByStore, true);
  fs.writeFileSync(path.join(profile, 'library.json'), JSON.stringify({ folders: [], theme: 'dark' }));
  call = launch(profile);
  assert.equal(call('boot').groupGamesByStore, true);
  assert.equal(call('settings').groupGamesByStore, true);
});

test('category preference persists across launches without changing library or scanning settings', (t) => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-grouping-'));
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));
  const file = path.join(profile, 'library.json');
  const original = { folders: ['C:\\Games'], manual: ['C:\\DuckStation'], scans: { example: { ok: true } }, hidden: [], autoScanDrives: false, lang: 'ar', theme: 'dark' };
  fs.writeFileSync(file, JSON.stringify(original));
  let call = launch(profile);
  assert.equal(call('set-group-games-by-store', false), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), { ...original, groupGamesByStore: false });
  call = launch(profile);
  assert.equal(call('boot').groupGamesByStore, false);
  assert.equal(call('settings').groupGamesByStore, false);
  assert.equal(call('set-group-games-by-store', true), true);
  call = launch(profile);
  assert.equal(call('boot').groupGamesByStore, true);
  assert.equal(call('settings').groupGamesByStore, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), { ...original, groupGamesByStore: true });
});
