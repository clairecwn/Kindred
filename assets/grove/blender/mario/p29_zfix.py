"""Pass 29: z-fight fix. Run it LAST in a round, after any pass that rebuilds geometry.
Finds visible faces that lie in the same plane (within 2.5 mm), face the same way and overlap, inside one object or
between two (the p27 audit's test, minus the hidden undersides at floor level). For each such pair the smaller
connected piece (island) moves 4 mm out along the shared normal, away from the other piece (forward if level), so a decal sits on its panel instead of in it.
Pieces that are welded into the same island cannot be separated this way and are only reported.
Args: apply (default False: report only)."""
import bpy, numpy as np, collections, time
from mathutils import Vector
args = bpy.app.driver_namespace.get("gk_args") or {}
APPLY = bool(args.get("apply", False)); DEBUG = args.get("debug"); dbg = []
t0 = time.time()
GAP, PUSH, MIN_AREA = 0.0025, 0.004, 2e-5
FLOORS = (0.0, 5.0, 10.0)
SKIP = ("ESC_", "WATER_", "LIFT_")
objs, V, N, O, P, M = [], [], [], [], [], []
isl_of, isl_area = {}, {}
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.visible_get() or o.name.startswith(SKIP) or o.modifiers: continue
    me = o.data; me.calc_loop_triangles(); nt = len(me.loop_triangles)
    if not nt: continue
    nv = len(me.vertices)
    co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    mw = np.array(o.matrix_world); cw = co @ mw[:3, :3].T + mw[:3, 3]
    tv = np.empty(nt * 3, dtype=np.int64); me.loop_triangles.foreach_get("vertices", tv); tv = tv.reshape(-1, 3)
    tp = np.empty(nt, dtype=np.int64); me.loop_triangles.foreach_get("polygon_index", tp)
    mi = np.empty(nt, dtype=np.int64); me.loop_triangles.foreach_get("material_index", mi)
    T = cw[tv]
    nr = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); ar = np.linalg.norm(nr, axis=1) / 2
    ok = ar > MIN_AREA
    if not ok.any(): continue
    k = len(objs); objs.append(o)
    V.append(T[ok]); N.append(nr[ok] / (2 * ar[ok, None])); O.append(np.full(ok.sum(), k)); P.append(tp[ok]); M.append(mi[ok])
V = np.concatenate(V); N = np.concatenate(N); O = np.concatenate(O); P = np.concatenate(P); M = np.concatenate(M)
D = np.einsum("ij,ij->i", N, V[:, 0])
qn = np.round(N * 20).astype(np.int64); qd = np.floor(D / GAP).astype(np.int64)
groups = collections.defaultdict(list)
for i in range(len(V)): groups[(qn[i, 0], qn[i, 1], qn[i, 2], qd[i])].append(i)

def islands(k):
    """Polygon -> island id for object k (vertex-connected pieces), and each island's area."""
    if k in isl_of: return isl_of[k]
    me = objs[k].data; nv = len(me.vertices); par = list(range(nv))
    def f(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for p in me.polygons:
        vs = p.vertices; r0 = f(vs[0])
        for v in vs[1:]:
            r = f(v)
            if r != r0: par[r] = r0
    pid = [f(p.vertices[0]) for p in me.polygons]
    area = collections.Counter()
    for p, r in zip(me.polygons, pid): area[r] += p.area
    isl_of[k] = pid; isl_area[k] = area; return pid

def clip(poly, a, b):
    out = []
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        sp = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); sq = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
        if sp >= 0: out.append(p)
        if (sp >= 0) != (sq >= 0): t = sp / (sp - sq); out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out
def parea(Pp): return 0.5 * sum(Pp[i][0] * Pp[(i + 1) % len(Pp)][1] - Pp[(i + 1) % len(Pp)][0] * Pp[i][1] for i in range(len(Pp)))
def ccw(t): return t if parea(t) > 0 else [t[0], t[2], t[1]]

moves = collections.defaultdict(dict)    # (obj index, island) -> {rounded normal: normal}
welded = collections.Counter(); hidden = 0; pairs = 0; seen = set()
for key, lst in groups.items():
    cand = lst + groups.get((key[0], key[1], key[2], key[3] + 1), [])
    if len(cand) < 2: continue
    cand = np.array(cand); n = N[cand[0]]
    if n[2] < -0.5 and any(abs(float(V[cand[0]][:, 2].mean()) - f) < 0.08 for f in FLOORS): hidden += 1; continue
    ax = np.argsort(np.abs(n))[:2]; Q = V[cand][:, :, ax]; lo = Q.min(1); hi = Q.max(1); order = np.argsort(lo[:, 0])
    for ii in range(len(order)):
        i = order[ii]
        for jj in range(ii + 1, len(order)):
            j = order[jj]
            if lo[j, 0] >= hi[i, 0]: break
            if lo[j, 1] >= hi[i, 1] or lo[i, 1] >= hi[j, 1]: continue
            gi, gj = cand[i], cand[j]
            if abs(D[gi] - D[gj]) > GAP or np.dot(N[gi], N[gj]) < 0.99: continue
            pk = (min(gi, gj), max(gi, gj))
            if pk in seen: continue
            seen.add(pk)
            poly = ccw([tuple(p) for p in Q[i]]); B_ = ccw([tuple(p) for p in Q[j]])
            for e in range(3):
                poly = clip(poly, B_[e], B_[(e + 1) % 3])
                if len(poly) < 3: break
            if len(poly) < 3 or abs(parea(poly)) < 1e-5: continue
            oa, ob = int(O[gi]), int(O[gj])
            ma_ = objs[oa].data.materials; mb_ = objs[ob].data.materials
            if ma_ and mb_ and ma_[min(int(M[gi]), len(ma_) - 1)] == mb_[min(int(M[gj]), len(mb_) - 1)]: continue   # same colour, same normal: nothing to see
            ia = islands(oa)[P[gi]]; ib = islands(ob)[P[gj]]
            if oa == ob and ia == ib:
                ma, mb = objs[oa].data.materials, objs[oa].data.materials
                if M[gi] != M[gj]: welded[objs[oa].name] += 1
                continue
            pairs += 1
            # move the smaller piece (by island area, in world units)
            sa = isl_area[oa][ia] * objs[oa].matrix_world.median_scale ** 2; sb = isl_area[ob][ib] * objs[ob].matrix_world.median_scale ** 2
            k, isl, g_me, g_other = (oa, ia, gi, gj) if sa <= sb else (ob, ib, gj, gi)
            dd = D[g_me] - D[g_other]                       # already behind: go further back; level or in front: come forward
            nv = N[gi] * (-1.0 if dd < -1e-4 else 1.0); moves[(k, isl)][tuple(np.round(nv, 1))] = nv
            if DEBUG and objs[k].name == DEBUG and len(dbg) < 8:
                dbg.append({"a": [objs[oa].name, int(ia), round(float(sa), 4), round(float(D[gi]), 5)], "b": [objs[ob].name, int(ib), round(float(sb), 4), round(float(D[gj]), 5)],
                            "n": [round(float(x), 3) for x in N[gi]], "at": [round(float(x), 3) for x in V[gi].mean(0)], "moves": [objs[k].name, int(isl)]})
done = collections.Counter(); meshes_done = set()
if APPLY:
    for (k, isl), dirs in moves.items():
        o = objs[k]; me = o.data
        key = (me.name, isl)
        if key in meshes_done: continue
        meshes_done.add(key)
        # smallest shift that clears every plane this piece shares: at least PUSH along each normal (a few passes of
        # projection; the normals of one piece's shared planes all lie on one side, so this settles)
        w = Vector((0, 0, 0)); ds = [Vector(nv) for nv in dirs.values()]
        for _ in range(12):
            for d in ds:
                g = d.dot(w)
                if g < PUSH: w += d * (PUSH - g)
        loc = o.matrix_world.to_3x3().inverted() @ w
        pid = isl_of[k]; vs = set()
        for p, r in zip(me.polygons, pid):
            if r == isl: vs.update(p.vertices)
        for v in vs: me.vertices[v].co += loc
        me.update(); done[o.name] += 1
rep = {"apply": APPLY, "pairs": pairs, "pieces": len(moves), "hidden_groups_skipped": hidden, "welded_same_piece": dict(welded.most_common(30)),
       "moved_by_object": dict(done.most_common(60)) if APPLY else dict(collections.Counter(objs[k].name for k, _ in moves).most_common(60)),
       "secs": round(time.time() - t0, 1), "debug": dbg}
bpy.app.driver_namespace["gk_report"] = rep
