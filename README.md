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
| Device dropdown | Pixel 8, Galaxy S24, Moto G4, Zebra TC52, Rugged Handheld, Android Tablet |
| Custom… (in dropdown) / ✎ | Enter any width × height (240–2560); Enter applies, Esc cancels |
| ⟲ | Rotate between portrait and landscape |
| Wi-Fi icon | Show/hide the Android status bar (clock, signal, Wi-Fi, battery); slashed when hidden |
| ◐ | Cycle the window background: light grey (default), white, dark |
| ⟳ | Reload the page (F5 also works) |
| Camera icon | Save a PNG of just the device (transparent background) to Downloads and copy it to the clipboard. **Alt+Shift+S** copies to the clipboard only (no download) |
| Eye-slash icon | Hide the control bar. To show it again: click the small tab at the top centre (appears when the mouse is near the top), double-click the device frame or grey background, or press **Alt+Shift+H** |

Close the window to turn the frame off. Device, custom size, orientation,
status bar, background, toolbar visibility and window position are all
remembered. Keyboard shortcuts can be changed at
`chrome://extensions/shortcuts`.

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

## Known limitations (v0.8)

- The page still sees a desktop user agent and no touch input.
- Media queries and `vw` units see the whole window width (device plus bezel
  and margin), not exactly the device width.
- `chrome://` pages and the Chrome Web Store can't be framed.
