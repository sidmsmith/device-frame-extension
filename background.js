// Device Frame - background service worker.
//
// Clicking the toolbar icon opens a popup window containing viewer.html, which
// draws a phone bezel with the current page in an iframe. Many sites refuse to
// be framed (X-Frame-Options / CSP frame-ancestors), so while a viewer window
// is open we strip those headers for sub-frames loaded in that one tab only.

const DEVICE = { name: 'Pixel 8', width: 412, height: 915 };

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !/^https?:/i.test(tab.url)) return; // chrome:// etc. can't be framed

  const id = crypto.randomUUID();
  await chrome.storage.session.set({ ['frame:' + id]: tab.url });

  const current = await chrome.windows.get(tab.windowId);
  await chrome.windows.create({
    url: chrome.runtime.getURL('viewer.html?id=' + id),
    type: 'popup',
    width: 520,
    height: Math.min(1100, current.height),
    left: current.left + 60,
    top: current.top,
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'viewer-ready' || !sender.tab) return;
  prepareViewer(msg.id, sender.tab.id).then(sendResponse);
  return true; // async response
});

async function prepareViewer(id, tabId) {
  const key = 'frame:' + id;
  const url = (await chrome.storage.session.get(key))[key];

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId],
    addRules: [{
      id: tabId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' },
          { header: 'content-security-policy', operation: 'remove' },
        ],
      },
      condition: { tabIds: [tabId], resourceTypes: ['sub_frame'] },
    }],
  });

  return { url, device: DEVICE };
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
});
