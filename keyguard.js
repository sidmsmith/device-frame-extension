// Device Frame - key guard (content script, document_start, all pages).
//
// Chrome runs the extension's keyboard shortcuts but still delivers the key
// press to the page, so in the frame window e.g. Alt+Shift+V would type "V"
// into the app (MUP routes key presses into its scan/search field). Loading
// at document_start means this listener is registered before the app's own,
// so it can stop those exact combinations first. On every page it blocks the
// "open the frame" shortcut (Alt+Shift+F by default, pressed before a page is
// framed); the other shortcuts only once the background says the tab is framed.

(() => {
  let combos = []; // the shortcuts to block (all of ours once the tab is framed)
  const swallowed = new Set(); // keys whose keydown was blocked; block their keyup too

  const parse = (text) => {
    const parts = text.split('+');
    const key = parts.pop();
    return {
      alt: parts.includes('Alt'), shift: parts.includes('Shift'), ctrl: parts.includes('Ctrl'),
      // e.code is layout-independent (Alt+Shift can switch keyboard layouts on Windows).
      code: /^[A-Z]$/.test(key) ? `Key${key}` : /^[0-9]$/.test(key) ? `Digit${key}` : key,
    };
  };

  const block = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const onKey = (e) => {
    if (!combos.length) return;
    if (e.type === 'keyup' && swallowed.has(e.code)) {
      swallowed.delete(e.code);
      return block(e);
    }
    const hit = combos.some((k) => k.code === e.code && k.alt === e.altKey && k.shift === e.shiftKey && k.ctrl === e.ctrlKey);
    if (!hit) return;
    if (e.type === 'keydown') swallowed.add(e.code);
    block(e);
  };
  for (const type of ['keydown', 'keypress', 'keyup']) window.addEventListener(type, onKey, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'keyguard') combos = (msg.shortcuts ?? []).filter(Boolean).map(parse);
  });
  // The open-the-frame shortcut, on every page.
  chrome.runtime.sendMessage({ type: 'keyguard-open' })
    .then((res) => { if (res?.shortcut && !combos.length) combos = [parse(res.shortcut)]; })
    .catch(() => { /* extension reloaded: the page's next load picks it up */ });
})();
