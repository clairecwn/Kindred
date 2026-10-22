"""The furniture range: 30 pieces for the rooms of a house (approved by Claire, 8 Oct 2026). Not in a shop yet, so
their shop is "furniture": they get their own row in the showroom and their own file (items_furniture.glb), and the
mall's displays and tests do not see them. Floor space is in metres, on the 0.5 m indoor grid."""
from ii import *
from ip import *
SHOP = "furniture"

def feet(b, pts, r=0.06, h=0.1, m="wood"):
    """Round turned feet."""
    for x, y in pts: b.lathe([(0, 0), (r * 0.6, 0), (r, h * 0.45), (r * 0.85, h), (0, h)], (x, y, 0), mats=[m + "_dk", m + "_dk", m, m + "_lt"], seg=10)
def puff(b, size, loc, m, r=None, rot=None, lo=0.24, hi=0.72):
    """A cushion: a box with all its edges rounded right off."""
    b.box(size, loc, tn(m, lo, hi), r=r if r else min(size) * 0.42, seg=3, rot=rot)
def knob(b, p, r=0.03, m="gold"): stud(b, p, (0, -1, 0), r, m, flat=0.75)
def leg(b, x, y, h, r=0.06, m="wood", z=0.0):
    """A turned table leg."""
    b.lathe([(0, 0), (r * 0.7, 0), (r * 0.9, h * 0.08), (r, h * 0.45), (r * 0.7, h * 0.78), (r * 0.95, h * 0.92), (r * 0.9, h)], (x, y, z), mats=[m + "_dk", m + "_dk", m, m, m + "_lt", m + "_lt"], seg=12)
def scallops(b, w, y, z, n, r=0.06, m="cream"):
    for i in range(n): b.cyl(r, 0.016, (-w / 2 + w * (i + 0.5) / n, y, z), m, seg=12, rot=(pi / 2, 0, 0))
def pediment(b, w, y, z, h, m="cream", thick=0.06):
    """A low arched board for the top of a cupboard, standing on its front edge."""
    pts = [(-w / 2, 0), (w / 2, 0), (w / 2, h * 0.3)] + [(w / 2 * cos(pi * i / 10), h * 0.3 + h * 0.7 * sin(pi * i / 10)) for i in range(1, 10)] + [(-w / 2, h * 0.3)]
    b.prism(pts, thick, tn(m, None, 0.6), mtx=XZ(y, 0, z))
def mirror(b, loc, R, m="gold"):
    """A round mirror facing -Y; loc is its middle, on its back."""
    b.lathe([(0, 0), (R, 0), (R + 0.02, 0.03), (R, 0.06), (R - 0.06, 0.06), (R - 0.06, 0.035), (0, 0.035)], loc, mats=[m + "_dk", m, m, m + "_lt", m + "_dk", "glass"], seg=24, rot=(pi / 2, 0, 0))
    b.box((R * 0.5, 0.004, 0.03), (loc[0] - R * 0.3, loc[1] - 0.037, loc[2] + R * 0.35), "white", rot=(0, 0.7, 0))
def tap(b, x, y, z, reach=0.14, h=0.24):
    b.tube([(x, y, z), (x, y, z + h), (x, y - reach * 0.5, z + h + 0.03), (x, y - reach, z + h - 0.03)], 0.022, "steel", seg=8)
    for sx, m in ((-1, "red"), (1, "sky")): b.ball(0.035, (x + sx * 0.11, y, z + 0.03), m, u=8, v=5); b.cyl(0.014, 0.03, (x + sx * 0.11, y, z), "steel", seg=6)

# ---------------------------------------------------------------- living room
def _sofa(b, W, A, P, pillows, back=0.66):
    hw = W / 2
    feet(b, [(sx * (hw - 0.18), sy * 0.33) for sx in (-1, 1) for sy in (-1, 1)], 0.06, 0.12)
    b.box((W - 0.15, 0.86, 0.26), (0, 0.02, 0.24), derive(A, "dk"), r=0.08, seg=3); b.box((W - 0.13, 0.28, back), (0, 0.33, 0.33 + back / 2), tn(A, 0.2, 0.75), r=0.12, seg=3)
    ax = hw - 0.18
    for sx in (-1, 1):
        b.box((0.26, 0.8, 0.36), (sx * ax, 0.0, 0.5), tn(A, 0.3, None), r=0.1, seg=3); b.cyl(0.14, 0.8, (sx * ax, -0.4, 0.68), tn(A, None, 0.6), seg=14, rot=(-pi / 2, 0, 0), bev=0.04)
        bloom_at(b, (sx * ax, -0.405, 0.68), 0.075, "cream", "yellow", 6, "-y", 0.04)
    n = 2 if W > 1.5 else 1; cw = (W - 0.62) / n
    for i in range(n): puff(b, (cw - 0.01, 0.62, 0.17), ((i - (n - 1) / 2) * cw, -0.1, 0.455), A, r=0.07)
    for x, m, rz in pillows: b.ball(1.0, (x, 0.14, 0.72), tn(m, 0.25, 0.75), sc=(0.2, 0.09, 0.19), u=12, v=8, rot=(-0.25, 0, rz))
    return hw
@item("fur-sofa", "Cosy Sofa", SHOP, "floor", (2, 1), seat=(-0.35, -0.08, 0.52, 0, 0.35, -0.08, 0.52, 0))
def sofa(b):
    """A fat two-seater with rolled arms, a bloom on each arm and two cushions."""
    _sofa(b, 2.0, V("A", "teal"), V("B", "yellow"), [(-0.42, V("B", "yellow"), -0.2), (0.42, "cream", 0.2)])
@item("fur-armchair", "Snug Armchair", SHOP, "floor", (1.5, 1), seat=(0, -0.08, 0.52, 0))
def armchair(b):
    """A roomy chair for one: a seat wider than one of the sofa's, a taller back and a cushion. 1.4 m across."""
    _sofa(b, 1.48, V("A", "pink"), V("B", "cream"), [(0.12, V("B", "cream"), 0.15)], back=0.78)
@item("fur-coffeetable", "Coffee Table", SHOP, "floor", (1.5, 1), surface=(-0.58, -0.34, 0.58, 0.34, 0.46))
def coffee_table(b):
    """A low table with a rounded top, a painted apron and a shelf underneath."""
    A = V("A", "sky")
    for sx in (-1, 1):
        for sy in (-1, 1): leg(b, sx * 0.5, sy * 0.28, 0.35)
    b.prism(rrect(1.14, 0.66, 0.2), 0.03, "cream", loc=(0, 0, 0.11), r=0.01); b.prism(rrect(1.3, 0.8, 0.26), 0.07, tn(A, 0.3, None), loc=(0, 0, 0.33))
    b.prism(rrect(1.4, 0.9, 0.3), 0.06, tn("wood", None, 0.5), loc=(0, 0, 0.4), r=0.018)
@item("fur-sidetable", "Round Side Table", SHOP, "floor", (0.5, 0.5), surface=(-0.16, -0.16, 0.16, 0.16, 0.56))
def side_table(b):
    """A little round table on one turned leg."""
    A = V("A", "yellow")
    b.lathe([(0, 0), (0.17, 0), (0.19, 0.025), (0.08, 0.07), (0.04, 0.12), (0.04, 0.42), (0.07, 0.47), (0.1, 0.5)], mats=["wood_dk", "wood_dk", "wood", "wood", "wood", "wood_lt", "wood_lt"], seg=16, cap=False)
    b.lathe([(0, 0.5), (0.1, 0.5), (0.235, 0.5), (0.245, 0.53), (0.235, 0.56), (0, 0.56)], mats=[derive(A, "dk"), derive(A, "dk"), A, derive(A, "lt"), "cream"], seg=24)
@item("fur-bookcase", "Tall Bookcase", SHOP, "floor", (1, 0.5), surface=(-0.4, -0.17, 0.4, 0.15, 0.6, -0.4, -0.17, 0.4, 0.15, 1.03, -0.4, -0.17, 0.4, 0.15, 1.46))
def bookcase(b):
    """A cream bookcase 2.2 m tall with a painted back, an arched top and a row of books on its lowest shelf; three
    shelves are free."""
    A = V("A", "green")
    for sx in (-1, 1):
        b.box((0.07, 0.42, 1.96), (sx * 0.445, 0, 1.06), tn("cream", 0.1, None), r=0.02)
        for sy in (-1, 1): b.ball(0.055, (sx * 0.43, sy * 0.15, 0.04), "wood", sc=(1, 1, 0.75), u=10, v=6)
    b.box((0.83, 0.03, 1.9), (0, 0.19, 1.07), tn(A, 0.2, 0.8))
    for z in (0.1, 0.575, 1.005, 1.435, 1.9): b.box((0.84, 0.36, 0.05), (0, 0.005, z), "wood"); b.box((0.85, 0.03, 0.07), (0, -0.185, z), "wood_lt", r=0.01)
    b.box((0.98, 0.46, 0.07), (0, 0, 2.065), tn("wood", 0.3, None), r=0.022); pediment(b, 0.9, -0.21, 2.1, 0.1, "cream"); bloom_at(b, (0, -0.215, 2.14), 0.05, A, "yellow", 6, "-y", 0.04)
    for i, (col, h, w) in enumerate((("red", 0.36, 0.28), ("yellow", 0.32, 0.26), ("blue", 0.38, 0.28), ("pink", 0.3, 0.24), ("teal", 0.36, 0.28), ("purple", 0.33, 0.26))):
        sub(b, lambda sb, c=col, hh=h, ww=w: book(sb, c, ww, 0.085, hh), xf((-0.34 + 0.092 * i, 0.02, 0.125), (0, 0, pi / 2)))
@item("fur-media", "Media Cabinet", SHOP, "floor", (1.5, 0.5), surface=(-0.7, -0.2, -0.36, 0.2, 0.6, 0.36, -0.2, 0.7, 0.2, 0.6))
def media(b):
    """A low cabinet with a screen on it showing a sunny hill."""
    A = V("A", "denim")
    feet(b, [(sx * 0.6, sy * 0.15) for sx in (-1, 1) for sy in (-1, 1)], 0.055, 0.12)
    b.box((1.44, 0.42, 0.44), (0, 0.03, 0.34), tn(A, 0.2, None), r=0.04); b.prism(rrect(1.48, 0.46, 0.06), 0.04, "cream", loc=(0, 0.015, 0.56), r=0.012)
    for sx in (-1, 1): b.box((0.46, 0.02, 0.32), (sx * 0.46, -0.185, 0.34), derive(A, "lt"), r=0.02); knob(b, (sx * 0.29, -0.2, 0.34))
    b.box((0.38, 0.02, 0.32), (0, -0.185, 0.34), "cream", r=0.02); leaves_at(b, -0.197, 0.34, 0.2, "leaf_light")
    b.box((0.34, 0.16, 0.025), (0, 0.04, 0.6125), "ink", r=0.01); b.cyl(0.03, 0.12, (0, 0.06, 0.62), "ink", seg=8)
    b.box((1.1, 0.06, 0.66), (0, 0.06, 1.06), tn("ink", None, 0.92), r=0.025); b.box((1.0, 0.012, 0.56), (0, 0.028, 1.06), "sky")
    b.prism([(-0.495, -0.275), (0.495, -0.275), (0.495, -0.14), (0.3, -0.02), (0.1, -0.12), (-0.2, 0.02), (-0.495, -0.1)], 0.008, "green", mtx=XZ(0.016, 0, 1.06))
    b.prism([(-0.49, -0.27), (0.49, -0.27), (0.49, -0.2), (0.2, -0.14), (-0.1, -0.2), (-0.49, -0.17)], 0.008, "lawn", mtx=XZ(0.011, 0, 1.06))
    b.cyl(0.06, 0.008, (0.28, 0.02, 1.2), "yellow", seg=14, rot=(pi / 2, 0, 0))
    for dx, r in ((-0.3, 0.045), (-0.24, 0.06), (-0.17, 0.04)): b.cyl(r, 0.008, (dx, 0.02, 1.2), "white", seg=10, rot=(pi / 2, 0, 0))
@item("fur-bigrug", "Meadow Rug", SHOP, "rug", (3, 2))
def big_rug(b):
    """A large rug with a pale middle, a ring of dots and the bloom at its centre."""
    A = V("A", "rose")
    b.prism(rrect(2.9, 1.9, 0.25), 0.02, derive(A, "dk")); b.prism(rrect(2.74, 1.74, 0.2), 0.026, A); b.prism(rrect(2.46, 1.46, 0.14), 0.031, "cream"); b.prism(rrect(2.36, 1.36, 0.11), 0.035, derive(A, "lt"))
    bloom_at(b, (0, 0, 0.036), 0.3, "cream", "yellow", 8, "+z", 0.02)
    for i in range(20):
        t = tau * i / 20; b.cyl(0.045, 0.006, (0.98 * cos(t), 0.5 * sin(t), 0.035), "cream", seg=10)

# ---------------------------------------------------------------- bedroom
def _bed(b, W, A, P, pillows):
    hw = W / 2
    feet(b, [(sx * (hw - 0.1), sy * 0.86) for sx in (-1, 1) for sy in (-1, 1)], 0.06, 0.15)
    b.box((W - 0.06, 1.88, 0.2), (0, 0, 0.24), tn("wood", 0.3, None), r=0.04); b.box((W - 0.1, 1.74, 0.2), (0, 0.02, 0.44), tn("white", 0.3, None), r=0.07, seg=3)
    b.box((W - 0.03, 1.14, 0.26), (0, -0.34, 0.46), tn(A, 0.25, 0.75), r=0.09, seg=3); b.box((W - 0.018, 0.17, 0.272), (0, -0.52, 0.46), P, r=0.09, seg=3)
    b.box((W - 0.03, 0.2, 0.07), (0, 0.3, 0.575), "cream", r=0.03)
    for x in pillows: puff(b, (0.64, 0.4, 0.16), (x, 0.66, 0.61), "white", r=0.07, lo=0.3, hi=None)
    top = [(-hw + 0.01, 0), (hw - 0.01, 0), (hw - 0.01, 0.72)] + [((hw - 0.01) * cos(pi * i / 12), 0.72 + 0.24 * sin(pi * i / 12)) for i in range(1, 12)] + [(-hw + 0.01, 0.72)]
    b.prism(top, 0.09, tn("wood", 0.15, 0.82), mtx=XZ(0.89, 0, 0.14)); heart_at(b, 0.89, 0.9, 0.11, "cream")
    b.box((W - 0.035, 0.08, 0.44), (0, -0.925, 0.36), tn("wood", 0.2, None), r=0.03)
    for sx in (-1, 1): b.ball(0.06, (sx * (hw - 0.07), -0.925, 0.6), "cream", u=10, v=6)
    bloom_at(b, (0, -0.2, 0.592), 0.13, "cream", "yellow", 6, "+z", 0.02)
@item("fur-bed", "Single Bed", SHOP, "floor", (1, 2), lie=(0, 0.05, 0.58, 0))
def bed(b):
    """A wooden bed with a heart in its headboard, a quilt and a fat pillow. The head goes to the wall."""
    _bed(b, 1.0, V("A", "sky"), V("B", "yellow"), [0.0])
@item("fur-doublebed", "Double Bed", SHOP, "floor", (2, 2), lie=(-0.45, 0.05, 0.58, 0, 0.45, 0.05, 0.58, 0))
def double_bed(b):
    """The same bed for two."""
    _bed(b, 2.0, V("A", "rose"), V("B", "cream"), [-0.45, 0.45])
@item("fur-bedside", "Bedside Table", SHOP, "floor", (0.5, 0.5), surface=(-0.2, -0.18, 0.2, 0.18, 0.6))
def bedside(b):
    """A small cupboard with one drawer."""
    A = V("A", "butter")
    feet(b, [(sx * 0.16, sy * 0.14) for sx in (-1, 1) for sy in (-1, 1)], 0.045, 0.09)
    b.box((0.44, 0.4, 0.47), (0, 0, 0.32), tn(A, 0.2, None), r=0.035); b.prism(rrect(0.48, 0.44, 0.06), 0.045, "cream", loc=(0, 0, 0.555), r=0.012)
    b.box((0.34, 0.02, 0.13), (0, -0.205, 0.45), derive(A, "lt"), r=0.015); knob(b, (0, -0.22, 0.45)); b.box((0.34, 0.02, 0.2), (0, -0.205, 0.24), "cream", r=0.015); knob(b, (0.11, -0.22, 0.26), 0.025)
@item("fur-wardrobe", "Wardrobe", SHOP, "floor", (1.5, 0.5))
def wardrobe(b):
    """A tall cupboard with two doors, a drawer and an arched top."""
    A = V("A", "lilac")
    feet(b, [(sx * 0.6, sy * 0.14 + 0.03) for sx in (-1, 1) for sy in (-1, 1)], 0.06, 0.1)
    b.box((1.42, 0.42, 1.9), (0, 0.035, 1.04), tn(A, 0.12, 0.9), r=0.05); b.box((1.48, 0.46, 0.06), (0, 0.02, 2.01), "cream", r=0.02)
    pediment(b, 1.3, -0.2, 2.04, 0.15, "cream"); bloom_at(b, (0, -0.205, 2.11), 0.06, A, "yellow", 6, "-y", 0.04)
    for sx in (-1, 1):
        b.box((0.64, 0.025, 1.36), (sx * 0.335, -0.18, 1.22), derive(A, "lt"), r=0.02); b.box((0.46, 0.02, 0.5), (sx * 0.335, -0.193, 1.56), "cream", r=0.02); b.box((0.46, 0.02, 0.5), (sx * 0.335, -0.193, 0.9), "cream", r=0.02)
        knob(b, (sx * 0.07, -0.205, 1.22), 0.035); knob(b, (sx * 0.3, -0.205, 0.33), 0.03)
    b.box((1.3, 0.025, 0.24), (0, -0.18, 0.33), derive(A, "lt"), r=0.02)
@item("fur-dresser", "Dresser", SHOP, "floor", (1.5, 0.5), surface=(-0.66, -0.18, 0.66, 0.06, 0.87))
def dresser(b):
    """Six drawers under a wooden top, with a round mirror."""
    A = V("A", "mint")
    feet(b, [(sx * 0.6, sy * 0.14 + 0.03) for sx in (-1, 1) for sy in (-1, 1)], 0.055, 0.1)
    b.box((1.4, 0.42, 0.72), (0, 0.03, 0.46), tn(A, 0.16, None), r=0.04); b.prism(rrect(1.46, 0.47, 0.06), 0.05, tn("wood", None, 0.5), loc=(0, 0.01, 0.82), r=0.014)
    for sx in (-1, 1):
        for i in range(3): b.box((0.62, 0.02, 0.18), (sx * 0.34, -0.19, 0.22 + 0.225 * i), derive(A, "lt"), r=0.018); knob(b, (sx * 0.34, -0.205, 0.22 + 0.225 * i), 0.03, "cream")
    b.box((0.12, 0.05, 0.3), (0, 0.2, 0.98), "wood_dk", r=0.02); mirror(b, (0, 0.215, 1.42), 0.34)
@item("fur-trunk", "Keepsake Trunk", SHOP, "floor", (1, 0.5), seat=(0, 0, 0.51, 0))
def trunk(b):
    """A painted chest with a domed lid, two leather straps and a gold lock. It can be sat on."""
    A = V("A", "red"); arc = lambda k: [(-0.22 * k, 0), (0.22 * k, 0)] + [(0.22 * k * cos(pi * i / 10), 0.17 * k * sin(pi * i / 10)) for i in range(1, 10)]
    feet(b, [(sx * 0.38, sy * 0.15) for sx in (-1, 1) for sy in (-1, 1)], 0.04, 0.05, "leather")
    b.box((0.92, 0.44, 0.3), (0, 0, 0.19), tn(A, 0.3, None), r=0.03); b.prism(arc(1.0), 0.92, tn(A, None, 0.55), mtx=YZ(-0.46, 0, 0.34))
    for sx in (-1, 1):
        b.prism(arc(1.07), 0.07, "leather", mtx=YZ(sx * 0.26 - 0.035, 0, 0.334)); b.box((0.07, 0.012, 0.27), (sx * 0.26, -0.228, 0.195), "leather"); knob(b, (sx * 0.26, -0.234, 0.3), 0.02)
    b.box((0.94, 0.455, 0.03), (0, 0, 0.34), derive(A, "dk")); b.box((0.11, 0.03, 0.13), (0, -0.23, 0.33), "gold", r=0.012); knob(b, (0, -0.237, 0.335), 0.014, "ink")

# ---------------------------------------------------------------- kitchen and dining
@item("fur-diningtable", "Dining Table", SHOP, "floor", (2, 1), surface=(-0.88, -0.4, 0.88, 0.4, 0.8))
def dining_table(b):
    """A table for four with turned legs and a painted apron."""
    A = V("A", "teal")
    for sx in (-1, 1):
        for sy in (-1, 1): leg(b, sx * 0.78, sy * 0.3, 0.66, 0.075); b.ball(0.05, (sx * 0.78, sy * 0.3, 0.03), "cream", sc=(1, 1, 0.6), u=8, v=5)
    b.prism(rrect(1.72, 0.74, 0.08), 0.1, tn(A, 0.3, None), loc=(0, 0, 0.64)); b.prism(rrect(1.9, 0.92, 0.12), 0.06, tn("wood", None, 0.5), loc=(0, 0, 0.74), r=0.018)
@item("fur-chair", "Dining Chair", SHOP, "floor", (0.5, 0.5), seat=(0, -0.01, 0.52, 0))
def chair(b):
    """A wooden chair with a cushion and a heart on its back."""
    A = V("A", "red")
    for sx in (-1, 1):
        b.cyl(0.028, 0.43, (sx * 0.17, -0.17, 0), tn("wood", 0.15, None), seg=8); b.cyl(0.03, 1.0, (sx * 0.17, 0.19, 0), tn("wood", 0.08, 0.92), seg=8); b.ball(0.042, (sx * 0.17, 0.19, 1.02), "cream", u=8, v=5)
    b.prism(rrect(0.44, 0.44, 0.08), 0.05, "wood", loc=(0, 0, 0.42), r=0.012); puff(b, (0.38, 0.37, 0.075), (0, -0.015, 0.5), A, r=0.032)
    b.prism(rrect(0.4, 0.26, 0.09), 0.04, tn("wood", None, 0.6), mtx=XZ(0.17, 0, 0.84)); heart_at(b, 0.17, 0.84, 0.06, "cream"); b.box((0.3, 0.03, 0.04), (0, 0.19, 0.6), "wood_dk")
def _cabinet(b, A, top="wood_lt", doors=True):
    """The body every kitchen piece shares: 1 m wide with flat sides, so pieces stand side by side as one run. The
    worktop is at 0.92 m and overhangs the doors, so the knobs stay inside the half metre of floor."""
    b.box((0.94, 0.36, 0.1), (0, 0.05, 0.05), derive(A, "dk")); b.box((1.0, 0.44, 0.76), (0, 0.03, 0.48), tn(A, 0.15, None)); b.box((1.0, 0.5, 0.06), (0, 0, 0.89), top)
    if doors:
        for sx in (-1, 1): b.box((0.44, 0.02, 0.56), (sx * 0.24, -0.2, 0.46), derive(A, "lt"), r=0.02); knob(b, (sx * 0.06, -0.215, 0.6), 0.028)
        scallops(b, 0.98, -0.192, 0.82, 7, 0.058)
@item("fur-counter", "Kitchen Counter", SHOP, "floor", (1, 0.5), surface=(-0.5, -0.22, 0.5, 0.22, 0.92))
def counter(b):
    """A cupboard under a wooden worktop. Set several side by side for a run."""
    _cabinet(b, V("A", "mint"))
@item("fur-sink", "Sink Counter", SHOP, "floor", (1, 0.5))
def sink(b):
    """The counter with a steel sink and a tap with a red and a blue knob."""
    _cabinet(b, V("A", "mint"))
    b.box((0.62, 0.36, 0.014), (0, -0.03, 0.927), "steel", r=0.004, seg=1); b.box((0.52, 0.27, 0.014), (0, -0.03, 0.931), "steel_dk", r=0.004, seg=1); b.cyl(0.03, 0.006, (0, -0.03, 0.936), "ink", seg=8)
    tap(b, 0.0, 0.2, 0.92, 0.17, 0.22)
@item("fur-stove", "Stove", SHOP, "floor", (1, 0.5))
def stove(b):
    """A white enamel stove: four rings, five red knobs and an oven door with a window."""
    A = V("A", "mint")
    b.box((0.94, 0.36, 0.1), (0, 0.05, 0.05), "ink"); b.box((1.0, 0.44, 0.76), (0, 0.03, 0.48), tn("white", 0.15, None)); b.box((1.0, 0.5, 0.06), (0, 0, 0.89), "ink")
    for sx in (-1, 1):
        for sy, r in ((-1, 0.1), (1, 0.085)): b.cyl(r, 0.012, (sx * 0.24, sy * 0.11, 0.92), "steel", seg=16); b.cyl(r * 0.68, 0.011, (sx * 0.24, sy * 0.11, 0.925), "ink_dk", seg=14)
    b.box((0.8, 0.025, 0.44), (0, -0.2, 0.4), tn(A, 0.2, None), r=0.03); b.box((0.56, 0.02, 0.22), (0, -0.212, 0.42), "ink", r=0.02); b.tube([(-0.32, -0.2, 0.62), (-0.32, -0.228, 0.64), (0.32, -0.228, 0.64), (0.32, -0.2, 0.62)], 0.016, "steel", seg=6)
    b.box((0.96, 0.03, 0.13), (0, -0.2, 0.775), derive(A, "dk"), r=0.02)
    for i in range(5): knob(b, (-0.36 + 0.18 * i, -0.218, 0.775), 0.032, "red")
    b.box((1.0, 0.05, 0.2), (0, 0.225, 1.02), tn("white", None, 0.7)); b.box((0.99, 0.053, 0.04), (0, 0.2185, 1.02), A)
@item("fur-fridge", "Fridge", SHOP, "floor", (1, 0.5))
def fridge(b):
    """A round-shouldered fridge with two chunky handles and three magnets."""
    A = V("A", "mint")
    feet(b, [(sx * 0.34, sy * 0.13 + 0.05) for sx in (-1, 1) for sy in (-1, 1)], 0.05, 0.08, "steel")
    b.box((0.9, 0.4, 1.84), (0, 0.05, 1.0), tn(A, 0.1, 0.9), r=0.08, seg=3); b.box((0.912, 0.398, 0.02), (0, 0.045, 1.38), derive(A, "dk"))
    for z0, z1 in ((0.75, 1.25), (1.5, 1.8)): b.tube([(-0.3, -0.15, z0), (-0.3, -0.215, z0 + 0.04), (-0.3, -0.215, z1 - 0.04), (-0.3, -0.15, z1)], 0.024, "steel", seg=8)
    heart_at(b, -0.152, 1.62, 0.05, "red", x=0.14); bloom_at(b, (0.24, -0.155, 1.1), 0.05, "yellow", "orange", 6, "-y", 0.04)
    b.box((0.13, 0.008, 0.16), (0.1, -0.154, 0.98), "paper", rot=(0, 0.12, 0)); knob(b, (0.1, -0.16, 1.045), 0.016, "sky")
@item("fur-cupboard", "Wall Cupboard", SHOP, "wall", (1, 0.75))
def cupboard(b):
    """A cupboard for the wall above a counter."""
    A = V("A", "mint")
    b.box((0.96, 0.32, 0.6), (0, -0.16, 0), tn(A, 0.15, None), r=0.03, seg=2)
    b.box((1.0, 0.36, 0.045), (0, -0.18, 0.32), "cream", r=0.02); b.box((0.96, 0.34, 0.03), (0, -0.17, 0.355), "cream", r=0.012)      # a crown moulding on top
    b.box((0.98, 0.34, 0.035), (0, -0.17, -0.31), "cream", r=0.014)
    for i in range(9):                                                     # a scalloped valance under it
        b.ball(1.0, (-0.44 + 0.11 * i, -0.33, -0.33), "cream", sc=(0.055, 0.014, 0.035), u=10, v=5)
    for sx in (-1, 1):                                                     # two doors, each with a raised panel and a heart
        b.box((0.44, 0.022, 0.52), (sx * 0.24, -0.33, 0.0), derive(A, "lt"), r=0.022)
        b.box((0.32, 0.016, 0.38), (sx * 0.24, -0.345, 0.0), tn(A, 0.2, 0.8), r=0.03)
        heart_at(b, -0.354, 0.12, 0.035, "cream", x=sx * 0.24, depth=0.01)
        knob(b, (sx * 0.06, -0.36, -0.16), 0.03)

# ---------------------------------------------------------------- study and hobby
@item("fur-desk", "Writing Desk", SHOP, "floor", (1.5, 0.5), surface=(-0.12, -0.2, 0.68, 0.14, 0.8))
def desk(b):
    """A desk with three drawers and an open journal waiting on it."""
    A, P = V("A", "butter"), V("B", "rose")
    for sy in (-1, 1): leg(b, -0.62, sy * 0.16, 0.75, 0.055)
    feet(b, [(0.46 + sx * 0.16, sy * 0.15) for sx in (-1, 1) for sy in (-1, 1)], 0.045, 0.12)
    b.box((0.44, 0.42, 0.63), (0.46, 0, 0.435), tn(A, 0.15, None), r=0.03)
    for i in range(3): b.box((0.36, 0.02, 0.16), (0.46, -0.212, 0.24 + 0.2 * i), derive(A, "lt"), r=0.015); knob(b, (0.46, -0.226, 0.24 + 0.2 * i), 0.026)
    b.box((1.3, 0.04, 0.1), (-0.05, 0.14, 0.68), "wood_dk", r=0.015); b.prism(rrect(1.44, 0.48, 0.06), 0.05, tn("wood", None, 0.5), loc=(0, 0, 0.75), r=0.014)
    b.box((1.36, 0.04, 0.13), (0, 0.2, 0.865), tn("wood", None, 0.5), r=0.015)
    b.box((0.44, 0.31, 0.012), (-0.42, -0.02, 0.806), P)
    for sx in (-1, 1): b.box((0.2, 0.28, 0.022), (-0.42 + sx * 0.105, -0.02, 0.822), "paper", r=0.006, seg=1, rot=(0, sx * 0.06, 0))
    b.box((0.02, 0.3, 0.004), (-0.42, -0.04, 0.829), "red"); b.cyl(0.012, 0.2, (-0.14, -0.12, 0.812), "yellow", seg=6, rot=(-pi / 2, 0, 0.5)); b.ball(0.014, (-0.14, -0.12, 0.812), "pink", u=6, v=4)
    for sg in (-1, 1): b.ball(1.0, (-0.52 + sg * 0.035, 0.0, 0.836), "leaf_light", sc=(0.035, 0.016, 0.003), u=6, v=4, rot=(0, 0, sg * 0.6))
@item("fur-deskchair", "Desk Chair", SHOP, "floor", (0.5, 0.5), seat=(0, 0, 0.5, 0))
def desk_chair(b):
    """A round swivel seat on four ball feet, with a fat round back."""
    A = V("A", "purple")
    for a in (0, pi / 2): b.box((0.4, 0.06, 0.04), (0, 0, 0.07), "steel", r=0.014, rot=(0, 0, a))
    for i in range(4): b.ball(0.04, (0.19 * cos(pi / 2 * i), 0.19 * sin(pi / 2 * i), 0.04), "ink", u=8, v=5)
    b.lathe([(0.05, 0.08), (0.045, 0.3), (0.07, 0.36), (0.1, 0.4)], m="steel", seg=12, cap=False)
    b.lathe([(0, 0.4), (0.18, 0.4), (0.225, 0.43), (0.225, 0.48), (0.18, 0.52), (0, 0.52)], mats=[derive(A, "dk"), derive(A, "dk"), A, derive(A, "lt"), derive(A, "lt")], seg=20)
    b.tube([(0, 0.14, 0.44), (0, 0.2, 0.5), (0, 0.2, 0.72)], 0.03, "steel", seg=8); b.ball(1.0, (0, 0.185, 0.8), tn(A, 0.25, 0.75), sc=(0.21, 0.055, 0.17), u=14, v=8); knob(b, (0, 0.13, 0.8), 0.03, "cream")
@item("fur-piano", "Upright Piano", SHOP, "floor", (1.5, 1), seat=(0, -0.29, 0.5, 3.1416))
def piano(b):
    """An upright piano with its stool: three octaves of keys, a sheet of music, two gold pedals."""
    A, P = V("A", "navy"), V("B", "red")
    b.box((1.44, 0.4, 1.2), (0, 0.28, 0.66), tn(A, 0.12, 0.9), r=0.04); b.box((1.48, 0.44, 0.05), (0, 0.28, 1.285), derive(A, "lt"), r=0.02)
    for sx in (-1, 1):
        b.ball(0.05, (sx * 0.62, 0.28, 0.04), "gold", sc=(1, 1, 0.8), u=8, v=5); b.cyl(0.04, 0.6, (sx * 0.64, -0.08, 0.03), tn(A, 0.12, None), seg=10); b.box((0.07, 0.29, 0.09), (sx * 0.665, -0.015, 0.765), A, r=0.02)
    b.box((1.4, 0.3, 0.1), (0, -0.02, 0.68), derive(A, "dk"), r=0.03); b.box((1.24, 0.16, 0.02), (0, -0.07, 0.737), "white"); w = 1.24 / 21
    for i in range(21):
        if i % 7 in (0, 1, 3, 4, 5): b.box((0.03, 0.085, 0.02), (-0.62 + w * (i + 1), -0.0375, 0.752), "ink")
        if i: b.box((0.004, 0.14, 0.026), (-0.62 + w * i, -0.073, 0.737), "stone")
    b.box((0.6, 0.02, 0.26), (0, 0.075, 1.0), derive(A, "dk"), rot=(-0.2, 0, 0)); b.box((0.36, 0.012, 0.22), (0, 0.056, 1.0), "paper", rot=(-0.2, 0, 0))
    for sx in (-1, 1): bloom_at(b, (sx * 0.5, 0.075, 1.02), 0.07, "gold", "cream", 6, "-y", 0.04); b.box((0.05, 0.1, 0.02), (sx * 0.08, 0.05, 0.03), "gold", r=0.008)
    d, l = derive(A, "dk"), derive(P, "lt")
    b.lathe([(0, 0), (0.16, 0), (0.18, 0.03), (0.05, 0.08), (0.045, 0.36), (0.18, 0.4), (0.2, 0.45), (0.17, 0.5), (0, 0.5)], (0, -0.29, 0), mats=[d, d, A, A, A, P, P, l], seg=18)

# ---------------------------------------------------------------- bathroom
@item("fur-bathtub", "Bathtub", SHOP, "floor", (2, 1), seat=(0.3, 0, 0.24, 1.5708))
def bathtub(b):
    """A tub on four gold feet, full of water, with bubbles at one end and a duck."""
    A = V("A", "pink"); d, l = derive(A, "dk"), derive(A, "lt")
    def tub(sb): sb.lathe([(0, 0.1), (0.3, 0.1), (0.4, 0.2), (0.44, 0.5), (0.47, 0.58), (0.45, 0.62), (0.41, 0.6), (0.39, 0.5), (0, 0.5)], mats=[d, d, A, l, "cream", "cream", "cream", "water"], seg=24)
    sub(b, tub, Matrix.Diagonal((2.05, 1, 1, 1)))
    for sx in (-1, 1):
        for sy in (-1, 1): b.ball(0.075, (sx * 0.58, sy * 0.24, 0.0675), "gold", sc=(1, 1, 0.9), u=10, v=6); b.cyl(0.04, 0.1, (sx * 0.58, sy * 0.24, 0.09), "gold", seg=8)
    b.tube([(-0.9, 0, 0.56), (-0.9, 0, 0.8), (-0.82, 0, 0.87), (-0.7, 0, 0.82), (-0.68, 0, 0.76)], 0.022, "steel", seg=8)
    for sy, m in ((-1, "red"), (1, "sky")): b.ball(0.035, (-0.87, sy * 0.13, 0.64), m, u=8, v=5)
    for x, y, r in ((0.5, 0.1, 0.09), (0.62, -0.06, 0.075), (0.42, -0.12, 0.07), (0.7, 0.1, 0.06), (0.56, -0.2, 0.05), (0.36, 0.16, 0.055), (0.76, -0.02, 0.05)): b.ball(r, (x, y, 0.5 + r * 0.45), "white", u=8, v=6)
    b.ball(0.07, (-0.2, -0.06, 0.53), "yellow", sc=(1.2, 0.9, 0.8), u=10, v=6); b.ball(0.05, (-0.13, -0.06, 0.6), "yellow", u=10, v=6); b.ball(0.022, (-0.075, -0.06, 0.595), "orange", sc=(1.3, 1, 0.6), u=6, v=4)
    bloom_at(b, (0, -0.432, 0.38), 0.08, "cream", "yellow", 6, "-y", 0.05)
@item("fur-washstand", "Washstand", SHOP, "floor", (1, 0.5))
def washstand(b):
    """A cupboard with a basin, a tap, a round mirror and a towel on a rail."""
    A, P = V("A", "sky"), V("B", "yellow")
    feet(b, [(sx * 0.36, sy * 0.15) for sx in (-1, 1) for sy in (-1, 1)], 0.05, 0.1)
    b.box((0.86, 0.44, 0.7), (-0.03, 0.01, 0.45), tn(A, 0.16, None), r=0.04); b.prism(rrect(0.9, 0.48, 0.06), 0.05, "white", loc=(-0.03, 0, 0.8), r=0.014)
    for sx in (-1, 1): b.box((0.38, 0.02, 0.5), (-0.03 + sx * 0.2, -0.215, 0.44), derive(A, "lt"), r=0.02); knob(b, (-0.03 + sx * 0.05, -0.23, 0.56), 0.026)
    bowl(b, 0.2, 0.13, "white", inside="white", fill="water", loc=(-0.03, -0.03, 0.85), level=0.7); tap(b, -0.03, 0.19, 0.85, 0.14, 0.22)
    b.box((0.1, 0.05, 0.5), (-0.03, 0.2, 1.08), "wood_dk", r=0.02); mirror(b, (-0.03, 0.215, 1.48), 0.3)
    b.tube([(0.4, 0.14, 0.72), (0.455, 0.14, 0.74), (0.455, -0.16, 0.74), (0.4, -0.16, 0.72)], 0.014, "steel", seg=6); b.box((0.03, 0.22, 0.34), (0.458, -0.01, 0.58), tn(P, 0.2, 0.8), r=0.012)

# ---------------------------------------------------------------- small and wall pieces
@item("fur-tablelamp", "Table Lamp", SHOP, "table", (0.5, 0.5), light=(0, 0, 0.36))
def table_lamp(b):
    """A fat painted base and a cream shade with a coloured band."""
    A = V("A", "yellow"); d, l = derive(A, "dk"), derive(A, "lt")
    b.lathe([(0, 0), (0.1, 0), (0.12, 0.02), (0.13, 0.1), (0.09, 0.2), (0.03, 0.26), (0.025, 0.32)], mats=[d, d, A, A, l, "gold"], seg=18)
    b.lathe([(0.2, 0.27), (0.185, 0.31), (0.1, 0.5), (0, 0.5)], mats=[A, "cream", "cream"], seg=20, cap=False); b.lathe([(0.03, 0.3), (0.198, 0.272)], m="bulb", seg=20, cap=False)
    b.ball(0.022, (0, 0, 0.51), "gold", u=8, v=5)
@item("fur-plant", "Tall Potted Plant", SHOP, "floor", (0.5, 0.5))
def plant(b):
    """A leafy indoor tree in a painted pot, 1.6 m tall."""
    z = pot(b, 0.2, 0.3, V("A", "pot"))
    b.tube([(0, 0, z - 0.02), (0.012, 0.0, 0.7), (-0.008, 0.008, 1.3)], [0.04, 0.032, 0.02], "trunk", seg=8)
    for i in range(8):
        h = 0.5 + 0.11 * i; up = 0.15 + 0.12 * i
        for k in range(3): leaf(b, (0.0, 0.0, h + 0.03 * k), 0.24 - 0.008 * i, ("leaf_light", "green", "leaf_dark")[(i + k) % 3], 0.9 * i + tau * k / 3, min(up + 0.1 * k, 1.2), w=0.62, th=0.14)
    for k in range(3): leaf(b, (0, 0, 1.36), 0.2, ("leaf_light", "green")[k % 2], 0.4 + tau * k / 3, 1.25, w=0.6, th=0.14)
@item("fur-picture", "Picture Frame", SHOP, "wall", (1, 0.75))
def picture(b):
    """A gold frame round a little landscape: two hills, the sun and a cloud."""
    b.box((0.84, 0.05, 0.64), (0, -0.025, 0), tn("gold", 0.2, 0.8), r=0.02); b.box((0.72, 0.02, 0.52), (0, -0.052, 0), "paper"); b.box((0.56, 0.012, 0.38), (0, -0.064, 0), "sky")
    b.prism([(-0.275, -0.185), (0.275, -0.185), (0.275, -0.07), (0.2, 0.0), (0.06, -0.08), (-0.1, 0.03), (-0.275, -0.06)], 0.008, "green", mtx=XZ(-0.076, 0, 0))
    b.prism([(-0.27, -0.18), (0.27, -0.18), (0.27, -0.13), (0.1, -0.09), (-0.06, -0.14), (-0.27, -0.11)], 0.008, "lawn", mtx=XZ(-0.081, 0, 0))
    b.cyl(0.05, 0.008, (0.16, -0.072, 0.1), "yellow", seg=14, rot=(pi / 2, 0, 0))
    for dx, r in ((-0.18, 0.035), (-0.13, 0.05), (-0.07, 0.03)): b.cyl(r, 0.008, (dx, -0.072, 0.11), "white", seg=10, rot=(pi / 2, 0, 0))
@item("fur-clock", "Wall Clock", SHOP, "wall", (0.5, 0.5))
def clock(b):
    """A round clock with a painted rim and twelve dots."""
    A = V("A", "red")
    b.lathe([(0, 0), (0.23, 0), (0.24, 0.03), (0.23, 0.06), (0.19, 0.06), (0.19, 0.04), (0, 0.04)], mats=[derive(A, "dk"), A, A, derive(A, "lt"), derive(A, "dk"), "paper"], seg=28, rot=(pi / 2, 0, 0))
    for i in range(12): stud(b, (0.155 * sin(tau * i / 12), -0.04, 0.155 * cos(tau * i / 12)), (0, -1, 0), 0.016 if i % 3 == 0 else 0.01, "ink")
    b.box((0.022, 0.01, 0.1), (0.028, -0.046, 0.04), "ink", rot=(0, 0.6, 0)); b.box((0.016, 0.01, 0.14), (-0.035, -0.05, 0.05), "ink", rot=(0, -0.6, 0)); stud(b, (0, -0.052, 0), (0, -1, 0), 0.022, "gold")
@item("fur-wallshelf", "Wall Shelf", SHOP, "wall", (1, 0.5), surface=(-0.45, -0.23, 0.45, -0.04, 0.07))
def wall_shelf(b):
    """A wooden shelf on two curved brackets, for small things."""
    A = V("A", "sky")
    b.box((0.96, 0.26, 0.05), (0, -0.13, 0.045), tn("wood", None, 0.5), r=0.015); b.box((0.9, 0.03, 0.11), (0, -0.015, 0.125), tn(A, None, 0.6), r=0.012)
    for sx in (-1, 1): b.prism([(0, 0), (0, -0.2), (-0.05, -0.2), (-0.2, -0.04), (-0.2, 0)], 0.04, "cream", mtx=YZ(sx * 0.32 - 0.02, 0, 0.02))
