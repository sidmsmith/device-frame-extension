// Device Frame - title renames (content script, document_start, top frame).
//
// prefs.titleRules (edited in the frame's settings panel) holds one rename
// per line, "Old title = New title" (default "MUP = WM Mobile"). Whole-title
// match ignoring case; a trailing * on the old title means "starts with".
// First match wins. Blank lines and lines starting with # are ignored.
// Applies to the tab / window title everywhere, including frame windows.
// Re-applies whenever the page changes its title, and restores the page's
// own title when no rule applies any more.

(() => {
  const DEFAULT_RULES = 'MUP = WM Mobile';
  let rules = [];
  let own = null; // the page's own (latest) title
  let shown = null; // the title we set, if any

  const parseRules = (text) => text.split(/\r?\n/).flatMap((raw) => {
    const line = raw.trim();
    const eq = line.indexOf('=');
    if (!line || line.startsWith('#') || eq < 1) return [];
    let from = line.slice(0, eq).trim().toLowerCase();
    const to = line.slice(eq + 1).trim();
    const prefix = from.endsWith('*');
    if (prefix) from = from.slice(0, -1).trim();
    return from && to ? [{ from, to, prefix }] : [];
  });

  // The title to show for the page's own title, or null to leave it alone.
  const target = (title) => {
    const t = (title ?? '').trim().toLowerCase();
    const rule = rules.find((r) => (r.prefix ? t.startsWith(r.from) : t === r.from));
    return rule ? rule.to : null;
  };

  const show = (title) => {
    if (document.title !== title) document.title = title;
  };

  // Called when the page's title may have changed.
  const apply = () => {
    const current = document.title;
    if (shown !== null && current === shown) return; // our own change
    own = current;
    const want = target(own);
    shown = want && want !== own ? want : null;
    if (shown !== null) show(shown);
  };

  // Re-evaluate after the rules change.
  const refresh = () => {
    if (shown === null) return apply();
    const want = target(own);
    shown = want && want !== own ? want : null;
    show(shown ?? own ?? '');
  };

  const load = (last) => {
    rules = parseRules(typeof last?.titleRules === 'string' ? last.titleRules : DEFAULT_RULES);
    refresh();
  };

  chrome.storage.local.get('last').then(({ last }) => load(last), () => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.last) load(changes.last.newValue);
  });

  // Watch the <title> (and its replacement) so renames survive the app
  // updating its title as you move between screens.
  const watch = () => {
    if (!document.head) return;
    new MutationObserver(apply).observe(document.head, { childList: true, subtree: true, characterData: true });
    apply();
  };
  if (document.head) watch();
  else document.addEventListener('DOMContentLoaded', watch, { once: true });
})();
