'use strict';
// Which community card a game on this machine would be filed under. The server
// decides that for every report (server/src/games.js); "My games" needs the
// same answer without writing anything, so the rules are repeated here and a
// test keeps the two in step.
//
// A game can have been filed under more than one kind of key over time - by
// executable, by store id, by title - so every key it could match is offered
// and the server answers with the cards that exist.

const STORES = new Set(['steam', 'epic', 'gog', 'xbox', 'ubisoft']);
const LAUNCHER_STORE = { Steam: 'steam', 'Epic Games': 'epic', GOG: 'gog', Xbox: 'xbox', Ubisoft: 'ubisoft' };
const USELESS_EXE = /^(?:launcher|start|game|play|run|setup|bin|main|client)$/;
const SHARED_EXE = /^(?:hl2|hl|java|javaw|python|ue4game|ue5game|pcsx2|xenia|duckstation|retroarch|dolphin|rpcs3|ppsspp|yuzu|ryujinx|cemu|citra|redream|flycast|dosbox|scummvm|gens|kegafusion|fusion|epsxe|project64|mame|86box|pcem)/;

function normaliseTitle(value) {
  return String(value || '')
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(?:the|a|an)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normaliseExe(value) {
  const base = String(value || '').split(/[\\/]/).pop().replace(/\.exe$/i, '');
  const clean = normaliseTitle(base);
  return clean && !USELESS_EXE.test(clean) && !SHARED_EXE.test(clean) && clean.length >= 3 ? clean : null;
}

// The store a report names, from the launcher the library found the game in.
const storeOf = launcher => LAUNCHER_STORE[launcher] || null;

// Every key a game could be on the server under, strongest first.
function keysFor({ title, exe, store, storeId } = {}) {
  const keys = [];
  const exeKey = normaliseExe(exe);
  if (exeKey) keys.push(`exe:${exeKey}`);
  const id = String(storeId || '').trim();
  if (STORES.has(String(store || '').toLowerCase()) && /^[A-Za-z0-9._-]{1,64}$/.test(id)) {
    keys.push(`${String(store).toLowerCase()}:${id.toLowerCase()}`);
  }
  const clean = normaliseTitle(title);
  if (clean.length >= 3) keys.push(`title:${clean}`);
  return keys;
}

module.exports = { keysFor, storeOf, normaliseTitle, normaliseExe };
