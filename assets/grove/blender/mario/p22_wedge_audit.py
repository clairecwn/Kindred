"""Pass 22: look for stock that is wedged into something. Every placed product (face attribute 'pid') is tested against the
shop's fixtures and kept pieces, and against neighbouring products: a vertex that lies deeper than the tolerance inside
another solid is reported. Baskets, trays and buckets are meant to hold things, so their contents are not counted."""
import bpy, collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ns = bpy.app.driver_namespace; ARGS = ns.get("gk_args") or {}; rep = {}
HOLD = {"basket", "tray", "basketstack", "bouquet"}; TF, TP = ARGS.get("tol_fixture", .02), ARGS.get("tol_product", .03)
def depth(tree, pts, tol):
    worst = 0.0; n = 0
    for p in pts:
        loc, nor, idx, d = tree.find_nearest(p, .35)
        if loc is not None and d > tol and (p - loc).dot(nor) < -0.85 * d: worst = max(worst, d); n += 1   # foot of the perpendicular lies on a face and we are behind it
    return worst, n
for c in [c for c in bpy.data.collections if c.name.startswith("MERCH_")]:
    key = c.name[6:]
    if ARGS.get("shops") and key not in ARGS["shops"]: continue
    par = next(p for p in bpy.data.collections if c.name in p.children); fv = []; fp = []; prods = []
    def addfix(co, pl):
        base = len(fv); fv.extend(co); fp.extend(tuple(i + base for i in f) for f in pl)
    for o in par.objects:
        if o.type == "MESH" and o.visible_get() and len(o.data.polygons):
            mw = o.matrix_world; addfix([mw @ v.co for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons])
    for o in c.objects:
        me = o.data; mw = o.matrix_world; at = me.attributes.get("pid"); kinds = (me.get("gm_kinds") or "").split(",")
        co = [mw @ v.co for v in me.vertices]; groups = collections.defaultdict(list)
        for p in me.polygons: groups[at.data[p.index].value if at else 0].append(tuple(p.vertices))
        for pid, pl in groups.items():
            if pid == 0: addfix(co, pl); continue
            used = sorted({i for f in pl for i in f}); idx = {v: k for k, v in enumerate(used)}; pc = [co[i] for i in used]
            mn = Vector((min(p.x for p in pc), min(p.y for p in pc), min(p.z for p in pc))); mx = Vector((max(p.x for p in pc), max(p.y for p in pc), max(p.z for p in pc)))
            prods.append({"o": o.name, "kind": kinds[pid - 1] if pid - 1 < len(kinds) else "?", "pts": pc[::max(1, len(pc) // 160)], "tree": BVHTree.FromPolygons(pc, [tuple(idx[i] for i in f) for f in pl]), "mn": mn, "mx": mx})
    F = BVHTree.FromPolygons(fv, fp); bad = []; by = collections.Counter()
    for P in prods:
        if P["kind"] in ("bouquet",): continue
        w, n = depth(F, P["pts"], TF)
        if n: bad.append((round(w, 3), "fixture", P["kind"], P["o"], [round(v, 2) for v in (P["mn"] + P["mx"]) / 2])); by[P["kind"] + ">fixture"] += 1
    order = sorted(range(len(prods)), key=lambda i: prods[i]["mn"].x)
    for ai, i in enumerate(order):
        A = prods[i]
        for j in order[ai + 1:]:
            Bp = prods[j]
            if Bp["mn"].x > A["mx"].x: break
            if Bp["mn"].y > A["mx"].y or Bp["mx"].y < A["mn"].y or Bp["mn"].z > A["mx"].z or Bp["mx"].z < A["mn"].z: continue
            if A["kind"] in HOLD or Bp["kind"] in HOLD: continue
            w = max(depth(Bp["tree"], A["pts"], TP)[0], depth(A["tree"], Bp["pts"], TP)[0])
            if w: bad.append((round(w, 3), Bp["kind"], A["kind"], A["o"], [round(v, 2) for v in (A["mn"] + A["mx"]) / 2])); by[A["kind"] + ">" + Bp["kind"]] += 1
    bad.sort(reverse=True); rep[key] = {"products": len(prods), "wedged": len(bad), "by": dict(by.most_common(14)), "worst": bad[:8]}
ns["gk_report"] = rep
