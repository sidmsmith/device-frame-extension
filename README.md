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
A popup window opens with the page in a Pixel 8 frame (412×915 CSS px), scaled
to fit the window. Close the window to turn it off.

## How it works

- `background.js` opens `viewer.html` in a popup window. While that window is
  open, a session rule removes `X-Frame-Options` and `Content-Security-Policy`
  from frames loaded in **that tab only**, so sites that normally refuse to be
  embedded still load. The rule is removed when the window closes.
- `viewer.html` / `viewer.css` / `viewer.js` draw the bezel and load the page in
  an iframe sized to the device viewport, so responsive layouts react as they
  would on the phone.

## Known limitations (v0.1)

- One device only (Pixel 8), portrait only.
- The page still sees a desktop user agent and no touch input.
- `chrome://` pages and the Chrome Web Store can't be framed.
