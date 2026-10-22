"""Pass 5b: rebuild the park on Codex's layout with the Grove kit. The park and mall now sit on a rounded
island with a striped cliff. Codex's primitive trees, shrubs, flowers, lanterns, benches, paths and ground are
moved to GROVE_SUPERSEDED_BY_MARIO_PASS; the Bloom Chimes, Ripple Basin, entrance and secret bloom stay."""
import bpy, bmesh, math, re
from gk import *

KM = lambda n: bpy.data.meshes[n]
def centre(o):
    a, c = wbb(o); return ((a.x + c.x) / 2, (a.y + c.y) / 2)
def groups(prefix, pat, default):
    g = {}
    for o in named(prefix):
        m = re.match(pat, o.name)
        if m: g.setdefault(m.group(1), []).append(centre(o))
    out = [(sum(p[0] for p in v) / len(v), sum(p[1] for p in v) / len(v)) for k, v in sorted(g.items())]
    return out or default
trees = groups("Refined_Park_Tree_", r"Refined_Park_Tree_(\d+)_Trunk", [(-22, 30), (22, 30), (-22, 42), (22, 42), (-10, 45), (10, 45)])
shrubs = groups("Refined_Park_Shrub_", r"Refined_Park_Shrub_(\d+)_Lobe", [(-18, 31), (18, 31), (-18, 43), (18, 43)])
flowers = groups("Park_Flower_", r"Park_Flower_(\d+_\d+)_Center", [])
lamps = groups("Park_Lantern_", r"Park_Lantern_(\d+)_Post", [(-5, 29.4), (5, 29.4), (-5, 42.2), (5, 42.2)])

gone = supersede(named("Arrival_Apron", "Arrival_Main_Path", "Park_Bench", "Park_Cross_Path", "Park_Ground", "Park_Shrub", "Park_Tree_", coll="GROVE_PARK_ARRIVAL_REFINEMENT")
    + named("Park_Flower_", "Park_Lantern_", "Park_Left_Loop_Path", "Park_Main_Curved_Path", "Park_Right_Loop_Path", "Park_Terrain_Mound", "Refined_Park_Ground", "Tree_Well", coll="GROVE_PARK_DETAIL_REFINEMENT")
    + named("Refined_Park_", "Refined_Roof_Shrub", coll="GROVE_VEGETATION_REFINEMENT"))
P = fresh("MARIO_PARK", "GROVE_PARK_DETAIL_REFINEMENT")
RAIN = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"]

# ---- island: lawn ring around the mall footprint, striped cliff, soft turf lip
def sd_rr(px, py, cx, cy, hx, hy, r):
    qx = abs(px - cx) - (hx - r); qy = abs(py - cy) - (hy - r)
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r
n = 96; X, Y = 30.0, 22.0; inner = []; outer = []
for k in range(n):
    a = tau * k / n; c, s_ = cos(a), sin(a)
    t_ = min(X / abs(c) if abs(c) > 1e-9 else 1e9, Y / abs(s_) if abs(s_) > 1e-9 else 1e9); inner.append([c * t_, s_ * t_])
    lo, hi = 0.0, 150.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if sd_rr(c * mid, s_ * mid, 0, 13, 39, 44, 12) < 0: lo = mid
        else: hi = mid
    outer.append((c * lo, s_ * lo))
for cx, cy in ((X, Y), (-X, Y), (-X, -Y), (X, -Y)):
    k = min(range(n), key=lambda i: (inner[i][0] - cx) ** 2 + (inner[i][1] - cy) ** 2); inner[k] = [cx, cy]
b = B(); t = bmesh.new()
vi = [t.verts.new((x, y, 0)) for x, y in inner]; vo = [t.verts.new((x, y, 0)) for x, y in outer]; vb = [t.verts.new((x * 0.985, y * 0.985 + 0.2, -6)) for x, y in outer]
iL, iC = b.mi("lawn_tex"), b.mi("cliff_tex")
for k in range(n):
    j = (k + 1) % n
    t.faces.new((vi[k], vo[k], vo[j], vi[j])).material_index = iL
    t.faces.new((vo[k], vb[k], vb[j], vo[j])).material_index = iC
b._add(t, None)
b.tube([(x * 1.004, (y - 13) * 1.004 + 13, -0.3) for x, y in outer], 0.42, "lawn", seg=8, closed=True)
isl = b.obj("GrovePark_Island", P)
if any(p.normal.z < -0.5 for p in isl.data.polygons if p.material_index == 0 and abs(p.normal.z) > 0.5):
    isl.data.flip_normals(); hard_normals(isl.data, 50)

# ---- paths: sand border under a brick top, plazas above paths
def smooth(pts, sub=6):
    Q = [Vector((p[0], p[1])) for p in pts]; out = []
    for i in range(len(Q) - 1):
        p0, p1, p2, p3 = Q[max(i - 1, 0)], Q[i], Q[i + 1], Q[min(i + 2, len(Q) - 1)]
        for s in range(sub):
            u = s / sub
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    out.append(Q[-1]); return out
def ribbon(b, pts, w, z, m):
    c = smooth(pts); L = []; R = []
    for i, p in enumerate(c):
        d = (c[min(i + 1, len(c) - 1)] - c[max(i - 1, 0)]).normalized(); nr = Vector((-d.y, d.x))
        L.append(p + nr * w / 2); R.append(p - nr * w / 2)
    b.prism([(p.x, p.y) for p in L] + [(p.x, p.y) for p in reversed(R)], z + 0.02, m, loc=(0, 0, -0.02))
def disc(b, c, r, z, m, clip=None, nn=40):
    pts = [(c[0] + r * cos(tau * i / nn), c[1] + r * sin(tau * i / nn)) for i in range(nn)]
    if clip is not None: pts = [(x, max(y, clip)) for x, y in pts]
    b.prism(pts, z + 0.02, m, loc=(0, 0, -0.02))
def path(b, pts, w, lvl):
    ribbon(b, pts, w + 0.56, (0.03, 0.026, 0.022)[lvl], "sand"); ribbon(b, pts, w, (0.06, 0.052, 0.044)[lvl], "path_tex")
def plaza(b, c, r, clip=None):
    disc(b, c, r + 0.3, 0.03, "sand", clip); disc(b, c, r, 0.06, "path_tex", clip)
b = B()
plaza(b, (0, 24.5), 7.5, 22.35); plaza(b, (0, 44.6), 3.4); plaza(b, (15.5, 34.5), 4.9); plaza(b, (-15.5, 34.5), 4.4)
path(b, [(0, 30), (0.9, 34), (0, 38), (-0.9, 41.5), (0, 44.5)], 4.2, 1)
for sx in (-1, 1):
    path(b, [(sx * 1.8, 38), (sx * 6, 38.7), (sx * 10, 37.7), (sx * 12, 36.5)], 2.6, 2)
    path(b, [(sx * 5.5, 27.5), (sx * 9, 29.5), (sx * 12, 31.6), (sx * 13, 32.2)], 2.6, 2)
b.obj("GrovePark_Paths", P)

# ---- hedges, gate arch, tiered platforms, signpost, bunting
b = B()
for (p0, p1) in (((-30.3, 22.7, 0), (-29.4, 49.3, 0.95)), ((29.4, 22.7, 0), (30.3, 49.3, 0.95)), ((-30.3, 48.4, 0), (-3.7, 49.3, 0.95)), ((3.7, 48.4, 0), (30.3, 49.3, 0.95))):
    b.box2(p0, p1, "leaf_dark", r=0.4, seg=3)
posts = [(sx * 29.85, y) for sx in (-1, 1) for y in (23.2, 29.6, 36, 42.4, 48.85)] + [(x, 48.85) for x in (-23.2, -16.6, -10, 10, 16.6, 23.2)]
for (x, y) in posts:
    b.cyl(0.17, 1.25, (x, y, 0), "white", seg=8); b.lathe([(0, 1.22), (0.2, 1.3), (0.27, 1.5), (0.16, 1.74), (0, 1.84)], (x, y, 0), "pink", seg=8)
for sx in (-1, 1):
    b.lathe([(0.42, 0), (0.42, 0.2), (0.28, 0.4), (0.26, 3.1), (0.36, 3.25), (0.36, 3.4)], (sx * 3.2, 48.85, 0), seg=12, mats=["gold", "gold", "white", "gold", "gold"])
arc = [(3.2 * cos(radians(a)), 48.85, 3.4 + 1.7 * sin(radians(a))) for a in range(0, 181, 12)]
b.tube(arc, 0.2, "green", seg=8)
for i, p in enumerate(arc[1:-1]):
    b.ball(1.0, (p[0], 48.85 + (0.22 if i % 2 else -0.22), p[2] + 0.1), "leaf_light", sc=(0.34, 0.12, 0.2), u=6, v=4, rot=(0, 0.4 if p[0] > 0 else -0.4, 0))
bloom(b, (0, 49.12, 5.25), 0.7, "+y"); bloom(b, (0, 48.58, 5.25), 0.7, "-y")
def tier(b, x, y, z, r, h):
    b.lathe([(r, z), (r, z + h - 0.12), (r + 0.12, z + h - 0.06), (r + 0.12, z + h), (0, z + h)], (x, y, 0), seg=24, cap=False,
            mats=["cliff_tex", "lawn", "lawn", "lawn_tex"])
tier(b, 34.2, 45, 0, 3.6, 1.4); tier(b, 34.6, 45.4, 1.4, 2.2, 1.1); tier(b, -34.5, 25.5, 0, 3.1, 1.2)
tier(b, -35, -24, 0, 3.0, 1.6); tier(b, 34.5, -22, 0, 3.4, 1.3); tier(b, 34.5, -22, 1.3, 2.0, 1.0)
b.obj("GrovePark_Hedges_Gate_Tiers", P)

b = B()
b.cyl(0.09, 2.5, (3.3, 36.3, 0), "white", seg=8); b.lathe([(0, 2.48), (0.16, 2.54), (0.2, 2.7), (0.1, 2.88), (0, 2.94)], (3.3, 36.3, 0), "pink", seg=8)
def leaf_pts(L, w, k=8):
    up = [(L * i / k, w * math.sin(pi * i / k) ** 0.75) for i in range(k + 1)]; return up + [(x, -y) for x, y in up[-2:0:-1]]
b.prism(leaf_pts(1.9, 0.36), 0.08, "leaf_light", mtx=XZ(36.26) @ Matrix.Translation((3.4, 2.1, 0)), r=0.02)
b.text("CHIMES", 0.24, (4.35, 36.35, 2.1), "white", face="+y", extrude=0.015, bevel=0.004)
b.prism(leaf_pts(1.9, 0.36), 0.08, "pink", mtx=XZ(36.26) @ Matrix.Translation((3.2, 1.45, 0)) @ Matrix.Scale(-1, 4, (1, 0, 0)), r=0.02)
b.text("POND", 0.24, (2.25, 36.35, 1.45), "white", face="+y", extrude=0.015, bevel=0.004)
def bunting(b, p0, p1, sag=0.6, k=9):
    p0, p1 = Vector(p0), Vector(p1); pts = []
    for i in range(13):
        u = i / 12; q = p0.lerp(p1, u); q.z -= sag * 4 * u * (1 - u); pts.append(q)
    b.tube(pts, 0.02, "white", seg=4)
    ang = math.atan2(p1.y - p0.y, p1.x - p0.x)
    for i in range(k):
        u = (i + 0.5) / k; q = p0.lerp(p1, u); q.z -= sag * 4 * u * (1 - u) + 0.02
        b.prism([(-0.17, 0), (0.17, 0), (0, -0.38)], 0.02, RAIN[i % 8], mtx=Matrix.Translation(q) @ Matrix.Rotation(ang, 4, "Z") @ XZ(-0.01))
front = sorted(lamps, key=lambda p: p[1])[:2]
for (lx, ly) in front:
    sx = 1 if lx > 0 else -1
    bunting(b, (sx * 5.5, 25.6, 4.85), (lx, ly, 4.0)); bunting(b, (lx, ly, 4.0), (sx * 12.5, 23.3, 3.6), 0.8, 11)
b.obj("GrovePark_Signs_Bunting", P)

# ---- planting and furniture from the kit
TT = ["GK_Tree_Round", "GK_Tree_Blossom", "GK_Tree_Citrus", "GK_Tree_Round", "GK_Tree_Tier", "GK_Tree_Blossom"]
for i, (x, y) in enumerate(trees):
    inst(f"GrovePark_Tree_{i}", KM(TT[i % 6]), P, (x, y, 0), rz=i * 1.3, sc=1.05 + 0.12 * (i % 3))
extra = [(-34, 33, 0, 1.2), (35, 37, 0, 1.15), (-33.5, 47.5, 0, 1.0), (-12.5, 53, 0, 1.25), (12.5, 53.2, 0, 1.1), (-35, -6, 0, 1.2), (35, 9, 0, 1.25),
         (-34.8, 15, 0, 1.0), (34.6, -9, 0, 1.05), (-10, -27.5, 0, 1.2), (8, -27.2, 0, 1.1), (34.6, 45.4, 2.5, 1.0), (-34.5, 25.5, 1.2, 1.1), (-35, -24, 1.6, 1.0), (34.5, -22, 2.3, 0.95)]
for i, (x, y, z, s) in enumerate(extra):
    kind = TT[(i + 2) % 6]      # beyond the hedge nobody gets close: the lighter _Far crowns
    inst(f"GrovePark_Tree_Outer_{i}", KM(kind if kind.endswith("Tier") else kind + "_Far"), P, (x, y, z), rz=i * 2.1, sc=s)
for i, (x, y, r, h) in enumerate([(-34.5, 41, 4.4, 3.2), (34.8, 29.5, 3.8, 2.8), (-22, 53, 5, 2.6), (24, 53.5, 4.4, 2.4), (-18, -27.2, 5, 2.5), (21, -27.5, 6, 3), (35.6, -1, 3, 2.6), (-35.6, 5, 3, 2.8)]):
    inst(f"GrovePark_Hill_{i}", KM("GK_Hill"), P, (x, y, -0.02), sc=(r, r * (0.72 if abs(y) > 50 or y < -25 else 1), h))
for i, (x, y) in enumerate(shrubs + [(-9.2, 23.4), (9.2, 23.4), (-18, 23.5), (18, 23.5), (-27.3, 23.6), (27.3, 23.6), (-26, 46.5), (26, 46.8), (-6.5, 46.8), (6.5, 46.8), (-33, 20), (33.5, 18), (0, -26.5)]):
    if math.hypot(x + 15.5, y - 34.5) < 4.0: x, y = -12.6, 37.5      # this one sat on the rim of the park fountain
    inst(f"GrovePark_Bush_{i}", KM("GK_Bush"), P, (x, y, 0), rz=i * 1.9, sc=0.9 + 0.18 * (i % 3))
FC = ["pink", "yellow", "white", "red"]
ring = [(15.5 + 5.7 * cos(a), 34.5 + 5.7 * sin(a)) for a in (0.2, 0.9, 5.4, 6.0)] + [(-15.5 + 5.2 * cos(a), 34.5 + 5.2 * sin(a)) for a in (2.3, 3.0, 3.7, 4.3)] \
     + [(sx * (4.6 + 0.7 * k), 46.9 + 0.4 * (k % 2)) for sx in (-1, 1) for k in range(3)] + [(sx * (8.6 + 0.8 * k), 24.6 + 0.5 * (k % 2)) for sx in (-1, 1) for k in range(2)]
for i, (x, y) in enumerate(list(flowers) + ring):
    inst(f"GrovePark_Flower_{i}", KM("GK_Flower_" + FC[i % 4]), P, (x, y, 0), rz=i * 0.9, sc=1.25 + 0.2 * (i % 3))
for i, (x, y) in enumerate(lamps + [(11.2, 39.6), (-11.2, 39.4), (3.6, 47.4), (-3.6, 47.4), (20.6, 31.5), (-20.2, 31.8)]):
    inst(f"GrovePark_Lamp_{i}", KM("GK_Lamp"), P, (x, y, 0))
for i, (x, y, rz) in enumerate([(15.5, 40.1, 0), (-15.5, 39.6, 0), (-3.5, 41.4, pi / 2), (3.6, 33.6, -pi / 2), (21.2, 34.5, -pi / 2), (-20.7, 34.5, pi / 2)]):
    inst(f"GrovePark_Bench_{i}", KM("GK_Bench"), P, (x, y, 0.03), rz=rz)
for i, (x, y) in enumerate([(-10.4, 25.3), (10.4, 25.3)]):
    inst(f"GrovePark_Table_{i}", KM("GK_Umbrella_Table"), P, (x, y, 0), rz=i * 0.7)
for i, (x, y) in enumerate([(-6.7, 26.5), (6.7, 26.5)]):
    inst(f"GrovePark_Balloons_{i}", KM("GK_Balloons"), P, (x, y, 0), rz=i * 2.0)
for i, (x, y, s) in enumerate([(-19.3, 37.4, 1.0), (-12.2, 31.4, 0.8), (24, 39, 1.2), (-25, 28.5, 1.1), (27.5, 44, 0.9), (-31, 44.5, 1.3), (31.5, 26.5, 1.0)]):
    inst(f"GrovePark_Rock_{i}", KM("GK_Rock"), P, (x, y, 0), rz=i * 1.1, sc=s)
rep = {"superseded": gone, "park_objects": len(P.objects), "codex_layout": {"trees": len(trees), "shrubs": len(shrubs), "flowers": len(flowers), "lamps": len(lamps)}}
bpy.app.driver_namespace["gk_report"] = rep
