// Device Frame - tab title rename (content script, document_start, top frame).
//
// Pages whose own title is exactly "MUP" (the WM mobile app) show a friendlier
// title in the tab / window title bar. The text is a setting in the frame's
// settings panel (prefs.mupTitle, default "WM Mobile"); blank keeps the page's
// own title. Works in normal tabs and in the frame window.

(() => {
  const MATCH = 'MUP';
  const DEFAULT = 'WM Mobile';
  let replacement = DEFAULT;
  let renamed = false; // whether the current title is ours

  const apply = () => {
    const current = document.title;
    if (renamed && current === replacement) return;
    if (current.trim() === MATCH && replacement) {
      renamed = true;
      document.title = replacement;
    } else if (renamed && !replacement) {
      renamed = false;
      document.title = MATCH; // setting cleared: put the page's title back
    } else if (current !== replacement) {
      renamed = false; // the page set a different title of its own
    }
  };

  const load = (last) => {
    const value = last?.mupTitle;
    const next = typeof value === 'string' ? value.trim() : DEFAULT;
    if (renamed && next !== replacement) {
      // Re-evaluate from the page's own title.
      document.title = MATCH;
    }
    replacement = next;
    apply();
  };

  chrome.storage.local.get('last').then(({ last }) => load(last), () => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.last) load(changes.last.newValue);
  });

  // Watch the <title> (and its replacement) so the rename survives the app
  // updating its title as you move between screens.
  const watch = () => {
    const head = document.head;
    if (!head) return;
    const observer = new MutationObserver(apply);
    observer.observe(head, { childList: true, subtree: true, characterData: true });
    apply();
  };
  if (document.head) watch();
  else document.addEventListener('DOMContentLoaded', watch, { once: true });
})();
