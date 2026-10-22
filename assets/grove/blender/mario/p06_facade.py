"""Pass 6: mall exterior identity. Cream walls with terracotta bands on all four sides, arched windows and
pilasters on the three blank sides, corner turrets, striped awnings, a larger crown sign and roof planting."""
import bpy, re
from gk import *

F = fresh("MARIO_FACADE", "GROVE_MALL_FACADE_REFINEMENT")
aw = named("Facade_L2_Bay", "Facade_L3_Bay")
aw = [o for o in aw if o.name.endswith("_Awning")]
bays = []
for o in aw:
    a, c = wbb(o); bays.append((a.x, c.x, c.z, 2 if "_L2_" in o.name else 3))
planters = [wbb(o) for o in named("Roof_Planter_", coll="GROVE_MALL_FACADE_REFINEMENT")]
gone = supersede(aw + named("Roof_Shrub_", "Mall_Crown_Title", coll="GROVE_MALL_FACADE_REFINEMENT"))
for o in named("North_Wall", "South_Wall", "East_Wall", "West_Wall", coll="GROVE_ENVIRONMENT_BLOCKOUT"):
    for s in o.material_slots: s.material = M("cream")

# ---- kit: arched window and corner turret
def kit(name, b):
    new = b.data(name + "__new"); old = bpy.data.meshes.get(name)
    if old: old.user_remap(new); bpy.data.meshes.remove(old)
    new.name = name; return new
b = B(); arch = [(-0.9, 0), (0.9, 0), (0.9, 1.7)] + [(0.9 * cos(radians(a)), 1.7 + 0.9 * sin(radians(a))) for a in range(30, 180, 30)] + [(-0.9, 1.7)]
b.prism(arch, 0.06, "sky", mtx=XZ(-0.07))
b.tube([(x, -0.09, z) for x, z in arch], 0.1, "white", seg=4, closed=True)
b.box((0.07, 0.05, 2.55), (0, -0.1, 1.28), "white"); b.box((1.8, 0.05, 0.07), (0, -0.1, 1.7), "white")
b.box((2.3, 0.32, 0.16), (0, -0.13, -0.06), "terracotta")
WIN = kit("GK_Window", b)
b = B()
b.lathe([(2.3, 0), (2.3, 0.6), (2.1, 0.75), (2.1, 4.7), (2.25, 4.8), (2.25, 5.1), (2.1, 5.2), (2.1, 9.7), (2.25, 9.8), (2.25, 10.1), (2.1, 10.2), (2.1, 15.2), (2.5, 15.5), (2.5, 16.0)],
        seg=20, mats=["terracotta", "terracotta", "cream", "yellow", "yellow", "yellow", "cream", "blue", "blue", "blue", "cream", "white", "white"])
b.lathe([(2.8, 15.9), (2.8, 16.12), (2.2, 17.4), (1.3, 19.2), (0.45, 20.6), (0, 21.0)], m="red", seg=20)
b.ball(0.36, (0, 0, 21.2), "gold", u=10, v=6)
for a in (0.5, 0.5 + pi): b.ball(1.0, (0.42 * cos(a), 0.42 * sin(a), 21.0), "leaf_light", sc=(0.42, 0.18, 0.1), u=6, v=4, rot=(0, -0.4, a))
for z in (2.7, 7.6, 12.6):
    b.cyl(0.55, 0.14, (2.02, 0, z), "sky", seg=14, rot=(0, pi / 2, 0)); b.cyl(0.55, 0.14, (0, 2.02, z), "sky", seg=14, rot=(-pi / 2, 0, 0))
    b.tube([(2.17, 0.6 * cos(tau * i / 14), z + 0.6 * sin(tau * i / 14)) for i in range(14)], 0.09, "white", seg=6, closed=True)
    b.tube([(0.6 * cos(tau * i / 14), 2.17, z + 0.6 * sin(tau * i / 14)) for i in range(14)], 0.09, "white", seg=6, closed=True)
TUR = kit("GK_Turret", b)
for i, (x, y, rz) in enumerate(((30.3, 22.3, 0), (-30.3, 22.3, pi / 2), (-30.3, -22.3, pi), (30.3, -22.3, -pi / 2))):
    inst(f"Mall_Turret_{i}", TUR, F, (x, y, 0), rz=rz)
k = 0
for lv, z in ((1, 0), (2, 5), (3, 10)):
    for x in range(-25, 26, 5):
        inst(f"Mall_Window_N_{k}", WIN, F, (x + 0.0, -22.3, z + 1.15)); k += 1
    for y in (-18, -12, -6, 6, 12, 18):
        inst(f"Mall_Window_W_{k}", WIN, F, (-30.3, y, z + 1.15), rz=-pi / 2); k += 1
        inst(f"Mall_Window_E_{k}", WIN, F, (30.3, y, z + 1.15), rz=pi / 2); k += 1

# ---- bands and pilasters on the three plain sides, base band on all four
b = B()
for (p0, p1) in (((-30.42, -22.42), (-30.3, 22.3)), ((30.3, -22.42), (30.42, 22.3)), ((-30.42, -22.42), (30.42, -22.3))):
    b.box2((p0[0], p0[1], 0), (p1[0], p1[1], 0.95), "terracotta", r=0.05, seg=1)
    for z in (4.72, 9.72):
        b.box2((p0[0] - 0.05, p0[1] - 0.05, z), (p1[0] + 0.05, p1[1] + 0.05, z + 0.36), "terracotta", r=0.07, seg=1)
for sx in (-1, 1):
    for x0, x1 in ((10, 30.3),):
        b.box2((sx * x0, 22.3, 0), (sx * x1, 22.42, 0.5), "terracotta", r=0.05, seg=1)
def pil(b, x, y, hz):
    b.box((0.36, 0.8, 15.0) if hz else (0.8, 0.36, 15.0), (x, y, 7.5), "white", r=0.1)
    b.lathe([(0, 14.95), (0.3, 15.05), (0.4, 15.4), (0.24, 15.78), (0, 15.92)], (x, y, 0), "pink", seg=8)
for y in (-11, 0, 11): pil(b, -30.47, y, True); pil(b, 30.47, y, True)
for x in (-20, -10, 0, 10, 20): pil(b, x, -22.47, False)
b.obj("Mall_Side_Facades", F)

# ---- striped awnings on the upper bays, striped valance on the entrance canopy
b = B()
def awning(b, x0, x1, y0, zt, depth, c1, c2="white"):
    nst = max(4, round((x1 - x0) / 0.55)); w = (x1 - x0) / nst
    prof = [(0, 0), (depth, -0.55), (depth, -0.85), (depth - 0.06, -0.85), (depth - 0.06, -0.62), (0, -0.09)]
    for i in range(nst):
        b.prism(prof, w, c1 if i % 2 == 0 else c2, mtx=YZ(x0 + i * w, y0, zt))
for (x0, x1, zt, lv) in bays:
    if zt < 1.0: continue      # Codex left some awning stand-ins at ground level: those made striped awnings under the park (round 7)
    awning(b, x0 - 0.1, x1 + 0.1, 22.4, zt - 0.04, 1.5, "blue" if lv == 2 else "pink")
for i in range(20):
    b.box((0.55, 0.07, 0.42), (-5.225 + 0.55 * i, 25.93, 4.55), "red" if i % 2 == 0 else "white", r=0.03, seg=1)
for sx in (-1, 1):
    for i in range(8):
        b.box((0.07, 0.55, 0.42), (sx * 5.53, 21.8 + 0.275 + 0.55 * i, 4.55), "red" if i % 2 == 0 else "white", r=0.03, seg=1)
b.obj("Mall_Awnings", F)

# ---- crown sign and roof planting
for pre, m in (("Mall_Crown_Back", "red"), ("Mall_Crown_Trim", "gold"), ("Mall_Crown_Leaf", "leaf_light")):
    for o in named(pre):
        for s_ in o.material_slots: s_.material = M(m)
b = B()
b.text("THE GROVE", 1.3, (0, 23.14, 15.95), "white", face="+y", extrude=0.07, bevel=0.02)
for sx in (-1, 1):
    b.cyl(0.14, 1.3, (sx * 9.4, 22.6, 15.05), "leaf_dark", seg=8); bloom(b, (sx * 9.4, 22.85, 16.9), 1.25, "+y", "pink", "yellow")
    b.ball(1.0, (sx * 8.75, 22.7, 15.75), "leaf_light", sc=(0.55, 0.1, 0.24), u=8, v=4, rot=(0, sx * 0.5, 0))
b.obj("Mall_Crown_Sign", F)
for i, (a, c) in enumerate(planters):
    inst(f"Mall_Roof_Bush_{i}", bpy.data.meshes["GK_Bush"], F, ((a.x + c.x) / 2, (a.y + c.y) / 2, c.z - 0.12), rz=i * 1.4, sc=1.15)
rep = {"superseded": gone, "bays": len(bays), "planters": len(planters), "facade_objects": len(F.objects)}
bpy.app.driver_namespace["gk_report"] = rep
