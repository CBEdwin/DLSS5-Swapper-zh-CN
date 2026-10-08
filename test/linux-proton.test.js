'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { steam } = require('../src/library');
const { protonCandidates } = require('../src/core/proton');

test('Linux Steam discovery finds Proton game libraries and their prefix', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-linux-steam-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, '.local', 'share', 'Steam');
  const library = path.join(home, 'Games');
  const apps = path.join(library, 'steamapps');
  fs.mkdirSync(path.join(apps, 'common', 'Example Game'), { recursive: true });
  fs.mkdirSync(path.join(root, 'steamapps', 'compatdata', '123', 'pfx'), { recursive: true });
  fs.mkdirSync(path.join(root, 'appcache', 'librarycache'), { recursive: true });
  fs.mkdirSync(path.join(root, 'steamapps'), { recursive: true });
  fs.writeFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), `"libraryfolders"\n{\n"0"\n{\n"path" "${library.replace(/\\/g, '\\\\')}"\n}\n}`);
  fs.writeFileSync(path.join(apps, 'appmanifest_123.acf'), '"AppState" { "appid" "123" "name" "Example Game" "installdir" "Example Game" }');

  const games = steam({ platform: 'linux', home });
  assert.equal(games.length, 1);
  assert.equal(games[0].id, '123');
  assert.equal(games[0].protonPrefix, path.join(root, 'steamapps', 'compatdata', '123', 'pfx'));
});

test('configured Proton tool is preferred for a Steam prefix', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-proton-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prefix = path.join(root, 'steamapps', 'compatdata', '123', 'pfx');
  for (const version of ['Proton 8.0', 'Proton 9.0']) {
    const file = path.join(root, 'steamapps', 'common', version, 'proton');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
  }
  fs.mkdirSync(prefix, { recursive: true });
  fs.writeFileSync(path.join(path.dirname(prefix), 'config_info'), 'Proton 9.0');
  assert.equal(protonCandidates(root, prefix)[0], path.join(root, 'steamapps', 'common', 'Proton 9.0', 'proton'));
});
