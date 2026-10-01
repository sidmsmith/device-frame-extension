// Injected into the framed page (isolated world) via chrome.scripting.
// Must be self-contained: executeScript serialises the function, so it cannot
// reference anything outside its own body. Safe to call repeatedly; each call
// replaces the previous frame (used for device switch / rotate / settings).

function drawFrame(L) {
  const rr = ({ x, y, w, h, r }) =>
    `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}` +
    `h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;

  const THEMES = {
    light: { page: '#e4e6ea', bar: '#f6f7f9', barBorder: '#cfd2d7', text: '#202124', ctl: '#ffffff', ctlBorder: '#c4c7cc', ctlHover: '#eceef1', shadow: 0.35 },
    white: { page: '#ffffff', bar: '#f6f7f9', barBorder: '#dadce0', text: '#202124', ctl: '#ffffff', ctlBorder: '#c4c7cc', ctlHover: '#eceef1', shadow: 0.3 },
    dark: { page: '#2b2d33', bar: '#1e1f23', barBorder: '#000000', text: '#e6e6e6', ctl: '#3a3c44', ctlBorder: '#50535c', ctlHover: '#474a53', shadow: 0.6 },
  };
  const NEXT_BG = { light: 'white', white: 'dark', dark: 'light' };
  const BG_LABEL = { light: 'Light grey', white: 'White', dark: 'Dark' };
  const t = THEMES[L.background] ?? THEMES.light;

  // Line icons; stroke follows the control bar's text colour.
  const svg = (size, body) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const ICON = {
    wifi: svg(16, '<path d="M1.8 6.2a9 9 0 0 1 12.4 0"/><path d="M4.2 8.8a5.5 5.5 0 0 1 7.6 0"/><circle cx="8" cy="11.9" r="1.2" fill="currentColor" stroke="none"/>'),
    wifiOff: svg(16, '<path d="M1.8 6.2a9 9 0 0 1 12.4 0"/><path d="M4.2 8.8a5.5 5.5 0 0 1 7.6 0"/><circle cx="8" cy="11.9" r="1.2" fill="currentColor" stroke="none"/><path d="M2.5 13.5l11-11"/>'),
    eyeOff: svg(16, '<path d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2.2"/><path d="M2.5 13.5l11-11"/>'),
    camera: svg(16, '<path d="M1.8 5.2h2.6l1.3-1.9h4.6l1.3 1.9h2.6v7.5H1.8z"/><circle cx="8" cy="8.7" r="2.4"/>'),
    expand: svg(11, '<path d="M4 6l4 4 4-4"/>'),
  };
  const c = L.content;

  // Page-level style: pin <body> into the screen area. The transform makes
  // <body> the containing block for position:fixed app shells.
  let style = document.getElementById('__devframe-style');
  if (!style) {
    style = document.createElement('style');
    style.id = '__devframe-style';
    document.documentElement.appendChild(style);
  }
  style.textContent = `
    html { background: ${t.page} !important; overflow: hidden !important; }
    body {
      position: fixed !important;
      left: ${c.x}px !important; top: ${c.y}px !important;
      width: ${c.w}px !important; height: ${c.h}px !important;
      min-width: 0 !important; min-height: 0 !important;
      max-width: none !important; max-height: none !important;
      margin: 0 !important;
      overflow: auto !important;
      transform: translateZ(0) !important;
      background-color: #fff;
    }
    #__devframe {
      position: fixed !important; left: 0 !important; top: 0 !important;
      width: ${L.W}px !important; height: ${L.H}px !important;
      pointer-events: none !important; z-index: 2147483647 !important;
      display: block !important;
    }`;

  document.getElementById('__devframe')?.remove();
  clearInterval(window.__devframeClock);
  const host = document.createElement('div');
  host.id = '__devframe';
  // Appended to <html>, not <body>, so the app never re-renders it away;
  // shadow DOM keeps the page's CSS off our controls.
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  const phonePath = rr(L.phone);
  const outside = `M0,0H${L.W}V${L.H}H0z ${phonePath}`;
  const options = L.devices
    .map((d) => `<option value="${d.key}"${d.key === L.deviceKey ? ' selected' : ''}>${d.name}</option>`)
    .join('');
  const rotateTo = L.orientation === 'portrait' ? 'landscape' : 'portrait';

  // Android-style status bar: clock on the left; signal, wifi, battery on the right.
  let statusBar = '';
  if (L.statusBar) {
    const sb = L.statusBar;
    const cy = sb.y + sb.h / 2;
    const pad = Math.max(16, L.screen.r * 0.6); // clear the rounded corners
    const rx = sb.x + sb.w - pad;
    statusBar = `
      <rect x="${sb.x}" y="${sb.y}" width="${sb.w}" height="${sb.h}" fill="#000"/>
      <text id="clock" x="${sb.x + pad}" y="${cy}" dominant-baseline="central"
            font-family="Roboto, system-ui, sans-serif" font-size="12" font-weight="500" fill="#fff"></text>
      <g fill="#fff">
        <rect x="${rx - 18}" y="${cy - 5}" width="16" height="10" rx="2" fill="none" stroke="#fff" stroke-width="1.2"/>
        <rect x="${rx - 2}" y="${cy - 2}" width="2" height="4" rx="1"/>
        <rect x="${rx - 16.5}" y="${cy - 3.5}" width="10" height="7" rx="1"/>
        <path d="M${rx - 38},${cy - 2} a10,10 0 0 1 14,0 l-7,8z"/>
        <path d="M${rx - 58},${cy + 5} l11,-11 v11z"/>
      </g>`;
  }

  let decor = '';
  if (L.decor) {
    const D = L.decor;
    const shape = (p) => p.type === 'text'
      ? `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="600" font-size="${p.size}" fill="${p.fill}">${p.text}</text>`
      : `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx ?? 0}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}"` : ''}/>`;
    decor = `
      <g clip-path="url(#phoneclip)" fill="${D.bumperColor}">
        ${D.bumpers.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>`).join('')}
      </g>
      <g transform="${D.transform}">${D.shapes.map(shape).join('')}</g>`;
  }

  root.innerHTML = `
    <style>
      :host { all: initial; }
      svg.frame { position: absolute; left: 0; top: 0; }
      .bar {
        position: absolute; left: 0; top: 0; right: 0; height: ${L.bar}px;
        display: flex; align-items: center; gap: 6px; padding: 0 8px;
        box-sizing: border-box;
        background: ${t.bar}; border-bottom: 1px solid ${t.barBorder};
        font: 13px system-ui, sans-serif; color: ${t.text};
        pointer-events: auto;
      }
      select, button {
        font: inherit; color: inherit; height: 28px;
        background: ${t.ctl}; border: 1px solid ${t.ctlBorder}; border-radius: 4px;
        cursor: pointer;
      }
      select { flex: 1; min-width: 0; padding: 0 4px; }
      button {
        min-width: 32px; padding: 0 8px; white-space: nowrap;
        display: inline-flex; align-items: center; justify-content: center;
      }
      button svg, .handle svg { display: block; margin: auto; }
      button:hover, select:hover { background: ${t.ctlHover}; }
      .row { display: contents; }
      .row[hidden] { display: none; }
      label { white-space: nowrap; }
      input {
        font: inherit; color: inherit; height: 28px; width: 72px; min-width: 0; flex: 1;
        box-sizing: border-box; padding: 0 6px;
        background: ${t.ctl}; border: 1px solid ${t.ctlBorder}; border-radius: 4px;
      }
      input:invalid { border-color: #d93025; }
      button.primary { background: #1a73e8; border-color: #1a73e8; color: #fff; }
      .toast {
        position: absolute; right: 8px; top: ${L.bar + 6}px; padding: 4px 10px;
        background: #202124; color: #fff; border-radius: 4px; font-size: 12px;
        opacity: 0; transition: opacity .2s; pointer-events: none;
      }
      .toast.show { opacity: .92; }
      .bar[hidden] { display: none; }
      .handle {
        position: absolute; left: 50%; top: 0; transform: translateX(-50%);
        width: 52px; height: 13px; padding: 0; box-sizing: border-box;
        display: flex; align-items: center; justify-content: center;
        background: ${t.ctl}; color: ${t.text}; font-size: 10px; line-height: 1;
        border: 1px solid ${t.ctlBorder}; border-top: none; border-radius: 0 0 8px 8px;
        opacity: 0; transition: opacity .2s; cursor: pointer; pointer-events: auto;
      }
      .handle.near, .handle:hover { opacity: .9; }
    </style>
    <svg class="frame" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${L.colors[0]}"/><stop offset=".6" stop-color="${L.colors[1]}"/>
        </linearGradient>
        <radialGradient id="cam" cx=".35" cy=".35" r=".6">
          <stop offset="0" stop-color="#3a4a6a"/><stop offset="1" stop-color="#05070c"/>
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="${t.shadow}"/>
        </filter>
        <clipPath id="outside"><path clip-rule="evenodd" d="${outside}"/></clipPath>
        <clipPath id="phoneclip"><path d="${phonePath}"/></clipPath>
      </defs>
      ${statusBar}
      <path fill="${t.page}" fill-rule="evenodd" d="${outside}"/>
      <path fill="#000" d="${phonePath}" filter="url(#shadow)" clip-path="url(#outside)"/>
      <path fill="url(#body)" fill-rule="evenodd" d="${phonePath} ${rr(L.screen)}"/>
      ${decor}
      <path fill="none" stroke="#55575d" stroke-width="2" d="${phonePath}"/>
      <circle cx="${L.camera.cx}" cy="${L.camera.cy}" r="${L.camera.r}" fill="url(#cam)"/>
      ${L.buttons.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2" fill="${b.color}"/>`).join('')}
    </svg>
    <div class="bar"${L.toolbarHidden ? ' hidden' : ''}>
      <div class="row" id="main">
      <select id="device" title="Device">${options}</select>
      ${L.deviceKey === 'custom' ? '<button id="edit" title="Change custom size">&#x270E;</button>' : ''}
      <button id="rotate" title="Rotate to ${rotateTo}">&#x27F2;</button>
      <button id="status" title="${L.statusBar ? 'Hide' : 'Show'} status bar">${L.statusBar ? ICON.wifi : ICON.wifiOff}</button>
      <button id="background" title="Background: ${BG_LABEL[L.background]} (click for ${BG_LABEL[NEXT_BG[L.background]]})">&#x25D0;</button>
      <button id="reload" title="Reload page">&#x27F3;</button>
      <button id="shot" title="Screenshot of the device: copy to clipboard and save PNG${L.copyShortcut ? ` (${L.copyShortcut} copies only)` : ''}">${ICON.camera}</button>
      <button id="hide" title="Hide toolbar (or double-click the frame${L.shortcut ? `, or ${L.shortcut}` : ''})">${ICON.eyeOff}</button>
      </div>
      <form class="row" id="editor" hidden>
        <label for="w">Size</label>
        <input id="w" type="number" required min="${L.custom.min}" max="${L.custom.max}" step="1" value="${L.custom.width}" title="Width (${L.custom.min}-${L.custom.max})">
        <span>&#xD7;</span>
        <input id="h" type="number" required min="${L.custom.min}" max="${L.custom.max}" step="1" value="${L.custom.height}" title="Height (${L.custom.min}-${L.custom.max})">
        <button type="submit" class="primary" title="Apply custom size">Apply</button>
        <button type="button" id="cancel" title="Cancel">&#x2715;</button>
      </form>
    </div>
    <div class="toast" id="toast"></div>
    ${L.toolbarHidden ? `<div class="handle" id="handle" title="Show toolbar${L.shortcut ? ` (${L.shortcut})` : ''}">${ICON.expand}</div>` : ''}`;

  const clock = root.getElementById('clock');
  if (clock) {
    const tick = () => {
      clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    };
    tick();
    window.__devframeClock = setInterval(tick, 10000);
  }

  const send = (msg) => chrome.runtime.sendMessage(msg);

  // Keep typing in our controls away from the app's own key handlers (e.g. scanner input).
  const bar = root.querySelector('.bar');
  for (const type of ['keydown', 'keyup', 'keypress']) bar.addEventListener(type, (e) => e.stopPropagation());

  // Custom size editor: replaces the main row until applied or cancelled.
  const main = root.getElementById('main');
  const editor = root.getElementById('editor');
  const select = root.getElementById('device');
  const openEditor = () => {
    main.hidden = true;
    editor.hidden = false;
    root.getElementById('w').select();
  };
  const closeEditor = () => {
    editor.hidden = true;
    main.hidden = false;
    select.value = L.deviceKey;
  };
  editor.addEventListener('submit', (e) => {
    e.preventDefault();
    send({ type: 'set-custom', size: { width: root.getElementById('w').value, height: root.getElementById('h').value } });
  });
  editor.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEditor(); });
  root.getElementById('cancel').addEventListener('click', closeEditor);
  root.getElementById('edit')?.addEventListener('click', openEditor);

  select.addEventListener('change', (e) => {
    if (e.target.value === 'custom') openEditor();
    else send({ type: 'set-device', device: e.target.value });
  });
  root.getElementById('rotate').addEventListener('click', () => send({ type: 'rotate' }));
  root.getElementById('status').addEventListener('click', () => send({ type: 'set-pref', prefs: { statusBar: !L.statusBar } }));
  root.getElementById('background').addEventListener('click', () => send({ type: 'set-pref', prefs: { background: NEXT_BG[L.background] } }));
  root.getElementById('reload').addEventListener('click', () => location.reload());
  // Toolbar show/hide: hide button, handle tab (fades in near the top edge),
  // and double-click on the frame. Listeners are replaced on every redraw.
  const toggleToolbar = () => send({ type: 'toggle-toolbar' });
  root.getElementById('hide').addEventListener('click', toggleToolbar);
  const handle = root.getElementById('handle');
  handle?.addEventListener('click', toggleToolbar);

  document.removeEventListener('mousemove', window.__devframeMove);
  document.documentElement.removeEventListener('mouseleave', window.__devframeLeave);
  document.removeEventListener('dblclick', window.__devframeDbl);
  window.__devframeMove = (e) => handle?.classList.toggle('near', e.clientY < 28);
  window.__devframeLeave = () => handle?.classList.remove('near');
  // Only the frame itself: the page's content lives inside <body>, while the
  // bezel, margin and status bar areas hit <html>.
  window.__devframeDbl = (e) => { if (e.target === document.documentElement) toggleToolbar(); };
  document.addEventListener('mousemove', window.__devframeMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', window.__devframeLeave);
  document.addEventListener('dblclick', window.__devframeDbl);

  const toastEl = root.getElementById('toast');
  const toast = (text) => {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(window.__devframeToast);
    window.__devframeToast = setTimeout(() => toastEl.classList.remove('show'), 2500);
  };
  root.getElementById('shot').addEventListener('click', () => {
    // The background captures, crops and downloads the PNG, then hands it back
    // so we can put it on the clipboard. ClipboardItem accepts a promise, which
    // keeps the click's user activation for the clipboard write.
    const png = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'screenshot' }, (res) => {
        if (!res?.dataUrl) return reject(new Error(res?.error || 'Screenshot failed'));
        const bytes = atob(res.dataUrl.split(',')[1]);
        const buf = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
        resolve(new Blob([buf], { type: 'image/png' }));
      });
    });
    navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      .then(() => toast('Copied to clipboard & saved to Downloads'))
      .catch(() => png.then(() => toast('Saved to Downloads (clipboard copy blocked)'), (e) => toast(e.message)));
  });

  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    availLeft: screen.availLeft ?? 0,
    availTop: screen.availTop ?? 0,
  };
}

// Injected for the copy-only screenshot shortcut: put the PNG on the
// clipboard and show the toast. No click here, so this relies on the frame
// window being focused (it is, since the shortcut was pressed in it).
async function copyImageToClipboard(dataUrl) {
  const bytes = atob(dataUrl.split(',')[1]);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  let message = 'Copied to clipboard';
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([buf], { type: 'image/png' }) })]);
  } catch (e) {
    message = `Clipboard copy blocked (${e.name})`;
  }
  const toastEl = document.getElementById('__devframe')?.shadowRoot?.getElementById('toast');
  if (toastEl) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(window.__devframeToast);
    window.__devframeToast = setTimeout(() => toastEl.classList.remove('show'), 2500);
  }
}
