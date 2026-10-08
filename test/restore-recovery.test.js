'use strict';
// #325: "no error, just treats the game like it doesn't have anything
// installed". A restore renames the manifest aside when it finishes, and
// everything that decides whether there is anything to restore reads the live
// one - so a game folder that still carries our files without a live manifest
// offered a dead button and no way back from inside the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const apply = require('../src/core/apply');
const { scanGame } = require('../src/core/scan');
const { writePe } = require('./fixtures/pe');

// A game with one file of ours replacing an original, one file of ours added,
// and one file that was never touched - with the manifest already retired, as
// a finished restore leaves it.
function retiredInstall(t, { retire = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-recovery-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const backup = path.join(dir, '_DLSS5_Backup');
  const prefix = 'originals/0f31ab45-9e69-45a5-9c56-85029d47715f';
  fs.mkdirSync(path.join(backup, prefix), { recursive: true });

  writePe(path.join(dir, 'Game.exe'), { text: 'D3D12CreateDevice' });
  fs.writeFileSync(path.join(dir, 'untouched.txt'), 'the player put this here');
  // The original, kept in the backup; the game currently holds ours.
  fs.writeFileSync(path.join(backup, prefix, 'dxgi.dll'), 'the original dxgi');
  fs.writeFileSync(path.join(dir, 'dxgi.dll'), 'ReShade, much larger than the original');
  fs.writeFileSync(path.join(dir, 'renodx-dlss5.addon64'), 'the consumer we added');

  const manifest = {
    version: 1,
    backupPrefix: prefix,
    date: '2026-09-20T10:00:00.000Z',
    route: 'native',
    game: { dir, exe: 'Game.exe', api: 'dxgi' },
    replaced: [{ rel: 'dxgi.dll', oldVersion: null, newVersion: '6.8.0' }],
    added: ['renodx-dlss5.addon64'],
    addedDirs: [],
    reshade: { installedByUs: true, file: 'dxgi.dll', filesAdded: [] }
  };
  const name = retire ? 'manifest.json.done-1788000000000' : 'manifest.json';
  fs.writeFileSync(path.join(backup, name), JSON.stringify(manifest));
  return { dir, backup, manifest };
}

test('a game whose manifest was already retired can still be restored', async (t) => {
  const { dir, backup } = retiredInstall(t);
  assert.equal(fs.existsSync(path.join(backup, 'manifest.json')), false, 'no live record, as after a restore');

  // The app used to say there was nothing to restore here.
  const scan = await scanGame(dir);
  assert.equal(scan.hasBackup, true, 'the button is offered');

  const lines = [];
  await apply.restore(dir, (event) => lines.push(event.code));
  assert.ok(lines.includes('restoreRecovered'), 'and it says where the record came from');
  assert.ok(lines.includes('restoreDone'));

  assert.equal(fs.readFileSync(path.join(dir, 'dxgi.dll'), 'utf8'), 'the original dxgi');
  assert.equal(fs.existsSync(path.join(dir, 'renodx-dlss5.addon64')), false);
  assert.equal(fs.readFileSync(path.join(dir, 'untouched.txt'), 'utf8'), 'the player put this here');

  // Once the files are gone the offer goes with them, rather than restoring
  // the same folder for ever.
  const after = await scanGame(dir);
  assert.equal(after.hasBackup, false);
  await assert.rejects(apply.restore(dir), (error) => error.code === 'errNoBackup');
});

test('a folder the restore already emptied is not offered again', async (t) => {
  const { dir } = retiredInstall(t);
  fs.unlinkSync(path.join(dir, 'renodx-dlss5.addon64'));
  fs.writeFileSync(path.join(dir, 'dxgi.dll'), 'the original dxgi');   // same bytes, same size
  assert.equal(apply.recoverableManifest(dir), null);
  const scan = await scanGame(dir);
  assert.equal(scan.hasBackup, false);
});

test('a live manifest is still the one that is used', async (t) => {
  const { dir, backup } = retiredInstall(t, { retire: false });
  const lines = [];
  await apply.restore(dir, (event) => lines.push(event.code));
  assert.ok(!lines.includes('restoreRecovered'), 'nothing to recover from while the record is live');
  assert.equal(fs.readFileSync(path.join(dir, 'dxgi.dll'), 'utf8'), 'the original dxgi');
  // And it is retired under the one name the recovery looks for.
  assert.ok(fs.readdirSync(backup).some((name) => /^manifest\.json\.done-\d+$/.test(name)));
});
