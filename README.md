# Device Frame (Chrome extension)

Shows the current page inside an Android phone frame, as a replacement for the
device frame Chrome DevTools used to offer. Intended for demos.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Optional: pin **Device Frame** from the puzzle-piece menu.

After editing the code, click the reload icon on the extension's card.

## Use

Open the page you want to show, then click the **Device Frame** toolbar icon.
A popup window opens with the page in a Pixel 8 frame (412×915 CSS px). Press
F5 in that window to reload. Close the window to turn it off.

## How it works

- The page is opened as the **top-level page** of a popup window, so cookies,
  storage and server-side CSRF checks behave exactly as in a normal tab.
  (v0.1 used an iframe inside an extension page; the WMS mobile app's POST
  calls returned 403 there because the site was treated as embedded.)
- After each page load, `background.js` injects a style that pins `<body>`
  into the phone's screen area (a `transform` on `<body>` keeps `position:
  fixed` app shells inside it) and an SVG bezel overlay that ignores clicks.
- The window is resized so the viewport matches the phone, and per-tab zoom
  shrinks it to fit shorter screens. Zoom is scoped to that tab only.

## Known limitations (v0.2)

- One device only (Pixel 8), portrait only.
- The page still sees a desktop user agent and no touch input.
- Media queries and `vw` units see the whole window width (468 px including
  bezel), not exactly 412 px.
- `chrome://` pages and the Chrome Web Store can't be framed.
