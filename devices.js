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

// Everything drawFrame() needs, in window CSS pixels. Landscape is the device
// rotated anticlockwise: the top bezel (camera) ends up on the left and the
// right-edge buttons end up on the top edge.
function computeLayout(deviceKey, orientation) {
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
