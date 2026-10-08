'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writePe } = require('./fixtures/pe');

test('a second install preserves the originals for restore', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-repeat-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const gameDir = path.join(root, 'Game');
  const sourceDir = path.join(root, 'Payload');
  fs.mkdirSync(gameDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });

  const exePath = path.join(gameDir, 'game.exe');
  const dlssPath = path.join(gameDir, 'nvngx_dlss.dll');
  const nrPath = path.join(gameDir, 'nvngx_dlssnr.dll');
  const fgPath = path.join(gameDir, 'nvngx_dlssg.dll');
  const addonDest = path.join(gameDir, 'renodx-dlss5.addon64');
  const sourceDlss = path.join(sourceDir, 'nvngx_dlss.dll');
  const sourceNr = path.join(sourceDir, 'nvngx_dlssnr.dll');
  const sourceFg = path.join(sourceDir, 'nvngx_dlssg.dll');
  const sourceAddon = path.join(sourceDir, 'renodx-dlss5.addon64');

  fs.writeFileSync(exePath, 'fake executable');
  fs.writeFileSync(dlssPath, 'the user original');
  writePe(sourceDlss, { text: 'new dlss' });
  writePe(sourceNr, { text: 'new neural runtime' });
  writePe(sourceFg, { text: 'new frame generation' });
  fs.writeFileSync(sourceAddon, 'new addon');

  let installed = false;
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
      inspectReShade: () => ({ installed: true, file: 'dxgi.dll', kind: 'proxy', version: '6.8.0', addonSupport: true }),
      scanGame: async () => ({
        dlssFiles: [
          { path: dlssPath, rel: 'nvngx_dlss.dll', name: 'nvngx_dlss.dll', bitness: 64, version: installed ? '2.0.0' : '1.0.0' },
          ...(installed ? [
            { path: nrPath, rel: 'nvngx_dlssnr.dll', name: 'nvngx_dlssnr.dll', bitness: 64, version: '2.0.0' }
          ] : [])
        ],
        streamlineFiles: [],
        reshade: { installed: true, file: 'dxgi.dll', kind: 'proxy', version: '6.8.0', addonSupport: true }
      })
    }
  };

  const { applySwap, restore, backupRoot } = require('../src/core/apply');
  const source = {
    hasNeuralRendering: true,
    addon: sourceAddon,
    payload: [
      { name: 'nvngx_dlss.dll', path: sourceDlss, version: '2.0.0' },
      { name: 'nvngx_dlssnr.dll', path: sourceNr, version: '2.0.0' },
      { name: 'nvngx_dlssg.dll', path: sourceFg, version: '2.0.0' }
    ]
  };
  const config = {
    gameDir,
    exePath,
    api: 'dxgi',
    bitness: 64,
    source,
    reshadeSetup: null,
    installReShade: true,
    addMissingDlss: true,
    addStreamline: false,
    upgradeReShade: false
  };

  await applySwap(config);
  installed = true;
  await applySwap(config);

  const manifest = JSON.parse(fs.readFileSync(path.join(backupRoot(gameDir), 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.replaced.map((row) => row.rel), ['nvngx_dlss.dll']);
  assert.deepEqual(new Set(manifest.added), new Set([
    'nvngx_dlssnr.dll',
    'renodx-dlss5.addon64'
  ]));

  await restore(gameDir);
  assert.equal(fs.readFileSync(dlssPath, 'utf8'), 'the user original');
  assert.equal(fs.existsSync(nrPath), false);
  assert.equal(fs.existsSync(fgPath), false);
  assert.equal(fs.existsSync(addonDest), false);
});
