"""Pass 9: audit. Finds props that do not touch anything and coplanar overlapping faces among visible meshes.
Set bpy.app.driver_namespace['gk_fix'] = True to also apply the safe fixes (drop small hovers, nudge decals)."""
import bpy, collections, time
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from gk import *

FIX = bool(bpy.app.driver_namespace.get("gk_fix")); SUP = bpy.app.driver_namespace.get("gk_fix") == "supports"; supported = 0
if SUP:
    for o_ in [o_ for o_ in bpy.data.objects if o_.name.startswith("Support_")]: bpy.data.objects.remove(o_, do_unlink=True)
t0 = time.time(); sc = bpy.context.scene
skip = set(o.name for o in bpy.data.collections["MARIO_BACKDROP"].all_objects) if "MARIO_BACKDROP" in bpy.data.collections else set()
objs = [o for o in sc.objects if o.type == "MESH" and o.visible_get() and o.name not in skip and len(o.data.polygons)]
EPS = 0.012; data = []
for o in objs:
    mw = o.matrix_world; vs = [mw @ v.co for v in o.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    pl_ = [tuple(p.vertices) for p in o.data.polygons]
    data.append((o, BVHTree.FromPolygons(vs, pl_, epsilon=0.0), mn, mx, BVHTree.FromPolygons(vs, pl_, epsilon=EPS)))
n = len(data); order = sorted(range(n), key=lambda i: data[i][2].x); adj = collections.defaultdict(set)
for ai, i in enumerate(order):
    _, _r, mni, mxi, ti = data[i]
    for j in order[ai + 1:]:
        _, _r2, mnj, mxj, tj = data[j]
        if mnj.x > mxi.x + EPS: break
        if mnj.y > mxi.y + EPS or mxj.y < mni.y - EPS or mnj.z > mxi.z + EPS or mxj.z < mni.z - EPS: continue
        if ti.overlap(tj): adj[i].add(j); adj[j].add(i)
seen = set(); comps = []
for i in range(n):
    if i in seen: continue
    st = [i]; seen.add(i); c = []
    while st:
        k = st.pop(); c.append(k)
        for m in adj[k]:
            if m not in seen: seen.add(m); st.append(m)
    comps.append(c)
comps.sort(key=len, reverse=True); down = Vector((0, 0, -1)); hover = []; floating = []; dropped = 0
for c in comps[1:]:
    cs = set(c)
    mn = Vector((min(data[k][2].x for k in c), min(data[k][2].y for k in c), min(data[k][2].z for k in c)))
    mx = Vector((max(data[k][3].x for k in c), max(data[k][3].y for k in c), max(data[k][3].z for k in c)))
    best = None
    for fx in (0.15, 0.5, 0.85):
        for fy in (0.15, 0.5, 0.85):
            org = Vector((mn.x + (mx.x - mn.x) * fx, mn.y + (mx.y - mn.y) * fy, mn.z + 0.02))
            for k, (o, t, a, b_, _e) in enumerate(data):
                if k in cs or org.x < a.x or org.x > b_.x or org.y < a.y or org.y > b_.y or a.z > org.z: continue
                h = t.ray_cast(org, down)
                if h[0] is not None and (best is None or h[3] - 0.02 < best): best = h[3] - 0.02
    name = data[c[0]][0].name; coll = data[c[0]][0].users_collection[0].name
    if best is not None and best <= 0.006: continue
    if best is not None and best <= 0.4:
        hover.append((name, len(c), round(best, 3), coll))
        if FIX:
            for k in c: data[k][0].location.z -= best + 0.008
            dropped += 1
    else:
        snap = None
        if FIX:
            ctr = (mn + mx) / 2; near = [t for (o, t, a, b_, _e) in [data[k] for k in range(n) if k not in cs]
                                         if not (a.x > mx.x + 0.8 or b_.x < mn.x - 0.8 or a.y > mx.y + 0.8 or b_.y < mn.y - 0.8 or a.z > mx.z + 0.8 or b_.z < mn.z - 0.8)]
            for dv in (Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))):
                half = abs(dv.x) * (mx.x - mn.x) / 2 + abs(dv.y) * (mx.y - mn.y) / 2 + abs(dv.z) * (mx.z - mn.z) / 2
                for t in near:
                    h = t.ray_cast(ctr + dv * (half - 0.02), dv, 0.8)
                    if h[0] is not None and (snap is None or h[3] - 0.02 < snap[0]): snap = (h[3] - 0.02, dv)
            if snap and snap[0] <= 0.7:
                for k in c: data[k][0].location += snap[1] * (snap[0] + 0.008)
                dropped += 1; continue
        if SUP and best is not None and best < 6 and "INTERIOR" in coll:
            sb = B(); lx, ly = mx.x - mn.x, mx.y - mn.y
            if max(lx, ly) < 0.7: pts = [((mn.x + mx.x) / 2, (mn.y + mx.y) / 2)]
            elif lx >= ly: pts = [(mn.x + lx * f, (mn.y + mx.y) / 2) for f in (0.12, 0.88)]
            else: pts = [((mn.x + mx.x) / 2, mn.y + ly * f) for f in (0.12, 0.88)]
            made = 0
            for (px, py) in pts:
                top = None
                for zz in (mn.z + 0.02, (mn.z + mx.z) / 2, mx.z + 0.02):
                    for k in c:
                        h = data[k][1].ray_cast(Vector((px, py, mn.z - 0.5)), Vector((0, 0, 1)), mx.z - mn.z + 1.0)
                        if h[0] is not None and (top is None or h[0].z < top): top = h[0].z
                top = top if top is not None else mn.z
                d = None
                for k, (o, t, a, b_, _e) in enumerate(data):
                    if k in cs or px < a.x or px > b_.x or py < a.y or py > b_.y or a.z > mn.z: continue
                    h = t.ray_cast(Vector((px, py, mn.z + 0.02)), down)
                    if h[0] is not None and (d is None or h[3] < d): d = h[3]
                if d is None: continue
                z0 = mn.z + 0.02 - d
                sb.cyl(0.035, top - z0 + 0.03, (px, py, z0), "white", seg=8); sb.cyl(0.13, 0.04, (px, py, z0), "gold", seg=10); made += 1
            if made:
                sb.obj("Support_" + name, data[c[0]][0].users_collection[0]); supported += 1; continue
        floating.append((name, len(c), None if best is None else round(best, 2), round(mn.z, 2), coll))

# coplanar overlapping faces between different objects
planes = collections.defaultdict(list)
for (o, t, a, b_, _e) in data:
    mw = o.matrix_world; n3 = mw.to_3x3().inverted().transposed(); me = o.data
    for p in me.polygons:
        if p.area < 0.02: continue
        nr = (n3 @ p.normal).normalized(); d = nr.dot(mw @ p.center)
        if nr.z < -0.9: continue
        vs = [mw @ me.vertices[i].co for i in p.vertices]
        planes[(round(nr.x, 2), round(nr.y, 2), round(nr.z, 2), round(d * 200))].append((o, [min(v[i] for v in vs) for i in range(3)], [max(v[i] for v in vs) for i in range(3)], d, nr))
pairs = {}
for key, lst in planes.items():
    if len(lst) < 2: continue
    ax = sorted(range(3), key=lambda i: abs(key[i]))[:2]
    for i in range(len(lst)):
        a = lst[i]
        for j in range(i + 1, len(lst)):
            b_ = lst[j]
            if a[0] is b_[0] or abs(a[3] - b_[3]) > 0.003: continue
            ov = 1.0
            for k in ax:
                w = min(a[2][k], b_[2][k]) - max(a[1][k], b_[1][k])
                if w <= 0.02: ov = 0; break
                ov *= w
            if ov > 0.01:
                pk = tuple(sorted((a[0].name, b_[0].name))); pairs[pk] = (pairs.get(pk, (0,))[0] + ov, a[4].copy())
nudged = 0
if FIX:
    vol = lambda o: o.dimensions.x * o.dimensions.y * o.dimensions.z
    cnt = collections.Counter()
    for (na, nb), (area, nr) in pairs.items():
        oa, ob = bpy.data.objects[na], bpy.data.objects[nb]
        small = oa if vol(oa) <= vol(ob) else ob
        if small.name.startswith(("Mall_", "GrovePark_", "Atrium_Fountain_Bloom")): small = ob if small is oa else oa
        cnt[small.name] += 1
        small.location += nr * 0.004 * (1 + (cnt[small.name] % 3)); nudged += 1
top = sorted(pairs.items(), key=lambda x: -x[1][0])[:25]
rep = {"visible_meshes": n, "hover_small_gap": len(hover), "hover_examples": hover[:25], "floating": len(floating), "floating_list": floating[:60],
       "coplanar_pairs": len(pairs), "coplanar_top": [(k[0], k[1], round(v[0], 2)) for k, v in top], "dropped": dropped, "nudged": nudged, "supported": supported, "secs": round(time.time() - t0, 1)}
bpy.app.driver_namespace["gk_report"] = rep
