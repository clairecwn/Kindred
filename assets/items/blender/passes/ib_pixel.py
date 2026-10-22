"""Pixel Pantry: games and things to play them on."""
from ii import *
from ip import *

@item("gam-handheld", "Pocket Console", "pixel-pantry", "table", (0.5, 0.5))
def handheld(b):
    """A teal handheld standing on its edge: a sky screen with a sprout on it, a cream pad on the left, two buttons
    on the right, and shoulder bumps."""
    A = V("A", "teal"); d = derive(A, "dk")
    b.box((0.44, 0.08, 0.24), (0, 0, 0.12), tn(A, 0.2, 0.85), r=0.036, seg=3)
    b.box((0.2, 0.012, 0.15), (0, -0.04, 0.125), "ink", r=0.004); b.box((0.17, 0.012, 0.12), (0, -0.045, 0.125), "sky")
    leaves_at(b, -0.053, 0.125, 0.07, "leaf_light")
    b.box((0.07, 0.014, 0.024), (-0.155, -0.042, 0.13), "cream", r=0.004); b.box((0.024, 0.014, 0.07), (-0.155, -0.042, 0.13), "cream", r=0.004)
    stud(b, (0.175, -0.04, 0.15), (0, -1, 0), 0.022, "red"); stud(b, (0.135, -0.04, 0.105), (0, -1, 0), 0.022, "yellow")
    for sx in (-1, 1): b.box((0.1, 0.05, 0.02), (sx * 0.15, 0.0, 0.238), d, r=0.008)
    b.box((0.14, 0.12, 0.012), (0, 0.06, 0.006), d)

@item("gam-controller", "Meadow Controller", "pixel-pantry", "table", (0.5, 0.5))
def controller(b):
    """A green gamepad propped up to show its face: two grips, a cream pad, four coloured buttons and two sticks."""
    A = V("A", "green")
    def pad(sb):
        sb.box((0.3, 0.16, 0.07), (0, 0.01, 0.035), tn(A, 0.3, 0.8), r=0.032, seg=3)
        for sx in (-1, 1): sb.ball(1.0, (sx * 0.15, -0.03, 0.03), tn(A, 0.3, 0.8), sc=(0.075, 0.11, 0.05), u=12, v=8, rot=(0, 0, sx * 0.3))
        sb.box((0.06, 0.02, 0.014), (-0.09, 0.03, 0.072), "cream"); sb.box((0.02, 0.06, 0.014), (-0.09, 0.03, 0.072), "cream")
        for (dx, dy), c in zip(((0.03, 0), (-0.03, 0), (0, 0.03), (0, -0.03)), ("red", "yellow", "sky", "cream")): stud(sb, (0.09 + dx, 0.03 + dy, 0.07), (0, 0, 1), 0.016, c)
        for sx in (-1, 1):
            sb.cyl(0.02, 0.025, (sx * 0.04, -0.03, 0.065), "ink", seg=8); sb.ball(0.028, (sx * 0.04, -0.03, 0.095), "slate", sc=(1, 1, 0.5), u=8, v=5)
        stud(sb, (0, 0.05, 0.07), (0, 0, 1), 0.014, "cream")
    sub(b, pad, xf((0, 0, 0.12), (1.05, 0, 0)))
    b.box((0.12, 0.07, 0.11), (0, 0.075, 0.075), tn("cream", 0.3, None), r=0.02)
    ground(b)

@item("gam-headphones", "Cloud Headphones", "pixel-pantry", "wear", (1.5, 0.5), stand="head", lift=1.25)
def headphones(b):
    """Sized to the head (1.1 m between the cushions): sky-blue cups with puffy cream cushions and a cloud on each,
    joined by a padded band. They rest on their cups."""
    A = V("A", "sky")
    for sx in (-1, 1):
        r = (0, sx * pi / 2, 0)
        b.lathe([(0, 0), (0.15, 0), (0.2, 0.03), (0.2, 0.08), (0.16, 0.1), (0, 0.1)], (sx * 0.56, 0, 0.2), tn(A, 0.25, 0.75), seg=24, rot=r)
        b.lathe([(0, -0.05), (0.14, -0.05), (0.19, -0.03), (0.19, 0.005), (0, 0.005)], (sx * 0.56, 0, 0.2), tn("cream", 0.25, None), seg=24, rot=r)
        for dy, dz, rr in ((-0.05, -0.012, 0.045), (0.0, 0.02, 0.058), (0.05, -0.012, 0.045)): stud(b, (sx * 0.662, dy, 0.2 + dz), (sx, 0, 0), rr, "white", 0.3)
    arc = [(0.61 * cos(radians(t)), 0, 0.24 + 0.5 * sin(radians(t))) for t in range(0, 181, 15)]
    b.tube(arc, 0.04, A, seg=8)
    b.tube(arc[4:9], 0.056, "cream", seg=10)

@item("gam-adventure", "Tiny Adventure Game", "pixel-pantry", "table", (0.5, 0.5))
def gamecase(b):
    """A purple game case standing upright: two green hills under a sun on the cover, a sprout on the near hill,
    and a cream title band."""
    A = V("A", "purple")
    b.box((0.27, 0.05, 0.37), (0, 0, 0.185), tn(A, 0.15, 0.88), r=0.012)
    b.box((0.23, 0.012, 0.25), (0, -0.026, 0.215), "sky")
    b.prism([(0.075 * cos(pi * i / 12), 0.07 * sin(pi * i / 12)) for i in range(13)], 0.012, "leaf_light", mtx=XZ(-0.038, 0.045, 0.09))
    b.prism([(0.1 * cos(pi * i / 12), 0.085 * sin(pi * i / 12)) for i in range(13)], 0.012, "green", mtx=XZ(-0.044, -0.035, 0.09))
    b.prism(circle(0.034, 14), 0.012, "yellow", mtx=XZ(-0.038, 0.065, 0.29))
    leaves_at(b, -0.05, 0.2, 0.05, "leaf_dark", x=-0.035)
    b.box((0.23, 0.012, 0.05), (0, -0.026, 0.055), "cream")
    for x, c in ((-0.07, "red"), (-0.035, "yellow"), (0.0, "sky")): stud(b, (x, -0.032, 0.055), (0, -1, 0), 0.012, c)

@item("gam-collectible", "Pixel Pal Figure", "pixel-pantry", "table", (0.5, 0.5))
def figure(b):
    """A blocky mint pal on a round stand: big square head, dot eyes, pink cheeks, a heart on its tummy and a sprout
    on its head."""
    A = V("A", "mint"); d = derive(A, "dk")
    b.cyl(0.115, 0.03, (0, 0, 0), "plum", seg=20, bev=0.008); b.cyl(0.095, 0.008, (0, 0, 0.028), "cream", seg=20)
    for sx in (-1, 1):
        b.box((0.06, 0.08, 0.045), (sx * 0.045, -0.005, 0.055), d, r=0.012); b.box((0.04, 0.05, 0.075), (sx * 0.1, 0, 0.125), A, r=0.012)
    b.box((0.16, 0.12, 0.11), (0, 0, 0.125), tn(A, 0.3, None), r=0.02)
    b.box((0.23, 0.18, 0.18), (0, 0, 0.268), tn(A, None, 0.7), r=0.03)
    for sx in (-1, 1):
        b.box((0.03, 0.014, 0.046), (sx * 0.052, -0.09, 0.278), "ink", r=0.006); stud(b, (sx * 0.082, -0.089, 0.238), (0, -1, 0), 0.016, "pink", 0.3)
    b.box((0.04, 0.012, 0.012), (0, -0.09, 0.238), "ink")
    b.box((0.075, 0.012, 0.055), (0, -0.061, 0.125), "cream"); heart_at(b, -0.068, 0.125, 0.018, "red", depth=0.01)
    sprout(b, (0, 0, 0.365), 0.09, 0.3)
