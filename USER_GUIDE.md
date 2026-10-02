# Device Frame – User Guide

Device Frame is a Chrome extension that shows a web page inside a phone,
handheld, laptop, or plain screen, so you can demo it, take screenshots, and
record videos. It replaces the device frame Chrome DevTools used to have.

<img src="docs/images/phone-and-settings.png" alt="A page in a phone frame, with the settings panel open" width="360">

---

## 1. Install

1. Download the latest zip:
   **https://github.com/sidmsmith/device-frame-extension/releases/latest/download/device_frame_extension.zip**
2. Extract it to a permanent folder **outside OneDrive**, e.g.
   `C:\Users\<your name>\device_frame_extension`. Check that `manifest.json`
   is directly inside that folder.
3. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder.
5. Pin **Device Frame** from the puzzle-piece menu so its phone icon is in the toolbar.
6. Press **F5** on any tabs that were already open (see section 9).

### Updating to a new version

You don't need to remove the extension or use **Load unpacked** again – just
replace the files and reload:

1. Download the latest zip (same link as above).
2. Extract it **into the same folder you installed from**, replacing the
   existing files. Watch the folder name: if Chrome saved the download as
   `device_frame_extension (1).zip`, Windows will suggest extracting to
   `device_frame_extension (1)` – change it back to your original
   `device_frame_extension` folder, or the old version keeps running.
3. Check that `manifest.json` is still directly inside that folder (not in a
   new subfolder).
4. Open `chrome://extensions` and click the **Reload** icon (circular arrow)
   on the **Device Frame** card. The card shows the new version number.
5. Close any open frame windows and press **F5** on open tabs, so they pick
   up the new version.

## 2. Open a page in a frame

Go to the page you want to show (for WM Mobile: open **WM Mobile** from the
WMS menu), then click the **Device Frame** icon in the Chrome toolbar. A
separate window opens with the page inside the device. It works exactly like
the normal page: same login, same data.

The window remembers its position, device, and settings. Close the window
when you're done.

## 3. The control bar

| Icon | Name | What it does |
|---|---|---|
| *(dropdown)* | Device | Pick the device or screen size (see section 4). |
| <img src="docs/icons/edit.svg" width="20"> | Edit size | Shown when **Custom** is selected: change the custom width × height. |
| <img src="docs/icons/trash.svg" width="20"> | Delete | Shown when a **Saved** device is selected: click twice to delete it. |
| <img src="docs/icons/rotate.svg" width="20"> | Rotate | Switch between portrait and landscape (phones and tablets only). |
| <img src="docs/icons/wifi.svg" width="20"> / <img src="docs/icons/wifiOff.svg" width="20"> | Status bar | Show / hide an Android status bar (clock, signal, Wi-Fi, battery). Slashed = hidden. |
| <img src="docs/icons/sliders.svg" width="20"> | Settings | Background, frame color, tap indicator, countdown, microphone (see section 5). |
| <img src="docs/icons/reload.svg" width="20"> | Reload | Reload the page (F5 also works). |
| <img src="docs/icons/record.svg" width="20"> | Record | Record a video of the device (see section 7). Turns red with a timer while recording; click again to stop. |
| <img src="docs/icons/camera.svg" width="20"> | Screenshot | Picture of the device: copied to the clipboard **and** saved to Downloads (see section 6). |
| <img src="docs/icons/eyeOff.svg" width="20"> | Hide toolbar | Hide this bar for a clean screen (see section 8). |

Hover over any button to see a short description. This guide is also one
click away: **Settings** <img src="docs/icons/sliders.svg" width="16"> → **? User Guide**.

## 4. Devices and screen sizes

The device dropdown has three sections:

- **Mobile** – Android Tablet, Galaxy S24, Moto G4, Pixel 8, Rugged Handheld
  (a warehouse scanner with keypad, scan key and side triggers), Zebra TC52.
- **Full Screen** – for laptop/PC/fixed-station screens:
  - **Laptop (1366×768)** – the page inside a laptop frame.
  - **Desktop (no frame, 1920×1080)** – just the screen, no frame at all.
    Use this to record or screenshot normal desktop WMS screens.
- **Saved** – your own named sizes (only shown once you've saved one).

**Custom…** (at the bottom) lets you type any width × height (240–2560).
Press **Enter** or **Apply** to use it. To keep it for later, click **Save…**,
type a name (e.g. *Zebra TC21*), and press Enter – it appears under **Saved**.

Good to know:

- The numbers are the screen size the page sees (like DevTools), not physical pixels.
- If a device is bigger than your monitor, the window automatically zooms
  out to fit. The page still lays out at the full size.
- Laptop and Desktop are always landscape and have no status bar, so those
  buttons are grayed out.

**Fitting pages to the device screen** (setting **Fit page to screen width**,
on by default – frame window only, normal tabs are never affected):

- Pages that are wider than the device screen are shrunk just enough to fit,
  so you don't have to scroll sideways. Screens that already fit stay at 100%.
- Sizes the page sets as a share of "the screen" (e.g. buttons 35% wide, or a
  full-height panel) are measured against the device screen, not the whole
  window – so footer buttons and full-height screens fit like on a real device.
- If a single word is too wide for its button (e.g. PERFORMANCE splitting onto
  two lines), the text is shrunk a little to keep it on one line, and the
  buttons next to it are shrunk by the same amount so they still match.
  Phrases like "INDIRECT EVENT" can still wrap between words.

<img src="docs/images/rugged.png" alt="The Rugged Handheld" width="250"> <img src="docs/images/laptop.png" alt="The Laptop frame" width="520">

## 5. Settings panel

Click <img src="docs/icons/sliders.svg" width="16"> to open it; click anywhere else to close it.

- **Background** – Light gray (default), White, or Dark. This is the area
  around the device.
- **Frame color** – Black, Silver, White, Blue, or Manhattan. (The Zebra,
  Rugged Handheld, and Desktop keep their own look.)
- **Show taps** – shows a soft circle wherever you click, plus a round
  fingertip cursor. Great for screen-shared demos and recordings, so viewers
  can see what you tapped.
- **Fit page to screen width** – shrink too-wide pages and long words to fit
  the device screen (see section 4). Untick to see the page at its true size.
- **3-2-1 countdown before recording** – on by default; untick to start
  recording immediately.
- **Record microphone** – include your voice in recordings (see section 7).
- **Rename titles** and **Tab icon** – friendlier names and icons for browser tabs (see section 9).
- **? User Guide** – opens this guide in a new tab.

All settings are remembered.

## 6. Screenshots

- Click <img src="docs/icons/camera.svg" width="16"> – the device is **copied to the clipboard**
  and **saved to Downloads** as a PNG.
- Or press **Alt+Shift+S** – copies to the clipboard only (no file).

Screenshots have a **transparent background** (just the device), so they paste
cleanly into PowerPoint, Teams, or Outlook.

## 7. Recording videos

**Start:**
- Press **Alt+Shift+V** (recommended) – starts straight away, no prompt.
- Or click <img src="docs/icons/record.svg" width="16"> – Chrome first asks you to share the tab; click **Share**.

A **3, 2, 1** countdown runs (unless you turned it off), then recording starts.
The record button turns red and shows the elapsed time.

**Stop:** press **Alt+Shift+V** again, or click the red <img src="docs/icons/stop.svg" width="16"> button.
The video is saved to **Downloads** as an **MP4** (plays in PowerPoint, Teams, Outlook).

Tips:

- Only the device is recorded – not the control bar.
- Turn on **Show taps** so viewers can see where you clicked (the mouse
  pointer itself isn't recorded).
- The video is a rectangle, so the **background color** shows in the corners
  around a phone. Pick the background that matches your slides (e.g. White)
  before recording. In PowerPoint you can also use **Video Format → Video
  Shape → Rounded Rectangle** to trim the corners.
- While recording, the device/rotate/settings/hide controls are locked so the
  video can't change size.
- A full page reload (e.g. logging in again) ends the recording; moving
  around inside the app is fine.

**Microphone:** tick **Record microphone** in the settings panel. The first
time, Chrome asks for microphone permission – choose **Allow on every visit**.
While recording with sound, a small <img src="docs/icons/mic.svg" width="14"> appears on the red button. If the
microphone is blocked or missing, you'll see a message and the video is
recorded without sound.

## 8. Hiding the toolbar

Click <img src="docs/icons/eyeOff.svg" width="16"> to hide the bar for a clean, minimal window. To bring it back:

- **double-click** the device frame or the background around it,
- press **Alt+Shift+H**, or
- move the mouse to the top edge of the window and click the small tab <img src="docs/icons/expand.svg" width="14"> that appears.

## 9. Tab titles and icons

Some apps have unhelpful page titles (WM Mobile shows **MUP**). The
**Rename titles** box in the settings panel replaces them in the browser tab
and in the frame window's title bar. Put one rename per line, as
`Old title = New title`:

```
MUP = WM Mobile
Receiving = WM Receiving
WM Desktop* = Warehouse Management
# notes like this are ignored
```

- The whole title must match; capitals don't matter.
- End the old title with `*` to match titles that **start with** it
  (e.g. `WM Desktop*` also matches "WM Desktop - Receiving").
- The first matching line wins. Blank lines and lines starting with `#` are ignored.
- A line it can't read (no `=`) gets a red outline and is skipped.
- Changes are saved when you click outside the box and apply to open tabs
  straight away. The default list is `MUP = WM Mobile`.

**If a tab isn't renamed:** tabs that were already open when you installed or
updated the extension don't have it yet – press **F5** on that tab once.

### Tab icon

You can also replace the small icon shown in the tab and the frame window's
title bar. Under **Tab icon** in the settings panel:

- **Choose…** – pick an image (PNG, JPG, SVG, or ICO). It's shrunk to a small
  icon automatically.
- By default the icon is shown on **tabs renamed by your list** (e.g. the
  WM Mobile tab); every other tab keeps its own icon.
- **Always display in this window** – the frame window shows your icon for
  every page, renamed or not. (Normal tabs still only get it when renamed.)
- **Remove** – go back to each page's own icon.

## 10. Keyboard shortcuts

| Shortcut | Does |
|---|---|
| **Alt+Shift+V** | Start / stop recording (no share prompt) |
| **Alt+Shift+S** | Copy a screenshot to the clipboard |
| **Alt+Shift+H** | Hide / show the toolbar |

Shortcuts only act in the frame window. To change them, go to
`chrome://extensions/shortcuts`. (Avoid **Alt+Shift+R** – Chrome uses it for
Reading mode.)

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| "Manifest file is missing or unreadable" when loading | Select the folder that has `manifest.json` directly inside it (not a parent folder), and keep it **outside OneDrive**. |
| Clicking the toolbar icon does nothing | It only works on normal web pages (`http`/`https`), not on `chrome://` pages. |
| A shortcut does nothing | Check `chrome://extensions/shortcuts` – Chrome sometimes leaves a new shortcut blank; set it there. |
| A shortcut types a letter into the page | Close the frame window and open it again (needed once after installing or updating). |
| A tab title or icon isn't changed | Press **F5** on that tab (tabs open before installing/updating need one refresh). Check the old title in the list matches the page's title. |
| Still the old version after updating | The zip was probably extracted to a new folder like `device_frame_extension (1)`. Extract into your original folder and click **Reload** on the extension card. |
| "Recording failed: …" | Try the record button instead of the shortcut, and send the message text to whoever maintains the extension. |
| "Clipboard copy blocked" | The PNG was still saved to Downloads. Click inside the frame window first, then try again. |
| A strange text-only view appeared | That's Chrome's Reading mode (Alt+Shift+R) – click the ✕ to close it. |
