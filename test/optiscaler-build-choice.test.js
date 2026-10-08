'use strict';
// #238: 2.2.1 shipped OptiScaler 0.1.1.5 and 2.2.2 shipped 0.2.0-patch1. No
// Man's Sky runs on the first and crashes on the second, and the only way back
// was to keep an old copy of the whole app. A game can name the older build
// now - but only from the list this app pins, so nothing unverified becomes
// installable and the guarantee #191 relies on is untouched.
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const opti = require('../src/core/optiscaler');

test('every pinned build carries a URL and a digest, exactly as the single one did', () => {
  assert.ok(opti.RELEASES.length >= 2, 'more than one to choose between');
  for (const release of opti.RELEASES) {
    assert.match(release.version, /^\d/, release.version);
    assert.match(release.url, /^https:\/\/github\.com\/.+\.zip$/, release.version);
    assert.match(release.sha256, /^[0-9a-f]{64}$/, release.version);
    // Its licence is either fetched beside the archive under a pinned digest,
    // or carried inside the archive the digest above already covers.
    if (release.licenseUrl) assert.match(release.licenseHash, /^[0-9a-f]{64}$/, release.version);
    else assert.ok(release.layout.gpl, release.version + ' must carry a licence of its own');
    // Every build says how its own package is laid out, because they are not
    // all the same project: one reaches the runtime through a forwarder DLL and
    // one opens it directly, and installing the wrong plan is silent.
    assert.ok(Array.isArray(release.layout.licenses) && release.layout.licenses.length >= 4, release.version);
    assert.match(release.layout.notes, /\.(txt|md)$/, release.version);
  }
  assert.equal(opti.RELEASE, opti.RELEASES[0], 'the first is the default');
});

test('a game names a build, and anything else falls back to the current one', () => {
  assert.equal(opti.releaseFor('0.1.1.5-dlssnr').version, '0.1.1.5-dlssnr');
  assert.equal(opti.releaseFor('0.2.0-patch1').version, '0.2.0-patch1');
  assert.equal(opti.releaseFor('0.8.92-presr').version, '0.8.92-presr');
  for (const junk of [undefined, null, '', 'nonsense', '../../etc/passwd', 42, {}]) {
    assert.equal(opti.releaseFor(junk).version, opti.RELEASE.version, String(junk));
  }
});

test('the two builds are kept apart on disk, so choosing one cannot corrupt the other', () => {
  const versions = opti.RELEASES.map((r) => r.version);
  assert.equal(new Set(versions).size, versions.length, 'distinct version names');
  const digests = opti.RELEASES.map((r) => r.sha256);
  assert.equal(new Set(digests).size, digests.length, 'and distinct archives');
});

test('each build is installed by its own plan, and the fork brings no forwarder', () => {
  const forwarded = opti.releaseFor('0.2.0-patch1');
  const presr = opti.releaseFor('0.8.92-presr');
  const plan = (release) => opti.copyPlan('ROOT', 'dxgi', release).map((item) => item.to);
  const forwardedPlan = plan(forwarded);
  const presrPlan = plan(presr);
  // The proxy name is the app's choice and does not move between builds.
  assert.equal(forwardedPlan[0], 'dxgi.dll');
  assert.equal(presrPlan[0], 'dxgi.dll');
  assert.ok(forwardedPlan.includes('nvngx.dll_dlssnr.dll'), 'the forwarded build carries its forwarder');
  assert.ok(!presrPlan.includes('nvngx.dll_dlssnr.dll'), 'the fork opens the runtime directly');
  // Whichever build supplied it, the GPL text lands under one name, and the
  // notes land under one name, so Restore and the folder both stay predictable.
  for (const list of [forwardedPlan, presrPlan]) {
    assert.ok(list.includes('OptiScaler/licenses/LICENSE.GPL-3.0.txt'));
    assert.ok(list.includes('OptiScaler/README-DLSSNR.txt'));
    for (const name of opti.LIBRARIES) assert.ok(list.includes('OptiScaler/' + name), name);
  }
  // Two licences the fork adds, one of them for the algorithm it squeezes the
  // periphery with.
  assert.ok(presrPlan.includes('OptiScaler/licenses/PeripheralWarp_LICENSE.txt'));
  assert.ok(presrPlan.includes('OptiScaler/licenses/FidelityFX_v1_LICENSE.md'));
  // Where each file comes from inside its own archive.
  const from = (release, to) => opti.copyPlan('ROOT', 'dxgi', release).find((item) => item.to === to).from;
  assert.match(from(forwarded, 'OptiScaler/README-DLSSNR.txt'), /READ ME - DLSS Neural Rendering\.txt$/);
  assert.match(from(presr, 'OptiScaler/README-DLSSNR.txt'), /INSTALL-DLSSNR\.md$/);
  assert.match(from(forwarded, 'OptiScaler/licenses/LICENSE.GPL-3.0.txt'), /OptiScaler-GPL-3\.0\.txt$/);
  assert.match(from(presr, 'OptiScaler/licenses/LICENSE.GPL-3.0.txt'), /LICENSE$/);
});

test('an installed fork is reported as installed, and its manifest names it', () => {
  const root = path.join(__dirname, '..');
  const scan = fs.readFileSync(path.join(root, 'src', 'core', 'scan.js'), 'utf8');
  // Requiring a forwarder from every build reported the fork as absent.
  assert.match(scan, /releaseFor\(install\.optiscaler\.version\)\.layout/);
  assert.match(scan, /\['nvngx_dlssnr\.dll', 'OptiScaler\.ini', layout\.forwarder\]\.filter\(Boolean\)/);
  const opticore = fs.readFileSync(path.join(root, 'src', 'core', 'optiscaler.js'), 'utf8');
  // The manifest used to record the default build whatever was installed.
  assert.match(opticore, /manifest\.optiscaler = \{ version: release\.version/);
  assert.match(opticore, /const release = releaseFor\(config\.optiVersion\)/);
  assert.match(opticore, /if \(!release\.layout\.forwarder\) await retireForwarder\(/);
  // And the main process passes the build the game asked for.
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.match(main, /optiVersion = release\.version;/);
  assert.match(main, /^\s+optiVersion,$/m);
  assert.match(main, /label: r\.label \|\| r\.version/);
});
