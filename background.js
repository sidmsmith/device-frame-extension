// Device Frame - background service worker.
//
// Clicking the toolbar icon reopens the current page as the top-level page of
// a popup window (no iframe, so cookies, storage and CSRF protection behave
// exactly as in a normal tab). After each page load we inject drawFrame()
// (frame.js), which pins <body> into the "screen" area and draws the bezel
// and control bar, then size the window to fit and use per-tab zoom to shrink
// it when the device is bigger than the screen.

importScripts('devices.js', 'frame.js', 'i18n.js');

// ---- state ---------------------------------------------------------------
// session: framed[tabId] = { windowId, device, orientation, win, recording }
//          (win: this window's look, see WINDOW_PREFS)
//          screenRec = { tabId, started, mic } while an "Entire screen" recording runs
// local:   last = { device, orientation, left, top, background, statusBar, custom,
//                   toolbarHidden, frameColor, touch, mic, countdown, titleRules, iconAlways, fitWidth, openHidden, lang, recordMode, presets: [{ id, name, width, height }] }

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

// Settings that belong to each frame window (how it looks). Every other
// setting (recording, title renames, tab icon, language, open hidden) is
// shared by all frames. 'last' keeps the latest choice of each, which is
// how new windows start.
const WINDOW_PREFS = ['background', 'frameColor', 'statusBar', 'touch', 'fitWidth', 'toolbarHidden'];

// A new window's look, from the latest choices (defaults as in computeLayout).
function windowPrefs(last) {
  return {
    background: BACKGROUNDS.includes(last.background) ? last.background : BACKGROUNDS[0],
    frameColor: last.frameColor in FRAME_COLORS ? last.frameColor : 'black',
    statusBar: Boolean(last.statusBar),
    touch: Boolean(last.touch),
    fitWidth: last.fitWidth !== false,
    toolbarHidden: Boolean(last.toolbarHidden),
  };
}

// Layout for one frame window: shared settings plus this window's own.
function layoutFor(state, last) {
  return computeLayout(state.device, state.orientation, { ...last, ...(state.win ?? windowPrefs(last)) });
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

  // "Open with toolbar hidden" (default on): start every frame window with the
  // toolbar hidden, whatever it was last time.
  if ((await getLast()).openHidden !== false) await saveLast({ toolbarHidden: true });
  const last = await getLast();
  const device = isDeviceKey(last.device, last) ? last.device : DEFAULT_DEVICE;
  const orientation = last.orientation === 'landscape' ? 'landscape' : 'portrait';
  const L = computeLayout(device, orientation, last);
  const current = await chrome.windows.get(tab.windowId);

  const size = {
    url: tab.url,
    type: 'popup',
    width: L.W + 16, // rough guess; corrected after the first load
    height: Math.min(L.H + 40, current.height),
  };
  // Last time's position, unless Chrome rejects it as off-screen (e.g. a
  // monitor was unplugged): then next to the current window, then anywhere.
  const win = await chrome.windows.create({ ...size, left: last.left ?? current.left + 60, top: last.top ?? current.top })
    .catch(() => chrome.windows.create({ ...size, left: current.left + 60, top: current.top }))
    .catch(() => chrome.windows.create(size));
  const tabId = win.tabs[0].id;

  await updateFramed(tabId, { windowId: win.id, device, orientation, win: windowPrefs(last) });
  // Keep zoom changes to this tab only, so normal tabs on the same site are untouched.
  await chrome.tabs.setZoomSettings(tabId, { mode: 'automatic', scope: 'per-tab' }).catch(() => {});
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
  // Keep zoom changes to this tab only (in case it couldn't be set at open).
  await chrome.tabs.setZoomSettings(tabId, { mode: 'automatic', scope: 'per-tab' }).catch(() => {});
  await reframe(tabId, state);
}

async function reframe(tabId, state, shiftY = 0) {
  const keys = await shortcuts();
  const { tabIcon } = await chrome.storage.local.get('tabIcon');
  const last = await getLast();
  // Windows opened before their look was per window: pin it now.
  if (!state.win) {
    const win = windowPrefs(last);
    if (typeof state.toolbarHidden === 'boolean') win.toolbarHidden = state.toolbarHidden;
    state = await updateFramed(tabId, { win });
  }
  const L = {
    ...layoutFor(state, last),
    lang: LANGS.includes(last.lang) ? last.lang : 'auto',
    recordMode: last.recordMode === 'screen' ? 'screen' : 'device',
    screenRec: await getScreenRec(),
    t: await uiText(last.lang),
    shortcut: keys['toggle-toolbar'], copyShortcut: keys['copy-screenshot'], recordShortcut: keys.record,
    tabIcon: tabIcon ?? null,
  };
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
  // The screen recording window (recorder.html) reporting progress.
  if (msg?.target === 'background') {
    handleRecorder(msg).then((result) => sendResponse(result ?? {}), () => sendResponse({}));
    return true;
  }
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
  if (msg.type === 'set-icon') {
    // Tab icon for renamed tabs (title.js applies it). Kept outside 'last'
    // so the image isn't re-read with every other setting.
    const ok = typeof msg.dataUrl === 'string' && msg.dataUrl.startsWith('data:image/png;base64,') && msg.dataUrl.length < 300_000;
    if (ok) await chrome.storage.local.set({ tabIcon: msg.dataUrl });
    else await chrome.storage.local.remove('tabIcon');
    await reframeAll();
    return;
  }

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
      const prefs = {};
      if (BACKGROUNDS.includes(msg.prefs.background)) prefs.background = msg.prefs.background;
      if (typeof msg.prefs.statusBar === 'boolean') prefs.statusBar = msg.prefs.statusBar;
      if (msg.prefs.frameColor in FRAME_COLORS) prefs.frameColor = msg.prefs.frameColor;
      if (typeof msg.prefs.touch === 'boolean') prefs.touch = msg.prefs.touch;
      if (typeof msg.prefs.mic === 'boolean') prefs.mic = msg.prefs.mic;
      if (typeof msg.prefs.systemAudio === 'boolean') prefs.systemAudio = msg.prefs.systemAudio;
      if (typeof msg.prefs.countdown === 'boolean') prefs.countdown = msg.prefs.countdown;
      if (typeof msg.prefs.titleRules === 'string') prefs.titleRules = msg.prefs.titleRules.slice(0, 4000);
      if (typeof msg.prefs.iconAlways === 'boolean') prefs.iconAlways = msg.prefs.iconAlways;
      if (typeof msg.prefs.fitWidth === 'boolean') prefs.fitWidth = msg.prefs.fitWidth;
      if (typeof msg.prefs.openHidden === 'boolean') prefs.openHidden = msg.prefs.openHidden;
      if (msg.prefs.lang === 'auto' || LANGS.includes(msg.prefs.lang)) prefs.lang = msg.prefs.lang;
      if (msg.prefs.recordMode === 'device' || msg.prefs.recordMode === 'screen') prefs.recordMode = msg.prefs.recordMode;
      // Everything is remembered for new windows; this window's own look
      // changes only here, shared settings redraw every frame.
      await saveLast(prefs);
      const own = Object.fromEntries(Object.entries(prefs).filter(([k]) => WINDOW_PREFS.includes(k)));
      if (Object.keys(own).length) {
        await updateFramed(tabId, { win: { ...(state.win ?? windowPrefs(await getLast())), ...own } });
      }
      if (Object.keys(prefs).some((k) => !WINDOW_PREFS.includes(k))) await reframeAll();
      else await reframe(tabId, (await getFramed())[tabId]);
      break;
    }
    case 'toggle-toolbar':
      await toggleToolbar(tabId, state);
      break;
    case 'screen-start':
      await startScreenRecording(tabId);
      break;
    case 'screen-stop':
      await stopScreenRecording();
      break;
    case 'rec-state':
      await updateFramed(tabId, { recording: Boolean(msg.recording) });
      if (!msg.recording) await reframe(tabId, state);
      break;
    case 'refit':
      await fitWindow(tabId, layoutFor(state, await getLast()), msg.metrics);
      break;
    case 'screenshot': {
      const L = layoutFor(state, await getLast());
      const dataUrl = await captureDevice(tab, L);
      await downloadScreenshot(dataUrl, L);
      return { dataUrl };
    }
  }
}

async function toggleToolbar(tabId, state) {
  const win = state.win ?? windowPrefs(await getLast());
  const toolbarHidden = !win.toolbarHidden;
  const next = await updateFramed(tabId, { win: { ...win, toolbarHidden } });
  await saveLast({ toolbarHidden }); // new windows start the same way
  await reframe(tabId, next, toolbarHidden ? BAR : -BAR);
}

// Keyboard shortcuts (chrome.commands works even when the app swallows keys).
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab) return;
  const state = (await getFramed())[tab.id];
  try {
    // A screen recording can be stopped from any window.
    if (command === 'record' && (await getScreenRec())) return await stopScreenRecording();
    if (!state) return;
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
  if (!state.recording && (await getLast()).recordMode === 'screen') return startScreenRecording(tab.id);
  if (state.recording) {
    await chrome.tabs.sendMessage(tab.id, { type: 'df-record-stop' });
    return;
  }
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id, consumerTabId: tab.id });
  await chrome.tabs.sendMessage(tab.id, { type: 'df-record-start', streamId });
}

// Copy-only screenshot: capture in the background, write the clipboard in the page.
async function copyScreenshot(tab, state) {
  const last = await getLast();
  const dataUrl = await captureDevice(tab, layoutFor(state, last));
  const t = await uiText(last.lang);
  const msgs = { copied: t.msgCopied, blocked: t.msgClipBlocked };
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: copyImageToClipboard, args: [dataUrl, msgs] });
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
  if (L.skin) {
    // Photo devices: the skin image's own outline (plus the screen) is the
    // mask. Built on its own canvas, since each destination-in draw would
    // erase everything outside itself.
    const skin = await createImageBitmap(await (await fetch(L.skin.url)).blob());
    const { W, H, screen, x, y, landscape } = L.skin;
    const maskCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const m = maskCanvas.getContext('2d');
    m.setTransform(scale, 0, 0, scale, -crop.x * scale, -crop.y * scale);
    if (landscape) m.transform(0, -1, 1, 0, x, y + W); // rotate -90deg about the device origin
    else m.translate(x, y);
    m.drawImage(skin, 0, 0, W, H);
    m.fillRect(screen.x, screen.y, screen.w, screen.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(maskCanvas, 0, 0);
  } else {
    const mask = new Path2D();
    for (const s of L.silhouette ?? [L.phone]) mask.addPath(new Path2D(roundRectPath(s)));
    for (const b of L.buttons) mask.rect(b.x, b.y, b.w, b.h);
    for (const e of L.extras) mask.addPath(new Path2D(roundRectPath(e)));
    ctx.fill(mask);
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function downloadScreenshot(url, L) {
  // e.g. ZebraTC72_20261003141530.png, like the recordings (local time).
  const d = new Date();
  const stamp = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0')).join('');
  const name = L.deviceName.replace(/[^A-Za-z0-9-]+/g, '') || 'Device';
  await chrome.downloads.download({ url, filename: `${name}_${stamp}.png` });
}

// ---- screen recording ----------------------------------------------------
// "Entire screen" recordings run in their own small window (recorder.html):
// Chrome's screen picker must be shown by an extension page, and only that
// page may record the chosen screen. The window minimizes itself while
// recording and reports back here: countdown -> started -> done.

async function getScreenRec() {
  return (await chrome.storage.session.get('screenRec')).screenRec ?? null;
}

async function setScreenRec(rec) {
  if (rec) await chrome.storage.session.set({ screenRec: rec });
  else await chrome.storage.session.remove('screenRec');
}

function tabToast(tabId, text, ms) {
  if (tabId) chrome.tabs.sendMessage(tabId, { type: 'df-toast', text, ms }).catch(() => {});
}

// Redraw every frame window (the record button shows the screen recording).
async function reframeAll() {
  for (const [tabId, state] of Object.entries(await getFramed())) {
    if (!state.recording) await reframe(Number(tabId), state).catch(() => {});
  }
}

async function startScreenRecording(tabId) {
  if (await getScreenRec()) return;
  // Already picking a screen? Bring that window back instead of a second one.
  const { screenPicking } = await chrome.storage.session.get('screenPicking');
  if (screenPicking && (await chrome.windows.update(screenPicking, { focused: true, state: 'normal' }).catch(() => null))) return;
  // Big enough for Chrome's screen picker; recorder.js centers it on its screen.
  const size = { url: `recorder.html?tab=${tabId}`, type: 'popup', width: 1000, height: 760, focused: true };
  const frameWin = await chrome.windows.get((await getFramed())[tabId]?.windowId ?? -1).catch(() => null);
  const near = frameWin ? { left: frameWin.left, top: frameWin.top } : {};
  const win = await chrome.windows.create({ ...size, ...near }).catch(() => chrome.windows.create(size));
  await chrome.storage.session.set({ screenPicking: win.id });
}

async function stopScreenRecording() {
  const rec = await getScreenRec();
  if (!rec) return;
  // The window answers with 'screen-done'; if it's gone, just clear the state.
  const window = await chrome.windows.get(rec.windowId).catch(() => null);
  if (window) await chrome.runtime.sendMessage({ target: 'recorder', type: 'stop' }).catch(() => {});
  else await screenEnded(rec, null);
}

async function handleRecorder(msg) {
  const t = await uiText((await getLast()).lang);
  switch (msg.type) {
    case 'screen-countdown': {
      if (msg.micError) tabToast(msg.tabId, t.msgMicUnavailable.replace('$1', msg.micError), 6000);
      const state = (await getFramed())[msg.tabId];
      if (msg.countdown && state) {
        await chrome.windows.update(state.windowId, { focused: true }).catch(() => {});
        await chrome.tabs.sendMessage(msg.tabId, { type: 'df-countdown' }).catch(() => {});
      }
      return;
    }
    case 'screen-started':
      await chrome.storage.session.remove('screenPicking');
      await setScreenRec({ tabId: msg.tabId, windowId: msg.windowId, started: Date.now(), mic: Boolean(msg.mic) });
      await reframeAll();
      return;
    case 'screen-done': {
      await chrome.storage.session.remove('screenPicking');
      const message = msg.canceled ? t.msgRecCanceled
        : msg.saved ? (msg.error ? t.msgRecStoppedEarly.replace('$1', msg.error) : msg.saved === 'mp4' ? t.msgRecSaved : t.msgRecSavedWebm)
        : t.msgRecFailed.replace('$1', msg.error || t.whyUnknown);
      await screenEnded({ tabId: msg.tabId }, message, msg.error ? 8000 : 2500);
    }
  }
}

async function screenEnded(rec, message, ms) {
  await setScreenRec(null);
  await reframeAll();
  if (message) tabToast(rec?.tabId, message, ms);
}

// The recording window was closed by hand mid-recording: nothing was saved.
chrome.windows.onRemoved.addListener(async (windowId) => {
  const rec = await getScreenRec();
  if (rec?.windowId !== windowId) return;
  await screenEnded(rec, (await uiText((await getLast()).lang)).msgRecWindowClosed, 8000);
});

// ---- housekeeping --------------------------------------------------------

chrome.windows.onBoundsChanged.addListener(async (win) => {
  const framed = Object.values(await getFramed());
  if (framed.some((s) => s.windowId === win.id)) await saveLast({ left: win.left, top: win.top });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if ((await getFramed())[tabId]) await updateFramed(tabId, null);
});
