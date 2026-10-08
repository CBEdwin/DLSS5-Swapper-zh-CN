'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { missingVCRuntime } = require('../src/core/runtime-components');

function dll(file, bitness) {
  const bytes = Buffer.alloc(4096);
  bytes.writeUInt16LE(0x5a4d, 0);
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.writeUInt32LE(0x00004550, 0x80);
  bytes.writeUInt16LE(bitness === 64 ? 0x8664 : 0x14c, 0x84);
  bytes.writeUInt16LE(bitness === 64 ? 240 : 224, 0x94);
  bytes.writeUInt16LE(bitness === 64 ? 0x20b : 0x10b, 0x98);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
test('VC runtime preflight distinguishes x86 client, x64 helper and wrong local DLLs', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-crt-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const game = path.join(root, 'game');
  assert.deepEqual(missingVCRuntime(64, game, root), ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll']);
  for (const name of ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll']) dll(path.join(root, 'System32', name), 64);
  assert.deepEqual(missingVCRuntime(64, game, root), []);
  assert.deepEqual(missingVCRuntime(32, game, root), ['msvcp140.dll', 'vcruntime140.dll']);
  for (const name of ['msvcp140.dll', 'vcruntime140.dll']) dll(path.join(root, 'SysWOW64', name), 32);
  assert.deepEqual(missingVCRuntime(32, game, root), []);
  dll(path.join(game, 'msvcp140.dll'), 32);
  assert.deepEqual(missingVCRuntime(64, game, root), ['msvcp140.dll']);
});
