// Device Frame - the parts only Demo Scenario Recorder uses (its build loads this file
// after background.js, see demo_scenario_recorder/build.py). The standalone extension
// doesn't load it: there the icon opens a frame window, nothing else.
//
// Built into the recorder: a recording's device frames the tab where it is (no new
// window, no reload), so the click that started the recording also lets us record the
// tab's video; the scenario's video is saved with the scenario's name; Chrome's
// debugging banner gets room below every device (see layoutFor); the toggle-frame
// command frames / unframes the tab.

// A fixed desktop size that fits a laptop screen at the normal zoom (with room for the
// debugging banner): the same picture size on every computer, other windows visible.
DEVICES.desktop720 = {
  name: 'Desktop 1280×720 (no frame)', width: 1280, height: 720,
  bezel: { side: 0, top: 0, bottom: 0 }, radius: 0, screenRadius: 0,
  colors: ['#000000', '#000000'], style: 'bare', fixedColor: true, group: 'full',
  fixedOrientation: true, noStatusBar: true, margin: 0, cropPad: 0,
};

// The recording's device ("frame"): the tab is framed where it is in that device, toolbar
// hidden - or switched to it if it's framed already; the answer comes once the frame is
// drawn and the window has settled.
async function frameForCompanion(tabId, device) {
  const tab = await chrome.tabs.get(tabId);
  if (!/^https?:/i.test(tab.url || '')) return { ok: false, error: 'this page cannot be framed' };
  if (!isDeviceKey(device, await getLast())) return { ok: false, error: `unknown device ${device}` };
  const framed = (await getFramed())[tabId];
  if (framed?.recording) return { ok: false, error: 'already recording' };
  if (!framed) {
    // A maximized window is made normal first, so it can be sized to the device.
    const win = await chrome.windows.get(tab.windowId);
    if (win.state === 'maximized' || win.state === 'fullscreen') await chrome.windows.update(tab.windowId, { state: 'normal' });
    await saveLast({ device, orientation: 'portrait', toolbarHidden: true });
    await frameInPlace(await chrome.tabs.get(tabId), await getLast());
  } else {
    let next = framed;
    if (framed.device !== device || framed.orientation !== 'portrait') next = await updateFramed(tabId, { device, orientation: 'portrait' });
    if (next.win && !next.win.toolbarHidden) next = await updateFramed(tabId, { win: { ...next.win, toolbarHidden: true } });
    await saveLast({ device, orientation: 'portrait' });
    if (next !== framed) await reframe(tabId, next);
  }
  // Ready: the frame drawn in the page, then a moment for the window to settle.
  for (let i = 0; i < 60; i += 1) {
    const drawn = await chrome.scripting.executeScript({ target: { tabId }, func: () => Boolean(document.getElementById('__devframe')) })
      .then(([r]) => r?.result, () => false);
    if (drawn) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 1200));
  return { ok: true, tabId };
}

// Frame the tab where it is, in its own window: the window is sized to the device as a
// frame window is (zoomed out only when the screen is too small); a normal window can't
// be as narrow as a popup, so a narrow phone is centered in the extra width.
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

// The scenario video waiting to be saved: { file, folder } (see saveScenarioVideo below).
let pendingVideo; // undefined until read from session storage
chrome.storage.session.get('pendingVideo').then((r) => { if (pendingVideo === undefined) pendingVideo = r.pendingVideo ?? null; });
async function setPendingVideo(value) {
  pendingVideo = value;
  if (value) await chrome.storage.session.set({ pendingVideo: value });
  else await chrome.storage.session.remove('pendingVideo');
}

// File-name safe, no spaces (the video's file name).
const safeFile = (name) => String(name || '').replace(/[\\/:*?"<>|]+/g, '_').trim()
  .replace(/\s*[-–—]\s*/g, '-').replace(/\s+/g, '_').slice(0, 80); // "SKU Level ASN – Different UOMs" -> "SKU_Level_ASN-Different_UOMs"

// The scenario video (the page hands over its blob URL): into the scenario's folder as
// "<scenario name>.mp4", else Downloads as "<name>_<time>.mp4". The recorder names our
// downloads (it has the downloads.onDeterminingFilename listener).
async function saveScenarioVideo(url, ext) {
  if (pendingVideo === undefined) pendingVideo = (await chrome.storage.session.get('pendingVideo')).pendingVideo ?? null;
  const p = pendingVideo ?? { file: 'Scenario', folder: '' };
  await setPendingVideo(null);
  const d = new Date();
  const stamp = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
  const kind = ext === 'webm' ? 'webm' : 'mp4';
  const filename = p.folder ? `${p.folder}/${p.file}.${kind}` : `${p.file}_${stamp}.${kind}`;
  if (typeof noteDownloadName === 'function') noteDownloadName(url, filename);
  await chrome.downloads.download({ url, filename, conflictAction: 'uniquify' });
}

// The recorder's requests (video start / stop / status, frame in a device, unframe),
// called directly (rec/background.js).
async function companionRequest(msg) {
  const tabId = Number(msg.tabId);
  if (msg.action === 'frame') return frameForCompanion(tabId, String(msg.device || ''));
  const state = (await getFramed())[tabId];
  if (msg.action === 'framed') return { ok: true, framed: Boolean(state), device: state?.device ?? null, inPlace: Boolean(state?.inPlace) };
  if (!state) return { ok: false, error: 'not-framed' };
  if (msg.action === 'unframe') {
    if (state.recording) return { ok: false, error: 'recording' };
    if (state.inPlace) await unframeInPlace(tabId);
    else await chrome.windows.remove(state.windowId).catch(() => {});
    return { ok: true };
  }
  if (msg.action === 'status') return { ok: true, recording: Boolean(state.recording) };
  if (msg.action === 'stop') {
    if (state.companionWait) {
      await updateFramed(tabId, { companionWait: null });
      await chrome.tabs.sendMessage(tabId, { type: 'df-toast-hide' }).catch(() => {});
    }
    if (state.recording) await chrome.tabs.sendMessage(tabId, { type: 'df-record-stop' }).catch(() => {});
    return { ok: true };
  }
  if (msg.action === 'start') {
    if (state.recording) return { ok: true, already: true };
    const file = safeFile(msg.name) || 'Scenario';
    const folder = typeof msg.folder === 'string' ? msg.folder.replace(/[\\:*?"<>|]+/g, '_').replace(/^\/+|\/+$/g, '') : '';
    const idleMs = Math.max(0, Math.min(60000, Number(msg.idleMs) || 0));
    await setPendingVideo({ file, folder });
    try {
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: tabId });
      await chrome.tabs.sendMessage(tabId, { type: 'df-record-start', streamId, companion: { file, idleMs } });
      return { ok: true };
    } catch (e) {
      // Chrome records a tab only after the extension was invoked in it (a click or a
      // shortcut). If that's gone: ask for the record shortcut, big, in the device window;
      // pressing it starts this scenario's video (see startWaitingVideo).
      await updateFramed(tabId, { companionWait: { file, idleMs } });
      const key = (await shortcuts()).record || 'the record shortcut';
      await chrome.tabs.sendMessage(tabId, { type: 'df-toast', text: `Press ${key} to start the video`, ms: 600000, big: true }).catch(() => {});
      return { ok: false, error: `press ${key}`, detail: String(e?.message ?? e) };
    }
  }
  return { ok: false, error: 'unknown action' };
}

// The record shortcut while a scenario video waits for it: same name, folder and size.
async function startWaitingVideo(tab, state, streamId) {
  await chrome.tabs.sendMessage(tab.id, { type: 'df-record-start', streamId, companion: state.companionWait });
  await updateFramed(tab.id, { companionWait: null });
  if (typeof noteVideoStarted === 'function') noteVideoStarted(tab.id);
}

// toggle-frame: the last device, framed where the tab is; again to take the frame off.
async function toggleFrameHere(tab, state) {
  if (!state) {
    if (/^https?:/i.test(tab.url || '')) await frameForCompanion(tab.id, (await getLast()).device || DEFAULT_DEVICE);
  } else if (!state.recording) {
    if (state.inPlace) await unframeInPlace(tab.id);
    else await chrome.windows.remove(state.windowId).catch(() => {});
  }
}
