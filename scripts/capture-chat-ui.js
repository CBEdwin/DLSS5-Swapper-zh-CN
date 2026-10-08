'use strict';

// A deterministic visual smoke test for the chat page. It uses a separate
// Electron profile, so it can run beside an installed copy without touching
// the person's library, preferences or single-instance lock.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { app } = require('electron');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dlss5-chat-preview-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');

let captured = false;
app.on('browser-window-created', (_event, window) => {
  if (captured || window.webContents.getType() !== 'window') return;
  window.webContents.once('did-finish-load', async () => {
    if (captured) return;
    captured = true;
    try {
      window.setSize(1280, 860);
      await window.webContents.executeJavaScript(`document.querySelector('[data-view="chat"]').click()`);
      await new Promise(resolve => setTimeout(resolve, 3500));
      const image = await window.webContents.capturePage();
      const output = path.resolve(process.env.CHAT_PREVIEW_FILE || path.join(__dirname, '../artifacts/chat-preview.png'));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, image.toPNG());
      process.stdout.write(output + '\n');
    } catch (error) {
      process.stderr.write(error.stack + '\n');
      process.exitCode = 1;
    } finally {
      app.exit(process.exitCode || 0);
    }
  });
});

require('../main');
