// Device Frame - advanced options (not linked from the frame's toolbar).
// Stored with the other settings in local 'last' (see background.js).

const $ = (id) => document.getElementById(id);

async function load() {
  const { last = {} } = await chrome.storage.local.get('last');
  for (const r of document.querySelectorAll('[name=openIn]')) r.checked = r.value === (last.openIn === 'tab' ? 'tab' : 'window');
  $('companionLink').checked = last.companionLink !== false;
}

async function save() {
  const { last = {} } = await chrome.storage.local.get('last');
  const openIn = document.querySelector('[name=openIn]:checked')?.value === 'tab' ? 'tab' : 'window';
  await chrome.storage.local.set({ last: { ...last, openIn, companionLink: $('companionLink').checked } });
  $('saved').textContent = '✔ Saved';
  clearTimeout(save.timer);
  save.timer = setTimeout(() => { $('saved').textContent = ''; }, 1500);
}

document.addEventListener('change', save);
load();
