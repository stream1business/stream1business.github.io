#!/usr/bin/env python3
"""
Generate the NOVA app icon for packaging.

Two renderings of the teal->violet ring-of-light mark share one palette:

  * detailed - braided ring, stardust, and layered glow. Reads well large.
  * flat     - a single smooth gradient ring, thicker stroke, minimal glow,
               no stardust. Stays legible at 16-32px where the detailed art
               turns to mush.

Exports the formats electron-builder consumes:

  resources/icon.png        1024x1024  detailed (Linux + electron-builder src)
  resources/icon-small.png  512x512    flat     (tray + tiny surfaces)
  resources/icon.ico        multi-size flat <=48px, detailed >=64px (Windows)
  resources/icon.icns       multi-size detailed (macOS, renders large / hi-DPI)

Run:  python3 scripts/generate-icon.py   (or `npm run icon`)
Requires: Pillow.  This is a build-time asset generator; the rendered icons are
committed so packaging never depends on Pillow being installed.
"""
import io
import math
import os
import struct
from PIL import Image, ImageDraw, ImageFilter

# Brand palette (matches src/renderer/config/themes.ts · novaDefault)
TEAL = (45, 225, 194)        # #2DE1C2
VIOLET = (138, 79, 255)      # #8A4FFF
GLOW_EDGE = (181, 140, 255)  # #B58CFF
BG_TOP = (18, 8, 38)         # #120826 deep indigo
BG_BOTTOM = (4, 2, 10)       # near-black

SS = 4                       # supersample factor for antialiasing


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def build_background(size):
    """Vertical dark gradient tile."""
    bg = Image.new("RGB", (size, size))
    px = bg.load()
    for y in range(size):
        col = lerp(BG_TOP, BG_BOTTOM, (y / (size - 1)) ** 1.3)
        for x in range(size):
            px[x, y] = col
    return bg


def ring_gradient_color(theta):
    """Teal on one side, violet on the other, blended smoothly around."""
    t = 0.5 - 0.5 * math.cos(theta)  # smooth 0->1->0 over 0..2pi
    return lerp(TEAL, VIOLET, t)


def tint(layer, color, strength):
    """Recolour a white/greyscale glow layer toward `color`, scaling alpha."""
    _, _, _, a = layer.split()
    solid = Image.new("RGBA", layer.size, color + (0,))
    solid.putalpha(a.point(lambda v: int(v * strength)))
    return solid


# ---------------------------------------------------------------- detailed ---
def draw_ring(size):
    """Braided ring on a transparent RGBA layer."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = cy = size / 2
    base_r = size * 0.31
    for strand in range(3):
        phase = (strand / 3) * math.pi * 2
        width = max(2, int(size * (0.020 - strand * 0.004)))
        prev = None
        for i in range(1441):
            theta = (i / 1440) * math.pi * 2
            wobble = (
                math.sin(theta * 6 + phase) * 0.020
                + math.sin(theta * 11) * 0.012
                + math.sin(theta * 3 + phase) * 0.030
            )
            r = base_r * (1 + wobble)
            x, y = cx + math.cos(theta) * r, cy + math.sin(theta) * r
            if prev is not None:
                d.line([prev, (x, y)], fill=ring_gradient_color(theta) + (255,), width=width)
            prev = (x, y)
    return layer


def draw_particles(size):
    """Scatter stardust, denser near the ring."""
    import random
    random.seed(7)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = cy = size / 2
    base_r = size * 0.31
    for _ in range(260):
        near = random.random() < 0.6
        rad = (0.86 + random.random() * 0.30) if near else (0.35 + random.random() * 1.0)
        ang = random.random() * math.pi * 2
        r = base_r * rad
        x, y = cx + math.cos(ang) * r, cy + math.sin(ang) * r
        s = random.uniform(1.0, 3.4) * SS
        a = int(random.uniform(0.10, 0.80) * 255)
        d.ellipse([x - s, y - s, x + s, y + s], fill=(255, 255, 255, a))
    return layer


def render_detailed(size):
    """Full-detail icon at `size` px (supersampled internally)."""
    r = size * SS
    bg = build_background(r).convert("RGBA")
    ring = draw_ring(r)
    glow = ring.filter(ImageFilter.GaussianBlur(radius=int(r * 0.020)))
    glow_wide = ring.filter(ImageFilter.GaussianBlur(radius=int(r * 0.055)))
    particles = draw_particles(r)
    pglow = particles.filter(ImageFilter.GaussianBlur(radius=int(r * 0.006)))

    comp = bg
    comp = Image.alpha_composite(comp, tint(glow_wide, GLOW_EDGE, 0.55))
    comp = Image.alpha_composite(comp, tint(glow, GLOW_EDGE, 0.85))
    comp = Image.alpha_composite(comp, pglow)
    comp = Image.alpha_composite(comp, particles)
    comp = Image.alpha_composite(comp, ring)
    comp.putalpha(rounded_mask(r, radius=int(r * 0.22)))
    return comp.resize((size, size), Image.LANCZOS)


# -------------------------------------------------------------------- flat ---
def render_flat(size):
    """
    Simplified icon for tiny sizes: one smooth gradient ring, thick stroke,
    a single soft glow pass, no braid or stardust. Radius/stroke are tuned so
    the ring survives being shrunk to 16px.
    """
    r = size * SS
    bg = build_background(r).convert("RGBA")

    ring = Image.new("RGBA", (r, r), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring)
    cx = cy = r / 2
    base_r = r * 0.33
    width = max(2, int(r * 0.11))  # bold, so it reads when downscaled
    prev = None
    for i in range(1441):
        theta = (i / 1440) * math.pi * 2
        x, y = cx + math.cos(theta) * base_r, cy + math.sin(theta) * base_r
        if prev is not None:
            d.line([prev, (x, y)], fill=ring_gradient_color(theta) + (255,), width=width)
        prev = (x, y)
    # Round the stroke's start/end join.
    d.ellipse([cx + base_r - width / 2, cy - width / 2,
               cx + base_r + width / 2, cy + width / 2],
              fill=ring_gradient_color(0.0) + (255,))

    glow = ring.filter(ImageFilter.GaussianBlur(radius=int(r * 0.030)))

    comp = bg
    comp = Image.alpha_composite(comp, tint(glow, GLOW_EDGE, 0.6))
    comp = Image.alpha_composite(comp, ring)
    comp.putalpha(rounded_mask(r, radius=int(r * 0.22)))
    return comp.resize((size, size), Image.LANCZOS)


# --------------------------------------------------------------- ico writer ---
def write_ico(path, images_by_size):
    """
    Write a multi-image ICO where each size can be a *different* rendering.
    Pillow's ICO save only rescales one image; assembling the container by
    hand lets small sizes use the flat art and large sizes the detailed art.
    Each entry is stored as a PNG payload (supported by Windows Vista+).
    """
    entries = []
    for size, img in sorted(images_by_size.items()):
        buf = io.BytesIO()
        img.resize((size, size), Image.LANCZOS).save(buf, format="PNG")
        entries.append((size, buf.getvalue()))

    header = struct.pack("<HHH", 0, 1, len(entries))  # reserved, type=icon, count
    offset = 6 + 16 * len(entries)
    directory, blobs = b"", b""
    for size, data in entries:
        b = size if size < 256 else 0
        directory += struct.pack("<BBBBHHII", b, b, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
        blobs += data
    with open(path, "wb") as f:
        f.write(header + directory + blobs)


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(here, "resources")
    os.makedirs(out_dir, exist_ok=True)

    detailed = render_detailed(1024)
    flat = render_flat(512)

    detailed.save(os.path.join(out_dir, "icon.png"))
    print("wrote resources/icon.png (detailed 1024)")

    flat.save(os.path.join(out_dir, "icon-small.png"))
    print("wrote resources/icon-small.png (flat 512)")

    # Flat for <=48px, detailed for >=64px.
    ico_images = {s: flat for s in (16, 24, 32, 48)}
    ico_images.update({s: detailed for s in (64, 128, 256)})
    write_ico(os.path.join(out_dir, "icon.ico"), ico_images)
    print("wrote resources/icon.ico (flat<=48, detailed>=64)")

    detailed.resize((1024, 1024), Image.LANCZOS).save(os.path.join(out_dir, "icon.icns"))
    print("wrote resources/icon.icns (detailed)")


if __name__ == "__main__":
    main()
