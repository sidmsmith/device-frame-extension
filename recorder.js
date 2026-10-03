// Device Frame - screen recorder (offscreen document, recorder.html).
//
// "Entire screen" recordings live here rather than in the framed page, so
// they keep going across page loads and while you switch to other windows.
// The background picks the screen with Chrome's picker (desktopCapture) and
// drives this page with messages: acquire -> (countdown) -> go -> stop.
// When the recording ends, for whatever reason, we send 'screen-done' with a
// blob URL for the background to download.

let stream = null;   // the screen (plus system audio, if shared)
let mic = null;      // microphone, optional
let audioCtx = null; // mixes system audio and microphone into one track
let recorder = null;
let ended = false;   // sharing stopped before recording started

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== 'recorder') return;
  const handler = handlers[msg.type];
  if (!handler) return;
  handler(msg).then(
    (result) => sendResponse(result ?? {}),
    (e) => sendResponse({ error: `${e.name || 'Error'}: ${e.message || e}` }),
  );
  return true; // async response
});

const handlers = {
  async 'mic-permission'() {
    return { state: (await navigator.permissions.query({ name: 'microphone' })).state };
  },

  async acquire({ streamId, audio, mic: wantMic }) {
    release();
    ended = false;
    const source = { chromeMediaSource: 'desktop', chromeMediaSourceId: streamId };
    stream = await navigator.mediaDevices.getUserMedia({
      audio: audio ? { mandatory: source } : false,
      video: { mandatory: { ...source, maxWidth: 3840, maxHeight: 2160, maxFrameRate: 30 } },
    });
    // Chrome's "Stop sharing" button ends the track.
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (recorder) stop();
      else ended = true;
    });
    let micError = null;
    if (wantMic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        micError = e.name;
      }
    }
    return { micError };
  },

  async go() {
    if (!stream || ended) {
      release();
      return { error: 'the screen sharing ended' };
    }
    const video = stream.getVideoTracks();
    const audio = [...stream.getAudioTracks(), ...(mic?.getAudioTracks() ?? [])];
    // MediaRecorder only records one audio track: mix them if there are two.
    let tracks = [...video, ...audio];
    if (audio.length > 1) {
      audioCtx = new AudioContext();
      const mix = audioCtx.createMediaStreamDestination();
      for (const track of audio) audioCtx.createMediaStreamSource(new MediaStream([track])).connect(mix);
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
    const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: bits, audioBitsPerSecond: 128_000 });
    let error = null;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => { error = `${e.error?.name || 'error'}: ${e.error?.message || 'the recorder stopped'}`; };
    rec.onstop = () => {
      release();
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      chrome.runtime.sendMessage({
        target: 'background',
        type: 'screen-done',
        url: blob.size ? URL.createObjectURL(blob) : null,
        ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm',
        error,
      });
    };
    rec.start(1000);
    recorder = rec;
    return { mic: Boolean(mic) };
  },

  async stop() {
    const active = Boolean(recorder && recorder.state !== 'inactive');
    stop();
    return { active }; // when active, 'screen-done' follows
  },

  async release() {
    release();
  },
};

function stop() {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  else release();
}

function release() {
  stream?.getTracks().forEach((track) => track.stop());
  mic?.getTracks().forEach((track) => track.stop());
  audioCtx?.close().catch(() => {});
  stream = mic = audioCtx = recorder = null;
}
