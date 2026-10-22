"""Rooftop Garden: the forms seeds and young plants are sold in, and things for the garden. The grown plants are the
Kingdom's plant kit."""
from ii import *
from ip import *

# ---------------------------------------------------------------- seed packets: one builder, one picture each
def icon_carrot(b, y, z):
    b.cyl(0.045, 0.125, (0, y, z + 0.045), tn("orange", None, 0.6), seg=14, r2=0.005, rot=(pi, 0, 0))
    for dx, a in ((-0.03, -0.55), (0.0, 0.0), (0.03, 0.55)):
        b.ball(1.0, (dx, y - 0.008, z + 0.07), "green", sc=(0.017, 0.014, 0.036), u=8, v=5, rot=(0, a, 0))
def icon_cabbage(b, y, z):
    for sg in (-1, 1): b.ball(1.0, (sg * 0.042, y + 0.002, z - 0.008), "green", sc=(0.045, 0.022, 0.055), u=10, v=6, rot=(0, sg * 0.3, 0))
    b.ball(1.0, (0, y - 0.014, z + 0.004), tn("leaf_light", 0.25, 0.7), sc=(0.055, 0.036, 0.056), u=12, v=8)
def icon_tomato(b, y, z):
    b.ball(1.0, (0, y - 0.012, z - 0.006), tn("red", None, 0.6), sc=(0.062, 0.04, 0.056), u=12, v=8)
    for dx, a in ((-0.026, -0.6), (0.0, 0.0), (0.026, 0.6)): b.ball(1.0, (dx, y - 0.026, z + 0.046), "green", sc=(0.02, 0.014, 0.011), u=8, v=5, rot=(0, a, 0))
def icon_corn(b, y, z):
    b.ball(1.0, (0, y - 0.014, z + 0.008), tn("yellow", 0.25, None), sc=(0.036, 0.03, 0.072), u=12, v=8)
    for sg in (-1, 1): b.ball(1.0, (sg * 0.036, y - 0.008, z - 0.03), "green", sc=(0.022, 0.02, 0.056), u=8, v=6, rot=(0, -sg * 0.45, 0))
def icon_pumpkin(b, y, z):
    for dx in (-0.04, 0.04): b.ball(1.0, (dx, y - 0.008, z - 0.01), "orange", sc=(0.04, 0.03, 0.046), u=10, v=6)
    b.ball(1.0, (0, y - 0.018, z - 0.01), tn("orange", None, 0.45), sc=(0.04, 0.034, 0.05), u=12, v=8)
    b.cyl(0.014, 0.04, (0, y - 0.014, z + 0.03), "leaf_dark", seg=6, rot=(0, 0.35, 0)); leaf(b, (0.005, y - 0.016, z + 0.055), 0.05, "green", 0.2, 0.3)
def icon_bloom(petal, core, n, R=0.066):
    return lambda b, y, z: bloom_at(b, (0, y - 0.004, z), R, petal, core, n)
def icon_lavender(b, y, z):
    for dx, h in ((-0.034, 0.0), (0.034, 0.008), (0.0, 0.022)):
        b.box((0.01, 0.012, 0.085), (dx, y - 0.003, z - 0.035 + h), "leaf_dark")
        for k in range(4): b.ball(0.021 - 0.003 * k, (dx, y - 0.012, z + 0.008 + h + k * 0.022), "purple", sc=(1, 0.7, 1), u=8, v=5)
def icon_wild(b, y, z):
    bloom_at(b, (-0.04, y - 0.004, z - 0.022), 0.036, "pink", "yellow", 6); bloom_at(b, (0.04, y - 0.004, z - 0.022), 0.036, "yellow", "white", 6)
    bloom_at(b, (0.0, y - 0.004, z + 0.036), 0.036, "purple", "yellow", 6)

for _id, _label, _icon, _band in (("gar-carrotseed", "Carrot Seeds", icon_carrot, "green"), ("gar-cabbageseed", "Cabbage Seeds", icon_cabbage, "teal"),
                                  ("gar-tomatoseed", "Tomato Seeds", icon_tomato, "red"), ("gar-cornseed", "Corn Seeds", icon_corn, "sky"),
                                  ("gar-pumpkinseed", "Pumpkin Seeds", icon_pumpkin, "orange"), ("gar-daisyseed", "Daisy Seeds", icon_bloom("white", "yellow", 8), "pink"),
                                  ("gar-lavenderseed", "Lavender Seeds", icon_lavender, "purple"), ("gar-sunflowerseed", "Sunflower Seeds", icon_bloom("yellow", "trunk", 10, 0.075), "yellow"),
                                  ("gar-seeds", "Wildflower Seeds", icon_wild, "rose")):
    item(_id, _label, "rooftop-garden", "pack", (0.5, 0.5))(lambda b, i=_icon, c=_band: seed_packet(b, i, c))

# ---------------------------------------------------------------- young plants
def sapling_pot(b, fruit):
    """A young tree in a clay pot with a thick pale rim, 1.3 m tall: one welded crown with a light cap and a dark
    underside, two fruit, and a tag that shows what it will bear."""
    import gv
    pot(b, 0.245, 0.31)
    b.tube([(0, 0, 0.25), (0.03, 0, 0.5), (-0.02, 0, 0.72), (0, 0, 0.9)], [0.055, 0.046, 0.038, 0.032], "trunk", seg=8)
    gv.crown(b, [((0, 0, 1.0), 0.3, (1, 1, 0.9)), ((0.15, -0.06, 1.16), 0.18, (1, 1, 0.9)), ((-0.16, 0.05, 0.95), 0.17, (1, 1, 0.9)), ((-0.02, 0.13, 1.17), 0.16, (1, 1, 0.9))],
             640, "green", "leaf_dark", "leaf_light", lo=(0.9, 0.25), hi=(1.13, 0.3), voxel=0.035)
    for p in ((-0.1, -0.265, 0.97), (0.17, -0.225, 0.94)):
        b.ball(0.05, p, tn(fruit, None, 0.6), u=10, v=7); leaf(b, (p[0], p[1], p[2] + 0.04), 0.05, "leaf_light", 0.6, 0.5)
    leaf(b, (0.03, 0, 0.56), 0.16, "leaf_light", 0.0, 0.45)
    def fruit_icon(b, p):
        b.ball(0.05, p, fruit, sc=(1, 0.4, 1), u=10, v=6); leaf(b, (p[0], p[1] - 0.004, p[2] + 0.045), 0.045, "green", 0.4, 0.5)
    tag(b, (0.03, -0.035, 0.6), fruit_icon)

@item("gar-applesapling", "Apple Sapling", "rooftop-garden", "pack", (1, 1))
def apple_sapling(b): sapling_pot(b, "red")
@item("gar-orangesapling", "Orange Sapling", "rooftop-garden", "pack", (1, 1))
def orange_sapling(b): sapling_pot(b, "orange")

@item("gar-strawberryseed", "Strawberry Plant", "rooftop-garden", "pack", (0.5, 0.5))
def strawberry(b):
    """A pot of strawberry leaves with a white flower and three berries hanging over the rim."""
    zs = pot(b, 0.19, 0.22)
    for i in range(7):
        a = tau * i / 7; leaf(b, (0.03 * cos(a), 0.03 * sin(a), zs), 0.2, "green" if i % 2 else "leaf_light", a, 0.3 + 0.15 * (i % 2), w=0.62)
    leaf(b, (0, 0, zs), 0.16, "leaf_light", 0.5, 1.1, w=0.6); leaf(b, (0, 0, zs), 0.15, "green", 3.4, 1.0, w=0.6)
    for a in (-1.2, -1.9, -2.7):
        p = (0.195 * cos(a), 0.195 * sin(a), zs - 0.005)
        b.lathe([(0, -0.088), (0.03, -0.07), (0.043, -0.035), (0.035, -0.008), (0, 0.0)], p, tn("red", None, 0.55), seg=8)
        for k in range(3): leaf(b, p, 0.035, "green", a + pi + (k - 1) * 1.6, 0.25, w=0.6)
    bloom_at(b, (-0.06, -0.05, zs + 0.13), 0.045, "white", "yellow", 8, "+z")

@item("gar-tulipbulb", "Tulip Bulb", "rooftop-garden", "pack", (0.5, 0.5))
def bulb(b):
    """A fat bulb with a green shoot, and a tag with the tulip it will be."""
    b.lathe([(0, 0), (0.05, 0), (0.1, 0.03), (0.125, 0.09), (0.11, 0.15), (0.06, 0.2), (0.03, 0.235), (0, 0.24)],
            mats=["kraft_dk", "kraft_dk", "kraft", "kraft", "kraft_lt", "kraft_lt", "kraft_lt"], seg=20)
    b.lathe([(0, 0), (0.03, 0), (0.035, 0.04), (0.02, 0.1), (0, 0.13)], (0, 0, 0.215), tn("leaf_light", 0.3, None), seg=10)
    def tulip(b, p):
        b.ball(1.0, (p[0], p[1] - 0.004, p[2] + 0.014), "pink", sc=(0.026, 0.012, 0.03), u=10, v=6); b.box((0.01, 0.008, 0.04), (p[0], p[1] - 0.002, p[2] - 0.03), "green")
    tag(b, (0.03, -0.01, 0.31), tulip, s=0.72)

@item("gar-rosebush", "Rose Cutting", "rooftop-garden", "pack", (0.5, 0.5))
def rose(b):
    """A rose cutting in a small pot: three pairs of leaves and one red bud."""
    zs = pot(b, 0.15, 0.19)
    b.tube([(0, 0, zs - 0.02), (0.02, 0, zs + 0.15), (-0.01, 0, zs + 0.3), (0.01, 0, zs + 0.4)], 0.017, "leaf_dark", seg=6)
    for h, yaw in ((0.1, 0.3), (0.2, 2.0), (0.3, 3.8)):
        leaf(b, (0.01, 0, zs + h), 0.13, "green", yaw, 0.4, w=0.55); leaf(b, (0.01, 0, zs + h), 0.12, "leaf_light", yaw + 2.8, 0.4, w=0.55)
    b.lathe([(0, 0), (0.03, 0.01), (0.052, 0.05), (0.042, 0.09), (0.016, 0.112), (0, 0.114)], (0.01, 0, zs + 0.385), tn("red", None, 0.6), seg=12)
    for k in range(3): leaf(b, (0.01, 0, zs + 0.39), 0.05, "green", k * 2.1, 0.9, w=0.5)

@item("gar-acorn", "Oak Acorn", "rooftop-garden", "pack", (0.5, 0.5))
def acorn(b):
    """A giant acorn standing on its base, cap on, with one oak leaf on the stalk."""
    d, m, l = tri("trunk_light")
    b.lathe([(0, 0), (0.04, 0.0), (0.09, 0.04), (0.12, 0.11), (0.118, 0.17), (0, 0.17)], mats=[d, d, m, l, l], seg=20)
    b.lathe([(0, 0.15), (0.125, 0.15), (0.138, 0.165), (0.13, 0.21), (0.09, 0.25), (0.03, 0.266), (0, 0.268)], mats=["trunk_dk", "trunk_dk", "trunk", "trunk", "trunk_lt", "trunk_lt"], seg=20)
    for i in range(10):
        a = tau * i / 10; stud(b, (0.132 * cos(a), 0.132 * sin(a), 0.19), (cos(a), sin(a), 0.2), 0.022, "trunk_lt", 0.4, 6, 4)
    b.tube([(0, 0, 0.26), (0.01, 0, 0.3), (0.03, 0, 0.325)], 0.014, "trunk", seg=6)
    leaf(b, (0.02, 0, 0.31), 0.15, "green", 0.5, 0.25, w=0.55)

# ---------------------------------------------------------------- pots and tools
@item("gar-wateringcan", "Watering Can", "rooftop-garden", "pack", (1, 0.5))
def can(b):
    """A teal can full of water: a long spout with a cream rose to the right, cream handles, a band with a bloom."""
    d, m, l = tri(V("A", "teal")); c = (-0.03, 0, 0)
    b.lathe([(0, 0), (0.135, 0), (0.15, 0.02), (0.142, 0.2), (0.14, 0.26), (0.15, 0.275), (0.132, 0.28), (0.126, 0.24), (0, 0.24)], c, mats=[d, d, m, l, "cream", "cream", d, "water"], seg=24)
    band(b, 0.148, 0.08, 0.15, "cream", loc=c, seg=24)
    bloom_at(b, (-0.03, -0.157, 0.115), 0.034, "yellow", "white", 6)
    b.tube([(0.09, 0, 0.06), (0.2, 0, 0.12), (0.3, 0, 0.24), (0.35, 0, 0.3)], [0.045, 0.035, 0.028, 0.026], m, seg=8)
    b.lathe([(0, 0), (0.03, 0), (0.062, 0.05), (0.064, 0.062), (0, 0.066)], (0.335, 0, 0.283), "cream", seg=12, rot=Vector((0.64, 0, 0.77)).to_track_quat("Z", "Y").to_matrix())
    b.tube([(-0.16, 0, 0.24), (-0.27, 0, 0.25), (-0.31, 0, 0.17), (-0.27, 0, 0.09), (-0.17, 0, 0.07)], 0.022, "cream", seg=8)
    b.tube([(-0.13, 0, 0.27), (-0.1, 0, 0.36), (-0.03, 0, 0.39), (0.04, 0, 0.36), (0.07, 0, 0.27)], 0.02, "cream", seg=8)

@item("gar-fern", "Windowsill Fern", "rooftop-garden", "table", (0.5, 0.5))
def fern(b):
    """A sky-blue pot with a fountain of fronds in three greens."""
    zs = pot(b, 0.17, 0.2, V("A", "sky"))
    for i in range(9):
        a = tau * i / 9; leaf(b, (0.02 * cos(a), 0.02 * sin(a), zs), 0.25 if i % 2 else 0.22, ("green", "leaf_dark", "green")[i % 3], a, 0.5 + 0.25 * (i % 2), w=0.32, th=0.08)
    for i in range(4):
        a = tau * i / 4 + 0.4; leaf(b, (0.01 * cos(a), 0.01 * sin(a), zs), 0.2, "leaf_light", a, 1.15, w=0.32, th=0.08)

@item("gar-flowerpot", "Moonflower Pot", "rooftop-garden", "table", (0.5, 0.5))
def moonflower(b):
    """A navy pot with a mound of vine and three pale moonflowers."""
    import gv
    zs = pot(b, 0.17, 0.2, V("A", "navy"))
    gv.crown(b, [((0, 0, zs + 0.09), 0.165, (1, 1, 0.75)), ((0.08, 0.03, zs + 0.17), 0.1, (1, 1, 0.8)), ((-0.09, -0.02, zs + 0.15), 0.09, (1, 1, 0.8))],
             380, "green", "leaf_dark", "leaf_light", lo=(zs + 0.05, 0.25), hi=(zs + 0.19, 0.3), voxel=0.03)
    for p, r in (((0, -0.16, zs + 0.11), (-0.4, 0, 0)), ((-0.1, -0.02, zs + 0.245), (-1.2, 0, 0.5)), ((0.13, -0.04, zs + 0.22), (-0.9, 0, -0.7))):
        b.mesh(bloom_mesh(5, "white", "butter"), None, mtx=xf(p, r) @ Matrix.Diagonal((0.075, 0.13, 0.075, 1)))

@item("gar-planter", "Garden Planter", "rooftop-garden", "floor", (1, 0.5))
def planter(b):
    """A wooden trough on four cream posts with bud caps, a bloom on the front, and three clumps of flowers."""
    b.box((0.9, 0.4, 0.34), (0, 0, 0.19), tn("wood", 0.25, 0.8), r=0.02)
    b.box((0.94, 0.44, 0.05), (0, 0, 0.375), "wood_lt", r=0.015); b.box((0.84, 0.34, 0.03), (0, 0, 0.398), "soil", r=0.012)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.cyl(0.036, 0.44, (sx * 0.45, sy * 0.2, 0), "cream", seg=10); b.ball(0.05, (sx * 0.45, sy * 0.2, 0.46), "cream_lt", sc=(1, 1, 1.15), u=10, v=6)
    bloom_at(b, (0, -0.203, 0.19), 0.075, "cream", "gold", 8)
    for k, x in enumerate((-0.28, 0.0, 0.28)):
        b.ball(1.0, (x, 0, 0.45), tn("green", 0.3, 0.72), sc=(0.14, 0.13, 0.09), u=12, v=7)
        stem_flower(b, (x - 0.05, -0.05, 0.42), 0.3, ("pink", "yellow", "purple")[k], ("yellow", "white", "yellow")[k], 0.06)
        stem_flower(b, (x + 0.06, 0.03, 0.42), 0.24, ("yellow", "purple", "pink")[k], ("white", "yellow", "yellow")[k], 0.055)

@item("gar-bench", "Small Garden Bench", "rooftop-garden", "floor", (2, 1), seat=(-0.45, 0, 0.42, 0, 0.45, 0, 0.42, 0))
def bench(b):
    """A two-seat bench: cream posts with bud caps, three wooden seat slats, a slatted back with a heart on the top
    rail. Seat top 0.42 m."""
    W = tn("wood", 0.3, 0.75)
    for sx in (-1, 1):
        b.cyl(0.05, 0.635, (sx * 0.86, -0.24, 0), "cream", seg=12); b.ball(0.062, (sx * 0.86, -0.24, 0.65), "cream_lt", sc=(1, 1, 1.15), u=10, v=6)
        b.cyl(0.05, 1.04, (sx * 0.86, 0.27, 0), "cream", seg=12); b.ball(0.062, (sx * 0.86, 0.27, 1.07), "cream_lt", sc=(1, 1, 1.15), u=10, v=6)
        b.box((0.11, 0.56, 0.06), (sx * 0.86, 0.015, 0.59), "wood", r=0.025)
    for y in (-0.2, -0.02, 0.16): b.box((1.66, 0.165, 0.06), (0, y, 0.39), W, r=0.022)
    b.box((1.66, 0.04, 0.09), (0, -0.265, 0.33), "wood_dk", r=0.012)
    b.box((1.66, 0.07, 0.13), (0, 0.27, 0.93), W, r=0.03); b.box((1.66, 0.06, 0.08), (0, 0.27, 0.5), "wood", r=0.02)
    for x in (-0.6, -0.3, 0.0, 0.3, 0.6): b.box((0.2, 0.045, 0.37), (x, 0.27, 0.71), W, r=0.016)
    heart_at(b, 0.235, 0.93, 0.045, "cream", depth=0.02)
