'use strict';
// What 2.2.8 fixes, each pinned where it lives, with a real install and a real
// restore where the fix is about files on disk.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writePe } = require('./fixtures/pe');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-228-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

// A real applySwap and restore, with only the game scanner stubbed. `game`
// describes what the scanner reports about the game folder.
function harness(t, game = {}) {
  const base = temp(t);
  const gameDir = path.join(base, 'Game');
  const payloadDir = path.join(base, 'Payload');
  fs.mkdirSync(path.join(payloadDir, 'host64'), { recursive: true });
  fs.mkdirSync(gameDir, { recursive: true });
  const exePath = path.join(gameDir, 'game.exe');
  fs.writeFileSync(exePath, 'fake executable');
  const pe64 = (name) => writePe(path.join(payloadDir, name), { bitness: 64, text: name });
  const payload = [
    { name: 'nvngx_dlssnr.dll', path: pe64('nvngx_dlssnr.dll'), version: '310.8.0.0' },
    { name: 'nvngx_dlss.dll', path: pe64('nvngx_dlss.dll'), version: '310.8.0.0' },
    ...['sl.interposer.dll', 'sl.common.dll', 'sl.dlss_nr.dll'].map((name) => ({ name, path: pe64(name), version: '2.13.0.0' }))
  ];
  const ordinary = path.join(payloadDir, 'renodx-dlss5.addon64');
  const multipass = path.join(payloadDir, 'host64', 'renodx-dlss.addon64');
  fs.writeFileSync(ordinary, 'ordinary');
  fs.writeFileSync(multipass, 'multipass');

  const scanPath = require.resolve('../src/core/scan');
  const applyPath = require.resolve('../src/core/apply');
  const originalScan = require.cache[scanPath];
  delete require.cache[applyPath];
  const reshade = game.reshade || { installed: true, file: 'dxgi.dll', kind: 'proxy', version: '6.8.0', addonSupport: true };
  require.cache[scanPath] = {
    id: scanPath, filename: scanPath, loaded: true,
    exports: {
      inspectReShade: () => reshade,
      scanGame: async () => ({ dlssFiles: game.dlssFiles || [], streamlineFiles: game.streamlineFiles || [], reshade })
    }
  };
  t.after(() => {
    delete require.cache[applyPath];
    if (originalScan) require.cache[scanPath] = originalScan;
    else delete require.cache[scanPath];
  });
  const apply = require('../src/core/apply');
  const logs = [];
  if (game.bundledReShade) writePe(path.join(payloadDir, 'ReShade64.dll'), { bitness: 64, text: 'ReShade Searching for add-ons' });
  const run = (route, extra = {}) => apply.applySwap({
    gameDir, exePath, api: 'dxgi', bitness: 64, route,
    source: { hasNeuralRendering: true, addon: ordinary, payload, feeder: { multipassAddon: multipass, vulkanLayerDir: payloadDir } },
    reshadeSetup: null, installReShade: false, addMissingDlss: false, upgradeReShade: false, ...extra
  }, (entry) => logs.push(entry));
  return { gameDir, apply, run, logs };
}
const sl = (dir) => fs.readdirSync(dir).filter((name) => /^sl\./i.test(name)).sort();

test('multipass brings Streamline to a game that has none, and Restore takes it away (#336)', async (t) => {
  const { gameDir, apply, run, logs } = harness(t);
  await run('renodx');
  assert.deepEqual(sl(gameDir), ['sl.common.dll', 'sl.dlss_nr.dll', 'sl.interposer.dll']);
  assert.ok(logs.some((entry) => entry.code === 'multipassNext' && entry.params.dlss === 'no'), 'and says where its settings are');
  await apply.restore(gameDir);
  assert.deepEqual(sl(gameDir), [], 'nothing of ours is left behind');
});

test('a game with its own Streamline keeps it untouched', async (t) => {
  const { gameDir, run, logs } = harness(t, { streamlineFiles: [{ name: 'sl.interposer.dll', rel: 'sl.interposer.dll', bitness: 64 }] });
  await run('renodx');
  assert.deepEqual(sl(gameDir), [], 'nothing copied beside it');
  assert.ok(logs.some((entry) => entry.code === 'streamlineKept'));
});

test('the native route never brings Streamline in', async (t) => {
  const { gameDir, run } = harness(t);
  await run('native');
  assert.deepEqual(sl(gameDir), []);
});

test('a newer DLSS in the game is never replaced with an older one (#329)', async (t) => {
  const { gameDir, run, logs } = harness(t);
  const theirs = path.join(gameDir, 'nvngx_dlss.dll');
  fs.writeFileSync(theirs, 'the game’s newer dlss');
  const game = { dlssFiles: [{ path: theirs, rel: 'nvngx_dlss.dll', name: 'nvngx_dlss.dll', bitness: 64, version: '310.9.1.0' }] };
  const second = harness(t, game);
  fs.writeFileSync(path.join(second.gameDir, 'nvngx_dlss.dll'), 'the game’s newer dlss');
  game.dlssFiles[0].path = path.join(second.gameDir, 'nvngx_dlss.dll');
  await second.run('native');
  assert.equal(fs.readFileSync(path.join(second.gameDir, 'nvngx_dlss.dll'), 'utf8'), 'the game’s newer dlss');
  assert.ok(second.logs.some((entry) => entry.code === 'skipNewerVersion'), 'and the log says why');
  assert.ok(fs.existsSync(gameDir) && !logs.length, 'the first harness was never run');
});

test('an older DLSS in the game is still upgraded', async (t) => {
  const game = { dlssFiles: [] };
  const h = harness(t, game);
  const theirs = path.join(h.gameDir, 'nvngx_dlss.dll');
  fs.writeFileSync(theirs, 'old');
  game.dlssFiles.push({ path: theirs, rel: 'nvngx_dlss.dll', name: 'nvngx_dlss.dll', bitness: 64, version: '3.7.20.0' });
  await h.run('native');
  assert.notEqual(fs.readFileSync(theirs, 'utf8'), 'old');
  assert.ok(h.logs.some((entry) => entry.code === 'replaced'));
});

test('the overlay says which reason applies instead of blaming the route (#338)', () => {
  const main = read('main.js');
  assert.doesNotMatch(main, /the panel does not attach on/);
  assert.match(main, /const why = target\.bitness !== 64 \? 'bits' : route === 'renodx' \? 'multipass' : route === 'optiscaler' \? 'optiscaler' : 'api';/);
  const i18n = read('src', 'renderer', 'i18n.js');
  assert.equal((i18n.match(/overlayNotForRoute: \(why, api\) =>/g) || []).length, 2, 'in English and Arabic');
  assert.equal((i18n.match(/multipassNext: \(dlss\) =>/g) || []).length, 2, 'in English and Arabic');
  assert.match(read('src', 'renderer', 'renderer.js'), /'overlayNotForRoute', 'multipassNext'/);
});

test('the card and My comments banners say "Show all reports"', () => {
  const page = read('src', 'renderer', 'community.js');
  assert.match(page, /id="communityGpuClear">\$\{esc\(text\(\)\.showAllReports\)\}/);
  assert.match(page, /id="communityMineClear">\$\{esc\(text\(\)\.showAllReports\)\}/);
  assert.equal((page.match(/showAllReports: '/g) || []).length, 2, 'in English and Arabic');
});

test('every report inside a card names its DirectX version (#337)', () => {
  const page = read('src', 'renderer', 'community.js');
  assert.match(page, /\$\{comment\.api \? `<span class="community-api-tag">\$\{esc\(String\(comment\.api\)\.toUpperCase\(\)\)\}<\/span>` : ''\}/);
  assert.match(read('src', 'renderer', 'style.css'), /\.community-tags \.community-api-tag \{/);
});

const noReShade = { installed: false, file: null, kind: null, version: null, addonSupport: false };

test('ReShade can go in as d3d11.dll, and Restore takes it away (#328)', async (t) => {
  const { gameDir, apply, run, logs } = harness(t, { reshade: noReShade, bundledReShade: true });
  await run('native', { installReShade: true, reshadeProxy: 'd3d11' });
  assert.ok(fs.existsSync(path.join(gameDir, 'd3d11.dll')), 'installed under d3d11.dll');
  assert.ok(!fs.existsSync(path.join(gameDir, 'dxgi.dll')), 'and not under dxgi.dll');
  assert.ok(logs.some((entry) => entry.code === 'reshadeInstalled' && entry.params.file === 'd3d11.dll'));
  await apply.restore(gameDir);
  assert.ok(!fs.existsSync(path.join(gameDir, 'd3d11.dll')), 'nothing of ours is left behind');
});

test('without the choice ReShade stays dxgi.dll (#328)', async (t) => {
  const { gameDir, run } = harness(t, { reshade: noReShade, bundledReShade: true });
  await run('native', { installReShade: true });
  assert.ok(fs.existsSync(path.join(gameDir, 'dxgi.dll')));
  assert.ok(!fs.existsSync(path.join(gameDir, 'd3d11.dll')));
});

test('d3d11.dll is for DirectX 11 only (#328)', () => {
  const { hookForApi } = require('../src/core/apply');
  assert.equal(hookForApi('dxgi', 'd3d11'), 'd3d11.dll');
  assert.equal(hookForApi('dxgi', 'dxgi'), 'dxgi.dll');
  assert.equal(hookForApi('d3d9', 'd3d11'), 'd3d9.dll');
  assert.equal(hookForApi('opengl', 'd3d11'), 'opengl32.dll');
  const main = read('main.js');
  // It reaches the wrapped DirectX 8/9 titles too now, because inside dgVoodoo
  // they are DirectX 11 games and some of those layers load only d3d11.dll
  // (#343, #374). Never DirectX 12, which loads neither.
  assert.match(main, /reshadeProxy: \['dxgi', 'd3d8', 'd3d9', 'ddraw'\]\.includes\(api\) && target\.apiLabel !== 'DirectX 12' && route !== 'optiscaler'/);
  assert.match(read('src', 'renderer', 'renderer.js'), /const RESHADE_PROXY_APIS = \['dxgi', 'd3d8', 'd3d9', 'ddraw'\];/);
  assert.match(main, /ipcMain\.handle\('set-reshade-proxy'/);
  assert.match(read('preload.js'), /setReshadeProxy: \(dir, exePath, value\) => ipcRenderer\.invoke\('set-reshade-proxy'/);
  assert.match(read('src', 'core', 'backend-manager.js'), /reshadeFileChanged\(old, config\)\);/);
  const i18n = read('src', 'renderer', 'i18n.js');
  assert.equal((i18n.match(/reshadeProxyHint: '/g) || []).length, 2, 'in English and Arabic');
  assert.equal((i18n.match(/reshadeProxyWrapHint: '/g) || []).length, 2, 'in English and Arabic');
  assert.equal((i18n.match(/fReshadeFile: '/g) || []).length, 2, 'in English and Arabic');
});

test('a slow download is retried before it is called a network failure (#370, #373)', async () => {
  const components = require('../src/core/runtime-components');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-dl-'));
  const bytes = Buffer.from('component');
  const sha = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  let calls = 0;
  const fetchBytes = async () => { calls += 1; if (calls < 3) throw new Error('The operation was aborted due to timeout'); return bytes; };
  await components.fetchVerified('https://example.invalid/x.zip', sha, path.join(dir, 'x.zip'), { fetchBytes });
  assert.equal(calls, 3, 'two stalls, then the file');
  assert.equal(fs.readFileSync(path.join(dir, 'x.zip'), 'utf8'), 'component');

  let second = 0;
  await assert.rejects(
    () => components.fetchVerified('https://example.invalid/y.zip', sha, path.join(dir, 'y.zip'), {
      fetchBytes: async () => { second += 1; throw new Error('timeout'); }
    }),
    (error) => error.code === 'componentNetwork');
  assert.equal(second, 3, 'it gives up after three');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a wrong checksum is never retried', async () => {
  const components = require('../src/core/runtime-components');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-dl-'));
  let calls = 0;
  await assert.rejects(
    () => components.fetchVerified('https://example.invalid/z.zip', 'a'.repeat(64), path.join(dir, 'z.zip'), {
      fetchBytes: async () => { calls += 1; return Buffer.from('wrong'); }
    }),
    (error) => error.code === 'componentChecksum');
  assert.equal(calls, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('nothing is asked of our server before Community is opened (#358)', () => {
  const main = read('main.js');
  assert.match(main, /const communityUsed = \(\) => loadState\(\)\.communityUsed === true;/);
  assert.match(main, /if \(communityUsed\(\)\) startNotices\(\);/);
  assert.match(main, /communityNotices !== false && communityUsed\(\)/);
  assert.match(main, /if \(!communityUsed\(\)\) return \{ ok: false, error: 'community_opt_in'/);
  assert.match(main, /ipcMain\.handle\('community-opt-in'/);
  assert.equal((main.match(/^\s*startNotices\(\);$/gm) || []).length, 1, 'called only from the opt-in');
  assert.match(read('preload.js'), /communityOptedIn: \(\) => ipcRenderer\.invoke\('community-opted-in'\)/);
  assert.match(read('src', 'renderer', 'renderer.js'), /const opted = await window\.lab\.communityOptedIn\(\)/);
  assert.match(read('src', 'renderer', 'community.js'), /render: async \(\.\.\.args\) => \{ await optIn\(\); return render\(\.\.\.args\); \}/);
});

test('a card closes when the dimmed area around it is clicked (#372)', () => {
  assert.match(read('src', 'renderer', 'community.js'),
    /addEventListener\('click', event => \{ if \(event\.target === \$\('communityCardDialog'\)\) closeCard\(\); \}\)/);
});

test('two builds of one game with the same executable name both stay (#355)', () => {
  const scan = read('src', 'core', 'scan.js');
  assert.match(scan, /const key = `\$\{name\}\|\$\{exe\.size\}\|\$\{exe\.dx12 \? 12 : 11\}`;/);
  assert.match(scan, /if \(seen >= 2\) continue;/);
});

test('an emulator may take the multipass route, and is still recommended the Feeder (#359)', () => {
  const routes = require('../src/shared/install-routes');
  const pcsx2 = { bitness: 64, api: 'dxgi', apiLabel: 'DirectX 11', emulator: { key: 'pcsx2', name: 'PCSX2' } };
  assert.ok(routes.routesFor(pcsx2).includes('renodx'), 'offered');
  assert.equal(routes.recommendedRoute({ chosen: pcsx2, dlssFiles: [] }, pcsx2), 'feeder', 'but not recommended');
  const legacy = { bitness: 64, api: 'd3d9', apiLabel: 'DirectX 9', emulator: { key: 'dolphin', name: 'Dolphin' } };
  assert.ok(routes.routesFor(legacy).includes('renodx'));
  const thirtyTwo = { bitness: 32, api: 'dxgi', apiLabel: 'DirectX 11', emulator: { key: 'pcsx2' } };
  assert.ok(!routes.routesFor(thirtyTwo).includes('renodx'), 'the add-on is 64-bit only');
});

test('a safe graphics mode for windows that flicker (#365)', () => {
  const main = read('main.js');
  assert.match(main, /if \(loadState\(\)\.safeGraphics === true\) app\.disableHardwareAcceleration\(\);/);
  assert.match(main, /ipcMain\.handle\('set-safe-graphics'/);
  assert.match(main, /safeGraphics: state\.safeGraphics === true/);
  assert.match(read('preload.js'), /setSafeGraphics: \(enabled\) => ipcRenderer\.invoke\('set-safe-graphics', enabled\)/);
  const renderer = read('src', 'renderer', 'renderer.js');
  assert.match(renderer, /id="setSafeGraphics"/);
  assert.match(renderer, /\$\('setSafeGraphics'\)\.onclick = async \(\) => \{/);
  const i18n = read('src', 'renderer', 'i18n.js');
  assert.equal((i18n.match(/setSafeGraphicsHint: '/g) || []).length, 2, 'in English and Arabic');
});

test('theme 2 is a skin of its own, and cannot leak into theme 1', () => {
  const css = read('src', 'renderer', 'theme2.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1].trim())
    .filter((selector) => selector && !selector.startsWith('@'))
    .flatMap((selector) => selector.split(',').map((one) => one.trim()))
    .filter((one) => one && !/^(from|to|\d+%)$/.test(one));
  // Allowed unscoped: the picker both skins show, and the view-transition
  // pseudo-elements, which only ever run for a transition this skin starts.
  const leaks = selectors.filter((one) =>
    !one.startsWith(':root[data-skin="two"]') &&
    !one.startsWith('[dir="rtl"] :root[data-skin="two"]') &&
    !one.startsWith('.skin-') &&
    !one.startsWith('::view-transition'));
  assert.deepEqual(leaks, [], 'these rules would change theme 1');
  assert.ok(selectors.length > 180, 'the skin covers the app, not a corner of it');

  const html = read('src', 'renderer', 'index.html');
  assert.match(html, /<link rel="stylesheet" href="theme2\.css" \/>/);
  assert.match(html, /<script src="theme2\.js"><\/script>/);
  assert.match(html, /data-skin="one"/);
  const main = read('main.js');
  assert.match(main, /ipcMain\.handle\('set-skin'/);
  assert.match(main, /ipcMain\.handle\('set-rail'/);
  assert.match(main, /ipcMain\.handle\('launch-game'/);
  const preload = read('preload.js');
  assert.match(preload, /setSkin: \(skin\) => ipcRenderer\.invoke\('set-skin', skin\)/);
  assert.match(preload, /launchGame: \(dir\) => ipcRenderer\.invoke\('launch-game', dir\)/);
  const renderer = read('src', 'renderer', 'renderer.js');
  assert.match(renderer, /function skinPicker\(current\)/);
  assert.match(renderer, /if \(state\.skin === 'two'\) window\.theme2\?\.enable\(\);/);
  assert.match(renderer, /const modernSheet = state\.skin === 'two' && window\.theme2;/);
  const i18n = read('src', 'renderer', 'i18n.js');
  for (const key of ['setSkins', 'skinOne', 'skinTwo', 't2Play', 't2Setup', 't2Search']) {
    assert.equal(i18n.split(key + ": '").length - 1, 2, `${key} in English and Arabic`);
  }
});

test('theme 2 has a frame of its own: a dock, a command bar and a palette', () => {
  const js = read('src', 'renderer', 'theme2.js');
  for (const piece of ['function buildBar', 'function buildDock', 'function openPalette', 'function sheetMarkup', 'function stagger']) {
    assert.ok(js.includes(piece), piece);
  }
  // It leaves nothing behind when the other skin is chosen.
  assert.match(js, /function disable\(\) \{[\s\S]*?bar\?\.remove\(\); dock\?\.remove\(\); closePalette\(\);/);
  // Boot can beat this file to the DOM, so it also starts itself.
  assert.match(js, /if \(document\.documentElement\.dataset\.skin === 'two'\) enable\(\);/);
  assert.match(js, /navWatch\?\.disconnect\(\); cardWatch\?\.disconnect\(\); statusWatch\?\.disconnect\(\);/);
  const css = read('src', 'renderer', 'theme2.css');
  assert.match(css, /:root\[data-skin="two"\] \.sidebar \{ display: none; \}/, 'the classic sidebar steps aside');
  assert.match(css, /:root\[data-skin="two"\] \.t2-dock \{/);
  assert.match(css, /:root\[data-skin="two"\] \.t2-bar \{/);
  assert.match(css, /:root\[data-skin="two"\]\[data-rail="off"\] \{ --dock-w: var\(--dock-open\); \}/);
});

test('theme 2 opens a game as a page, and moves with real transitions', () => {
  const css = read('src', 'renderer', 'theme2.css');
  // The page is #overlay; the app has a second element with that class.
  assert.match(css, /:root\[data-skin="two"\] #overlay \{[\s\S]*?background: transparent/);
  assert.match(css, /:root\[data-skin="two"\]:has\(#overlay:not\(\.hidden\)\) \.view \{ visibility: hidden; \}/);
  assert.match(css, /view-transition-name: t2-hero/);
  assert.match(css, /view-transition-name: t2-poster/);
  assert.match(css, /--spring: linear\(/, 'a spring curve, not a bezier approximation');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const js = read('src', 'renderer', 'theme2.js');
  assert.match(js, /document\.startViewTransition/);
  assert.match(js, /root\.openSheet = function/);
  assert.match(js, /root\.show = function/);
  // Leaving the page by pressing another section closes it.
  assert.match(read('src', 'renderer', 'renderer.js'),
    /if \(sheetGame && !jobRunning && document\.documentElement\.dataset\.skin === 'two'\) closeSheet\(\);/);
});

test('the add-ons are the current ones, pinned in one place each', () => {
  const feeder = require('../src/core/feeder-release');
  const renodx = require('../src/core/renodx-release');
  assert.equal(feeder.version, '1.17.0');
  // Both halves of the 32-bit split come out of this one pin, so a payload can
  // never carry a client and a helper that refuse to talk to each other.
  assert.match(feeder.archive[1], /\/v1\.17\.0\/DLSS5-Feeder-1\.17\.0\.zip$/);
  for (const rel of ['dlss5-feed.addon32', 'dlss5-feed.addon64', 'dlss5-feed-host64.exe']) {
    assert.match(feeder.hashes[rel], /^[0-9a-f]{64}$/);
  }
  // The overlay drives the add-on only when the binary in the game is the exact
  // one shipped, so the header and the pin move together. npm run payload
  // refuses to build otherwise; this says it before the build does.
  const header = read('overlay', 'feeder-controls.hpp');
  const bytes = header.match(/const unsigned char hash\[\]=\{([^}]+)\}/)[1]
    .split(',').map((b) => b.trim().replace(/^0x/, '')).join('');
  assert.equal(bytes, feeder.hashes['dlss5-feed.addon64']);
  assert.ok(header.includes('hash_matches(module,' + feeder.addon64Size + ',hash)'), 'the header pins the shipped size');
  assert.match(header, /this build drives x64 v1\.17\.0/);
  // 1.17.0's output stabiliser, on the panel rather than only in the cfg file.
  assert.match(header, /std::array<field,12> schema\(\)/);
  assert.match(header, /std::array<field,12> fields=schema\(\);/);
  assert.match(header, /\{"hold_strength","Output stabiliser hold",0,0,1,\.01f\}/);
  assert.match(header, /\{"hold_tolerance","Stabiliser change tolerance",0,0,1,\.01f\}/);

  assert.equal(renodx.CONSUMER.version, '6.5.3');
  assert.match(renodx.CONSUMER.archive[1], /RankFTW\/rhi-repo/);
  assert.match(renodx.MULTIPASS.version, /^SF 26\.0927/);
  // The build no longer depends on a file sitting on one machine's desktop.
  const script = read('scripts', 'collect-payload.js');
  assert.match(script, /require\('\.\.\/src\/core\/renodx-release'\)/);
  assert.doesNotMatch(script, /const RENODX_ADDONS = Object\.freeze/, 'the inline digest map is gone');
  assert.match(script, /await extracted\(release\.archive/);
});

test('the driver question belongs to the consumer that faults, not to the driver', () => {
  const guards = require('../src/core/install-guards');
  const renodx = require('../src/core/renodx-release');
  const faulting = Object.keys(renodx.FAULTING)[0];
  const rows = [{ name: 'NVIDIA GeForce RTX 5090', driver: '617.14' }];
  // 4.x on a driver upstream measured faulting: still asked.
  assert.equal(guards.driverNeuralFault(rows, faulting), true);
  // The build this release ships: never asked, on any driver.
  assert.equal(guards.driverNeuralFault(rows), false);
  assert.equal(guards.driverNeuralFault([{ name: 'NVIDIA GeForce RTX 5090', driver: '616.86' }]), false);
  assert.equal(renodx.faults(renodx.CONSUMER.sha256), false);
});

test('the F8 panel knows the RenoDX build the app ships', () => {
  const renodx = require('../src/core/renodx-release');
  const probe = read('overlay', 'renodx-ui-probe.hpp');
  // The bridge borrows the add-on's own UI dispatch at addresses that move with
  // every release, so it recognises builds rather than file names. Shipping one
  // it does not know leaves every neural control dark with nothing in any log -
  // which is what shipping 6.5.3 against a 4.70-only overlay did.
  const pinned = [...probe.matchAll(/inline const unsigned char sha_\w+\[\] = \{([^}]+)\}/g)]
    .map((match) => match[1].split(',').map((b) => b.trim().replace(/^0x/, '').padStart(2, '0')).join(''));
  assert.ok(pinned.includes(renodx.CONSUMER.sha256), 'the shipped consumer is a build the overlay can drive');
  // The build that came before it stays, so a game still carrying it keeps its
  // controls.
  assert.ok(pinned.includes('d5adf82eb44b065f4c590ac91fe824bab07afea0eb9f994bde936710c8593952'));
  assert.match(probe, /struct build_pin \{/);
  assert.match(probe, /inline const build_pin known_builds\[\]/);
  assert.match(probe, /\{"6\.5\.3", 878080,/);
  // Nothing is hardcoded to one build any more.
  const bridge = read('overlay', 'renodx-ui-bridge.hpp');
  assert.doesNotMatch(bridge, /0x196ca0|0x2a600|0x23ff8|0x2607c/, 'the 4.70 addresses are gone from the bridge');
  assert.match(bridge, /base \+ build->slot/);
  assert.match(bridge, /base \+ build->overlay/);
  assert.match(bridge, /nr_probe::identify\(module\)/);
  // 6.x files its controls under collapsing sections, and the hidden pass that
  // reads them starts every section closed: without this the panel saw 6 of 15
  // controls and reported itself unavailable, which is how the update shipped.
  assert.match(bridge, /table\.CollapsingHeader = collapsing; table\.CollapsingHeader2 = collapsing2; table\.TreeNodeEx = tree_node;/);
  assert.match(bridge, /ImGuiTreeNodeFlags_DefaultOpen/);
  // And it says in the game's own log what it decided, because a panel with
  // nothing in it was otherwise silent about the reason.
  assert.match(bridge, /NR_LAB_BRIDGE build=%s active=%d controls=%s reason=/);
  // And the build refuses to ship a consumer the overlay cannot drive.
  assert.match(read('scripts', 'collect-payload.js'), /assertOverlayKnowsConsumer\(\);/);
});
