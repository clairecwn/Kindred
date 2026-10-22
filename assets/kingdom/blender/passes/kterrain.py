"""Kingdom terrain. Land is built from OUTLINES, never sculpted: an outline is a ring of points, and every land form
(plateau, beach, terrace, islet, foam line) is made from one. Adding land later means adding an outline, not editing
this one. The home island's outline is Codex's, with two changes that give it a shape of its own: a dent in the north
shore, so that from above the island is two leaves with the dock as the stem (the sprout), and a headland in the
north-west that carries the great tree."""
import bpy, bmesh
import numpy as np
from kk import *
import gk

N = 256
GROW = 2.4                  # the lawn's size against Codex's outline. 1.0 felt cluttered, 1.45 was still small beside other farm games
                            # (Claire, 9 Oct). At 2.4 the lawn is about 5,500 cells; most of it starts as wild land (k28_sections)
FAR = 2.3                   # how far out the five far islets stand against where Codex put them
HILL = (-37.0, 27.8)        # centre of the great tree's terrace: the north-west headland
HILL_R = 6.6                # radius of the terrace top
SITE = (-3.0, -8.0)         # centre of the house plot: the tent, then every size of house, stands on it. It is in the south, a
                            # short walk from the pier, so the land the player opens later lies north, east and west of home
HOME = ((-2.0, -21.0), (19.0, 23.0))   # the start area: the lawn inside this ellipse (centre, radii) is open on day 1
BRIDGE_POINTS = (4, 203, 40, 118, 250, 320)   # directions (degrees) where a bridge to more land may leave the island; the first two are used
HILL_Z = 3.8                # its height (the lawn is at 2.0)

def _smooth(a, passes=2, k=(1, 2, 3, 2, 1)):
    k = np.array(k, dtype=float); k /= k.sum(); h = len(k) // 2
    for _ in range(passes):
        a = sum(np.roll(a, i - h) * k[i] for i in range(len(k)))
    return a

def home_rho():
    """Radius of the lawn's edge for N evenly spaced directions around the island centre."""
    a = np.linspace(0, tau, 1440, endpoint=False)
    w = 1 + 0.04 * np.sin(3 * a + 0.4) + 0.025 * np.sin(5 * a - 1.2)
    x = 21 * GROW * 0.975 * w * np.cos(a)
    y = 18 * GROW * 0.975 * w * np.sin(a) * (1 - 0.13 * np.exp(-((a - pi / 2) / 0.28) ** 2))      # the dent between the two leaves
    ph = np.arctan2(y, x) % tau; rh = np.hypot(x, y); o = np.argsort(ph)
    phi = np.linspace(0, tau, N, endpoint=False)
    rho = np.interp(phi, ph[o], rh[o], period=tau)
    T = np.array(HILL); R = HILL_R + 1.0                                                   # headland: terrace plus a ledge
    u = np.stack([np.cos(phi), np.sin(phi)], 1); ut = u @ T; disc = ut ** 2 - (T @ T - R * R)
    far = np.where(disc >= 0, ut + np.sqrt(np.maximum(disc, 0)), 0)
    return phi, _smooth(np.maximum(rho, far), 2)

def ring(phi, rho):
    return [Vector((r * cos(p), r * sin(p), 0)) for p, r in zip(phi, rho)]

def circle(c, r, n=64, wob=0.0):
    return [Vector((c[0] + r * (1 + wob * sin(3 * tau * i / n + c[0])) * cos(tau * i / n), c[1] + r * (1 + wob * sin(3 * tau * i / n + c[0])) * sin(tau * i / n), 0)) for i in range(n)]

def offset(pts, d):
    if abs(d) < 1e-9: return [p.copy() for p in pts]
    n = len(pts); out = []
    for i, p in enumerate(pts):
        t = pts[(i + 1) % n] - pts[i - 1]; t.normalize(); out.append(p + Vector((t.y, -t.x, 0)) * d)
    return out

def _add(b, t):
    for f in t.faces: f.smooth = True
    me = gk._scr(); t.to_mesh(me); t.free(); b.bm.from_mesh(me)

def bands(b, rings, mats, cap=None):
    """rings: list of point rings (same length, anticlockwise from above, lowest first). Joins each to the next with the
    material named in mats; cap closes the last ring with one face."""
    t = bmesh.new(); V = [[t.verts.new(p) for p in r] for r in rings]; n = len(V[0])
    for k in range(len(V) - 1):
        mi_ = b.mi(mats[k])
        for i in range(n):
            j = (i + 1) % n; t.faces.new((V[k][i], V[k][j], V[k + 1][j], V[k + 1][i])).material_index = mi_
    if cap: t.faces.new(V[-1]).material_index = b.mi(cap)
    _add(b, t)

def tier(b, pts, z0, z1, wall="cliff_tex", lip="lawn", top="lawn_tex", lipw=0.22):
    """A flat-topped block of land: striped cliff, a rounded grass lip that overhangs it, a checkered top."""
    L = lambda d, z: [Vector((p.x, p.y, z)) for p in offset(pts, d)]
    bands(b, [L(0, z0), L(0, z1 - 0.3), L(lipw, z1 - 0.16), L(lipw, z1 - 0.04), L(lipw - 0.1, z1)], [wall, lip, lip, lip], cap=top)

def beach_width(phi):
    return 6.0 + 0.7 * np.sin(3 * phi + 1.0) + 0.4 * np.sin(7 * phi)

SHORE = 0.86            # share of the beach's width that is above the water
def beach(b, phi, rho, m="sand", wet="sand_dk"):
    """A sand skirt round a tier, wide and flat enough to walk on: it starts under the cliff foot at 0.55 m, falls
    gently to the waterline at SHORE of its width and then runs down under the sea. The sand below 0.1 m is wet."""
    W = beach_width(phi); soft = _smooth(rho, 6)
    R = lambda d, z, k: [Vector((r * cos(p), r * sin(p), z)) for p, r in zip(phi, (1 - k) * rho + k * soft + d)]
    rings = [R(-0.9, 0.56, 0), R(0.4, 0.55, 0.2), R(W * 0.45, 0.4, 0.6), R(W * 0.72, 0.1, 1), R(W * SHORE, -0.15, 1), R(W * 1.05, -0.55, 1), R(W * 1.05 + 1.4, -1.6, 1)]
    bands(b, rings[::-1], [wet, wet, wet, m, m, m])
    return soft + W * SHORE              # radius of the shoreline

def beach_height(d, W):
    """Height of the sand at distance d outside the lawn's edge, for a beach of width W (the profile beach() builds)."""
    return float(np.interp(d, [0.4, W * 0.45, W * 0.72, W * SHORE, W * 1.05], [0.55, 0.4, 0.1, -0.15, -0.55]))

def ribbon(t, pts, w, closed=False):
    """Flat strip along pts, half-width w (number or list). A zero width makes a point."""
    n = len(pts); Lf = []; Rt = []
    for i, p in enumerate(pts):
        a = pts[i - 1] if (i > 0 or closed) else p; c = pts[(i + 1) % n] if (i < n - 1 or closed) else p
        tan = (c - a); tan.z = 0; tan.normalize(); nor = Vector((-tan.y, tan.x, 0))
        ww = w[i] if isinstance(w, (list, tuple, np.ndarray)) else w
        if ww <= 1e-6:
            v = t.verts.new(p); Lf.append(v); Rt.append(v)
        else:
            Lf.append(t.verts.new(p + nor * ww)); Rt.append(t.verts.new(p - nor * ww))
    for i in range(n if closed else n - 1):
        j = (i + 1) % n; vs = [Rt[i], Rt[j], Lf[j], Lf[i]]
        vs = [v for k, v in enumerate(vs) if v not in vs[:k]]
        if len(vs) >= 3: t.faces.new(vs)

def foam(b, phi, shore, z=-0.13, keep=None):
    """Three wave lines round a shore. Width swells and thins along each line, so they read as lapping water.
    keep: one True/False per angle; lines are drawn only where it is True (used where two shores meet)."""
    t = bmesh.new(); n = len(phi)
    runs = None
    if keep is not None and not all(keep):
        runs = []; start = next(i for i in range(n) if keep[i] and not keep[i - 1]) if any(keep) else None
        if start is not None:
            cur = []
            for q in range(n):
                i = (start + q) % n
                if keep[i]: cur.append(i)
                elif cur: runs.append(cur); cur = []
            if cur: runs.append(cur)
    for k, (d, w0, f) in enumerate(((0.12, 0.2, 11), (1.0, 0.1, 8), (1.9, 0.07, 6))):
        pts = [Vector((r * cos(p), r * sin(p), z + 0.006 * k)) for p, r in zip(phi, shore + d + 0.12 * np.sin(f * phi + k))]
        w = w0 * (0.55 + 0.45 * np.sin(f * 1.5 * phi + 2 * k) ** 2)
        if runs is None: ribbon(t, pts, w, closed=True)
        else:
            for run in runs:
                if len(run) > 4:                                # each end thins to a point
                    ww = np.array([w[i] for i in run]); ww[0] = ww[-1] = 0.0; ww[1] *= 0.5; ww[-2] *= 0.5
                    ribbon(t, [pts[i] for i in run], ww, closed=False)
    for f_ in t.faces:
        f_.normal_update()
        if f_.normal.z < 0: f_.normal_flip()
    i = b.mi("foam")
    for f_ in t.faces: f_.material_index = i
    _add(b, t)

def rho_at(phi, rho, a):
    return float(np.interp(a % tau, phi, rho, period=tau))
