"""Maker Meadow: materials and craft things."""
from ii import *
from ip import *

@item("mak-wood", "Bundle of Wood", "maker-meadow", "pack", (1, 1))
def wood(b):
    """Three fat logs, two under one, with pale end grain, tied with two ropes and a bow, and a sprout growing from
    the top log. 0.62 m long, 0.6 m tall; carried in both arms."""
    R, L, z0 = 0.125, 0.62, 0.044
    for (y, z), dx in zip(((-0.128, z0 + R), (0.128, z0 + R), (0.0, z0 + R + 0.2165)), (0.0, 0.02, -0.02)):
        b.lathe([(0.0, 0.0), (0.05, 0.0), (0.098, 0.0), (0.118, 0.005), (R, 0.022), (R, L - 0.022), (0.118, L - 0.005), (0.098, L), (0.05, L), (0.0, L)], (-L / 2 + dx, y, z),
                mats=["straw", "trunk_light", "trunk", "trunk", "trunk", "trunk", "trunk", "trunk_light", "straw"], seg=18, rot=(0, pi / 2, 0))
    loop = [(-0.128, 0.022), (0.128, 0.022), (0.2553, 0.0955), (0.275, 0.169), (0.2553, 0.2425), (0.1273, 0.459), (0, 0.5325),
            (-0.1273, 0.459), (-0.2553, 0.2425), (-0.275, 0.169), (-0.2553, 0.0955)]
    for x in (-0.17, 0.17): b.tube([(x, y, z) for y, z in loop], 0.022, "rope", seg=8, closed=True)
    sub(b, lambda sb: bow(sb, "rope", 0.42, tails=False), xf((0.17, 0, 0.552), (-pi / 2, 0, 0)))
    stud(b, (0.12, -0.216, 0.257), (0, -0.7, 0.7), 0.032, "trunk_light")
    sprout(b, (-0.08, 0.02, 0.505), 0.12, 0.5)

@item("mak-fence", "Picket Fence", "maker-meadow", "floor", (1, 0.5), kit="fence")
def fence(b):
    """One metre of fence as it is sold: two posts with bud caps, two rails, three pickets and a heart. On the island
    the fence is drawn from the Kingdom's post and rail pieces, which join to their neighbours."""
    A = V("A", "white")
    for sx in (-1, 1):
        b.cyl(0.055, 0.95, (sx * 0.42, 0, 0), A, seg=12); b.ball(0.075, (sx * 0.42, 0, 0.98), "cream", sc=(1, 1, 1.1), u=10, v=6)
    for z in (0.32, 0.7): b.box((0.84, 0.05, 0.09), (0, 0, z), A, r=0.02)
    for x in (-0.21, 0.0, 0.21):
        b.prism([(-0.07, 0.08), (0.07, 0.08), (0.07, 0.82), (0.045, 0.88), (0, 0.9), (-0.045, 0.88), (-0.07, 0.82)], 0.04, tn(A, 0.2, None), mtx=XZ(-0.055, x, 0), r=0.01)
    heart_at(b, -0.055, 0.62, 0.035, "red", depth=0.014)

@item("mak-toolbox", "Pocket Toolbox", "maker-meadow", "table", (0.5, 0.5))
def toolbox(b):
    """A red toolbox with a domed lid, a cream seam, two gold latches, a big handle and a leaf on the front."""
    A = V("A", "red")
    b.box((0.4, 0.2, 0.17), (0, 0, 0.085), tn(A, 0.25, None), r=0.03)
    b.box((0.41, 0.21, 0.1), (0, 0, 0.2), tn(A, None, 0.5), r=0.045, seg=3)
    b.box((0.416, 0.216, 0.018), (0, 0, 0.165), "cream")
    for sx in (-1, 1): b.box((0.06, 0.022, 0.075), (sx * 0.11, -0.108, 0.162), "gold", r=0.008)
    b.tube([(-0.11, 0, 0.235), (-0.11, 0, 0.3), (-0.07, 0, 0.335), (0.07, 0, 0.335), (0.11, 0, 0.3), (0.11, 0, 0.235)], 0.022, "cream", seg=8)
    leaves_at(b, -0.104, 0.075, 0.06, "cream")

@item("mak-yarn", "Soft Yarn Ball", "maker-meadow", "table", (0.5, 0.5))
def yarn(b):
    """A fat ball of pink yarn wound three ways, with two needles through it and a loose end."""
    A = V("A", "pink"); l = derive(A, "lt")
    b.ball(0.15, (0, 0, 0.155), tn(A, 0.25, 0.72), u=18, v=12)
    for rot in ((0.5, 0, 0.3), (-0.6, 0.4, 1.2), (1.3, 0.2, 2.2)):
        sub(b, lambda sb: sb.tube(ring(0, 0, 0, 0.142, 16, "xz"), 0.013, l, seg=5, closed=True), xf((0, 0, 0.155), rot))
    for sg in (-1, 1):
        b.tube([(sg * 0.21, 0.03 * sg, 0.37), (sg * 0.02, 0, 0.12)], 0.012, "wood", seg=6); b.ball(0.026, (sg * 0.21, 0.03 * sg, 0.37), "cream", u=8, v=5)
    b.tube([(0.1, -0.1, 0.03), (0.17, -0.14, 0.013), (0.215, -0.08, 0.013), (0.18, -0.02, 0.013)], 0.013, A, seg=6)

@item("mak-paint", "Meadow Paint Tin", "maker-meadow", "table", (0.5, 0.5))
def paint(b):
    """An open tin of green paint: a label in the paint's colour with a bloom, a drip down the side, a wire handle,
    and a brush lying across the top."""
    A = V("A", "green")
    b.lathe([(0, 0), (0.105, 0), (0.115, 0.012), (0.115, 0.2), (0.122, 0.205), (0.122, 0.215), (0.1, 0.218), (0.098, 0.19), (0, 0.19)],
            mats=["steel_dk", "steel", "steel", "steel_lt", "steel_lt", "steel", "steel_dk", A], seg=24)
    band(b, 0.115, 0.04, 0.16, A, seg=24); bloom_at(b, (0, -0.124, 0.1), 0.035, "cream", "gold", 6)
    b.tube([(0.07, -0.095, 0.217), (0.076, -0.103, 0.17), (0.076, -0.103, 0.13)], [0.02, 0.016, 0.02], A, seg=8); b.ball(0.022, (0.076, -0.103, 0.125), A, u=8, v=5)
    b.tube([(-0.12, 0, 0.17), (-0.14, 0, 0.3), (0, 0, 0.365), (0.14, 0, 0.3), (0.12, 0, 0.17)], 0.011, "steel", seg=6)
    b.cyl(0.018, 0.2, (-0.2, 0.02, 0.238), "wood", seg=8, rot=(0, pi / 2, 0)); b.box((0.05, 0.07, 0.032), (0.025, 0.02, 0.238), "steel", r=0.006)
    b.box((0.07, 0.065, 0.028), (0.085, 0.02, 0.238), "cream", r=0.008); b.box((0.03, 0.067, 0.03), (0.118, 0.02, 0.238), A, r=0.01)

@item("mak-sewing", "Mini Sewing Machine", "maker-meadow", "table", (0.5, 0.5))
def sewing(b):
    """A teal sewing machine on a cream base: needle and plate on the left, a gold hand wheel on the right, a spool of
    pink thread on top."""
    A = V("A", "teal"); Bc = V("B", "pink")
    b.box((0.44, 0.2, 0.06), (0, 0, 0.03), tn("cream", 0.3, None), r=0.025)
    b.box((0.1, 0.14, 0.24), (0.15, 0, 0.17), tn(A, 0.2, 0.8), r=0.035); b.box((0.36, 0.13, 0.1), (0.0, 0, 0.29), tn(A, None, 0.6), r=0.04)
    b.box((0.09, 0.12, 0.12), (-0.14, 0, 0.21), A, r=0.03)
    b.cyl(0.008, 0.08, (-0.14, 0, 0.075), "steel", seg=6); b.box((0.05, 0.03, 0.012), (-0.14, 0, 0.074), "steel"); b.box((0.1, 0.12, 0.006), (-0.14, 0, 0.062), "steel")
    b.cyl(0.07, 0.03, (0.2, 0, 0.27), "gold", seg=18, rot=(0, pi / 2, 0))
    b.cyl(0.034, 0.06, (0.05, 0, 0.34), Bc, seg=12)
    for z in (0.336, 0.398): b.cyl(0.044, 0.008, (0.05, 0, z), "cream", seg=12)
    stud(b, (0.15, -0.07, 0.2), (0, -1, 0), 0.026, "cream"); leaves_at(b, -0.068, 0.29, 0.06, "cream", x=-0.02)

@item("mak-birdhouse", "Build-a-Birdhouse Kit", "maker-meadow", "table", (0.5, 0.5))
def bkit(b):
    """A kraft box with a red band and a picture of the birdhouse on the front, planks showing at the top."""
    A = V("A", "red")
    b.box((0.36, 0.12, 0.3), (0, 0, 0.15), tn("kraft", 0.2, None), r=0.015)
    b.box((0.372, 0.132, 0.06), (0, 0, 0.05), A)
    b.box((0.22, 0.012, 0.17), (0, -0.062, 0.19), "cream")
    b.box((0.09, 0.02, 0.08), (0, -0.07, 0.165), "wood_lt"); b.prism([(-0.065, 0), (0.065, 0), (0, 0.055)], 0.024, A, mtx=XZ(-0.083, 0, 0.205))
    stud(b, (0, -0.081, 0.17), (0, -1, 0), 0.017, "ink", 0.3)
    for x, t in ((-0.1, 0.1), (0.0, -0.05), (0.09, 0.08)): b.box((0.07, 0.022, 0.16), (x, 0.01, 0.33), "wood", r=0.006, rot=(0, t, 0))
