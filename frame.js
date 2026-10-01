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
  const BG_LABEL = { light: 'Light grey', white: 'White', dark: 'Dark' };
  const FRAME_LABEL = { black: 'Black', silver: 'Silver', white: 'White', blue: 'Blue' };
  const FRAME_SWATCH = { black: '#202124', silver: '#c9ccd1', white: '#ffffff', blue: '#2f5597' };
  const t = THEMES[L.background] ?? THEMES.light;

  // Line icons; stroke follows the control bar's text colour.
  const svg = (size, body) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const WIFI = '<path d="M1.8 6.2a9 9 0 0 1 12.4 0"/><path d="M4.2 8.8a5.5 5.5 0 0 1 7.6 0"/><circle cx="8" cy="11.9" r="1.2" fill="currentColor" stroke="none"/>';
  const ICON = {
    wifi: svg(16, WIFI),
    wifiOff: svg(16, `${WIFI}<path d="M2.5 13.5l11-11"/>`),
    eyeOff: svg(16, '<path d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2.2"/><path d="M2.5 13.5l11-11"/>'),
    camera: svg(16, '<path d="M1.8 5.2h2.6l1.3-1.9h4.6l1.3 1.9h2.6v7.5H1.8z"/><circle cx="8" cy="8.7" r="2.4"/>'),
    sliders: svg(16, '<path d="M2 4.5h7M12.2 4.5H14M2 11.5h1.8M7.2 11.5H14"/><circle cx="10.6" cy="4.5" r="1.6"/><circle cx="5.5" cy="11.5" r="1.6"/>'),
    trash: svg(16, '<path d="M2.5 4.5h11M6 4.5V2.8h4v1.7M4 4.5l.7 8.7h6.6l.7-8.7"/>'),
    expand: svg(11, '<path d="M4 6l4 4 4-4"/>'),
    record: svg(16, '<circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="3.6" fill="#d93025" stroke="none"/>'),
    stop: svg(16, '<rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" stroke="none"/>'),
  };
  const c = L.content;

  // Fingertip cursor over the app while tap indicators are on.
  const fingertip = encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='14' cy='14' r='10' fill='rgba(0,0,0,0.28)' stroke='white' stroke-width='2'/></svg>");

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
    }
    ${L.touch ? `body, body * { cursor: url("data:image/svg+xml,${fingertip}") 14 14, pointer !important; }` : ''}`;

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
  const option = (d) => `<option value="${d.key}"${d.key === L.deviceKey ? ' selected' : ''}>${d.name}</option>`;
  const saved = L.devices.filter((d) => d.group === 'saved');
  const options = [
    ...L.devices.filter((d) => !d.group).map(option),
    saved.length ? `<optgroup label="Saved">${saved.map(option).join('')}</optgroup>` : '',
    ...L.devices.filter((d) => d.group === 'custom').map(option),
  ].join('');
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
      .bar[hidden] { display: none; }
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
      button:disabled { opacity: .45; cursor: default; }
      button.danger { background: #d93025; border-color: #d93025; color: #fff; }
      .row { display: contents; }
      .row[hidden] { display: none; }
      label { white-space: nowrap; }
      input[type=number], input[type=text] {
        font: inherit; color: inherit; height: 28px; width: 72px; min-width: 0; flex: 1;
        box-sizing: border-box; padding: 0 6px;
        background: ${t.ctl}; border: 1px solid ${t.ctlBorder}; border-radius: 4px;
      }
      input:invalid { border-color: #d93025; }
      button.primary { background: #1a73e8; border-color: #1a73e8; color: #fff; }
      .toast {
        position: absolute; right: 8px; top: ${L.bar + 6}px; padding: 4px 10px;
        background: #202124; color: #fff; border-radius: 4px; font: 12px system-ui, sans-serif;
        opacity: 0; transition: opacity .2s; pointer-events: none;
      }
      .toast.show { opacity: .92; }
      .handle {
        position: absolute; left: 50%; top: 0; transform: translateX(-50%);
        width: 52px; height: 13px; padding: 0; box-sizing: border-box;
        display: flex; align-items: center; justify-content: center;
        background: ${t.ctl}; color: ${t.text}; font-size: 10px; line-height: 1;
        border: 1px solid ${t.ctlBorder}; border-top: none; border-radius: 0 0 8px 8px;
        opacity: 0; transition: opacity .2s; cursor: pointer; pointer-events: auto;
      }
      .handle.near, .handle:hover { opacity: .9; }
      .pop {
        position: absolute; right: 8px; top: ${L.bar + 4}px; width: 252px;
        box-sizing: border-box; padding: 10px 12px 12px;
        background: ${t.bar}; color: ${t.text}; border: 1px solid ${t.barBorder}; border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, .25);
        font: 12px system-ui, sans-serif; pointer-events: auto;
      }
      .pop[hidden] { display: none; }
      .pop .lbl { margin: 8px 0 4px; font-weight: 600; }
      .pop .lbl:first-child { margin-top: 0; }
      .pop .note { font-weight: 400; opacity: .7; }
      .seg { display: flex; flex-wrap: wrap; gap: 4px; }
      .seg button { height: 26px; padding: 0 8px; font-size: 12px; gap: 5px; }
      .seg button.sel { border-color: #1a73e8; box-shadow: inset 0 0 0 1px #1a73e8; }
      .sw { width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, .35); }
      .chk { display: flex; align-items: center; gap: 6px; margin-top: 10px; cursor: pointer; }
      .ripple {
        position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
        background: rgba(0, 0, 0, .22); border: 2px solid rgba(255, 255, 255, .9);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, .25); box-sizing: border-box; pointer-events: none;
        animation: df-tap .5s ease-out forwards;
      }
      button.rec-on { background: #d93025; border-color: #d93025; color: #fff; gap: 6px; font-variant-numeric: tabular-nums; }
      .count {
        position: absolute; left: ${L.screen.x}px; top: ${L.screen.y}px; width: ${L.screen.w}px; height: ${L.screen.h}px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0, 0, 0, .35); color: #fff; font: 700 120px system-ui, sans-serif;
        text-shadow: 0 2px 12px rgba(0, 0, 0, .5); pointer-events: none;
      }
      .count[hidden] { display: none; }
      @keyframes df-tap { from { transform: scale(.45); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
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
    <div id="ripples"></div>
    <div class="bar"${L.toolbarHidden ? ' hidden' : ''}>
      <div class="row" id="main">
      <select id="device" title="Device">${options}</select>
      ${L.deviceKey === 'custom' ? '<button id="edit" title="Change custom size">&#x270E;</button>' : ''}
      ${L.preset ? `<button id="delpreset" title="Delete saved device &quot;${L.preset.name}&quot;">${ICON.trash}</button>` : ''}
      <button id="rotate" title="Rotate to ${rotateTo}">&#x27F2;</button>
      <button id="status" title="${L.statusBar ? 'Hide' : 'Show'} status bar">${L.statusBar ? ICON.wifi : ICON.wifiOff}</button>
      <button id="appearance" title="Appearance: background, frame colour, tap indicator">${ICON.sliders}</button>
      <button id="reload" title="Reload page">&#x27F3;</button>
      <button id="rec">${ICON.record}</button>
      <button id="shot" title="Screenshot of the device: copy to clipboard and save PNG${L.copyShortcut ? ` (${L.copyShortcut} copies only)` : ''}">${ICON.camera}</button>
      <button id="hide" title="Hide toolbar (or double-click the frame${L.shortcut ? `, or ${L.shortcut}` : ''})">${ICON.eyeOff}</button>
      </div>
      <form class="row" id="editor" hidden>
        <label for="w">Size</label>
        <input id="w" type="number" required min="${L.custom.min}" max="${L.custom.max}" step="1" value="${L.custom.width}" title="Width (${L.custom.min}-${L.custom.max})">
        <span>&#xD7;</span>
        <input id="h" type="number" required min="${L.custom.min}" max="${L.custom.max}" step="1" value="${L.custom.height}" title="Height (${L.custom.min}-${L.custom.max})">
        <button type="submit" class="primary" title="Apply custom size">Apply</button>
        <button type="button" id="savepreset" title="Save this size as a named device in the dropdown">Save&#x2026;</button>
        <button type="button" id="cancel" title="Cancel">&#x2715;</button>
      </form>
      <form class="row" id="namer" hidden>
        <input id="pname" type="text" required maxlength="${L.presetNameMax}" placeholder="Name, e.g. Zebra TC21" title="Name for this saved device">
        <button type="submit" class="primary" title="Save to the device dropdown">Save</button>
        <button type="button" id="ncancel" title="Back">&#x2715;</button>
      </form>
    </div>
    <div class="pop" id="pop" hidden>
      <div class="lbl">Background</div>
      <div class="seg">
        ${Object.keys(BG_LABEL).map((k) => `<button data-bg="${k}" class="${k === L.background ? 'sel' : ''}">${BG_LABEL[k]}</button>`).join('')}
      </div>
      <div class="lbl">Frame colour${L.frameColorFixed ? ' <span class="note">(fixed for this device)</span>' : ''}</div>
      <div class="seg">
        ${Object.keys(FRAME_LABEL).map((k) => `<button data-fc="${k}" class="${k === L.frameColor && !L.frameColorFixed ? 'sel' : ''}"${L.frameColorFixed ? ' disabled' : ''}><span class="sw" style="background:${FRAME_SWATCH[k]}"></span>${FRAME_LABEL[k]}</button>`).join('')}
      </div>
      <label class="chk"><input type="checkbox" id="touch"${L.touch ? ' checked' : ''}> Show taps (circle + fingertip cursor)</label>
    </div>
    <div class="count" id="count" hidden></div>
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
  const toastEl = root.getElementById('toast');
  const toast = (text, ms = 2500) => {
    window.__devframePendingToast = { text, until: Date.now() + ms };
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(window.__devframeToast);
    window.__devframeToast = setTimeout(() => toastEl.classList.remove('show'), ms);
  };
  // Re-show a message cut short by the redraw (e.g. after a recording ends).
  const pending = window.__devframePendingToast;
  if (pending && pending.until > Date.now() + 300) toast(pending.text, pending.until - Date.now());

  // Keep typing in our controls away from the app's own key handlers (e.g. scanner input).
  const bar = root.querySelector('.bar');
  const pop = root.getElementById('pop');
  for (const el of [bar, pop]) {
    for (const type of ['keydown', 'keyup', 'keypress']) el.addEventListener(type, (e) => e.stopPropagation());
  }

  // Bar rows: main controls, custom size editor, and preset name entry.
  const main = root.getElementById('main');
  const editor = root.getElementById('editor');
  const namer = root.getElementById('namer');
  const select = root.getElementById('device');
  const showRow = (row) => {
    for (const r of [main, editor, namer]) r.hidden = r !== row;
  };
  const openEditor = () => {
    showRow(editor);
    root.getElementById('w').select();
  };
  const closeEditor = () => {
    showRow(main);
    select.value = L.deviceKey;
  };
  const customSize = () => ({ width: root.getElementById('w').value, height: root.getElementById('h').value });
  editor.addEventListener('submit', (e) => {
    e.preventDefault();
    send({ type: 'set-custom', size: customSize() });
  });
  editor.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEditor(); });
  root.getElementById('cancel').addEventListener('click', closeEditor);
  root.getElementById('edit')?.addEventListener('click', openEditor);
  root.getElementById('savepreset').addEventListener('click', () => {
    if (!editor.reportValidity()) return;
    showRow(namer);
    root.getElementById('pname').focus();
  });
  namer.addEventListener('submit', (e) => {
    e.preventDefault();
    send({ type: 'save-preset', name: root.getElementById('pname').value, size: customSize() });
  });
  namer.addEventListener('keydown', (e) => { if (e.key === 'Escape') openEditor(); });
  root.getElementById('ncancel').addEventListener('click', openEditor);

  // Deleting a saved device takes two clicks.
  const del = root.getElementById('delpreset');
  del?.addEventListener('click', () => {
    if (del.classList.contains('danger')) {
      send({ type: 'delete-preset', id: L.preset.id });
      return;
    }
    del.classList.add('danger');
    toast('Click again to delete this saved device');
    setTimeout(() => del.classList.remove('danger'), 3000);
  });

  select.addEventListener('change', (e) => {
    if (e.target.value === 'custom') openEditor();
    else send({ type: 'set-device', device: e.target.value });
  });
  root.getElementById('rotate').addEventListener('click', () => send({ type: 'rotate' }));
  root.getElementById('status').addEventListener('click', () => send({ type: 'set-pref', prefs: { statusBar: !L.statusBar } }));
  root.getElementById('reload').addEventListener('click', () => location.reload());

  // Appearance panel. It stays open across the redraw a setting change causes.
  const setPop = (open) => {
    pop.hidden = !open;
    window.__devframePopOpen = open;
  };
  setPop(Boolean(window.__devframePopOpen) && !L.toolbarHidden);
  root.getElementById('appearance').addEventListener('click', () => setPop(pop.hidden));
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPop(false); });
  pop.querySelectorAll('[data-bg]').forEach((b) => b.addEventListener('click', () => send({ type: 'set-pref', prefs: { background: b.dataset.bg } })));
  pop.querySelectorAll('[data-fc]').forEach((b) => b.addEventListener('click', () => send({ type: 'set-pref', prefs: { frameColor: b.dataset.fc } })));
  root.getElementById('touch').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { touch: e.target.checked } }));

  // Toolbar show/hide: hide button, handle tab (fades in near the top edge),
  // and double-click on the frame.
  const toggleToolbar = () => send({ type: 'toggle-toolbar' });
  root.getElementById('hide').addEventListener('click', toggleToolbar);
  const handle = root.getElementById('handle');
  handle?.addEventListener('click', toggleToolbar);

  // Page-level listeners are replaced on every redraw.
  const ripples = root.getElementById('ripples');
  const listeners = {
    mousemove: (e) => handle?.classList.toggle('near', e.clientY < 28),
    // Only the frame itself: the app lives inside <body>, while the bezel,
    // margin and status bar areas hit <html>.
    dblclick: (e) => { if (e.target === document.documentElement && !window.__devframeRec) toggleToolbar(); },
    // Clicks outside our overlay close the appearance panel (clicks inside the
    // shadow DOM are retargeted to the host).
    click: (e) => { if (e.target !== host && !pop.hidden) setPop(false); },
    // Tap indicator: a fading circle wherever the app is pressed. Capture
    // phase so the app can't swallow it.
    pointerdown: (e) => {
      if (!L.touch || !document.body.contains(e.target)) return;
      const dot = document.createElement('div');
      dot.className = 'ripple';
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      dot.addEventListener('animationend', () => dot.remove());
      ripples.appendChild(dot);
    },
  };
  for (const [type, fn] of Object.entries(window.__devframeListeners ?? {})) document.removeEventListener(type, fn, true);
  for (const [type, fn] of Object.entries(listeners)) document.addEventListener(type, fn, true);
  window.__devframeListeners = listeners;

  // Re-fit the window when its size drifts from the layout (e.g. Chrome's
  // "sharing this tab" bar appears, or the user drags the window edge).
  window.removeEventListener('resize', window.__devframeResize);
  window.__devframeResize = () => {
    clearTimeout(window.__devframeResizeTimer);
    window.__devframeResizeTimer = setTimeout(() => {
      if (Math.abs(window.innerWidth - L.W) <= 2 && Math.abs(window.innerHeight - L.H) <= 2) return;
      send({
        type: 'refit',
        metrics: {
          innerWidth: window.innerWidth, innerHeight: window.innerHeight,
          outerWidth: window.outerWidth, outerHeight: window.outerHeight,
          availWidth: screen.availWidth, availHeight: screen.availHeight,
          availLeft: screen.availLeft ?? 0, availTop: screen.availTop ?? 0,
        },
      });
    }, 250);
  };
  window.addEventListener('resize', window.__devframeResize);
  document.documentElement.removeEventListener('mouseleave', window.__devframeLeave);
  window.__devframeLeave = () => handle?.classList.remove('near');
  document.documentElement.addEventListener('mouseleave', window.__devframeLeave);

  // ---- Recording ---------------------------------------------------------
  // Chrome's tab-share prompt (preferCurrentTab) gives a stream of this tab;
  // after a 3-2-1 countdown each frame is cropped to the device on a canvas,
  // and the canvas is recorded to MP4. State lives on window so it survives
  // a redraw; the background blocks redraw-causing controls meanwhile.
  const recBtn = root.getElementById('rec');
  const lockIds = ['device', 'edit', 'delpreset', 'rotate', 'status', 'appearance', 'reload', 'hide'];
  const showRecording = () => {
    const rec = window.__devframeRec;
    for (const id of lockIds) {
      const el = root.getElementById(id);
      if (el) el.disabled = Boolean(rec);
    }
    if (rec) setPop(false);
    recBtn.classList.toggle('rec-on', Boolean(rec?.recorder));
    recBtn.title = rec
      ? `Stop recording and save MP4${L.recordShortcut ? ` (or ${L.recordShortcut})` : ''}`
      : `Record the device to MP4${L.recordShortcut ? ` (${L.recordShortcut} starts without Chrome's share prompt)` : ''}`;
    if (!rec?.recorder) {
      recBtn.innerHTML = rec ? ICON.stop : ICON.record;
      return;
    }
    const secs = Math.floor((Date.now() - rec.started) / 1000);
    recBtn.innerHTML = `${ICON.stop}<span>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</span>`;
  };
  clearInterval(window.__devframeRecTick);
  window.__devframeRecTick = setInterval(() => { if (window.__devframeRec?.recorder) showRecording(); }, 500);
  showRecording();

  const stopRecording = (reason = 'stopped') => {
    const rec = window.__devframeRec;
    if (!rec || rec.stopping) return;
    rec.stopping = true;
    rec.reason = rec.reason || reason;
    clearInterval(rec.countdown);
    if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
    else finishRecording(rec, null);
  };

  const finishRecording = (rec, blob) => {
    clearInterval(rec.drawTimer);
    rec.stream.getTracks().forEach((track) => track.stop());
    root.getElementById('count').hidden = true;
    window.__devframeRec = null;
    if (blob && blob.size) {
      const ext = rec.mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const name = `${L.deviceName.replace(/[^\w.-]+/g, '-')}-${L.screen.w}x${L.screen.h}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `device-frame-${name}-${stamp}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      if (rec.error) toast(`Recording stopped early (${rec.error}); saved what was recorded`, 8000);
      else toast(ext === 'mp4' ? 'Recording saved to Downloads' : 'Recording saved as WebM (MP4 not supported by this Chrome)');
    } else if (rec.recorder) {
      // Started but nothing usable was recorded: say why.
      const why = rec.error || rec.reason || 'unknown reason';
      console.warn('Device Frame: recording produced no video:', why, rec);
      toast(`Recording failed: ${why}`, 8000);
    }
    send({ type: 'rec-state', recording: false }); // background redraws the controls
  };

  // streamId comes from chrome.tabCapture (the keyboard shortcut), which needs
  // no prompt; without it we ask Chrome via its "Share this tab" prompt.
  const startRecording = async (streamId) => {
    let stream;
    try {
      stream = streamId
        ? await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId,
              maxFrameRate: 30,
              minWidth: Math.round(window.innerWidth * devicePixelRatio),
              maxWidth: Math.round(window.innerWidth * devicePixelRatio),
              minHeight: Math.round(window.innerHeight * devicePixelRatio),
              maxHeight: Math.round(window.innerHeight * devicePixelRatio),
            },
          },
        })
        : await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: false,
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
          surfaceSwitching: 'exclude',
        });
    } catch (e) {
      toast(e.name === 'NotAllowedError' && !streamId ? 'Recording cancelled' : `Can't record: ${e.message || e.name}`);
      console.warn('Device Frame: recording failed to start', e);
      return;
    }
    const mime = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type));
    const rec = { stream, mime };
    window.__devframeRec = rec;
    send({ type: 'rec-state', recording: true });
    showRecording();
    stream.getVideoTracks()[0].addEventListener('ended', () => stopRecording('the tab capture ended')); // e.g. Chrome's "Stop sharing"

    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    // Don't hang if playback never starts; give up after 3 s.
    const playing = await Promise.race([
      video.play().then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);
    if (!playing || !video.videoWidth) {
      toast("Can't record: the tab capture didn't start");
      rec.stopping = true;
      return finishRecording(rec, null);
    }

    // Countdown, then record. The overlay is gone before the first frame.
    const count = root.getElementById('count');
    let n = 3;
    count.textContent = n;
    count.hidden = false;
    await new Promise((resolve) => {
      rec.countdown = setInterval(() => {
        n -= 1;
        if (n > 0) { count.textContent = n; return; }
        clearInterval(rec.countdown);
        count.hidden = true;
        resolve();
      }, 1000);
    });
    if (rec.stopping) return finishRecording(rec, null);
    await new Promise((resolve) => setTimeout(resolve, 100)); // let the overlay disappear from the stream

    // Crop: the device plus a little room for its side buttons, in CSS px,
    // mapped to video pixels (video width / viewport width covers zoom + DPR).
    const pad = 8;
    const crop = { x: L.phone.x - pad, y: L.phone.y - pad, w: L.phone.w + pad * 2, h: L.phone.h + pad * 2 };
    const scale0 = video.videoWidth / window.innerWidth;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(crop.w * scale0 / 2) * 2; // even sizes for H.264
    canvas.height = Math.round(crop.h * scale0 / 2) * 2;
    const ctx = canvas.getContext('2d');
    // A timer rather than requestAnimationFrame, which pauses whenever the
    // window isn't painting (e.g. covered by another window).
    const draw = () => {
      const scale = video.videoWidth / window.innerWidth;
      ctx.drawImage(video, crop.x * scale, crop.y * scale, crop.w * scale, crop.h * scale, 0, 0, canvas.width, canvas.height);
    };
    draw();
    rec.drawTimer = setInterval(draw, 1000 / 30);

    const chunks = [];
    rec.recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    rec.recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.recorder.onstop = () => finishRecording(rec, new Blob(chunks, { type: mime.split(';')[0] }));
    rec.recorder.onerror = (e) => {
      rec.error = `${e.error?.name || 'error'}: ${e.error?.message || 'the recorder stopped'}`;
      console.warn('Device Frame: recorder error', e.error);
    };
    try {
      rec.recorder.start(1000);
    } catch (e) {
      rec.error = `${e.name}: ${e.message}`;
      rec.stopping = true;
      return finishRecording(rec, null);
    }
    rec.started = Date.now();
    showRecording();
  };

  recBtn.addEventListener('click', () => {
    if (window.__devframeRec) stopRecording('stopped with the button');
    else startRecording();
  });

  // Messages from the background (record shortcut). One listener for the
  // page's lifetime, forwarding to the latest drawFrame's handlers.
  window.__devframeOnMessage = (msg) => {
    if (msg?.type === 'df-record-start' && !window.__devframeRec) startRecording(msg.streamId);
    if (msg?.type === 'df-record-stop') stopRecording('stopped with the shortcut');
  };
  if (!window.__devframeMessageBound) {
    chrome.runtime.onMessage.addListener((msg) => { window.__devframeOnMessage?.(msg); });
    window.__devframeMessageBound = true;
  }

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
