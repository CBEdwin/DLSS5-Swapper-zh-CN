'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const journal = require('../src/core/file-journal');
const core = require('../src/core/apply');

function temp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-journal-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test('failed install restores exact pre-switch files, settings, absent files and manifest', async t => {
  const root = temp(t);
  const exe = path.join(root, 'game.exe');
  const ini = path.join(root, 'ReShade.ini');
  fs.writeFileSync(exe, 'game');
  fs.writeFileSync(ini, 'user tuning');
  await assert.rejects(journal.transaction(root, async () => {
    const manifest = core.beginManifest(root, exe, 'dxgi');
    await core.writeTracked(manifest, root, ini, 'changed', { kind: 'config' });
    await core.writeTracked(manifest, root, path.join(root, 'new', 'a.dll'), 'new bytes');
    throw new Error('simulated failure');
  }), /simulated failure/);
  assert.equal(fs.readFileSync(ini, 'utf8'), 'user tuning');
  assert.equal(fs.existsSync(path.join(root, 'new')), false);
  assert.equal(fs.existsSync(path.join(core.backupRoot(root), 'manifest.json')), false);
  assert.equal(fs.existsSync(journal.pendingPath(root)), false);
});

test('interrupted journal is recovered from disk without executing any payload', async t => {
  const root = temp(t);
  const folder = '_DLSS5_Backup/.transactions/abc-123';
  fs.mkdirSync(path.join(root, folder), { recursive: true });
  fs.writeFileSync(path.join(root, folder, '0.bin'), 'old settings');
  fs.writeFileSync(path.join(root, 'ReShade.ini'), 'half applied');
  fs.writeFileSync(journal.pendingPath(root), JSON.stringify({ version: 1, folder, dirs: [], files: [
    { rel: 'ReShade.ini', existed: true, snapshot: folder + '/0.bin' }
  ] }));
  assert.equal(await journal.recover(root), true);
  assert.equal(fs.readFileSync(path.join(root, 'ReShade.ini'), 'utf8'), 'old settings');
  assert.equal(await journal.recover(root), false);
});

test('a missing original backup is reported before changing game files', async t => {
  const root = temp(t);
  fs.writeFileSync(path.join(root, 'dxgi.dll'), 'working backend');
  const manifest = { version: 1, replaced: [{ rel: 'dxgi.dll' }], added: [], game: { exe: 'game.exe' } };
  await assert.rejects(core.restoreFiles(root, manifest), { code: 'errBackupInvalid' });
  assert.equal(fs.readFileSync(path.join(root, 'dxgi.dll'), 'utf8'), 'working backend');
});

test('new install sessions do not reuse stale original backups after a game update', async t => {
  const root = temp(t);
  const exe = path.join(root, 'game.exe');
  const dll = path.join(root, 'original.dll');
  fs.writeFileSync(exe, 'game');
  fs.writeFileSync(dll, 'v1');
  let manifest = core.beginManifest(root, exe, 'dxgi');
  await core.writeTracked(manifest, root, dll, 'mod');
  await core.restore(root);
  fs.writeFileSync(dll, 'game update v2');
  const previous = manifest.backupPrefix;
  manifest = core.beginManifest(root, exe, 'dxgi');
  assert.notEqual(manifest.backupPrefix, previous);
  await core.writeTracked(manifest, root, dll, 'mod2');
  await core.restore(root);
  assert.equal(fs.readFileSync(dll, 'utf8'), 'game update v2');
});

test('unsafe paths cannot escape the selected game during backup or recovery', async t => {
  const root = temp(t);
  for (const rel of ['../outside.dll', '/absolute.dll', 'C:\\outside.dll', 'file:stream']) assert.throws(() => journal.safePath(root, rel));
  const manifest = core.beginManifest(root, path.join(root, 'game.exe'), 'dxgi');
  await assert.rejects(core.writeTracked(manifest, root, path.join(root, '_DLSS5_Backup', 'owned.json'), 'bad'), { code: 'errUnsafeTarget' });
});
