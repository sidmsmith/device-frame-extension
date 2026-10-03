// Device Frame - microphone permission for screen recordings (mic.html).
//
// Screen recordings run in a hidden offscreen page, which can't show Chrome's
// microphone prompt. This small window asks once; Chrome then remembers the
// permission for the extension.

(async () => {
  const { last } = await chrome.storage.local.get('last');
  const t = await uiText(last?.lang);
  const $ = (id) => document.getElementById(id);
  $('title').textContent = t.micTitle;
  $('body').textContent = t.micBody;
  $('allow').textContent = t.micButton;
  $('allow').addEventListener('click', async () => {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getTracks().forEach((track) => track.stop());
      $('status').className = '';
      $('status').textContent = t.micDone;
      setTimeout(() => window.close(), 2500);
    } catch (e) {
      $('status').className = 'bad';
      $('status').textContent = t.micDenied;
    }
  });
})();
