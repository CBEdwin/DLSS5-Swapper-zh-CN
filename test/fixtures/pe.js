'use strict';
const fs = require('fs');
const path = require('path');
// Valid but non-executable PE fixture; no code or payload is run in tests.
function writePe(file, { bitness = 64, text = '', size = 64 * 1024 } = {}) {
  const bytes = Buffer.alloc(size);
  bytes.writeUInt16LE(0x5a4d, 0);
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.writeUInt32LE(0x00004550, 0x80);
  bytes.writeUInt16LE(bitness === 64 ? 0x8664 : 0x14c, 0x84);
  bytes.writeUInt16LE(bitness === 64 ? 240 : 224, 0x94);
  bytes.writeUInt16LE(bitness === 64 ? 0x20b : 0x10b, 0x98);
  bytes.write(text, 0x1000);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return file;
}
module.exports = { writePe };
