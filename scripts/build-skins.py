"""Build photo device skins from product photos in skins/src.

For each device: remove the white studio background (and its soft floor
shadow) by flood-filling from the image border, crop to the device, cut the
display area out (transparent) so the page shows through, and save a WebP
with alpha to skins/<name>.webp. Prints the skin size and screen rectangle
(in skin pixels) to paste into devices.js.

Usage: python scripts/build-skins.py [--preview]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'skins' / 'src'

# screen: display rectangle in the ORIGINAL photo (x, y, w, h), measured by hand.
# maxWidth: downscale so the skin isn't larger than needed (about 2x CSS size).
SKINS = {
    # Zebra MC9400, 34-key (zebra.com product photo, 3600x2400).
    'mc9400': {'file': 'mc9400-front.jpg', 'screen': (1546, 386, 500, 833), 'maxWidth': 900},
    # Zebra TC8300 (zebra.com product photo); screen averaged (slight perspective).
    'tc8300': {'file': 'tc8300-front.jpg', 'screen': (1557, 452, 485, 799), 'maxWidth': 900},
    # Zebra WT6300 (zebra.com product photo); app area only, the on-screen
    # Android buttons to its right stay part of the skin.
    'wt6300': {'file': 'wt6300-front.jpg', 'screen': (987, 752, 1626, 1016), 'maxWidth': 1500},
}


def device_alpha(rgb):
    """Alpha mask: 0 for background connected to the border, 255 for the device."""
    a = np.asarray(rgb).astype(np.int16)
    lo, hi = a.min(axis=2), a.max(axis=2)
    light = (lo > 135) & ((hi - lo) < 18)  # near-white or light-gray (incl. the floor shadow), unsaturated
    mask = Image.fromarray(np.where(light, 255, 0).astype(np.uint8), 'L').copy()  # copy: floodfill needs a writable image
    w, h = mask.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if mask.getpixel(seed) == 255:
            ImageDraw.floodfill(mask, seed, 128)
    bg = np.asarray(mask) == 128
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # Soften the cut edge by a pixel so it isn't jagged.
    soft = Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(0.8))
    return np.asarray(soft)


def build(name, spec, preview=False):
    rgb = Image.open(SRC / spec['file']).convert('RGB')
    alpha = device_alpha(rgb)
    ys, xs = np.nonzero(alpha > 8)
    pad = 6
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, rgb.width), min(ys.max() + pad + 1, rgb.height))
    rgba = rgb.copy()
    rgba.putalpha(Image.fromarray(alpha, 'L'))
    rgba = rgba.crop(box)
    if preview:
        # Grid every 50 px (original-photo coordinates) to measure the screen.
        p = rgba.copy().convert('RGB')
        d = ImageDraw.Draw(p)
        for x in range((box[0] // 50 + 1) * 50, box[2], 50):
            d.line([(x - box[0], 0), (x - box[0], p.height)], fill=(255, 0, 255) if x % 250 else (0, 160, 255), width=1)
        for y in range((box[1] // 50 + 1) * 50, box[3], 50):
            d.line([(0, y - box[1]), (p.width, y - box[1])], fill=(255, 0, 255) if y % 250 else (0, 160, 255), width=1)
        p.save(ROOT / 'skins' / 'src' / f'{name}-grid.png')
        print(name, 'crop box (photo px):', box)
        return
    sx, sy, sw, sh = spec['screen']
    screen = [sx - box[0], sy - box[1], sw, sh]
    # Cut the display out.
    a = np.asarray(rgba.getchannel('A')).copy()
    a[screen[1]:screen[1] + sh, screen[0]:screen[0] + sw] = 0
    rgba.putalpha(Image.fromarray(a, 'L'))
    scale = min(1.0, spec['maxWidth'] / rgba.width)
    if scale < 1:
        rgba = rgba.resize((round(rgba.width * scale), round(rgba.height * scale)), Image.LANCZOS)
        screen = [round(v * scale) for v in screen]
    out = ROOT / 'skins' / f'{name}.webp'
    rgba.save(out, 'WEBP', quality=88, method=6)
    print(f"{name}: skin {rgba.width}x{rgba.height}, screen {screen}, {out.stat().st_size // 1024} KB")


if __name__ == '__main__':
    preview = '--preview' in sys.argv
    for name, spec in SKINS.items():
        if preview or spec['screen']:
            build(name, spec, preview)
