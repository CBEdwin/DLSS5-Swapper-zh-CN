'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { discover } = require('../src/library.js');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-library-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('drive discovery is off by default while user folders are still scanned', (t) => {
  const root = tempRoot(t);
  const chosen = path.join(root, 'Chosen games');
  const game = path.join(chosen, 'Manual Game');
  fs.mkdirSync(game, { recursive: true });
  fs.writeFileSync(path.join(game, 'game.exe'), 'test');

  const shaders = path.join(chosen, 'reshade-shaders');
  const backup = path.join(chosen, '_DLSS5_Backup');
  const unrelated = path.join(chosen, 'Documents');
  fs.mkdirSync(shaders);
  fs.mkdirSync(backup);
  fs.mkdirSync(unrelated);

  const result = discover([chosen], undefined, [], () => {
    throw new Error('automatic drive discovery must not run');
  });

  assert.deepEqual(result.roots, []);
  assert.ok(result.games.some((entry) => path.resolve(entry.dir) === path.resolve(game)));
  assert.ok(!result.games.some((entry) => path.resolve(entry.dir) === path.resolve(shaders)));
  assert.ok(!result.games.some((entry) => path.resolve(entry.dir) === path.resolve(backup)));
  assert.ok(!result.games.some((entry) => path.resolve(entry.dir) === path.resolve(unrelated)));
});

test('enabling drive discovery scans every detected game root', (t) => {
  const root = tempRoot(t);
  const automatic = path.join(root, 'Games');
  const game = path.join(automatic, 'Automatic Game');
  fs.mkdirSync(game, { recursive: true });
  fs.writeFileSync(path.join(game, 'game.exe'), 'test');

  const result = discover([], true, [], () => [automatic]);

  assert.deepEqual(result.roots, [automatic]);
  assert.ok(result.games.some((entry) => path.resolve(entry.dir) === path.resolve(game)));
});
