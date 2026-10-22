"""Pass 7: atrium dressing. Tiered bud fountain with water arcs, kit trees in planters, benches facing the
fountain, an info kiosk and level totem, pendant bud lamps, bunting across the light well, calmer floor decals."""
import bpy, math
from gk import *

A = fresh("MARIO_ATRIUM", "GROVE_ATRIUM_REFINEMENT")
# Planter positions come from Codex's (now superseded, hidden) planters. Hidden objects are not evaluated, so their
# matrix_world can be stale: read the transform from the object's own properties instead.
def _centre(o):
    cs = [o.matrix_basis @ Vector(c) for c in o.bound_box]; return (round(sum(c.x for c in cs) / 8, 2), round(sum(c.y for c in cs) / 8, 2))
pos = sorted({_centre(o) for o in named("Atrium_Planter_")})
if len(pos) != 4: pos = [(-7.1, -5.7), (7.1, -5.7), (-7.1, 5.7), (7.1, 5.7)]
# Atrium_Refined_Basin is Codex's 2.75 m drum: it sat hidden inside the first, larger fountain and was what really
# crowded the escalators. The bloom has its own plinth.
gone = supersede(named("Atrium_Planter_", "Atrium_Topiary", "Atrium_Bench_", "Atrium_Refined_Stem", "Atrium_Refined_Basin", "Atrium_Fountain_Petal", "Atrium_Fountain_Heart", coll="GROVE_ATRIUM_REFINEMENT")
                 + named("Refined_Atrium_", coll="GROVE_VEGETATION_REFINEMENT"))
for c in bpy.data.collections:
    if c.name.endswith("LABELS"): c.hide_viewport = True
RET = {"Atrium_Path_Ribbon": "white", "Atrium_Medallion_Outer": "gold", "Atrium_Medallion_Middle": "white", "Atrium_Medallion_Inner": "sky",
       "Concourse_Entry_Rose": "pink", "Concourse_Entry_Stone": "white", "Concourse_Tick": "teal"}
for pre, m in RET.items():
    for o in named(pre):
        for s in o.material_slots: s.material = M(m)

# ---- fountain
b = B()
b.lathe([(3.1, 0), (3.1, 0.18), (2.9, 0.34), (0, 0.34)], seg=32, mats=["gold", "white", "white"])
b.tube([(2.75 * cos(tau * i / 32), 2.75 * sin(tau * i / 32), 0.6) for i in range(32)], 0.2, "gold", seg=8, closed=True)
b.lathe([(0.75, 0.3), (0.6, 0.7), (0.36, 0.95), (0.3, 1.45), (0.5, 1.55), (1.45, 1.75), (1.55, 1.9), (1.4, 1.92), (0.45, 1.8), (0, 1.8)], seg=20,
        mats=["white", "white", "white", "gold", "pink", "pink", "pink", "water", "water"])
b.lathe([(0.3, 1.8), (0.24, 2.5), (0.42, 2.62), (0.42, 2.72), (0, 2.72)], seg=14, mats=["white", "gold", "gold", "gold"])
b.lathe([(0, 2.7), (0.42, 2.8), (0.6, 3.25), (0.44, 3.75), (0.16, 4.1), (0, 4.2)], m="pink", seg=14)
for i in range(5):
    a = tau * i / 5; b.ball(1.0, (0.42 * cos(a), 0.42 * sin(a), 2.86), "leaf_light", sc=(0.42, 0.24, 0.1), u=8, v=4, rot=(0, -0.55, a))
# the water (pool, bowl, falling sheet, jets) is its own rig: p26_water.py
b.obj("Atrium_Fountain_Bloom", A).scale = (0.64, 0.64, 0.64)   # 2.0 m radius. At 2.6 m it left 1.4 m to the foot of the escalators, too tight to walk up to them; this leaves 2.5 m.

# ---- planters with trees, benches, kiosk, totem
TT = ["GK_Tree_Blossom", "GK_Tree_Citrus", "GK_Tree_Citrus", "GK_Tree_Blossom"]
for i, (x, y) in enumerate(pos):
    inst(f"Atrium_PlanterPot_{i}", bpy.data.meshes["GK_Planter"], A, (x, y, 0), sc=1.3)
    if x < 0:   # beside the escalators: a low bush, so the game camera that follows a rider never ends up inside a tree crown
        inst(f"Atrium_PlanterBush_{i}", bpy.data.meshes["GK_Bush"], A, (x, y, 1.12), rz=i * 1.7, sc=1.0)
    else:
        inst(f"Atrium_PlanterTree_{i}", bpy.data.meshes[TT[i % 4]], A, (x, y, 1.19), rz=i * 1.7, sc=0.8)
# 4.25, not 4.6: the bench back must stand clear of the planter pot (1.33 m radius at 6.2, 4.8), or one end is buried in it
for i, (x, y, rz) in enumerate(((4.25, 4.25, -pi / 4), (4.25, -4.25, -3 * pi / 4), (-4.25, -4.25, 3 * pi / 4), (-4.25, 4.25, pi / 4))):
    inst(f"Atrium_Bench_Kit_{i}", bpy.data.meshes["GK_Bench"], A, (x, y, 0.02), rz=rz)
b = B(); kx, ky = 6.4, 18.6
b.lathe([(1.3, 0), (1.3, 0.1), (1.2, 0.15), (1.2, 0.56), (1.38, 0.6), (1.38, 0.68), (0, 0.68)], (kx, ky, 0), seg=20, mats=["gold", "gold", "yellow", "white", "white", "white"])
b.cyl(0.07, 2.6, (kx, ky, 0.68), "white", seg=8)
b.lathe([(1.7, 3.0), (1.7, 3.12), (1.2, 3.5), (0.5, 3.8), (0, 3.86)], (kx, ky, 0), "sky", seg=20)
b.ball(0.2, (kx, ky, 3.98), "gold", u=8, v=5)
b.cyl(0.42, 0.1, (kx, ky + 1.66, 3.2), "blue", seg=16, rot=(-pi / 2, 0, 0)); b.text("i", 0.6, (kx, ky + 1.78, 3.2), "white", face="+y", extrude=0.02, bevel=0.006)
b.obj("Atrium_Kiosk", A)
# The level directory is its own object (it was one mesh with the kiosk 13 m away: the game fades whatever is
# between the camera and the player, and fading one took half of the other with it).
b = B(); tx, ty = -6.4, 18.6
b.box((1.5, 0.4, 3.3), (tx, ty, 1.65), "white", r=0.14); b.lathe([(0, 3.28), (0.28, 3.36), (0.38, 3.66), (0.24, 3.98), (0, 4.1)], (tx, ty, 0), "pink", seg=10)
for i, (lv, c) in enumerate(((3, "pink"), (2, "blue"), (1, "yellow"))):
    z = 2.75 - i * 0.95
    for sy, fc in ((1, "+y"), (-1, "-y")):
        b.box((1.26, 0.06, 0.78), (tx, ty + sy * 0.21, z), c, r=0.08); b.text(str(lv), 0.5, (tx - 0.32, ty + sy * 0.25, z), "white", face=fc, extrude=0.015, bevel=0.005)
        b.prism([(0, 0.2), (0.3, 0), (0, -0.2)], 0.03, "white", mtx=Matrix.Translation((tx + sy * -0.25, ty + sy * 0.24, z)) @ (XZ(0) if sy < 0 else Matrix.Rotation(pi, 4, "Z") @ XZ(0)))
b.obj("Atrium_Level_Totem", A)

# ---- pendant lamps and bunting
def pendant(b, x, y, zt, L):
    b.tube([(x, y, zt), (x, y, zt - L)], 0.025, "white", seg=5)
    for a in (0, pi / 2, pi, 3 * pi / 2): b.ball(0.2, (x + 0.16 * cos(a), y + 0.16 * sin(a), zt - L - 0.02), "leaf_light", sc=(1, 0.55, 0.3), u=6, v=4, rot=(0, 0.6, a))
    b.lathe([(0, zt - L), (0.26, zt - L - 0.08), (0.36, zt - L - 0.42), (0.26, zt - L - 0.78), (0.08, zt - L - 1.0), (0, zt - L - 1.05)], (x, y, 0), "glow", seg=10)
b = B()
for y in (-13, 13):
    for x in (-6, 0, 6):
        pendant(b, x, y, 4.6, 0.7); pendant(b, x, y, 9.6, 0.7)
for i in range(6):
    a = tau * (i + 0.5) / 6; pendant(b, 9.25 * cos(a), 9.25 * sin(a), 14.72, 2.6 + (i % 2) * 0.9)
RAIN = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"]
def bunting(b, p0, p1, sag, k):
    p0, p1 = Vector(p0), Vector(p1); pts = []
    for i in range(17):
        u = i / 16; q = p0.lerp(p1, u); q.z -= sag * 4 * u * (1 - u); pts.append(q)
    b.tube(pts, 0.022, "white", seg=4); ang = math.atan2(p1.y - p0.y, p1.x - p0.x)
    for i in range(k):
        u = (i + 0.5) / k; q = p0.lerp(p1, u); q.z -= sag * 4 * u * (1 - u) + 0.02
        b.prism([(-0.2, 0), (0.2, 0), (0, -0.45)], 0.02, RAIN[i % 8], mtx=Matrix.Translation(q) @ Matrix.Rotation(ang, 4, "Z") @ XZ(-0.01))
bunting(b, (-10, -9.7, 6.0), (10, 9.7, 6.0), 0.7, 26); bunting(b, (-10, 9.7, 6.0), (10, -9.7, 6.0), 0.7, 26)
b.obj("Atrium_Pendants_Bunting", A)
rep = {"superseded": gone, "atrium_objects": len(A.objects), "planters": len(pos)}
bpy.app.driver_namespace["gk_report"] = rep
