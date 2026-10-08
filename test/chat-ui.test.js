'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../src/renderer/chat.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/renderer/chat.css'), 'utf8');

test('Chat sits directly under Games and owns a complete composer', () => {
  assert.ok(html.indexOf('data-view="games"') < html.indexOf('data-view="chat"'));
  assert.ok(html.indexOf('data-view="chat"') < html.indexOf('data-view="community"'));
  for (const id of ['chatPlus','chatInput','chatSend','chatFile','chatAttachments','chatReplyPreview']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('images are compressed locally and may be pasted, dropped, zoomed and browsed', () => {
  assert.match(js, /MAX_ORIGINAL = 15 \* 1024 \* 1024/);
  assert.match(js, /MAX_COMPRESSED = 2 \* 1024 \* 1024/);
  assert.match(js, /createImageBitmap\(file/);
  assert.match(js, /canvas\.toBlob\(resolve, 'image\/webp'/);
  assert.match(js, /\.onpaste =/);
  assert.match(js, /\.ondrop =/);
  assert.match(js, /\.onwheel =/);
  assert.match(js, /event\.clientX, event\.clientY/);
  assert.match(js, /ArrowLeft/); assert.match(js, /ArrowRight/);
});

test('game cards open the existing in-place community detail instead of navigating away', () => {
  assert.match(js, /communityUi\?\.openCard\?\./);
  assert.match(html, /id="communityCardDialog"/);
});

test('message actions appear on hover and the context menu stays above dialogs', () => {
  assert.match(css, /\.chat-message:hover \.chat-quick-actions/);
  assert.match(css, /\.chat-context \{[^}]*z-index:10000/s);
  for (const action of ['save','reply','copy','edit','delete','hide','block']) assert.match(js, new RegExp(`'${action}'`));
});

test('admin mode moderates ordinary messages even when they share the local user tag', () => {
  assert.match(js, /const mine = by => state\.admin \? isAdminMine\(by\) : isMine\(by\)/);
  assert.match(js, /'delete-admin'/);
  assert.match(js, /communityChatModerate\(message\.id, action\)/);
});

test('returning to Chat reloads the current admin identity before painting menus', () => {
  assert.match(js, /await Promise\.allSettled\(\[loadIdentity\(\), loadPeople\(\), refresh\(\)\]\);\s*paintMessages\(\)/);
});

test('chat deletion uses the in-app confirmation and immediately suppresses cached messages', () => {
  assert.match(js, /window\.ask \|\| window\.askDialog\?\.ask/);
  assert.doesNotMatch(js, /window\.confirm\(/);
  assert.match(js, /suppressed: new Map\(\)/);
  assert.match(js, /suppressMessage\(message/);
});

test('draft attachments have independent removal and a readable custom label picker', () => {
  assert.match(html, /id="chatLabelMenu"/);
  assert.match(js, /data-remove-image/);
  assert.match(js, /data-remove-game/);
  assert.match(js, /event\.stopPropagation\(\); closeLabelMenu\(\); removeAttachment/);
  assert.match(js, /data-image-label-menu/);
  assert.match(css, /\.chat-draft-image \{ width:168px; height:112px/);
  assert.match(css, /\.chat-draft-label-toggle svg \{ width:20px; height:20px/);
  assert.match(css, /\.chat-image-label \{[^}]*font-size:13px/s);
});
