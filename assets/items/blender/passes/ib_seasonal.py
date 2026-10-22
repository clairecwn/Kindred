"""Seasonal Pop-Up: decorations that hang and pin up."""
from ii import *
from ip import *

@item("sea-lantern", "Festival Lantern", "seasonal-pop-up", "hang", (0.5, 0.5))
def lantern(b):
    """A round paper lantern in eight gores of two reds, gold caps, a bloom on the front and a tassel with a bead.
    0.78 m from its loop to the end of the tassel. Hangs from the origin."""
    A, Al, B2, B2d = V("A", "red"), V("A", "red", "lt"), V("B", "yellow"), V("B", "yellow", "dk")
    b.tube(ring(0, 0, -0.05, 0.034, 12, "xz"), 0.014, "gold", seg=8, closed=True)
    b.lathe([(0.0, -0.088), (0.05, -0.088), (0.075, -0.1), (0.108, -0.122), (0.112, -0.138), (0.08, -0.142)], mats=["gold_lt", "gold_lt", "gold", "gold", "gold_dk"], seg=20)
    body = [(0.0, -0.13), (0.07, -0.132), (0.14, -0.16), (0.195, -0.22), (0.215, -0.31), (0.195, -0.4), (0.14, -0.46), (0.07, -0.488), (0.0, -0.49)]
    gores(b, body, 8, lambda g, k: Al if g % 2 else A)
    bloom_at(b, (0, -0.212, -0.31), 0.075, "gold", "cream", 6, thick=0.144)
    b.lathe([(0.08, -0.478), (0.112, -0.482), (0.108, -0.498), (0.075, -0.52), (0.05, -0.532), (0.0, -0.532)], mats=["gold", "gold", "gold", "gold_dk", "gold_dk"], seg=20)
    b.cyl(0.014, 0.07, (0, 0, -0.6), "gold", seg=6); b.ball(0.036, (0, 0, -0.605), "cream", u=10, v=6)
    b.lathe([(0.0, 0.0), (0.05, 0.0), (0.056, 0.03), (0.036, 0.13), (0.0, 0.15)], (0, 0, -0.775), mats=[B2d, B2d, B2, B2], seg=12)

@item("sea-ribbon", "Celebration Ribbon", "seasonal-pop-up", "wall", (0.5, 0.5))
def ribbon(b):
    """A rosette in two scalloped layers with a gold button and a heart, and two striped tails. 0.48 m tall. Its back
    is flat against the wall at the origin."""
    A, Ad, Bc = V("A", "red"), V("A", "red", "dk"), V("B", "yellow")
    zc = 0.05
    b.cyl(0.11, 0.016, (0, 0, zc), "cream", seg=16, rot=(pi / 2, 0, 0))
    for sg in (-1, 1):
        b.prism([(sg * 0.1, 0.02), (sg * 0.0, 0.02), (sg * 0.03, -0.29), (sg * 0.085, -0.235), (sg * 0.14, -0.29)], 0.02, Ad, mtx=XZ(-0.03, 0, zc))
        b.prism([(sg * 0.066, 0.014), (sg * 0.034, 0.014), (sg * 0.069, -0.225), (sg * 0.101, -0.225)], 0.006, "cream", mtx=XZ(-0.034, 0, zc))
    b.prism(scallop(0.19, 12, 0.16, 5), 0.026, A, mtx=XZ(-0.05, 0, zc))
    b.prism(scallop(0.14, 10, 0.16, 5), 0.024, Bc, mtx=XZ(-0.07, 0, zc))
    b.prism(circle(0.095, 24), 0.018, "cream", mtx=XZ(-0.082, 0, zc), r=0.005)
    b.ball(0.07, (0, -0.082, zc), "gold", sc=(1, 0.45, 1), u=14, v=8)
    b.prism(heart_pts(0.032), 0.02, A, mtx=XZ(-0.124, 0, zc - 0.004), r=0.004)

@item("sea-gift", "Wrapped Grove Gift", "seasonal-pop-up", "table", (0.5, 0.5))
def gift(b):
    """A dotted box with a lid, a ribbon both ways and a fat bow."""
    A, Bc = V("A", "teal"), V("B", "yellow")
    b.box((0.34, 0.34, 0.24), (0, 0, 0.12), tn(A, 0.25, None), r=0.025)
    b.box((0.37, 0.37, 0.07), (0, 0, 0.265), tn(A, None, 0.4), r=0.02)
    b.box((0.07, 0.376, 0.306), (0, 0, 0.153), Bc); b.box((0.376, 0.07, 0.306), (0, 0, 0.153), Bc)
    sub(b, lambda sb: bow(sb, Bc, 0.62, tails=False), xf((0, 0, 0.35)))
    for nx, ny in ((0, -1), (1, 0), (-1, 0), (0, 1)):
        for u in (-0.105, 0.105):
            for z in (0.065, 0.165): stud(b, (nx * 0.17 + (u if ny else 0), ny * 0.17 + (u if nx else 0), z), (nx, ny, 0), 0.024, "cream", 0.3, 6, 4)

@item("sea-tree", "Tabletop Evergreen", "seasonal-pop-up", "table", (0.5, 0.5))
def evergreen(b):
    """A little tree in three tiers in a red pot, hung with baubles, with a bloom on top."""
    zs = pot(b, 0.13, 0.15, V("A", "red"))
    b.cyl(0.03, 0.12, (0, 0, zs - 0.02), "trunk", seg=8)
    cols = ("red", "yellow", "sky")
    for k, (R, z0, h) in enumerate(((0.2, 0.2, 0.2), (0.155, 0.33, 0.18), (0.11, 0.45, 0.17))):
        b.lathe([(0, 0.0), (R * 0.5, 0.0), (R, 0.03), (R * 0.85, 0.06), (0.03, h), (0, h)], (0, 0, z0), tn("green", 0.22, 0.75), seg=18)
        n = 6 - k
        for i in range(n):
            a = tau * (i + 0.5 * k) / n; b.ball(0.024, (R * 0.84 * cos(a), R * 0.84 * sin(a), z0 + 0.075), cols[(i + k) % 3], u=8, v=5)
    b.cyl(0.01, 0.05, (0, 0, 0.6), "gold", seg=6); bloom_at(b, (0, -0.004, 0.675), 0.05, "yellow", "white", 6)
