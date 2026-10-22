"""Cafe Canopy: things for a table, and a mat to eat on."""
from ii import *
from ip import *

@item("eat-mug", "Cocoa Mug", "cafe-canopy", "table", (0.5, 0.5))
def mug(b):
    """A barrel mug sized to the character's hand (0.29 m): cream rim, a heart on the front, a big ear handle to the
    right, and cocoa under a swirl of cream."""
    A, Ad, Al = V("A", "red"), V("A", "red", "dk"), V("A", "red", "lt")
    b.lathe([(0.0, 0.0), (0.1, 0.0), (0.125, 0.02), (0.148, 0.1), (0.15, 0.16), (0.142, 0.225), (0.15, 0.245), (0.15, 0.262), (0.128, 0.265), (0.122, 0.22), (0.0, 0.215)],
            mats=[Ad, Ad, A, A, Al, "cream", "cream", "cream", "cream", "cocoa"], seg=24)
    b.tube([(0.125 + 0.09 * cos(radians(t)), 0, 0.135 + 0.08 * sin(radians(t))) for t in (85, 60, 30, 0, -30, -60, -85)], 0.03, A, seg=10)
    heart_at(b, -0.144, 0.125, 0.055, "cream", depth=0.03)
    swirl(b, 0.215, 0.1)

@item("eat-tart", "Berry Tart", "cafe-canopy", "table", (0.5, 0.5))
def tart(b):
    """A fluted tart on a cream plate: jam, a ring of berries in two colours, and a sprig in the middle."""
    b.lathe([(0, 0), (0.12, 0), (0.2, 0.018), (0.215, 0.03), (0.2, 0.034), (0.12, 0.02), (0, 0.02)], mats=["cream_dk", "cream", "cream", "cream_lt", "cream_lt", "cream"], seg=28)
    b.prism(scallop(0.17, 14, 0.1, 3), 0.07, tn("crust", 0.3, 0.85), loc=(0, 0, 0.02), r=0.012)
    b.cyl(0.14, 0.012, (0, 0, 0.085), "berry", seg=24)
    for i in range(8):
        a = tau * i / 8; berry(b, (0.098 * cos(a), 0.098 * sin(a), 0.122), 0.035, "red" if i % 2 else "plumfruit")
    berry(b, (0, 0, 0.128), 0.04, "red")
    sprout(b, (0, 0, 0.17), 0.07, 0.4)

@item("eat-teapot", "Garden Teapot", "cafe-canopy", "table", (0.5, 0.5))
def teapot(b):
    """A round green teapot: cream lid with a gold knob, spout to the right, handle to the left, two leaves on the front."""
    d, m, l = tri(V("A", "green"))
    b.lathe([(0, 0), (0.075, 0), (0.086, 0.012), (0.072, 0.022), (0.115, 0.05), (0.14, 0.11), (0.13, 0.17), (0.095, 0.205), (0.07, 0.212), (0, 0.212)], mats=[d, d, d, d, m, m, l, l, l], seg=24)
    b.lathe([(0, 0.0), (0.085, 0.0), (0.092, 0.012), (0.06, 0.036), (0, 0.046)], (0, 0, 0.205), mats=["cream", "cream", "cream_lt", "cream_lt"], seg=24)
    b.ball(0.028, (0, 0, 0.265), "gold", u=10, v=6)
    b.tube([(0.1, 0, 0.08), (0.17, 0, 0.11), (0.205, 0, 0.18), (0.225, 0, 0.215)], [0.04, 0.03, 0.022, 0.018], m, seg=8)
    b.tube([(-0.125 - 0.085 * cos(radians(t)), 0, 0.12 + 0.07 * sin(radians(t))) for t in (80, 50, 25, 0, -25, -50, -80)], 0.022, m, seg=8)
    leaves_at(b, -0.143, 0.115, 0.085, "cream")

@item("eat-picnicmat", "Picnic Mat", "cafe-canopy", "rug", (2, 1.5))
def picnic(b):
    """A gingham blanket, 1.9 x 1.43 m, in three values of one colour."""
    A, Al = V("A", "red"), V("A", "red", "lt")
    checker_slab(b, 8, 6, 1.9, 1.425, 0.0, 0.024, lambda i, j: A if (i % 2 == 0 and j % 2 == 0) else "cream" if (i % 2 and j % 2) else Al)
    for sx in (-1, 1):                                                   # a fringe of fat cream tassels along each short end
        for j in range(9):
            y = -0.66 + 1.32 * j / 8; b.ball(1.0, (sx * 0.962, y, 0.014), "cream", sc=(0.032, 0.026, 0.013), u=8, v=4)
    b.prism([(0.95, 0.71), (0.55, 0.71), (0.95, 0.31)], 0.012, derive(A, "lt"), loc=(0, 0, 0.026))       # a corner folded back, its underside showing
    b.ball(1.0, (0.75, 0.51, 0.04), "cream", sc=(0.28, 0.02, 0.016), u=10, v=4, rot=(0, 0, -pi / 4))

alias("eat-honeyjar", "gro-honeyjar", "Honey Jar", "cafe-canopy")
