"""Pass 27: z-fight audit. Finds visible triangles that lie in (nearly) the same plane, face the same way and overlap,
inside one object or between two. Reports by object and material pair with a sample spot. Read-only."""
import bpy, numpy as np, collections, time
t0 = time.time()
GAP = 0.0025          # planes closer than this fight at a distance
MIN_AREA = 2e-5
dg = bpy.context.evaluated_depsgraph_get()
V, N, O, M = [], [], [], []
names = []
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.visible_get(): continue
    oe = o.evaluated_get(dg); me = oe.to_mesh()
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    if not nt: oe.to_mesh_clear(); continue
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    mw = np.array(o.matrix_world); co = co @ mw[:3, :3].T + mw[:3, 3]
    tv = np.empty(nt * 3, dtype=np.int64); me.loop_triangles.foreach_get("vertices", tv)
    mi = np.empty(nt, dtype=np.int64); me.loop_triangles.foreach_get("material_index", mi)
    mats = [m.name if m else "-" for m in o.data.materials] or ["-"]
    oe.to_mesh_clear()
    T = co[tv.reshape(-1, 3)]
    nrm = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); ar = np.linalg.norm(nrm, axis=1) / 2
    ok = ar > MIN_AREA
    if not ok.any(): continue
    idx = len(names); names.append((o.name, mats))
    V.append(T[ok]); N.append(nrm[ok] / (2 * ar[ok, None])); O.append(np.full(ok.sum(), idx)); M.append(mi[ok])
V = np.concatenate(V); N = np.concatenate(N); O = np.concatenate(O); M = np.concatenate(M)
D = np.einsum("ij,ij->i", N, V[:, 0])
qn = np.round(N * 20).astype(np.int64)            # about 3 degrees
qd = np.floor(D / GAP).astype(np.int64)
groups = collections.defaultdict(list)
for i in range(len(V)): groups[(qn[i, 0], qn[i, 1], qn[i, 2], qd[i])].append(i)

def clip(poly, a, b):
    out = []
    for k in range(len(poly)):
        p, q = poly[k], poly[(k + 1) % len(poly)]
        sp = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        sq = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
        if sp >= 0: out.append(p)
        if (sp >= 0) != (sq >= 0):
            t = sp / (sp - sq); out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out
def parea(P):
    return 0.5 * sum(P[k][0] * P[(k + 1) % len(P)][1] - P[(k + 1) % len(P)][0] * P[k][1] for k in range(len(P)))
def ccw(t):
    return t if parea(t) > 0 else [t[0], t[2], t[1]]

hits = collections.defaultdict(lambda: [0.0, None, 0])
seen = set()
for key, a_list in groups.items():
    cand = list(a_list)
    for dd in (1,):
        cand += groups.get((key[0], key[1], key[2], key[3] + dd), [])
    if len(cand) < 2: continue
    cand = np.array(cand)
    n = N[cand[0]]; ax = np.argsort(np.abs(n))[:2]
    P = V[cand][:, :, ax]
    lo = P.min(1); hi = P.max(1)
    order = np.argsort(lo[:, 0])
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
            A = ccw([tuple(p) for p in P[i]]); B = ccw([tuple(p) for p in P[j]])
            poly = A
            for k in range(3):
                poly = clip(poly, B[k], B[(k + 1) % 3])
                if len(poly) < 3: break
            if len(poly) < 3: continue
            ar = abs(parea(poly))
            if ar < 1e-5: continue
            oa, ob = O[gi], O[gj]
            k2 = (names[oa][0], names[oa][1][min(M[gi], len(names[oa][1]) - 1)], names[ob][0], names[ob][1][min(M[gj], len(names[ob][1]) - 1)])
            h = hits[k2]; h[0] += ar; h[2] += 1
            if h[1] is None: h[1] = [round(float(x), 3) for x in V[gi].mean(0)] + [round(float(abs(D[gi] - D[gj])), 4)]
rep = sorted(([k, round(v[0], 4), v[2], v[1]] for k, v in hits.items()), key=lambda r: -r[1])
result = {"tris": int(len(V)), "pairs": len(rep), "top": rep[:120], "secs": round(time.time() - t0, 1)}
