'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('real IPC persists per-EXE choices, validates selection, uses effective routes and keeps Vulkan switch guards', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-api-ipc-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const game = path.join(root, 'Game');
  const exes = ['Game.exe', 'Other.exe'].map(rel => ({ rel, path: path.join(game, rel), bitness: 64,
    api: 'opengl', apiLabel: 'OpenGL', apiChoices: [{ api: 'opengl', label: 'OpenGL' }] }));
  const scan = { chosen: exes[0], exeCandidates: exes, dlssFiles: [], streamlineFiles: [],
    primaryDlss: { rel: 'native/nvngx_dlss.dll' }, reshade: { installed: false } };
  let old = null, failOpen = false;
  const installs = [], opened = [];
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  function load() {
    const handlers = new Map();
    const stubs = {
      electron: { app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root },
        ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
        shell: { openExternal: async url => { if (failOpen) throw new Error('browser unavailable'); opened.push(url); } } },
      './src/core/scan.js': { scanGame: async () => scan },
      './src/core/compatibility': { assertSafeTarget() {}, hasAntiCheat: () => false, targetIssue: () => null },
      './src/core/install-guards': { assertGameClosed: async () => {} },
      './src/core/runtime-components.js': { missingVCRuntime: () => [], ensureLumenite: async () => null, ensureDgVoodoo: async () => 'fixture' },
      './src/core/backend-manager': { readManifest: () => old, install: async config => {
        installs.push(config);
        return { version: 1, date: new Date().toISOString(), route: config.route,
          game: { dir: game, exe: path.basename(config.exePath), api: config.api }, replaced: [], added: [] };
      } }
    };
    const context = vm.createContext({ require: name => stubs[name] || realRequire(name), __dirname: path.dirname(main), process, Buffer, console });
    vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });
    vm.runInContext('payload = () => ({ source: { feeder: { ok32: true, ok64: true } } }); companionAddons = () => [];', context);
    return handlers;
  }
  let handlers = load();
  const event = { sender: { send() {} } };
  const details = () => handlers.get('details')(event, game);
  const choose = value => handlers.get('set-api-override')(event, game, exes[0].path, value);
  const install = (value, route) => handlers.get('install')(event, game, exes[0].path, route, value);
  assert.equal((await details()).exes[0].apiOverride, 'auto');
  assert.equal((await choose('d3d11')).ok, true);
  assert.equal(installs.length, 0, 'changing preference never installs');
  handlers = load(); // app restart: choice comes from disk, not a renderer Map
  let d = await details();
  assert.equal(d.exes[0].apiOverride, 'd3d11');
  assert.equal(d.exes[1].apiOverride, 'auto');
  assert.equal(d.exes[0].apiLabel, 'OpenGL', 'detection is still visible');
  assert.equal((await install(null)).ok, true);
  assert.equal(installs.at(-1).api, 'dxgi');
  assert.equal(installs.at(-1).apiLabel, 'DirectX 11');
  assert.equal(installs.at(-1).route, 'feeder');
  assert.equal((await install('d3d12')).ok, true);
  assert.equal(installs.at(-1).apiLabel, 'DirectX 12');
  assert.equal(installs.at(-1).route, 'native');
  assert.equal((await install('vulkan', 'native')).ok, true);
  assert.equal(installs.at(-1).api, 'vulkan');
  assert.equal(installs.at(-1).route, 'feeder');
  old = { route: 'native', game: { exe: 'Game.exe', api: 'dxgi' } };
  const before = installs.length;
  assert.equal((await install('vulkan')).code, 'errBackendVulkanSwitch');
  assert.equal((await install('d3d10')).code, 'unsupportedRendererHint');
  assert.equal((await install('bogus')).code, 'errApiChoice');
  assert.equal(installs.length, before);
  for (const value of ['bogus', {}, 'dxgi', '__proto__']) assert.equal((await choose(value)).ok, false);
  assert.equal((await handlers.get('set-api-override')(event, game, path.join(root, 'outside.exe'), 'vulkan')).ok, false);
  assert.equal((await choose('auto')).ok, true);
  handlers = load();
  assert.equal((await details()).exes[0].apiOverride, 'auto');
  old = null;
  assert.equal((await install('auto')).ok, true);
  assert.equal(installs.at(-1).api, 'opengl');
  assert.equal(fs.existsSync(game), false, 'mock install never creates game files');
  for (const destination of ['github', 'releases']) assert.equal(await handlers.get('open-project')(event, destination), true);
  assert.equal(opened.length, 2);
  assert.equal(await handlers.get('open-project')(event, 'https://example.com'), false);
  failOpen = true;
  assert.equal(await handlers.get('open-project')(event, 'github'), false);
});
