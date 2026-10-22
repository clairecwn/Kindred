"""Pass 21: check the kit shop fit-out part by part. Every merch object is split into its separate pieces (each box,
bottle body, handle, label ...) and the pieces must form one chain of contact down to the shop shell: a piece that
touches nothing, or a group of pieces that only touch each other, is reported as floating.
Run per shop: gk_run('p21_merch_audit', shops=[...])."""
import bpy, bmesh, collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ns = bpy.app.driver_namespace; ARGS = ns.get("gk_args") or {}; EPS = 0.012; rep = {}
def islands(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table(); mw = o.matrix_world; seen = set(); out = []
    for v in bm.verts:
        if v.index in seen: continue
        st = [v]; seen.add(v.index); vs = []; fs = set()
        while st:
            a = st.pop(); vs.append(a)
            for f in a.link_faces: fs.add(f)
            for e in a.link_edges:
                w = e.other_vert(a)
                if w.index not in seen: seen.add(w.index); st.append(w)
        idx = {a.index: i for i, a in enumerate(vs)}; co = [mw @ a.co for a in vs]
        out.append((co, [tuple(idx[a.index] for a in f.verts) for f in fs]))
    bm.free(); return out
def pack(name, co, pl):
    mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co))); mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    cen = [sum((co[i] for i in f), Vector()) / len(f) for f in pl]
    return (name, BVHTree.FromPolygons(co, pl, epsilon=0.0), mn, mx, co[::max(1, len(co) // 40)] + cen[::max(1, len(cen) // 40)])
def near(a, b):
    """True when a vertex of one piece lies within 1.5 cm of the other piece's surface."""
    for (t, pts) in ((a[1], b[4]), (b[1], a[4])):
        for p in pts:
            if t.find_nearest(p, 0.015)[0] is not None: return True
    return False
for c in [c for c in bpy.data.collections if c.name.startswith("MERCH_")]:
    key = c.name[6:]
    if ARGS.get("shops") and key not in ARGS["shops"]: continue
    par = next(p for p in bpy.data.collections if c.name in p.children); items = []; roots = []
    for o in par.objects:
        if o.type == "MESH" and o.visible_get() and len(o.data.polygons):
            mw = o.matrix_world; items.append(pack(o.name, [mw @ v.co for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons])); roots.append(len(items) - 1)
    for o in c.objects:
        for k, (co, pl) in enumerate(islands(o)):
            if pl: items.append(pack(o.name, co, pl))
    n = len(items); order = sorted(range(n), key=lambda i: items[i][2].x); adj = collections.defaultdict(set)
    for ai, i in enumerate(order):
        _, ti, mni, mxi, _s = items[i]
        for j in order[ai + 1:]:
            _, tj, mnj, mxj, _s2 = items[j]
            if mnj.x > mxi.x + EPS: break
            if mnj.y > mxi.y + EPS or mxj.y < mni.y - EPS or mnj.z > mxi.z + EPS or mxj.z < mni.z - EPS: continue
            vi = (mxi - mni); vj = (mxj - mnj); small = min(vi.x * vi.y * vi.z, vj.x * vj.y * vj.z) >= 0 and max(vi.x * vi.y * vi.z, vj.x * vj.y * vj.z) < .02
            inside = small and (all(mnj[k] >= mni[k] - EPS and mxj[k] <= mxi[k] + EPS for k in range(3)) or all(mni[k] >= mnj[k] - EPS and mxi[k] <= mxj[k] + EPS for k in range(3)))
            if inside or ti.overlap(tj) or near(items[i], items[j]): adj[i].add(j); adj[j].add(i)
    seen = set(); st = [r for r in roots if "Shell" in items[r][0] or "Pendant" in items[r][0] or "Window_" in items[r][0] or "Skylight" in items[r][0]] or roots[:1]
    for r in st: seen.add(r)
    while st:
        a = st.pop()
        for b in adj[a]:
            if b not in seen: seen.add(b); st.append(b)
    fl = [i for i in range(n) if i not in seen]; by = collections.Counter(items[i][0] for i in fl)
    ex = [(items[i][0], [round(v, 2) for v in (items[i][2] + items[i][3]) / 2], [round(v, 2) for v in items[i][3] - items[i][2]]) for i in fl[:14]]
    rep[key] = {"pieces": n, "floating": len(fl), "by_object": dict(by.most_common(12)), "examples": ex}
ns["gk_report"] = rep
