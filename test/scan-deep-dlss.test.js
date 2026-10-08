'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pe = require('../src/core/pe');
const { scanGame, selectPrimaryDlss } = require('../src/core/scan');

function peFile(file, options = {}) {
  const is64 = options.bitness !== 32;
  const size = options.exe ? 300 * 1024 : 4096;
  const buf = Buffer.alloc(size);
  const peAt = 0x80;
  const optAt = peAt + 24;
  const optSize = is64 ? 240 : 224;
  buf.writeUInt16LE(0x5a4d, 0);
  buf.writeUInt32LE(peAt, 0x3c);
  buf.writeUInt32LE(0x00004550, peAt);
  buf.writeUInt16LE(is64 ? 0x8664 : 0x014c, peAt + 4);
  buf.writeUInt16LE(options.version ? 1 : 0, peAt + 6);
  buf.writeUInt16LE(optSize, peAt + 20);
  buf.writeUInt16LE(is64 ? 0x20b : 0x10b, optAt);

  if (options.version) {
    const dataDirectory = optAt + (is64 ? 112 : 96);
    buf.writeUInt32LE(0x1000, dataDirectory + 16); // resource RVA
    buf.writeUInt32LE(0x200, dataDirectory + 20);
    const section = optAt + optSize;
    buf.write('rsrc', section, 'ascii');
    buf.writeUInt32LE(0x800, section + 8);
    buf.writeUInt32LE(0x1000, section + 12);
    buf.writeUInt32LE(0x800, section + 16);
    buf.writeUInt32LE(0x200, section + 20);

    const base = 0x200;
    const directory = (at) => buf.writeUInt16LE(1, base + at + 14);
    directory(0x00);
    buf.writeUInt32LE(16, base + 0x10);
    buf.writeUInt32LE(0x80000020, base + 0x14);
    directory(0x20);
    buf.writeUInt32LE(1, base + 0x30);
    buf.writeUInt32LE(0x80000040, base + 0x34);
    directory(0x40);
    buf.writeUInt32LE(1033, base + 0x50);
    buf.writeUInt32LE(0x60, base + 0x54);
    buf.writeUInt32LE(0x1100, base + 0x60);
    buf.writeUInt32LE(options.stringVersion ? 0x200 : 64, base + 0x64);
    const version = options.version.split('.').map(Number);
    buf.writeUInt32LE(0xfeef04bd, 0x300);
    if (!options.stringVersion) {
      buf.writeUInt32LE(((version[0] << 16) | version[1]) >>> 0, 0x308);
      buf.writeUInt32LE(((version[2] << 16) | version[3]) >>> 0, 0x30c);
    } else {
      const key = Buffer.from('FileVersion\0', 'utf16le');
      key.copy(buf, 0x340);
      Buffer.from(options.version + '\0', 'utf16le').copy(buf, (0x340 + key.length + 3) & ~3);
    }
  }
  if (options.exe) buf.write('D3D12CreateDevice', 0x1000, 'ascii');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

test('NTE-style deeply nested Unreal DLSS DLL is detected with its version', async (t) => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-nte-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));

  const exe = path.join(gameDir, 'Client', 'WindowsNoEditor', 'HT', 'Binaries', 'Win64', 'HTGame.exe');
  const dll = path.join(
    gameDir, 'Client', 'WindowsNoEditor', 'Engine', 'Plugins', 'Marketplace',
    'DLSS', 'Binaries', 'ThirdParty', 'Win64', 'nvngx_dlss.dll'
  );
  peFile(exe, { exe: true, bitness: 64 });
  peFile(dll, { version: '310.4.0.0', bitness: 64 });

  assert.equal(pe.getFileVersion(dll), '310.4.0.0');
  const scan = await scanGame(gameDir);
  assert.equal(scan.chosen.path, exe);
  assert.equal(scan.primaryDlss.path, dll);
  assert.equal(scan.primaryDlss.version, '310.4.0.0');
  assert.equal(scan.primaryDlss.bitness, 64);
});

test('neural-rendering and frame-generation DLLs are not mislabeled as base DLSS', () => {
  assert.equal(selectPrimaryDlss([
    { name: 'nvngx_dlssnr.dll', rel: 'nvngx_dlssnr.dll', path: 'nvngx_dlssnr.dll', version: '1.2.3.4', bitness: 64 },
    { name: 'nvngx_dlssg.dll', rel: 'nvngx_dlssg.dll', path: 'nvngx_dlssg.dll', version: '5.6.7.8', bitness: 64 }
  ], null), null);
});

test('version string table is used when fixed PE version fields are blank', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-version-string-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dll = path.join(root, 'nvngx_dlss.dll');
  peFile(dll, { version: '310.7.1.0', bitness: 64, stringVersion: true });
  assert.equal(pe.getFileVersion(dll), '310.7.1.0');
});
