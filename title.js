// Device Frame - title override (content script, document_start, top frame).
//
// The "Window title" setting (prefs.mupTitle, default "WM Mobile"; blank =
// off) replaces the page title shown in the window title bar / tab:
//   - in frame windows: for every page;
//   - in normal tabs: only for pages titled exactly "MUP" (the WM mobile app).
// It re-applies whenever the page changes its title, and restores the page's
// own title when the setting is cleared.

(() => {
  const MATCH = 'MUP';
  const DEFAULT = 'WM Mobile';
  let replacement = DEFAULT;
  let framed = false; // set by the background for frame windows
  let own = null; // the page's own (latest) title
  let renamed = false; // whether the current title is ours

  const wanted = () => Boolean(replacement) && (framed || (own ?? '').trim() === MATCH);

  // Re-evaluate after the setting or framed state changes.
  const refresh = () => {
    if (!renamed) return apply();
    if (wanted()) {
      document.title = replacement;
    } else {
      renamed = false;
      document.title = own ?? ''; // put the page's own title back
    }
  };

  // Called when the title may have changed.
  const apply = () => {
    const current = document.title;
    if (renamed && current === replacement) return;
    own = current;
    renamed = wanted();
    if (renamed) document.title = replacement;
  };

  const load = (last) => {
    const value = last?.mupTitle;
    replacement = typeof value === 'string' ? value.trim() : DEFAULT;
    refresh();
  };

  chrome.storage.local.get('last').then(({ last }) => load(last), () => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.last) load(changes.last.newValue);
  });
  // The background sends this (with the shortcut list for keyguard.js) only
  // to tabs shown in a frame window.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'keyguard' && !framed) {
      framed = true;
      refresh();
    }
  });

  // Watch the <title> (and its replacement) so the override survives the app
  // updating its title as you move between screens.
  const watch = () => {
    if (!document.head) return;
    new MutationObserver(apply).observe(document.head, { childList: true, subtree: true, characterData: true });
    apply();
  };
  if (document.head) watch();
  else document.addEventListener('DOMContentLoaded', watch, { once: true });
})();
