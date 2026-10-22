"""Pass 30: glass faces pressed flat against solid ones (either way round). Glass is drawn from both sides in the game, so the bottom of a
glass case sitting on a coloured base shows its back face at exactly the depth of the base top, and the two flicker
(the claw machines and capsule-toy machines). A glass face that lies against a solid face looking the other way is
never seen anyway: it is deleted. Run after p29 (and after any pass that rebuilds geometry). Args: apply."""
import bpy, bmesh, numpy as np, collections, time
args = bpy.app.driver_namespace.get("gk_args") or {}
APPLY = bool(args.get("apply", False)); t0 = time.time()
GAP = 0.003
def is_glass(m): return m is not None and "glass" in m.name.lower()
objs, V, N, O, P, G = [], [], [], [], [], []
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.visible_get() or o.modifiers or o.name.startswith(("ESC_", "WATER_")): continue
    me = o.data; mats = list(me.materials)
    me.calc_loop_triangles(); nt = len(me.loop_triangles)
    if not nt: continue
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    mw = np.array(o.matrix_world); cw = co @ mw[:3, :3].T + mw[:3, 3]
    tv = np.empty(nt * 3, dtype=np.int64); me.loop_triangles.foreach_get("vertices", tv); T = cw[tv.reshape(-1, 3)]
    tp = np.empty(nt, dtype=np.int64); me.loop_triangles.foreach_get("polygon_index", tp)
    mi = np.empty(nt, dtype=np.int64); me.loop_triangles.foreach_get("material_index", mi)
    nr = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); ar = np.linalg.norm(nr, axis=1) / 2; ok = ar > 1e-5
    if not ok.any(): continue
    k = len(objs); objs.append(o)
    gl = np.array([is_glass(mats[min(i, len(mats) - 1)]) if mats else False for i in mi])
    V.append(T[ok]); N.append(nr[ok] / (2 * ar[ok, None])); O.append(np.full(ok.sum(), k)); P.append(tp[ok]); G.append(gl[ok])
V = np.concatenate(V); N = np.concatenate(N); O = np.concatenate(O); P = np.concatenate(P); G = np.concatenate(G)
D = np.einsum("ij,ij->i", N, V[:, 0])
qn = np.round(N * 20).astype(np.int64); qd = np.floor(D / GAP).astype(np.int64)
solid = collections.defaultdict(list)
for i in np.nonzero(~G)[0]: solid[(qn[i, 0], qn[i, 1], qn[i, 2], qd[i])].append(i)
def inside(pt, tri):
    a, b, c = tri; v0, v1, v2 = c - a, b - a, pt - a
    d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-12: return False
    v = (d11 * d20 - d01 * d21) / den; w = (d00 * d21 - d01 * d20) / den
    return v >= -1e-4 and w >= -1e-4 and v + w <= 1 + 1e-4
kill = collections.defaultdict(set)
for g in np.nonzero(G)[0]:
    c = V[g].mean(0); hit = False
    for sgn in (-1, 1):          # a solid face looking the other way (behind the glass) or the same way (seen through it)
        key = (sgn * qn[g, 0], sgn * qn[g, 1], sgn * qn[g, 2])
        dq = int(np.floor(sgn * D[g] / GAP))
        for dd in (-1, 0, 1):
            for j in solid.get(key + (dq + dd,), []):
                if np.dot(N[g], N[j]) * sgn < 0.99 or abs(D[j] - sgn * D[g]) > GAP: continue
                if inside(c, V[j]): hit = True; break
            if hit: break
        if hit: break
    if hit: kill[objs[int(O[g])].data.name].add(int(P[g]))
removed = collections.Counter()
if APPLY:
    for name, polys in kill.items():      # once per mesh: several objects can share one
        me = bpy.data.meshes[name]; bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in sorted(polys)], context="FACES"); bm.to_mesh(me); bm.free(); me.update()
        removed[name] = len(polys)
rep = {"apply": APPLY, "meshes": {k: len(v) for k, v in kill.items()}, "secs": round(time.time() - t0, 1)}
bpy.app.driver_namespace["gk_report"] = rep
