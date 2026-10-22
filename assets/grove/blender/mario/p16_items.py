"""Pass 16: placement audit for loose items (anything small that should rest on a shelf, table, counter or floor).
For each item it measures, against the other objects only:
  gap    distance from its underside to the surface beneath (+ hovering, - sunk in)
  poke   how far it sticks up through a surface above it
  cover  share of five probe points under it that find a surface (low = hanging off an edge)
Mode comes from bpy.app.driver_namespace['gk_items']: 'report' (default) or 'fix'."""
import bpy, re, collections, statistics
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from gk import *

MODE = bpy.app.driver_namespace.get("gk_items", "report"); sc = bpy.context.scene
skipc = {"MARIO_BACKDROP", "MARIO_SCALE_REFERENCE", "MARIO_LIGHTS"}
objs = [o for o in sc.objects if o.type == "MESH" and o.visible_get() and len(o.data.polygons) and not (set(c.name for c in o.users_collection) & skipc)]
ATTACHED = re.compile(r"(Label|Sign|Text|Title|Tag|Handle|Hook|Cord|Pendant|Rose|Shade|Light|Glow|Rail|Vine|Leaf|Petal|Bloom|Stripe|Awning|Banner|Badge|Menu_Item|Stem|Lace|Strap|Spout|Nozzle|Neck|Lid|Cap|Surface|Shoulder|Sleeve|Canopy|Flower|trouser|shirt|jacket|Rope|Torso|Skirt|Mannequin|Wrap|Core|Lantern|Bracket|Group|Knob|Dial|Screen|Trunk|Shrub|Plant_)")
FIXN = re.compile(r"(Shelf|Table|Top|Counter|Plinth|Ledge|Board|Tray|Island|Desk|Workbench|Display|Riser|Pedestal|Crate|Sill|Bench|Rack)")
STRUCT = re.compile(r"(Leg|Post|Pole|Planter|Vase|Kettle|Boot|Island|Stand|Base)")
CARRIER = re.compile(r"(Crate|Basket|Tray|Plate|Box|Bowl|Board|Pot|Vase|Jar|Bag|Stand|Dish|Saucer|Cup)")
def build(o):
    mw = o.matrix_world; vs = [mw @ v.co for v in o.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return [o, BVHTree.FromPolygons(vs, [tuple(p.vertices) for p in o.data.polygons], epsilon=0.0), mn, mx]
data = [build(o) for o in objs]; n = len(data)
GX = collections.defaultdict(list)                      # coarse XY grid for neighbour lookup
def cells(mn, mx):
    return [(i, j) for i in range(int(mn.x // 2), int(mx.x // 2) + 1) for j in range(int(mn.y // 2), int(mx.y // 2) + 1)]
for k, d in enumerate(data):
    for c in cells(d[2], d[3]): GX[c].append(k)
DOWN, UP = Vector((0, 0, -1)), Vector((0, 0, 1)); SUPJ = {}; POKJ = {}
def probe(k):
    o, t, mn, mx = data[k]; h = mx.z - mn.z; z0 = mn.z + min(0.5 * h, 0.12); cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
    cand = {j for c in cells(mn, mx) for j in GX[c] if j != k}
    sup = []; hits = 0; area_k = (mx.x - mn.x) * (mx.y - mn.y); fitted = None
    for j in cand:
        oj, tj, a, b_ = data[j]
        aj = (b_.x - a.x) * (b_.y - a.y)
        if a.z < mn.z + 0.001 and mn.z + 0.004 < b_.z and b_.z - mn.z < 0.25 and aj < 0.8 * area_k:
            w = min(mx.x, b_.x) - max(mn.x, a.x); hh = min(mx.y, b_.y) - max(mn.y, a.y)
            if w > 0 and hh > 0 and w * hh >= 0.3 * aj:
                fitted = j; break
    if fitted is not None:
        SUPJ[k] = fitted; POKJ[k] = None; return mn.z, 0.0, 1.0
    PR = ((0, 0), (0.3, 0.3), (-0.3, 0.3), (0.3, -0.3), (-0.3, -0.3), (0.42, 0), (-0.42, 0), (0, 0.42), (0, -0.42), (0.42, 0.42), (-0.42, 0.42), (0.42, -0.42), (-0.42, -0.42))
    for fx, fy in PR:
        px, py = cx + fx * (mx.x - mn.x), cy + fy * (mx.y - mn.y); best = None; bj = None
        for j in cand:
            oj, tj, a, b_ = data[j]
            if px < a.x or px > b_.x or py < a.y or py > b_.y or a.z > z0: continue
            org = Vector((px, py, z0))
            for _ in range(4):                           # walk down through faces until an upward-facing one
                hloc, hn, hi, hd = tj.ray_cast(org, DOWN)
                if hloc is None: break
                if hn.z > 0.3:
                    if best is None or hloc.z > best: best = hloc.z; bj = j
                    break
                org = Vector((px, py, hloc.z - 0.001))
        if best is not None and mn.z - best < 0.6:
            hits += 1; sup.append((best, bj))
    zs = max(sup)[0] if sup else None; SUPJ[k] = max(sup)[1] if sup else None
    poke = 0.0; POKJ[k] = None
    for j in cand:
        oj, tj, a, b_ = data[j]
        if cx < a.x or cx > b_.x or cy < a.y or cy > b_.y or b_.z < z0: continue
        hloc, hn, hi, hd = tj.ray_cast(Vector((cx, cy, z0)), UP)
        if hloc is not None and hn.z < -0.3 and hloc.z < mx.z - 0.01 and mx.z - hloc.z > poke: poke = mx.z - hloc.z; POKJ[k] = j
    return zs, poke, hits / len(PR)
def riders(k, seen=None):
    seen = seen if seen is not None else set(); o, t, mn, mx = data[k]
    for j in {j for c in cells(mn, mx) for j in GX[c] if j != k}:
        if j in seen: continue
        oj, tj, a, b_ = data[j]
        if a.z < mx.z - 0.06 or a.z > mx.z + 0.04: continue
        w = min(mx.x, b_.x) - max(mn.x, a.x); h = min(mx.y, b_.y) - max(mn.y, a.y)
        if w > 0 and h > 0 and w * h > 0.3 * (b_.x - a.x) * (b_.y - a.y):
            seen.add(j); riders(j, seen)
    return seen
TREE2 = {}
def tree2(j):
    if j not in TREE2:
        o = data[j][0]; mw = o.matrix_world
        TREE2[j] = BVHTree.FromPolygons([mw @ v.co for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons], epsilon=0.02)
    return TREE2[j]
def attached(k):
    o, t, mn, mx = data[k]; vol = max((mx.x - mn.x) * (mx.y - mn.y) * (mx.z - mn.z), 1e-6); out_ = set(); sj = SUPJ.get(k)
    for j in {j for c in cells(mn, mx) for j in GX[c] if j != k and j != sj}:
        oj, tj, a, b_ = data[j]
        if a.x > mx.x + 0.03 or b_.x < mn.x - 0.03 or a.y > mx.y + 0.03 or b_.y < mn.y - 0.03 or a.z > mx.z + 0.03 or b_.z < mn.z - 0.03: continue
        vj = (b_.x - a.x) * (b_.y - a.y) * (b_.z - a.z)
        if FIXN.search(oj.name) or vj >= vol: continue
        if not (ATTACHED.search(oj.name) or vj < 0.35 * vol): continue
        if tree2(k).overlap(tree2(j)): out_.add(j)
    return out_
def party(k):
    g = set(riders(k)) | attached(k)
    for r_ in list(g): g |= attached(r_)
    g.discard(k); return [k] + list(g)
def refresh(group):
    bpy.context.view_layer.update()
    for g in group:
        nd = build(data[g][0]); data[g][1], data[g][2], data[g][3] = nd[1], nd[2], nd[3]; TREE2.pop(g, None)
BOARD = re.compile(r"(Shelf|Top|Board|Tray|Ledge|Counter|Table)")
def slot_fit(k):
    """A product and its fitted parts (neck, cap, lid, label) must clear the thin board above its own shelf."""
    o, t, mn, mx = data[k]; base = mn.z
    grp = [k] + list(attached(k)) + [r for r in riders(k) if ATTACHED.search(data[r][0].name)]
    x0 = min(data[g][2].x for g in grp); x1 = max(data[g][3].x for g in grp); y0 = min(data[g][2].y for g in grp); y1 = max(data[g][3].y for g in grp)
    top = max(data[g][3].z for g in grp); best = None
    for j in {j for c in cells(Vector((x0, y0, 0)), Vector((x1, y1, 0))) for j in GX[c] if j not in grp}:
        oj, tj, a, b_ = data[j]
        if not BOARD.search(oj.name) or (b_.z - a.z) > 0.15 or a.z < base + 0.05 or a.z > top: continue
        w = min(x1, b_.x) - max(x0, a.x); h = min(y1, b_.y) - max(y0, a.y)
        if w > 0 and h > 0 and w * h > 0.3 * (x1 - x0) * (y1 - y0) and (best is None or a.z < best[0]): best = (a.z, b_.z)
    if best is None: return None
    grp = [g for g in grp if g == k or data[g][2].z < best[1] - 0.005]
    top = max(data[g][3].z for g in grp)
    if top <= best[0] - 0.008: return None
    return grp, max(0.4, (best[0] - 0.015 - base) / (top - base))
def is_item(d):
    o, t, mn, mx = d
    if o.name.startswith(("Mall_", "GrovePark_", "Shop_", "Atrium_Fountain_Bloom", "Atrium_Kiosk", "Atrium_Pend", "Support_", "Backdrop_")): return False
    if any(c.name.startswith("MARIO_") for c in o.users_collection): return False
    dx, dy, dz = mx.x - mn.x, mx.y - mn.y, mx.z - mn.z
    return max(dx, dy) <= 1.2 and dz <= 1.0 and min(dx, dy, dz) >= 0.03 and not ATTACHED.search(o.name)
items = sorted([k for k in range(n) if is_item(data[k])], key=lambda k: data[k][2].z)
rows = collections.defaultdict(list); fixed = collections.Counter(); bad = 0; MOVED = collections.Counter()
for k in items:
    zs, poke, cover = probe(k); o, t, mn, mx = data[k]
    gap = None if zs is None else mn.z - zs
    stem = re.sub(r"-?\d+(\.\d+)?", "#", o.name)
    wrong = (gap is None and mn.z > 0.3) or (gap is not None and abs(gap) > 0.008) or poke > 0.015 or cover < 0.6
    if wrong:
        bad += 1; rows[stem].append((None if gap is None else round(gap, 3), round(poke, 3), cover, o.users_collection[0].name[:14]))
    if MODE == "fix" and SUPJ.get(k) is not None:              # resting on a fixture: no part of the item may hang past its edge
        j = SUPJ[k]; a, b_ = data[j][2], data[j][3]; area_k = (mx.x - mn.x) * (mx.y - mn.y)
        flat_decal = (b_.z - a.z) < 0.1 and not FIXN.search(data[j][0].name)        # mats, rugs and floor inlays are not edges to respect
        if not flat_decal and (FIXN.search(data[j][0].name) or (b_.x - a.x) * (b_.y - a.y) >= 1.5 * area_k):
            m_ = 0.02; sx = sy = 0.0
            if (mx.x - mn.x) + 2 * m_ <= b_.x - a.x: sx = max(a.x + m_ - mn.x, 0) + min(b_.x - m_ - mx.x, 0)
            if (mx.y - mn.y) + 2 * m_ <= b_.y - a.y: sy = max(a.y + m_ - mn.y, 0) + min(b_.y - m_ - mx.y, 0)
            if abs(sx) + abs(sy) > 0.03:
                MOVED[stem + " -> " + re.sub(r"-?\d+(\.\d+)?", "#", data[j][0].name)] += 1
                grp_ = party(k)
                for g in grp_: data[g][0].matrix_world = Matrix.Translation((sx, sy, 0)) @ data[g][0].matrix_world
                fixed["pulled_inside_edge"] += 1; refresh(grp_)
                zs, poke, cover = probe(k); mn, mx = data[k][2], data[k][3]; gap = None if zs is None else mn.z - zs
                wrong = (gap is None and mn.z > 0.3) or (gap is not None and abs(gap) > 0.008) or poke > 0.015 or cover < 0.6
    if MODE == "fix" and (cover < 0.6 or (gap is None and mn.z > 0.3)):
        j = SUPJ.get(k); rdx = riders(k); area_k = (mx.x - mn.x) * (mx.y - mn.y)
        if j is None or cover == 0:                          # nothing under it: look for the nearest surface at its own height
            bestd = None
            for c in {c for c in cells(mn - Vector((1, 1, 0)), mx + Vector((1, 1, 0)))}:
                for jj in GX[c]:
                    if jj == k or jj in rdx: continue
                    a, b_ = data[jj][2], data[jj][3]
                    if abs(b_.z - mn.z) > 0.06 or (b_.x - a.x) * (b_.y - a.y) < area_k: continue
                    dx = max(a.x - mx.x, mn.x - b_.x, 0); dy = max(a.y - mx.y, mn.y - b_.y, 0); dd = (dx * dx + dy * dy) ** 0.5
                    if dd <= 1.0 and (bestd is None or dd < bestd): bestd = dd; j = jj
        if j is not None:
            a, b_ = data[j][2], data[j][3]; m_ = 0.02; sx = sy = 0.0
            if (mx.x - mn.x) + 2 * m_ <= b_.x - a.x: sx = max(a.x + m_ - mn.x, 0) + min(b_.x - m_ - mx.x, 0)
            else: sx = (a.x + b_.x) / 2 - (mn.x + mx.x) / 2
            if (mx.y - mn.y) + 2 * m_ <= b_.y - a.y: sy = max(a.y + m_ - mn.y, 0) + min(b_.y - m_ - mx.y, 0)
            else: sy = (a.y + b_.y) / 2 - (mn.y + mx.y) / 2
            if abs(sx) + abs(sy) > 0.004:
                grp_ = party(k)
                for g in grp_: data[g][0].matrix_world = Matrix.Translation((sx, sy, 0)) @ data[g][0].matrix_world
                fixed["moved_onto_support"] += 1; refresh(grp_)
                zs, poke, cover = probe(k); mn, mx = data[k][2], data[k][3]; gap = None if zs is None else mn.z - zs
    if MODE == "fix" and not STRUCT.search(o.name):
        sf = slot_fit(k)
        if sf:
            grp_, fac = sf; piv = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
            Ms = Matrix.Translation(piv) @ Matrix.Scale(fac, 4) @ Matrix.Translation(-piv)
            for g in grp_: data[g][0].matrix_world = Ms @ data[g][0].matrix_world
            fixed["fitted_to_slot"] += 1; refresh(grp_)
            zs, poke, cover = probe(k); mn, mx = data[k][2], data[k][3]; gap = None if zs is None else mn.z - zs
            wrong = (gap is None and mn.z > 0.3) or (gap is not None and abs(gap) > 0.008) or poke > 0.015 or cover < 0.6
    if MODE == "fix" and wrong and gap is not None:
        pj = POKJ.get(k)
        if 0.015 < poke <= 0.4 and pj is not None and FIXN.search(data[pj][0].name) and not STRUCT.search(o.name):   # too tall for its slot
            h = mx.z - mn.z; sfac = max(0.5, (h - poke - 0.015) / h); piv = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
            Ms = Matrix.Translation(piv) @ Matrix.Scale(sfac, 4) @ Matrix.Translation(-piv); grp_ = [k] + list(attached(k))
            for g in grp_: data[g][0].matrix_world = Ms @ data[g][0].matrix_world
            fixed["shrunk"] += 1; refresh(grp_)
        rd = riders(k); myarea = (mx.x - mn.x) * (mx.y - mn.y)
        carrier = bool(CARRIER.search(o.name)) or (bool(rd) and all((data[j][3].x - data[j][2].x) * (data[j][3].y - data[j][2].y) <= myarea * 1.05 for j in rd))
        if rd and not carrier: continue                      # something larger stands on it: structural, leave it
        group = party(k) if (carrier or not rd) else [k]
        if poke > 0.05 and gap <= 0.05 and not carrier: continue    # pierced from above and not hovering: a fitted part
        if abs(gap) > 0.008 and -0.3 < gap < 0.45:
            for g in group:
                data[g][0].matrix_world = Matrix.Translation((0, 0, -gap + 0.002)) @ data[g][0].matrix_world
            fixed["reseated"] += 1; refresh(group)
            zs2, poke, cover2 = probe(k); mn, mx = data[k][2], data[k][3]
out = sorted(rows.items(), key=lambda kv: -len(kv[1]))
def summ(v):
    g = [x[0] for x in v if x[0] is not None]
    return {"n": len(v), "gap_med": round(statistics.median(g), 3) if g else None, "gap_min": min(g) if g else None, "gap_max": max(g) if g else None,
            "poke_max": max(x[1] for x in v), "cover_min": min(x[2] for x in v), "none": sum(1 for x in v if x[0] is None), "shop": v[0][3]}
bpy.app.driver_namespace["gk_report"] = {"items_checked": len(items), "wrong": bad, "fixed": dict(fixed), "pulled": MOVED.most_common(80), "groups": [(k, summ(v)) for k, v in out[:70]]}
