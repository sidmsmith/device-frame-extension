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
    colors: ['#505156', '#1b1c1e'], fixedColor: true,
  },
  rugged: {
    name: 'Rugged Handheld', width: 360, height: 640,
    bezel: { side: 22, top: 62, bottom: 236 }, radius: 34, screenRadius: 4,
    colors: ['#4a4b50', '#202124'], style: 'rugged', fixedColor: true,
  },
  laptop: {
    name: 'Laptop', width: 1366, height: 768,
    bezel: { side: 16, top: 26, bottom: 30 }, radius: 12, screenRadius: 2,
    colors: ['#3c3d42', '#111214'], style: 'laptop', group: 'full',
    fixedOrientation: true, noStatusBar: true,
    base: { overhang: 64, height: 18 },
  },
  desktop: {
    name: 'Desktop (no frame)', width: 1920, height: 1080,
    bezel: { side: 0, top: 0, bottom: 0 }, radius: 0, screenRadius: 0,
    colors: ['#000000', '#000000'], style: 'bare', fixedColor: true, group: 'full',
    fixedOrientation: true, noStatusBar: true, margin: 0, cropPad: 0,
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

// Body colours for the phone/tablet frames (gradient light -> dark). 'black'
// keeps each device's own colours; devices with fixedColor ignore this.
const FRAME_COLORS = {
  black: null,
  silver: ['#eceef1', '#a5a9af'],
  white: ['#ffffff', '#d3d6da'],
  blue: ['#4d74ad', '#1c355e'],
  manhattan: ['#1d5c5a', '#062a29'], // Manhattan green, RGB 8 51 50 (#083332)
};

// Saved ("preset") devices: user-named custom sizes, kept in prefs.presets.
const PRESET_PREFIX = 'preset:';
const PRESET_NAME_MAX = 30;
const MAX_PRESETS = 20;

function findPreset(prefs, key) {
  return (prefs.presets ?? []).find((p) => PRESET_PREFIX + p.id === key);
}

function sortByName(items) {
  return [...items].sort((a, b) => a.raw.localeCompare(b.raw, undefined, { sensitivity: 'base', numeric: true }));
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

// "Custom" device: the user types the size; the bezel is a generic phone frame
// whose thickness scales with the size so large sizes don't look stretched.
const CUSTOM_KEY = 'custom';
const CUSTOM_MIN = 240;
const CUSTOM_MAX = 2560;
const DEFAULT_CUSTOM = { width: 375, height: 667 };

function normalizeCustom(size) {
  const clean = (v, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, n)) : fallback;
  };
  return {
    width: clean(size?.width, DEFAULT_CUSTOM.width),
    height: clean(size?.height, DEFAULT_CUSTOM.height),
  };
}

function isDeviceKey(key, prefs = {}) {
  return key === CUSTOM_KEY || Boolean(DEVICES[key]) || Boolean(findPreset(prefs, key));
}

function resolveDevice(key, prefs) {
  if (key === CUSTOM_KEY) return genericDevice('Custom', prefs.custom);
  const preset = findPreset(prefs, key);
  if (preset) return genericDevice(preset.name, preset);
  return DEVICES[key] ?? DEVICES[DEFAULT_DEVICE];
}

// Generic phone frame for custom sizes and saved presets.
function genericDevice(name, size) {
  const { width, height } = normalizeCustom(size);
  const s = Math.min(width, height);
  const clamp = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)));
  const side = clamp(s * 0.03, 10, 28);
  const end = clamp(s * 0.08, 24, 44);
  return {
    name, width, height,
    bezel: { side, top: end, bottom: end },
    radius: clamp(s * 0.11, 30, 48), screenRadius: clamp(s * 0.05, 6, 20),
    colors: ['#3c3d42', '#111214'],
  };
}

// Everything drawFrame() needs, in window CSS pixels. Landscape is the device
// rotated anticlockwise: the top bezel (camera) ends up on the left and the
// right-edge buttons end up on the top edge. `content` is the part of the
// screen the page gets (the screen minus the status bar, when shown).
function computeLayout(deviceKey, orientation, prefs = {}) {
  const key = isDeviceKey(deviceKey, prefs) ? deviceKey : DEFAULT_DEVICE;
  const d = resolveDevice(key, prefs);
  const custom = normalizeCustom(prefs.custom);
  const landscape = orientation === 'landscape' && !d.fixedOrientation;
  const { side, top, bottom } = d.bezel;

  const sw = landscape ? d.height : d.width;
  const sh = landscape ? d.width : d.height;
  const bez = landscape
    ? { left: top, right: bottom, top: side, bottom: side }
    : { left: side, right: side, top, bottom };

  const bar = prefs.toolbarHidden ? 0 : BAR;
  const margin = d.margin ?? MARGIN;
  const over = d.base?.overhang ?? 0; // laptop base sticks out past the lid
  const baseH = d.base?.height ?? 0;
  const phone = { x: margin + over, y: bar + margin, w: sw + bez.left + bez.right, h: sh + bez.top + bez.bottom, r: d.radius };
  const screen = { x: phone.x + bez.left, y: phone.y + bez.top, w: sw, h: sh, r: d.screenRadius };

  const statusBar = prefs.statusBar && !d.noStatusBar ? { x: screen.x, y: screen.y, w: screen.w, h: STATUS_BAR } : null;
  const content = statusBar
    ? { x: screen.x, y: screen.y + STATUS_BAR, w: screen.w, h: screen.h - STATUS_BAR }
    : { x: screen.x, y: screen.y, w: screen.w, h: screen.h };

  // Edge buttons, given along the portrait right/left edge; in landscape the
  // right edge becomes the top and the left edge becomes the bottom.
  const along = landscape ? phone.w : phone.h;
  const button = (start, length, edge = 'right', t = 4, color = '#4a4c52') => {
    const pos = along * start;
    const len = along * length;
    if (landscape) {
      const y = edge === 'right' ? phone.y - t : phone.y + phone.h;
      return { x: phone.x + pos, y, w: len, h: t, color };
    }
    const x = edge === 'right' ? phone.x + phone.w : phone.x - t;
    return { x, y: phone.y + pos, w: t, h: len, color };
  };
  const rugged = d.style === 'rugged';
  const phoneLike = d.style !== 'laptop' && d.style !== 'bare';
  const buttons = rugged
    ? [button(0.2, 0.09, 'left', 6, RUGGED_ACCENT), button(0.2, 0.09, 'right', 6, RUGGED_ACCENT)]
    : phoneLike ? [button(0.18, 0.065), button(0.28, 0.12)] : [];
  // Shapes outside the lid/phone body that belong to the device (laptop base).
  const extras = d.base ? [{ x: phone.x - over, y: phone.y + phone.h, w: phone.w + over * 2, h: baseH, r: 8 }] : [];
  let camera = landscape
    ? { cx: phone.x + bez.left / 2, cy: phone.y + phone.h / 2, r: 6 }
    : { cx: phone.x + phone.w / 2, cy: phone.y + bez.top / 2, r: 6 };
  if (d.style === 'laptop') camera = { ...camera, r: 3 };
  if (d.style === 'bare') camera = null;

  return {
    deviceKey: key,
    deviceName: d.name,
    orientation: landscape ? 'landscape' : 'portrait',
    // Dropdown entries, grouped (mobile / full / saved / custom) and sorted
    // alphabetically by name within each group.
    devices: [
      ...sortByName([
        ...Object.entries(DEVICES).map(([k, v]) => ({ key: k, group: v.group ?? 'mobile', raw: v.name, size: v })),
        ...(prefs.presets ?? []).map((p) => ({ key: PRESET_PREFIX + p.id, group: 'saved', raw: p.name, size: p })),
      ]).map(({ key, group, raw, size }) => ({ key, group, name: `${escapeHtml(raw)} (${size.width}&#xD7;${size.height})` })),
      { key: CUSTOM_KEY, group: 'custom', name: `Custom (${custom.width}&#xD7;${custom.height})&#x2026;` },
    ],
    preset: findPreset(prefs, key) ? { id: findPreset(prefs, key).id, name: escapeHtml(findPreset(prefs, key).name) } : null,
    presetNameMax: PRESET_NAME_MAX,
    custom: { ...custom, min: CUSTOM_MIN, max: CUSTOM_MAX },
    W: phone.w + over * 2 + margin * 2,
    H: bar + phone.h + baseH + margin * 2,
    bar,
    toolbarHidden: Boolean(prefs.toolbarHidden),
    phone,
    screen,
    content,
    statusBar,
    background: BACKGROUNDS.includes(prefs.background) ? prefs.background : BACKGROUNDS[0],
    camera,
    buttons,
    extras,
    // Area to keep in screenshots/recordings, and extra room around it for buttons.
    bounds: { x: phone.x - over, y: phone.y, w: phone.w + over * 2, h: phone.h + baseH },
    cropPad: d.cropPad ?? 8,
    frameless: d.style === 'bare',
    canRotate: !d.fixedOrientation,
    hasStatusBar: !d.noStatusBar,
    colors: (!d.fixedColor && FRAME_COLORS[prefs.frameColor]) || d.colors,
    frameColor: FRAME_COLORS[prefs.frameColor] !== undefined ? prefs.frameColor : 'black',
    frameColorFixed: Boolean(d.fixedColor),
    touch: Boolean(prefs.touch),
    mic: Boolean(prefs.mic),
    countdown: prefs.countdown !== false,
    titleRules: escapeHtml(typeof prefs.titleRules === 'string' ? prefs.titleRules : 'MUP = WM Mobile'),
    decor: rugged ? ruggedDecor(d, phone, landscape) : null,
  };
}

const RUGGED_ACCENT = '#f2a900';

// Extra drawing for the rugged handheld: corner bumpers (window coordinates)
// plus scanner window and keypad, drawn in portrait phone coordinates and
// rotated into place for landscape.
function ruggedDecor(d, phone, landscape) {
  const { side, top, bottom } = d.bezel;
  const pw = d.width + side * 2; // portrait phone width
  const b = 46;
  const bumpers = [
    { x: phone.x, y: phone.y }, { x: phone.x + phone.w - b, y: phone.y },
    { x: phone.x, y: phone.y + phone.h - b }, { x: phone.x + phone.w - b, y: phone.y + phone.h - b },
  ].map((p) => ({ ...p, w: b, h: b }));

  const shapes = [{ type: 'rect', x: pw / 2 - 45, y: 8, w: 90, h: 10, rx: 4, fill: '#8b1a1a' }];
  const rows = [['F1', 'SCAN', 'F2'], ['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']];
  const gap = 8;
  const y0 = top + d.height + 14;
  const keyW = (pw - side * 2 - gap * 2) / 3;
  const keyH = (bottom - 14 - 16 - gap * (rows.length - 1)) / rows.length;
  rows.forEach((row, r) => row.forEach((label, c) => {
    const x = side + c * (keyW + gap);
    const y = y0 + r * (keyH + gap);
    const scan = label === 'SCAN';
    shapes.push({ type: 'rect', x, y, w: keyW, h: keyH, rx: 6, fill: scan ? RUGGED_ACCENT : '#3a3b3f', stroke: '#55575d' });
    shapes.push({ type: 'text', x: x + keyW / 2, y: y + keyH / 2, text: label, size: scan ? 12 : 14, fill: scan ? '#202124' : '#e8eaed' });
  }));

  return {
    bumpers,
    bumperColor: RUGGED_ACCENT,
    transform: landscape ? `translate(${phone.x},${phone.y + pw}) rotate(-90)` : `translate(${phone.x},${phone.y})`,
    shapes,
  };
}

// SVG path for a rounded rectangle; shared by the page overlay and screenshot crop.
function roundRectPath({ x, y, w, h, r }) {
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}` +
    `h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
}
