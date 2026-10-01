// Device Frame - background service worker.
//
// Clicking the toolbar icon reopens the current page as the top-level page of
// a popup window (no iframe, so cookies, storage and CSRF protection behave
// exactly as in a normal tab). After each page load we inject
// code that pins <body> into the "screen" area and draws a bezel overlay, then
// size the window to the phone and use per-tab zoom to fit it on screen.

const DEVICE = { name: 'Pixel 8', width: 412, height: 915 };
const LAYOUT = { ...DEVICE, side: 12, top: 34, bottom: 34, margin: 16, radius: 46, screenRadius: 28 };
const TOTAL = {
  width: LAYOUT.width + LAYOUT.side * 2 + LAYOUT.margin * 2,
  height: LAYOUT.height + LAYOUT.top + LAYOUT.bottom + LAYOUT.margin * 2,
};

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !/^https?:/i.test(tab.url)) return; // chrome:// etc. can't be framed

  const current = await chrome.windows.get(tab.windowId);
  const win = await chrome.windows.create({
    url: tab.url,
    type: 'popup',
    width: TOTAL.width + 16, // rough guess; corrected after the first load
    height: Math.min(TOTAL.height + 40, current.height),
    left: current.left + 60,
    top: current.top,
  });
  const tabId = win.tabs[0].id;

  await setFramed(tabId, true);
  // Keep zoom changes to this tab only, so normal tabs on the same site are untouched.
  await chrome.tabs.setZoomSettings(tabId, { mode: 'automatic', scope: 'per-tab' });
});

chrome.webNavigation.onDOMContentLoaded.addListener(onLoaded);
chrome.webNavigation.onCompleted.addListener(onLoaded);

chrome.tabs.onRemoved.addListener((tabId) => setFramed(tabId, false));

async function onLoaded({ tabId, frameId }) {
  if (frameId !== 0 || !(await isFramed(tabId))) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: drawFrame,
      args: [LAYOUT],
    });
    await fitWindow(tabId, result);
  } catch (e) {
    console.warn('Device Frame: could not frame tab', tabId, e);
  }
}

// Size the window so the viewport is exactly TOTAL (in CSS px), zooming out
// if the phone is taller than the screen.
async function fitWindow(tabId, m) {
  const tab = await chrome.tabs.get(tabId);
  const zoom = await chrome.tabs.getZoom(tabId);

  // outer* are screen pixels; inner* are CSS pixels at the current zoom.
  const chromeW = m.outerWidth - m.innerWidth * zoom;
  const chromeH = m.outerHeight - m.innerHeight * zoom;
  const fit = Math.min(1, (m.availHeight - chromeH) / TOTAL.height);
  const target = Math.max(0.25, Math.floor(fit * 100) / 100);

  if (Math.abs(target - zoom) > 0.005) await chrome.tabs.setZoom(tabId, target);

  const width = Math.round(TOTAL.width * target + chromeW);
  const height = Math.round(TOTAL.height * target + chromeH);
  const win = await chrome.windows.get(tab.windowId);
  if (Math.abs(win.width - width) > 1 || Math.abs(win.height - height) > 1) {
    await chrome.windows.update(tab.windowId, { width, height });
  }
}

async function isFramed(tabId) {
  const { framed = [] } = await chrome.storage.session.get('framed');
  return framed.includes(tabId);
}

async function setFramed(tabId, on) {
  const { framed = [] } = await chrome.storage.session.get('framed');
  const next = framed.filter((id) => id !== tabId);
  if (on) next.push(tabId);
  await chrome.storage.session.set({ framed: next });
}

// Runs inside the page. Must be self-contained (it is serialised by executeScript).
function drawFrame(L) {
  const phoneW = L.width + L.side * 2;
  const phoneH = L.height + L.top + L.bottom;
  const W = phoneW + L.margin * 2;
  const H = phoneH + L.margin * 2;
  const sx = L.margin + L.side;
  const sy = L.margin + L.top;

  if (!document.getElementById('__devframe-style')) {
    const style = document.createElement('style');
    style.id = '__devframe-style';
    // transform on <body> makes it the containing block for position:fixed
    // descendants, so full-screen app shells stay inside the screen area.
    style.textContent = `
      html { background: #2b2d33 !important; overflow: hidden !important; }
      body {
        position: fixed !important;
        left: ${sx}px !important; top: ${sy}px !important;
        width: ${L.width}px !important; height: ${L.height}px !important;
        min-width: 0 !important; min-height: 0 !important; max-width: none !important;
        margin: 0 !important;
        overflow: auto !important;
        transform: translateZ(0) !important;
        background-color: #fff;
      }
      #__devframe {
        position: fixed !important; left: 0 !important; top: 0 !important;
        width: ${W}px !important; height: ${H}px !important;
        pointer-events: none !important; z-index: 2147483647 !important;
      }`;
    document.documentElement.appendChild(style);
  }

  if (!document.getElementById('__devframe')) {
    const rr = (x, y, w, h, r) =>
      `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}` +
      `h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
    const phone = rr(L.margin, L.margin, phoneW, phoneH, L.radius);
    const screen = rr(sx, sy, L.width, L.height, L.screenRadius);
    const right = L.margin + phoneW;

    const wrap = document.createElement('div');
    wrap.id = '__devframe';
    // Appended to <html>, not <body>, so the page's own rendering never removes it.
    wrap.innerHTML = `
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="__df-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#3c3d42"/><stop offset=".6" stop-color="#111214"/>
          </linearGradient>
          <radialGradient id="__df-cam" cx=".35" cy=".35" r=".6">
            <stop offset="0" stop-color="#3a4a6a"/><stop offset="1" stop-color="#05070c"/>
          </radialGradient>
        </defs>
        <path fill="#2b2d33" fill-rule="evenodd" d="M0,0H${W}V${H}H0z ${phone}"/>
        <path fill="url(#__df-body)" fill-rule="evenodd" d="${phone} ${screen}"/>
        <path fill="none" stroke="#55575d" stroke-width="2" d="${phone}"/>
        <circle cx="${W / 2}" cy="${L.margin + L.top / 2}" r="6" fill="url(#__df-cam)"/>
        <rect x="${right}" y="${L.margin + 170}" width="4" height="60" rx="2" fill="#4a4c52"/>
        <rect x="${right}" y="${L.margin + 260}" width="4" height="110" rx="2" fill="#4a4c52"/>
      </svg>`;
    document.documentElement.appendChild(wrap);
  }

  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    availHeight: screen.availHeight,
  };
}
