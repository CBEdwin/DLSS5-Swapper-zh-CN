'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writePe } = require('./fixtures/pe');

const { applySwap, restore } = require('../src/core/apply');

function put(file, contents = path.basename(file)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return file;
}

test('encrypted Xbox executable installs ReShade through the readable x64 helper', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-xbox-apply-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const gameDir = path.join(root, 'XboxGame');
  const content = path.join(gameDir, 'Content');
  const exeDir = path.join(content, 'Binaries');
  const exePath = put(path.join(exeDir, 'Game-WinGDK-Shipping.exe'), 'encrypted executable placeholder');
  put(path.join(content, 'MicrosoftGame.config'), [
    '<Game configVersion="1">',
    '  <ExecutableList>',
    '    <Executable Name="Binaries\\Game-WinGDK-Shipping.exe" Id="Game" Architecture="x64"/>',
    '  </ExecutableList>',
    '</Game>'
  ].join('\r\n'));

  const payloadDir = path.join(root, 'Payload');
  const setup = put(path.join(payloadDir, 'ReShade_Setup_6.8.0_Addon.exe'));
  const source = {
    hasNeuralRendering: true,
    addon: put(path.join(payloadDir, 'renodx-dlss5.addon64')),
    payload: [
      { name: 'nvngx_dlss.dll', path: writePe(path.join(payloadDir, 'nvngx_dlss.dll')), version: '310.8.0.0' },
      { name: 'nvngx_dlssnr.dll', path: writePe(path.join(payloadDir, 'nvngx_dlssnr.dll')), version: '310.8.0.0' }
    ],
    feeder: {
      host64: put(path.join(payloadDir, 'feeder', 'dlss5-feed-host64.exe'), 'readable x64 helper')
    }
  };

  const targets = [];
  const setupRunner = async (_setup, args) => {
    const target = args[0];
    targets.push(target);
    if (target === exePath) return { code: 1, output: 'cannot inspect encrypted executable' };
    put(path.join(path.dirname(target), 'dxgi.dll'), 'ReShade Searching for add-ons');
    return { code: 0, output: '' };
  };

  const manifest = await applySwap({
    gameDir,
    exePath,
    api: 'dxgi',
    bitness: 64,
    source,
    reshadeSetup: setup,
    setupRunner,
    installReShade: true,
    addMissingDlss: true,
    addStreamline: false,
    upgradeReShade: false
  });

  assert.equal(targets.length, 2);
  assert.equal(targets[0], exePath);
  assert.notEqual(path.dirname(targets[1]), exeDir);
  assert.equal(fs.readFileSync(path.join(exeDir, 'dxgi.dll'), 'utf8'), 'ReShade Searching for add-ons');
  assert.equal(fs.existsSync(path.join(exeDir, 'renodx-dlss5.addon64')), true);
  assert.equal(manifest.reshade.installedByUs, true);
  assert.equal(manifest.reshade.file, 'dxgi.dll');

  await restore(gameDir);
  assert.equal(fs.existsSync(path.join(exeDir, 'dxgi.dll')), false);
  assert.equal(fs.existsSync(path.join(exeDir, 'renodx-dlss5.addon64')), false);
  assert.equal(fs.existsSync(path.join(exeDir, 'nvngx_dlss.dll')), false);
  assert.equal(fs.existsSync(exePath), true);
});
