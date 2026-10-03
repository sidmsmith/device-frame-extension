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
  // UI text in the chosen language (L.t, from _locales); $1, $2 are filled in.
  // E() is the HTML-escaped version for markup.
  const T = (key, ...subs) => (L.t?.[key] ?? key).replace(/\$(\d)/g, (m, n) => subs[n - 1] ?? m);
  const E = (key, ...subs) => T(key, ...subs).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const BG_LABEL = { light: E('bgLight'), white: E('bgWhite'), dark: E('bgDark') };
  const FRAME_LABEL = { black: E('fcBlack'), silver: E('fcSilver'), white: E('fcWhite'), blue: E('fcBlue'), manhattan: E('fcManhattan') };
  const FRAME_SWATCH = { black: '#202124', silver: '#c9ccd1', white: '#ffffff', blue: '#2f5597', manhattan: '#083332' };
  // Color chips (background, frame color): the whole chip is the color, with
  // dark or light text, whichever reads better on it.
  const chip = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const light = 0.299 * r + 0.587 * g + 0.114 * b > 150;
    return `background:${hex};color:${light ? '#202124' : '#ffffff'}`;
  };
  const t = THEMES[L.background] ?? THEMES.light;

  // Line icons; stroke follows the control bar's text color.
  const svg = (size, body) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const WIFI = '<path d="M1.8 6.2a9 9 0 0 1 12.4 0"/><path d="M4.2 8.8a5.5 5.5 0 0 1 7.6 0"/><circle cx="8" cy="11.9" r="1.2" fill="currentColor" stroke="none"/>';
  const ICON = {
    wifi: svg(16, WIFI),
    wifiOff: svg(16, `${WIFI}<path d="M2.5 13.5l11-11"/>`),
    eyeOff: svg(16, '<path d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2.2"/><path d="M2.5 13.5l11-11"/>'),
    camera: svg(16, '<path d="M1.8 5.2h2.6l1.3-1.9h4.6l1.3 1.9h2.6v7.5H1.8z"/><circle cx="8" cy="8.7" r="2.4"/>'),
    rotate: svg(16, '<rect x="6.1" y="4.1" width="3.8" height="7.8" rx="0.9" transform="rotate(45 8 8)"/><path d="M1.6 8.6A6.4 6.4 0 0 1 7.4 1.6M7.4 1.6l-1.5 1.3M7.4 1.6l-1.4-1.2"/><path d="M14.4 7.4A6.4 6.4 0 0 1 8.6 14.4M8.6 14.4l1.5-1.3M8.6 14.4l1.4 1.2"/>'),
    sliders: svg(16, '<path d="M2 4.5h7M12.2 4.5H14M2 11.5h1.8M7.2 11.5H14"/><circle cx="10.6" cy="4.5" r="1.6"/><circle cx="5.5" cy="11.5" r="1.6"/>'),
    trash: svg(16, '<path d="M2.5 4.5h11M6 4.5V2.8h4v1.7M4 4.5l.7 8.7h6.6l.7-8.7"/>'),
    expand: svg(11, '<path d="M4 6l4 4 4-4"/>'),
    record: svg(16, '<circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="3.6" fill="#d93025" stroke="none"/>'),
    recordScreen: svg(16, '<rect x="1.2" y="2.4" width="13.6" height="9.4" rx="1.4"/><path d="M5.6 14.2h4.8"/><circle cx="8" cy="7.1" r="2.9" fill="#d93025" stroke="none"/>'),
    mic: svg(14, '<rect x="5.8" y="1.8" width="4.4" height="8" rx="2.2"/><path d="M3.3 7.8a4.7 4.7 0 0 0 9.4 0M8 12.6v1.8"/>'),
    stop: svg(16, '<rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" stroke="none"/>'),
  };
  const c = L.content;

  // Fingertip cursor over the app while tap indicators are on.
  const fingertip = encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='14' cy='14' r='10' fill='rgba(0,0,0,0.14)'/></svg>");

  // Page-level style: pin <body> into the screen area. The transform makes
  // <body> the containing block for position:fixed app shells.
  let style = document.getElementById('__devframe-style');
  if (!style) {
    style = document.createElement('style');
    style.id = '__devframe-style';
    document.documentElement.appendChild(style);
  }
  style.textContent = `
    html {
      background: ${t.page} !important; overflow: hidden !important;
      /* The device screen as "the viewport": vw/vh in the page are rewritten to
         these (see viewport units below), following the fit-to-width zoom. */
      --df-vw: calc(${c.w}px / var(--df-fit, 1) / 100);
      --df-vh: calc(${c.h}px / var(--df-fit, 1) / 100);
      --df-vmin: min(var(--df-vw), var(--df-vh));
      --df-vmax: max(var(--df-vw), var(--df-vh));
    }
    body {
      position: fixed !important;
      /* --df-fit < 1 shrinks a too-wide page to the screen width (see fitWidth below):
         the page lays out wider, and zoom scales it (and these lengths) back down. */
      zoom: var(--df-fit, 1) !important;
      left: calc(${c.x}px / var(--df-fit, 1)) !important; top: calc(${c.y}px / var(--df-fit, 1)) !important;
      width: calc(${c.w}px / var(--df-fit, 1)) !important; height: calc(${c.h}px / var(--df-fit, 1)) !important;
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
  // The device outline: phone/lid body plus any extra parts (laptop base).
  const devicePath = L.silhouette ? L.silhouette.map(rr).join(' ') : [phonePath, ...L.extras.map(rr)].join(' ');
  const outside = `M0,0H${L.W}V${L.H}H0z ${devicePath}`;
  const option = (d) => `<option value="${d.key}"${d.key === L.deviceKey ? ' selected' : ''}>${d.group === 'custom' ? d.name.replace(/^Custom/, E('customDevice')) : d.name}</option>`;
  const group = (key, label) => {
    const items = L.devices.filter((d) => d.group === key);
    return items.length ? `<optgroup label="${label}">${items.map(option).join('')}</optgroup>` : '';
  };
  const options = [
    group('mobile', E('groupMobile')),
    group('full', E('groupFull')),
    group('saved', E('groupSaved')),
    ...L.devices.filter((d) => d.group === 'custom').map(option),
  ].join('');
  const rotateTip = L.orientation === 'portrait' ? E('tipRotateLandscape') : E('tipRotatePortrait');

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

  // Devices with their own artwork (the photo devices) replace the plain
  // body, outline and camera.
  const art = L.decor ? `<g transform="${L.decor.transform}">${L.decor.svg}</g>` : '';

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
      input[type=number] { min-width: 54px; } /* room for 4 digits when labels are long */
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
        position: absolute; right: 8px; top: ${L.bar + 4}px; width: 300px;
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
      .seg button.chip { border-color: ${t.ctlBorder}; }
      .seg button.chip:hover:not(:disabled) { filter: brightness(.93); }
      .seg button.chip.sel { border-color: #1a73e8; box-shadow: 0 0 0 2px #1a73e8; }
      .pop input[type=text] { width: 100%; flex: none; height: 26px; font-size: 12px; }
      .pop textarea {
        display: block; width: 100%; box-sizing: border-box; resize: vertical; min-height: 54px;
        font: 12px ui-monospace, Consolas, monospace; color: inherit; padding: 4px 6px;
        background: ${t.ctl}; border: 1px solid ${t.ctlBorder}; border-radius: 4px;
      }
      .pop textarea.bad { border-color: #d93025; }
      #rulesNote { color: #d93025; opacity: 1; margin-top: 2px; }
      .iconrow { display: flex; align-items: center; gap: 6px; }
      .iconrow button { height: 26px; font-size: 12px; }
      .iconprev { display: inline-flex; align-items: center; min-width: 26px; height: 26px; }
      .iconprev img { width: 20px; height: 20px; object-fit: contain; }
      .help { margin-top: 12px; padding-top: 8px; border-top: 1px solid ${t.barBorder}; }
      .help a { color: #1a73e8; text-decoration: none; font-weight: 600; }
      .help a:hover { text-decoration: underline; }
      .pop select.langsel { flex: none; width: 100%; height: 26px; font-size: 12px; }
      .chk { display: flex; align-items: center; gap: 6px; margin-top: 10px; cursor: pointer; }
      .chk { white-space: normal; } /* long translations wrap */
      .chk input { flex: none; }
      .ripple {
        position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
        background: rgba(0, 0, 0, .11); box-sizing: border-box; pointer-events: none;
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
        <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e6e8eb"/><stop offset="1" stop-color="#9aa0a6"/>
        </linearGradient>
        <clipPath id="phoneclip"><path d="${phonePath}"/></clipPath>
      </defs>
      ${statusBar}
      <path fill="${t.page}" fill-rule="evenodd" d="${outside}"/>
      ${L.frameless || L.skin ? '' : `<path fill="#000" d="${devicePath}" filter="url(#shadow)" clip-path="url(#outside)"/>`}
      ${art || `<path fill="url(#body)" fill-rule="evenodd" d="${phonePath} ${rr(L.screen)}"/>`}
      ${L.extras.map((e) => `
        <path fill="url(#base)" stroke="#8a8f96" stroke-width="1" d="${rr(e)}"/>
        <rect x="${e.x + e.w / 2 - 60}" y="${e.y}" width="120" height="5" rx="2.5" fill="#8a8f96"/>`).join('')}
      ${L.frameless || art ? '' : `<path fill="none" stroke="#55575d" stroke-width="2" d="${phonePath}"/>`}
      ${L.camera && !art ? `<circle cx="${L.camera.cx}" cy="${L.camera.cy}" r="${L.camera.r}" fill="url(#cam)"/>` : ''}
      ${L.buttons.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2" fill="${b.color}"/>`).join('')}
    </svg>
    <div id="ripples"></div>
    <div class="bar"${L.toolbarHidden ? ' hidden' : ''}>
      <div class="row" id="main">
      <select id="device" title="${E('tipDevice')}">${options}</select>
      ${L.deviceKey === 'custom' ? `<button id="edit" title="${E('tipEditCustom')}">&#x270E;</button>` : ''}
      ${L.preset ? `<button id="delpreset" title="${E('tipDeletePreset', L.preset.name)}">${ICON.trash}</button>` : ''}
      <button id="rotate"${L.canRotate ? ` title="${rotateTip}"` : ` title="${E('tipNoRotate')}" disabled data-fixed-off="1"`}>${ICON.rotate}</button>
      <button id="status"${L.hasStatusBar ? ` title="${E(L.statusBar ? 'tipStatusHide' : 'tipStatusShow')}"` : ` title="${E('tipNoStatus')}" disabled data-fixed-off="1"`}>${L.statusBar ? ICON.wifi : ICON.wifiOff}</button>
      <button id="appearance" title="${E('tipSettings')}">${ICON.sliders}</button>
      <button id="reload" title="${E('tipReload')}">&#x27F3;</button>
      <button id="rec">${ICON.record}</button>
      <button id="shot" title="${L.copyShortcut ? E('tipShotShortcut', L.copyShortcut) : E('tipShot')}">${ICON.camera}</button>
      <button id="hide" title="${L.shortcut ? E('tipHideShortcut', L.shortcut) : E('tipHide')}">${ICON.eyeOff}</button>
      </div>
      <form class="row" id="editor" hidden>
        <label for="w">${E('editorSize')}</label>
        <input id="w" type="number" required min="${L.custom.min}" max="${L.custom.max}" step="1" value="${L.custom.width}" title="${E('tipWidth', L.custom.min, L.custom.max)}">
        <span>&#xD7;</span>
        <input id="h" type="number" required min="${L.custom.min}" max="${L.custom.max}" step="1" value="${L.custom.height}" title="${E('tipHeight', L.custom.min, L.custom.max)}">
        <button type="submit" class="primary" title="${E('tipApply')}">${E('btnApply')}</button>
        <button type="button" id="savepreset" title="${E('tipSavePreset')}">${E('btnSaveEllipsis')}</button>
        <button type="button" id="cancel" title="${E('tipCancel')}">&#x2715;</button>
      </form>
      <form class="row" id="namer" hidden>
        <input id="pname" type="text" required maxlength="${L.presetNameMax}" placeholder="${E('namePlaceholder')}" title="${E('tipPresetName')}">
        <button type="submit" class="primary" title="${E('tipSaveToDropdown')}">${E('btnSave')}</button>
        <button type="button" id="ncancel" title="${E('tipBack')}">&#x2715;</button>
      </form>
    </div>
    <div class="pop" id="pop" hidden>
      <div class="lbl">${E('lblBackground')}</div>
      <div class="seg">
        ${Object.keys(BG_LABEL).map((k) => `<button data-bg="${k}" class="chip${k === L.background ? ' sel' : ''}" style="${chip(THEMES[k].page)}">${BG_LABEL[k]}</button>`).join('')}
      </div>
      <div class="lbl">${E('lblFrameColor')}${L.frameColorFixed ? ` <span class="note">${E('noteFixedColor')}</span>` : ''}</div>
      <div class="seg">
        ${Object.keys(FRAME_LABEL).map((k) => `<button data-fc="${k}" class="chip${k === L.frameColor && !L.frameColorFixed ? ' sel' : ''}" style="${chip(FRAME_SWATCH[k])}"${L.frameColorFixed ? ' disabled' : ''}>${FRAME_LABEL[k]}</button>`).join('')}
      </div>
      <label class="chk"><input type="checkbox" id="touch"${L.touch ? ' checked' : ''}> ${E('optShowTaps')}</label>
      <label class="chk" style="margin-top: 6px" title="${E('tipFitWidth')}"><input type="checkbox" id="fitWidth"${L.fitWidth ? ' checked' : ''}> ${E('optFitWidth')}</label>
      <label class="chk" style="margin-top: 6px" title="${L.shortcut ? E('tipOpenHiddenShortcut', L.shortcut) : E('tipOpenHidden')}"><input type="checkbox" id="openHidden"${L.openHidden ? ' checked' : ''}> ${E('optOpenHidden')}</label>
      <div class="lbl">${E('lblRecording')}</div>
      <div class="seg">
        <button data-rm="device" class="${L.recordMode === 'screen' ? '' : 'sel'}" title="${E('tipModeDevice')}">${ICON.record}${E('recDevice')}</button>
        <button data-rm="screen" class="${L.recordMode === 'screen' ? 'sel' : ''}" title="${E('tipModeScreen')}">${ICON.recordScreen}${E('recScreen')}</button>
      </div>
      <label class="chk" style="margin-top: 8px" title="${E('tipCountdown')}"><input type="checkbox" id="countdown"${L.countdown ? ' checked' : ''}> ${E('optCountdown')}</label>
      <label class="chk" style="margin-top: 6px"><input type="checkbox" id="mic"${L.mic ? ' checked' : ''}> ${E('optMic')}</label>
      <label class="chk" style="margin-top: 6px" title="${E('tipSystemAudio')}"><input type="checkbox" id="systemAudio"${L.systemAudio ? ' checked' : ''}${L.recordMode === 'screen' ? '' : ' disabled'}> ${E('optSystemAudio')}</label>
      <div class="lbl">${E('lblRename')} <span class="note">${E('noteRename')}</span></div>
      <textarea id="titleRules" rows="4" wrap="off" spellcheck="false" placeholder="MUP = WM Mobile" title="${E('tipRename')}">${L.titleRules}</textarea>
      <div class="note" id="rulesNote"></div>
      <div class="lbl">${E('lblTabIcon')}</div>
      <div class="iconrow">
        <button type="button" id="iconPick" title="${E('tipIconPick')}">${E('btnChoose')}</button>
        <span class="iconprev">${L.tabIcon ? `<img src="${L.tabIcon}" alt="">` : `<span class="note">${E('iconPageOwn')}</span>`}</span>
        ${L.tabIcon ? `<button type="button" id="iconClear" title="${E('tipIconRemove')}">${E('btnRemove')}</button>` : ''}
        <input type="file" id="iconFile" accept="image/*,.ico" hidden>
      </div>
      <label class="chk" style="margin-top: 6px" title="${E('tipIconAlways')}"><input type="checkbox" id="iconAlways"${L.iconAlways ? ' checked' : ''}${L.tabIcon ? '' : ' disabled'}> ${E('optIconAlways')}</label>
      <div class="lbl">${E('lblLanguage')}</div>
      <select id="lang" class="langsel">
        ${[['auto', E('langAuto')], ['en', 'English'], ['fr', 'Fran&#xE7;ais'], ['es_419', 'Espa&#xF1;ol']]
          .map(([v, name]) => `<option value="${v}"${v === L.lang ? ' selected' : ''}>${name}</option>`).join('')}
      </select>
      <div class="help"><a href="#" id="guide">${E('linkGuide')}</a></div>
    </div>
    <div class="count" id="count" hidden></div>
    <div class="toast" id="toast"></div>
    ${L.toolbarHidden ? `<div class="handle" id="handle" title="${L.shortcut ? E('tipShowToolbarShortcut', L.shortcut) : E('tipShowToolbar')}">${ICON.expand}</div>` : ''}`;

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
    toast(T('msgDeleteAgain'));
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
  pop.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => send({ type: 'set-pref', prefs: { recordMode: b.dataset.rm } })));
  pop.querySelectorAll('[data-fc]').forEach((b) => b.addEventListener('click', () => send({ type: 'set-pref', prefs: { frameColor: b.dataset.fc } })));
  root.getElementById('touch').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { touch: e.target.checked } }));
  root.getElementById('fitWidth').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { fitWidth: e.target.checked } }));
  root.getElementById('openHidden').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { openHidden: e.target.checked } }));
  root.getElementById('mic').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { mic: e.target.checked } }));
  root.getElementById('systemAudio').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { systemAudio: e.target.checked } }));
  // Title renames: flag lines that can't be read (no "Old = New"); those are
  // skipped by title.js. Saved when the box loses focus.
  const rulesBox = root.getElementById('titleRules');
  const rulesNote = root.getElementById('rulesNote');
  const checkRules = () => {
    const bad = rulesBox.value.split(/\r?\n/)
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => line && !line.startsWith('#') && !/^[^=]*[^=\s*][^=]*\s*=\s*\S/.test(line))
      .map(({ n }) => n);
    rulesBox.classList.toggle('bad', bad.length > 0);
    rulesNote.textContent = bad.length ? T('rulesSkipped', bad.join(', ')) : '';
  };
  checkRules();
  rulesBox.addEventListener('input', checkRules);
  rulesBox.addEventListener('change', () => send({ type: 'set-pref', prefs: { titleRules: rulesBox.value } }));

  // Tab icon: shrink the chosen image to a 64x64 PNG (keeps storage small).
  const iconFile = root.getElementById('iconFile');
  root.getElementById('iconPick').addEventListener('click', () => iconFile.click());
  root.getElementById('iconAlways').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { iconAlways: e.target.checked } }));
  root.getElementById('iconClear')?.addEventListener('click', () => send({ type: 'set-icon', dataUrl: null }));
  iconFile.addEventListener('change', () => {
    const file = iconFile.files[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight) || 1;
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      canvas.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      send({ type: 'set-icon', dataUrl: canvas.toDataURL('image/png') });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast(T('msgBadImage'), 4000); };
    img.src = url;
  });
  root.getElementById('guide').addEventListener('click', (e) => {
    e.preventDefault();
    setPop(false);
    send({ type: 'open-guide' });
  });
  root.getElementById('lang').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { lang: e.target.value } }));
  root.getElementById('countdown').addEventListener('change', (e) => send({ type: 'set-pref', prefs: { countdown: e.target.checked } }));

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

  // Fit page to screen width: measure how wide the page wants to be at 100%
  // and, if that's wider than the screen, zoom it down to fit (never below
  // 50%). Measuring and applying happen in one go, so nothing flickers; it
  // re-checks when the page changes so screens that fit go back to 100%.
  window.__devframeFitObserver?.disconnect();
  clearInterval(window.__devframeFitTimer);
  const rootStyle = document.documentElement.style;
  const fitWidth = () => {
    const body = document.body;
    if (!body) return;
    if (!L.fitWidth) { rootStyle.removeProperty('--df-fit'); fitWords(); return; }
    const before = rootStyle.getPropertyValue('--df-fit');
    rootStyle.setProperty('--df-fit', '1');
    const width = body.clientWidth;
    let need = body.scrollWidth;
    // Full-width app shells often scroll inside their own containers.
    for (const el of body.getElementsByTagName('*')) {
      const w = el.clientWidth;
      if (w >= width * 0.9 && el.scrollWidth > w + 1) need = Math.max(need, Math.round(el.scrollWidth * width / w));
    }
    const fit = need > width + 1 ? Math.max(0.5, Math.floor((width / need) * 1000) / 1000) : 1;
    if (String(fit) !== before || before === '') rootStyle.setProperty('--df-fit', String(fit));
    else rootStyle.setProperty('--df-fit', before);
    fitWords();
  };

  // Long words: when a single word is wider than the box it's in (so the
  // browser splits it, e.g. "PERFORMA/NCE" on a button), shrink that
  // element's text just enough to keep the word on one line (not below 60%).
  // Phrases may still wrap between words. Matching neighbors (e.g. the other
  // footer buttons) shrink by the same amount so sizes stay consistent. Sizes
  // are worked out from each element's original font size, so repeated passes
  // don't compound.
  const shrunk = window.__devframeShrunk ?? (window.__devframeShrunk = new Map()); // element -> original font size (px)
  const canvas = fitWords.canvas ?? (fitWords.canvas = document.createElement('canvas').getContext('2d'));
  function fitWords() {
    const body = document.body;
    if (!body) return;
    if (!L.fitWidth) {
      for (const el of shrunk.keys()) el.style.removeProperty('font-size');
      shrunk.clear();
      return;
    }
    for (const el of shrunk.keys()) if (!el.isConnected) shrunk.delete(el);
    // Pass 1: for every element holding text, the scale its widest word needs.
    const entries = [];
    for (const el of body.getElementsByTagName('*')) {
      let text = '';
      for (const node of el.childNodes) if (node.nodeType === 3) text += node.data;
      const words = text.split(/\s+/).filter((w) => w.length > 1);
      if (!words.length) continue;
      const cs = getComputedStyle(el);
      if (cs.whiteSpace.startsWith('nowrap') || cs.whiteSpace === 'pre') continue;
      // The width available: this element's content box, or its nearest
      // non-inline ancestor's for inline text holders like <span>.
      let box = el;
      while (box && box !== body && getComputedStyle(box).display.startsWith('inline') && !getComputedStyle(box).display.includes('block')) box = box.parentElement;
      const bs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
      if (avail <= 0) continue;
      const original = shrunk.get(el) ?? parseFloat(cs.fontSize);
      canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${original}px ${cs.fontFamily}`;
      const transform = (w) => (cs.textTransform === 'uppercase' ? w.toUpperCase() : cs.textTransform === 'lowercase' ? w.toLowerCase() : w);
      const spacing = parseFloat(cs.letterSpacing) || 0;
      const widest = Math.max(...words.map((w) => canvas.measureText(transform(w)).width + spacing * w.length));
      const scale = widest > avail + 0.5 ? Math.max(0.6, avail / widest) : 1;
      // Peers: the same kind of box side by side (e.g. footer buttons), looking
      // past single-child wrappers. They share one scale so sizes match.
      let item = box;
      while (item.parentElement && item.parentElement !== body && item.parentElement.children.length === 1) item = item.parentElement;
      entries.push({ el, original, scale, parent: item.parentElement, kind: `${box.tagName}.${box.className}` });
    }
    // Pass 2: the smallest scale in each peer group applies to the whole group.
    const groups = new Map();
    for (const e of entries) {
      const byKind = groups.get(e.parent) ?? new Map();
      groups.set(e.parent, byKind);
      byKind.set(e.kind, Math.min(byKind.get(e.kind) ?? 1, e.scale));
    }
    for (const e of entries) {
      const scale = groups.get(e.parent).get(e.kind);
      if (scale < 1) {
        const size = `${Math.floor(e.original * scale * 10) / 10}px`;
        if (!shrunk.has(e.el)) shrunk.set(e.el, e.original);
        if (e.el.style.getPropertyValue('font-size') !== size) e.el.style.setProperty('font-size', size, 'important');
      } else if (shrunk.has(e.el)) {
        e.el.style.removeProperty('font-size');
        shrunk.delete(e.el);
      }
    }
  }
  let fitPending = 0;
  const scheduleFit = () => {
    clearTimeout(fitPending);
    fitPending = setTimeout(fitWidth, 250);
  };
  fitWidth();
  if (L.fitWidth && document.body) {
    window.__devframeFitObserver = new MutationObserver(scheduleFit);
    window.__devframeFitObserver.observe(document.body, { childList: true, subtree: true });
    window.__devframeFitTimer = setInterval(fitWidth, 2000); // catches style-only changes
  }

  // Viewport units: vw/vh in the page normally measure the whole frame window
  // (device + bezel + margin), so things sized as "35vw" or "100vh" come out
  // too big for the device screen. Rewrite them in the page's stylesheets and
  // inline styles to the --df-vw/--df-vh variables above (the screen size).
  // Set up once per page; it keeps watching for styles the app adds later.
  if (!window.__devframeViewport) {
    const units = { vw: '--df-vw', dvw: '--df-vw', svw: '--df-vw', lvw: '--df-vw', vh: '--df-vh', dvh: '--df-vh', svh: '--df-vh', lvh: '--df-vh', vmin: '--df-vmin', vmax: '--df-vmax' };
    const find = /(-?(?:\d+\.?\d*|\.\d+))(dvw|svw|lvw|vw|dvh|svh|lvh|vh|vmin|vmax)\b/g;
    const has = /(?:\d|\.)(?:d|s|l)?v(?:w|h|min|max)\b/;
    const done = new WeakSet();
    const fixStyle = (style) => {
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        const value = style.getPropertyValue(prop);
        if (has.test(value)) style.setProperty(prop, value.replace(find, (_, n, u) => `calc(${n} * var(${units[u]}))`), style.getPropertyPriority(prop));
      }
    };
    const fixRules = (rules) => {
      for (const rule of rules) {
        if (rule.style && !done.has(rule)) { fixStyle(rule.style); done.add(rule); }
        if (rule.cssRules) fixRules(rule.cssRules);
      }
    };
    const fixSheets = () => {
      for (const sheet of document.styleSheets) {
        if (sheet.ownerNode?.id === '__devframe-style') continue;
        let rules;
        try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet: can't read
        fixRules(rules);
      }
    };
    const fixInline = (root) => {
      if (root.nodeType !== 1) return;
      if (root.hasAttribute('style') && has.test(root.getAttribute('style'))) fixStyle(root.style);
      for (const el of root.querySelectorAll('[style]')) if (has.test(el.getAttribute('style'))) fixStyle(el.style);
    };
    let pending = 0;
    const schedule = () => { clearTimeout(pending); pending = setTimeout(fixSheets, 50); };
    window.__devframeViewport = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') fixInline(r.target);
        for (const node of r.addedNodes) {
          if (node.nodeName === 'STYLE' || node.nodeName === 'LINK') { schedule(); node.addEventListener?.('load', schedule); }
          else if (r.target !== document.head) fixInline(node);
        }
        if (r.type === 'characterData' || r.target.nodeName === 'STYLE') schedule();
      }
    });
    window.__devframeViewport.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    fixSheets();
    if (document.body) fixInline(document.body);
    window.addEventListener('load', fixSheets);
  }

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
    const screenRec = L.screenRec;
    for (const id of lockIds) {
      const el = root.getElementById(id);
      if (el) el.disabled = Boolean(rec) || el.dataset.fixedOff === '1';
    }
    if (rec) setPop(false);
    const live = rec?.recorder ? rec : screenRec; // recording right now: show the timer
    recBtn.classList.toggle('rec-on', Boolean(live));
    const key = L.recordShortcut;
    recBtn.title = screenRec ? (key ? T('tipStopScreenShortcut', key) : T('tipStopScreen'))
      : rec ? (key ? T('tipStopShortcut', key) : T('tipStop'))
      : L.recordMode === 'screen' ? (key ? T('tipRecScreenShortcut', key) : T('tipRecScreen'))
      : (key ? T('tipRecordShortcut', key) : T('tipRecord'));
    if (!live) {
      recBtn.innerHTML = rec ? ICON.stop : L.recordMode === 'screen' ? ICON.recordScreen : ICON.record;
      return;
    }
    const secs = Math.floor((Date.now() - live.started) / 1000);
    recBtn.innerHTML = `${ICON.stop}${live.mic ? ICON.mic : ''}<span>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</span>`;
  };
  clearInterval(window.__devframeRecTick);
  window.__devframeRecTick = setInterval(() => { if (window.__devframeRec?.recorder || L.screenRec) showRecording(); }, 500);
  showRecording();

  const stopRecording = (reason = T('whyStopped')) => {
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
    rec.mic?.getTracks().forEach((track) => track.stop());
    root.getElementById('count').hidden = true;
    window.__devframeRec = null;
    if (blob && blob.size) {
      const ext = rec.mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      // e.g. ZebraTC72_20261003141530.mp4 (device name without spaces, local time)
      const stamp = (d = new Date()) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
      const name = L.deviceName.replace(/[^A-Za-z0-9-]+/g, '') || 'Device';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}_${stamp()}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      if (rec.error) toast(T('msgRecStoppedEarly', rec.error), 8000);
      else toast(ext === 'mp4' ? T('msgRecSaved') : T('msgRecSavedWebm'));
    } else if (rec.recorder) {
      // Started but nothing usable was recorded: say why.
      const why = rec.error || rec.reason || T('whyUnknown');
      console.warn('Device Frame: recording produced no video:', why, rec);
      toast(T('msgRecFailed', why), 8000);
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
      toast(e.name === 'NotAllowedError' && !streamId ? T('msgRecCanceled') : T('msgCantRecord', e.message || e.name));
      console.warn('Device Frame: recording failed to start', e);
      return;
    }
    // Microphone (optional). Asked for before the countdown, so Chrome's
    // permission prompt doesn't land mid-recording. If it's blocked or there's
    // no mic, record silently rather than fail.
    let mic = null;
    if (L.mic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        console.warn('Device Frame: microphone unavailable', e);
        toast(T('msgMicUnavailable', e.name), 6000);
      }
    }
    // AAC audio in MP4 so PowerPoint can play it.
    const mime = (mic
      ? ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm']
      : ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'])
      .find((type) => MediaRecorder.isTypeSupported(type));
    const rec = { stream, mime, mic };
    window.__devframeRec = rec;
    send({ type: 'rec-state', recording: true });
    showRecording();
    stream.getVideoTracks()[0].addEventListener('ended', () => stopRecording(T('whyCaptureEnded'))); // e.g. Chrome's "Stop sharing"

    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    // Don't hang if playback never starts; give up after 3 s.
    const playing = await Promise.race([
      video.play().then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);
    if (!playing || !video.videoWidth) {
      toast(T('msgCaptureNoStart'));
      rec.stopping = true;
      return finishRecording(rec, null);
    }

    // Optional countdown, then record. The overlay is gone before the first frame.
    if (L.countdown) {
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
    }

    // Crop: the device plus a little room for its side buttons, in CSS px,
    // mapped to video pixels (video width / viewport width covers zoom + DPR).
    const pad = L.cropPad;
    const crop = { x: L.bounds.x - pad, y: L.bounds.y - pad, w: L.bounds.w + pad * 2, h: L.bounds.h + pad * 2 };
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
    const output = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...(mic?.getAudioTracks() ?? [])]);
    rec.recorder = new MediaRecorder(output, { mimeType: mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 });
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
    if (L.screenRec) send({ type: 'screen-stop' });
    else if (window.__devframeRec) stopRecording(T('whyButton'));
    else if (L.recordMode === 'screen') send({ type: 'screen-start' });
    else startRecording();
  });

  // Screen recordings: the background asks for the 3-2-1 countdown here,
  // before it starts recording.
  // 5 seconds (not 3): time to click Hide on Chrome's sharing bar.
  const screenCountdown = () => new Promise((resolve) => {
    const count = root.getElementById('count');
    let n = 5;
    count.textContent = n;
    count.hidden = false;
    const timer = setInterval(() => {
      n -= 1;
      if (n > 0) { count.textContent = n; return; }
      clearInterval(timer);
      count.hidden = true;
      setTimeout(resolve, 150); // let the overlay disappear first
    }, 1000);
  });

  // Messages from the background (record shortcut). One listener for the
  // page's lifetime, forwarding to the latest drawFrame's handlers.
  window.__devframeOnMessage = (msg, respond) => {
    if (msg?.type === 'df-record-start' && !window.__devframeRec) startRecording(msg.streamId);
    if (msg?.type === 'df-record-stop') stopRecording(T('whyShortcut'));
    if (msg?.type === 'df-toast') toast(msg.text, msg.ms);
    if (msg?.type === 'df-countdown') {
      screenCountdown().then(() => respond({}));
      return true; // answer after the countdown
    }
  };
  if (!window.__devframeMessageBound) {
    chrome.runtime.onMessage.addListener((msg, sender, respond) => window.__devframeOnMessage?.(msg, respond));
    window.__devframeMessageBound = true;
  }

  root.getElementById('shot').addEventListener('click', () => {
    // The background captures, crops and downloads the PNG, then hands it back
    // so we can put it on the clipboard. ClipboardItem accepts a promise, which
    // keeps the click's user activation for the clipboard write.
    const png = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'screenshot' }, (res) => {
        if (!res?.dataUrl) return reject(new Error(res?.error || T('msgShotFailed')));
        const bytes = atob(res.dataUrl.split(',')[1]);
        const buf = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
        resolve(new Blob([buf], { type: 'image/png' }));
      });
    });
    navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      .then(() => toast(T('msgCopiedSaved')))
      .catch(() => png.then(() => toast(T('msgSavedClipBlocked')), (e) => toast(e.message)));
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
// msgs: { copied, blocked } in the UI language (blocked has $1 for the error).
async function copyImageToClipboard(dataUrl, msgs) {
  const bytes = atob(dataUrl.split(',')[1]);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  let message = msgs.copied;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([buf], { type: 'image/png' }) })]);
  } catch (e) {
    message = msgs.blocked.replace('$1', e.name);
  }
  const toastEl = document.getElementById('__devframe')?.shadowRoot?.getElementById('toast');
  if (toastEl) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(window.__devframeToast);
    window.__devframeToast = setTimeout(() => toastEl.classList.remove('show'), 2500);
  }
}
