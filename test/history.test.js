'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { HistoryStore, knownFolders, fromManifests } = require('../src/core/history');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-history-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'profile', 'history.jsonl');
  return { root, file, store: new HistoryStore(file) };
}
const manifest = (date = '2026-09-01T18:00:00.000Z', route = 'feeder') => ({
  version: 1, date, route, game: { exe: 'bin/Game.exe', api: 'dxgi' }, replaced: [{ rel: 'dxgi.dll' }], added: ['nvngx_dlss.dll']
});
function backup(dir, name, data) {
  fs.mkdirSync(path.join(dir, '_DLSS5_Backup'), { recursive: true });
  fs.writeFileSync(path.join(dir, '_DLSS5_Backup', name), typeof data === 'string' ? data : JSON.stringify(data));
}

test('history imports discovered/recent/nested games and a selected game root without a drive scan', t => {
  const { root, store, file } = fixture(t);
  const dirs = ['discovered', 'recent', 'root-game', 'cached/deep/game', 'library/child'].map(rel => path.join(root, rel));
  dirs.forEach(dir => backup(dir, 'manifest.json', manifest()));
  const state = { manual: [dirs[1]], recents: [{ dir: dirs[1] }], folders: [dirs[2], path.join(root, 'library')], scans: { a: { dir: dirs[3] } } };
  const known = knownFolders(state, [{ dir: dirs[0], name: 'Game title' }, { dir: dirs[1] }]);
  const rows = store.list(known);
  assert.equal(rows.length, 5);
  assert.equal(rows.find(row => row.dir === dirs[0]).name, 'Game title');
  assert.equal(store.list(known).length, 5, 'opening History twice does not duplicate imported backups');
  assert.equal(new HistoryStore(file).list().length, 5, 'independent of library reset/removal and app restart');
});

test('history reads old and timestamped restore archives and sorts by restore time', t => {
  const { root, store } = fixture(t);
  const game = path.join(root, 'game');
  backup(game, 'manifest.json', manifest());
  backup(game, 'manifest.json.done', manifest('2026-08-30T12:00:00.000Z'));
  const restoredAt = Date.parse('2026-09-02T12:00:00.000Z');
  backup(game, `manifest.json.done-${restoredAt}`, manifest('2026-08-31T12:00:00.000Z'));
  backup(game, 'manifest.json.tmp', manifest());
  const rows = store.list([{ dir: game }]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].date, new Date(restoredAt).toISOString());
  assert.equal(rows[0].action, 'restore');
  assert.equal(rows[0].undone, true);
});

test('repeat installs and backend switches retain each successful operation without snapshot duplicates', t => {
  const { root, store, file } = fixture(t);
  const game = path.join(root, 'game');
  for (const route of ['native', 'native', 'feeder', 'optiscaler']) store.record(game, manifest(undefined, route), 'install');
  store.record(game, manifest(undefined, 'optiscaler'), 'restore');
  backup(game, `manifest.json.done-${Date.now()}`, manifest(undefined, 'optiscaler'));
  assert.equal(store.list([{ dir: game }]).length, 5);
  assert.equal(new HistoryStore(file).list().length, 5);
  assert.equal(store.list().filter(row => row.action === 'install').length, 4);
});

test('bad backups and unfinished switches cannot blank other history', t => {
  const { root, store } = fixture(t);
  const broken = path.join(root, 'broken');
  const good = path.join(root, 'good');
  const pending = path.join(root, 'pending');
  backup(broken, 'manifest.json', '{partial');
  backup(broken, 'manifest.json.done-99999999999999999999', manifest());
  backup(good, 'manifest.json', manifest());
  backup(pending, 'manifest.json', manifest());
  backup(pending, 'pending-switch.json', '{}');
  assert.equal(store.list([broken, good, pending, path.join(root, 'absent')].map(dir => ({ dir }))).length, 1);
  assert.deepEqual(fromManifests([{ dir: pending }]), []);
});

test('a truncated audit write preserves earlier rows and accepts future operations', t => {
  const { root, store, file } = fixture(t);
  store.record(root, manifest(), 'install');
  fs.appendFileSync(file, '{"id":"partial');
  store.record(root, manifest(), 'restore');
  assert.equal(new HistoryStore(file).list().length, 2);
});

test('failed history writes retain copyable rows and can retry without duplicates', t => {
  const { root, store, file } = fixture(t);
  const append = store.append;
  store.append = () => { throw new Error('disk full'); };
  assert.throws(() => store.record(root, manifest(), 'install'), /disk full/);
  const warnings = [];
  assert.equal(store.list([], error => warnings.push(error.message)).length, 1);
  assert.equal(warnings.length, 1);
  store.append = append;
  assert.equal(store.list().length, 1);
  assert.equal(store.list().length, 1);
  assert.equal(new HistoryStore(file).list().length, 1);
});
