"""Crops and garden flowers, third look (20 Oct 2026, after Claire's review in the game). Built from how each plant
really grows and looks (see the plan doc, "The plant kit, third look"), kept chunky and round for the Mario look.
  - Leaves are real blades (leaf(): a two-sided curved surface with a width profile), not squashed balls: a tomato's
    leaf is compound with toothed leaflets, a strawberry's has three round leaflets, a pumpkin's is lobed, a corn
    leaf is a long arching strap, a tulip's is broad and blue-green, lavender's narrow and grey-green.
  - Where a plant is known by its surface it has a small painted texture: corn kernels in rows, the husk's streaks,
    strawberry seeds, cabbage veins, carrot rings, the sunflower's seed disc.
  - Every stage keeps its name and its origin (the middle of its soil, on the ground). Nothing of a plant stands
    below its soil mound except the root it grows from, and that never lower than 6 cm.
  - Petals the player recolours stay on KI_petalA (petals) and KI_petalB (the flower's centre), untextured.
Import after kk; reload on every pass run."""
import bpy, bmesh
import numpy as np
from math import sin, cos, pi, tau, sqrt, atan2
from mathutils import Vector, Matrix
import gk
from kk import *
import kgreen

# ---------------------------------------------------------------- materials
def plain(name, rough=0.85):
    """A palette colour as a matt plant material."""
    m = M(name)
    if not m.get("kc_matt"):
        p = m.node_tree.nodes.get("Principled BSDF") if m.use_nodes else None
        if p: p.inputs["Roughness"].default_value = rough
        m.roughness = rough; m["kc_matt"] = 1
    return m

def painted(name, arr, tile, rough=0.8, gloss=None):
    """KI_<name>: a small tiling picture, `tile` metres to a repeat (box_uv lays it on)."""
    m = bpy.data.materials.get("KI_" + name)
    img = gk._img("ki_crop_" + name, arr)
    if m is None:
        m = gk.mat(name, "#FFFFFF", rough=rough if gloss is None else gloss, tex=img, tile=tile); m.name = "KI_" + name
    else:
        n = m.node_tree.nodes.get("GMTex")
        if n: n.image = img
        m["gm_tile"] = tile
    m.diffuse_color = (*[float(x) for x in (arr.reshape(-1, 3).mean(0) ** 2.2)], 1)
    return m

def _rgb(h): return np.array(gk.srgb(h), np.float32)

def tex_kernels(size=64, n=8):
    """Corn kernels in rows along the cob: rounded, a light middle, a darker gap round each."""
    a = np.zeros((size, size, 3), np.float32); c = size // n; base, hi, gap = _rgb("#FFD23A"), _rgb("#FFE98A"), _rgb("#C98A1E")
    yy, xx = np.mgrid[0:c, 0:c]; d = np.maximum(abs(xx - (c - 1) / 2), abs(yy - (c - 1) / 2)) / (c / 2)
    r = np.sqrt(((xx - (c - 1) / 2) / (c / 2)) ** 2 + ((yy - (c - 1) / 2) / (c / 2)) ** 2)
    cell = np.where((d > 0.86)[..., None], gap, np.where((r < 0.45)[..., None], hi, base))
    for j in range(n):
        for i in range(n):
            off = (c // 2) if i % 2 else 0
            y0 = (j * c + off) % size; ys = (np.arange(c) + y0) % size
            a[np.ix_(ys, np.arange(i * c, (i + 1) * c))] = cell
    return a

def tex_husk(size=32):
    a = np.tile(_rgb("#79C04A"), (size, size, 1))
    for x in range(0, size, 4): a[:, x] = _rgb("#A6DB72")
    for x in range(2, size, 8): a[:, x] = _rgb("#5EA63C")
    return a

def tex_seeds(base, seed, size=32, step=8):
    """A fruit with seeds on its skin (strawberry): small dots in a staggered grid."""
    a = np.tile(_rgb(base), (size, size, 1))
    for j in range(0, size, step):
        for i in range(0, size, step):
            x = (i + (step // 2 if (j // step) % 2 else 0)) % size
            a[j:j + 2, x:x + 2] = _rgb(seed)
    return a

def tex_veins(base, vein, size=64):
    """A leaf with a pale midrib and side veins running up from it (cabbage)."""
    a = np.tile(_rgb(base), (size, size, 1)); v = _rgb(vein); m = size // 2
    a[:, m - 2:m + 2] = v
    for y0 in range(4, size + size, 12):
        for k in range(size // 2):
            for s in (-1, 1):
                x = m + s * k; y = (y0 - k) % size
                if 0 <= x < size: a[y, x] = v
    return a

def tex_rings(base, ring, size=32, step=6):
    a = np.tile(_rgb(base), (size, size, 1))
    for y in range(0, size, step): a[y] = _rgb(ring)
    return a

def tex_disc(size=64):
    """A sunflower's seed disc: rows of seeds, dark brown with lighter rims."""
    a = np.tile(_rgb("#5A3418"), (size, size, 1)); s = 6
    for j in range(0, size, s):
        for i in range(0, size, s):
            x = (i + (s // 2 if (j // s) % 2 else 0)) % size
            a[j:j + 3, x:x + 3] = _rgb("#8A5A2A"); a[j + 1, (x + 1) % size] = _rgb("#B07A3A")
    return a

def mats():
    """Everything the crops are painted with, made once."""
    T = {}
    T["kernel"] = painted("cornKernel", tex_kernels(), 0.09, gloss=0.45)
    T["husk"] = painted("cornHusk", tex_husk(), 0.16)
    T["berry"] = painted("strawberrySkin", tex_seeds("#E8302A", "#FFE27A"), 0.07, gloss=0.4)
    T["cabbageOuter"] = painted("cabbageOuter", tex_veins("#6FB07E", "#94CBA0"), 0.32)
    T["cabbageHead"] = painted("cabbageHead", tex_veins("#B9E68A", "#D2EFAC"), 0.22)
    T["carrot"] = painted("carrotRoot", tex_rings("#F27A1C", "#D8621A"), 0.08)
    T["disc"] = painted("sunDisc", tex_disc(), 0.12)
    return T

# ---------------------------------------------------------------- shapes
def _add(b, t, m):
    """Adds bmesh t to builder b in material m, as it is (no recalculated normals: two-sided blades keep both sides)."""
    i = b.mi(m)
    for f in t.faces: f.material_index = i; f.smooth = True
    me = bpy.data.meshes.new("_kc"); t.to_mesh(me); t.free(); b.bm.from_mesh(me); bpy.data.meshes.remove(me)

def surface(b, f, nu, nv, m, thick=0.008):
    """A two-sided surface from f(u, v) -> Vector, u and v in [0, 1]. The top side faces where f's (dv x du) points."""
    t = bmesh.new(); top = []; bot = []
    def normal(u, v):
        e = 1e-3
        du = f(min(1, u + e), v) - f(max(0, u - e), v); dv = f(u, min(1, v + e)) - f(u, max(0, v - e))
        n = dv.cross(du); return n.normalized() if n.length > 1e-9 else Vector((0, 0, 1))
    for j in range(nv + 1):
        rt = []; rb = []
        for i in range(nu + 1):
            u, v = i / nu, j / nv; p = f(u, v); n = normal(u, v)
            rt.append(t.verts.new(p + n * thick * 0.5)); rb.append(t.verts.new(p - n * thick * 0.5))
        top.append(rt); bot.append(rb)
    for j in range(nv):
        for i in range(nu):
            t.faces.new((top[j][i], top[j + 1][i], top[j + 1][i + 1], top[j][i + 1]))
            t.faces.new((bot[j][i], bot[j][i + 1], bot[j + 1][i + 1], bot[j + 1][i]))
    # close the rim, so a blade seen edge-on is not a hairline gap
    rim = [(top[0][i], bot[0][i]) for i in range(nu + 1)] + [(top[j][nu], bot[j][nu]) for j in range(1, nv + 1)] + \
          [(top[nv][i], bot[nv][i]) for i in range(nu - 1, -1, -1)] + [(top[j][0], bot[j][0]) for j in range(nv - 1, 0, -1)]
    for k in range(len(rim)):
        (a1, b1), (a2, b2) = rim[k], rim[(k + 1) % len(rim)]
        try: t.faces.new((a1, a2, b2, b1))
        except ValueError: pass
    _add(b, t, m)

PROFILE = {
    "oval":  lambda v: sin(pi * min(1.0, max(0.0, v))) ** 0.8,
    "point": lambda v: (sin(pi * min(1.0, v ** 0.8)) ** 0.7),
    "strap": lambda v: min(1.0, v * 7) * (1 - v) ** 0.45,
    "heart": lambda v: sin(pi * (0.18 + 0.82 * v)) ** 0.55 * min(1.0, v * 6 + 0.35),
    "round": lambda v: sin(pi * v) ** 0.45,
    "spoon": lambda v: sin(pi * v ** 1.5) ** 0.6,
}
def leaf(b, base, a, L, W, m, lift=0.3, droop=0.5, cup=0.25, shape="oval", teeth=0, segs=(4, 3), thick=0.008, mtx=None, pitch=0.0):
    """A leaf blade from `base` towards angle a (about Z): L long, W wide at its widest. lift: how fast it rises (z per
    length); droop: how much its tip falls; cup: how far its edges rise (a hollow leaf). teeth: a toothed edge.
    mtx: a frame to build it in (a corn ear's husk). pitch: turns the blade's face towards the up axis."""
    base = Vector(base); d = Vector((cos(a), sin(a), 0)); side = Vector((-sin(a), cos(a), 0)); up = Vector((0, 0, 1))
    prof = PROFILE[shape]
    def f(u, v):
        w = W * prof(v)
        if teeth: w *= 1 - 0.16 * abs(sin(teeth * pi * v))
        s = (u * 2 - 1)
        p = base + d * (L * v) + up * (L * (lift * v - droop * v * v)) + side * (w * s * cos(pitch)) + up * (cup * w * s * s + w * s * sin(pitch))
        return mtx @ p if mtx is not None else p
    surface(b, f, segs[1], segs[0], m, thick)

def tube(b, pts, r, m, seg=5, mtx=None):
    if mtx is not None: pts = [mtx @ Vector(p) for p in pts]
    b.tube([tuple(p) for p in pts], r, m, seg=seg)

def star(b, loc, r, n, m, lift=0.1, droop=0.25, W=None, mtx=None, a0=0.0):
    """A ring of small pointed leaves round a point: a tomato's calyx, a strawberry's, a sunflower's bracts."""
    for k in range(n):
        leaf(b, loc, a0 + tau * k / n, r, W or r * 0.42, m, lift=lift, droop=droop, cup=0.1, shape="point", segs=(3, 2), thick=0.005, mtx=mtx)

def compound(b, base, a, L, m, pairs=2, lift=0.45, droop=0.7, teeth=5, stalk="green"):
    """A compound leaf (tomato, rose): a stalk with pairs of toothed leaflets and one at its tip."""
    base = Vector(base); d = Vector((cos(a), sin(a), 0))
    P = lambda v: base + d * (L * v) + Vector((0, 0, L * (lift * v - droop * v * v)))
    tube(b, [P(0), P(0.5), P(1.0)], [0.012, 0.01, 0.006], stalk, seg=4)
    for k in range(pairs):
        v = 0.35 + 0.5 * k / max(1, pairs)
        for s in (-1, 1): leaf(b, P(v), a + s * 1.05, L * 0.36, L * 0.15, m, lift=0.15, droop=0.35, cup=0.2, teeth=teeth, segs=(4, 2))
    leaf(b, P(1.0) - d * 0.01, a, L * 0.4, L * 0.16, m, lift=-0.2, droop=0.2, cup=0.2, teeth=teeth, segs=(4, 2))

def trifoliate(b, base, a, L, m, lift=1.4, droop=1.0, size=1.0):
    """A strawberry leaf: a stalk up and out, three round toothed leaflets at its top."""
    base = Vector(base); d = Vector((cos(a), sin(a), 0))
    tip = base + d * (L * 0.55) + Vector((0, 0, L * (lift * 0.55 - droop * 0.3)))
    tube(b, [base, base + d * L * 0.25 + Vector((0, 0, L * 0.5)), tip], [0.012, 0.01, 0.008], "cropStalk", seg=4)
    for s in (-0.75, 0.0, 0.75): leaf(b, tip, a + s, 0.13 * size, 0.09 * size, m, lift=0.05, droop=0.3, cup=0.25, shape="round", teeth=4, segs=(4, 3))

def palmate(b, base, a, L, m, lobes=5, size=1.0, height=0.25):
    """A pumpkin leaf: a long hollow stalk, then a broad leaf of five lobes, held nearly flat."""
    base = Vector(base); d = Vector((cos(a), sin(a), 0))
    tip = base + d * L + Vector((0, 0, height))
    tube(b, [base, base + d * L * 0.5 + Vector((0, 0, height * 1.2)), tip], [0.018, 0.015, 0.012], "cropStalk", seg=5)
    for k in range(lobes):
        s = (k - (lobes - 1) / 2) / ((lobes - 1) / 2)
        leaf(b, tip, a + s * 1.15, (0.2 - 0.05 * abs(s)) * size, 0.12 * size, m, lift=0.05, droop=0.25, cup=0.15, teeth=3, segs=(4, 3))

def trumpet(b, loc, r, m="pumpkinFlower", up=Vector((0, 0, 1))):
    """A squash flower: a cup flaring into five points."""
    b.lathe([(0.0, 0.0), (r * 0.25, 0.0), (r * 0.45, r * 0.9), (r * 0.9, r * 1.35), (r * 1.05, r * 1.45)], tuple(loc), mats=[m, m, m, m], seg=10)
    star(b, Vector(loc) + Vector((0, 0, r * 1.35)), r * 0.55, 5, m, lift=0.4, droop=0.2, W=r * 0.5)

def soil(b, r=0.42):
    b.lathe([(r, 0), (r * 0.93, 0.035), (0, 0.045)], m="soil", seg=12)

def _frame(origin, axis, spin=0.0):
    """A frame whose Z runs along `axis`, at `origin`."""
    z = Vector(axis).normalized(); q = Vector((0, 0, 1)).rotation_difference(z)
    return Matrix.Translation(Vector(origin)) @ q.to_matrix().to_4x4() @ Matrix.Rotation(spin, 4, "Z")

# ---------------------------------------------------------------- crops
def carrot(name, stage=4):
    """Feathery fronds from the crown; when ripe the orange shoulder shows above the soil, ringed, a little green on top.
    Stage 2: two or three young fronds. Stage 3: a full tuft. Stage 4: tall tuft and the shoulder."""
    T = mats(); b = B(); soil(b)
    if stage == 4:
        b.lathe([(0.0, -0.06), (0.08, -0.06), (0.1, 0.0), (0.104, 0.07), (0.08, 0.115), (0.0, 0.12)], m=T["carrot"], seg=14)
        b.lathe([(0.06, 0.112), (0.04, 0.126), (0.0, 0.128)], m="carrotTop", seg=12)
    n = {2: 3, 3: 6, 4: 8}[stage]; k = {2: 0.5, 3: 0.85, 4: 1.0}[stage]; z0 = 0.12 if stage == 4 else 0.04
    for i in range(n):
        a = tau * i / n + 0.4; L = (0.34 + 0.06 * (i % 3)) * k; d = Vector((cos(a), sin(a), 0))
        P = lambda v: Vector((0, 0, z0)) + d * (L * 0.45 * v) + Vector((0, 0, L * (1.0 * v - 0.25 * v * v)))
        tube(b, [P(0), P(0.5), P(1.0)], [0.009, 0.007, 0.004], "carrotLeaf", seg=4)
        for j in range(3):
            v = 0.4 + 0.2 * j
            for s in (-1, 1): leaf(b, P(v), a + s * 1.2, L * 0.24, L * 0.07, "carrotLeaf", lift=0.6, droop=0.3, cup=0.1, teeth=3, segs=(3, 1), thick=0.004)
        leaf(b, P(1.0), a, L * 0.22, L * 0.07, "carrotLeaf", lift=0.8, droop=0.4, cup=0.1, teeth=3, segs=(3, 1), thick=0.004)
    return kit(name, b, 62)

def _head(b, R, m, layers=4, rot=0.3):
    """A cabbage head: a firm ball wrapped in overlapping leaves, each a cupped shell a little bigger than the one under."""
    T = mats()
    b.ball(R * 0.97, (0, 0, R * 0.95), T["cabbageHead"], sc=(1, 1, 0.92), u=12, v=8)
    c = R * 0.95
    for k in range(layers):
        r = R * (1.0 + 0.04 * k); th0 = rot + k * 2.1; span = 2.5 - 0.15 * k
        ph1 = 0.12 + 0.14 * k                                                        # how far over the top this leaf reaches
        def f(u, v, r=r, th0=th0, span=span, ph1=ph1):
            th = th0 + (u - 0.5) * span * (0.55 + 0.45 * sin(pi * min(1, v * 1.4)))
            ph = pi * 0.82 - v * (pi * 0.82 - ph1)                                   # from under the ball up over its top
            rr = r * (1 + 0.07 * v ** 3)                                             # the leaf's edge lifts a little off the head
            return Vector((rr * sin(ph) * cos(th), rr * sin(ph) * sin(th), c + rr * 0.92 * cos(ph)))
        surface(b, f, 6, 6, T["cabbageHead"], 0.008)

def cabbage(name, stage=4):
    """Broad blue-green wrapper leaves with pale veins, cupped up round a pale, tight head of overlapping leaves.
    Stage 2: a young rosette. Stage 3: a bigger rosette with a small head forming. Stage 4: the full head."""
    T = mats(); b = B(); soil(b)
    if stage == 2:
        for i in range(5): leaf(b, (0, 0, 0.04), tau * i / 5 + 0.3, 0.17, 0.1, T["cabbageOuter"], lift=0.5, droop=0.5, cup=0.35, shape="round", segs=(4, 3))
        return kit(name, b, 62)
    k = 0.8 if stage == 3 else 1.0; R = 0.11 if stage == 3 else 0.17
    for i in range(7):
        a = tau * i / 7 + 0.2; L = (0.3 + 0.03 * (i % 2)) * k
        leaf(b, (0.03 * cos(a), 0.03 * sin(a), 0.04), a, L, 0.2 * k, T["cabbageOuter"], lift=0.95, droop=0.95, cup=0.45, shape="round", teeth=0, segs=(6, 5))
    _head(b, R, None, layers=3 if stage == 3 else 4)
    return kit(name, b, 62)

def tomato(name, stage=4):
    """A tomato plant tied to its stake: a green stem, compound leaves of toothed leaflets, yellow star flowers in small
    clusters, then trusses of round fruit with a green star calyx. Stage 2: a young plant. Stage 3: tall, in flower,
    small green fruit. Stage 4: trusses ripening, red with one turning orange."""
    b = B(); soil(b)
    H = {2: 0.35, 3: 0.82, 4: 0.95}[stage]
    b.cyl(0.022, H + 0.12, (0.07, 0.04, 0.02), "wood", seg=6)                       # the stake, its foot inside the mound
    stem = [(0, 0, 0.0), (0.02, -0.01, H * 0.35), (0.035, 0.02, H * 0.7), (0.04, 0.01, H)]
    b.tube(stem, [0.02, 0.018, 0.015, 0.01], "cropStalk", seg=5)
    if stage >= 3:
        for z in (H * 0.3, H * 0.65): b.cyl(0.03, 0.02, (0.055, 0.025, z), "rope", seg=8)    # ties to the stake
    n = {2: 4, 3: 10, 4: 11}[stage]
    for i in range(n):
        v = 0.12 + 0.8 * i / max(1, n - 1); a = 1.1 + 2.4 * i; z = H * v
        compound(b, (0.03 * v, 0.0, z), a, (0.24 if stage == 2 else 0.36) * (1.1 - 0.35 * v), "cropLeaf", pairs=3, lift=0.35, droop=0.8, stalk="cropStalk")
    if stage == 2: return kit(name, b, 62)
    def truss(at, a, fruits, colours, flowers=0):
        at = Vector(at); d = Vector((cos(a), sin(a), 0)); end = at + d * 0.12 + Vector((0, 0, -0.03))
        tube(b, [at, at + d * 0.05 + Vector((0, 0, 0.01)), end], 0.007, "cropStalk", seg=4)
        for j in range(fruits):
            aa = a + (j - (fruits - 1) / 2) * 0.9; p = end + Vector((cos(aa) * 0.065, sin(aa) * 0.065, -0.08 - 0.03 * (j % 2)))
            r = 0.068 if colours[j % len(colours)] != "tomatoGreen" else 0.05
            tube(b, [end, p + Vector((0, 0, r * 0.95))], 0.005, "cropStalk", seg=3)
            b.ball(r, (p.x, p.y, p.z), colours[j % len(colours)], sc=(1, 1, 0.86), u=12, v=8)
            star(b, p + Vector((0, 0, r * 0.82)), r * 0.7, 5, "cropLeaf", lift=0.05, droop=0.35)
        for j in range(flowers):
            aa = a + 1.6 + j * 0.8; p = end + Vector((cos(aa) * 0.05, sin(aa) * 0.05, 0.0))
            star(b, p, 0.042, 5, "tomatoFlower", lift=0.0, droop=0.1, W=0.02)
            b.cyl(0.009, 0.018, (p.x, p.y, p.z - 0.004), "starYellow", seg=5)
    if stage == 3:
        for z, a, f in ((0.45, 0.2, 2), (0.62, 3.3, 1), (0.78, 1.7, 0)): truss((0.035, 0.0, H * z), a, f, ["tomatoGreen"], flowers=3 - f)
    else:
        for z, a, cols in ((0.36, 0.3, ["tomatoRed", "tomatoRed", "tomatoRed"]), (0.56, 3.4, ["tomatoRed", "tomatoOrange"]), (0.74, 1.8, ["tomatoRed", "tomatoRed", "tomatoGreen"])):
            truss((0.035, 0.0, H * z), a, len(cols), cols)
    return kit(name, b, 62)

def _ear(b, base, axis, length=0.26, open_=0.35):
    """A corn ear on its shank: a cob of kernels in rows, husk leaves wrapped round it and opened at the top, and a
    tuft of silk at the tip."""
    T = mats(); F = _frame(base, axis); r = 0.06
    tube(b, [Vector((0, 0, -0.04)), Vector((0, 0, 0.02))], 0.016, "cropStalk", seg=5, mtx=F)       # the shank
    prof = [(0.0, 0.0)]
    for i in range(8):
        v = i / 7; prof.append((r * (0.75 + 0.25 * sin(pi * min(1, v * 1.3))) * (1 - 0.35 * v ** 3), 0.02 + length * v))
    prof.append((0.0, 0.02 + length + 0.008))
    eul = F.to_euler(); b.lathe(prof, tuple(F.translation), mats=[T["kernel"]] * (len(prof) - 1), seg=12, rot=(eul.x, eul.y, eul.z))
    for k in range(4):                                                                        # husk leaves: tight below, peeled back above
        a = tau * k / 4 + 0.4
        def f(u, v, a=a):
            th = a + (u - 0.5) * 1.9; z = 0.0 + length * 0.92 * v; peel = open_ * max(0.0, v - 0.55) / 0.45
            rr = r * 1.08 + 0.01 + peel * 0.07; return F @ Vector((rr * cos(th), rr * sin(th), z - peel * 0.02))
        surface(b, f, 3, 4, T["husk"], 0.006)
    tip = Vector((0, 0, 0.02 + length))
    for k in range(6):
        a = tau * k / 6
        tube(b, [tip, tip + Vector((cos(a) * 0.02, sin(a) * 0.02, 0.04)), tip + Vector((cos(a) * 0.05, sin(a) * 0.05, 0.05))], [0.006, 0.005, 0.003], "cornSilk", seg=3, mtx=F)

def corn(name, stage=4):
    """A corn plant: a jointed stalk, long arching leaves on alternate sides, a branched tassel on top and the ear about
    half way up in its husk with silk at the tip. Stage 2: a young whorl of leaves. Stage 3: tall, the tassel and a
    young ear with pale silk. Stage 4: full height, the ear's husk opened to show its kernels."""
    T = mats(); b = B(); soil(b)
    if stage == 2:
        b.tube([(0, 0, 0), (0, 0, 0.18)], [0.02, 0.015], "cornStalk", seg=5)
        for i in range(4): leaf(b, (0, 0, 0.05 + 0.04 * i), 0.5 + pi * i + 0.4 * i, 0.32, 0.045, "cornLeaf", lift=1.6, droop=1.5, cup=0.3, shape="strap", segs=(5, 2))
        return kit(name, b, 62)
    H = 1.25 if stage == 3 else 1.55
    b.tube([(0, 0, -0.02), (0.01, 0, H * 0.5), (0, 0.01, H)], [0.032, 0.026, 0.018], "cornStalk", seg=6)
    for a in (0.3, 2.4, 4.5): b.tube([(0, 0, 0.12), (0.05 * cos(a), 0.05 * sin(a), 0.05), (0.08 * cos(a), 0.08 * sin(a), 0.0)], [0.012, 0.01, 0.008], "cornStalk", seg=4)   # brace roots
    nl = 7 if stage == 3 else 9
    for i in range(nl):
        v = 0.08 + 0.78 * i / (nl - 1); z = H * v; a = 0.6 + pi * i + 0.25 * i
        b.cyl(0.032, 0.025, (0, 0, z - 0.012), "cornJoint", seg=6)                     # the joint, where the leaf wraps the stalk
        leaf(b, (0.02 * cos(a), 0.02 * sin(a), z), a, 0.66 * (1.05 - 0.4 * v), 0.075, "cornLeaf", lift=0.9, droop=1.25, cup=0.3, shape="strap", segs=(6, 2))
    top = Vector((0, 0.01, H))
    tube(b, [top, top + Vector((0, 0, 0.22 if stage == 4 else 0.14))], [0.01, 0.005], "cornTassel", seg=4)
    for k in range(6 if stage == 4 else 4):
        a = tau * k / 6 + 0.3; z = top.z + 0.04 + 0.025 * (k % 3); L = 0.16 if stage == 4 else 0.1
        tube(b, [Vector((0, 0.01, z)), Vector((cos(a) * L * 0.5, 0.01 + sin(a) * L * 0.5, z + 0.05)), Vector((cos(a) * L, 0.01 + sin(a) * L, z - 0.04))], [0.006, 0.005, 0.003], "cornTassel", seg=3)
    ear_at = Vector((0.03, -0.02, H * 0.48)); axis = Vector((0.45, -0.5, 1.0))
    _ear(b, ear_at, axis, length=0.22 if stage == 3 else 0.32, open_=0.0 if stage == 3 else 0.45)
    return kit(name, b, 62)

def pumpkin(name, stage=4):
    """A pumpkin vine: lobed leaves on long hollow stalks, a curling tendril, yellow trumpet flowers, the fruit green at
    first and ribbed orange when ripe on a woody stem. Stage 2: leaves and a flower. Stage 3: a small green fruit.
    Stage 4: the ripe pumpkin."""
    from kplants import _pumpkin_body
    b = B(); soil(b)
    def tendril(at, a):
        at = Vector(at); pts = [at + Vector((cos(a + t * 0.9) * (0.04 - t * 0.004), sin(a + t * 0.9) * (0.04 - t * 0.004), 0.02 + t * 0.012)) for t in range(9)]
        b.tube([tuple(p) for p in pts], 0.005, "cropStalk", seg=3)
    if stage == 2:
        for a in (0.4, 2.5, 4.4): palmate(b, (0, 0, 0.03), a, 0.18, "pumpkinLeaf", size=0.85, height=0.16)
        trumpet(b, (0.12, -0.08, 0.04), 0.045); tendril((-0.12, -0.1, 0.04), 1.0)
    elif stage == 3:
        _pumpkin_body(b, 0.15, "pumpkinGreen", (0.04, -0.06, 0.02))
        b.tube([(0.04, -0.06, 0.24), (0.05, -0.06, 0.29)], [0.02, 0.016], "pumpkinStem", seg=6)
        for a in (1.0, 2.6, 4.1): palmate(b, (0, 0, 0.03), a, 0.26, "pumpkinLeaf", size=1.0, height=0.2)
        trumpet(b, (-0.22, 0.12, 0.04), 0.05); tendril((0.2, 0.15, 0.04), 2.0)
    else:
        _pumpkin_body(b, 0.3, "orange", (0, 0, 0))
        zt = 2 * 0.3 * 0.76 - 0.07
        b.tube([(0, 0, zt), (0.02, 0, zt + 0.08), (0.07, 0.01, zt + 0.14), (0.11, 0.02, zt + 0.13)], [0.045, 0.038, 0.03, 0.025], "pumpkinStem", seg=7)
        for a in (0.9, 3.7): palmate(b, (0.1 * cos(a), 0.1 * sin(a), 0.03), a, 0.32, "pumpkinLeaf", size=1.05, height=0.12)
        tendril((-0.3, 0.2, 0.03), 0.5)
    return kit(name, b, 62)

def _berry(b, at, h, ripe=True):
    """A strawberry hanging from its stalk: heart-shaped, seeds on its skin, a star of green sepals on top."""
    T = mats(); at = Vector(at); r = h * 0.62
    prof = [(0.0, -h), (r * 0.35, -h * 0.82), (r * 0.8, -h * 0.42), (r, -h * 0.08), (r * 0.82, h * 0.1), (0.0, h * 0.14)]
    m = T["berry"] if ripe else "strawberryUnripe"
    b.lathe(prof, tuple(at), mats=[m] * (len(prof) - 1), seg=10)
    star(b, at + Vector((0, 0, h * 0.13)), h * 0.55, 6, "cropLeaf", lift=0.1, droop=0.5, W=h * 0.22)

def strawberry(name, stage=4):
    """A low crown of three-leaflet leaves with toothed edges; white five-petal flowers with yellow middles; berries
    hanging over the edge, green-white first, then red with seeds. Stage 2: a young crown. Stage 3: in flower.
    Stage 4: berries (one still unripe)."""
    b = B(); soil(b)
    n = {2: 3, 3: 6, 4: 7}[stage]; s = 0.75 if stage == 2 else 1.0
    for i in range(n): trifoliate(b, (0, 0, 0.04), tau * i / n + 0.2, (0.26 if stage > 2 else 0.2), "cropLeaf", size=s)
    if stage == 3:
        for a in (0.9, 2.9, 4.8):
            p = Vector((0.2 * cos(a), 0.2 * sin(a), 0.14)); b.tube([(0, 0, 0.05), tuple(p)], 0.006, "cropStalk", seg=3)
            for k in range(5): leaf(b, p, tau * k / 5, 0.035, 0.03, "white", lift=0.1, droop=0.1, cup=0.2, shape="round", segs=(3, 2), thick=0.004)
            b.ball(0.015, (p.x, p.y, p.z + 0.006), "starYellow", sc=(1, 1, 0.6), u=6, v=4)
    if stage == 4:
        for i, a in enumerate((0.5, 1.7, 2.9, 4.0, 5.3)):
            p = Vector((0.29 * cos(a), 0.29 * sin(a), 0.1))
            b.tube([(0, 0, 0.06), (0.16 * cos(a), 0.16 * sin(a), 0.14), tuple(p + Vector((0, 0, 0.04)))], 0.006, "cropStalk", seg=3)
            _berry(b, p, 0.075, ripe=(i != 3))
    return kit(name, b, 62)

# ---------------------------------------------------------------- garden flowers (petals stay on petalA / petalB)
def daisy(name, stage):
    """A rosette of spoon-shaped leaves at the foot; thin stems; a flower of many narrow petals round a domed middle.
    Stage 2: the rosette. Stage 3: stems with closed buds. Stage 4: three flowers at different heights."""
    b = B()
    for i in range(6): leaf(b, (0, 0, 0.01), tau * i / 6, 0.13, 0.045, "cropLeafLt", lift=0.35, droop=0.45, cup=0.2, shape="spoon", segs=(4, 2))
    if stage == 2: return kit(name, b, 62)
    heads = [(0.0, 0.0, 0.5), (0.09, 0.06, 0.38), (-0.08, 0.05, 0.3)]
    for x, y, h in heads:
        b.tube([(0, 0, 0.01), (x * 0.5, y * 0.5, h * 0.5), (x, y, h)], 0.009, "cropStalk", seg=4)
        if stage == 3:
            b.ball(0.03, (x, y, h + 0.02), "cropLeaf", sc=(1, 1, 0.9), u=8, v=5); b.ball(0.022, (x, y, h + 0.042), "petalA", sc=(1, 1, 0.6), u=6, v=4)
        else:
            for k in range(14): leaf(b, (x, y, h + 0.02), tau * k / 14, 0.085, 0.02, "petalA", lift=0.12, droop=0.15, cup=0.1, shape="oval", segs=(3, 1), thick=0.004)
            b.lathe([(0.032, 0.0), (0.03, 0.012), (0.018, 0.026), (0.0, 0.03)], (x, y, h + 0.012), "petalB", seg=10)
    return kit(name, b)

def tulip(name, stage):
    """Two or three broad, blue-green leaves at the foot; one stem; a cup of six petals (three inside three).
    Stage 2: the leaves. Stage 3: a tall green bud, its tip showing the colour. Stage 4: in flower."""
    b = B(); h = {2: 0.2, 3: 0.46, 4: 0.52}[stage]
    for i, a in enumerate((0.4, 2.5, 4.3)[: 2 if stage == 2 else 3]):
        leaf(b, (0, 0, 0.0), a, 0.3, 0.085, "tulipLeaf", lift=2.4, droop=2.0, cup=0.6, shape="point", segs=(5, 3))
    if stage == 2: return kit(name, b, 62)
    b.tube([(0, 0, 0), (0.01, 0, h * 0.5), (0, 0, h)], [0.014, 0.012, 0.011], "tulipStem", seg=5)
    if stage == 3:
        b.ball(0.045, (0, 0, h + 0.06), "tulipStem", sc=(1, 1, 1.6), u=10, v=6); b.ball(0.034, (0, 0, h + 0.12), "petalA", sc=(1, 1, 1.1), u=8, v=5)
        return kit(name, b, 62)
    for ring, (r0, L, W, off) in enumerate(((0.024, 0.075, 0.075, 0.0), (0.016, 0.07, 0.07, pi / 3))):
        for k in range(3):
            leaf(b, (r0 * cos(off + tau * k / 3), r0 * sin(off + tau * k / 3), h), off + tau * k / 3, L, W, "petalA", lift=2.4 - 0.2 * ring, droop=0.6, cup=0.6, shape="spoon", segs=(4, 3), thick=0.006)
    b.ball(0.022, (0, 0, h + 0.03), "petalB", sc=(1, 1, 1.2), u=8, v=5)
    return kit(name, b, 62)

def sunflower(name, stage):
    """A tall rough stem with large heart-shaped toothed leaves; a green bud wrapped in pointed bracts; then a head of
    golden petals round a big brown disc of seeds, facing out and nodding a little. Stage 2: a young plant.
    Stage 3: tall, the bud. Stage 4: in flower."""
    T = mats(); b = B(); h = {2: 0.42, 3: 0.95, 4: 1.2}[stage]
    b.tube([(0, 0, 0), (0.02, 0, h * 0.5), (0, -0.02, h)], [0.028, 0.024, 0.02], "sunStem", seg=6)
    nl = 2 if stage == 2 else 6
    for i in range(nl):
        v = 0.2 + 0.65 * i / max(1, nl - 1); a = 1.0 + 2.3 * i
        leaf(b, (0.01, 0, h * v), a, 0.24 * (1.15 - 0.4 * v), 0.13 * (1.15 - 0.4 * v), "sunLeaf", lift=0.2, droop=0.7, cup=0.25, shape="heart", teeth=6, segs=(5, 3))
    if stage == 2:
        b.ball(0.035, (0, -0.02, h + 0.02), "sunLeaf", sc=(1, 1, 0.8), u=8, v=5); star(b, (0, -0.02, h + 0.0), 0.05, 6, "bract", lift=0.9, droop=0.4)
        return kit(name, b, 62)
    F = _frame((0, -0.04, h + 0.05), Vector((0, -1.0, 0.35)))                                 # the head faces out (-Y), nodding a little
    if stage == 3:
        b.ball(0.08, tuple(F @ Vector((0, 0, 0.04))), "sunLeaf", sc=(1, 1, 0.7), u=10, v=6)
        star(b, Vector((0, 0, 0.0)), 0.1, 10, "bract", lift=0.5, droop=0.3, mtx=F)
        b.ball(0.03, tuple(F @ Vector((0, 0, 0.09))), "petalA", sc=(1, 1, 0.5), u=6, v=4)
        return kit(name, b, 62)
    R = 0.15
    star(b, Vector((0, 0, -0.015)), R + 0.05, 14, "bract", lift=-0.2, droop=0.2, W=0.04, mtx=F)
    for ring, (L, off) in enumerate(((0.14, 0.0), (0.12, pi / 16))):
        for k in range(16): leaf(b, Vector((0, 0, 0.006 + 0.004 * ring)), off + tau * k / 16, R + L * 0.75, 0.05, "petalA", lift=0.12 - 0.08 * ring, droop=0.2, cup=0.15, segs=(3, 1), thick=0.005, mtx=F)
    eul = F.to_euler()
    b.lathe([(R, 0.0), (R * 0.95, 0.022), (R * 0.6, 0.04), (0.0, 0.045)], tuple(F.translation), mats=[T["disc"]] * 3, seg=18, rot=(eul.x, eul.y, eul.z))
    b.lathe([(0.0, -0.05), (R * 0.6, -0.04), (R, -0.005), (R, 0.0)], tuple(F.translation), mats=["bract"] * 3, seg=14, rot=(eul.x, eul.y, eul.z))
    return kit(name, b, 62)

def rose(name, stage):
    """A rose bush: dark green leafy canes; tight buds held in green sepals; blooms of cupped petals spiralling in.
    Stage 2: a young bush. Stage 3: in bud. Stage 4: in flower."""
    b = B()
    if stage == 2:
        kgreen.puff(b, [((0, 0, 0.16), 0.17, (1, 1, 0.9), (10, 6)), ((0.1, 0.05, 0.2), 0.12, (1, 1, 0.9), (8, 5))], "deep", floor=0.0)
        for i in range(4): compound(b, (0, 0, 0.18), tau * i / 4 + 0.5, 0.16, "roseLeaf", pairs=1, lift=0.4, droop=0.6, stalk="roseCane")
        return kit(name, b, 62)
    kgreen.puff(b, [((0, 0, 0.26), 0.26, (1, 1, 0.88), (10, 6)), ((0.19, 0.05, 0.2), 0.18, (1, 1, 0.88), (8, 5)), ((-0.18, -0.04, 0.2), 0.19, (1, 1, 0.88), (8, 5))], "deep", floor=0.0)
    for i in range(7): compound(b, (0.18 * cos(tau * i / 7), 0.18 * sin(tau * i / 7), 0.28 + 0.06 * (i % 2)), tau * i / 7, 0.16, "roseLeaf", pairs=2, lift=0.3, droop=0.6, stalk="roseCane")
    spots = [(0.02, -0.15, 0.47), (0.27, -0.08, 0.33), (-0.25, -0.13, 0.33), (-0.04, 0.13, 0.5)]
    for x, y, z in (spots[:3] if stage == 3 else spots):
        p = Vector((x, y, z))
        if stage == 3:
            b.ball(0.04, (x, y, z + 0.03), "petalA", sc=(1, 1, 1.35), u=8, v=5); star(b, p + Vector((0, 0, 0.012)), 0.045, 5, "roseLeaf", lift=0.9, droop=0.5)
        else:
            b.ball(0.035, (x, y, z + 0.035), "petalA", sc=(1, 1, 1.0), u=8, v=5)
            for ring, (n, L, lift) in enumerate(((5, 0.06, 1.6), (5, 0.075, 0.9), (6, 0.085, 0.35))):
                for k in range(n): leaf(b, p, tau * k / n + ring * 0.6, L, 0.055, "petalA", lift=lift, droop=0.5, cup=0.55, shape="round", segs=(3, 2), thick=0.005)
    return kit(name, b, 62)

def lavender(name, stage):
    """A low mound of narrow grey-green leaves; slender stems well above it, each topped with a spike of small purple
    flowers in whorls. Stage 2: the mound. Stage 3: spikes in bud. Stage 4: in flower."""
    b = B(); n = {2: 10, 3: 16, 4: 18}[stage]
    for i in range(n):
        a = tau * i / n + 0.13 * (i % 3); L = 0.16 + 0.04 * (i % 3)
        leaf(b, (0, 0, 0.0), a, L, 0.014, "lavLeaf", lift=1.4 - 0.2 * (i % 2), droop=0.9, cup=0.1, shape="strap", segs=(3, 1), thick=0.005)
    if stage == 2: return kit(name, b, 62)
    ns = 7 if stage == 3 else 9
    for i in range(ns):
        a = tau * i / ns + 0.2; lean = 0.08 + 0.05 * (i % 2); h = 0.42 + 0.06 * (i % 3)
        tip = Vector((lean * h * cos(a), lean * h * sin(a), h))
        b.tube([(0, 0, 0.05), (tip.x * 0.5, tip.y * 0.5, h * 0.55), tuple(tip)], 0.006, "lavLeaf", seg=3)
        for j in range(4 if stage == 3 else 5):
            u = 1 - 0.17 * j; p = Vector((tip.x * (0.85 + 0.15 * u), tip.y * (0.85 + 0.15 * u), tip.z - 0.11 * (1 - u) * 3.4))
            b.ball(0.022 + 0.004 * (j > 0), tuple(p), "lavBud" if stage == 3 else "petalA", sc=(1, 1, 0.8), u=6, v=4)
    return kit(name, b, 62)

CROPS = {"Carrot": carrot, "Cabbage": cabbage, "Pumpkin": pumpkin, "Tomato": tomato, "Corn": corn, "Strawberry": strawberry}
FLOWERS = {"Daisy": daisy, "Tulip": tulip, "Sunflower": sunflower, "Rose": rose, "Lavender": lavender}
