"""Pass 3: finish the mall structure. Continuous floors on all three levels, connector decks, roof with a
glass dome, columns, balustrades, a real entrance and a glazed front. Replaces the blockout floor quads and
the stray balcony rails (moved to GROVE_SUPERSEDED_BY_MARIO_PASS, not deleted)."""
import bpy, bmesh, math
from gk import *

SH = fresh("MARIO_SHELL", "GROVE_ENVIRONMENT_BLOCKOUT")
RF = fresh("MARIO_ROOF", "GROVE_ENVIRONMENT_BLOCKOUT")
FIT = fresh("MARIO_FITOUT", "GROVE_ATRIUM_REFINEMENT")
gone = supersede(named("Floor_", "Balcony_Rail", coll="GROVE_ENVIRONMENT_BLOCKOUT") + named("ParkArrival_SouthWallInfill")
                 + named("Atrium_L2_", "Atrium_L3_", coll="GROVE_ATRIUM_REFINEMENT"))

ACC = {1: "yellow", 2: "blue", 3: "pink"}
# ---- floors
b = B(); slab(b, -30, -22, 30, 22, -0.4, 0, "tile_l1", "terracotta"); b.obj("Mall_Floor_L1", SH)
for lv, z, tile in ((2, 5.0, "tile_l2"), (3, 10.0, "tile_l3")):
    b = B(); z0 = z - 0.4; a = ACC[lv]
    if lv == 2:   # notch where the ground escalators arrive
        W = [(-29.7, -21.7, -15, 21.7), (-15, 2.2, -10, 21.7), (-15, -21.7, -10, -2.2)]
    else:         # opening for the level 2 to 3 escalators
        W = [(-29.7, -21.7, -25.1, 21.7), (-16, -21.7, -10, 21.7), (-25.1, 2.2, -16, 21.7), (-25.1, -21.7, -16, -2.2)]
    for (x0, y0, x1, y1) in W + [(10, -21.7, 29.7, 21.7), (-10, 9.7, 10, 16.3), (-10, -16.3, 10, -9.7)]:
        slab(b, x0, y0, x1, y1, z0, z, tile, a, "white")
    b.obj(f"Mall_Floor_L{lv}", SH)

# ---- columns (one shared mesh, three storeys)
b = B()
b.lathe([(0.64, 0), (0.64, 0.22), (0.52, 0.36), (0.46, 0.46), (0.46, 4.1), (0.5, 4.22), (0.68, 4.42), (0.68, 4.6)],
        mats=["gold", "gold", "gold", "white", "gold", "gold", "gold"], seg=16)
col_me = b.data("GK_Column")
for sx in (-1, 1):
    for y in (-16.3, -9.7, -4, 4, 9.7, 16.3):
        for k, z in enumerate((0, 5, 10)):
            inst(f"Mall_Column_{sx}_{y}_L{k+1}", col_me, SH, (sx * 10.75, y, z), sc=(1, 1, 1.026 if k == 2 else 1))
for x in (-3.4, 3.4):
    for y in (-10.1, 10.1):
        for k, z in enumerate((0, 5)):
            inst(f"Mall_DeckColumn_{x}_{y}_L{k+1}", col_me, SH, (x, y, z), sc=(0.8, 0.8, 1))

# ---- roof with a round skylight opening
b = B(); X, Y, R, n, z0, z1 = 30.6, 22.6, 9.3, 64, 14.72, 15.08
outer, inner = [], []
for k in range(n):
    a = tau * k / n; c, s_ = cos(a), sin(a)
    t_ = min(X / abs(c) if abs(c) > 1e-9 else 1e9, Y / abs(s_) if abs(s_) > 1e-9 else 1e9)
    outer.append([c * t_, s_ * t_]); inner.append((R * c, R * s_))
for cx, cy in ((X, Y), (-X, Y), (-X, -Y), (X, -Y)):
    k = min(range(n), key=lambda i: (outer[i][0] - cx) ** 2 + (outer[i][1] - cy) ** 2); outer[k] = [cx, cy]
t = bmesh.new()
vo0 = [t.verts.new((x, y, z0)) for x, y in outer]; vo1 = [t.verts.new((x, y, z1)) for x, y in outer]
vi0 = [t.verts.new((x, y, z0)) for x, y in inner]; vi1 = [t.verts.new((x, y, z1)) for x, y in inner]
iT, iB, iS, iH = b.mi("roof_tex"), b.mi("white"), b.mi("terracotta"), b.mi("gold")
for k in range(n):
    j = (k + 1) % n
    t.faces.new((vi1[k], vi1[j], vo1[j], vo1[k])).material_index = iT
    t.faces.new((vi0[k], vo0[k], vo0[j], vi0[j])).material_index = iB
    t.faces.new((vo0[k], vo1[k], vo1[j], vo0[j])).material_index = iS
    t.faces.new((vi0[k], vi0[j], vi1[j], vi1[k])).material_index = iH
b._add(t, None)
for (p0, p1) in (((-30.9, -22.9, 14.55), (-30.25, 22.9, 15.5)), ((30.25, -22.9, 14.55), (30.9, 22.9, 15.5)), ((-30.9, -22.9, 14.55), (30.9, -22.25, 15.5))):
    b.box2(p0, p1, "terracotta", r=0.18)
b.obj("Mall_Roof", RF)

b = B()
b.lathe([(9.25, 15.0), (9.25, 15.5), (9.85, 15.5), (9.85, 15.08)], m="white", seg=48, cap=False)
E = [(9.45 * cos(radians(a)), 15.5 + 5.4 * sin(radians(a))) for a in (0, 14, 28, 42, 56, 70, 82)] + [(0, 20.9)]
b.lathe(E, m="glass", seg=48)
for k in range(12):
    a = tau * k / 12
    b.tube([(r * cos(a), r * sin(a), z) for r, z in E[:-1]] + [(0.5 * cos(a), 0.5 * sin(a), 20.88)], 0.13, "white", seg=6)
for (r, z) in (E[2], E[4]):
    b.tube([(r * cos(tau * i / 32), r * sin(tau * i / 32), z) for i in range(32)], 0.11, "white", seg=6, closed=True)
b.lathe([(0, 20.75), (0.75, 20.85), (1.0, 21.4), (0.8, 22.1), (0.3, 22.7), (0, 23.0)], m="pink", seg=16)   # bud finial
for a in (0.4, 0.4 + pi):
    b.ball(1.0, (1.15 * cos(a), 1.15 * sin(a), 20.95), "leaf_light", sc=(1.0, 0.45, 0.16), u=10, v=6, rot=(0, -0.35, a))
dome = b.obj("Mall_Dome", RF); dome.visible_shadow = False

# ---- balustrades
def rail(b, seen, p0, p1, z, accent):
    (x0, y0), (x1, y1) = p0, p1; L = math.hypot(x1 - x0, y1 - y0); nn = max(1, round(L / 2.4))
    for i in range(nn + 1):
        px, py = round(x0 + (x1 - x0) * i / nn, 3), round(y0 + (y1 - y0) * i / nn, 3)
        if (px, py) in seen: continue
        seen.add((px, py))
        b.cyl(0.08, 1.0, (px, py, z), "white", seg=6)
        b.ball(0.14, (px, py, z + 1.12), accent, sc=(1, 1, 1.35), u=6, v=4)
    hz = abs(x1 - x0) > abs(y1 - y0); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    b.box((L - 0.2, 0.04, 0.7) if hz else (0.04, L - 0.2, 0.7), (cx, cy, z + 0.52), "glass")
    b.tube([(x0, y0, z + 0.98), (x1, y1, z + 0.98)], 0.055, "white", seg=6)
    b.box((L, 0.1, 0.09) if hz else (0.1, L, 0.09), (cx, cy, z + 0.11), accent, r=0.03, seg=1)

for lv, z in ((2, 5.0), (3, 10.0)):
    R_ = [((10, -9.7), (10, 9.7)), ((-10, 9.7), (10, 9.7)), ((-10, -9.7), (10, -9.7)), ((-10, 16.3), (10, 16.3))]
    for sx in (-10, 10): R_ += [((sx, 16.3), (sx, 21.7)), ((sx, -21.7), (sx, -16.3))]
    if lv == 2:
        R_ += [((-10, -9.7), (-10, -2.2)), ((-10, 2.2), (-10, 9.7)), ((-10, 2.2), (-15, 2.2)), ((-10, -2.2), (-15, -2.2)),
               ((-6.7, -16.3), (10, -16.3))]
    else:
        R_ += [((-10, -9.7), (-10, 9.7)), ((-16, 2.2), (-25.1, 2.2)), ((-16, -2.2), (-25.1, -2.2)), ((-25.1, -2.2), (-25.1, 2.2)),   # open at the east end, where the 2 to 3 escalators arrive
              
               ((-6.7, -16.3), (10, -16.3)), ((-10, -16.3), (-8.5, -16.3))]
    b = B(); seen = set()
    for p0, p1 in R_: rail(b, seen, p0, p1, z, ACC[lv])
    b.obj(f"Mall_Balustrade_L{lv}", FIT)

# ---- entrance wall, doors and glazed front
b = B()
for sx in (-1, 1):
    b.box2((sx * 4.3, 21.76, 0), (sx * 10, 22.3, 4.6), "cream")
    b.box2((sx * 1.65, 21.96, 0.06), (sx * 3.95, 22.04, 4.3), "glass")
    for x in (1.6, 4.0): b.box((0.12, 0.16, 4.4), (sx * x, 22.0, 2.2), "white", r=0.03, seg=1)
b.box2((-4.06, 21.92, 4.3), (4.06, 22.08, 4.46), "white", r=0.03, seg=1)
for z in (4.6, 9.6): b.box2((-10, 21.76, z), (10, 22.3, z + 0.4), "terracotta", r=0.06)
b.box2((-10, 21.97, 5.0), (10, 22.03, 14.72), "glass")
for i in range(9):
    b.box((0.16, 0.26, 9.72), (-10 + 2.5 * i, 22.0, 9.86), "white", r=0.04, seg=1)
b.tube([(2.1 * cos(tau * i / 32), 22.14, 12.35 + 2.1 * sin(tau * i / 32)) for i in range(32)], 0.13, "gold", seg=8, closed=True)
bloom(b, (0, 22.2, 12.35), 1.9, "+y", "pink", "yellow")
b.obj("Mall_Entrance_Front", SH)

g = M("glass")
try: g.use_transparent_shadow = True
except Exception: pass
rep = {"superseded": gone, "shell_objects": len(SH.objects), "roof_objects": len(RF.objects), "fitout": len(FIT.objects)}
bpy.app.driver_namespace["gk_report"] = rep
print("P03", rep)
