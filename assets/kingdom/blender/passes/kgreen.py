"""Greenery for the Kingdom, second look (9 Oct 2026, after Claire found the first wild land off-putting).
What was wrong: crowns were welded and decimated, so their faces were flat and uneven (a crumpled look); every tree
had the same three stripes cut straight across it at the same height; the top stripe was lime, brighter than the lawn;
the wild land was one tree at one size on a grid with a lump of thicket under it.
The rules now (Mario 3D World and Animal Crossing both do this: smooth round balls in clusters, few kinds, clear outlines):
  1. A crown is a cluster of smooth balls ("puffs"). The faces of a ball stay regular, so the shading stays round.
     Faces hidden inside another puff are thrown away.
  2. Every puff has its own light patch on top and its own shade underneath, each a clean circle. Still three
     values in clean bands, the item look, but following the puffs and not slicing the whole tree.
  3. Three greens and a blossom pink (TINT). The light value of a green is about as light as the lawn, never lighter.
  4. Few kinds with clear outlines: tall round, broad, tiered, small round. Variety comes from size, tint and grouping.
Import after kk and ktone; reload on every pass run."""
import bpy, bmesh
from math import sin, cos, acos, pi, tau, sqrt
from mathutils import Vector, Matrix
import gk, gv
from gv import dot

# main, light patch, shade underneath
TINT = {"classic": ("canopy", "canopyHi", "canopyLo"), "deep": ("canopyDeep", "canopyDeepHi", "canopyDeepLo"),
        "warm": ("canopyWarm", "canopyWarmHi", "canopyWarmLo"), "blossom": ("blossom", "blossomHi", "blossomLo"),
        "rock": ("rockA", "rockHi", "rockLo"), "cloud": ("white", "white", "cloudLo")}
MATT = 0.9             # leaves are matt: a shine on a ball of few faces picks out every face. (Blender's shadow terminator
                       # settings were tried too: they change nothing here, so nothing sets them.)
SEG = (12, 7)          # (around, pole to pole) for a puff of a tree; more for the biggest puff, fewer for shrubs

def leafmat(name):
    """A leaf colour: its own material (never one a door or a roof also uses), and matt."""
    m = gk.M(name)
    if name.startswith(("canopy", "blossom", "grass", "cabbage")) and not m.get("kk_matt"):
        p = m.node_tree.nodes.get("Principled BSDF") if m.use_nodes else None
        if p: p.inputs["Roughness"].default_value = MATT
        m.roughness = MATT; m["kk_matt"] = 1
    return m

def puff(b, blobs, tint="classic", seg=SEG, lean=(0.2, -0.3), light=True, shade=True, floor=None, rings=None):
    """Adds a cluster of puffs to builder b. blobs: [(centre, radius, (sx, sy, sz), (u, v))]; the last two may be left
    out. A puff is a ball whose pole points at the light (straight up, leaned by `lean`): its top rings are the light
    patch and its bottom rings the shade, so both edges are clean circles and cost no extra triangles. rings: (light,
    shade) counted in rings of the ball; left out, about a third of the rings for the light and a quarter for the shade. floor: faces wholly below this
    height are dropped (a shrub that sits into the ground)."""
    main, lt, dk = TINT[tint] if isinstance(tint, str) else tint
    im, il, idk = b.mi(leafmat(main)), b.mi(leafmat(lt)), b.mi(leafmat(dk))
    E = []
    for bl in blobs:
        E.append((Vector(bl[0]), bl[1], Vector(bl[2]) if len(bl) > 2 and bl[2] else Vector((1, 1, 0.9)), bl[3] if len(bl) > 3 and bl[3] else seg))
    tip = Vector((0, 0, 1)).rotation_difference(Vector((lean[0], lean[1], 1.0)).normalized()).to_matrix()
    def inside(p, q):
        c, r, s, _ = E[q]; d = p - c
        return (d.x / (r * s.x)) ** 2 + (d.y / (r * s.y)) ** 2 + (d.z / (r * s.z)) ** 2 < 0.93
    out = bmesh.new()
    for k, (c, r, s, (u, v)) in enumerate(E):
        t = bmesh.new(); bmesh.ops.create_uvsphere(t, u_segments=u, v_segments=v, radius=r)
        nl, nd = rings or (max(1, round(v * 0.31)), max(1, round(v * 0.27)))
        for f in t.faces:
            band = min(round(acos(max(-1.0, min(1.0, vv.co.z / r))) / (pi / v)) for vv in f.verts)       # 0 at the top pole
            f.material_index = il if (light and band < nl) else idk if (shade and band >= v - nd) else im
            f.smooth = True
        bmesh.ops.rotate(t, cent=(0, 0, 0), matrix=Matrix.Rotation(0.3 + 0.9 * k, 3, "Z"), verts=t.verts[:])     # the seams of two puffs never line up
        bmesh.ops.rotate(t, cent=(0, 0, 0), matrix=tip, verts=t.verts[:])
        bmesh.ops.scale(t, vec=s, verts=t.verts[:]); bmesh.ops.translate(t, vec=c, verts=t.verts[:])
        dead = [f for f in t.faces if any(all(inside(vv.co, q) for vv in f.verts) for q in range(len(E)) if q != k)
                or (floor is not None and all(vv.co.z < floor for vv in f.verts))]
        if dead: bmesh.ops.delete(t, geom=dead, context="FACES")
        me = bpy.data.meshes.new("_puff"); t.to_mesh(me); t.free(); out.from_mesh(me); bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new("_puff"); out.to_mesh(me); out.free(); b.bm.from_mesh(me); bpy.data.meshes.remove(me)

def stem(b, h, r, seg=10, flare=1.55, at=(0, 0, 0)):
    """A plain trunk: a flared foot in the dark step, the rest in the trunk colour. Stripes are for the trees a player plants."""
    b.lathe([(r * flare, 0), (r * 1.18, h * 0.08), (r, h * 0.2), (r * 0.8, h)], at, mats=["trunk_dk", "trunk", "trunk"], seg=seg)

def blade(b, pts, widths, m, thick=0.02):
    """A leaf blade along pts: a flat underside and a low ridge on top, so it is drawn from both sides for three faces
    a step. Closed at both ends."""
    pts = [Vector(p) for p in pts]; t = bmesh.new(); rings = []; up = Vector((0, 0, 1))
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]; c = pts[min(i + 1, len(pts) - 1)]; tan = (c - a).normalized()
        side = tan.cross(up); side = side.normalized() if side.length > 1e-5 else Vector((1, 0, 0)); nor = side.cross(tan).normalized()
        w = widths[i]; th = thick * (0.3 + 0.7 * w / max(widths))
        rings.append([t.verts.new(p + side * w), t.verts.new(p + nor * th), t.verts.new(p - side * w)])
    for i in range(len(rings) - 1):
        a, c = rings[i], rings[i + 1]
        for k in range(3): t.faces.new((a[k], a[(k + 1) % 3], c[(k + 1) % 3], c[k]))
    t.faces.new(rings[0][::-1]); t.faces.new(rings[-1])
    b._add(t, m)

# ---------------------------------------------------------------- trees of the wild land
TREES = {       # kind: (trunk height, trunk radius, puffs)
    "A": (2.9, 0.24, [((0, 0, 3.9), 1.55, (1, 1, 0.9), (18, 10)), ((1.0, 0.35, 3.25), 1.0), ((-0.95, -0.3, 3.3), 1.05), ((0.25, -0.3, 4.95), 0.9)]),
    "B": (2.0, 0.28, [((0, 0, 2.95), 1.5, (1.15, 1.15, 0.8), (18, 10)), ((1.3, 0.2, 2.6), 1.0), ((-1.25, 0.3, 2.65), 1.05), ((0.1, -1.25, 2.6), 0.95), ((0.0, 0.3, 3.75), 1.0)]),
    "C": (1.5, 0.22, [((0, 0, 2.0), 1.45, (1, 1, 0.62), (14, 6)), ((0, 0, 3.05), 1.15, (1, 1, 0.66), (12, 6)), ((0, 0, 3.95), 0.85, (1, 1, 0.72), (12, 6)), ((0, 0, 4.7), 0.5, (1, 1, 0.95), (10, 6))]),
    "D": (1.6, 0.17, [((0, 0, 2.35), 0.95, (1, 1, 0.92), (14, 8)), ((0.5, 0.15, 1.95), 0.6, (1, 1, 0.9), (10, 6))]),
}
def wild_tree(b, kind="A", tint="classic"):
    h, r, puffs = TREES[kind]
    stem(b, h, r, seg=8 if kind in "CD" else 10)
    puff(b, puffs, tint, lean=(0.0, 0.0) if kind == "C" else (0.2, -0.3))
    if tint == "blossom":
        for li, d in ((0, (0.3, -0.8, 0.5)), (0, (-0.7, -0.4, 0.6)), (1, (0.8, -0.3, 0.5)), (2, (-0.7, 0.2, 0.6)), (3, (0.2, -0.6, 0.7)), (0, (0.5, 0.7, 0.5))):
            c, rr = puffs[li][0], puffs[li][1]; dv = Vector(d).normalized()
            dot(b, (c[0] + dv.x * rr * 0.96, c[1] + dv.y * rr * 0.96, c[2] + dv.z * rr * 0.86), 0.16, "white")

SHRUBS = {
    "A": [((0, 0, 0.42), 0.7, (1, 1, 0.82), (12, 7)), ((0.62, 0.15, 0.32), 0.5, (1, 1, 0.82), (10, 6)), ((-0.58, 0.2, 0.34), 0.52, (1, 1, 0.82), (10, 6))],
    "B": [((0, 0, 0.56), 0.6, (1, 1, 1.05), (12, 7)), ((0.48, -0.3, 0.3), 0.48, (1, 1, 0.9), (10, 6)), ((-0.45, -0.2, 0.28), 0.45, (1, 1, 0.9), (10, 6))],
}
def shrub(b, kind="A", tint="classic", berries=None):
    puff(b, SHRUBS[kind], tint, floor=0.0)
    if berries:
        for (x, y, z) in (((0.3, -0.52, 0.64), (-0.55, -0.3, 0.54), (0.74, -0.14, 0.52)) if kind == "A" else ((0.25, -0.44, 0.88), (-0.52, -0.48, 0.42))):
            b.ball(0.065, (x, y, z), berries, u=6, v=4)

def fern(b):
    """A rosette of broad arching fronds, for the foot of a tree."""
    for i in range(6):
        a = tau * i / 6 + 0.2; c, s = cos(a), sin(a); L = 0.6 + 0.1 * (i % 2); m = leafmat(("canopyDeep", "canopy", "canopyDeepHi")[i % 3])
        blade(b, [(0.03 * c, 0.03 * s, 0.0), (L * 0.3 * c, L * 0.3 * s, 0.3), (L * 0.68 * c, L * 0.68 * s, 0.36), (L * c, L * s, 0.16)], [0.06, 0.15, 0.13, 0.02], m, thick=0.04)

def grass_tuft(b):
    """Short chunky blades in the light greens of the lawn: it has to read as lawn, not as a weed."""
    for i, (a, lean, h, m) in enumerate(((0.0, 0.1, 0.27, "grassHi"), (1.3, 0.13, 0.21, "grassLo"), (2.5, 0.09, 0.3, "grassHi"), (3.8, 0.14, 0.19, "grassLo"), (5.0, 0.11, 0.24, "grassHi"))):
        c, s = cos(a), sin(a); r0 = 0.05
        blade(b, [(r0 * c, r0 * s, -0.03), ((r0 + lean * 0.4) * c, (r0 + lean * 0.4) * s, h * 0.62), ((r0 + lean * 1.2) * c, (r0 + lean * 1.2) * s, h)], [0.07, 0.075, 0.016], leafmat(m), thick=0.035)

def mushrooms(b):
    """Three small toadstools with plain tan and orange caps."""
    for x, y, r, h, m in ((0, 0, 0.17, 0.26, "terracotta"), (0.26, 0.1, 0.11, 0.16, "sand"), (-0.16, 0.2, 0.09, 0.12, "terracotta")):
        b.cyl(r * 0.36, h, (x, y, 0), "cream", seg=7, r2=r * 0.28)
        b.lathe([(r * 0.5, 0), (r, 0.01), (r * 0.94, r * 0.3), (r * 0.62, r * 0.62), (0, r * 0.76)], (x, y, h - 0.02), mats=["cream", m, m, m + "_lt"], seg=10)

def log(b):
    """A fallen log with a puff of moss on it."""
    b.lathe([(0, 0), (0.2, 0), (0.26, 0.04), (0.26, 1.66), (0.2, 1.7), (0, 1.7)], (-0.85, 0, 0.24), mats=["trunk_light", "trunk_light", "trunk", "trunk_light", "trunk_light"], seg=10, rot=(0, pi / 2, 0))
    b.cyl(0.085, 0.24, (0.3, 0.0, 0.36), "trunk", seg=7, r2=0.07, rot=(-0.9, 0, 0)); b.cyl(0.06, 0.01, (0.3, 0.19, 0.51), "trunk_light", seg=7, rot=(-0.9, 0, 0))
    puff(b, [((-0.3, 0.02, 0.44), 0.27, (1.5, 0.9, 0.5), (10, 6))], "warm", shade=False, rings=(2, 0))

def stump(b):
    b.lathe([(0.42, 0), (0.33, 0.1), (0.3, 0.42), (0.26, 0.46), (0, 0.46)], mats=["trunk_dk", "trunk", "trunk_light", "trunk_light"], seg=10)
    puff(b, [((0.24, -0.16, 0.16), 0.2, (1, 1, 0.8), (10, 6))], "warm", shade=False, floor=0.0)

def rock(b):
    """Two rounded stones: a little lighter on top, grey underneath."""
    puff(b, [((0, 0, 0.2), 0.5, (1, 0.82, 0.62), (12, 7)), ((0.44, 0.12, 0.12), 0.3, (1, 0.85, 0.62), (10, 6))], "rock", floor=0.0, rings=(1, 2))
