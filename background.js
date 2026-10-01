// Device Frame - background service worker.
//
// Clicking the toolbar icon reopens the current page as the top-level page of
// a popup window (no iframe, so cookies, storage and CSRF protection behave
// exactly as in a normal tab). After each page load we inject drawFrame()
// (frame.js), which pins <body> into the "screen" area and draws the bezel
// and control bar, then size the window to fit and use per-tab zoom to shrink
// it when the device is bigger than the screen.

importScripts('devices.js', 'frame.js');

// ---- state ---------------------------------------------------------------
// session: framed[tabId] = { windowId, device, orientation, recording }
// local:   last = { device, orientation, left, top, background, statusBar, custom,
//                   toolbarHidden, frameColor, touch, mic, countdown, mupTitle, presets: [{ id, name, width, height }] }

async function getFramed() {
  return (await chrome.storage.session.get('framed')).framed ?? {};
}

async function updateFramed(tabId, patch) {
  const framed = await getFramed();
  if (patch === null) delete framed[tabId];
  else framed[tabId] = { ...framed[tabId], ...patch };
  await chrome.storage.session.set({ framed });
  return framed[tabId];
}

async function getLast() {
  return (await chrome.storage.local.get('last')).last ?? {};
}

async function saveLast(patch) {
  await chrome.storage.local.set({ last: { ...(await getLast()), ...patch } });
}

// ---- open ----------------------------------------------------------------

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !/^https?:/i.test(tab.url)) return; // chrome:// etc. can't be framed

  const last = await getLast();
  const device = isDeviceKey(last.device, last) ? last.device : DEFAULT_DEVICE;
  const orientation = last.orientation === 'landscape' ? 'landscape' : 'portrait';
  const L = computeLayout(device, orientation, last);
  const current = await chrome.windows.get(tab.windowId);

  const win = await chrome.windows.create({
    url: tab.url,
    type: 'popup',
    width: L.W + 16, // rough guess; corrected after the first load
    height: Math.min(L.H + 40, current.height),
    left: last.left ?? current.left + 60,
    top: last.top ?? current.top,
  });
  const tabId = win.tabs[0].id;

  await updateFramed(tabId, { windowId: win.id, device, orientation });
  // Keep zoom changes to this tab only, so normal tabs on the same site are untouched.
  await chrome.tabs.setZoomSettings(tabId, { mode: 'automatic', scope: 'per-tab' });
});

// ---- draw on every page load ---------------------------------------------

chrome.webNavigation.onDOMContentLoaded.addListener(onLoaded);
chrome.webNavigation.onCompleted.addListener(onLoaded);

async function onLoaded({ tabId, frameId, url }) {
  // Only normal web pages can be drawn on; skip about:blank, chrome-error:// etc.
  if (frameId !== 0 || !/^https?:/i.test(url)) return;
  const state = (await getFramed())[tabId];
  if (!state) return;
  // A full page load ends any recording that was running in the old page.
  if (state.recording) await updateFramed(tabId, { recording: false });
  await reframe(tabId, state);
}

async function reframe(tabId, state, shiftY = 0) {
  const keys = await shortcuts();
  const L = { ...computeLayout(state.device, state.orientation, await getLast()), shortcut: keys['toggle-toolbar'], copyShortcut: keys['copy-screenshot'], recordShortcut: keys.record };
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: drawFrame,
      args: [L],
    });
    await fitWindow(tabId, L, result, shiftY);
    // Arm the key guard (keyguard.js) so our shortcuts don't type into the app.
    chrome.tabs.sendMessage(tabId, { type: 'keyguard', shortcuts: Object.values(keys) }).catch(() => {});
  } catch (e) {
    // The page navigated away or the window closed mid-draw; the next load redraws.
    if (!isExpectedRaceError(e)) console.warn('Device Frame: could not frame tab', tabId, e);
  }
}

function isExpectedRaceError(e) {
  return /Cannot access contents|No tab with id|No window with id|Frame with ID 0 (was removed|is showing error page)|The tab was closed/i
    .test(String(e?.message ?? e));
}

// Size the window so the viewport is exactly L.W × L.H CSS px, zooming out
// when that is bigger than the screen.
// shiftY (CSS px) moves the window down/up, e.g. to keep the device in place
// when the toolbar is hidden or shown.
async function fitWindow(tabId, L, m, shiftY = 0) {
  const tab = await chrome.tabs.get(tabId);
  const zoom = await chrome.tabs.getZoom(tabId);

  // outer* are screen pixels; inner* are CSS pixels at the current zoom.
  const chromeW = m.outerWidth - m.innerWidth * zoom;
  const chromeH = m.outerHeight - m.innerHeight * zoom;
  const fit = Math.min(1, (m.availHeight - chromeH) / L.H, (m.availWidth - chromeW) / L.W);
  const target = Math.max(0.25, Math.floor(fit * 100) / 100);

  if (Math.abs(target - zoom) > 0.005) await chrome.tabs.setZoom(tabId, target);

  const width = Math.round(L.W * target + chromeW);
  const height = Math.round(L.H * target + chromeH);
  const win = await chrome.windows.get(tab.windowId);
  // Keep the window on screen when it grows (e.g. rotating a tablet).
  const left = Math.max(m.availLeft, Math.min(win.left, m.availLeft + m.availWidth - width));
  const top = Math.max(m.availTop, Math.min(win.top + Math.round(shiftY * target), m.availTop + m.availHeight - height));

  if (Math.abs(win.width - width) > 1 || Math.abs(win.height - height) > 1 || win.left !== left || win.top !== top) {
    await chrome.windows.update(tab.windowId, { width, height, left, top });
  }
}

// ---- control bar ---------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  handleControl(tabId, sender.tab, msg).then(
    (result) => sendResponse(result ?? {}),
    (e) => {
      console.warn('Device Frame:', msg.type, e);
      sendResponse({ error: String(e?.message ?? e) });
    },
  );
  return true; // async response
});

// Open the bundled user guide in a normal browser window (the frame window
// is a popup, which can't hold extra tabs).
async function openGuide() {
  const url = chrome.runtime.getURL('USER_GUIDE.html');
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  if (win) {
    await chrome.tabs.create({ windowId: win.id, url });
    await chrome.windows.update(win.id, { focused: true });
  } else {
    await chrome.windows.create({ url, type: 'normal' });
  }
}

// Controls that redraw the frame are ignored while recording, so the video
// doesn't change size mid-way.
const REDRAWS = ['set-device', 'set-custom', 'save-preset', 'delete-preset', 'rotate', 'set-pref', 'toggle-toolbar'];

async function handleControl(tabId, tab, msg) {
  const state = (await getFramed())[tabId];
  if (!state) return;
  if (state.recording && REDRAWS.includes(msg.type)) return;
  if (msg.type === 'open-guide') return openGuide();

  switch (msg.type) {
    case 'set-device': {
      if (!isDeviceKey(msg.device, await getLast())) return;
      const next = await updateFramed(tabId, { device: msg.device });
      await saveLast({ device: msg.device });
      await reframe(tabId, next);
      break;
    }
    case 'set-custom': {
      const custom = normalizeCustom(msg.size);
      const next = await updateFramed(tabId, { device: CUSTOM_KEY });
      await saveLast({ device: CUSTOM_KEY, custom });
      await reframe(tabId, next);
      break;
    }
    case 'save-preset': {
      const size = normalizeCustom(msg.size);
      const name = String(msg.name ?? '').trim().slice(0, PRESET_NAME_MAX) || `Saved ${size.width}x${size.height}`;
      const id = Date.now().toString(36);
      const presets = [...((await getLast()).presets ?? []), { id, name, ...size }].slice(-MAX_PRESETS);
      const device = PRESET_PREFIX + id;
      await saveLast({ presets, device, custom: size });
      await reframe(tabId, await updateFramed(tabId, { device }));
      break;
    }
    case 'delete-preset': {
      const last = await getLast();
      const key = PRESET_PREFIX + msg.id;
      const deleted = findPreset(last, key);
      const presets = (last.presets ?? []).filter((p) => p.id !== msg.id);
      if (state.device === key && deleted) {
        // Fall back to Custom at the same size, so the frame doesn't jump.
        const custom = normalizeCustom(deleted);
        await saveLast({ presets, device: CUSTOM_KEY, custom });
        await reframe(tabId, await updateFramed(tabId, { device: CUSTOM_KEY }));
      } else {
        await saveLast({ presets });
        await reframe(tabId, state);
      }
      break;
    }
    case 'rotate': {
      const orientation = state.orientation === 'landscape' ? 'portrait' : 'landscape';
      const next = await updateFramed(tabId, { orientation });
      await saveLast({ orientation });
      await reframe(tabId, next);
      break;
    }
    case 'set-pref': {
      // Background and status bar are global preferences, not per window.
      const prefs = {};
      if (BACKGROUNDS.includes(msg.prefs.background)) prefs.background = msg.prefs.background;
      if (typeof msg.prefs.statusBar === 'boolean') prefs.statusBar = msg.prefs.statusBar;
      if (msg.prefs.frameColor in FRAME_COLORS) prefs.frameColor = msg.prefs.frameColor;
      if (typeof msg.prefs.touch === 'boolean') prefs.touch = msg.prefs.touch;
      if (typeof msg.prefs.mic === 'boolean') prefs.mic = msg.prefs.mic;
      if (typeof msg.prefs.countdown === 'boolean') prefs.countdown = msg.prefs.countdown;
      if (typeof msg.prefs.mupTitle === 'string') prefs.mupTitle = msg.prefs.mupTitle.trim().slice(0, 60);
      await saveLast(prefs);
      await reframe(tabId, state);
      break;
    }
    case 'toggle-toolbar':
      await toggleToolbar(tabId, state);
      break;
    case 'rec-state':
      await updateFramed(tabId, { recording: Boolean(msg.recording) });
      if (!msg.recording) await reframe(tabId, state);
      break;
    case 'refit':
      await fitWindow(tabId, computeLayout(state.device, state.orientation, await getLast()), msg.metrics);
      break;
    case 'screenshot': {
      const L = computeLayout(state.device, state.orientation, await getLast());
      const dataUrl = await captureDevice(tab, L);
      await downloadScreenshot(dataUrl, L);
      return { dataUrl };
    }
  }
}

async function toggleToolbar(tabId, state) {
  const toolbarHidden = !(await getLast()).toolbarHidden;
  await saveLast({ toolbarHidden });
  await reframe(tabId, state, toolbarHidden ? BAR : -BAR);
}

// Keyboard shortcuts (chrome.commands works even when the app swallows keys).
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab) return;
  const state = (await getFramed())[tab.id];
  if (!state) return;
  try {
    if (command === 'toggle-toolbar' && !state.recording) await toggleToolbar(tab.id, state);
    if (command === 'copy-screenshot') await copyScreenshot(tab, state);
    if (command === 'record') await toggleRecording(tab, state);
  } catch (e) {
    console.warn('Device Frame:', command, e);
  }
});

// Record shortcut: chrome.tabCapture needs no share prompt, but only works
// when the extension itself is invoked (a shortcut counts, an in-page click
// doesn't). The stream id is handed to the page, which records as usual.
async function toggleRecording(tab, state) {
  if (state.recording) {
    await chrome.tabs.sendMessage(tab.id, { type: 'df-record-stop' });
    return;
  }
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id, consumerTabId: tab.id });
  await chrome.tabs.sendMessage(tab.id, { type: 'df-record-start', streamId });
}

// Copy-only screenshot: capture in the background, write the clipboard in the page.
async function copyScreenshot(tab, state) {
  const dataUrl = await captureDevice(tab, computeLayout(state.device, state.orientation, await getLast()));
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: copyImageToClipboard, args: [dataUrl] });
}

// { commandName: 'Alt+Shift+H', ... } as currently assigned (may be changed by the user).
async function shortcuts() {
  const commands = await chrome.commands.getAll();
  return Object.fromEntries(commands.map((c) => [c.name, c.shortcut || '']));
}

// Capture the window and cut out just the phone (transparent outside it).
// Returns a PNG data URL.
async function captureDevice(tab, L) {
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());

  const scale = bitmap.width / L.W; // screen pixels per CSS pixel (zoom × DPR)
  const pad = Math.min(6, L.cropPad); // room for the side buttons
  const crop = { x: L.bounds.x - pad, y: L.bounds.y - pad, w: L.bounds.w + pad * 2, h: L.bounds.h + pad * 2 };

  const canvas = new OffscreenCanvas(Math.round(crop.w * scale), Math.round(crop.h * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, crop.x * scale, crop.y * scale, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

  // Keep only the phone body and its buttons.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.setTransform(scale, 0, 0, scale, -crop.x * scale, -crop.y * scale);
  const mask = new Path2D(roundRectPath(L.phone));
  for (const b of L.buttons) mask.rect(b.x, b.y, b.w, b.h);
  for (const e of L.extras) mask.addPath(new Path2D(roundRectPath(e)));
  ctx.fill(mask);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function downloadScreenshot(url, L) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = `${L.deviceName.replace(/[^\w.-]+/g, '-')}-${L.screen.w}x${L.screen.h}`;
  await chrome.downloads.download({ url, filename: `device-frame-${name}-${stamp}.png` });
}

// ---- housekeeping --------------------------------------------------------

chrome.windows.onBoundsChanged.addListener(async (win) => {
  const framed = Object.values(await getFramed());
  if (framed.some((s) => s.windowId === win.id)) await saveLast({ left: win.left, top: win.top });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if ((await getFramed())[tabId]) await updateFramed(tabId, null);
});
