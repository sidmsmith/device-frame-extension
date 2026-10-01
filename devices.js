// Device catalogue and frame geometry. Sizes are CSS pixels (what the page
// sees), matching Chrome DevTools' device presets where one exists.

const DEVICES = {
  pixel8: {
    name: 'Pixel 8', width: 412, height: 915,
    bezel: { side: 12, top: 34, bottom: 34 }, radius: 46, screenRadius: 28,
    colors: ['#3c3d42', '#111214'],
  },
  galaxyS24: {
    name: 'Galaxy S24', width: 360, height: 780,
    bezel: { side: 10, top: 28, bottom: 28 }, radius: 42, screenRadius: 30,
    colors: ['#45464c', '#16171a'],
  },
  motoG4: {
    name: 'Moto G4', width: 360, height: 640,
    bezel: { side: 14, top: 64, bottom: 64 }, radius: 38, screenRadius: 2,
    colors: ['#3c3d42', '#111214'],
  },
  zebraTC52: {
    name: 'Zebra TC52', width: 360, height: 640,
    bezel: { side: 20, top: 58, bottom: 72 }, radius: 30, screenRadius: 6,
    colors: ['#505156', '#1b1c1e'],
  },
  tablet: {
    name: 'Android Tablet', width: 800, height: 1280,
    bezel: { side: 28, top: 28, bottom: 28 }, radius: 36, screenRadius: 14,
    colors: ['#3c3d42', '#111214'],
  },
};

const DEFAULT_DEVICE = 'pixel8';
const MARGIN = 16; // grey space around the phone
const BAR = 40;    // control bar height
const STATUS_BAR = 24; // Android status bar height inside the screen
const BACKGROUNDS = ['light', 'white', 'dark'];

// Everything drawFrame() needs, in window CSS pixels. Landscape is the device
// rotated anticlockwise: the top bezel (camera) ends up on the left and the
// right-edge buttons end up on the top edge. `content` is the part of the
// screen the page gets (the screen minus the status bar, when shown).
function computeLayout(deviceKey, orientation, prefs = {}) {
  const key = DEVICES[deviceKey] ? deviceKey : DEFAULT_DEVICE;
  const d = DEVICES[key];
  const landscape = orientation === 'landscape';
  const { side, top, bottom } = d.bezel;

  const sw = landscape ? d.height : d.width;
  const sh = landscape ? d.width : d.height;
  const bez = landscape
    ? { left: top, right: bottom, top: side, bottom: side }
    : { left: side, right: side, top, bottom };

  const phone = { x: MARGIN, y: BAR + MARGIN, w: sw + bez.left + bez.right, h: sh + bez.top + bez.bottom, r: d.radius };
  const screen = { x: phone.x + bez.left, y: phone.y + bez.top, w: sw, h: sh, r: d.screenRadius };

  const statusBar = prefs.statusBar ? { x: screen.x, y: screen.y, w: screen.w, h: STATUS_BAR } : null;
  const content = statusBar
    ? { x: screen.x, y: screen.y + STATUS_BAR, w: screen.w, h: screen.h - STATUS_BAR }
    : { x: screen.x, y: screen.y, w: screen.w, h: screen.h };

  const along = landscape ? phone.w : phone.h;
  const button = (start, length) => landscape
    ? { x: phone.x + along * start, y: phone.y - 4, w: along * length, h: 4 }
    : { x: phone.x + phone.w, y: phone.y + along * start, w: 4, h: along * length };

  return {
    deviceKey: key,
    deviceName: d.name,
    orientation: landscape ? 'landscape' : 'portrait',
    devices: Object.entries(DEVICES).map(([k, v]) => ({ key: k, name: `${v.name} (${v.width}&#xD7;${v.height})` })),
    W: phone.w + MARGIN * 2,
    H: BAR + phone.h + MARGIN * 2,
    bar: BAR,
    phone,
    screen,
    content,
    statusBar,
    background: BACKGROUNDS.includes(prefs.background) ? prefs.background : BACKGROUNDS[0],
    camera: landscape
      ? { cx: phone.x + bez.left / 2, cy: phone.y + phone.h / 2, r: 6 }
      : { cx: phone.x + phone.w / 2, cy: phone.y + bez.top / 2, r: 6 },
    buttons: [button(0.18, 0.065), button(0.28, 0.12)],
    colors: d.colors,
  };
}

// SVG path for a rounded rectangle; shared by the page overlay and screenshot crop.
function roundRectPath({ x, y, w, h, r }) {
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}` +
    `h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
}
