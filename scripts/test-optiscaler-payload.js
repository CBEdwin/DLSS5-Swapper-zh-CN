'use strict';

// Verified upstream binaries in synthetic directories only. No DLL, GPU
// payload, game, batch setup or uninstaller is executed by this test.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const opti = require('../src/core/optiscaler');
const manager = require('../src/core/backend-manager');
const { scanSource, scanGame } = require('../src/core/scan');
const { digest } = require('../src/core/runtime-components');
const ini = require('../src/core/feeder-config');
const pe = require('../src/core/pe');
const journal = require('../src/core/file-journal');

function fakeExe(file) {
  const bytes = Buffer.alloc(300 * 1024);
  bytes.writeUInt16LE(0x5a4d, 0); bytes.writeUInt32LE(0x80, 0x3c);
  bytes.writeUInt32LE(0x00004550, 0x80); bytes.writeUInt16LE(0x8664, 0x84);
  bytes.writeUInt16LE(240, 0x94); bytes.writeUInt16LE(0x20b, 0x98);
  bytes.write('D3D12CreateDevice', 0x1000, 'ascii');
  fs.writeFileSync(file, bytes);
}
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opti-payload-test-'));
  try {
    const source = scanSource(path.join(__dirname, '../payload'));
    const optiRoot = await opti.ensureOptiScaler(path.join(__dirname, '../vendor/runtime-tests'));
    for (const route of ['native', 'feeder']) {
      const dir = path.join(root, route);
      fs.mkdirSync(dir);
      const exePath = path.join(dir, 'RealTarget.exe');
      fakeExe(exePath);
      fs.copyFileSync(source.payload.find(f => f.name === 'nvngx_dlss.dll').path, path.join(dir, 'nvngx_dlss.dll'));
      fs.copyFileSync(path.join(source.feeder.vulkanLayerDir, 'ReShade64.dll'), path.join(dir, 'dxgi.dll'));
      fs.writeFileSync(path.join(dir, 'ReShade.ini'), '[GENERAL]\nPresetPath=.\\UserPreset.ini\n[STYLE]\nAlpha=0.77\n');
      fs.writeFileSync(path.join(dir, 'UserPreset.ini'), 'Techniques=UserEffect@User.fx\n[User.fx]\nStrength=0.5\n');
      fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'keep');
      const originals = Object.fromEntries(fs.readdirSync(dir).map(name => [name, digest(path.join(dir, name))]));
      const config = { gameDir: dir, exePath, api: 'dxgi', apiLabel: 'DirectX 12', bitness: 64, source, optiRoot,
        route, installReShade: true, addMissingDlss: true, addStreamline: false, upgradeReShade: false };
      await manager.install(config);
      const newline = fs.readFileSync(path.join(dir, 'UserPreset.ini'), 'utf8').includes('\r\n') ? '\r\n' : '\n';
      fs.appendFileSync(path.join(dir, 'UserPreset.ini'), `${newline}UserTune=0.8${newline}`);
      const preset = fs.readFileSync(path.join(dir, 'UserPreset.ini'), 'utf8');
      opti.checkConflicts(dir, exePath, manager.readManifest(dir), 'dxgi');
      await manager.install({ ...config, route: 'optiscaler' });
      assert.equal(pe.versionMentions(path.join(dir, 'dxgi.dll'), 'OptiScaler'), true);
      assert.equal((await scanGame(dir)).install.optiscaler.installed, true);
      assert.equal(fs.existsSync(path.join(dir, 'renodx-dlss5.addon64')), false);
      assert.equal(fs.existsSync(path.join(dir, 'dlss5-feed.addon64')), false);
      assert.equal(digest(path.join(dir, 'nvngx_dlss.dll')), originals['nvngx_dlss.dll']);
      const configFile = path.join(dir, 'OptiScaler.ini');
      fs.writeFileSync(configFile, ini.setIni(ini.readText(configFile), 'DlssNr', 'Intensity', '0.42'));
      fs.writeFileSync(path.join(dir, 'OptiScaler', 'user-notes.txt'), 'keep this too');
      await manager.install({ ...config, route: 'optiscaler' });
      assert.equal(ini.getIni(ini.readText(configFile), 'DlssNr', 'Intensity'), '0.42');
      await manager.install(config);
      assert.equal(pe.versionMentions(path.join(dir, 'dxgi.dll'), 'ReShade'), true);
      assert.equal(fs.existsSync(path.join(dir, 'nvngx.dll_dlssnr.dll')), false);
      assert.equal(fs.readFileSync(path.join(dir, 'UserPreset.ini'), 'utf8').trim(), preset.trim());
      assert.equal(fs.readFileSync(path.join(dir, 'OptiScaler', 'user-notes.txt'), 'utf8'), 'keep this too');
      const before = JSON.stringify(manager.readManifest(dir));
      const beforeHook = digest(path.join(dir, 'dxgi.dll'));
      const copyFile = fs.promises.copyFile;
      let failOnce = true;
      fs.promises.copyFile = async (from, to, ...rest) => {
        if (failOnce && to === path.join(dir, 'nvngx.dll_dlssnr.dll')) { failOnce = false; throw new Error('injected copy failure'); }
        return copyFile(from, to, ...rest);
      };
      try { await assert.rejects(manager.install({ ...config, route: 'optiscaler' }), /injected copy failure/); }
      finally { fs.promises.copyFile = copyFile; }
      assert.equal(JSON.stringify(manager.readManifest(dir)), before);
      assert.equal(digest(path.join(dir, 'dxgi.dll')), beforeHook);
      assert.equal(fs.existsSync(journal.pendingPath(dir)), false);
      assert.equal(fs.existsSync(path.join(dir, 'nvngx.dll_dlssnr.dll')), false);
      await manager.install({ ...config, route: 'optiscaler' });
      assert.equal(ini.getIni(ini.readText(configFile), 'DlssNr', 'Intensity'), '0.42');
      await manager.restore(dir);
      for (const [name, hash] of Object.entries(originals)) assert.equal(digest(path.join(dir, name)), hash, name);
      assert.equal(fs.existsSync(configFile), false);
      assert.equal(fs.readFileSync(path.join(dir, 'OptiScaler', 'user-notes.txt'), 'utf8'), 'keep this too');
      console.log(`PASS: real ${route} ↔ OptiScaler round trip, settings, repeat install, failed switch rollback and original restore`);
    }
    const dir = path.join(root, 'vulkan');
    fs.mkdirSync(dir);
    const exePath = path.join(dir, 'Game.exe'); fakeExe(exePath);
    const config = { gameDir: dir, exePath, api: 'vulkan', apiLabel: 'Vulkan', bitness: 64, source, optiRoot, route: 'optiscaler' };
    await manager.install(config);
    assert.equal(pe.getBitness(path.join(dir, 'winmm.dll')), 64);
    assert.equal(fs.existsSync(path.join(dir, 'dxgi.dll')), false);
    assert.equal(ini.getIni(ini.readText(path.join(dir, 'OptiScaler.ini')), 'Upscalers', 'VulkanUpscaler'), 'ffx_12');
    await assert.rejects(manager.install({ ...config, route: 'feeder' }), { code: 'errBackendVulkanSwitch' });
    await manager.restore(dir);
    assert.equal(fs.existsSync(path.join(dir, 'winmm.dll')), false);
    console.log('PASS: Vulkan proxy/bridge configuration and explicit restore-first guard (no registry modified)');
    // The pre-SR fork is a different package of the same project: no forwarder
    // DLL, its licence inside the archive, its own notes file. Switching a game
    // from the forwarded build to it has to take the forwarder away, or the
    // neural pass silently does nothing.
    {
      const presr = opti.releaseFor('0.8.92-presr');
      const forkRoot = await opti.ensureOptiScaler(path.join(__dirname, '../vendor/runtime-tests'), presr.version);
      const dir = path.join(root, 'presr');
      fs.mkdirSync(dir);
      const exePath = path.join(dir, 'Game.exe'); fakeExe(exePath);
      fs.copyFileSync(source.payload.find(f => f.name === 'nvngx_dlss.dll').path, path.join(dir, 'nvngx_dlss.dll'));
      fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'keep');
      const originals = Object.fromEntries(fs.readdirSync(dir).map(name => [name, digest(path.join(dir, name))]));
      const base = { gameDir: dir, exePath, api: 'dxgi', apiLabel: 'DirectX 12', bitness: 64, source, route: 'optiscaler' };
      // The forwarded build first, so there is a forwarder to leave behind.
      await manager.install({ ...base, optiRoot });
      assert.equal(fs.existsSync(path.join(dir, 'nvngx.dll_dlssnr.dll')), true);
      assert.equal(manager.readManifest(dir).optiscaler.version, opti.RELEASE.version);
      // Then the fork over it.
      await manager.install({ ...base, optiRoot: forkRoot, optiVersion: presr.version });
      const manifest = manager.readManifest(dir);
      assert.equal(manifest.optiscaler.version, presr.version, 'the manifest names the build that was installed');
      assert.equal(fs.existsSync(path.join(dir, 'nvngx.dll_dlssnr.dll')), false, 'the other build\'s forwarder is gone');
      assert.equal(pe.versionMentions(path.join(dir, 'dxgi.dll'), 'OptiScaler'), true);
      for (const rel of ['OptiScaler.ini', 'nvngx_dlssnr.dll', 'OptiScaler/licenses/LICENSE.GPL-3.0.txt',
        'OptiScaler/licenses/PeripheralWarp_LICENSE.txt', 'OptiScaler/README-DLSSNR.txt',
        'OptiScaler/D3D12_OptiScaler/D3D12Core.dll']) {
        assert.equal(fs.existsSync(path.join(dir, rel)), true, rel);
      }
      // Its own config keys are the ones the app writes, under the same names.
      const config = ini.readText(path.join(dir, 'OptiScaler.ini'));
      assert.equal(ini.getIni(config, 'DlssNr', 'Enabled'), 'true');
      assert.equal(ini.getIni(config, 'ProcessFilter', 'TargetProcessName'), 'Game.exe');
      assert.equal(ini.getIni(config, 'Upscalers', 'Dx12Upscaler'), 'dlss');
      // And the app reports it as installed, which it did not while every build
      // was required to have a forwarder.
      assert.equal((await scanGame(dir)).install.optiscaler.installed, true);
      await manager.restore(dir);
      for (const [name, hash] of Object.entries(originals)) assert.equal(digest(path.join(dir, name)), hash, name);
      assert.equal(fs.existsSync(path.join(dir, 'OptiScaler')), false);
      assert.equal(fs.existsSync(path.join(dir, 'OptiScaler.ini')), false);
      assert.equal(fs.existsSync(path.join(dir, 'dxgi.dll')), false);
      console.log('PASS: real pre-SR fork install over the forwarded build, forwarder retired, reported installed, full restore');
    }
    for (const route of ['native', 'feeder', 'optiscaler']) {
      const protectedDir = path.join(root, `consent-${route}`);
      fs.mkdirSync(protectedDir);
      const exe = path.join(protectedDir, 'Game.exe'); fakeExe(exe);
      const antiCheatDir = path.join(protectedDir, 'EasyAntiCheat');
      fs.mkdirSync(antiCheatDir);
      const sentinel = path.join(antiCheatDir, 'test-marker.txt');
      fs.writeFileSync(sentinel, 'Unmodified anti-cheat fixture. Never executed.');
      fs.copyFileSync(source.payload.find(file => file.name === 'nvngx_dlss.dll').path, path.join(protectedDir, 'nvngx_dlss.dll'));
      const nativeHash = digest(path.join(protectedDir, 'nvngx_dlss.dll'));
      const config = { gameDir: protectedDir, exePath: exe, api: 'dxgi', apiLabel: 'DirectX 12', bitness: 64,
        source, optiRoot, route, installReShade: true, addMissingDlss: true, upgradeReShade: false };
      await assert.rejects(manager.install(config), { code: 'errAntiCheatConsent' });
      assert.equal(fs.existsSync(path.join(protectedDir, '_DLSS5_Backup')), false);
      await manager.install({ ...config, antiCheatAcknowledged: true });
      assert.equal(manager.readManifest(protectedDir).route, route);
      assert.equal(Object.hasOwn(manager.readManifest(protectedDir), 'antiCheatAcknowledged'), false);
      await assert.rejects(manager.install(config), { code: 'errAntiCheatConsent' });
      await manager.restore(protectedDir);
      assert.equal(fs.readFileSync(sentinel, 'utf8'), 'Unmodified anti-cheat fixture. Never executed.');
      assert.equal(digest(path.join(protectedDir, 'nvngx_dlss.dll')), nativeHash);
      assert.equal(fs.existsSync(path.join(protectedDir, 'dxgi.dll')), false);
      console.log(`PASS: real ${route} install after explicit consent; no consent persistence or anti-cheat file changes; restore works without consent`);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
