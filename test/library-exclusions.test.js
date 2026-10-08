'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { isInside, filterExcluded } = require('../src/library');

test('excluded scan roots remove only games inside the selected folder', () => {
  const root = path.join('D:\\', 'Games');
  const games = [
    { name: 'Inside', dir: path.join(root, 'Inside') },
    { name: 'Root itself', dir: root },
    { name: 'Similar prefix', dir: path.join('D:\\', 'Games Backup', 'Keep') },
    { name: 'Elsewhere', dir: path.join('E:\\', 'Games', 'Keep') }
  ];

  assert.equal(isInside(path.join(root, 'Inside'), root), true);
  assert.equal(isInside(path.join('D:\\', 'Games Backup'), root), false);
  assert.deepEqual(filterExcluded(games, [root]).map((game) => game.name), [
    'Similar prefix', 'Elsewhere'
  ]);
});
