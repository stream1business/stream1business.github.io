#!/usr/bin/env python3
"""
Generate the NOVA app icon for packaging.

Renders the braided teal->violet ring-of-light mark on a dark rounded tile at
high resolution, then exports the formats electron-builder consumes:

  resources/icon.png    1024x1024  (Linux + electron-builder source)
  resources/icon.ico    multi-size (Windows)
  resources/icon.icns   multi-size (macOS)

Run:  python3 scripts/generate-icon.py
Requires: Pillow.  This is a build-time asset generator; the rendered icons are
committed so packaging never depends on Pillow being installed.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

# Brand palette (matches src/renderer/config/themes.ts · novaDefault)
TEAL = (45, 225, 194)     # #2DE1C2
VIOLET = (138, 79, 255)   # #8A4FFF
GLOW_EDGE = (181, 140, 255)  # #B58CFF
BG_TOP = (18, 8, 38)      # #120826 deep indigo
BG_BOTTOM = (4, 2, 10)    # near-black

SS = 4                    # supersample factor for antialiasing
SIZE = 1024
R = SIZE * SS             # working canvas edge


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def build_background(size):
    """Vertical dark gradient tile."""
    bg = Image.new("RGB", (size, size))
    px = bg.load()
    for y in range(size):
        t = y / (size - 1)
        # ease toward the darker bottom
        col = lerp(BG_TOP, BG_BOTTOM, t ** 1.3)
        for x in range(size):
            px[x, y] = col
    return bg


def ring_gradient_color(theta):
    """Teal on one side, violet on the other, blended smoothly around."""
    # 0..1 sweep; use a cosine so both edges read as full-saturation.
    t = 0.5 - 0.5 * math.cos(theta)  # smooth 0->1->0 over 0..2pi
    return lerp(TEAL, VIOLET, t)


def draw_ring(size):
    """Draw the braided ring onto a transparent RGBA layer."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = cy = size / 2
    base_r = size * 0.31
    strands = 3
    steps = 1440

    for strand in range(strands):
        phase = (strand / strands) * math.pi * 2
        width = max(2, int(size * (0.020 - strand * 0.004)))
        prev = None
        for i in range(steps + 1):
            theta = (i / steps) * math.pi * 2
            wobble = (
                math.sin(theta * 6 + phase) * 0.020
                + math.sin(theta * 11) * 0.012
                + math.sin(theta * 3 + phase) * 0.030
            )
            r = base_r * (1 + wobble)
            x = cx + math.cos(theta) * r
            y = cy + math.sin(theta) * r
            if prev is not None:
                col = ring_gradient_color(theta)
                d.line([prev, (x, y)], fill=col + (255,), width=width)
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
        x = cx + math.cos(ang) * r
        y = cy + math.sin(ang) * r
        s = random.uniform(1.0, 3.4) * SS
        a = int(random.uniform(0.10, 0.80) * 255)
        d.ellipse([x - s, y - s, x + s, y + s], fill=(255, 255, 255, a))
    return layer


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(here, "resources")
    os.makedirs(out_dir, exist_ok=True)

    bg = build_background(R).convert("RGBA")

    # Ring + its glow (blurred copy behind the crisp ring).
    ring = draw_ring(R)
    glow = ring.filter(ImageFilter.GaussianBlur(radius=int(R * 0.020)))
    glow_wide = ring.filter(ImageFilter.GaussianBlur(radius=int(R * 0.055)))

    particles = draw_particles(R)
    pglow = particles.filter(ImageFilter.GaussianBlur(radius=int(R * 0.006)))

    comp = bg
    comp = Image.alpha_composite(comp, tint(glow_wide, GLOW_EDGE, 0.55))
    comp = Image.alpha_composite(comp, tint(glow, GLOW_EDGE, 0.85))
    comp = Image.alpha_composite(comp, pglow)
    comp = Image.alpha_composite(comp, particles)
    comp = Image.alpha_composite(comp, ring)

    # Round the tile corners.
    mask = rounded_mask(R, radius=int(R * 0.22))
    comp.putalpha(mask)

    # Downsample to final size for clean antialiasing.
    icon = comp.resize((SIZE, SIZE), Image.LANCZOS)

    png_path = os.path.join(out_dir, "icon.png")
    icon.save(png_path)
    print("wrote", png_path)

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    icon.save(os.path.join(out_dir, "icon.ico"), sizes=[(s, s) for s in ico_sizes])
    print("wrote", os.path.join(out_dir, "icon.ico"))

    # ICNS wants square power-of-two sizes; Pillow derives them from the image.
    icns_img = icon.resize((1024, 1024), Image.LANCZOS)
    icns_img.save(os.path.join(out_dir, "icon.icns"))
    print("wrote", os.path.join(out_dir, "icon.icns"))


def tint(layer, color, strength):
    """Recolour a white/greyscale glow layer toward `color`, scaling alpha."""
    r, g, b, a = layer.split()
    solid = Image.new("RGBA", layer.size, color + (0,))
    a = a.point(lambda v: int(v * strength))
    solid.putalpha(a)
    return solid


if __name__ == "__main__":
    main()
