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

test('32-bit DX9 install deploys feeder host and restores every added file', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-x86-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gameDir = path.join(root, 'Game');
  const payload = path.join(root, 'Payload');
  const exePath = put(path.join(gameDir, 'falloutnv.exe'), 'MZ fake 32-bit game');
  const setup = put(path.join(payload, 'ReShade_Setup_6.8.0_Addon.exe'));
  const shaderRoot = path.join(payload, 'feeder', 'reshade-shaders');

  const source = {
    hasNeuralRendering: true,
    payload: [
      { name: 'nvngx_dlssnr.dll', path: put(path.join(payload, 'nvngx_dlssnr.dll')), version: '1.0.0' },
      { name: 'nvngx_dlss.dll', path: put(path.join(payload, 'nvngx_dlss.dll')), version: '1.0.0' }
    ],
    feeder: {
      ok: true,
      addon32: put(path.join(payload, 'feeder', 'dlss5-feed.addon32')),
      host64: put(path.join(payload, 'feeder', 'dlss5-feed-host64.exe')),
      feedShader: put(path.join(shaderRoot, 'Shaders', 'DLSS5_Feed.fx')),
      shaderRoot,
      hostAddon: put(path.join(payload, 'feeder', 'host64', 'renodx-dlss5.addon64')),
      dgVoodooDir: path.join(payload, 'feeder', 'dgvoodoo')
    }
  };
  put(path.join(shaderRoot, 'Shaders', 'vort_Motion.fx'));
  put(path.join(shaderRoot, 'Shaders', 'ReShade.fxh'));
  put(path.join(shaderRoot, 'Shaders', 'ReShadeUI.fxh'));
  put(path.join(shaderRoot, 'Shaders', 'Includes', 'vort_Defs.fxh'));
  put(path.join(shaderRoot, 'Textures', 'vort_BlueNoise.png'));
  put(path.join(source.feeder.dgVoodooDir, 'D3D9.dll'));
  put(path.join(source.feeder.dgVoodooDir, 'dgVoodooCpl.exe'));
  put(path.join(source.feeder.dgVoodooDir, 'dgVoodoo.conf'), '[General]\r\nOutputAPI=bestavailable\r\n[DirectX]\r\nVRAM=256\r\n');

  const setupRunner = async (_setup, args) => {
    const targetExe = args[0];
    const api = args[args.indexOf('--api') + 1];
    const hook = api === 'opengl' ? 'opengl32.dll' : api === 'd3d9' ? 'd3d9.dll' : 'dxgi.dll';
    put(path.join(path.dirname(targetExe), hook), 'ReShade Searching for add-ons');
    return { code: 0, output: '' };
  };

  const config = {
    gameDir, exePath, api: 'd3d9', bitness: 32, source,
    reshadeSetup: setup, setupRunner, installReShade: true
  };
  await applySwap(config);
  const manifest = await applySwap(config);

  for (const rel of [
    'D3D9.dll', 'dxgi.dll', 'dlss5-feed.addon32',
    path.join('reshade-shaders', 'Shaders', 'DLSS5_Feed.fx'),
    path.join('reshade-shaders', 'Shaders', 'vort_Motion.fx'),
    path.join('reshade-shaders', 'Shaders', 'ReShade.fxh'),
    path.join('reshade-shaders', 'Shaders', 'ReShadeUI.fxh'),
    path.join('reshade-shaders', 'Shaders', 'Includes', 'vort_Defs.fxh'),
    path.join('reshade-shaders', 'Textures', 'vort_BlueNoise.png'),
    path.join('host64', 'dlss5-feed-host64.exe'),
    path.join('host64', 'dxgi.dll'),
    path.join('host64', 'renodx-dlss5.addon64'),
    path.join('host64', 'nvngx_dlssnr.dll'),
    path.join('host64', 'nvngx_dlss.dll')
  ]) assert.equal(fs.existsSync(path.join(gameDir, rel)), true, rel);

  assert.match(fs.readFileSync(path.join(gameDir, 'dgVoodoo.conf'), 'utf8'), /^OutputAPI\s*=d3d11_fl11_0$/m);
  assert.match(fs.readFileSync(path.join(gameDir, 'ReShade.ini'), 'utf8'), /DLSS5_MV_PROVIDER=2/);
  assert.match(fs.readFileSync(path.join(gameDir, 'ReShadePreset.ini'), 'utf8'), /vort_MotionEffects@vort_Motion\.fx,DLSS5_Feed@DLSS5_Feed\.fx/);
  assert.equal(manifest.game.bitness, 32);
  assert.equal(manifest.added.length, new Set(manifest.added.map((rel) => rel.toLowerCase())).size);
  assert.equal(manifest.replaced.length, new Set(manifest.replaced.map((item) => item.rel.toLowerCase())).size);

  await restore(gameDir);
  assert.equal(fs.existsSync(path.join(gameDir, 'D3D9.dll')), false);
  assert.equal(fs.existsSync(path.join(gameDir, 'dxgi.dll')), false);
  assert.equal(fs.existsSync(path.join(gameDir, 'dlss5-feed.addon32')), false);
  assert.equal(fs.existsSync(path.join(gameDir, 'host64')), false);
  assert.equal(fs.existsSync(path.join(gameDir, 'reshade-shaders')), false);
  assert.equal(fs.existsSync(exePath), true);
});

test('Black Flag 32-bit DX11 install targets AC4BFSP and exposes the feeder add-on', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-x86-dx11-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gameDir = path.join(root, 'Assassins Creed IV Black Flag');
  const payload = path.join(root, 'Payload');
  const exePath = put(path.join(gameDir, 'AC4BFSP.exe'));
  const setup = put(path.join(payload, 'ReShade_Setup_6.8.0_Addon.exe'));
  const shaderRoot = path.join(payload, 'feeder', 'reshade-shaders');

  const source = {
    hasNeuralRendering: true,
    payload: [
      { name: 'nvngx_dlssnr.dll', path: put(path.join(payload, 'nvngx_dlssnr.dll')), version: '1.0.0' },
      { name: 'nvngx_dlss.dll', path: put(path.join(payload, 'nvngx_dlss.dll')), version: '1.0.0' }
    ],
    feeder: {
      ok: true,
      addon32: put(path.join(payload, 'feeder', 'dlss5-feed.addon32')),
      host64: put(path.join(payload, 'feeder', 'dlss5-feed-host64.exe')),
      feedShader: put(path.join(shaderRoot, 'Shaders', 'DLSS5_Feed.fx')),
      shaderRoot,
      hostAddon: put(path.join(payload, 'feeder', 'host64', 'renodx-dlss5.addon64')),
      dgVoodooDir: path.join(payload, 'feeder', 'dgvoodoo')
    }
  };
  put(path.join(shaderRoot, 'Shaders', 'vort_Motion.fx'));
  put(path.join(shaderRoot, 'Shaders', 'ReShade.fxh'));
  put(path.join(shaderRoot, 'Shaders', 'ReShadeUI.fxh'));
  put(path.join(shaderRoot, 'Shaders', 'Includes', 'vort_Defs.fxh'));
  put(path.join(shaderRoot, 'Textures', 'vort_BlueNoise.png'));

  const setupRunner = async (_setup, args) => {
    const targetExe = args[0];
    put(path.join(path.dirname(targetExe), 'dxgi.dll'), 'ReShade Searching for add-ons');
    return { code: 0, output: '' };
  };

  const manifest = await applySwap({
    gameDir, exePath, api: 'dxgi', bitness: 32, source,
    reshadeSetup: setup, setupRunner, installReShade: true
  });

  const exeDir = path.dirname(exePath);
  assert.equal(manifest.game.bitness, 32);
  assert.equal(fs.existsSync(path.join(exeDir, 'dxgi.dll')), true);
  assert.equal(fs.existsSync(path.join(exeDir, 'dlss5-feed.addon32')), true);
  assert.equal(fs.existsSync(path.join(exeDir, 'D3D9.dll')), false);
  assert.equal(fs.existsSync(path.join(exeDir, 'host64', 'dlss5-feed-host64.exe')), true);
  assert.match(fs.readFileSync(path.join(exeDir, 'ReShade.ini'), 'utf8'), /\[ADDON\][\s\S]*AddonPath=\.\\/);
  assert.doesNotMatch(fs.readFileSync(path.join(exeDir, 'ReShade.ini'), 'utf8'), /^DisabledAddons=.*dlss5-feed/im);

  await restore(gameDir);
  assert.equal(fs.existsSync(path.join(exeDir, 'dxgi.dll')), false);
  assert.equal(fs.existsSync(path.join(exeDir, 'host64')), false);
  assert.equal(fs.existsSync(exePath), true);
});
