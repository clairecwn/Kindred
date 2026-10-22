"""Home Nook: furniture and things for the floor."""
from ii import *
from ip import *

@item("fur-stool", "Wonky Stool", "home-nook", "floor", (1, 1), seat=(0, 0, 0.44, 0))
def stool(b):
    """Three fat turned legs with cream feet, and a puffy cushion that sits a little off level. Seat top 0.44 m."""
    A = V("A", "red")
    for i, bend in enumerate((0.0, 0.03, -0.02)):
        a = radians(90 + 120 * i); cx, cy = cos(a), sin(a); f = 0.255 + bend
        d = Vector(((0.14 - f) * cx, (0.14 - f) * cy, 0.27)); L = d.length
        b.ball(0.062, (f * cx, f * cy, 0.031), "cream", sc=(1, 1, 0.5), u=10, v=6)
        b.lathe([(0.0, 0.0), (0.04, 0.0), (0.05, 0.03), (0.072, 0.13), (0.066, 0.19), (0.046, L - 0.02), (0.0, L)], (f * cx, f * cy, 0.02),
                mats=["wood_dk", "wood_dk", "wood", "wood", "wood", "wood"], seg=12, rot=d.to_track_quat("Z", "Y").to_matrix())
    def seat(sb):
        sb.lathe([(0.0, 0.0), (0.24, 0.0), (0.295, 0.02), (0.31, 0.05), (0.295, 0.085), (0.0, 0.09)], mats=["wood_dk", "wood_dk", "wood", "wood_lt", "wood_lt"], seg=28)
        sb.lathe([(0.262, 0.08), (0.3, 0.076), (0.313, 0.096), (0.3, 0.116), (0.262, 0.112)], m="cream", seg=28, cap=False)
        sb.lathe([(0.0, 0.085), (0.2, 0.085), (0.283, 0.105), (0.3, 0.14), (0.272, 0.178), (0.16, 0.203), (0.0, 0.21)], m=tn(A, 0.3, 0.84), seg=28)
        sb.ball(0.045, (0, 0, 0.207), "gold", sc=(1, 1, 0.5), u=10, v=6)
    sub(b, seat, xf((0, 0, 0.23), (0.045, -0.03, 0)))

@item("fur-lamp", "Reading Lamp", "home-nook", "floor", (1, 1))
def lamp(b):
    """A standing lamp, 2 m tall so the shade clears the character's head: a domed gold foot, a pole with two cream
    collars, a striped bell shade with a bobble trim, and a bud on top."""
    A, Al = V("A", "teal"), V("A", "teal", "lt")
    b.lathe([(0.0, 0.0), (0.24, 0.0), (0.28, 0.03), (0.27, 0.07), (0.2, 0.12), (0.1, 0.16), (0.06, 0.2)], mats=["gold_dk", "gold_dk", "gold", "gold", "gold_lt", "gold_lt"], seg=24)
    b.lathe([(0.045, 0.18), (0.045, 0.62), (0.072, 0.65), (0.072, 0.69), (0.045, 0.72), (0.045, 1.2), (0.072, 1.23), (0.072, 1.27), (0.045, 1.3), (0.045, 1.84)],
            mats=["gold", "cream", "cream", "cream", "gold", "cream", "cream", "cream", "gold"], seg=14, cap=False)
    shade = [(0.0, 0.44), (0.1, 0.44), (0.16, 0.4), (0.24, 0.26), (0.33, 0.08), (0.36, 0.0), (0.33, 0.0), (0.3, 0.08), (0.21, 0.26), (0.13, 0.38), (0.0, 0.4)]
    gores(b, shade, 10, lambda g, k: "cream" if k == 5 else "glow" if k > 5 else (A if g % 2 else Al), (0, 0, 1.42))
    for i in range(15):
        a = tau * i / 15; b.ball(0.047, (0.362 * cos(a), 0.362 * sin(a), 1.418), "cream", u=8, v=5)
    b.ball(0.11, (0, 0, 1.55), "bulb", u=12, v=8)
    b.lathe([(0.0, 0.0), (0.05, 0.015), (0.065, 0.06), (0.04, 0.115), (0.0, 0.15)], (0, 0, 1.85), "gold", seg=12)
    b.cyl(0.013, 0.3, (0.2, 0, 1.2), "cream", seg=6); b.ball(0.04, (0.2, 0, 1.19), "gold", u=8, v=6)

@item("fur-rug", "Round Rug", "home-nook", "rug", (2, 2))
def rug(b):
    """1.94 m across with a scalloped edge: a dotted band, a plain ring, and the Grove's bloom in the middle."""
    A, Bc = V("A", "teal"), V("B", "gold")
    b.prism(scallop(0.97, 16, 0.07), 0.026, "cream", r=0.008)
    b.cyl(0.8, 0.006, (0, 0, 0.024), Bc, seg=40); b.cyl(0.6, 0.006, (0, 0, 0.028), "cream", seg=32); b.cyl(0.45, 0.006, (0, 0, 0.032), A, seg=28)
    for i in range(12):
        a = tau * (i + 0.5) / 12; b.cyl(0.055, 0.005, (0.7 * cos(a), 0.7 * sin(a), 0.028), "cream", seg=10)
    b.mesh(bloom_data(8, "cream", "gold"), None, mtx=xf((0, 0, 0.039), (-pi / 2, 0, 0)) @ Matrix.Diagonal((0.3, 0.08, 0.3, 1)))

@item("fur-shelf", "Small Shelf", "home-nook", "floor", (1, 0.5),
      surface=(-0.4, -0.17, 0.4, 0.16, 0.125, -0.4, -0.17, 0.4, 0.16, 0.505, -0.4, -0.17, 0.4, 0.16, 0.885, -0.46, -0.2, 0.46, 0.2, 1.28))
def shelf(b):
    """A cream bookcase 1.28 m tall: three wooden boards and a top that hold small things, a coloured back, a scalloped
    apron under the top, and round wooden feet."""
    A = V("A", "sky")
    for sx in (-1, 1):
        b.box((0.06, 0.4, 1.2), (sx * 0.44, 0, 0.64), "cream", r=0.02)
        for sy in (-1, 1): b.ball(0.05, (sx * 0.43, sy * 0.15, 0.03), "wood", sc=(1, 1, 0.6), u=10, v=6)
    b.box((0.83, 0.03, 1.14), (0, 0.18, 0.65), tn(A, 0.2, 0.8))
    for z in (0.1, 0.48, 0.86):
        b.box((0.84, 0.36, 0.05), (0, 0.005, z), "wood"); b.box((0.85, 0.03, 0.07), (0, -0.185, z), "wood_lt", r=0.01)
    b.box((0.96, 0.44, 0.06), (0, 0, 1.25), tn("wood", 0.3, None), r=0.022)
    for i in range(6): b.cyl(0.07, 0.026, (-0.35 + 0.14 * i, -0.172, 1.215), "cream", seg=14, rot=(pi / 2, 0, 0))

@item("fur-birdhouse", "Birdhouse", "home-nook", "floor", (1, 1))
def birdhouse(b):
    """A garden birdhouse on a post, 1.9 m tall: cream walls, a round door with a perch, a red roof, a sprout on the ridge."""
    A = V("A", "red")
    b.lathe([(0, 0), (0.2, 0), (0.22, 0.03), (0.1, 0.08), (0.06, 0.1)], mats=["trunk_dk", "trunk_dk", "trunk", "trunk"], seg=18)
    b.cyl(0.05, 1.08, (0, 0, 0.06), "trunk", seg=12); b.ball(0.075, (0, 0, 1.11), "cream", sc=(1, 1, 0.7), u=10, v=6)
    b.box((0.5, 0.44, 0.05), (0, 0, 1.15), "wood_lt", r=0.02)
    b.box((0.4, 0.34, 0.36), (0, 0, 1.355), tn("cream", 0.2, None), r=0.03)
    b.prism([(-0.2, 0), (0.2, 0), (0, 0.17)], 0.34, "cream", mtx=XZ(-0.17, 0, 1.52))
    for sg in (-1, 1): b.box((0.36, 0.46, 0.05), (sg * 0.115, 0, 1.64), tn(A, 0.3, None), r=0.018, rot=(0, sg * 0.705, 0))
    b.cyl(0.032, 0.48, (0, -0.24, 1.745), derive(A, "dk"), seg=10, rot=(-pi / 2, 0, 0))
    b.cyl(0.085, 0.012, (0, -0.166, 1.4), "wood", seg=18, rot=(pi / 2, 0, 0)); b.cyl(0.066, 0.016, (0, -0.17, 1.4), "ink", seg=18, rot=(pi / 2, 0, 0))
    b.cyl(0.018, 0.1, (0, -0.17, 1.285), "wood", seg=8, rot=(pi / 2, 0, 0)); b.ball(0.026, (0, -0.27, 1.285), "cream", u=8, v=5)
    sprout(b, (0, 0, 1.78), 0.11, 0.4)

@item("fur-planter", "Window Planter", "home-nook", "table", (1, 0.5))
def window_planter(b):
    """A long sky-blue box with a cream rim and scalloped trim, planted with five flowers."""
    A = V("A", "sky")
    b.box((0.9, 0.24, 0.18), (0, 0, 0.09), tn(A, 0.25, 0.85), r=0.035)
    b.box((0.94, 0.28, 0.04), (0, 0, 0.185), "cream", r=0.015); b.box((0.84, 0.18, 0.02), (0, 0, 0.206), "soil", r=0.008)
    for i in range(7): b.cyl(0.058, 0.016, (-0.39 + 0.13 * i, -0.126, 0.168), "cream", seg=12, rot=(pi / 2, 0, 0))
    cols = (("pink", "yellow"), ("yellow", "white"), ("purple", "yellow"))
    for i in range(5):
        x = -0.32 + 0.16 * i; c = cols[i % 3]; stem_flower(b, (x, 0.01 if i % 2 else -0.02, 0.21), 0.26 if i % 2 else 0.2, c[0], c[1], 0.06)
    for i in range(4): leaf(b, (-0.24 + 0.16 * i, 0.03, 0.21), 0.14, "green", 1.2 + i, 0.8, w=0.45)
