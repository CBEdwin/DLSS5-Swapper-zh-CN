'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matches, versions, hasDlss, canInstall, isInstalled, apiKey } = require('../src/renderer/game-filters');

const game = (name, scan = {}) => ({ name, cached: { ok: true, api: 'DirectX 12', dlss: null, addon: false, ...scan } });

test('title search is immediate, case-insensitive and Unicode-normalized', () => {
  assert.equal(matches(game('Euro Truck Simulator'), { query: '  TRUCK  ' }), true);
  assert.equal(matches(game('Euro Truck Simulator'), { query: 'car' }), false);
  assert.equal(matches(game('ＦＯＲＺＡ'), { query: 'forza' }), true);
  assert.equal(matches(game('محاكي السيارات'), { query: 'السيارات' }), true);
  assert.equal(matches(game('Pokémon'), { query: 'Poke\u0301mon' }), true);
  assert.equal(matches(game('Any game'), { query: '   ' }), true);
});

test('text, API, DLSS and add-on filters combine with AND semantics', () => {
  const base = game('Truck DX12', { dlss: '2.2.16', addon: true });
  const filters = { query: 'Truck', api: 'DirectX 12', dlss: 'present', addon: 'present' };
  assert.equal(matches(base, filters), true);
  for (const mismatch of [
    { ...base, name: 'Race DX12' },
    game('Truck DX11', { ...base.cached, api: 'DirectX 11' }),
    game('Truck without DLSS', { addon: true }),
    game('Truck without add-on', { dlss: '2.2.16' })
  ]) assert.equal(matches(mismatch, filters), false);
});

test('API filters distinguish every supported API and unknown/failed scans', () => {
  for (const api of ['DirectX 12', 'DirectX 11', 'DirectX 10', 'DirectX 9', 'Vulkan', 'OpenGL', 'DXGI']) {
    assert.equal(matches(game('Game', { api }), { api }), true);
    assert.equal(matches(game('Game', { api }), { api: 'dx11-dx12' }), ['DirectX 11', 'DirectX 12'].includes(api));
  }
  assert.equal(apiKey(game('DX12', { api: null, dx12: true })), 'DirectX 12');
  assert.equal(matches(game('No 3D', { ok: false, api: null, reason: 'no-graphics-exe' }), { api: 'no-graphics-exe' }), true);
  assert.equal(matches(game('No exe', { ok: false, api: null, reason: 'no-exe' }), { api: 'no-graphics-exe' }), false);
  assert.equal(apiKey(game('Unknown', { api: null })), 'unknown');
  assert.equal(matches({ name: 'Pending' }, { api: 'pending' }), true);
});

test('DLSS presence includes unreadable versions and supports legacy cache entries', () => {
  assert.equal(hasDlss(game('Unknown version', { hasDlss: true, dlss: null })), true);
  assert.equal(matches(game('Unknown version', { hasDlss: true }), { dlss: 'present' }), true);
  assert.equal(matches(game('Unknown version', { hasDlss: true }), { dlss: 'absent' }), false);
  assert.equal(hasDlss(game('Old cache', { dlss: '2.2.16' })), true);
  assert.equal(hasDlss(game('No DLL', { hasDlss: false })), false);
  assert.equal(matches(game('No DLL'), { dlss: 'absent' }), true);
});

test('pending or failed scans are not classified as no DLSS or no add-on', () => {
  for (const entry of [{ name: 'Pending', cached: null }, game('Failed', { ok: false, reason: 'error' })]) {
    assert.equal(matches(entry, { dlss: 'absent' }), false);
    assert.equal(matches(entry, { addon: 'absent' }), false);
    assert.equal(matches(entry, { dlss: 'ready' }), false);
    assert.equal(matches(entry), true);
  }
});

test('DLSS version filters match exact versions and options are unique and numeric-sorted', () => {
  const games = ['2.2.16', '12.2.16', '2.2.16', '2.10.0', '310.8.0.0', null].map(dlss => game('Game', { dlss }));
  games.push({ name: 'Pending' });
  assert.deepEqual(versions(games), ['310.8.0.0', '12.2.16', '2.10.0', '2.2.16']);
  assert.equal(games.filter(g => matches(g, { dlss: 'version:2.2.16' })).length, 2);
  assert.equal(matches(games[0], { dlss: 'version:2.2' }), false);
});

test('ready-to-install and installed/up-to-date are separate states', () => {
  const fresh = game('DX11 emulator', { api: 'DirectX 11' });
  const installed = game('Installed', { addon: true, dlss: '310.8.0.0', bitness: 64 });
  assert.equal(canInstall(fresh), true);
  assert.equal(matches(fresh, { dlss: 'ready' }), true);
  assert.equal(isInstalled(fresh, '310.8.0.0'), false);
  assert.equal(matches(installed, { dlss: 'installed' }, '310.8.0.0'), true);
  assert.equal(matches(installed, { dlss: 'installed' }, '310.9.0.0'), false);
  assert.equal(matches(installed, { dlss: 'installed' }), false);
  assert.equal(isInstalled(game('32-bit', { bitness: 32, addon: true }), '310.8.0.0'), true);
});

test('add-on present/absent filters are independent of native DLSS', () => {
  assert.equal(matches(game('Feeder', { addon: true }), { addon: 'present', dlss: 'absent' }), true);
  assert.equal(matches(game('Native DLSS', { dlss: '2.2.16' }), { addon: 'absent', dlss: 'present' }), true);
});

test('filtering never mutates the library, cache or active filters', () => {
  const games = Object.freeze([
    Object.freeze({ name: 'Truck', cached: Object.freeze({ ok: true, api: 'DirectX 12', dlss: '2.2.16' }) }),
    Object.freeze({ name: 'Other', cached: null })
  ]);
  const filters = Object.freeze({ query: 'truck', api: 'DirectX 12', dlss: 'present' });
  assert.equal(games.filter(g => matches(g, filters)).length, 1);
  assert.deepEqual(versions(games), ['2.2.16']);
  assert.equal(games.length, 2);
});
