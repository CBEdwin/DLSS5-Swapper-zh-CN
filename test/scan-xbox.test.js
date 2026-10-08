'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { scanGame, xboxExecutables } = require('../src/core/scan');

test('Xbox flat-file Content layout uses MicrosoftGame.config when its executable is encrypted', async (t) => {
  const gameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-xbox-'));
  t.after(() => fs.rmSync(gameDir, { recursive: true, force: true }));
  const content = path.join(gameDir, 'Content');
  const exe = path.join(content, 'Binaries', 'Game-WinGDK-Shipping.exe');
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  // An invalid PE models the part of an MSIXVC flat-file install that remains
  // encrypted and therefore cannot be inspected by an ordinary PE reader.
  fs.writeFileSync(exe, 'encrypted executable placeholder');
  fs.writeFileSync(path.join(content, 'MicrosoftGame.config'), [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Game configVersion="1">',
    '  <ExecutableList>',
    '    <Executable Name="GameLaunchHelper.exe" Id="Helper" Architecture="x64"/>',
    '    <Executable Name="Binaries\\Game-WinGDK-Shipping.exe" Id="Game" Architecture="x64"/>',
    '  </ExecutableList>',
    '</Game>'
  ].join('\r\n'));

  const declared = xboxExecutables(gameDir);
  assert.equal(declared.length, 1);
  assert.equal(declared[0].path, exe);
  assert.equal(declared[0].bitness, 64);

  const scan = await scanGame(gameDir);
  assert.ok(scan.chosen);
  assert.equal(scan.chosen.path, exe);
  assert.equal(scan.chosen.bitness, 64);
  assert.equal(scan.chosen.api, 'dxgi');
  assert.equal(scan.chosen.apiLabel, 'DirectX 11/12');
  assert.equal(scan.chosen.via, 'MicrosoftGame.config');
  assert.equal(scan.chosen.encrypted, true);
});
