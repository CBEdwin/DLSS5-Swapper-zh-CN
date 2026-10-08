'use strict';

// Vulkan does not load a proxy DLL from the executable directory. ReShade is
// therefore registered as an implicit layer for the current Windows user.
// This follows the same HKCU layout used by ReShade and DLSS5-Autopilot and
// keeps a reference list so restoring one emulator cannot break another.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const KEY = 'HKCU\\Software\\Khronos\\Vulkan\\ImplicitLayers';

function defaultRunner(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({ code: error && typeof error.code === 'number' ? error.code : (error ? 1 : 0), stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

function readUsers(dir) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'installs.json'), 'utf8'));
    return Array.isArray(data.games) ? data.games.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function writeUsers(dir, games) {
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, 'installs.json'), JSON.stringify({ version: 1, games }, null, 2), 'utf8');
}

function samePath(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

async function existing(runner) {
  const result = await runner('reg.exe', ['query', KEY]);
  if (result.code !== 0) return null;
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    const match = line.match(/^\s*(.+?\.json)\s+REG_DWORD\s+0x0\s*$/i);
    if (!match || !/reshade/i.test(match[1])) continue;
    if (fs.existsSync(match[1].trim())) return path.resolve(match[1].trim());
  }
  return null;
}

async function register(options) {
  const { sourceDir, targetDir, gameDir, bitness = 64, runner = defaultRunner } = options;
  const current = await existing(runner);
  const our64 = path.join(targetDir, 'ReShade64.json');
  const ours = current && samePath(current, our64);
  if (current && !ours) return { manifest: current, owned: false, global: true };

  await fs.promises.mkdir(targetDir, { recursive: true });
  const names = bitness === 32
    ? ['ReShade64.dll', 'ReShade64.json', 'ReShade32.dll', 'ReShade32.json']
    : ['ReShade64.dll', 'ReShade64.json'];
  for (const name of names) {
    await fs.promises.copyFile(path.join(sourceDir, name), path.join(targetDir, name));
  }
  for (const manifestName of names.filter((name) => name.endsWith('.json'))) {
    const file = path.join(targetDir, manifestName);
    const data = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    data.layer = data.layer || {};
    data.layer.library_path = `.\\${manifestName.replace(/\.json$/i, '.dll')}`;
    await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
    const result = await runner('reg.exe', ['add', KEY, '/v', file, '/t', 'REG_DWORD', '/d', '0', '/f']);
    if (result.code !== 0) throw new Error(`Vulkan layer registration failed: ${result.stderr || result.stdout}`);
  }

  const games = readUsers(targetDir);
  if (!games.some((item) => samePath(item, gameDir))) games.push(path.resolve(gameDir));
  await writeUsers(targetDir, games);
  return { manifest: our64, owned: true, global: true, dir: targetDir };
}

async function detach(info, gameDir, runner = defaultRunner) {
  if (!info || !info.owned || !info.dir) return false;
  const games = readUsers(info.dir).filter((item) => !samePath(item, gameDir));
  await writeUsers(info.dir, games);
  if (games.length) return false;

  for (const name of ['ReShade64.json', 'ReShade32.json']) {
    const file = path.join(info.dir, name);
    await runner('reg.exe', ['delete', KEY, '/v', file, '/f']);
  }
  for (const name of ['ReShade64.dll', 'ReShade64.json', 'ReShade32.dll', 'ReShade32.json', 'installs.json']) {
    try { await fs.promises.unlink(path.join(info.dir, name)); } catch {}
  }
  try { await fs.promises.rmdir(info.dir); } catch {}
  return true;
}

module.exports = { KEY, register, detach, existing, defaultRunner };
