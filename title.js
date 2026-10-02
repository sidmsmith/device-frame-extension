// Device Frame - title renames (content script, document_start, top frame).
//
// prefs.titleRules (edited in the frame's settings panel) holds one rename
// per line, "Old title = New title" (default "MUP = WM Mobile"). Whole-title
// match ignoring case; a trailing * on the old title means "starts with".
// First match wins. Blank lines and lines starting with # are ignored.
// Applies to the tab / window title everywhere, including frame windows.
// Re-applies whenever the page changes its title, and restores the page's
// own title when no rule applies any more.
// If a tab icon is set (storage key tabIcon, a PNG data URL), renamed tabs
// also show it instead of the page's own icon; with "Always display"
// (prefs.iconAlways) every page in a frame window shows it.

(() => {
  const DEFAULT_RULES = 'MUP = WM Mobile';
  let rules = [];
  let own = null; // the page's own (latest) title
  let shown = null; // the title we set, if any
  let icon = null; // tab icon data URL, or null for the page's own
  let iconAlways = false; // show the icon on every page in frame windows
  let framed = false; // set by the background for frame windows

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
    syncIcon();
  };

  // Our icon while the tab is renamed and an icon is set; otherwise the
  // page's own. The page's icon links are switched off (rel renamed), not
  // removed, so they can be restored. Idempotent: safe to call on every change.
  const OFF = 'x-devframe-off';
  const syncIcon = () => {
    const head = document.head;
    if (!head) return;
    const ours = head.querySelector('link#__devframe-icon');
    if (icon && (shown !== null || (framed && iconAlways))) {
      for (const link of head.querySelectorAll('link[rel~="icon"]:not(#__devframe-icon)')) {
        link.dataset.devframeRel = link.rel;
        link.rel = OFF;
      }
      if (!ours) {
        const link = document.createElement('link');
        link.id = '__devframe-icon';
        link.rel = 'icon';
        link.href = icon;
        head.appendChild(link);
      } else if (ours.href !== icon) {
        ours.href = icon;
      }
    } else {
      ours?.remove();
      for (const link of head.querySelectorAll(`link[rel="${OFF}"]`)) link.rel = link.dataset.devframeRel || 'icon';
    }
  };

  // Called when the page's title may have changed.
  const apply = () => {
    const current = document.title;
    if (shown !== null && current === shown) return syncIcon(); // our own change (or the app added an icon)
    own = current;
    const want = target(own);
    shown = want && want !== own ? want : null;
    if (shown !== null) show(shown);
    else syncIcon();
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
    iconAlways = Boolean(last?.iconAlways);
    refresh();
  };

  chrome.storage.local.get(['last', 'tabIcon']).then(({ last, tabIcon }) => {
    icon = tabIcon ?? null;
    load(last);
  }, () => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.tabIcon) {
      icon = changes.tabIcon.newValue ?? null;
      syncIcon();
    }
    if (changes.last) load(changes.last.newValue);
  });

  // The background sends this (with the shortcut list for keyguard.js) only
  // to tabs shown in a frame window.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'keyguard' && !framed) {
      framed = true;
      syncIcon();
    }
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
