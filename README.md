# Device Frame (Chrome extension)

Shows the current page inside an Android device frame, as a replacement for the
device frame Chrome DevTools used to offer. Intended for demos.

## Download

**Latest version (zip):**
https://github.com/sidmsmith/device-frame-extension/releases/latest/download/device_frame_extension.zip

See the **[User Guide](USER_GUIDE.md)** for installing and using it. The zip also
contains `USER_GUIDE.html` (open by double-click, or from the extension's settings
panel → **? User Guide**).

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
| Device dropdown | Pixel 8, Galaxy S24, Moto G4, Zebra TC52, Rugged Handheld, Laptop (1366×768, laptop frame), Desktop (1920×1080, no frame — for recording normal WMS screens), Android Tablet, your saved devices, Custom |
| Custom… (in dropdown) / ✎ | Enter any width × height (240–2560); Enter applies, Esc cancels. **Save…** names it and adds it to the dropdown under *Saved* |
| Trash icon | Shown when a saved device is selected; click twice to delete it |
| Rotate icon | Rotate between portrait and landscape (not for Laptop/Desktop) |
| Wi-Fi icon | Show/hide the Android status bar (clock, signal, Wi-Fi, battery); slashed when hidden |
| Sliders icon | Settings panel: background (light gray / white / dark), frame color (black / silver / white / blue / Manhattan; Zebra, Rugged and Desktop keep their own), **Show taps** (a circle where you click plus a fingertip cursor, for screen-shared demos), **3-2-1 countdown** before recording (on by default), and **Record microphone** (narration as AAC audio in the MP4; Chrome asks for mic permission for the site the first time) |
| ⟳ | Reload the page (F5 also works) |
| Record icon | Record the device to **MP4**. **Alt+Shift+V** starts/stops recording with no prompt; the button works too but goes through Chrome's *Share this tab* prompt. Then the 3-2-1 countdown runs, then use the app. Click the red stop button (shows the elapsed time) or Chrome's *Stop sharing* to save it to Downloads. Device/rotate/appearance/hide are locked while recording. Turn on *Show taps* so viewers see where you tapped |
| Camera icon | Save a PNG of just the device (transparent background) to Downloads and copy it to the clipboard. **Alt+Shift+S** copies to the clipboard only (no download) |
| Eye-slash icon | Hide the control bar. To show it again: click the small tab at the top center (appears when the mouse is near the top), double-click the device frame or gray background, or press **Alt+Shift+H** |

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
- "Fit page to screen width" (frame windows): CSS `zoom` on `<body>` (with its
  geometry divided by the same factor) shrinks pages wider than the screen;
  long single words get a smaller font-size, shared by matching neighbors.
- `keyguard.js` loads at the start of every page but only acts in frame
  windows: it stops the extension's own keyboard shortcuts from also reaching
  the app (otherwise e.g. Alt+Shift+V typed a V into MUP's search box).
- `title.js` renames page titles (tab + window title) using the "Rename
  titles" list (`Old = New` per line, default `MUP = WM Mobile`, `*` = starts
  with), in all tabs including frame windows. Re-applied when the page resets
  its title. If a **Tab icon** is chosen in the settings panel (stored as a
  64×64 PNG under `tabIcon`), renamed tabs also show it instead of the page's
  own icon (with "Always display", every page in frame windows does).
- The Rugged Handheld brings its own artwork (`ruggedArt()` in `devices.js`),
  drawn in device coordinates and rotated for landscape.

## Known limitations

- The page still sees a desktop user agent and no touch input.
- `vw`/`vh` (and `dvh`, `vmin`, …) in the page's stylesheets and inline styles
  are rewritten in frame windows to the device screen size (cross-origin
  stylesheets can't be read, so units there stay window-based). CSS media
  queries and scripts reading `window.innerWidth` still see the whole window.
- `chrome://` pages and the Chrome Web Store can't be framed.
- A recording ends if the page fully reloads (e.g. a login redirect); in-app
  navigation in single-page apps like MUP is fine. The mouse pointer itself
  isn't captured, which is what *Show taps* is for.

## Releasing a new version (maintainer)

Versioning: **x.y.Z** (patch, e.g. 0.14.1) for fixes and small tweaks – the user
guide is left as is. **x.Y.0** (minor, e.g. 0.15.0) for new features or
noticeable changes – update `USER_GUIDE.md` first.

1. Bump `version` in `manifest.json` (and update `USER_GUIDE.md` for a minor release), commit.
2. Run `./release.sh "What changed"` – for a minor release it regenerates `USER_GUIDE.html`
   (`node scripts/build-guide.mjs`, committed if it changed); then it pushes, builds the zip from `HEAD`,
   and publishes a GitHub release with `device_frame_extension.zip` attached,
   so the download link above always gets the newest version.
