# Device Frame (Chrome extension)

Shows the current page inside an Android device frame, as a replacement for the
device frame Chrome DevTools used to offer. Intended for demos.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Optional: pin **Device Frame** from the puzzle-piece menu.

After editing the code, click the reload icon on the extension's card.

## Use

Open the page you want to show (e.g. WM Mobile from the WMS menu), then click
the **Device Frame** toolbar icon. A popup window opens with the page in the
last-used device and orientation, at the last window position.

The control bar above the device has:

| Control | What it does |
|---|---|
| Device dropdown | Pixel 8, Galaxy S24, Zebra TC52, Android Tablet |
| ⟲ | Rotate between portrait and landscape |
| ▭ | Show/hide the Android status bar (clock, signal, Wi-Fi, battery) |
| ◐ | Cycle the window background: light grey (default), white, dark |
| ⟳ | Reload the page (F5 also works) |
| 📷 | Save a PNG of just the device, transparent background, to Downloads |

Close the window to turn the frame off. Device, orientation, status bar,
background and window position are all remembered.

## How it works

- The page is opened as the **top-level page** of a popup window, so cookies,
  storage and server-side CSRF checks behave exactly as in a normal tab.
  (v0.1 used an iframe inside an extension page; the WMS mobile app's POST
  calls returned 403 there because the site was treated as embedded.)
- After each page load, `background.js` injects `drawFrame()` from `frame.js`.
  It pins `<body>` into the screen area (a `transform` on `<body>` keeps
  `position: fixed` app shells inside it) and adds a shadow-DOM overlay with
  the SVG bezel and control bar.
- The window is resized so the viewport matches the layout, and per-tab zoom
  shrinks it to fit the screen. Zoom is scoped to that tab only.
- Device sizes and bezel geometry live in `devices.js`.

## Known limitations (v0.4)

- The page still sees a desktop user agent and no touch input.
- Media queries and `vw` units see the whole window width (device plus bezel
  and margin), not exactly the device width.
- `chrome://` pages and the Chrome Web Store can't be framed.
