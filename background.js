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
// session: framed[tabId] = { windowId, device, orientation, win, recording, inPlace }
//          (inPlace: framed in its own tab and window, see "This tab" below)
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
  return {
    ...computeLayout(state.device, state.orientation, { ...last, ...(state.win ?? windowPrefs(last)), fill: state.fill ?? null, fillMin: state.fillMin ?? null }),
    inPlace: Boolean(state.inPlace),
  };
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
  if ((await getFramed())[tab.id]?.inPlace) return unframeInPlace(tab.id);
  if ((await getLast()).openHidden !== false) await saveLast({ toolbarHidden: true });
  const last = await getLast();
  if (last.openIn === 'tab') return frameInPlace(tab, last);
  const device = isDeviceKey(last.device, last) ? last.device : DEFAULT_DEVICE;
  const orientation = last.orientation === 'landscape' ? 'landscape' : 'portrait';
  const L = computeLayout(device, orientation, last);
  const current = await chrome.windows.get(tab.windowId);

  const size = {
    url: tab.url,
    type: 'popup',
    incognito: tab.incognito, // keep the Incognito session (logins) when framing from Incognito
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

// "Open the frame in: This tab": frame the tab where it is, in its own window,
// instead of reopening it in a popup. Used when another tool drives the tab
// (e.g. Claude in Chrome, which can only reach tabs in its own tab group).
// The window is sized to the device as a frame window is (same size, zoomed
// out only when the screen is too small); a normal window can't be as narrow
// as a popup, so a narrow phone is centered in the extra width. Clicking the
// icon again removes the frame.
async function frameInPlace(tab, last) {
  const device = isDeviceKey(last.device, last) ? last.device : DEFAULT_DEVICE;
  const orientation = last.orientation === 'landscape' ? 'landscape' : 'portrait';
  await chrome.tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-tab' }).catch(() => {});
  // Maximized: the device stays at its real size, centered in the window ('refit' keeps this up to date).
  const win = await chrome.windows.get(tab.windowId);
  const big = (win.state === 'maximized' || win.state === 'fullscreen') && tab.width > 0 && tab.height > 0;
  const fill = big ? tab.width / tab.height : null;
  const fillMin = big ? { w: tab.width, h: tab.height } : null; // tab size at 100% zoom
  const state = await updateFramed(tab.id, { windowId: tab.windowId, device, orientation, win: windowPrefs(last), inPlace: true, fill, fillMin });
  await reframe(tab.id, state);
}

async function unframeInPlace(tabId) {
  const state = (await getFramed())[tabId];
  if (state?.recording) return; // stop the recording first
  await updateFramed(tabId, null);
  await chrome.tabs.setZoom(tabId, 0).catch(() => {}); // back to the default zoom
  await chrome.tabs.reload(tabId); // the simplest way to undo everything drawn in the page
}

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
    version: chrome.runtime.getManifest().version,
    update: await availableUpdate(),
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

  const win0 = await chrome.windows.get(tab.windowId);
  if (win0.state === 'maximized' || win0.state === 'fullscreen') {
    // Leave the window as it is; zoom so the layout fills it (it was laid out
    // with the window's shape, see 'refit').
    const big = Math.min(3, (m.innerWidth * zoom) / L.W, (m.innerHeight * zoom) / L.H);
    if (Math.abs(big - zoom) > 0.002) await chrome.tabs.setZoom(tabId, big);
    return;
  }
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
  // In place: a new device or rotation starts from its own size again (the
  // width kept for a narrow phone is measured anew by 'refit').
  if (state.inPlace && state.fill && ['set-device', 'set-custom', 'save-preset', 'delete-preset', 'rotate'].includes(msg.type)) {
    const win = await chrome.windows.get(tab.windowId);
    if (win.state === 'normal') await updateFramed(tabId, { fill: null, fillMin: null });
  }
  if (msg.type === 'open-guide') return openGuide();
  if (msg.type === 'download-update') return chrome.downloads.download({ url: LATEST_ZIP });
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
      if (typeof msg.prefs.skipLoading === 'boolean') prefs.skipLoading = msg.prefs.skipLoading;
      if (typeof msg.prefs.countdown === 'boolean') prefs.countdown = msg.prefs.countdown;
      if (typeof msg.prefs.titleRules === 'string') prefs.titleRules = msg.prefs.titleRules.slice(0, 4000);
      if (typeof msg.prefs.iconAlways === 'boolean') prefs.iconAlways = msg.prefs.iconAlways;
      if (typeof msg.prefs.fitWidth === 'boolean') prefs.fitWidth = msg.prefs.fitWidth;
      if (typeof msg.prefs.openHidden === 'boolean') prefs.openHidden = msg.prefs.openHidden;
      if (msg.prefs.lang === 'auto' || LANGS.includes(msg.prefs.lang)) prefs.lang = msg.prefs.lang;
      if (msg.prefs.recordMode === 'device' || msg.prefs.recordMode === 'screen') prefs.recordMode = msg.prefs.recordMode;
      if (msg.prefs.openIn === 'window' || msg.prefs.openIn === 'tab') prefs.openIn = msg.prefs.openIn;
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
    case 'refit': {
      // Maximized (or full screen): keep the window's size and fit the device
      // into it, centered. Back to normal: size the window to the device again.
      const win = await chrome.windows.get(tab.windowId);
      const big = win.state === 'maximized' || win.state === 'fullscreen';
      if (state.inPlace && !big && msg.metrics.innerWidth > layoutFor(state, await getLast()).W + 2) {
        // In place: the window can't get as narrow as the device (a normal
        // window's minimum width), so lay out to the window's shape, centered.
        const fill = msg.metrics.innerWidth / msg.metrics.innerHeight;
        if (!(Math.abs((state.fill ?? 0) - fill) < 0.003) && !state.recording) return reframe(tabId, await updateFramed(tabId, { fill, fillMin: null }));
      }
      const fill = big ? msg.metrics.innerWidth / msg.metrics.innerHeight : null;
      // In place and maximized: the device keeps its real size (see fillMin in computeLayout).
      let fillMin = null;
      if (big && state.inPlace) {
        const zoom = await chrome.tabs.getZoom(tabId);
        fillMin = { w: Math.round(msg.metrics.innerWidth * zoom), h: Math.round(msg.metrics.innerHeight * zoom) };
      }
      const sameMin = (a, b) => (!a && !b) || (a && b && Math.abs(a.w - b.w) <= 2 && Math.abs(a.h - b.h) <= 2);
      const changed = big ? !(Math.abs((state.fill ?? 0) - fill) < 0.003) || !sameMin(state.fillMin, fillMin) : Boolean(state.fill);
      if (changed && !state.recording) await reframe(tabId, await updateFramed(tabId, { fill, fillMin }));
      else await fitWindow(tabId, layoutFor(state, await getLast()), msg.metrics);
      break;
    }
    case 'save-video':
      if (typeof msg.url === 'string' && msg.url.startsWith('blob:')) await saveScenarioVideo(msg.url, msg.ext);
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

// ---- API Recorder link ----------------------------------------------------------
// API Recorder (a separate, private extension) can start and stop the device
// video of a framed tab, so one shortcut records both; it passes the scenario's
// name and folder (the video is saved there) and an idle time to skip. Chrome
// lets us record a tab without a prompt only after the user invoked Device
// Frame on that tab (e.g. clicked the icon to frame it); if that's gone, we say
// so and the user presses the record shortcut instead. Off with the hidden
// option (options.html); nobody else can send these messages.
const COMPANIONS = ['ccmkbiglnhkemogcajbmadphdfffgolm']; // API Recorder (its manifest key fixes this id)

// The scenario video waiting to be saved: { file, folder } (see saveScenarioVideo below).
let pendingVideo; // undefined until read from session storage
chrome.storage.session.get('pendingVideo').then((r) => { if (pendingVideo === undefined) pendingVideo = r.pendingVideo ?? null; });
async function setPendingVideo(value) {
  pendingVideo = value;
  if (value) await chrome.storage.session.set({ pendingVideo: value });
  else await chrome.storage.session.remove('pendingVideo');
}

// File-name safe, no spaces (the video's file name).
const safeFile = (name) => String(name || '').replace(/[\/:*?"<>|]+/g, '_').trim()
  .replace(/\s*[-–—]\s*/g, '-').replace(/\s+/g, '_').slice(0, 80); // "SKU Level ASN – Different UOMs" -> "SKU_Level_ASN-Different_UOMs"

// Download names. Chrome lets only the most recently installed extension with
// a downloads.onDeterminingFilename listener name downloads, and one that
// doesn't name a download loses its name (e.g. "download (1)"). So Device Frame
// has no such listener (it would take names away from API Recorder's files);
// when API Recorder is installed, we tell it the name of each download we
// start, and its listener names it. Without API Recorder nothing changes.
async function announceDownload(url, filename) {
  await chrome.runtime.sendMessage(COMPANIONS[0], { type: 'name-download', url, filename }).catch(() => {});
}

// API Recorder's scenario video (the page hands over its blob URL): into the
// scenario's folder as "<scenario name>.mp4", else Downloads as "<name>_<time>.mp4".
async function saveScenarioVideo(url, ext) {
  if (pendingVideo === undefined) pendingVideo = (await chrome.storage.session.get('pendingVideo')).pendingVideo ?? null;
  const p = pendingVideo ?? { file: 'Scenario', folder: '' };
  await setPendingVideo(null);
  const d = new Date();
  const stamp = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
  const kind = ext === 'webm' ? 'webm' : 'mp4';
  const filename = p.folder ? `${p.folder}/${p.file}.${kind}` : `${p.file}_${stamp}.${kind}`;
  await announceDownload(url, filename);
  await chrome.downloads.download({ url, filename, conflictAction: 'uniquify' });
}

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (!COMPANIONS.includes(sender.id) || msg?.type !== 'video') return;
  (async () => {
    if ((await getLast()).companionLink === false) return { ok: false, error: 'link-off' };
    const tabId = Number(msg.tabId);
    const state = (await getFramed())[tabId];
    if (!state) return { ok: false, error: 'not-framed' };
    if (msg.action === 'status') return { ok: true, recording: Boolean(state.recording) };
    if (msg.action === 'stop') {
      if (state.recording) await chrome.tabs.sendMessage(tabId, { type: 'df-record-stop' }).catch(() => {});
      return { ok: true };
    }
    if (msg.action === 'start') {
      if (state.recording) return { ok: true, already: true };
      try {
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: tabId });
        const file = safeFile(msg.name) || 'Scenario';
        const folder = typeof msg.folder === 'string' ? msg.folder.replace(/[\\:*?"<>|]+/g, '_').replace(/^\/+|\/+$/g, '') : '';
        await setPendingVideo({ file, folder });
        const idleMs = Math.max(0, Math.min(60000, Number(msg.idleMs) || 0));
        await chrome.tabs.sendMessage(tabId, { type: 'df-record-start', streamId, companion: { file, idleMs } });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }
    return { ok: false, error: 'unknown action' };
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e?.message ?? e) }));
  return true;
});

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
    for (const part of L.stand ? [L.stand.neck, L.stand.foot] : []) mask.addPath(new Path2D(part));
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
  await announceDownload(url, `${name}_${stamp}.png`);
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

// ---- updates ---------------------------------------------------------------
// Colleagues load the extension unpacked, so Chrome can't update it. About
// twice a day we ask GitHub for the latest release; when it's newer, the
// settings panel's version link turns blue and downloads the zip.

const LATEST_RELEASE_API = 'https://api.github.com/repos/sidmsmith/device-frame-extension/releases/latest';
const LATEST_ZIP = 'https://github.com/sidmsmith/device-frame-extension/releases/latest/download/device_frame_extension.zip';
const UPDATE_CHECK_EVERY = 12 * 60 * 60 * 1000;

// True if version a (e.g. "0.23.0") is newer than b.
function isNewer(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

// The newer version to offer, or null. Starts a background check when the
// last one is old (the frames are redrawn if it finds something new).
async function availableUpdate() {
  const { updateCheck } = await chrome.storage.local.get('updateCheck');
  if (!updateCheck || Date.now() - updateCheck.at > UPDATE_CHECK_EVERY) checkForUpdate(updateCheck);
  const latest = updateCheck?.latest;
  return latest && isNewer(latest, chrome.runtime.getManifest().version) ? latest : null;
}

let updateChecking = false;
async function checkForUpdate(previous) {
  if (updateChecking) return;
  updateChecking = true;
  let latest = previous?.latest ?? null;
  try {
    const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (res.ok) latest = String((await res.json()).tag_name ?? '').replace(/^v/i, '') || latest;
  } catch {
    // Offline or blocked: keep what we knew, try again next time.
  }
  await chrome.storage.local.set({ updateCheck: { at: Date.now(), latest } });
  updateChecking = false;
  if (latest !== (previous?.latest ?? null)) await reframeAll();
}

// ---- housekeeping --------------------------------------------------------

chrome.windows.onBoundsChanged.addListener(async (win) => {
  const framed = Object.values(await getFramed());
  if (framed.some((s) => s.windowId === win.id && !s.inPlace)) await saveLast({ left: win.left, top: win.top });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if ((await getFramed())[tabId]) await updateFramed(tabId, null);
});
