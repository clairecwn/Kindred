"""Kingdom plant kit: shared meshes (names start KK_). Origin of every kit mesh is its base centre on the ground.
Shapes follow the Grove kit so both worlds read as one place: welded crowns with clean colour bands, flat rosette
flower heads, round things with enough segments to stay round. Stage 4 (ripe / in bloom) only for now; the earlier
growth stages are added in the nature-kit phase under the same names with _S1.._S3."""
import bpy, bmesh, importlib
from kk import *
import kgreen; importlib.reload(kgreen)

def trunk(b, h=2.5, r=0.27, cols=("trunk", "trunk_light")):
    prof = [(r * 1.7, 0), (r * 1.25, 0.14), (r * 1.05, 0.36)]; n = 5
    for i in range(1, n + 1): prof.append((r * (1.0 - 0.2 * i / n), 0.36 + (h - 0.36) * i / n))
    b.lathe(prof, mats=[cols[0], cols[0]] + [cols[1] if i % 2 else cols[0] for i in range(n)], seg=12)

ROUND = [((0, 0, 3.7), 1.45), ((1.0, 0.2, 3.35), 1.0), ((-0.95, 0.35, 3.3), 1.05), ((0.1, -1.0, 3.3), 1.0),
         ((0.05, 1.0, 3.45), 0.95), ((0.35, -0.25, 4.65), 0.95), ((-0.5, -0.6, 4.25), 0.8)]
FRUIT = ((0, (0.2, -0.75, 0.62)), (1, (0.85, -0.4, 0.3)), (2, (-0.8, -0.3, 0.5)), (3, (-0.3, -0.85, 0.4)), (1, (0.6, 0.6, 0.5)), (4, (-0.2, 0.8, 0.55)))
TREE_H = 5.5       # height of a kit tree at scale 1

def round_tree(name, tint="classic", fruit=None, seg=(14, 8), fruits=6):
    """The tree a player plants: the seven puffs of ROUND on a striped trunk (kgreen has the rules of the look)."""
    b = B(); trunk(b)
    kgreen.puff(b, [(c, r, (1, 1, 0.88), (18, 10) if i == 0 and seg[0] >= 12 else seg) for i, (c, r) in enumerate(ROUND)], tint)
    if fruit:
        for li, d in FRUIT[:fruits]:
            c, r = ROUND[li]; dv = Vector(d).normalized()
            dot(b, (c[0] + dv.x * r * 0.93, c[1] + dv.y * r * 0.93, c[2] + dv.z * r * 0.82), 0.2, fruit)
    return kit(name, b, 62)

def flower_head(b, loc, r, petal, core="yellow", n=5):
    x, y, z = loc; k = 6 * n; pts = []
    for i in range(k):
        a = tau * i / k; q = r * (0.5 + 0.5 * abs(cos(n * a / 2)) ** 0.55); pts.append((q * cos(a), q * sin(a)))
    b.prism(pts, 0.07 * r + 0.02, petal, loc=(x, y, z - 0.02), rot=(0.2, 0, 0))
    b.ball(r * 0.36, (x, y, z + 0.05 * r), core, sc=(1, 1, 0.6), u=8, v=4)

def soil(b, r=0.42):
    """The patch of turned earth a planted thing stands in. Lets a seed go straight into a lawn cell."""
    b.lathe([(r, 0), (r * 0.93, 0.035), (0, 0.045)], m="soil", seg=12)

def seedling(name):
    """Stage 1 of every plant: a mound of earth with the two-leaf sprout, the Kingdom's emblem."""
    import kbuild
    b = B(); soil(b, 0.36)
    b.lathe([(0.2, 0.03), (0.15, 0.08), (0, 0.1)], m="soil", seg=10)
    kbuild.sprout(b, (0, 0, 0.09), 0.3)
    return kit(name, b, 62)

def flower(name, petal, core, stage=4):
    """Stage 2: a short stem and two leaves. Stage 3: full height with a closed bud. Stage 4: in bloom."""
    b = B(); h = 0.34 if stage == 2 else 0.62
    b.tube([(0, 0, 0), (0.04 * h / 0.62, 0, h * 0.48), (0, 0, h)], 0.035, "leaf_dark", seg=5)
    for a in (0.6, 0.6 + pi): b.ball(0.17 if stage > 2 else 0.13, (0.15 * cos(a), 0.15 * sin(a), 0.2 if stage > 2 else 0.14), "leaf_light", sc=(1, 0.5, 0.22), u=6, v=4, rot=(0, -0.5, a))
    if stage == 2: b.ball(0.05, (0, 0, h + 0.02), "leaf_light", sc=(1, 1, 1.3), u=6, v=4)
    elif stage == 3:
        b.ball(0.1, (0, 0, h + 0.07), petal, sc=(1, 1, 1.35), u=8, v=5)
        b.ball(0.11, (0, 0, h + 0.01), "leaf_dark", sc=(1, 1, 0.6), u=8, v=4)
    else: flower_head(b, (0, 0, 0.66), 0.32, petal, core)
    return kit(name, b)

def carrot(name, stage=4):
    """Stage 2: two small fronds. Stage 3: a full tuft. Stage 4: ripe, the orange shoulder shows above the soil."""
    b = B(); soil(b)
    if stage == 4: b.lathe([(0, -0.24), (0.06, -0.12), (0.115, 0.0), (0.125, 0.05), (0.09, 0.095), (0, 0.105)], m="orange", seg=10)
    F = ((0.3, 0.42, "green"), (1.9, 0.5, "leaf_light"), (3.5, 0.4, "green"), (5.0, 0.52, "leaf_light"))
    k = {2: 0.55, 3: 0.85, 4: 1.0}[stage]; z0 = 0.09 if stage == 4 else 0.03
    for i, (a, tilt, m) in enumerate(F[:2] if stage == 2 else F):
        h = (0.22 + 0.02 * (i % 2)) * k
        c = (sin(tilt) * h * cos(a), sin(tilt) * h * sin(a), z0 + cos(tilt) * h)
        b.ball(1.0, c, m, sc=(0.075 * k, 0.035 * k, h), u=6, v=5, rot=(0, tilt, a))
    return kit(name, b, 62)

def _scaled(blobs, k):
    return [((c[0] * k, c[1] * k, c[2] * k), r * k, sc) for c, r, sc in blobs]

def cabbage(name, stage=4):
    """Stage 2: a flat rosette of young leaves. Stage 3: a small head in its leaves. Stage 4: a full pale head in a
    wrap of broad leaves. The head is a puff (kgreen), the leaves are blades: a cabbage reads by its outline."""
    b = B(); soil(b); k = {2: 0.6, 3: 0.74, 4: 1.0}[stage]; n = 5 if stage == 2 else 6
    for i in range(n):                                   # the wrapper leaves, curling up round the head
        a = tau * i / n + 0.3; c, s_ = cos(a), sin(a); L = 0.3 * k; up = 0.1 if stage == 2 else 0.2
        kgreen.blade(b, [(0.03 * c, 0.03 * s_, 0.04), (L * 0.55 * c, L * 0.55 * s_, 0.05 + up * k * 0.45), (L * 0.95 * c, L * 0.95 * s_, 0.05 + up * k), (L * 1.02 * c, L * 1.02 * s_, 0.05 + up * k * 1.5)],
                     [0.07 * k, 0.15 * k, 0.13 * k, 0.03 * k], kgreen.leafmat("canopy" if i % 2 else "canopyDeep"), thick=0.035)
    if stage == 2: b.ball(0.06, (0, 0, 0.09), kgreen.leafmat("cabbage"), u=8, v=5)
    else: kgreen.puff(b, [((0, 0, 0.05 + 0.2 * k), 0.21 * k, (1, 1, 0.92), (12, 7))], ("cabbage", "cabbageHi", "canopyWarm"), floor=0.03)
    return kit(name, b, 62)

def _pumpkin_body(b, R, m, at=(0, 0, 0), ribs=8, squash=0.76):
    t = bmesh.new(); nu = ribs * 3; nv = 8; rings = []
    for j in range(1, nv):
        ph = pi * j / nv; row = []
        for i in range(nu):
            th = tau * i / nu; q = R * (0.87 + 0.13 * abs(cos(ribs * th / 2)) ** 0.8) * sin(ph)
            row.append(t.verts.new((q * cos(th), q * sin(th), R * squash * (1 - cos(ph)) - (0.035 * R / 0.3 if j == nv - 1 else 0))))
        rings.append(row)
    bot = t.verts.new((0, 0, 0.0)); top = t.verts.new((0, 0, 2 * R * squash - 0.06 * R / 0.3))
    for i in range(nu):
        k = (i + 1) % nu
        t.faces.new((bot, rings[0][k], rings[0][i])); t.faces.new((top, rings[-1][i], rings[-1][k]))
        for j in range(len(rings) - 1): t.faces.new((rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]))
    b._add(t, m, Matrix.Translation(Vector(at)))
    zt = at[2] + 2 * R * squash - 0.07 * R / 0.3; s = R / 0.3
    b.tube([(at[0], at[1], zt), (at[0] + 0.015 * s, at[1], zt + 0.09 * s), (at[0] + 0.06 * s, at[1], zt + 0.15 * s)], [0.05 * s, 0.036 * s, 0.03 * s], "leaf_dark", seg=6)

def _vine_leaf(b, a, d, z=0.12, r=0.16, m="green"):
    c, s = cos(a), sin(a)
    b.tube([(0.04 * c, 0.04 * s, 0.02), (d * 0.6 * c, d * 0.6 * s, z * 0.8), (d * c, d * s, z)], 0.022, "leaf_dark", seg=4)
    b.ball(r, (d * c, d * s, z + 0.02), m, sc=(1, 0.9, 0.16), u=8, v=4, rot=(0, -0.25, a))

def pumpkin(name, stage=4):
    """Stage 2: a little vine with three leaves. Stage 3: a small green fruit. Stage 4: a ripe orange pumpkin, one lobed
    surface (it was seven overlapping balls)."""
    b = B(); soil(b)
    if stage == 2:
        for a, m in ((0.4, "green"), (2.5, "leaf_light"), (4.5, "green")): _vine_leaf(b, a, 0.2, 0.12, 0.14, m)
    elif stage == 3:
        _pumpkin_body(b, 0.17, "leaf_light", (0.02, 0, 0.02))
        for a, m in ((1.0, "green"), (3.9, "green")): _vine_leaf(b, a, 0.3, 0.13, 0.14, m)
    else:
        _pumpkin_body(b, 0.3, "orange", (0, 0, 0))
        for a, m in ((0.7, "green"), (3.6, "leaf_light")): _vine_leaf(b, a, 0.38, 0.1, 0.13, m)
    return kit(name, b, 62)

def tomato(name, stage=4):
    """A bush on a stake. Stage 2: a small bush. Stage 3: taller, with green fruit. Stage 4: red tomatoes."""
    b = B(); soil(b)
    b.cyl(0.03, 0.48 if stage == 2 else 0.98, (0.03, 0.05, 0.02), "wood", seg=6)          # starts inside the mound: its foot must not lie in the plane of the mound's underside
    if stage == 2:
        kgreen.puff(b, [((0, 0, 0.2), 0.18, (1, 1, 1), (10, 6))], "classic", floor=0.03)
    else:
        tiers = [((0, 0, 0.28), 0.25, (1, 1, 0.9), (10, 6)), ((0.03, 0, 0.54), 0.2, (1, 1, 0.9), (8, 5)), ((-0.02, 0.02, 0.76), 0.15, (1, 1, 0.95), (8, 5))]
        kgreen.puff(b, tiers, "classic", floor=0.03)
        spots = [(0.22, -0.1, 0.3), (-0.2, -0.12, 0.4), (0.17, -0.12, 0.6), (-0.11, -0.15, 0.72), (0.02, -0.25, 0.46), (-0.05, 0.24, 0.36), (0.1, 0.17, 0.62)]
        for i, loc in enumerate(spots[:5] if stage == 3 else spots):
            dot(b, loc, 0.062 if stage == 3 else 0.092, kgreen.leafmat("canopyWarmHi") if stage == 3 else "red")
    return kit(name, b, 62)

def corn(name, stage=4):
    """A stalk that gets taller each stage. Stage 4 carries two yellow cobs and a tassel."""
    b = B(); soil(b); h = {2: 0.45, 3: 0.95, 4: 1.35}[stage]
    b.tube([(0, 0, 0), (0.02, 0, h / 2), (0, 0, h)], [0.05, 0.042, 0.024], "leaf_light", seg=6)
    for i in range({2: 3, 3: 5, 4: 6}[stage]):
        a = 2.4 * i + 0.3; z0 = h * (0.2 + 0.11 * i); c, s = cos(a), sin(a)
        b.tube([(0, 0, z0), (0.26 * c, 0.26 * s, z0 + 0.17), (0.42 * c, 0.42 * s, z0 + 0.03)], [0.04, 0.034, 0.006], "green", seg=4)
    if stage == 4:
        for sg in (-1, 1):
            b.ball(0.072, (sg * 0.09, -0.04, h * 0.5 + 0.04 * sg), "yellow", sc=(1, 1, 2.3), u=8, v=6, rot=(0, sg * 0.35, 0))
            b.ball(0.08, (sg * 0.1, -0.02, h * 0.5 + 0.04 * sg - 0.09), "leaf_light", sc=(1, 1, 1.5), u=8, v=5, rot=(0, sg * 0.35, 0))
        for a in (0.2, 2.2, 4.3): b.tube([(0, 0, h - 0.02), (0.07 * cos(a), 0.07 * sin(a), h + 0.14)], [0.014, 0.006], "gold", seg=4)
    return kit(name, b, 62)

def strawberry(name, stage=4):
    """A low mound of leaves. Stage 3 is in flower; stage 4 hangs red berries round its edge."""
    b = B(); soil(b); k = 0.6 if stage == 2 else 1.0
    blobs = [((0, 0, 0.11), 0.2, (1, 1, 0.75), (10, 6)), ((0.17, 0.04, 0.09), 0.14, (1, 1, 0.75), (8, 5)), ((-0.16, -0.03, 0.09), 0.15, (1, 1, 0.75), (8, 5)), ((0, 0.16, 0.09), 0.13, (1, 1, 0.75), (8, 5))]
    kgreen.puff(b, [((c[0] * k, c[1] * k, c[2] * k), r * k, sc, sg) for c, r, sc, sg in blobs], "classic", floor=0.03, shade=False)
    ring = [(0.7, 0.28), (2.0, 0.27), (3.3, 0.29), (4.5, 0.26), (5.6, 0.28)]
    if stage == 3:
        for a, d in ring[:4]:
            dot(b, (d * 0.7 * cos(a), d * 0.7 * sin(a), 0.2), 0.05, "white", 0.5); dot(b, (d * 0.7 * cos(a), d * 0.7 * sin(a), 0.225), 0.022, "yellow", 0.6)
    elif stage == 4:
        for a, d in ring:
            b.ball(0.07, (d * cos(a), d * sin(a), 0.09), "red", sc=(1, 1, 1.25), u=8, v=5)
            b.ball(0.038, (d * cos(a), d * sin(a), 0.168), "leaf_dark", sc=(1, 1, 0.45), u=6, v=3)
    return kit(name, b, 62)

def daisy(name, stage): return flower(name, "petalA", "petalB", stage)

def tulip(name, stage):
    b = B(); h = {2: 0.3, 3: 0.5, 4: 0.55}[stage]
    b.tube([(0, 0, 0), (0.02, 0, h * 0.5), (0, 0, h)], 0.035, "leaf_dark", seg=5)
    for a in (0.4, 0.4 + pi): b.ball(1.0, (0.09 * cos(a), 0.09 * sin(a), h * 0.42), "leaf_light", sc=(0.075, 0.035, h * 0.42), u=6, v=5, rot=(0, 0.28, a))
    if stage == 3: b.ball(0.085, (0, 0, h + 0.07), "petalA", sc=(1, 1, 1.5), u=8, v=5)
    if stage == 4:
        b.lathe([(0, 0), (0.1, 0.03), (0.16, 0.12), (0.16, 0.22), (0.12, 0.3), (0.05, 0.31), (0, 0.24)], (0, 0, h - 0.02), "petalA", seg=10)
        for i in range(3):
            a = tau * i / 3; b.ball(0.07, (0.105 * cos(a), 0.105 * sin(a), h + 0.28), "petalA", sc=(1, 1, 1.3), u=6, v=4)
        b.ball(0.05, (0, 0, h + 0.22), "petalB", u=6, v=4)
    return kit(name, b)

def sunflower(name, stage):
    b = B(); h = {2: 0.45, 3: 0.85, 4: 1.1}[stage]
    b.tube([(0, 0, 0), (0.03, 0, h * 0.5), (0, -0.02, h)], 0.045, "leaf_dark", seg=6)
    for i in range(2 if stage == 2 else 4):
        a = 1.2 + 1.9 * i; z = h * (0.28 + 0.16 * i)
        b.ball(0.2, (0.17 * cos(a), 0.17 * sin(a), z), "leaf_light" if i % 2 else "green", sc=(1, 0.55, 0.18), u=7, v=4, rot=(0, -0.45, a))
    if stage == 3:
        b.ball(0.13, (0, -0.03, h + 0.06), "leaf_dark", sc=(1, 1, 0.75), u=8, v=5); b.ball(0.07, (0, -0.05, h + 0.14), "petalA", u=6, v=4)
    if stage == 4:
        n = 12; k = 6 * n; R = 0.3; pts = []
        for i in range(k):
            a = tau * i / k; q = R * (0.62 + 0.38 * abs(cos(n * a / 2)) ** 0.6); pts.append((q * cos(a), q * sin(a)))
        b.prism(pts, 0.045, "petalA", loc=(0, -0.06, h + 0.06), rot=(1.15, 0, 0))
        b.ball(0.16, (0, -0.1, h + 0.08), "petalB", sc=(1, 1, 0.45), u=10, v=5, rot=(1.15, 0, 0))
    return kit(name, b)

def rose(name, stage):
    b = B()
    if stage == 2:
        kgreen.puff(b, [((0, 0, 0.16), 0.17, (1, 1, 0.9), (10, 6)), ((0.1, 0.05, 0.2), 0.12, (1, 1, 0.9), (8, 5))], "deep", floor=0.0)
    else:
        kgreen.puff(b, [((0, 0, 0.26), 0.26, (1, 1, 0.88), (10, 6)), ((0.19, 0.05, 0.2), 0.18, (1, 1, 0.88), (8, 5)), ((-0.18, -0.04, 0.2), 0.19, (1, 1, 0.88), (8, 5))], "deep", floor=0.0)
        spots = [(0.02, -0.15, 0.45), (0.28, -0.07, 0.3), (-0.26, -0.13, 0.3), (-0.04, 0.13, 0.48)]
        for x, y, z in (spots[:3] if stage == 3 else spots):
            if stage == 3: b.ball(0.05, (x, y, z), "petalA", sc=(1, 1, 1.3), u=6, v=4)
            else:
                b.ball(0.105, (x, y, z), "petalA", sc=(1, 1, 0.8), u=9, v=5); b.ball(0.06, (x, y, z + 0.055), "petalB", sc=(1, 1, 0.7), u=7, v=4)
    return kit(name, b, 62)

def lavender(name, stage):
    b = B(); h = {2: 0.26, 3: 0.45, 4: 0.6}[stage]
    for i in range(5):
        a = tau * i / 5 + 0.3; lean = 0.1 + 0.05 * (i % 2); c, s = cos(a), sin(a); hh = h * (1 - 0.12 * (i % 3))
        tip = ((0.05 + lean * hh) * c, (0.05 + lean * hh) * s, hh)
        b.tube([(0.05 * c, 0.05 * s, 0), ((0.05 + lean * hh * 0.4) * c, (0.05 + lean * hh * 0.4) * s, hh * 0.55), tip], [0.024, 0.02, 0.008 if stage == 2 else 0.014], "green", seg=4)
        for j in range({2: 0, 3: 2, 4: 4}[stage]):
            u = 1 - 0.13 * j; b.ball(0.055 - 0.006 * (3 - j if stage == 4 else 2), ((0.05 + lean * hh * u) * c, (0.05 + lean * hh * u) * s, hh * (0.62 + 0.38 * u) + 0.02), "petalA", sc=(1, 1, 1.2), u=6, v=4)
    for a in (0.9, 2.7, 4.6): b.ball(1.0, (0.08 * cos(a), 0.08 * sin(a), 0.09), "leaf_light", sc=(0.035, 0.02, 0.11), u=5, v=4, rot=(0, 0.5, a))
    return kit(name, b)

# ---------------------------------------------------------------- trees the player plants
def sapling(name):
    b = B(); soil(b, 0.3)
    b.tube([(0, 0, 0), (0.02, 0, 0.45), (0, 0, 0.85)], [0.06, 0.048, 0.036], "trunk", seg=6)
    kgreen.puff(b, [((0, 0, 1.03), 0.3, (1, 1, 0.92), (12, 7)), ((0.16, 0.05, 0.9), 0.18, (1, 1, 0.9), (8, 5))], "classic")
    b.ball(0.12, (0.13, 0.02, 0.5), "leaf_light", sc=(1, 0.6, 0.25), u=6, v=4, rot=(0, -0.5, 0.2))
    return kit(name, b, 62)

def wet_patch(name):
    """Drawn under a plant that has been watered today: a ring of darker, damp earth."""
    b = B(); b.lathe([(0.52, 0), (0.49, 0.028), (0, 0.036)], m="soil_wet", seg=14)
    return kit(name, b, 62)

def grass_tuft(name):
    b = B(); kgreen.grass_tuft(b)
    return kit(name, b, 62)

def cloud(name):
    b = B()
    kgreen.puff(b, [(loc, r, (1, 0.7, 0.75), (14, 8)) for loc, r in (((0, 0, 0), 1.0), ((1.15, 0, -0.12), 0.8), ((-1.1, 0, -0.16), 0.76), ((0.4, 0, 0.5), 0.7), ((-0.45, 0, 0.42), 0.6))],
                "cloud", light=False)
    return kit(name, b, 62)

def great_tree(name, k=2.6, th=5.0):
    """The hero landmark: the kit tree's own shape grown large, so it belongs with the others, plus roots, a glowing
    hollow in the trunk and blossom. Front (the hollow) faces -Y. About 13.5 m tall."""
    b = B()
    r = 0.85; prof = [(r * 1.75, 0), (r * 1.3, 0.3), (r * 1.08, 0.8)]; n = 6
    for i in range(1, n + 1): prof.append((r * (1.0 - 0.22 * i / n), 0.8 + (th - 0.8) * i / n))
    b.lathe(prof, mats=["trunk", "trunk"] + ["trunk_light" if i % 2 else "trunk" for i in range(n)], seg=18)
    for i in range(5):                                             # roots
        a = tau * i / 5 + 0.5; c, s = cos(a), sin(a)
        b.tube([(0.75 * c, 0.75 * s, 0.75), (1.55 * c, 1.55 * s, 0.3), (2.3 * c, 2.3 * s, -0.12)], [0.36, 0.25, 0.1], "trunk", seg=7)
    for a, lean in ((0.6, 1.5), (2.7, 1.7), (4.6, 1.4)):          # boughs into the crown
        c, s = cos(a), sin(a)
        b.tube([(0.3 * c, 0.3 * s, th - 0.9), (lean * c, lean * s, th + 0.9), (lean * 1.9 * c, lean * 1.9 * s, th + 2.2)], [0.42, 0.32, 0.2], "trunk", seg=7)
    blobs = [((c[0] * k, c[1] * k, th + (c[2] - 2.6) * k), rr * k, (1, 1, 0.88)) for c, rr in ROUND]
    kgreen.puff(b, [bl + ((20, 11),) for bl in blobs], "classic")
    for i, (li, d) in enumerate(FRUIT + ((5, (0.3, -0.6, 0.7)), (6, (-0.5, -0.7, 0.5)), (0, (-0.6, -0.6, 0.5)), (3, (0.5, -0.7, 0.1)), (2, (-0.7, 0.2, 0.7)), (4, (0.5, 0.6, 0.6)))):
        c, rr = ROUND[li]; dv = Vector(d).normalized()
        dot(b, ((c[0] + dv.x * rr * 0.93) * k, (c[1] + dv.y * rr * 0.93) * k, th + (c[2] + dv.z * rr * 0.82 - 2.6) * k), 0.3, "pink" if i % 3 else "white")
    # the hollow: a warm round window with a wooden rim
    zc = 2.35; rt = r * (1.0 - 0.22 * (zc - 0.8) / (th - 0.8))
    b.ball(0.45, (0, -rt + 0.12, zc), "glow", sc=(1, 0.35, 1), u=14, v=8)
    b.tube([(0.5 * cos(tau * i / 14), -rt - 0.02 + 0.1 * (1 - abs(cos(tau * i / 14))), zc + 0.5 * sin(tau * i / 14)) for i in range(14)], 0.09, "wood", seg=6, closed=True)
    return kit(name, b, 62)

def bush(name):
    b = B()
    kgreen.puff(b, [((0, 0, 0.45), 0.78, (1, 1, 0.8), (14, 8)), ((0.72, 0.1, 0.36), 0.56, (1, 1, 0.8)), ((-0.66, -0.12, 0.38), 0.6, (1, 1, 0.8))], "classic", floor=0.0)
    for loc, pc in (((0.15, -0.5, 0.9), "pink"), ((-0.6, -0.42, 0.66), "white"), ((0.84, -0.28, 0.6), "pink")):
        dot(b, loc, 0.1, pc, 0.7)
    return kit(name, b, 62)

def rock(name):
    b = B(); kgreen.rock(b)
    return kit(name, b)

CROPS = {"Carrot": carrot, "Cabbage": cabbage, "Pumpkin": pumpkin, "Tomato": tomato, "Corn": corn, "Strawberry": strawberry}
FLOWERS = {"Daisy": daisy, "Tulip": tulip, "Sunflower": sunflower, "Rose": rose, "Lavender": lavender}

def build_all():
    out = {}
    out["KK_Tree_Round"] = round_tree("KK_Tree_Round", "classic")
    out["KK_Tree_Citrus"] = round_tree("KK_Tree_Citrus", "warm", "orange")
    out["KK_Tree_Round_Far"] = round_tree("KK_Tree_Round_Far", "classic", None, (8, 5))
    for pc, core in (("pink", "gold"), ("yellow", "white"), ("purple", "gold"), ("white", "gold")):
        out["KK_Flower_" + pc] = flower("KK_Flower_" + pc, pc, core)
    out["KK_Seedling"] = seedling("KK_Seedling"); out["KK_Wet_Patch"] = wet_patch("KK_Wet_Patch")
    for nm, fn in CROPS.items():            # stage 4 keeps the plain name, so the showcase beds keep their plants
        out["KK_Crop_%s_S2" % nm] = fn("KK_Crop_%s_S2" % nm, 2); out["KK_Crop_%s_S3" % nm] = fn("KK_Crop_%s_S3" % nm, 3); out["KK_Crop_" + nm] = fn("KK_Crop_" + nm, 4)
    for nm, fn in FLOWERS.items():
        for st in (2, 3, 4): out["KK_%s_S%d" % (nm, st)] = fn("KK_%s_S%d" % (nm, st), st)
    out["KK_Tree_Sapling"] = sapling("KK_Tree_Sapling")
    out["KK_Tree_Apple"] = round_tree("KK_Tree_Apple", "classic", "red")
    out["KK_Tree_Citrus_Bare"] = round_tree("KK_Tree_Citrus_Bare", "warm")
    out["KK_Grass_Tuft"] = grass_tuft("KK_Grass_Tuft")
    out["KK_Cloud"] = cloud("KK_Cloud")
    out["KK_Bush"] = bush("KK_Bush"); out["KK_Rock"] = rock("KK_Rock")
    return out

# the plant kit, third look (20 Oct 2026): crops and garden flowers come from kcrops.py, under the same names
import importlib, kcrops; importlib.reload(kcrops)
CROPS, FLOWERS = kcrops.CROPS, kcrops.FLOWERS
carrot, cabbage, pumpkin, tomato, corn, strawberry = (CROPS[n] for n in ("Carrot", "Cabbage", "Pumpkin", "Tomato", "Corn", "Strawberry"))
daisy, tulip, sunflower, rose, lavender = (FLOWERS[n] for n in ("Daisy", "Tulip", "Sunflower", "Rose", "Lavender"))
