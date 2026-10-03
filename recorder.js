// Device Frame - "Entire screen" recording window (recorder.html).
//
// The background opens this small window when a screen recording starts.
// Chrome's screen picker (desktopCapture) has to be shown by an extension page,
// and only that page may use the chosen screen, so the recording happens here:
// pick the screen, minimize this window (so it isn't in the video), let the
// frame window run the 3-2-1 countdown, record, then save to Downloads. Being
// its own window, the recording continues across page loads and while other
// windows are in front.

const frameTab = Number(new URLSearchParams(location.search).get('tab'));
const $ = (id) => document.getElementById(id);
const toBackground = (type, extra = {}) =>
  chrome.runtime.sendMessage({ target: 'background', type, tabId: frameTab, ...extra }).catch(() => null);

let stream = null;   // the screen (plus system audio, if shared)
let mic = null;      // microphone, optional
let audioCtx = null; // mixes system audio and microphone into one track
let recorder = null;
let ended = false;   // sharing stopped before recording started
let finished = false;

(async () => {
  const { last = {} } = await chrome.storage.local.get('last');
  const t = await uiText(last.lang);
  document.title = t.recWinTitle;
  $('title').textContent = t.recWinTitle;
  $('status').textContent = t.recWinPicking;
  $('stop').textContent = t.btnStopSave;
  $('stop').addEventListener('click', stop);
  chrome.runtime.onMessage.addListener((msg) => { if (msg?.target === 'recorder' && msg.type === 'stop') stop(); });

  // Center this window on its screen, sized for Chrome's screen picker.
  const win = await chrome.windows.getCurrent();
  const pickW = Math.min(1000, screen.availWidth), pickH = Math.min(760, screen.availHeight);
  await chrome.windows.update(win.id, {
    width: pickW, height: pickH,
    left: Math.round(screen.availLeft + (screen.availWidth - pickW) / 2),
    top: Math.round(screen.availTop + (screen.availHeight - pickH) / 2),
  }).catch(() => {});

  // 'audio' adds Chrome's "Also share system audio" option (the computer's sound).
  const sources = last.systemAudio ? ['screen', 'audio'] : ['screen'];
  const { id, audio } = await new Promise((resolve) => {
    chrome.desktopCapture.chooseDesktopMedia(sources, (streamId, options) => {
      resolve({ id: streamId, audio: Boolean(options?.canRequestAudioTrack) });
    });
  });
  if (!id) return finish({ canceled: true });

  try {
    const source = { chromeMediaSource: 'desktop', chromeMediaSourceId: id };
    stream = await navigator.mediaDevices.getUserMedia({
      audio: audio ? { mandatory: source } : false,
      video: { mandatory: { ...source, maxWidth: 3840, maxHeight: 2160, maxFrameRate: 30 } },
    });
  } catch (e) {
    return finish({ error: `${e.name}: ${e.message}` });
  }
  // Chrome's "Stop sharing" button ends the track.
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    if (recorder) stop();
    else ended = true;
  });
  // Microphone: Chrome asks here the first time (this window is visible).
  let micError = null;
  if (last.mic) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      micError = e.name;
    }
  }

  // Out of the way before the countdown, so this window isn't recorded
  // (small, so it doesn't cover the screen if you bring it back).
  await chrome.windows.update(win.id, { width: 420, height: 190 }).catch(() => {});
  await chrome.windows.update(win.id, { state: 'minimized' });
  await toBackground('screen-countdown', { micError, countdown: last.countdown !== false });
  if (ended || finished) return finish({ error: t.whyCaptureEnded });

  const video = stream.getVideoTracks();
  const audioTracks = [...stream.getAudioTracks(), ...(mic?.getAudioTracks() ?? [])];
  // MediaRecorder only records one audio track: mix them if there are two.
  let tracks = [...video, ...audioTracks];
  if (audioTracks.length > 1) {
    audioCtx = new AudioContext();
    const mix = audioCtx.createMediaStreamDestination();
    for (const track of audioTracks) audioCtx.createMediaStreamSource(new MediaStream([track])).connect(mix);
    await audioCtx.resume().catch(() => {});
    tracks = [...video, ...mix.stream.getAudioTracks()];
  }
  const hasAudio = tracks.length > video.length;
  // AAC audio in MP4 so PowerPoint can play it (same choices as the device recording).
  const mime = (hasAudio
    ? ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'])
    .find((type) => MediaRecorder.isTypeSupported(type));
  // Bitrate follows the screen size: about 6 Mbps at 1080p, capped for 4K.
  const { width = 1920, height = 1080 } = video[0].getSettings();
  const bits = Math.min(20_000_000, Math.max(4_000_000, Math.round(width * height * 3)));

  const chunks = [];
  let error = null;
  recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: bits, audioBitsPerSecond: 128_000 });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onerror = (e) => { error = `${e.error?.name || 'error'}: ${e.error?.message || 'the recorder stopped'}`; };
  recorder.onstop = async () => {
    release();
    clearInterval(timer);
    $('dot').className = 'dot';
    $('stop').hidden = true;
    $('status').textContent = t.recWinSaving;
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    if (!blob.size) return finish({ error: error || t.whyUnknown });
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    // e.g. FullScreen_20261003141530.mp4 (local time)
    const stamp = (d = new Date()) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
    const url = URL.createObjectURL(blob);
    try {
      const id = await chrome.downloads.download({ url, filename: `FullScreen_${stamp()}.${ext}` });
      await downloadFinished(id);
      finish({ saved: ext, error });
    } catch (e) {
      finish({ error: e.message || String(e) });
    }
  };
  recorder.start(1000);

  const started = Date.now();
  await toBackground('screen-started', { mic: Boolean(mic), windowId: win.id });
  $('status').textContent = t.recWinRecording;
  $('dot').className = 'dot on';
  $('stop').hidden = false;
  const tick = () => {
    const secs = Math.floor((Date.now() - started) / 1000);
    $('time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };
  tick();
  const timer = setInterval(tick, 500);
})();

function stop() {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  else {
    ended = true;
    if (!recorder) finish({ canceled: true });
  }
}

function release() {
  stream?.getTracks().forEach((track) => track.stop());
  mic?.getTracks().forEach((track) => track.stop());
  audioCtx?.close().catch(() => {});
  stream = mic = audioCtx = null;
}

// Tell the background how it went, then close this window.
async function finish(result) {
  if (finished) return;
  finished = true;
  release();
  await toBackground('screen-done', result);
  window.close();
}

function downloadFinished(id) {
  return new Promise((resolve) => {
    const done = () => {
      chrome.downloads.onChanged.removeListener(listener);
      clearTimeout(timeout);
      resolve();
    };
    const listener = (delta) => {
      if (delta.id === id && ['complete', 'interrupted'].includes(delta.state?.current)) done();
    };
    const timeout = setTimeout(done, 120000);
    chrome.downloads.onChanged.addListener(listener);
  });
}
