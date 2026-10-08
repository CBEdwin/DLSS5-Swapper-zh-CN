'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writePe } = require('./fixtures/pe');

test('failed ReShade setup leaves an active manifest that restores partial files', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-failed-setup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const gameDir = path.join(root, 'Game');
  const payloadDir = path.join(root, 'Payload');
  fs.mkdirSync(gameDir, { recursive: true });
  fs.mkdirSync(payloadDir, { recursive: true });
  const exePath = path.join(gameDir, 'RDR2.exe');
  const setupPath = path.join(payloadDir, 'ReShade_Setup.exe');
  fs.writeFileSync(exePath, 'game');
  fs.writeFileSync(setupPath, 'setup');
  fs.writeFileSync(path.join(gameDir, 'dxgi.dll'), 'user original proxy');

  const names = ['nvngx_dlss.dll', 'nvngx_dlssnr.dll', 'nvngx_dlssg.dll'];
  const payload = names.map((name) => {
    const file = path.join(payloadDir, name);
    writePe(file, { text: name });
    return { name, path: file, version: '310.8.0.0' };
  });
  const addon = path.join(payloadDir, 'renodx-dlss5.addon64');
  fs.writeFileSync(addon, 'addon');

  const scanPath = require.resolve('../src/core/scan');
  const applyPath = require.resolve('../src/core/apply');
  const originalScan = require.cache[scanPath];
  t.after(() => {
    delete require.cache[applyPath];
    if (originalScan) require.cache[scanPath] = originalScan;
    else delete require.cache[scanPath];
  });
  require.cache[scanPath] = {
    id: scanPath,
    filename: scanPath,
    loaded: true,
    exports: {
      inspectReShade: () => ({ installed: false }),
      scanGame: async () => ({
        dlssFiles: [], streamlineFiles: [],
        reshade: { installed: false, file: null, kind: null, version: null, addonSupport: false }
      })
    }
  };

  const { applySwap, restore, backupRoot } = require('../src/core/apply');
  const setupRunner = async (_setup, args) => {
    const exeDir = path.dirname(args[0]);
    fs.writeFileSync(path.join(exeDir, 'dxgi.dll'), 'partial ReShade');
    fs.writeFileSync(path.join(exeDir, 'ReShade.ini'), 'partial config');
    fs.mkdirSync(path.join(exeDir, 'reshade-shaders'));
    return { code: 1, output: 'setup failed' };
  };

  await assert.rejects(
    applySwap({
      gameDir, exePath, api: 'dxgi', bitness: 64, route: 'native',
      source: { hasNeuralRendering: true, addon, payload },
      reshadeSetup: setupPath, setupRunner,
      installReShade: true, addMissingDlss: true,
      addStreamline: false, upgradeReShade: false
    }),
    (error) => error.code === 'errReShadeInstall'
  );

  const manifestPath = path.join(backupRoot(gameDir), 'manifest.json');
  assert.equal(fs.existsSync(manifestPath), true);
  assert.equal(fs.existsSync(path.join(gameDir, 'renodx-dlss5.addon64')), true);
  assert.equal(fs.existsSync(path.join(gameDir, 'dxgi.dll')), true);

  await restore(gameDir);

  for (const name of [...names, 'renodx-dlss5.addon64', 'ReShade.ini']) {
    assert.equal(fs.existsSync(path.join(gameDir, name)), false, `${name} should be removed`);
  }
  assert.equal(fs.readFileSync(path.join(gameDir, 'dxgi.dll'), 'utf8'), 'user original proxy');
  assert.equal(fs.existsSync(path.join(gameDir, 'reshade-shaders')), false);
  assert.equal(fs.existsSync(manifestPath), false);
});
