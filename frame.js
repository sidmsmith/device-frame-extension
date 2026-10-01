// Injected into the framed page (isolated world) via chrome.scripting.
// Must be self-contained: executeScript serialises the function, so it cannot
// reference anything outside its own body. Safe to call repeatedly; each call
// replaces the previous frame (used for device switch / rotate).

function drawFrame(L) {
  const rr = ({ x, y, w, h, r }) =>
    `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}` +
    `h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
  const s = L.screen;

  // Page-level style: pin <body> into the screen area. The transform makes
  // <body> the containing block for position:fixed app shells.
  let style = document.getElementById('__devframe-style');
  if (!style) {
    style = document.createElement('style');
    style.id = '__devframe-style';
    document.documentElement.appendChild(style);
  }
  style.textContent = `
    html { background: #2b2d33 !important; overflow: hidden !important; }
    body {
      position: fixed !important;
      left: ${s.x}px !important; top: ${s.y}px !important;
      width: ${s.w}px !important; height: ${s.h}px !important;
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
  const host = document.createElement('div');
  host.id = '__devframe';
  // Appended to <html>, not <body>, so the app never re-renders it away;
  // shadow DOM keeps the page's CSS off our controls.
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  const phonePath = rr(L.phone);
  const options = L.devices
    .map((d) => `<option value="${d.key}"${d.key === L.deviceKey ? ' selected' : ''}>${d.name}</option>`)
    .join('');
  const rotateLabel = L.orientation === 'portrait' ? 'Landscape' : 'Portrait';

  root.innerHTML = `
    <style>
      :host { all: initial; }
      svg { position: absolute; left: 0; top: 0; }
      .bar {
        position: absolute; left: 0; top: 0; right: 0; height: ${L.bar}px;
        display: flex; align-items: center; gap: 6px; padding: 0 8px;
        box-sizing: border-box;
        background: #1e1f23; border-bottom: 1px solid #000;
        font: 13px system-ui, sans-serif; color: #e6e6e6;
        pointer-events: auto;
      }
      select, button {
        font: inherit; color: inherit; height: 28px;
        background: #3a3c44; border: 1px solid #50535c; border-radius: 4px;
        cursor: pointer;
      }
      select { flex: 1; min-width: 0; padding: 0 4px; }
      button { padding: 0 8px; white-space: nowrap; }
      button:hover, select:hover { background: #474a53; }
    </style>
    <svg width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${L.colors[0]}"/><stop offset=".6" stop-color="${L.colors[1]}"/>
        </linearGradient>
        <radialGradient id="cam" cx=".35" cy=".35" r=".6">
          <stop offset="0" stop-color="#3a4a6a"/><stop offset="1" stop-color="#05070c"/>
        </radialGradient>
      </defs>
      <path fill="#2b2d33" fill-rule="evenodd" d="M0,0H${L.W}V${L.H}H0z ${phonePath}"/>
      <path fill="url(#body)" fill-rule="evenodd" d="${phonePath} ${rr(s)}"/>
      <path fill="none" stroke="#55575d" stroke-width="2" d="${phonePath}"/>
      <circle cx="${L.camera.cx}" cy="${L.camera.cy}" r="${L.camera.r}" fill="url(#cam)"/>
      ${L.buttons.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="2" fill="#4a4c52"/>`).join('')}
    </svg>
    <div class="bar">
      <select id="device" title="Device">${options}</select>
      <button id="rotate" title="Rotate to ${rotateLabel.toLowerCase()}">&#x27F2; ${rotateLabel}</button>
      <button id="reload" title="Reload page">&#x27F3;</button>
      <button id="shot" title="Save screenshot of the phone (PNG)">&#x1F4F7;</button>
      <button id="exit" title="Close the frame and reopen this page in a normal tab">&#x2715; Exit</button>
    </div>`;

  const send = (msg) => chrome.runtime.sendMessage(msg);
  root.getElementById('device').addEventListener('change', (e) => send({ type: 'set-device', device: e.target.value }));
  root.getElementById('rotate').addEventListener('click', () => send({ type: 'rotate' }));
  root.getElementById('reload').addEventListener('click', () => location.reload());
  root.getElementById('shot').addEventListener('click', () => send({ type: 'screenshot' }));
  root.getElementById('exit').addEventListener('click', () => send({ type: 'exit' }));

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
