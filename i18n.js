// Device Frame - UI language, shared by the service worker (importScripts)
// and the extension's own pages (recorder.html).

// ---- language ------------------------------------------------------------
// UI text comes from _locales/<lang>/messages.json. 'auto' follows Chrome's
// language; the settings panel can override it. English fills any gaps.

const LANGS = ['en', 'fr', 'es_419'];
const messageCache = {};

function resolveLang(pref) {
  if (LANGS.includes(pref)) return pref;
  const ui = chrome.i18n.getUILanguage().toLowerCase();
  if (ui.startsWith('fr')) return 'fr';
  if (ui.startsWith('es')) return 'es_419';
  return 'en';
}

async function loadMessages(lang) {
  if (!messageCache[lang]) {
    const res = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
    const json = await res.json();
    messageCache[lang] = Object.fromEntries(Object.entries(json).map(([k, v]) => [k, v.message]));
  }
  return messageCache[lang];
}

// { key: text } for the chosen language, English as fallback.
async function uiText(pref) {
  const lang = resolveLang(pref);
  const en = await loadMessages('en');
  return lang === 'en' ? en : { ...en, ...(await loadMessages(lang)) };
}
