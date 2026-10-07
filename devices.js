// Device catalog and frame geometry. Sizes are CSS pixels (what the page
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
  // Photo devices: product photos (skins/*.webp, built by scripts/build-skins.py)
  // with the display cut out. skin.screen is the display rect in skin pixels.
  zebraMC9400: {
    name: 'Zebra MC9400', width: 320, height: 533, screenRadius: 0, radius: 40,
    colors: ['#3b3f45', '#25282c'], style: 'photo', fixedColor: true, noStatusBar: false,
    skin: { file: 'skins/mc9400.webp', w: 792, h: 2105, screen: [144, 246, 500, 833] },
  },
  zebraTC8300: {
    name: 'Zebra TC8300', width: 320, height: 533, screenRadius: 0, radius: 40,
    colors: ['#3b3f45', '#25282c'], style: 'photo', fixedColor: true,
    skin: { file: 'skins/tc8300.webp', w: 697, h: 1946, screen: [111, 213, 485, 799] },
  },
  zebraTC72: {
    name: 'Zebra TC72', width: 360, height: 640, screenRadius: 0, radius: 40,
    colors: ['#3b3f45', '#25282c'], style: 'photo', fixedColor: true,
    skin: { file: 'skins/tc72.webp', w: 900, h: 1705, screen: [132, 242, 643, 1116] },
  },
  zebraWT6300: {
    name: 'Zebra WT6300', width: 512, height: 320, screenRadius: 0, radius: 40,
    colors: ['#3b3f45', '#25282c'], style: 'photo', fixedColor: true, fixedOrientation: true,
    skin: { file: 'skins/wt6300.webp', w: 1500, h: 1102, screen: [292, 288, 920, 575] },
  },
  laptop: {
    name: 'Laptop', width: 1366, height: 768,
    bezel: { side: 16, top: 26, bottom: 30 }, radius: 12, screenRadius: 2,
    colors: ['#3c3d42', '#111214'], style: 'laptop', group: 'full',
    fixedOrientation: true, noStatusBar: true,
    base: { overhang: 64, height: 18 },
  },
  // Screens on a desk stand: a neck (top/bottom width, height below the body)
  // and a foot, a round disc or a flat bar, both in aluminum.
  tabletStand: {
    name: 'Tablet Stand', width: 1280, height: 800,
    bezel: { side: 30, top: 30, bottom: 30 }, radius: 40, screenRadius: 6,
    colors: ['#3c3d42', '#111214'], style: 'stand', group: 'full',
    fixedOrientation: true, noStatusBar: true,
    stand: { neck: { top: 84, bottom: 100, h: 230 }, foot: { shape: 'disc', w: 480, h: 56 } },
  },
  kiosk: {
    name: 'Kiosk', width: 1920, height: 1080,
    bezel: { side: 12, top: 12, bottom: 34 }, radius: 12, screenRadius: 0,
    colors: ['#26272b', '#111214'], style: 'stand', group: 'full',
    fixedOrientation: true, noStatusBar: true, camera: false,
    stand: { neck: { top: 150, bottom: 200, h: 70 }, foot: { shape: 'bar', w: 760, h: 34 } },
  },
  // A monitor's thin bezel without a stand, to fill as much of the screen as possible.
  monitor: {
    name: 'Monitor', width: 1920, height: 1080, margin: 8,
    bezel: { side: 12, top: 12, bottom: 22 }, radius: 12, screenRadius: 0,
    colors: ['#26272b', '#111214'], style: 'stand', group: 'full',
    fixedOrientation: true, noStatusBar: true, camera: false,
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
const MARGIN = 16; // gray space around the phone
const BAR = 40;    // control bar height
const STATUS_BAR = 24; // Android status bar height inside the screen
const BACKGROUNDS = ['light', 'white', 'dark'];

// Body colors for the phone/tablet frames (gradient light -> dark). 'black'
// keeps each device's own colors; devices with fixedColor ignore this.
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

// Devices that were replaced: saved selections carry over to the new one.
const DEVICE_ALIASES = { zebraTC52: 'zebraTC72', zebraTC8000: 'zebraTC8300', rugged: 'zebraMC9400' };

function isDeviceKey(key, prefs = {}) {
  key = DEVICE_ALIASES[key] ?? key;
  return key === CUSTOM_KEY || Boolean(DEVICES[key]) || Boolean(findPreset(prefs, key));
}

function resolveDevice(key, prefs) {
  key = DEVICE_ALIASES[key] ?? key;
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
  const key = isDeviceKey(deviceKey, prefs) ? (DEVICE_ALIASES[deviceKey] ?? deviceKey) : DEFAULT_DEVICE;
  const d = resolveDevice(key, prefs);
  const custom = normalizeCustom(prefs.custom);
  const landscape = orientation === 'landscape' && !d.fixedOrientation;
  // Devices with their own artwork (drawn in portrait device coordinates).
  const ART = { photo: photoArt };
  const art = ART[d.style] ? ART[d.style](d) : null;
  // Bezel per edge (portrait). Artwork may extend below the screen (keypad,
  // grip) or be off-center (photos), so it can supply its own.
  const pb = art?.bezel ?? {
    left: d.bezel.side, right: d.bezel.side, top: d.bezel.top,
    bottom: art ? art.H - d.bezel.top - d.height : d.bezel.bottom,
  };

  let sw = landscape ? d.height : d.width;
  let sh = landscape ? d.width : d.height;
  // Landscape = the device rotated anticlockwise.
  const bez = landscape
    ? { left: pb.top, right: pb.bottom, top: pb.right, bottom: pb.left }
    : pb;

  const bar = prefs.toolbarHidden ? 0 : BAR;
  // Full Screen devices in a maximized (or full-screen) window take the
  // window's shape, with a thin margin: the screen grows wider or taller
  // (never smaller) until the whole device matches the window. Phones keep
  // their real size and are centered instead (see below).
  const fillScreen = prefs.fill > 0 && d.group === 'full';
  const margin = fillScreen ? Math.min(d.margin ?? MARGIN, 4) : d.margin ?? MARGIN;
  const over = d.base?.overhang ?? 0; // laptop base sticks out past the lid
  const baseH = d.base?.height ?? 0;
  const standH = d.stand ? d.stand.neck.h + d.stand.foot.h / 2 : 0; // stand below the body
  const standPad = d.stand ? 14 : 0; // room for the stand's floor shadow
  if (fillScreen) {
    const aroundW = bez.left + bez.right + over * 2 + margin * 2;
    const aroundH = bar + bez.top + bez.bottom + baseH + standH + standPad + margin * 2;
    if ((sw + aroundW) / (sh + aroundH) < prefs.fill) sw = Math.round(prefs.fill * (sh + aroundH) - aroundW);
    else sh = Math.round((sw + aroundW) / prefs.fill - aroundH);
  }
  const phoneW = sw + bez.left + bez.right, phoneH = sh + bez.top + bez.bottom;
  // A maximized window has a fixed shape (prefs.fill = its width / height):
  // add room on both sides, or below the toolbar, to center the device in it.
  const fitW = phoneW + over * 2 + margin * 2, fitH = bar + phoneH + baseH + standH + standPad + margin * 2;
  let ox = 0, oy = 0;
  if (prefs.fill > 0) {
    if (fitW / fitH < prefs.fill) ox = (prefs.fill * fitH - fitW) / 2;
    else oy = (fitW / prefs.fill - fitH) / 2;
  }
  const phone = { x: margin + over + ox, y: bar + margin + oy, w: phoneW, h: phoneH, r: d.radius };
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
  const phoneLike = !['laptop', 'bare', 'stand'].includes(d.style);
  // Devices with their own artwork (photos) are drawn in portrait device
  // coordinates; any parts sticking out (e.g. side triggers) are passed on as
  // invisible "buttons" so screenshots and bounds include them.
  const toWindow = (r) => (landscape
    ? { x: phone.x + r.y, y: phone.y + art.W - (r.x + r.w), w: r.h, h: r.w }
    : { x: phone.x + r.x, y: phone.y + r.y, w: r.w, h: r.h });
  const buttons = art
    ? art.triggers.map((t) => ({ ...toWindow(t), color: 'transparent' }))
    : phoneLike ? [button(0.18, 0.065), button(0.28, 0.12)] : [];
  // Shapes outside the lid/phone body that belong to the device (laptop base).
  const extras = d.base ? [{ x: phone.x - over, y: phone.y + phone.h, w: phone.w + over * 2, h: baseH, r: 8 }] : [];
  let camera = landscape
    ? { cx: phone.x + bez.left / 2, cy: phone.y + phone.h / 2, r: 6 }
    : { cx: phone.x + phone.w / 2, cy: phone.y + bez.top / 2, r: 6 };
  if (d.style === 'laptop') camera = { ...camera, r: 3 };
  if (d.style === 'bare' || d.camera === false) camera = null;
  if (d.style === 'stand' && camera) camera = { ...camera, r: 4 };
  // Desk stand (window coords): the neck starts behind the body, the foot is
  // centered on the neck's lower end.
  let stand = null;
  if (d.stand) {
    const cx = phone.x + phone.w / 2, y0 = phone.y + phone.h, fy = y0 + d.stand.neck.h;
    const { top, bottom } = d.stand.neck;
    const rx = d.stand.foot.w / 2, ry = d.stand.foot.h / 2;
    stand = {
      neck: `M${cx - top / 2},${y0 - 20}L${cx + top / 2},${y0 - 20}L${cx + bottom / 2},${fy}L${cx - bottom / 2},${fy}Z`,
      foot: d.stand.foot.shape === 'disc'
        ? `M${cx - rx},${fy}a${rx},${ry} 0 1 0 ${2 * rx},0a${rx},${ry} 0 1 0 ${-2 * rx},0Z`
        : roundRectPath({ x: cx - rx, y: fy - ry, w: 2 * rx, h: 2 * ry, r: ry }),
      cx, fy, rx, ry,
    };
  }

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
    W: fitW + ox * 2,
    H: fitH + oy * 2,
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
    stand,
    // Device outline as rounded rects (window coords), for non-rectangular
    // artwork such as a grip below the body; null = the phone rect.
    silhouette: art?.silhouette ? art.silhouette.map((s) => ({ ...toWindow(s), r: s.r })) : null,
    // Photo devices: the skin image is the device outline (screenshot mask).
    skin: art?.skin ? { ...art.skin, x: phone.x, y: phone.y, landscape } : null,
    // Area to keep in screenshots/recordings, and extra room around it for buttons.
    bounds: { x: phone.x - over, y: phone.y, w: phone.w + over * 2, h: phone.h + baseH + standH },
    cropPad: d.cropPad ?? 8,
    frameless: d.style === 'bare',
    canRotate: !d.fixedOrientation,
    hasStatusBar: !d.noStatusBar,
    colors: (!d.fixedColor && FRAME_COLORS[prefs.frameColor]) || d.colors,
    frameColor: FRAME_COLORS[prefs.frameColor] !== undefined ? prefs.frameColor : 'black',
    frameColorFixed: Boolean(d.fixedColor),
    touch: Boolean(prefs.touch),
    mic: Boolean(prefs.mic),
    systemAudio: Boolean(prefs.systemAudio),
    skipLoading: prefs.skipLoading !== false,
    countdown: prefs.countdown !== false,
    iconAlways: Boolean(prefs.iconAlways),
    fitWidth: prefs.fitWidth !== false,
    openHidden: prefs.openHidden !== false,
    openIn: prefs.openIn === 'tab' ? 'tab' : 'window',
    titleRules: escapeHtml(typeof prefs.titleRules === 'string' ? prefs.titleRules : 'MUP = WM Mobile'),
    decor: art ? {
      svg: art.svg,
      transform: landscape ? `translate(${phone.x},${phone.y + art.W}) rotate(-90)` : `translate(${phone.x},${phone.y})`,
    } : null,
  };
}

// Photo device artwork: the product photo scaled so its display cut-out
// matches the screen size exactly (x and y scaled separately, which only
// differs by a fraction of a percent). Drop shadow follows the photo's
// outline but is kept out of the screen. Portrait device coordinates.
function photoArt(d) {
  const { file, w, h, screen: [x, y, sw, sh] } = d.skin;
  const kx = d.width / sw, ky = d.height / sh;
  // Whole pixels, so the page inside isn't positioned on fractions (blurry text).
  const W = Math.round(w * kx), H = Math.round(h * ky);
  const sx = Math.round(x * kx), sy = Math.round(y * ky);
  const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(file) : file;
  const id = `ph-${file.replace(/\W/g, '')}`;
  const svg = `
    <defs>
      <filter id="${id}-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-opacity=".35"/></filter>
      <clipPath id="${id}-noscreen"><path clip-rule="evenodd" d="M-40,-40H${W + 40}V${H + 40}H-40z M${sx},${sy}h${d.width}v${d.height}h-${d.width}z"/></clipPath>
    </defs>
    <g clip-path="url(#${id}-noscreen)"><image href="${url}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" filter="url(#${id}-shadow)"/></g>`;
  return {
    svg, triggers: [], W, H,
    bezel: { left: sx, right: W - sx - d.width, top: sy, bottom: H - sy - d.height },
    skin: { url, W, H, screen: { x: sx, y: sy, w: d.width, h: d.height } },
  };
}

// SVG path for a rounded rectangle; shared by the page overlay and screenshot crop.
function roundRectPath({ x, y, w, h, r }) {
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}` +
    `h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
}
