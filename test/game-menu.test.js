'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hasBackup, labelsFor, template, show } = require('../src/core/game-menu');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-game-menu-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, '_DLSS5_Backup');
  fs.mkdirSync(root);
  return { dir, root };
}

test('context menu restore depends on active backups or recovery journal, never archived backups or DLL presence', t => {
  const { dir, root } = fixture(t);
  fs.writeFileSync(path.join(root, 'manifest.json.done-123'), '{}');
  fs.writeFileSync(path.join(dir, 'nvngx_dlss.dll'), 'not a DLL');
  assert.equal(hasBackup(dir), false);
  fs.writeFileSync(path.join(root, 'manifest.json'), '{}');
  assert.equal(hasBackup(dir), true);
  fs.unlinkSync(path.join(root, 'manifest.json'));
  fs.writeFileSync(path.join(root, 'pending-switch.json'), '{}');
  assert.equal(hasBackup(dir), true);
});

test('context menu enables restore only with backup and disables conflicting actions while busy', () => {
  let selected = null;
  for (const busy of [false, true]) for (const restorable of [false, true]) {
    const items = template({ name: 'Game & Emulator', busy, restorable, labels: labelsFor() }, value => { selected = value; });
    assert.equal(items[0].label, 'Game && Emulator');
    assert.equal(items.find(item => item.id === 'restore').enabled, !busy && restorable);
    for (const action of ['details', 'scan', 'poster', 'hide']) assert.equal(items.find(item => item.id === action).enabled, !busy);
    for (const action of ['open', 'copy']) assert.equal(items.find(item => item.id === action).enabled, true);
    selected = null;
    items.find(item => item.id === 'restore').click();
    assert.equal(selected, !busy && restorable ? 'restore' : null);
  }
  assert.equal(labelsFor({ open: 'فتح المجلد', scan: {}, restore: '' }).open, 'فتح المجلد');
  assert.equal(labelsFor({ scan: {}, restore: '' }).restore, 'Restore originals');
});

test('native menu returns only selected actions, clamps coordinates and requires explicit restore confirmation', async t => {
  const { dir, root } = fixture(t);
  const backup = path.join(root, 'manifest.json');
  fs.writeFileSync(backup, '{}');
  let next = null, response = 1, popup, confirmations = [], removeBackup = false;
  const Menu = { buildFromTemplate: items => ({ popup: options => {
    popup = options;
    // A native close notification can arrive before command dispatch finishes.
    options.callback();
    if (next) items.find(item => item.id === next).click();
    if (removeBackup) fs.unlinkSync(backup);
  } }) };
  const dialog = { showMessageBox: async (_window, options) => { confirmations.push(options); return { response }; } };
  const window = { getContentSize: () => [1280, 860], isDestroyed: () => false };
  const open = () => show({ Menu, dialog, window, dir, name: 'Test Game', position: { x: 9999, y: -90, keyboard: true } });
  assert.equal(await open(), null, 'dismissing a menu never acts');
  assert.equal(confirmations.length, 0);
  assert.equal(popup.x, 1279);
  assert.equal(popup.y, 0);
  assert.equal(popup.sourceType, 'keyboard');
  next = 'open';
  assert.equal(await open(), 'open');
  next = 'restore';
  assert.equal(await open(), null, 'Cancel does not restore');
  assert.equal(confirmations[0].cancelId, 1);
  assert.equal(confirmations[0].defaultId, 1);
  assert.ok(confirmations[0].detail.includes(dir));
  response = 0;
  assert.equal(await open(), 'restore');
  removeBackup = true;
  assert.equal(await open(), null, 'a removed backup cannot be restored via a stale menu');
  assert.equal(confirmations.length, 2);
});
