'use strict';
// #259, #249: Prey, Titanfall 2, Call of Duty 2 and Max Payne load their
// renderer from a DLL, so their executables import no Direct3D and the folder
// read as having no game in it. The game's own library says which API it uses.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writePe } = require('./fixtures/pe');
const { scanGame } = require('../src/core/scan');

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-renderer-dll-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('a game whose renderer is a DLL is offered with that API', async (t) => {
  const dir = temp(t);
  const bin = path.join(dir, 'Binaries', 'Danielle', 'x64', 'Release');
  writePe(path.join(bin, 'Prey.exe'), { bitness: 64, size: 256 * 1024 });
  writePe(path.join(bin, 'CryRenderD3D11.dll'), { bitness: 64, text: 'D3D11CreateDevice' });
  const found = await scanGame(dir);
  assert.ok(found.chosen, 'the folder is a game after all');
  assert.equal(found.chosen.name, 'Prey.exe');
  assert.equal(found.chosen.api, 'dxgi');
  assert.equal(found.chosen.apiLabel, 'DirectX 11');
  assert.equal(found.chosen.via, 'renderer-module:CryRenderD3D11.dll');
});

test('the executable has to match the renderer’s bitness', async (t) => {
  const dir = temp(t);
  writePe(path.join(dir, 'Game64.exe'), { bitness: 64 });
  writePe(path.join(dir, 'render32.dll'), { bitness: 32, text: 'Direct3DCreate9' });
  const found = await scanGame(dir);
  assert.equal(found.chosen, null);
  assert.equal(found.emptyReason, 'renderer-in-dll', 'still named, so the message is honest');
});

test('a browser engine or a shader compiler is not a renderer', async (t) => {
  const dir = temp(t);
  writePe(path.join(dir, 'Tool.exe'), { bitness: 64 });
  writePe(path.join(dir, 'libGLESv2.dll'), { bitness: 64, text: 'D3D11CreateDevice' });
  writePe(path.join(dir, 'd3dcompiler_47.dll'), { bitness: 64, text: 'D3D11CreateDevice' });
  const found = await scanGame(dir);
  assert.equal(found.chosen, null, 'a folder of tools stays a folder of tools');
});

// #199: installing into Dota 2 broke it. Source 2 is recognised - the reason is
// shown - but never offered as something to install into.
test('Source 2 is recognised but not offered', async (t) => {
  // The folder someone adds by hand when the library does not find it: the
  // executable and the renderer side by side.
  const dir = temp(t);
  writePe(path.join(dir, 'dota2.exe'), { bitness: 64 });
  writePe(path.join(dir, 'rendersystemdx11.dll'), { bitness: 64, text: 'D3D11CreateDevice' });
  const found = await scanGame(dir);
  assert.equal(found.chosen, null);
  assert.equal(found.emptyReason, 'renderer-in-dll');
});
