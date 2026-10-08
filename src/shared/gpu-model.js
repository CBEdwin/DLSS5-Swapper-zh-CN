'use strict';
// The community server files every report's graphics card under a model name,
// so "NVIDIA GeForce RTX 5080" and "RTX 5080" are one card. The app needs the
// same answer for its own card - to offer "My card" in the filter - so this is
// the server's function, kept identical; a test compares the two.
(function (root) {
  const NOISE = /\b(?:NVIDIA|AMD|ATI|Intel|GeForce|Graphics|GPU|Series)\b/gi;
  const FAMILY = new Map([['rtx', 'RTX'], ['gtx', 'GTX'], ['rx', 'RX'], ['xt', 'XT'], ['xtx', 'XTX'],
    ['gre', 'GRE'], ['ti', 'Ti'], ['super', 'SUPER'], ['laptop', 'Laptop'], ['radeon', 'Radeon'],
    ['arc', 'Arc'], ['pro', 'PRO'], ['max-q', 'Max-Q']]);

  function normaliseGpu(value) {
    const words = String(value || '')
      .replace(/\((?:R|TM)\)|[®™]/gi, ' ')
      .replace(NOISE, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => FAMILY.get(word.toLowerCase()) || word);
    const model = words.join(' ').slice(0, 60).trim();
    return model.length >= 2 ? model : null;
  }

  const api = { normaliseGpu };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.gpuModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
