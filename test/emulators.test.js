'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanGame } = require('../src/core/scan');

function minimalPe(file, bitness = 64) {
  const buf = Buffer.alloc(64 * 1024);
  buf.writeUInt16LE(0x5a4d, 0);
  buf.writeUInt32LE(0x80, 0x3c);
  buf.writeUInt32LE(0x00004550, 0x80);
  buf.writeUInt16LE(bitness === 64 ? 0x8664 : 0x014c, 0x84);
  buf.writeUInt16LE(0, 0x86);
  buf.writeUInt16LE(bitness === 64 ? 240 : 224, 0x94);
  buf.writeUInt16LE(bitness === 64 ? 0x20b : 0x10b, 0x98);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

test('known emulator folders are valid install targets with renderer choices', async (t) => {
  const fixtures = [
    ['duckstation-qt-x64-ReleaseLTCG.exe', 'duckstation', 'dxgi', ['dxgi', 'vulkan', 'opengl']],
    ['rpcs3.exe', 'rpcs3', 'vulkan', ['vulkan', 'opengl']],
    ['pcsx2-qt.exe', 'pcsx2', 'dxgi', ['dxgi', 'vulkan', 'opengl']],
    ['melonDS.exe', 'melonds', 'opengl', ['opengl']]
  ];

  for (const [name, key, api, choices] of fixtures) {
    await t.test(name, async (tt) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-emu-'));
      tt.after(() => fs.rmSync(dir, { recursive: true, force: true }));
      minimalPe(path.join(dir, name));
      const scan = await scanGame(dir);
      assert.equal(scan.chosen.name, name);
      assert.equal(scan.chosen.emulator.key, key);
      assert.equal(scan.chosen.api, api);
      assert.deepEqual(scan.chosen.apiChoices.map((item) => item.api), choices);
      assert.equal(scan.emulator.key, key);
    });
  }
});
