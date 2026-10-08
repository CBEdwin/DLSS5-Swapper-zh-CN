'use strict';
const { t } = require('./feature-i18n');

// Main-process confirmation: never trust a renderer-supplied approval flag.
// Consent applies only to this installation attempt and is not saved globally.
function dialogOptions(language, gameDir, exePath) {
  return {
    type: 'warning',
    title: t(language, 'antiCheatWarningTitle'),
    message: t(language, 'antiCheatWarningTitle'),
    detail: t(language, 'antiCheatWarning') + '\n\n' + gameDir + '\n' + exePath,
    buttons: [t(language, 'cancel'), t(language, 'antiCheatContinue')],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  };
}
module.exports = { dialogOptions };
