"""Pass 5a: the Grove prop kit. Authored, shared meshes (names start GK_) that replace primitive stand-ins.
Origin of every kit mesh is its base centre. Re-running rebuilds the meshes and keeps every placed instance."""
import bpy, bmesh
from gk import *
import importlib, gv; importlib.reload(gv)
from gv import crown, dot

def kit(name, b, sharp=50):
    new = b.data(name + "__new", sharp); old = bpy.data.meshes.get(name)
    if old:
        old.user_remap(new); bpy.data.meshes.remove(old)
    new.name = name; return new

def trunk(b, h=2.5, r=0.27, cols=("trunk", "trunk_light")):
    prof = [(r * 1.7, 0), (r * 1.25, 0.14), (r * 1.05, 0.36)]; n = 5
    for i in range(1, n + 1): prof.append((r * (1.0 - 0.2 * i / n), 0.36 + (h - 0.36) * i / n))
    b.lathe(prof, mats=[cols[0], cols[0]] + [cols[1] if i % 2 else cols[0] for i in range(n)], seg=12)

def flower_head(b, loc, r, petal, core="yellow", n=5, u=5, v=3):
    """A flat rosette: one outline with n round petals, cut from a thin slab, and a domed centre. (It used to be five
    squashed low-poly balls, which read as jagged chips.)"""
    x, y, z = loc; k = 6 * n; pts = []
    for i in range(k):
        a = tau * i / k; pts.append((r * (0.5 + 0.5 * abs(cos(n * a / 2)) ** 0.55) * cos(a), r * (0.5 + 0.5 * abs(cos(n * a / 2)) ** 0.55) * sin(a)))
    # tipped a little towards the path: two flowers planted close together then never lie in the same plane
    b.prism(pts, 0.07 * r + 0.02, petal, loc=(x, y, z - 0.02), rot=(0.2, 0, 0))
    b.ball(r * 0.36, (x, y, z + 0.05 * r), core, sc=(1, 1, 0.6), u=8, v=4)

# Crowns, bushes and clouds are welded surfaces (gv.py), not piles of balls: one smooth closed shape, clean colour bands.
ROUND = [((0, 0, 3.7), 1.45), ((1.0, 0.2, 3.35), 1.0), ((-0.95, 0.35, 3.3), 1.05), ((0.1, -1.0, 3.3), 1.0),
         ((0.05, 1.0, 3.45), 0.95), ((0.35, -0.25, 4.65), 0.95), ((-0.5, -0.6, 4.25), 0.8)]
FRUIT = ((0, (0.2, -0.75, 0.62)), (1, (0.85, -0.4, 0.3)), (2, (-0.8, -0.3, 0.5)), (3, (-0.3, -0.85, 0.4)), (1, (0.6, 0.6, 0.5)), (4, (-0.2, 0.8, 0.55)))
def round_tree(name, main, dark, light, fruit, tris=600, fruits=6):
    b = B(); trunk(b)
    crown(b, [(c, r, (1, 1, 0.88)) for c, r in ROUND], tris, main, dark, light, lo=(3.02, 0.12), hi=(4.42, 0.3))
    for li, d in FRUIT[:fruits]:
        c, r = ROUND[li]; dv = Vector(d).normalized()
        dot(b, (c[0] + dv.x * r * 0.93, c[1] + dv.y * r * 0.93, c[2] + dv.z * r * 0.82), 0.2, fruit)
    return kit(name, b, 62)

for far, tris, fruits in (("", 600, 6), ("_Far", 330, 3)):      # _Far: the trees beyond the hedge, never seen close
    round_tree("GK_Tree_Round" + far, "green", "leaf_dark", "leaf_light", "red", tris, fruits)
    round_tree("GK_Tree_Citrus" + far, "leaf_light", "green", "leaf_light", "orange", tris, fruits)
    round_tree("GK_Tree_Blossom" + far, "pink", "rose", "white", "white", tris, fruits)

# Tiered tree: three stacked lens shapes turned on a lathe, so every tier has a clean round edge.
b = B(); trunk(b, 1.7, 0.24)
prof = [(0.2, 1.55)]; mats = []
for r, z, m in ((1.55, 2.1, "leaf_dark"), (1.22, 3.05, "green"), (0.88, 3.9, "leaf_light")):
    for k, th in enumerate((-58, -30, 0, 30, 58, 78)):
        prof.append((r * cos(radians(th)), z + 0.62 * r * sin(radians(th)))); mats.append(m)
prof.append((0, 4.42)); mats.append("leaf_light")
b.lathe(prof, seg=20, mats=mats, cap=False)
b.lathe([(0, 4.3), (0.2, 4.36), (0.27, 4.55), (0.16, 4.78), (0, 4.9)], m="pink", seg=10)
kit("GK_Tree_Tier", b, 62)

b = B()
crown(b, [((0, 0, 0.45), 0.78, (1, 1, 0.8)), ((0.72, 0.1, 0.36), 0.56, (1, 1, 0.8)), ((-0.66, -0.12, 0.38), 0.6, (1, 1, 0.8))], 190,
      "green", "leaf_dark", "leaf_light", lo=(0.2, 0.1), hi=(0.74, 0.35), voxel=0.05)
for loc, pc in (((0.15, -0.5, 0.86), "pink"), ((-0.55, -0.42, 0.66), "white"), ((0.78, -0.28, 0.6), "yellow"), ((-0.2, 0.42, 0.94), "pink")):
    dot(b, loc, 0.12, pc, 0.7)
kit("GK_Bush", b, 62)

for pc in ("pink", "yellow", "white", "red"):
    b = B()
    b.tube([(0, 0, 0), (0.04, 0, 0.3), (0, 0, 0.62)], 0.035, "leaf_dark", seg=5)
    for a in (0.6, 0.6 + pi): b.ball(0.17, (0.15 * cos(a), 0.15 * sin(a), 0.2), "leaf_light", sc=(1, 0.5, 0.22), u=6, v=4, rot=(0, -0.5, a))
    flower_head(b, (0, 0, 0.66), 0.32, pc, "gold" if pc in ("pink", "white", "red") else "white")
    kit("GK_Flower_" + pc, b)

b = B()
b.lathe([(0.3, 0), (0.3, 0.1), (0.17, 0.3), (0.09, 0.44)], m="gold", seg=12)
b.cyl(0.07, 2.55, (0, 0, 0.4), "teal", seg=8); b.ball(0.13, (0, 0, 2.95), "gold", u=8, v=5)
for a in (0, pi / 2, pi, 3 * pi / 2): b.ball(0.24, (0.2 * cos(a), 0.2 * sin(a), 3.08), "leaf_light", sc=(1, 0.55, 0.3), u=6, v=4, rot=(0, -0.6, a))
b.lathe([(0, 3.0), (0.3, 3.08), (0.42, 3.42), (0.31, 3.82), (0.1, 4.06), (0, 4.12)], m="glow", seg=12)
kit("GK_Lamp", b)

# >>> seating kit (p24_seating re-runs this block). Seats are sized to the cast's body, not their short legs:
# seat top 0.42 m, back to about 1.05 m, tables 0.78 m. See p24_seating.py.
b = B()
for sx in (-1, 1):
    b.box((0.2, 0.52, 0.34), (sx * 1.05, 0.02, 0.17), "white", r=0.05)
    b.ball(1.0, (sx * 1.38, 0.04, 0.66), "leaf_light", sc=(0.12, 0.36, 0.22), u=8, v=5)
b.box((2.7, 0.62, 0.1), (0, 0.02, 0.37), "wood", r=0.04); b.box((2.7, 0.12, 0.66), (0, 0.38, 0.74), "wood", r=0.05, rot=(-0.14, 0, 0))
for i in range(6):   # a light six-petal bloom on the backrest (the shared emblem mesh costs four times as much)
    a = tau * i / 6; b.ball(0.085, (0.12 * sin(a), 0.3, 0.8 + 0.12 * cos(a)), "pink", sc=(1, 0.4, 1), u=6, v=3)
b.ball(0.07, (0, 0.28, 0.8), "yellow", sc=(1, 0.5, 1), u=6, v=3)
kit("GK_Bench", b)
# <<< seating kit

b = B()
b.lathe([(0.55, 0), (0.75, 0.1), (0.95, 0.8), (1.02, 0.82), (1.02, 1.0), (0.86, 1.0), (0.86, 0.92), (0, 0.92)], seg=24,
        mats=["terracotta", "terracotta", "white", "white", "white", "white", "trunk"])
kit("GK_Planter", b)

b = B()
P = [(cos(radians(t)), sin(radians(t))) for t in (0, 15, 30, 45, 60, 75)] + [(0, 1)]
b.lathe(P, seg=20, cap=False, mats=["green", "green", "green", "leaf_light", "leaf_light", "leaf_light"])
for a, e in ((0.5, 0.45), (2.3, 0.7), (4.0, 0.35), (5.2, 0.8)):
    b.ball(1.0, (cos(e) * cos(a) * 0.98, cos(e) * sin(a) * 0.98, sin(e) * 0.98), "leaf_dark", sc=(0.13, 0.13, 0.07), u=8, v=4)
kit("GK_Hill", b)

b = B()
crown(b, [(loc, r, (1, 0.7, 0.75)) for loc, r in (((0, 0, 0), 1.0), ((1.15, 0, -0.12), 0.8), ((-1.1, 0, -0.16), 0.76), ((0.4, 0, 0.5), 0.7), ((-0.45, 0, 0.42), 0.6))],
      460, "white", voxel=0.06)
kit("GK_Cloud", b, 62)

b = B(); b.ball(0.5, (0, 0, 0.22), "stone", sc=(1, 0.8, 0.6), u=8, v=5); b.ball(0.3, (0.42, 0.1, 0.13), "grey", sc=(1, 0.8, 0.6), u=7, v=4)
kit("GK_Rock", b)

# >>> seating kit
b = B()
b.lathe([(0.4, 0), (0.4, 0.05), (0.08, 0.1), (0.08, 0.7), (0.7, 0.72), (0.7, 0.78), (0, 0.78)], m="white", seg=14)
b.cyl(0.035, 2.49, (0, 0, 0.78), "white", seg=6)
t = bmesh.new(); n = 12; ap = t.verts.new((0, 0, 3.25)); rim = [t.verts.new((1.6 * cos(tau * i / n), 1.6 * sin(tau * i / n), 2.7)) for i in range(n)]
low = [t.verts.new((1.6 * cos(tau * i / n), 1.6 * sin(tau * i / n), 2.52)) for i in range(n)]
ir, iw = b.mi("red"), b.mi("white")
for i in range(n):
    j = (i + 1) % n; mi_ = ir if i % 2 else iw
    t.faces.new((ap, rim[i], rim[j])).material_index = mi_
    t.faces.new((rim[i], low[i], low[j], rim[j])).material_index = mi_
b._add(t, None); b.ball(0.09, (0, 0, 3.31), "gold", u=6, v=4)
for a in (0.4, 2.5, 4.6): b.lathe([(0.24, 0), (0.24, 0.04), (0.07, 0.08), (0.07, 0.32), (0.3, 0.35), (0.3, 0.4), (0.27, 0.42), (0, 0.42)], (1.2 * cos(a), 1.2 * sin(a), 0), "yellow", seg=10)
kit("GK_Umbrella_Table", b)
# <<< seating kit

b = B(); b.box((0.3, 0.3, 0.18), (0, 0, 0.09), "gold", r=0.05)
for (x, y, z), m in (((0.0, 0, 2.6), "red"), ((0.42, 0.1, 2.25), "yellow"), ((-0.4, -0.1, 2.3), "blue")):
    b.ball(0.36, (x, y, z), m, sc=(1, 1, 1.18), u=10, v=7); b.tube([(0, 0, 0.18), (x, y, z - 0.42)], 0.012, "white", seg=4)
kit("GK_Balloons", b)
rep = {"kit_meshes": sorted(m.name for m in bpy.data.meshes if m.name.startswith("GK_")),
       "tris": {m.name: sum(len(p.vertices) - 2 for p in m.polygons) for m in bpy.data.meshes if m.name.startswith("GK_")}}
bpy.app.driver_namespace["gk_report"] = rep
