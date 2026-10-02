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
  zebraTC52: {
    name: 'Zebra TC52', width: 360, height: 640,
    bezel: { side: 20, top: 58, bottom: 72 }, radius: 30, screenRadius: 6,
    colors: ['#505156', '#1b1c1e'], fixedColor: true,
  },
  rugged: {
    name: 'Rugged Handheld', width: 360, height: 640,
    bezel: { side: 24, top: 74, bottom: 330 }, radius: 40, screenRadius: 3,
    colors: ['#2a2c30', '#1c1d20'], style: 'rugged', fixedColor: true,
  },
  zebraMC9400: {
    name: 'Zebra MC9400', width: 320, height: 534,
    bezel: { side: 24, top: 64, bottom: 0 }, radius: 30, screenRadius: 2,
    colors: ['#3b3f45', '#25282c'], style: 'mc9400', fixedColor: true,
  },
  zebraTC8000: {
    name: 'Zebra TC8000', width: 320, height: 534,
    bezel: { side: 34, top: 66, bottom: 0 }, radius: 46, screenRadius: 2,
    colors: ['#c9cdd2', '#8f949a'], style: 'tc8000', fixedColor: true,
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
  // Devices with their own artwork (drawn in portrait device coordinates).
  const ART = { rugged: ruggedArt, tc8000: tc8000Art, mc9400: mc9400Art };
  const art = ART[d.style] ? ART[d.style](d) : null;
  const { side, top } = d.bezel;
  // Artwork may extend below the screen (keypad, grip): its height decides.
  const bottom = art ? art.H - top - d.height : d.bezel.bottom;

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
  // The rugged device brings its own artwork (drawn in portrait device
  // coordinates); its side triggers are passed on as invisible "buttons" so
  // screenshots and bounds include them.
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
    // Device outline as rounded rects (window coords), for non-rectangular
    // artwork such as a grip below the body; null = the phone rect.
    silhouette: art?.silhouette ? art.silhouette.map((s) => ({ ...toWindow(s), r: s.r })) : null,
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
    iconAlways: Boolean(prefs.iconAlways),
    fitWidth: prefs.fitWidth !== false,
    titleRules: escapeHtml(typeof prefs.titleRules === 'string' ? prefs.titleRules : 'MUP = WM Mobile'),
    decor: art ? {
      svg: art.svg,
      transform: landscape ? `translate(${phone.x},${phone.y + art.W}) rotate(-90)` : `translate(${phone.x},${phone.y})`,
    } : null,
  };
}

const RUGGED_ACCENT = ['#ff8a3d', '#d4561a']; // safety orange (triggers, scan key)

// Rugged handheld artwork (concept A: charcoal polycarbonate shell in a
// rubber overmold, safety-orange triggers and scan key, scan window, status
// LEDs, speaker, recessed glass screen, D-pad + soft keys + numeric keypad).
// Drawn in portrait device coordinates (0,0 = top-left of the body) and
// rotated into place for landscape. The screen area is left open (even-odd
// holes) so the page shows through. Returns { svg, transform, triggers } with
// the triggers as local rects (for screenshot masks / bounds).
function ruggedArt(d) {
  const { side: SIDE, top: TOP } = d.bezel;
  const SW = d.width, SH = d.height;
  const W = SW + SIDE * 2, H = TOP + SH + d.bezel.bottom;
  const sx = SIDE, sy = TOP;
  const rr = (x, y, w, h, r) => roundRectPath({ x, y, w, h, r });
  const hole = rr(sx, sy, SW, SH, d.screenRadius);
  const font = 'font-family="Segoe UI, system-ui, sans-serif"';

  // A raised rubber key: shadow, body gradient, top highlight, label(s).
  const key = (x, y, w, h, { label = '', sub = '', fill = 'rg-key', text = '#eef0f2', size = 15, r = 7, icon = '' } = {}) => `
    <rect x="${x}" y="${y + 2}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity=".55"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${fill})"/>
    <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h * 0.45}" rx="${r - 1}" fill="#fff" opacity=".07"/>
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="#000" stroke-opacity=".5"/>
    ${icon}
    ${label ? `<text x="${x + w / 2 - (sub ? 6 : 0)}" y="${y + h / 2 + 1}" text-anchor="middle" dominant-baseline="central" ${font} font-weight="600" font-size="${size}" fill="${text}">${label}</text>` : ''}
    ${sub ? `<text x="${x + w / 2 + 12}" y="${y + h / 2 + 2}" text-anchor="middle" dominant-baseline="central" ${font} font-size="8" fill="${text}" opacity=".6">${sub}</text>` : ''}`;

  const barcode = (cx, cy, color) => {
    let x = cx - 14, out = '';
    [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2].forEach((b, i) => {
      if (i % 2 === 0) out += `<rect x="${x}" y="${cy - 7}" width="${b}" height="14" fill="${color}"/>`;
      x += b + 0.6;
    });
    return out;
  };

  // Keypad: soft keys + D-pad, ESC / SCAN / ENT, then 0-9 with letters.
  const kp = sy + SH + 18;
  const cx = W / 2;
  let keys = key(28, kp + 4, 92, 28, { label: 'F1', fill: 'rg-fn', size: 13 })
    + key(28, kp + 40, 92, 28, { label: 'F2', fill: 'rg-fn', size: 13 })
    + key(W - 120, kp + 4, 92, 28, { label: 'F3', fill: 'rg-fn', size: 13 })
    + key(W - 120, kp + 40, 92, 28, { label: 'F4', fill: 'rg-fn', size: 13 });
  const arrows = ['M-5,3 l5,-6 l5,6', 'M-5,-3 l5,6 l5,-6', 'M3,-5 l-6,5 l6,5', 'M-3,-5 l6,5 l-6,5'];
  keys += `<circle cx="${cx}" cy="${kp + 36}" r="37" fill="#000" opacity=".5"/>
    <circle cx="${cx}" cy="${kp + 35}" r="36" fill="url(#rg-key)" stroke="#000" stroke-opacity=".5"/>
    <circle cx="${cx}" cy="${kp + 35}" r="15" fill="url(#rg-fn)" stroke="#000" stroke-opacity=".6"/>
    <text x="${cx}" y="${kp + 36}" text-anchor="middle" dominant-baseline="central" ${font} font-size="9" font-weight="700" fill="#cfd2d6">OK</text>
    ${[[0, -25], [0, 25], [-25, 0], [25, 0]].map(([dx, dy], i) => `<path transform="translate(${cx + dx},${kp + 35 + dy})" d="${arrows[i]}" fill="none" stroke="#cfd2d6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}`;
  const y2 = kp + 82;
  keys += key(28, y2, 80, 34, { label: 'ESC', size: 12 })
    + key(cx - 74, y2, 148, 34, { fill: 'rg-accent', r: 17, icon: barcode(cx, y2 + 17, '#2a1406') })
    + key(W - 108, y2, 80, 34, { label: 'ENT', size: 12, text: '#9fe0a4' });
  const nums = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '&#x2423;'], ['#', '']];
  const kw = (W - 56 - 16) / 3, kh = 32, y0 = y2 + 46;
  nums.forEach(([l, sub], i) => { keys += key(28 + (i % 3) * (kw + 8), y0 + Math.floor(i / 3) * (kh + 7), kw, kh, { label: l, sub, size: 16 }); });

  const triggers = [{ x: -7, y: sy + 150, w: 10, h: 84 }, { x: W - 3, y: sy + 150, w: 10, h: 84 }];
  const svg = `
    <defs>
      <linearGradient id="rg-shell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a4d52"/><stop offset=".55" stop-color="#2a2c30"/><stop offset="1" stop-color="#1c1d20"/></linearGradient>
      <linearGradient id="rg-rubber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#202124"/><stop offset="1" stop-color="#111213"/></linearGradient>
      <linearGradient id="rg-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d4045"/><stop offset="1" stop-color="#26282c"/></linearGradient>
      <linearGradient id="rg-fn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4d52"/><stop offset="1" stop-color="#33363a"/></linearGradient>
      <linearGradient id="rg-accent" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${RUGGED_ACCENT[0]}"/><stop offset="1" stop-color="${RUGGED_ACCENT[1]}"/></linearGradient>
      <linearGradient id="rg-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d1d1d"/><stop offset=".5" stop-color="#3b0b0b"/><stop offset="1" stop-color="#5a1212"/></linearGradient>
      <linearGradient id="rg-glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <radialGradient id="rg-ledg"><stop offset="0" stop-color="#b6ff9c"/><stop offset=".5" stop-color="#2fbf3a"/><stop offset="1" stop-color="#0b3d10"/></radialGradient>
      <radialGradient id="rg-leda"><stop offset="0" stop-color="#ffe0a0"/><stop offset=".5" stop-color="#d98a12"/><stop offset="1" stop-color="#4a2a02"/></radialGradient>
      <filter id="rg-inset"><feGaussianBlur stdDeviation="3"/></filter>
      <clipPath id="rg-screen"><path d="${hole}"/></clipPath>
    </defs>
    ${triggers.map((t) => `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="4" fill="url(#rg-accent)" stroke="#000" stroke-opacity=".4"/>`).join('')}
    <path fill="url(#rg-rubber)" fill-rule="evenodd" d="${rr(0, 0, W, H, d.radius)} ${hole}"/>
    <path fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2" d="${rr(0, 0, W, H, d.radius)}"/>
    ${[[0, 0], [W - 64, 0], [0, H - 64], [W - 64, H - 64]].map(([x, y]) => `<path d="${rr(x, y, 64, 64, 30)}" fill="#1a1b1d" opacity=".95"/>`).join('')}
    <path fill="url(#rg-shell)" fill-rule="evenodd" d="${rr(9, 9, W - 18, H - 18, d.radius - 8)} ${hole}"/>
    <path fill="none" stroke="#fff" stroke-opacity=".12" d="${rr(9.5, 9.5, W - 19, H - 19, d.radius - 8)}"/>
    <path d="${rr(cx - 74, 16, 148, 16, 6)}" fill="url(#rg-scan)" stroke="#000" stroke-opacity=".6"/>
    <rect x="${cx - 66}" y="18" width="132" height="4" rx="2" fill="#fff" opacity=".18"/>
    <circle cx="44" cy="${TOP / 2 + 8}" r="4.5" fill="url(#rg-ledg)"/><circle cx="60" cy="${TOP / 2 + 8}" r="4.5" fill="url(#rg-leda)"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${W - 92 + i * 11}" y="${TOP / 2 + 3}" width="6" height="12" rx="3" fill="#0b0c0d" opacity=".9"/>`).join('')}
    <circle cx="${cx}" cy="${TOP / 2 + 9}" r="3.5" fill="#0b0c0d"/><circle cx="${cx - 1}" cy="${TOP / 2 + 8}" r="1.2" fill="#3a4a6a"/>
    <path fill="#050607" fill-rule="evenodd" d="${rr(sx - 7, sy - 7, SW + 14, SH + 14, 8)} ${hole}"/>
    <path fill="none" stroke="#000" stroke-opacity=".7" stroke-width="1.5" d="${rr(sx - 7.5, sy - 7.5, SW + 15, SH + 15, 8)}"/>
    <g clip-path="url(#rg-screen)">
      <rect x="${sx - 6}" y="${sy - 6}" width="${SW + 12}" height="${SH + 12}" fill="none" stroke="#000" stroke-width="8" opacity=".3" filter="url(#rg-inset)"/>
      <path d="M${sx},${sy} h${SW * 0.75} L${sx},${sy + SH * 0.42} z" fill="url(#rg-glare)"/>
    </g>
    <path d="${rr(16, kp - 8, W - 32, H - kp - 8, 20)}" fill="#000" opacity=".22"/>
    ${keys}`;
  return { svg, triggers, W, H };
}

// A raised rubber key for device artwork. `p` prefixes the gradient ids
// (each artwork defines <p>-key, <p>-fn, <p>-accent ... in its <defs>).
function artKey(p, x, y, w, h, { label = '', sub = '', fill = 'key', text = '#eef0f2', size = 14, r = 6, icon = '', subColor = '' } = {}) {
  const font = 'font-family="Segoe UI, system-ui, sans-serif"';
  return `
    <rect x="${x}" y="${y + 2}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity=".5"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${p}-${fill})"/>
    <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h * 0.45}" rx="${r - 1}" fill="#fff" opacity=".07"/>
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="#000" stroke-opacity=".5"/>
    ${icon}
    ${label ? `<text x="${x + w / 2 - (sub ? 5 : 0)}" y="${y + h / 2 + 1}" text-anchor="middle" dominant-baseline="central" ${font} font-weight="600" font-size="${size}" fill="${text}">${label}</text>` : ''}
    ${sub ? `<text x="${x + w / 2 + 11}" y="${y + h / 2 + 2}" text-anchor="middle" dominant-baseline="central" ${font} font-size="7.5" fill="${subColor || text}" opacity="${subColor ? 1 : 0.6}">${sub}</text>` : ''}`;
}

// Zebra TC8000-style handheld: silver frame with corner screws around a
// black glass screen, scan window and power button on top, oval home button,
// long ridged rubber grip with a silver base. Portrait device coordinates.
function tc8000Art(d) {
  const { side: SIDE, top: TOP } = d.bezel;
  const SW = d.width, SH = d.height;
  const W = SW + SIDE * 2;
  const rr = (x, y, w, h, r) => roundRectPath({ x, y, w, h, r });
  const sx = SIDE, sy = TOP;
  const hole = rr(sx, sy, SW, SH, d.screenRadius);
  const headH = TOP + SH + 78;
  const gw = Math.round(W * 0.56), gx = (W - gw) / 2, gripH = 430, baseH = 62;
  const neckY = headH, gripY = headH + 22, baseY = gripY + gripH;
  const H = baseY + baseH;
  const cx = W / 2;
  const ridges = Array.from({ length: 7 }, (_, i) => gripY + 58 + i * 52)
    .map((y) => `<path d="M${gx + 10},${y} Q${cx},${y + 14} ${gx + gw - 10},${y}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="3"/>
      <path d="M${gx + 10},${y + 3} Q${cx},${y + 17} ${gx + gw - 10},${y + 3}" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="2"/>`).join('');
  const screws = [[22, 22], [W - 22, 22], [22, headH - 22], [W - 22, headH - 22]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5" fill="#2a2c30"/><circle cx="${x}" cy="${y}" r="4" fill="#111"/><circle cx="${x - 1}" cy="${y - 1}" r="1.2" fill="#fff" opacity=".25"/>`).join('');
  const svg = `
    <defs>
      <linearGradient id="t8-silver" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9ea3a9"/><stop offset=".18" stop-color="#e9ebee"/><stop offset=".5" stop-color="#c9cdd2"/><stop offset=".82" stop-color="#eef0f2"/><stop offset="1" stop-color="#8f949a"/></linearGradient>
      <linearGradient id="t8-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1d20"/><stop offset="1" stop-color="#0a0b0c"/></linearGradient>
      <linearGradient id="t8-grip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d0e0f"/><stop offset=".3" stop-color="#2b2d30"/><stop offset=".6" stop-color="#1c1d1f"/><stop offset="1" stop-color="#0b0c0d"/></linearGradient>
      <linearGradient id="t8-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f55"/><stop offset="1" stop-color="#1e2124"/></linearGradient>
      <linearGradient id="t8-glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="t8-screen"><path d="${hole}"/></clipPath>
    </defs>
    <path d="M${gx + 6},${neckY - 4} L${gx + gw - 6},${neckY - 4} L${gx + gw},${gripY + 30} L${gx},${gripY + 30} Z" fill="#1a1b1d"/>
    <path d="${rr(gx, gripY, gw, gripH, 34)}" fill="url(#t8-grip)"/>
    ${ridges}
    <path d="${rr(gx - 4, baseY - 6, gw + 8, baseH + 6, 22)}" fill="url(#t8-silver)" stroke="#6d7277" stroke-opacity=".6"/>
    <rect x="${cx - 26}" y="${baseY + baseH - 22}" width="52" height="8" rx="4" fill="#3a3d41"/>
    <path fill="url(#t8-silver)" fill-rule="evenodd" d="${rr(0, 0, W, headH, 46)} ${hole}"/>
    <path fill="none" stroke="#6d7277" stroke-opacity=".7" stroke-width="1.5" d="${rr(0.75, 0.75, W - 1.5, headH - 1.5, 46)}"/>
    <path fill="url(#t8-glass)" fill-rule="evenodd" d="${rr(12, 12, W - 24, headH - 24, 36)} ${hole}"/>
    ${screws}
    <path d="${rr(cx - 36, 18, 72, 22, 6)}" fill="url(#t8-scan)" stroke="#000" stroke-opacity=".6"/>
    <rect x="${cx - 30}" y="21" width="60" height="5" rx="2.5" fill="#fff" opacity=".18"/>
    <circle cx="${W - 64}" cy="30" r="9" fill="#2a2c30" stroke="#000" stroke-opacity=".5"/>
    <path d="M${W - 64},25 v5 M${W - 68},27 a5,5 0 1 0 8,0" fill="none" stroke="#9ea3a9" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="44" y="27" width="10" height="5" rx="2.5" fill="#d33" opacity=".85"/>
    <ellipse cx="${cx}" cy="${TOP + SH + 40}" rx="24" ry="13" fill="none" stroke="#5a5f66" stroke-width="2.5"/>
    <g clip-path="url(#t8-screen)">
      <rect x="${sx - 6}" y="${sy - 6}" width="${SW + 12}" height="${SH + 12}" fill="none" stroke="#000" stroke-width="8" opacity=".3" filter="url(#t8-inset)"/>
      <path d="M${sx},${sy} h${SW * 0.75} L${sx},${sy + SH * 0.42} z" fill="url(#t8-glare)"/>
    </g>`;
  return {
    svg: `<defs><filter id="t8-inset"><feGaussianBlur stdDeviation="3"/></filter></defs>${svg}`,
    triggers: [],
    W, H,
    // Outline pieces may overlap: masks use their union.
    silhouette: [{ x: 0, y: 0, w: W, h: headH, r: 46 }, { x: gx, y: headH - 20, w: gw, h: gripH + 50, r: 34 }, { x: gx - 4, y: baseY - 6, w: gw + 8, h: baseH + 6, r: 22 }],
  };
}

// Zebra MC9400-style gun computer: gunmetal body, scan window across the top,
// 4-column keypad (function keys, arrows, yellow SCAN, color-coded Fn/Alpha/
// Enter, numeric pad), pistol grip below. Portrait device coordinates.
function mc9400Art(d) {
  const { side: SIDE, top: TOP } = d.bezel;
  const SW = d.width, SH = d.height;
  const W = SW + SIDE * 2;
  const rr = (x, y, w, h, r) => roundRectPath({ x, y, w, h, r });
  const sx = SIDE, sy = TOP;
  const hole = rr(sx, sy, SW, SH, d.screenRadius);
  const cx = W / 2;
  const kp = sy + SH + 20;
  const cols = 4, gap = 7, kw = (W - 44 - gap * (cols - 1)) / cols, kh = 28, rowGap = 7;
  const kx = (c) => 22 + c * (kw + gap);
  const ky = (r) => kp + r * (kh + rowGap);
  const K = (c, r, opts, span = 1, rows = 1) => artKey('m9', kx(c), ky(r), kw * span + gap * (span - 1), kh * rows + rowGap * (rows - 1), opts);
  const arrow = (c, r, dir) => {
    const x = kx(c) + kw / 2, y = ky(r) + kh / 2;
    const pts = { up: '-6,3 0,-4 6,3', down: '-6,-3 0,4 6,-3', left: '3,-6 -4,0 3,6', right: '-3,-6 4,0 -3,6' }[dir];
    return K(c, r, { icon: `<polyline transform="translate(${x},${y})" points="${pts}" fill="none" stroke="#e6e8ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` });
  };
  const scanIcon = (x, y) => { let s = '', bx = x - 13; [2, 1, 3, 1, 2, 1, 1, 3, 1, 2].forEach((b, i) => { if (i % 2 === 0) s += `<rect x="${bx}" y="${y - 6}" width="${b}" height="12" fill="#3a2c00"/>`; bx += b + 0.8; }); return s; };
  let keys = '';
  ['F1', 'F2', 'F3', 'F4'].forEach((l, c) => { keys += K(c, 0, { label: l, fill: 'fn', size: 12 }); });
  keys += K(0, 1, { label: 'ESC', size: 11 }) + arrow(1, 1, 'up') + K(2, 1, { label: 'TAB', size: 11 }) + K(3, 1, { label: '&#x232B;', size: 15 });
  keys += arrow(0, 2, 'left') + K(1, 2, { fill: 'accent', r: 14, icon: scanIcon(kx(1) + kw + gap / 2, ky(2) + kh / 2) }, 2) + arrow(3, 2, 'right');
  keys += K(0, 3, { label: 'ALPHA', size: 9.5, text: '#7fb4ff' }) + arrow(1, 3, 'down') + K(2, 3, { label: 'FN', size: 11, text: '#ffa040' }) + K(3, 3, { label: 'SP', size: 11 });
  const nums = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', ''], ['#', '']];
  nums.forEach(([l, sub], i) => { keys += K(i % 3, 4 + Math.floor(i / 3), { label: l, sub, size: 15, subColor: '#7fb4ff' }); });
  keys += K(3, 4, { label: '.', size: 16 }) + K(3, 5, { label: '-', size: 16 }) + K(3, 6, { label: 'ENT', size: 12, text: '#9fe0a4' }, 1, 2);
  const bodyH = ky(8) + 14;
  const gw = Math.round(W * 0.5), gx = (W - gw) / 2, gripY = bodyH, gripH = 300;
  const H = gripY + gripH;
  const svg = `
    <defs>
      <linearGradient id="m9-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2e33"/><stop offset=".2" stop-color="#4d5259"/><stop offset=".5" stop-color="#3b3f45"/><stop offset=".8" stop-color="#4d5259"/><stop offset="1" stop-color="#25282c"/></linearGradient>
      <linearGradient id="m9-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1d20"/><stop offset="1" stop-color="#2c2f34"/></linearGradient>
      <linearGradient id="m9-grip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#121315"/><stop offset=".35" stop-color="#2e3135"/><stop offset=".65" stop-color="#1f2124"/><stop offset="1" stop-color="#101113"/></linearGradient>
      <linearGradient id="m9-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#454950"/><stop offset="1" stop-color="#2c2f34"/></linearGradient>
      <linearGradient id="m9-fn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b6068"/><stop offset="1" stop-color="#3e4248"/></linearGradient>
      <linearGradient id="m9-accent" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd84a"/><stop offset="1" stop-color="#e0a800"/></linearGradient>
      <linearGradient id="m9-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d1d1d"/><stop offset=".5" stop-color="#3b0b0b"/><stop offset="1" stop-color="#5a1212"/></linearGradient>
      <linearGradient id="m9-glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <filter id="m9-inset"><feGaussianBlur stdDeviation="3"/></filter>
      <clipPath id="m9-screen"><path d="${hole}"/></clipPath>
    </defs>
    <path d="${rr(gx, gripY - 30, gw, gripH + 30, 40)}" fill="url(#m9-grip)"/>
    ${Array.from({ length: 5 }, (_, i) => `<rect x="${gx + 14}" y="${gripY + 40 + i * 46}" width="${gw - 28}" height="5" rx="2.5" fill="#000" opacity=".45"/>`).join('')}
    <path d="${rr(gx + 16, gripY + gripH - 34, gw - 32, 18, 9)}" fill="#3a3d41"/>
    <path fill="url(#m9-body)" fill-rule="evenodd" d="${rr(0, 0, W, bodyH, 30)} ${hole}"/>
    <path fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.5" d="${rr(0.75, 0.75, W - 1.5, bodyH - 1.5, 30)}"/>
    <path fill="url(#m9-head)" d="M30,0 h${W - 60} a30,30 0 0 1 30,30 v${TOP - 44} H0 v-${TOP - 44} a30,30 0 0 1 30,-30 z"/>
    <path d="${rr(cx - 92, 12, 184, 18, 7)}" fill="url(#m9-scan)" stroke="#000" stroke-opacity=".6"/>
    <rect x="${cx - 84}" y="14" width="168" height="4" rx="2" fill="#fff" opacity=".18"/>
    <circle cx="26" cy="${TOP - 26}" r="4" fill="#2fbf3a"/><circle cx="${W - 26}" cy="${TOP - 26}" r="4" fill="#d98a12"/>
    <path fill="#06070a" fill-rule="evenodd" d="${rr(sx - 6, sy - 6, SW + 12, SH + 12, 8)} ${hole}"/>
    <g clip-path="url(#m9-screen)">
      <rect x="${sx - 6}" y="${sy - 6}" width="${SW + 12}" height="${SH + 12}" fill="none" stroke="#000" stroke-width="8" opacity=".3" filter="url(#m9-inset)"/>
      <path d="M${sx},${sy} h${SW * 0.75} L${sx},${sy + SH * 0.42} z" fill="url(#m9-glare)"/>
    </g>
    <path d="${rr(14, kp - 8, W - 28, bodyH - kp - 2, 16)}" fill="#000" opacity=".25"/>
    ${keys}`;
  return {
    svg,
    triggers: [],
    W, H,
    // Outline pieces may overlap: masks use their union.
    silhouette: [{ x: 0, y: 0, w: W, h: bodyH, r: 30 }, { x: gx, y: gripY - 30, w: gw, h: gripH + 30, r: 40 }],
  };
}

// SVG path for a rounded rectangle; shared by the page overlay and screenshot crop.
function roundRectPath({ x, y, w, h, r }) {
  return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}` +
    `h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
}
