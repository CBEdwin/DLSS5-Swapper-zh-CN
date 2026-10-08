'use strict';
// 2.2.5 shipped the multipass consumer where the native route's add-on
// belongs, and "Native DLSS (RenoDX)" installed it. It was picked as "the first
// .addon64 in the folder", and renodx-dlss.addon64 sorts ahead of
// renodx-dlss5.addon64. In a game that already had its own renodx-dlss5, the
// two sat side by side: both register as "RenoDX DLSS", ReShade kept the first
// and dropped the second, and the route that was picked decided nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-consumer-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const read = (file) => fs.readFileSync(file, 'utf8');
const addonsIn = (dir) => fs.readdirSync(dir).filter((f) => /\.addon64$/i.test(f)).sort();

test('the native consumer is chosen by name, even when the multipass one sorts first', (t) => {
  const root = temp(t);
  fs.writeFileSync(path.join(root, 'renodx-dlss.addon64'), 'multipass');
  fs.writeFileSync(path.join(root, 'renodx-dlss5.addon64'), 'ordinary');
  const { scanSource } = require('../src/core/scan.js');
  assert.equal(path.basename(scanSource(root).addon), 'renodx-dlss5.addon64');
});

test('a 2.2.5 payload, with only the multipass file at its root, still installs the ordinary one', (t) => {
  const root = temp(t);
  const host = path.join(root, 'feeder', 'host64');
  fs.mkdirSync(host, { recursive: true });
  fs.writeFileSync(path.join(root, 'renodx-dlss.addon64'), 'multipass');
  fs.writeFileSync(path.join(host, 'renodx-dlss.addon64'), 'multipass');
  fs.writeFileSync(path.join(host, 'renodx-dlss5.addon64'), 'ordinary');
  const { scanSource } = require('../src/core/scan.js');
  const source = scanSource(root);
  assert.equal(source.addon, path.join(host, 'renodx-dlss5.addon64'));
  assert.notEqual(source.addon, source.feeder.multipassAddon);
});

test('the build copies the verified renodx-dlss5 to the payload root, by name', () => {
  const script = read(path.join(__dirname, '..', 'scripts', 'collect-payload.js'));
  assert.match(script, /const addon = await findHostAddon\(source\.dir\);/);
  assert.match(script, /copyFile\(addon, path\.join\(PAYLOAD, 'renodx-dlss5\.addon64'\)\);/);
  assert.doesNotMatch(script, /findAddon\(/, 'the first-file-wins lookup is gone');
});

test('multipass comes only from its own route: the hidden per-game switch is gone', () => {
  const root = path.join(__dirname, '..');
  const main = read(path.join(root, 'main.js'));
  const preload = read(path.join(root, 'preload.js'));
  const apply = read(path.join(root, 'src', 'core', 'apply.js'));
  assert.doesNotMatch(main, /multipass-state|set-multipass|multipassGames/);
  assert.doesNotMatch(preload, /multipassState|setMultipass/);
  assert.doesNotMatch(apply, /config\.multipass/);
  assert.match(apply, /const consumerName = 'renodx-dlss5\.addon64';/);
});

// A real install and a real restore, with only the game scanner stubbed.
function harness(t) {
  const root = temp(t);
  const gameDir = path.join(root, 'Game');
  const payloadDir = path.join(root, 'Payload');
  fs.mkdirSync(gameDir, { recursive: true });
  fs.mkdirSync(path.join(payloadDir, 'host64'), { recursive: true });
  const exePath = path.join(gameDir, 'game.exe');
  fs.writeFileSync(exePath, 'fake executable');
  const ordinary = path.join(payloadDir, 'renodx-dlss5.addon64');
  const multipass = path.join(payloadDir, 'host64', 'renodx-dlss.addon64');
  fs.writeFileSync(ordinary, 'ordinary from the app');
  fs.writeFileSync(multipass, 'multipass from the app');

  const scanPath = require.resolve('../src/core/scan');
  const applyPath = require.resolve('../src/core/apply');
  const originalScan = require.cache[scanPath];
  delete require.cache[applyPath];
  const reshade = { installed: true, file: 'dxgi.dll', kind: 'proxy', version: '6.8.0', addonSupport: true };
  require.cache[scanPath] = {
    id: scanPath, filename: scanPath, loaded: true,
    exports: {
      inspectReShade: () => reshade,
      scanGame: async () => ({ dlssFiles: [], streamlineFiles: [], reshade })
    }
  };
  t.after(() => {
    delete require.cache[applyPath];
    if (originalScan) require.cache[scanPath] = originalScan;
    else delete require.cache[scanPath];
  });
  const apply = require('../src/core/apply');
  const config = (route, addon = ordinary) => ({
    gameDir, exePath, api: 'dxgi', bitness: 64, route,
    source: { hasNeuralRendering: true, addon, payload: [], feeder: { multipassAddon: multipass } },
    reshadeSetup: null, installReShade: false, addMissingDlss: false, upgradeReShade: false
  });
  return { gameDir, apply, config, multipass };
}

test('native: a stray multipass beside the game is set aside, and Restore puts it back', async (t) => {
  const { gameDir, apply, config } = harness(t);
  fs.writeFileSync(path.join(gameDir, 'renodx-dlss.addon64'), 'theirs');
  await apply.applySwap(config('native'));
  assert.deepEqual(addonsIn(gameDir), ['renodx-dlss5.addon64'], 'one consumer, the one the route names');
  assert.equal(read(path.join(gameDir, 'renodx-dlss5.addon64')), 'ordinary from the app');
  await apply.restore(gameDir);
  assert.deepEqual(addonsIn(gameDir), ['renodx-dlss.addon64']);
  assert.equal(read(path.join(gameDir, 'renodx-dlss.addon64')), 'theirs', 'byte for byte');
});

test('multipass route: the person’s own renodx-dlss5 is set aside, and Restore puts it back', async (t) => {
  const { gameDir, apply, config } = harness(t);
  fs.writeFileSync(path.join(gameDir, 'renodx-dlss5.addon64'), 'theirs');
  await apply.applySwap(config('renodx'));
  assert.deepEqual(addonsIn(gameDir), ['renodx-dlss.addon64']);
  assert.equal(read(path.join(gameDir, 'renodx-dlss.addon64')), 'multipass from the app');
  await apply.restore(gameDir);
  assert.deepEqual(addonsIn(gameDir), ['renodx-dlss5.addon64']);
  assert.equal(read(path.join(gameDir, 'renodx-dlss5.addon64')), 'theirs');
});

test('installing again over a 2.2.5 native install replaces the wrong file, and Restore leaves nothing', async (t) => {
  const { gameDir, apply, config, multipass } = harness(t);
  // What 2.2.5 did: the native route with the multipass file as its add-on.
  await apply.applySwap(config('native', multipass));
  assert.deepEqual(addonsIn(gameDir), ['renodx-dlss.addon64']);
  await apply.applySwap(config('native'));
  assert.deepEqual(addonsIn(gameDir), ['renodx-dlss5.addon64'], 'the multipass file this app put there is gone');
  await apply.restore(gameDir);
  assert.deepEqual(addonsIn(gameDir), [], 'both were ours, so neither survives');
});

test('other RenoDX mods are not consumers and are left alone', async (t) => {
  const { gameDir, apply, config } = harness(t);
  fs.writeFileSync(path.join(gameDir, 'renodx-mafiade.addon64'), 'a game mod');
  fs.writeFileSync(path.join(gameDir, 'renodx-dlss5.addon64.disabled'), 'switched off by hand');
  await apply.applySwap(config('native'));
  assert.ok(fs.existsSync(path.join(gameDir, 'renodx-mafiade.addon64')));
  assert.ok(fs.existsSync(path.join(gameDir, 'renodx-dlss5.addon64.disabled')), 'ReShade does not load .disabled');
});
