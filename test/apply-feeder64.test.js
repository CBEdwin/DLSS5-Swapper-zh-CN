'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { applySwap, restore } = require('../src/core/apply');

function put(file, contents = path.basename(file)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  return file;
}

test('64-bit Feeder route installs the synthetic contract and Lumenite in process', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-feed64-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gameDir = path.join(root, 'No Mans Sky');
  const payload = path.join(root, 'Payload');
  const exePath = put(path.join(gameDir, 'NMS.exe'));
  const originalDlss = put(path.join(gameDir, 'nvngx_dlss.dll'), 'original dlss');
  const setup = put(path.join(payload, 'ReShade_Setup_6.8.0_Addon.exe'));
  const shaderRoot = path.join(payload, 'feeder', 'reshade-shaders');
  const lumeniteRoot = path.join(root, 'LumeniteFX');

  for (const rel of [
    ['Shaders', 'DLSS5_Feed.fx'], ['Shaders', 'vort_Motion.fx'],
    ['Shaders', 'ReShade.fxh'], ['Shaders', 'ReShadeUI.fxh'],
    ['Shaders', 'Includes', 'vort_Defs.fxh'], ['Textures', 'vort_BlueNoise.png']
  ]) put(path.join(shaderRoot, ...rel));
  put(path.join(lumeniteRoot, 'Shaders', 'lumenite_Kernel.fx'));
  put(path.join(lumeniteRoot, 'Shaders', 'include', 'lumenite_Helpers.fxh'));
  put(path.join(lumeniteRoot, 'Textures', 'lumenite_bluenoise256.png'));
  put(path.join(lumeniteRoot, 'LICENSE.md'), 'license');

  const source = {
    hasNeuralRendering: true,
    payload: [
      { name: 'nvngx_dlssnr.dll', path: put(path.join(payload, 'nvngx_dlssnr.dll')), version: '310.8.0' },
      { name: 'nvngx_dlss.dll', path: put(path.join(payload, 'nvngx_dlss.dll'), 'new dlss'), version: '310.8.0' }
    ],
    feeder: {
      ok64: true,
      addon64: put(path.join(payload, 'feeder', 'dlss5-feed.addon64')),
      feedShader: path.join(shaderRoot, 'Shaders', 'DLSS5_Feed.fx'),
      shaderRoot,
      hostAddon: put(path.join(payload, 'feeder', 'host64', 'renodx-dlss5.addon64')),
      lumeniteRoot
    }
  };
  const setupRunner = async (_setup, args) => {
    put(path.join(path.dirname(args[0]), 'dxgi.dll'), 'ReShade Searching for add-ons');
    return { code: 0, output: '' };
  };

  const manifest = await applySwap({
    gameDir, exePath, api: 'dxgi', bitness: 64, route: 'feeder', source,
    reshadeSetup: setup, setupRunner, installReShade: true
  });

  assert.equal(manifest.route, 'feeder');
  assert.equal(manifest.feeder.provider, 3);
  assert.equal(fs.existsSync(path.join(gameDir, 'dlss5-feed.addon64')), true);
  assert.equal(fs.existsSync(path.join(gameDir, 'renodx-dlss5.addon64')), true);
  assert.equal(fs.existsSync(path.join(gameDir, 'host64')), false);
  assert.equal(fs.existsSync(path.join(gameDir, 'reshade-shaders', 'Shaders', 'lumenite_Kernel.fx')), true);
  assert.match(fs.readFileSync(path.join(gameDir, 'ReShade.ini'), 'utf8'), /DLSS5_MV_PROVIDER=3/);
  assert.match(fs.readFileSync(path.join(gameDir, 'ReShadePreset.ini'), 'utf8'), /Lumenite_Kernel@lumenite_Kernel\.fx,DLSS5_Feed@DLSS5_Feed\.fx/);

  await restore(gameDir);
  assert.equal(fs.readFileSync(originalDlss, 'utf8'), 'original dlss');
  assert.equal(fs.existsSync(path.join(gameDir, 'dlss5-feed.addon64')), false);
  assert.equal(fs.existsSync(path.join(gameDir, 'reshade-shaders')), false);
});
