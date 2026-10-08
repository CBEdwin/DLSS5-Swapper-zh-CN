'use strict';

// Emulator profiles are based on the MIT-licensed detection table used by
// DLSS5-Autopilot. An emulator is patched exactly like a game executable; the
// profile supplies the renderer choices that static PE imports cannot reveal.
// Source: https://github.com/Kizzuwatnaa/DLSS5-Autopilot/blob/main/core/emulators.py
const PROFILES = [
  ['duckstation', 'DuckStation', 'PlayStation 1', ['duckstation-qt-x64.exe', 'duckstation-qt-x64-releaseltcg.exe', 'duckstation-nogui-x64.exe', 'duckstation.exe'], ['dxgi', 'vulkan', 'opengl'], 'Settings > Graphics > Renderer: Direct3D 11/12'],
  ['pcsx2', 'PCSX2', 'PlayStation 2', ['pcsx2-qt.exe', 'pcsx2x64.exe', 'pcsx2x64-avx2.exe', 'pcsx2.exe'], ['dxgi', 'vulkan', 'opengl'], 'Settings > Graphics > Renderer: Direct3D 11/12'],
  ['dolphin', 'Dolphin', 'GameCube / Wii', ['dolphin.exe', 'dolphinqt.exe'], ['dxgi', 'vulkan', 'opengl'], 'Graphics > Backend: Direct3D 11/12'],
  ['ppsspp', 'PPSSPP', 'PSP', ['ppssppwindows64.exe', 'ppssppwindows.exe'], ['dxgi', 'vulkan', 'opengl'], 'Settings > Graphics > Backend: Direct3D 11'],
  ['xenia', 'Xenia', 'Xbox 360', ['xenia.exe', 'xenia_canary.exe'], ['dxgi', 'vulkan'], 'Use the Direct3D 12 backend'],
  ['cemu', 'Cemu', 'Wii U', ['cemu.exe'], ['vulkan', 'opengl'], 'Options > General settings > Graphics: Vulkan'],
  ['rpcs3', 'RPCS3', 'PlayStation 3', ['rpcs3.exe'], ['vulkan', 'opengl'], 'Configuration > GPU > Renderer: Vulkan'],
  ['ryujinx', 'Ryujinx', 'Nintendo Switch', ['ryujinx.exe', 'ryujinx.ava.exe', 'ryujinx.headless.sdl2.exe'], ['vulkan', 'opengl'], 'Settings > Graphics > Backend: Vulkan'],
  ['yuzu', 'yuzu / suyu / Eden / Citron', 'Nintendo Switch', ['yuzu.exe', 'suyu.exe', 'eden.exe', 'citron.exe', 'sudachi.exe'], ['vulkan', 'opengl'], 'Graphics API: Vulkan'],
  ['shadps4', 'shadPS4', 'PlayStation 4', ['shadps4.exe'], ['vulkan'], 'Vulkan renderer'],
  ['azahar', 'Azahar / Citra / Lime3DS', 'Nintendo 3DS', ['azahar.exe', 'citra.exe', 'citra-qt.exe', 'lime3ds.exe'], ['vulkan', 'opengl'], 'Graphics API: Vulkan'],
  ['melonds', 'melonDS', 'Nintendo DS', ['melonds.exe'], ['opengl'], 'OpenGL renderer'],
  ['flycast', 'Flycast', 'Dreamcast', ['flycast.exe'], ['dxgi', 'vulkan', 'opengl'], 'Video > Renderer: DirectX 11'],
  ['xemu', 'xemu', 'Xbox', ['xemu.exe'], ['vulkan', 'opengl'], 'Renderer: Vulkan'],
  ['vita3k', 'Vita3K', 'PlayStation Vita', ['vita3k.exe'], ['vulkan', 'opengl'], 'Backend Renderer: Vulkan'],
  ['retroarch', 'RetroArch', 'Multi-system', ['retroarch.exe'], ['dxgi', 'vulkan', 'opengl'], 'Video driver: d3d11 or d3d12'],
  ['mgba', 'mGBA', 'Game Boy Advance', ['mgba.exe'], ['opengl'], 'OpenGL renderer'],
  ['snes9x', 'Snes9x', 'SNES', ['snes9x-x64.exe', 'snes9x.exe'], ['dxgi'], 'Output method: Direct3D'],
  ['play', 'Play!', 'PlayStation 2', ['play.exe'], ['vulkan', 'opengl'], 'Renderer: Vulkan']
].map(([key, name, system, exes, apis, hint]) => ({ key, name, system, exes, apis, hint }));

const BY_EXE = new Map(PROFILES.flatMap((profile) =>
  profile.exes.map((exe) => [exe.toLowerCase(), profile])));

const API_LABELS = {
  dxgi: 'DirectX 11/12',
  vulkan: 'Vulkan',
  opengl: 'OpenGL'
};

function profileFor(file) {
  const name = String(file || '').split(/[\\/]/).pop().toLowerCase();
  return BY_EXE.get(name) || null;
}

function apiChoices(profile) {
  return (profile ? profile.apis : []).map((api) => ({ api, label: API_LABELS[api] }));
}

module.exports = { PROFILES, profileFor, apiChoices, API_LABELS };
