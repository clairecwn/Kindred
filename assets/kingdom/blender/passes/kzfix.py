"""No flicker (z-fighting). Two faces in the same plane, facing the same way and overlapping, fight for the same pixels:
as the camera or the character moves, first one wins and then the other, so the surface shimmers in stripes and specks
(a roof tile on its roof, a window frame flat on its wall, a floor on the lawn). This finds every such pair and lifts
the smaller of the two pieces clear by a few millimetres, along the face's normal, so one is always in front.

  fix_mesh(me)        inside one mesh: every pair of faces from different pieces (a piece is a connected island of
                      the mesh, a box or a ball the builder added), and any face lying on the ground (z = 0, facing up)
                      when the thing stands on the ground
  fix_assembly(objs)  between parts that are put together the same way in the game (a house: body, roof, windows,
                      door, porch, chimney, timber; a room: shell and parts): the offending piece is lifted in its own
                      mesh, so every house built from that part is fixed
Both work on the exported copy at export time (k20, k21, k22, k23, k35, the items' i20), so a builder never has to
remember it, and report what they moved."""
import bpy, numpy as np
from mathutils import Vector

GAP = 0.0025          # faces closer than this to one plane count as one plane
PUSH = 0.004          # how far the smaller piece is lifted
COS = 0.9995          # normals this alike are the same way

def _tris(me, mtx=None):
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    if n == 0: return None
    vi = np.empty(n * 3, np.int32); me.loop_triangles.foreach_get("vertices", vi); vi = vi.reshape(n, 3)
    co = np.empty(len(me.vertices) * 3, np.float64); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    if mtx is not None:
        M = np.array(mtx); co = co @ M[:3, :3].T + M[:3, 3]
    P = co[vi]                                                     # (n, 3, 3)
    N = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]); A = np.linalg.norm(N, axis=1) * 0.5
    ok = A > 1e-9; N[ok] /= (2 * A[ok])[:, None]
    D = np.einsum("ij,ij->i", N, P[:, 0])
    return vi, P, N, A, D, ok

def _islands(me):
    """The connected pieces of a mesh: an id per vertex."""
    nv = len(me.vertices); parent = np.arange(nv)
    def find(a):
        r = a
        while parent[r] != r: r = parent[r]
        while parent[a] != r: parent[a], a = r, parent[a]
        return r
    ev = np.empty(len(me.edges) * 2, np.int32); me.edges.foreach_get("vertices", ev)
    for a, b in ev.reshape(-1, 2):
        ra, rb = find(a), find(b)
        if ra != rb: parent[ra] = rb
    return np.array([find(i) for i in range(nv)])

def _clip(poly, a, b):
    """Keep the part of a convex polygon (list of 2D points) left of the line a->b."""
    out = []
    def side(p): return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]; sp, sq = side(p), side(q)
        if sp >= 0: out.append(p)
        if (sp >= 0) != (sq >= 0):
            t = sp / (sp - sq); out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out
def _area2(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))) * 0.5
def _overlap(T1, T2, n):
    """Area two triangles in one plane share."""
    u = np.cross(n, [0.0, 0.0, 1.0] if abs(n[2]) < 0.9 else [1.0, 0.0, 0.0]); u /= np.linalg.norm(u); v = np.cross(n, u)
    p1 = [(float(p @ u), float(p @ v)) for p in T1]; p2 = [(float(p @ u), float(p @ v)) for p in T2]
    def ccw(p): return p if (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]) > 0 else p[::-1]
    p1, p2 = ccw(p1), ccw(p2); poly = p1
    for i in range(3):
        poly = _clip(poly, p2[i], p2[(i + 1) % 3])
        if len(poly) < 3: return 0.0
    return _area2(poly)

def _pairs(P, N, A, D, ok, owner, min_area=2e-6):
    """Pairs of triangles (i, j) from different owners, one plane, same way, overlapping."""
    key = {}
    for i in np.nonzero(ok)[0]:
        k = (int(round(N[i, 0] * 40)), int(round(N[i, 1] * 40)), int(round(N[i, 2] * 40)), int(np.floor(D[i] / (2 * GAP))))
        key.setdefault(k, []).append(i)
    out = []
    for (a, b, c, d), lst in key.items():
        cand = lst + [j for dd in (d - 1, d + 1) for j in key.get((a, b, c, dd), [])]
        if len(set(owner[x] for x in cand)) < 2: continue
        for x in lst:
            for y in cand:
                if y <= x and (a, b, c, d) == (int(round(N[y, 0] * 40)), int(round(N[y, 1] * 40)), int(round(N[y, 2] * 40)), int(np.floor(D[y] / (2 * GAP)))): continue
                if owner[x] == owner[y] or abs(D[x] - D[y]) > GAP or N[x] @ N[y] < COS: continue
                if N[x, 2] < -COS and abs(P[x, :, 2]).max() < GAP: continue      # two undersides on the ground: never seen
                lo = np.minimum(P[x].min(0), P[y].min(0)); 
                if (P[x].min(0) > P[y].max(0) + 1e-6).any() or (P[y].min(0) > P[x].max(0) + 1e-6).any(): continue
                if _overlap(P[x], P[y], N[x]) > min_area: out.append((x, y))
    return out

def fix_mesh(me, ground=None, rounds=3):
    """Lift apart coplanar overlapping pieces inside one mesh (and off the ground). Returns how many pieces moved."""
    if len(me.vertices) == 0: return 0
    moved = 0
    for _ in range(rounds):
        t = _tris(me)
        if t is None: return moved
        vi, P, N, A, D, ok = t; isl = _islands(me); owner = isl[vi[:, 0]]
        area = {}
        for i in np.nonzero(ok)[0]: area[owner[i]] = area.get(owner[i], 0.0) + A[i]
        shift = {}; lo3 = P.reshape(-1, 3).min(0); hi3 = P.reshape(-1, 3).max(0)
        for x, y in _pairs(P, N, A, D, ok, owner):
            small = owner[x] if area[owner[x]] <= area[owner[y]] else owner[y]
            n = N[x].copy(); ax = int(np.argmax(np.abs(n)))
            edge = hi3[ax] if n[ax] > 0 else lo3[ax]
            if abs(n[ax]) > COS and abs(P[x, 0, ax] - edge) < GAP and not (ax == 2 and n[ax] > 0): n = -n     # on the outside of the model: tuck it in, so the model keeps its size
            s = shift.setdefault(small, np.zeros(3))
            if s @ n < PUSH * 0.9: s += n * PUSH
        if ground is None: ground = abs(min(v.co.z for v in me.vertices)) < 0.003
        if ground:                                                   # a face lying on the lawn, facing up, fights the lawn
            low = np.nonzero(ok & (N[:, 2] > COS) & (np.abs(P[:, :, 2]).max(1) < GAP))[0]
            for i in low:
                s = shift.setdefault(owner[i], np.zeros(3))
                if s[2] < PUSH * 0.9: s[2] += PUSH
        if not shift: return moved
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        LO, HI = co.min(0), co.max(0)
        for k, s in shift.items():
            sel = isl == k; plo, phi = co[sel].min(0) + s, co[sel].max(0) + s
            if (plo < LO - 1e-5).any() or (phi > HI + 1e-5).any(): s = -s      # lifting it would make the model bigger: sink it instead, it stays hidden behind
            co[sel] += s
        me.vertices.foreach_set("co", co.ravel()); me.update(); moved += len(shift)
    return moved

def fix_assembly(objs, rounds=2):
    """Between parts placed together: lift the smaller piece, in its own mesh. objs: the objects of one assembly."""
    moved = {}
    for _ in range(rounds):
        Ps, Ns, As, Ds, oks, owners, refs = [], [], [], [], [], [], []
        base = 0
        for k, o in enumerate(objs):
            if o.type != "MESH" or not o.data.polygons: continue
            t = _tris(o.data, o.matrix_world)
            if t is None: continue
            vi, P, N, A, D, ok = t; isl = _islands(o.data)
            Ps.append(P); Ns.append(N); As.append(A); Ds.append(D); oks.append(ok)
            owners.append(np.full(len(P), k)); refs.append((o, isl[vi[:, 0]]))
        if len(Ps) < 2: return moved
        P = np.concatenate(Ps); N = np.concatenate(Ns); A = np.concatenate(As); D = np.concatenate(Ds); ok = np.concatenate(oks)
        own = np.concatenate(owners); sub = np.concatenate([r[1] for r in refs]); kind = {k: r[0] for k, r in zip([o[0] for o in owners], refs)}
        area = {}
        for i in np.nonzero(ok)[0]: area[(own[i], sub[i])] = area.get((own[i], sub[i]), 0.0) + A[i]
        shift = {}
        for x, y in _pairs(P, N, A, D, ok, own):
            kx, ky = (own[x], sub[x]), (own[y], sub[y])
            small = kx if area[kx] <= area[ky] else ky
            n = N[x]; s = shift.setdefault(small, np.zeros(3))
            if s @ n < PUSH * 0.9: s += n * PUSH
        if not shift: return moved
        done = set()
        for (k, piece), s in shift.items():
            o = kind[k]; me = o.data
            key = (me.name, piece)
            if key in done: continue
            done.add(key)
            R = np.array(o.matrix_world.to_3x3().inverted()); ls = R @ s
            co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
            isl = _islands(me); co[isl == piece] += ls; me.vertices.foreach_set("co", co.ravel()); me.update()
            moved[me.name] = moved.get(me.name, 0) + 1
    return moved

def fix_all(meshes, **kw):
    out = {}
    for me in meshes:
        if me is None: continue
        n = fix_mesh(me, **kw)
        if n: out[me.name] = n
    return out
