'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const features = require('../src/shared/feature-i18n');

function renderer() {
  const context = vm.createContext({ window: {} });
  for (const file of ['renderer/i18n.js', 'renderer/i18n-extra.js', 'shared/feature-i18n.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context, { filename: file });
  }
  return context.window.i18n;
}
const placeholders = text => (text.match(/\{\d+\}/g) || []).sort();

test('all 38 registered languages own every feature translation with matching placeholders', () => {
  const ui = renderer();
  assert.equal(ui.LANGS.length, 38);
  assert.deepEqual(Object.keys(features.catalog).sort(), Array.from(ui.LANGS, lang => lang.code).sort());
  for (const { code } of ui.LANGS) {
    const strings = features.strings(code);
    ui.setLang(code);
    for (const key of features.keys) {
      assert.ok(Object.hasOwn(strings, key), `${code}.${key} missing`);
      assert.equal(typeof strings[key], 'string', `${code}.${key}`);
      assert.ok(strings[key].trim(), `${code}.${key} empty`);
      assert.deepEqual(placeholders(strings[key]), placeholders(features.catalog.en[key]), `${code}.${key}`);
      assert.equal(ui.t(key, 7, 18), features.t(code, key, 7, 18), `${code}.${key} renderer/native mismatch`);
    }
    if (code !== 'en') {
      for (const key of ['searchGames', 'clearFilters', 'antiCheatWarning', 'antiCheatContinue']) {
        assert.notEqual(strings[key], features.catalog.en[key], `${code}.${key} silently falls back to English`);
      }
    }
  }
});

test('locale resolution, interpolation and script loading order remain predictable', () => {
  assert.equal(features.locale('pt-BR'), 'pt');
  assert.equal(features.locale('ZH-hant'), 'zh-TW');
  assert.equal(features.locale('xx'), 'en');
  assert.equal(features.t('en', 'filteredCount', 7, 18), '7 of 18 shown');
  assert.equal(features.t('ja', 'filteredCount', 7, 18), '18 件中 7 件表示');
  assert.equal(features.t('en', 'filteredCount', '{1}', 18), '{1} of 18 shown');
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  assert.ok(html.indexOf('i18n-extra.js') < html.indexOf('../shared/feature-i18n.js'));
  assert.ok(html.indexOf('../shared/feature-i18n.js') < html.indexOf('src="renderer.js"'));
  const ui = renderer();
  for (const code of ['ar', 'fa', 'ur']) assert.equal(ui.dirOf(code), 'rtl');
});
