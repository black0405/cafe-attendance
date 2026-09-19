"""Draws the Cafe Attendance logo (coffee cup, fingerprint-style steam, check badge)
and writes every size the app and installer need. Run once; outputs are committed.

  python scripts/make-logo.py
"""
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
S = 1024  # draw large, downscale for crisp edges

BG = (124, 63, 29)        # coffee brown
BG_DARK = (92, 45, 20)
CREAM = (253, 242, 233)
CHECK_BG = (34, 197, 94)  # green
WHITE = (255, 255, 255)


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def logo(size=S, badge=True):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size / S

    # tile
    rounded(d, (0, 0, size, size), int(220 * k), BG)
    # subtle darker bottom band for depth
    d.rounded_rectangle((0, int(700 * k), size, size), radius=int(220 * k), fill=BG_DARK)
    d.rectangle((0, int(700 * k), size, int(820 * k)), fill=BG_DARK)

    # saucer
    d.ellipse((int(200 * k), int(740 * k), int(760 * k), int(830 * k)), fill=CREAM)

    # cup body: rounded bottom
    d.rounded_rectangle((int(250 * k), int(430 * k), int(690 * k), int(790 * k)), radius=int(120 * k), fill=CREAM)
    d.rectangle((int(250 * k), int(430 * k), int(690 * k), int(600 * k)), fill=CREAM)
    # cup rim (slightly wider ellipse)
    d.ellipse((int(240 * k), int(400 * k), int(700 * k), int(470 * k)), fill=CREAM)
    d.ellipse((int(275 * k), int(415 * k), int(665 * k), int(455 * k)), fill=BG)

    # handle
    w = int(70 * k)
    d.ellipse((int(640 * k), int(490 * k), int(820 * k), int(690 * k)), outline=CREAM, width=w)
    d.rectangle((int(600 * k), int(470 * k), int(700 * k), int(720 * k)), fill=CREAM)
    d.rounded_rectangle((int(250 * k), int(430 * k), int(690 * k), int(790 * k)), radius=int(120 * k), fill=CREAM)
    d.rectangle((int(250 * k), int(430 * k), int(690 * k), int(600 * k)), fill=CREAM)
    d.ellipse((int(275 * k), int(415 * k), int(665 * k), int(455 * k)), fill=BG)

    # steam as fingerprint-like concentric arcs
    cx, cy = int(470 * k), int(330 * k)
    for i, r in enumerate((60, 110, 160)):
        rr = int(r * k)
        d.arc((cx - rr, cy - rr, cx + rr, cy + rr), start=200, end=340, fill=CREAM, width=int(26 * k))
    d.arc((cx - int(210 * k), cy - int(210 * k), cx + int(210 * k), cy + int(210 * k)), start=215, end=255, fill=CREAM, width=int(26 * k))
    d.arc((cx - int(210 * k), cy - int(210 * k), cx + int(210 * k), cy + int(210 * k)), start=285, end=325, fill=CREAM, width=int(26 * k))

    # check badge
    if badge:
        bx, by, br = int(800 * k), int(800 * k), int(150 * k)
        d.ellipse((bx - br - int(18 * k), by - br - int(18 * k), bx + br + int(18 * k), by + br + int(18 * k)), fill=BG)
        d.ellipse((bx - br, by - br, bx + br, by + br), fill=CHECK_BG)
        d.line([(bx - int(70 * k), by), (bx - int(15 * k), by + int(55 * k)), (bx + int(75 * k), by - int(55 * k))],
               fill=WHITE, width=int(34 * k), joint="curve")
    return img


big = logo()
out_public = ROOT / "public"
out_public.mkdir(exist_ok=True)

big.resize((512, 512), Image.LANCZOS).save(out_public / "logo.png")
big.resize((256, 256), Image.LANCZOS).save(ROOT / "app" / "icon.png")

sizes = [16, 24, 32, 48, 64, 128, 256]
frames = [big.resize((s, s), Image.LANCZOS) for s in sizes]
# small sizes: drop the badge, it turns to mush below 32px
small = logo(badge=False)
frames = [(small if s < 32 else big).resize((s, s), Image.LANCZOS) for s in sizes]
frames[-1].save(ROOT / "installer" / "icon.ico", format="ICO", sizes=[(s, s) for s in sizes], append_images=frames[:-1])

print("wrote public/logo.png, app/icon.png, installer/icon.ico")
