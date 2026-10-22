"""Trees and wild growth, third look (20 Oct 2026, after Claire asked for the same research and fixes as the crops).
Each kind follows how the real one grows, kept round and chunky for the Mario look (the puff crowns of kgreen stay:
they were judged "ok better"). What changed, by kind:
  - every trunk has bark (a small painted texture), a flared foot with roots, and boughs that fork up into the crown,
    so a crown sits on branches and is not a ball on a stick.
  - apple: a short trunk opening into four scaffold limbs, a wide low dome, apples hanging round its sides and under it,
    one fallen. Citrus: a dense round crown of dark, glossier leaves, low on a short trunk, oranges set all over it; the
    bare citrus is in flower (white blossom) instead. Cherry blossom: reddish bark ringed with pale lenticels, a vase of
    limbs, a wide flat crown, clusters of blossom. Wild C is a fir: tiers of drooping, toothed skirts, darker blue-green.
  - the sapling is staked and tied in a ring of mulch, as a nursery tree is planted.
  - fern: arching fronds of paired leaflets getting smaller to the tip, and a fiddlehead uncurling in the middle.
  - mushrooms: a brown bun cap, a cream cap and a small red cap with white flecks, each with gills under the cap and a
    ring on the stem. Log: bark, end grain in rings, moss, a shelf fungus. Stump: bark, rings on its top, root flares.
  - wild flowers: five real petals round a domed middle, a slender stem, two blade leaves.
Sizes, origins and names stay as they were (kingdomPreview.GROWTH depends on trunk and crown sizes)."""
import bpy, bmesh
import numpy as np
from math import sin, cos, pi, tau, sqrt
from mathutils import Vector, Matrix
import gk
from kk import *
import kgreen, kcrops
from ktone import TB
from kcrops import leaf, surface, tube, painted, plain, _rgb, star

# ---------------------------------------------------------------- bark and colours
def tex_bark(base, groove, hi, size=64, lenticels=False):
    """Bark: wavy vertical grooves with light ridges; or (lenticels) smooth bark ringed with short pale dashes."""
    a = np.tile(_rgb(base), (size, size, 1)); g = _rgb(groove); h = _rgb(hi)
    if lenticels:
        for j in range(3, size, 9):
            for i in range(0, size, 11):
                x0 = (i + (5 if (j // 9) % 2 else 0)) % size
                for k in range(6): a[j, (x0 + k) % size] = h; a[(j + 1) % size, (x0 + k) % size] = h * 0.85 + _rgb(base) * 0.15
        return a
    for i in range(0, size, 8):
        for y in range(size):
            x = int(i + 2.2 * sin(y * tau / size * 2 + i)) % size
            a[y, x] = g; a[y, (x + 1) % size] = g; a[y, (x + 3) % size] = h
    return a

def bark(kind="oak"):
    if kind == "cherry": return painted("barkCherry", tex_bark("#8A4632", "#6B3324", "#E3BFA6", lenticels=True), 0.5)
    if kind == "fir": return painted("barkFir", tex_bark("#8C5434", "#6A3B22", "#AE7448"), 0.45)
    return painted("barkOak", tex_bark("#A8622B", "#83461E", "#C9824A"), 0.55)

def leafset(name, main, hi, lo, rough=0.9):
    """A puff tint of three new leaf colours (kgreen.puff takes a tuple of material names)."""
    for n in (main, hi, lo): plain(n, rough)
    return (main, hi, lo)

# ---------------------------------------------------------------- trunks and boughs
def trunk(b, h, r, m, roots=4, at=(0, 0, 0), seg=12):
    """A tapering trunk with a flared foot and roots running out into the ground."""
    x0, y0, z0 = at
    b.lathe([(r * 1.5, 0), (r * 1.15, h * 0.07), (r, h * 0.2), (r * 0.82, h)], (x0, y0, z0), mats=[m, m, m], seg=seg)
    for i in range(roots):
        a = tau * i / roots + 0.4; c, s = cos(a), sin(a)
        b.tube([(x0 + r * 0.7 * c, y0 + r * 0.7 * s, z0 + h * 0.08), (x0 + r * 1.5 * c, y0 + r * 1.5 * s, z0 + 0.04), (x0 + r * 2.3 * c, y0 + r * 2.3 * s, z0 - 0.05)], [r * 0.42, r * 0.3, r * 0.12], m, seg=6)

def boughs(b, base, ends, r, m):
    """Limbs from a point on the trunk out to points inside the crown, each with a gentle upward curve."""
    base = Vector(base)
    for e in ends:
        e = Vector(e); mid = base + (e - base) * 0.5 + Vector((0, 0, 0.18 * (e - base).length))
        b.tube([tuple(base), tuple(mid), tuple(e)], [r, r * 0.75, r * 0.45], m, seg=7)

def fruit_on(b, blobs, picks, r, m, stem_m="trunk", leaf_m=None, hang=0.0):
    """Fruit set into the surface of the crown's puffs. picks: [(puff index, direction)]. hang: how far below the
    surface point it hangs on a short stalk (apples hang; oranges sit in the leaves)."""
    for li, d in picks:
        c, rr = Vector(blobs[li][0]), blobs[li][1]; s = Vector(blobs[li][2]) if len(blobs[li]) > 2 else Vector((1, 1, 0.9))
        dv = Vector(d).normalized(); p = c + Vector((dv.x * rr * s.x, dv.y * rr * s.y, dv.z * rr * s.z)) * 0.97
        if hang:
            b.tube([tuple(p + Vector((0, 0, 0.04))), tuple(p - Vector((0, 0, hang)))], 0.012, stem_m, seg=3); p = p - Vector((0, 0, hang + r * 0.9))
        b.ball(r, tuple(p), m, sc=(1, 1, 0.92), u=12, v=8)
        b.ball(r * 0.28, tuple(p + Vector((-r * 0.35, -r * 0.45, r * 0.42))), m + "_lt", u=6, v=4)          # a shine on the fruit
        if leaf_m: leaf(b, p + Vector((0, 0, r * 0.85)), 0.6 + li, r * 1.4, r * 0.6, leaf_m, lift=0.3, droop=0.4, cup=0.2, segs=(3, 2), thick=0.006)

SEG_T = (16, 10)      # puffs of a tree: rounder than before, the faces were showing

# ---------------------------------------------------------------- trees a player plants
ROUND = [((0, 0, 3.7), 1.45), ((1.0, 0.2, 3.35), 1.0), ((-0.95, 0.35, 3.3), 1.05), ((0.1, -1.0, 3.3), 1.0),
         ((0.05, 1.0, 3.45), 0.95), ((0.35, -0.25, 4.65), 0.95), ((-0.5, -0.6, 4.25), 0.8)]
def round_tree(name, tint="classic", seg=SEG_T):
    """The plain shade tree: a broadleaf crown of seven puffs on three boughs."""
    b = TB(); m = bark()
    trunk(b, 2.7, 0.27, m)
    boughs(b, (0, 0, 2.4), [(0.8, 0.2, 3.3), (-0.75, 0.3, 3.25), (0.1, -0.75, 3.3)], 0.16, m)
    kgreen.puff(b, [(c, r, (1, 1, 0.88), (20, 12) if i == 0 and seg[0] >= 12 else seg) for i, (c, r) in enumerate(ROUND)], tint)
    return kit(name, b, 62)

APPLE = [((0, 0, 3.55), 1.25, (1.25, 1.25, 0.72)), ((1.25, 0.25, 3.15), 0.95, (1, 1, 0.78)), ((-1.2, 0.35, 3.1), 0.98, (1, 1, 0.78)),
         ((0.15, -1.2, 3.1), 0.95, (1, 1, 0.78)), ((-0.1, 1.2, 3.2), 0.92, (1, 1, 0.78)), ((0.8, -0.85, 3.25), 0.75, (1, 1, 0.8)), ((-0.85, -0.8, 3.2), 0.78, (1, 1, 0.8))]
def apple_tree(name):
    """An apple tree: short trunk, four scaffold limbs at about 50 degrees, a wide low dome; apples hang round the sides
    and underneath the crown, where they grow on fruiting spurs, and one has dropped."""
    b = TB(); m = bark()
    trunk(b, 1.9, 0.26, m)
    boughs(b, (0, 0, 1.75), [(1.15, 0.2, 2.95), (-1.1, 0.3, 2.9), (0.15, -1.1, 2.95), (-0.1, 1.1, 3.0)], 0.15, m)
    kgreen.puff(b, [bl + (SEG_T,) for bl in APPLE], "classic")
    picks = [(1, (0.6, -0.4, -0.45)), (2, (-0.5, -0.5, -0.4)), (3, (0.2, -0.8, -0.35)), (5, (0.5, -0.6, -0.3)), (6, (-0.6, -0.5, -0.25)),
             (4, (0.2, 0.7, -0.4)), (1, (0.7, 0.4, -0.2)), (2, (-0.8, 0.3, -0.3)), (0, (0.3, -0.5, 0.6)), (3, (-0.4, -0.7, 0.1))]
    fruit_on(b, APPLE, picks, 0.15, "red", hang=0.05)
    b.ball(0.15, (0.9, -1.4, 0.13), "red", sc=(1, 1, 0.92), u=12, v=8); b.tube([(0.9, -1.4, 0.26), (0.92, -1.38, 0.31)], 0.012, "trunk", seg=3)
    return kit(name, b, 62)

CITRUS = [((0, 0, 3.4), 1.55, (1, 1, 0.92)), ((0.95, 0.3, 3.0), 0.95, (1, 1, 0.9)), ((-0.9, 0.4, 3.0), 0.98, (1, 1, 0.9)),
          ((0.1, -0.95, 2.95), 0.95, (1, 1, 0.9)), ((0.0, 0.95, 3.05), 0.9, (1, 1, 0.9)), ((0.1, -0.2, 4.4), 0.95, (1, 1, 0.9))]
def citrus_tree(name, fruit=True):
    """An orange tree: evergreen, a dense round crown low on a short trunk, dark leathery leaves with a little shine,
    the oranges set all over it among the leaves. Without fruit it is in flower: small white blossoms."""
    b = TB(); m = bark()
    tint = leafset("citrus", "citrusLeaf", "citrusLeafHi", "citrusLeafLo", 0.62)
    trunk(b, 2.1, 0.24, m)
    boughs(b, (0, 0, 1.9), [(0.8, 0.25, 2.8), (-0.75, 0.3, 2.8), (0.1, -0.8, 2.75)], 0.13, m)
    kgreen.puff(b, [bl + ((20, 12) if i == 0 else SEG_T,) for i, bl in enumerate(CITRUS)], tint)
    picks = [(0, (0.4, -0.7, 0.4)), (0, (-0.5, -0.6, 0.55)), (1, (0.8, -0.4, 0.1)), (2, (-0.8, -0.3, 0.2)), (3, (0.3, -0.9, -0.1)), (3, (-0.4, -0.8, 0.3)),
             (4, (0.4, 0.8, 0.2)), (4, (-0.5, 0.7, 0.1)), (5, (0.5, -0.5, 0.5)), (1, (0.6, 0.6, -0.2)), (2, (-0.6, 0.6, -0.1)), (0, (0.1, 0.8, 0.6))]
    if fruit: fruit_on(b, CITRUS, picks, 0.14, "orange")
    else:
        for li, d in picks:
            c, rr = Vector(CITRUS[li][0]), CITRUS[li][1]; s = Vector(CITRUS[li][2]); dv = Vector(d).normalized()
            p = c + Vector((dv.x * rr * s.x, dv.y * rr * s.y, dv.z * rr * s.z)) * 0.99
            for k in range(5): leaf(b, p, tau * k / 5, 0.11, 0.07, "white", lift=0.4, droop=0.2, cup=0.2, shape="round", segs=(2, 2), thick=0.006)
            b.ball(0.03, tuple(p + Vector((0, 0, 0.02))), "gold", u=6, v=4)
    return kit(name, b, 62)

def far_tree(name):
    """A distant shade tree: fewer faces, no roots."""
    b = TB(); b.lathe([(0.4, 0), (0.27, 0.3), (0.22, 2.7)], mats=["trunk", "trunk"], seg=8)
    kgreen.puff(b, [(c, r, (1, 1, 0.88), (10, 6)) for c, r in ROUND], "classic")
    return kit(name, b, 62)

def sapling(name):
    """A young planted tree: a slender stem tied to a stake, a small crown, in a ring of mulch."""
    b = TB(); b.lathe([(0.36, 0), (0.33, 0.04), (0.06, 0.06), (0, 0.06)], m="soil", seg=14)
    b.cyl(0.025, 1.15, (0.1, 0.0, 0.0), "wood", seg=6)
    b.tube([(0, 0, 0), (0.02, 0, 0.45), (0, 0, 0.85)], [0.05, 0.04, 0.03], bark(), seg=7)
    for z in (0.35, 0.7): b.tube([(0.0, -0.04, z), (0.1, -0.03, z + 0.01), (0.1, 0.03, z + 0.01), (0.0, 0.04, z)], 0.012, "rope", seg=4)
    kgreen.puff(b, [((0, 0, 1.03), 0.3, (1, 1, 0.92), (14, 8)), ((0.16, 0.05, 0.9), 0.18, (1, 1, 0.9), (10, 6)), ((-0.14, -0.06, 0.93), 0.17, (1, 1, 0.9), (10, 6))], "classic")
    leaf(b, (0.0, 0.0, 0.52), 0.3, 0.13, 0.06, "leaf_light", lift=0.3, droop=0.3, cup=0.2, segs=(3, 2))
    return kit(name, b, 62)

# ---------------------------------------------------------------- trees of the wild land
WILD = {       # kind: (trunk height, trunk radius, bough ends, puffs)
    "A": (2.9, 0.24, [(0.85, 0.3, 3.3), (-0.85, -0.25, 3.35), (0.2, -0.2, 4.2)],
          [((0, 0, 3.9), 1.55, (1, 1, 0.9), (20, 12)), ((1.0, 0.35, 3.25), 1.0), ((-0.95, -0.3, 3.3), 1.05), ((0.25, -0.3, 4.95), 0.9)]),
    "B": (2.0, 0.28, [(1.15, 0.2, 2.6), (-1.1, 0.3, 2.65), (0.1, -1.1, 2.6), (0.0, 0.3, 3.4)],
          [((0, 0, 2.95), 1.5, (1.15, 1.15, 0.8), (20, 12)), ((1.3, 0.2, 2.6), 1.0), ((-1.25, 0.3, 2.65), 1.05), ((0.1, -1.25, 2.6), 0.95), ((0.0, 0.3, 3.75), 1.0)]),
    "D": (1.6, 0.17, [(0.45, 0.15, 1.95), (0.0, 0.0, 2.3)],
          [((0, 0, 2.35), 0.95, (1, 1, 0.92), (16, 10)), ((0.5, 0.15, 1.95), 0.6, (1, 1, 0.9), (12, 8))]),
}
def wild_tree(b, kind="A", tint="classic"):
    if kind == "C": return fir(b)
    if tint == "blossom": return cherry(b)
    h, r, ends, puffs = WILD[kind]; m = bark()
    trunk(b, h, r, m, roots=3 if kind == "D" else 4, seg=10)
    boughs(b, (0, 0, h * 0.85), ends, r * 0.55, m)
    kgreen.puff(b, [p if len(p) > 3 else p + ((1, 1, 0.9), SEG_T) for p in puffs], tint)

def tier(b, z, r, h, ms, n=11, droop=0.18, teeth=0.16):
    """One tier of a fir: a cone whose skirt hangs down in points between the branch tips."""
    t = bmesh.new(); top = t.verts.new((0, 0, z + h)); rim = []; mid = []
    for i in range(2 * n):
        a = tau * i / (2 * n); tip = i % 2 == 0; rr = r * (1.0 if tip else 1 - teeth)
        rim.append(t.verts.new((rr * cos(a), rr * sin(a), z - (droop * r if tip else 0.0))))
        mid.append(t.verts.new((r * 0.55 * cos(a), r * 0.55 * sin(a), z + h * 0.45)))
    core = t.verts.new((0, 0, z + h * 0.12))
    il, im, idk = b.mi(ms[1]), b.mi(ms[0]), b.mi(ms[2])
    N = 2 * n
    for i in range(N):
        j = (i + 1) % N
        f = t.faces.new((top, mid[i], mid[j])); f.material_index = il
        f = t.faces.new((mid[i], rim[i], rim[j], mid[j])); f.material_index = im
        f = t.faces.new((rim[j], rim[i], core)); f.material_index = idk
    for f in t.faces: f.smooth = True
    me = bpy.data.meshes.new("_tier"); t.to_mesh(me); t.free(); b.bm.from_mesh(me); bpy.data.meshes.remove(me)

def fir(b):
    """A fir: a straight trunk showing below the lowest tier, four tiers of drooping skirts, narrowing to a point."""
    ms = leafset("fir", "firLeaf", "firLeafHi", "firLeafLo")
    trunk(b, 2.6, 0.2, bark("fir"), roots=3, seg=10)
    for z, r, h in ((1.45, 1.45, 1.3), (2.35, 1.15, 1.15), (3.2, 0.85, 1.0), (3.95, 0.55, 0.95)):
        tier(b, z, r, h, ms, n=9 if r > 1 else 7)

CHERRY = [((0, 0, 3.0), 1.45, (1.25, 1.25, 0.7)), ((1.4, 0.3, 2.7), 0.95, (1, 1, 0.75)), ((-1.35, 0.35, 2.75), 1.0, (1, 1, 0.75)),
          ((0.15, -1.35, 2.7), 0.95, (1, 1, 0.75)), ((0.0, 1.3, 2.8), 0.95, (1, 1, 0.75)), ((0.4, -0.2, 3.65), 0.95, (1, 1, 0.8))]
def cherry(b):
    """A flowering cherry: smooth reddish bark ringed with pale lenticels, the trunk opening low into a vase of limbs,
    a wide flat crown of pink blossom in clusters, a few pale ones."""
    m = bark("cherry")
    trunk(b, 1.5, 0.26, m)
    boughs(b, (0, 0, 1.35), [(1.3, 0.25, 2.45), (-1.25, 0.3, 2.5), (0.15, -1.25, 2.45), (0.0, 1.2, 2.55), (0.3, -0.1, 3.0)], 0.15, m)
    kgreen.puff(b, [bl + (SEG_T,) for bl in CHERRY], "blossom")
    picks = [(0, (0.4, -0.7, 0.5)), (0, (-0.6, -0.5, 0.45)), (1, (0.7, -0.5, 0.2)), (2, (-0.7, -0.4, 0.3)), (3, (0.3, -0.9, 0.1)), (4, (0.4, 0.8, 0.3)),
             (5, (0.2, -0.6, 0.7)), (1, (0.6, 0.6, 0.1)), (2, (-0.6, 0.5, 0.2)), (3, (-0.5, -0.7, -0.2)), (0, (0.6, 0.4, 0.6))]
    for k, (li, d) in enumerate(picks):          # clusters of five-petal flowers on the crown
        c, rr = Vector(CHERRY[li][0]), CHERRY[li][1]; s = Vector(CHERRY[li][2]); dv = Vector(d).normalized()
        p = c + Vector((dv.x * rr * s.x, dv.y * rr * s.y, dv.z * rr * s.z)) * 1.0
        for q in range(2):
            pq = p + Vector((0.12 * cos(q * 2.1 + k), 0.12 * sin(q * 2.1 + k), 0.03 * q))
            col = "white" if (k + q) % 4 == 0 else "blossomHi"
            for j in range(5): leaf(b, pq, tau * j / 5 + k, 0.09, 0.07, col, lift=0.35, droop=0.15, cup=0.25, shape="round", segs=(2, 2), thick=0.006)
            b.ball(0.025, tuple(pq + Vector((0, 0, 0.02))), "rose", u=6, v=4)
    for x, y in ((0.9, -1.8), (-1.3, -1.2), (0.3, -2.2), (1.6, -0.4)):       # petals fallen on the grass
        leaf(b, (x, y, 0.012), x * 3, 0.06, 0.05, "blossomHi", lift=0.0, droop=0.0, cup=0.15, shape="round", segs=(2, 2), thick=0.004)

# ---------------------------------------------------------------- shrubs and ground growth
SHRUBS = {
    "A": [((0, 0, 0.42), 0.7, (1, 1, 0.82), (16, 9)), ((0.62, 0.15, 0.32), 0.5, (1, 1, 0.82), (12, 8)), ((-0.58, 0.2, 0.34), 0.52, (1, 1, 0.82), (12, 8))],
    "B": [((0, 0, 0.56), 0.6, (1, 1, 1.05), (16, 9)), ((0.48, -0.3, 0.3), 0.48, (1, 1, 0.9), (12, 8)), ((-0.45, -0.2, 0.28), 0.45, (1, 1, 0.9), (12, 8))],
}
def shrub(b, kind="A", tint="classic", berries=None):
    """A wild shrub. With `berries`, a flowering one: small round clusters of tiny flowers, as a wild rose or a
    hydrangea carries them, not single dots."""
    kgreen.puff(b, SHRUBS[kind], tint, floor=0.0)
    if berries:
        for x, y, z in (((0.3, -0.52, 0.64), (-0.55, -0.3, 0.54), (0.74, -0.14, 0.52), (0.0, -0.2, 0.95)) if kind == "A" else ((0.25, -0.44, 0.88), (-0.52, -0.48, 0.42))):
            for q in range(3): b.ball(0.05, (x + 0.05 * cos(q * 2.1), y + 0.05 * sin(q * 2.1), z + 0.02 * (q % 2)), berries if q else berries + "_lt", u=6, v=4)

def bush(name):
    b = TB()
    kgreen.puff(b, [((0, 0, 0.45), 0.78, (1, 1, 0.8), (16, 10)), ((0.72, 0.1, 0.36), 0.56, (1, 1, 0.8), (12, 8)), ((-0.66, -0.12, 0.38), 0.6, (1, 1, 0.8), (12, 8))], "classic", floor=0.0)
    for (x, y, z), pc in (((0.15, -0.5, 0.9), "pink"), ((-0.6, -0.42, 0.66), "white"), ((0.84, -0.28, 0.6), "pink"), ((-0.1, -0.68, 0.5), "white")):
        for q in range(4): b.ball(0.05, (x + 0.055 * cos(q * 1.7), y + 0.055 * sin(q * 1.7), z + 0.02 * (q % 2)), pc, u=8, v=5)
        b.ball(0.02, (x, y - 0.03, z + 0.05), "gold", u=6, v=4)
    return kit(name, b, 62)

def fern(b):
    """A fern: a rosette of arching fronds from one crown. Each frond is a stalk with paired leaflets (pinnae) that get
    smaller towards the tip; in the middle a new frond is still coiled (a fiddlehead)."""
    ms = ("canopyDeep", "canopy", "canopyDeepHi")
    for i in range(7):
        a = tau * i / 7 + 0.2; d = Vector((cos(a), sin(a), 0)); L = 0.66 + 0.08 * (i % 2); m = ms[i % 3]
        P = lambda v, d=d, L=L: Vector((0, 0, 0.02)) + d * (L * v) + Vector((0, 0, L * (1.3 * v - 1.05 * v * v)))
        tube(b, [P(0), P(0.35), P(0.7), P(1.0)], [0.016, 0.013, 0.009, 0.005], "canopyDeepLo", seg=4)
        for j in range(5):
            v = 0.24 + 0.15 * j; k = 1 - 0.75 * (v - 0.22) / 0.78
            for s in (-1, 1): leaf(b, P(v), a + s * 1.2, 0.21 * k + 0.04, 0.075 * k + 0.02, m, lift=0.05, droop=0.35, cup=0.12, shape="point", segs=(2, 1), thick=0.006)
        leaf(b, P(1.0), a, 0.08, 0.03, m, lift=-0.3, droop=0.2, cup=0.1, shape="point", segs=(3, 1), thick=0.006)
    pts = [Vector((0, 0, 0.02)), Vector((0.02, 0, 0.18)), Vector((0.04, 0, 0.3))]                        # the fiddlehead
    for k in range(9): t = k * 0.7; rr = 0.07 * (1 - k / 11); pts.append(Vector((0.04 + rr * sin(t), 0, 0.3 + 0.07 - rr * cos(t))))
    tube(b, pts, [0.018] * 3 + [0.017 - 0.0012 * k for k in range(9)], "canopyHi", seg=5)

def mushrooms(b):
    """Three toadstools: a brown bun-capped one, a cream one and a small red one flecked with white. Each has pale gills
    under its cap, a stem a little thicker at the foot, and the red one a ring on its stem."""
    for x, y, r, h, m, kind in ((0, 0, 0.17, 0.24, "trunk", "bun"), (0.27, 0.1, 0.12, 0.17, "sand", "flat"), (-0.22, -0.16, 0.1, 0.15, "red", "red")):
        b.lathe([(r * 0.42, 0), (r * 0.36, h * 0.3), (r * 0.3, h)], (x, y, 0), mats=["cream", "cream"], seg=10)
        cap = [(r * 0.3, 0.0), (r, r * 0.06), (r * 1.02, r * 0.22), (r * 0.8, r * 0.55), (r * 0.4, r * (0.8 if kind == "bun" else 0.65)), (0, r * (0.85 if kind == "bun" else 0.7))]
        b.lathe(cap, (x, y, h - 0.02), mats=["cream_dk", m, m, m, m + "_lt"], seg=14)
        if kind == "red":
            b.lathe([(r * 0.31, 0), (r * 0.5, -0.03), (r * 0.48, -0.035)], (x, y, h * 0.7), mats=["white", "white"], seg=10)
            for k in range(7):
                a = tau * k / 7 + 0.3; e = 0.55 if k % 2 else 0.3
                p = Vector((x + r * 0.85 * cos(a) * (0.6 + e * 0.4), y + r * 0.85 * sin(a) * (0.6 + e * 0.4), h - 0.02 + r * 0.5 + 0.02))
                b.ball(0.016, tuple(p), "white", sc=(1, 1, 0.5), u=6, v=4)
            b.ball(0.02, (x, y, h - 0.02 + r * 0.72), "white", sc=(1, 1, 0.5), u=6, v=4)

def log(b):
    """A fallen log: bark along its length, end grain in rings, a stub where a branch was, moss and a shelf fungus."""
    m = bark(); L = 1.7; z = 0.24
    b.lathe([(0.26, 0), (0.26, L)], (-0.85, 0, z), mats=[m], seg=14, rot=(0, pi / 2, 0), cap=False)
    for sx in (-1, 1):                                                                  # the cut ends, in rings
        b.lathe([(0.26, 0), (0.18, 0), (0.1, 0), (0.035, 0), (0, 0)], (0.85 * sx, 0, z), mats=["trunk_light", "sand", "trunk_light", "trunk"], seg=14, rot=(0, sx * pi / 2, 0), cap=False)
    b.cyl(0.085, 0.24, (0.3, 0.0, 0.36), m, seg=7, r2=0.07, rot=(-0.9, 0, 0)); b.cyl(0.06, 0.012, (0.3, 0.19, 0.51), "trunk_light", seg=7, rot=(-0.9, 0, 0))
    kgreen.puff(b, [((-0.3, 0.02, 0.44), 0.27, (1.5, 0.9, 0.5), (12, 7))], "warm", shade=False, rings=(2, 0))
    for k, (x, zz) in enumerate(((0.45, 0.28), (0.6, 0.2))):
        b.lathe([(0.0, 0.0), (0.09 - 0.02 * k, 0.005), (0.08 - 0.02 * k, 0.025), (0.0, 0.03)], (x, -0.25, zz), mats=["sand", "terracotta", "terracotta_lt"], seg=10, rot=(0, 0, 0))

def stump(b):
    """A stump: bark round the side, its cut top in rings, roots flaring out into the grass, moss at its foot."""
    m = bark()
    b.lathe([(0.34, 0), (0.31, 0.12), (0.3, 0.44)], mats=[m, m], seg=14, cap=False)
    b.lathe([(0.3, 0), (0.22, 0), (0.13, 0), (0.05, 0), (0, 0)], (0, 0, 0.44), mats=["trunk_light", "sand", "trunk_light", "trunk"], seg=14, cap=False)
    for i in range(5):
        a = tau * i / 5 + 0.3; c, s = cos(a), sin(a)
        b.tube([(0.24 * c, 0.24 * s, 0.14), (0.42 * c, 0.42 * s, 0.05), (0.56 * c, 0.56 * s, -0.04)], [0.1, 0.07, 0.03], m, seg=6)
    kgreen.puff(b, [((0.24, -0.2, 0.12), 0.18, (1, 1, 0.7), (12, 7))], "warm", shade=False, floor=0.0)

def wild_flower(name, petal, core):
    """A wild flower: five broad petals round a domed middle on a slender stem, two blade leaves at its foot."""
    b = TB(); h = 0.62
    b.tube([(0, 0, 0), (0.03, 0, h * 0.5), (0, 0, h)], [0.022, 0.02, 0.018], "leaf_dark", seg=5)
    for a in (0.6, 0.6 + pi): leaf(b, (0, 0, 0.04), a, 0.24, 0.07, "leaf_light", lift=0.9, droop=0.9, cup=0.3, shape="point", segs=(3, 1))
    leaf(b, (0.012, 0, h * 0.45), 2.2, 0.14, 0.05, "leaf_light", lift=0.4, droop=0.5, cup=0.25, shape="point", segs=(3, 1))
    for k in range(5): leaf(b, (0, 0, h + 0.015), tau * k / 5 + 0.3, 0.17, 0.13, petal, lift=0.22, droop=0.15, cup=0.25, shape="round", segs=(4, 3), thick=0.008)
    b.lathe([(0.065, 0.0), (0.06, 0.025), (0.035, 0.045), (0.0, 0.05)], (0, 0, h + 0.012), mats=[core, core, core + "_lt"], seg=12)
    return kit(name, b)
