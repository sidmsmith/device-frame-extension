// Device Frame - viewer page. Asks the background worker for the target URL
// (the worker also enables header stripping for this tab first), then loads it
// into the device-sized iframe and scales the phone to fit the window.

const phone = document.getElementById('phone');
const frame = document.getElementById('page');
const BEZEL = { side: 12, top: 34, bottom: 34 };

let natural = { width: 0, height: 0 };

async function init() {
  const id = new URLSearchParams(location.search).get('id');
  const { url, device } = await chrome.runtime.sendMessage({ type: 'viewer-ready', id });

  if (!url) {
    document.getElementById('device-name').textContent = 'No page to show - close and try again';
    return;
  }

  document.getElementById('device-name').textContent = `${device.name} · ${device.width}×${device.height}`;
  document.title = `Device Frame - ${device.name}`;

  natural = {
    width: device.width + BEZEL.side * 2,
    height: device.height + BEZEL.top + BEZEL.bottom,
  };
  phone.style.width = natural.width + 'px';
  phone.style.height = natural.height + 'px';
  fit();

  frame.src = url;
}

function fit() {
  if (!natural.width) return;
  const stage = phone.parentElement;
  const margin = 24;
  const scale = Math.min(
    1,
    (stage.clientWidth - margin) / natural.width,
    (stage.clientHeight - margin) / natural.height,
  );
  phone.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', fit);
document.getElementById('reload').addEventListener('click', () => {
  // Reload whatever page the frame is currently on, not the original URL.
  try {
    frame.contentWindow.location.reload();
  } catch {
    frame.src = frame.src;
  }
});

init();
