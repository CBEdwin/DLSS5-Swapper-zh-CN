'use strict';

// Pictures of the second skin, taken from the real app: the same window, the
// same library, the same game page - drawn by theme2.css instead of style.css.
// Written for review, so it shoots the same three screens in both skins and
// saves them side by side.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const version = require('../package.json').version;
if (typeof app.setVersion === 'function') app.setVersion(version);
else app.getVersion = () => version;
app.setName('DLSS 5 Swapper');

require('../main.js');

const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', 'docs', 'screenshots', 'theme2');
const WIDTH = 1680, HEIGHT = 1020;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const die = (why) => { console.error(why); app.exit(1); };
setTimeout(() => die('timed out'), 240000);

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let win = null;
  for (let i = 0; i < 200 && !win; ++i) {
    win = BrowserWindow.getAllWindows().find((w) => !w.webContents.isDestroyed() && !w.webContents.isOffscreen());
    if (!win) await wait(100);
  }
  if (!win) return die('no window');
  await new Promise((resolve) => win.webContents.isLoading() ? win.webContents.once('did-finish-load', resolve) : resolve());
  win.setSize(WIDTH, HEIGHT);
  win.center();
  win.show();

  const run = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => {
    await wait(800);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, name), image.toPNG());
    console.log('  wrote', name, image.getSize().width + 'x' + image.getSize().height);
  };
  const settle = async (expression, why) => {
    for (let i = 0; i < 150; ++i) { if (await run(expression)) return; await wait(200); }
    throw new Error('never became true: ' + why);
  };

  await run(`state.theme = 'dark'; document.documentElement.dataset.theme = 'dark'; paintBrand(); window.lab.setTheme('dark'); true`);
  await settle(`$('statusText').textContent === t('ready')`, 'library idle');
  await run(`show('games'); true`);
  await settle(`document.querySelectorAll('#groups .card').length > 3`, 'library grid');
  // A game with artwork makes the page worth photographing.
  const dir = await run(`(() => {
    const requested = ${JSON.stringify(process.env.SHOT_GAME || '')};
    const withArt = (requested && state.games.find(g => g.name.toLowerCase().includes(requested.toLowerCase()))) || state.games.find(g => g.poster && g.poster.url) || state.games[0];
    return withArt ? withArt.dir : null;
  })()`);
  if (!dir) return die('no games on this machine to photograph');
  console.log('  game:', dir);

  for (const skin of ['two', 'one']) {
    await run(`state.skin = '${skin}'; document.documentElement.dataset.skin = '${skin}'; syncSkinChrome(); window.lab.setSkin('${skin}'); true`);
    await wait(900);

    await run(`show('home'); true`);
    await shot(`${skin}-1-home.png`);

    await run(`show('games'); true`);
    await settle(`document.querySelectorAll('#groups .card').length > 3`, 'library grid');
    await shot(`${skin}-2-library.png`);

    await run(`closeSheet(); openSheet(${JSON.stringify(dir)}); true`);
    await settle(`!!document.getElementById('doInstall')`, 'game page');
    await wait(1400);
    if (skin === 'two' && process.env.SHOT_COMMUNITY === '1') {
      await run(`(() => {
        const box = document.getElementById('sheetCommunity');
        if (!box) return false;
        box.innerHTML = '<header><b>What the community found</b><span class="sheet-community-status working">Working</span><button class="ghost sm" type="button">Open reports</button></header><div class="sheet-community-routes"><div class="sheet-community-route"><span>RenoDX</span><span class="g"><i></i>21</span><span class="y"><i></i>4</span><span class="r"><i></i>5</span></div><div class="sheet-community-route"><span>Feeder</span><span class="g"><i></i>1</span><span class="y"><i></i>0</span><span class="r"><i></i>0</span></div><div class="sheet-community-route"><span>OptiScaler</span><span class="g"><i></i>3</span><span class="y"><i></i>0</span><span class="r"><i></i>2</span></div></div><p>36 reports · 10 comments</p>';
        box.hidden = false;
        return true;
      })()`);
    }
    await shot(`${skin}-3-game.png`);
    if (skin === 'two') {
      await run(`document.querySelector('.t2-tab[data-tab="about"]')?.click(); true`);
      await shot('two-3-about.png');
      await run(`document.querySelector('.t2-tab[data-tab="dlss"]')?.click(); true`);
    }
    await run(`closeSheet(); true`);

    await run(`show('settings'); true`);
    await settle(`!!document.querySelector('[data-skin-choice]')`, 'settings');
    await shot(`${skin}-4-settings.png`);

    // Theme 2 only: the sidebar folded down to its icons, and the game page
    // beside it with the width that gives back.
    if (skin === 'two') {
      await run(`state.rail = 'on'; document.documentElement.dataset.rail = 'on'; window.lab.setRail('on'); true`);
      await run(`show('games'); true`);
      await settle(`document.querySelectorAll('#groups .card').length > 3`, 'library grid');
      await shot('two-5-rail-library.png');
      await run(`openSheet(${JSON.stringify(dir)}); true`);
      await settle(`!!document.getElementById('doInstall')`, 'game page');
      await wait(1400);
      await shot('two-6-rail-game.png');
      await run(`closeSheet(); state.rail = 'off'; document.documentElement.dataset.rail = 'off'; window.lab.setRail('off'); true`);
      await run(`show('games'); window.theme2.openPalette(); true`);
      await settle(`!!document.getElementById('t2PaletteInput')`, 'palette');
      await run(`document.getElementById('t2PaletteInput').value = 'ma'; document.getElementById('t2PaletteInput').dispatchEvent(new Event('input')); true`);
      await shot('two-7-palette.png');
      await run(`window.theme2.closePalette(); true`);
    }
  }

  // Left as it was found: the classic skin is still the default.
  await run(`state.skin = 'one'; document.documentElement.dataset.skin = 'one'; window.lab.setSkin('one'); true`);
  console.log('done ->', OUT);
  app.exit(0);
}).catch((error) => die(error.stack || String(error)));
