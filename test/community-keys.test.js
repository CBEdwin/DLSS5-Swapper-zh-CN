'use strict';
// "My games" asks the server for the cards of the games on this machine, so the
// app has to name each game the way the server files it. The server's own
// source sits beside the app; when it is there, the two are compared directly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { keysFor, storeOf } = require('../src/shared/community-keys');
const { normaliseGpu } = require('../src/shared/gpu-model');

const SERVER = path.join(__dirname, '..', '..', 'server', 'src');
const serverHere = fs.existsSync(path.join(SERVER, 'games.js')) && fs.existsSync(path.join(SERVER, 'gpu.js'));

const GAMES = [
  { title: 'Cyberpunk 2077', exe: 'Cyberpunk2077.exe', store: 'steam', storeId: '1091500' },
  { title: 'Portal', exe: 'hl2.exe', store: 'steam', storeId: '400' },
  { title: 'Portal', exe: 'hl2.exe' },
  { title: 'Some Game', exe: 'launcher.exe', store: 'gog', storeId: '123' },
  { title: 'Final Fantasy VII Remake', exe: null },
  { title: 'Ratchet & Clank', exe: 'pcsx2-qt.exe' }
];

test('every game offers, first, the key the server would file it under', { skip: !serverHere && 'server source is not beside the app' }, () => {
  const { cardKey } = require(path.join(SERVER, 'games.js'));
  for (const game of GAMES) assert.equal(keysFor(game)[0], cardKey(game)?.key, JSON.stringify(game));
});

test('a game offers every kind of key it could have been filed under', () => {
  assert.deepEqual(keysFor(GAMES[0]), ['exe:cyberpunk2077', 'steam:1091500', 'title:cyberpunk2077']);
  assert.deepEqual(keysFor(GAMES[1]), ['steam:400', 'title:portal'], 'hl2.exe is shared by many games, so it is never a key (#274)');
  assert.deepEqual(keysFor({}), []);
  assert.equal(storeOf('Steam'), 'steam');
  assert.equal(storeOf('Epic Games'), 'epic');
  assert.equal(storeOf('Added by hand'), null);
});

test('the app names a graphics card the way the server does', { skip: !serverHere && 'server source is not beside the app' }, () => {
  const server = require(path.join(SERVER, 'gpu.js'));
  for (const name of ['NVIDIA GeForce RTX 5080', 'NVIDIA GeForce RTX 5070 Ti Laptop GPU', 'AMD Radeon RX 7900 XTX',
    'Intel(R) Arc(TM) A770 Graphics', 'NVIDIA RTX PRO 6000 Blackwell Workstation Edition', '', null]) {
    assert.equal(normaliseGpu(name), server.normaliseGpu(name), String(name));
  }
  assert.equal(normaliseGpu('NVIDIA GeForce RTX 5080'), 'RTX 5080');
});
