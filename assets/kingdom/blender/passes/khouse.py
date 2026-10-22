"""The house kit: bodies, roofs, frames and timber overlays in four sizes. Every part is drawn in the body's own frame
(origin on the ground at the middle of the body, front to -Y), so a house is put together by setting parts at the
body's origin and at its sockets. khparts.py holds the parts that go on sockets (doors, windows, porches, chimneys).

  size      plot      body (x by y)   walls   storeys
  Shed      4 x 4     3.2 x 2.8       2.95    1
  Cabin     6 x 6     5.5 x 4.6       3.0     1
  Cottage   8 x 8     7.2 x 6.2       3.3     1
  House     10 x 10   9.0 x 7.6       5.8     2
  Manor     14 x 14   11.6 x 9.2      6.0     2      (added 9 Oct, when the island grew)

What the player recolours: walls (wallA), plinth (wallC), beams and frames (trimA), doors (doorA), roof (roofA/B/C)."""
import bpy, bmesh
from math import atan, atan2, hypot
from kk import *
from ktone import TB, tn, derive, shade, paint
import kbuild, gk
from gk import _M

BASE = 0.3          # height of the plinth: the floor line every door sits on
OVER = 0.55         # how far the eaves pass the walls
PITCH = 0.78        # rise over run of a plain roof
SIZES = {
    "Shed":    dict(plot=4,  hx=1.6,  hy=1.4, h=2.95, rc=0.3,  storeys=1, back=0.15, front=(),            side=(0.0,),        rear=(),            wz=(1.55,)),
    "Cabin":   dict(plot=6,  hx=2.75, hy=2.3, h=3.0,  rc=0.4,  storeys=1, back=0.3,  front=(-1.68, 1.68), side=(0.0,),        rear=(0.0,),        wz=(1.72,)),
    "Cottage": dict(plot=8,  hx=3.6,  hy=3.1, h=3.3,  rc=0.45, storeys=1, back=0.35, front=(-2.2, 2.2),   side=(-1.4, 1.4),   rear=(-2.2, 2.2),   wz=(1.75,)),
    "House":   dict(plot=10, hx=4.5,  hy=3.8, h=5.8,  rc=0.5,  storeys=2, back=0.4,  front=(-2.8, 2.8),   side=(-1.7, 1.7),   rear=(-2.8, 2.8),   wz=(1.72, 4.55)),
    "Manor":   dict(plot=14, hx=5.8,  hy=4.6, h=6.0,  rc=0.55, storeys=2, back=0.5,  front=(-4.25, -2.45, 2.45, 4.25), side=(-2.1, 2.1), rear=(-3.9, -1.3, 1.3, 3.9), wz=(1.75, 4.72)),
}

# the colour choices: what each sets the recoloured materials to (a roof is three tones; the others get their light and
# dark steps from ktone.shade)
COLOURS = {
    "roof": {"red": ("#E52521", "#F05236", "#B5211B"), "blue": ("#049CD8", "#38B6EA", "#0478AC"), "green": ("#43B047", "#8FDC4E", "#2E9A45"),
 "teal": ("#1CC7B5", "#5CE0D0", "#12998C"), "purple": ("#8B5FD9", "#A98BEA", "#6B43B5"), "orange": ("#FF8A2A", "#FFA85C", "#D96A12")},
    "wall": {"cream": "#FFF1D0", "pink": "#FFD3E0", "sky": "#CFEFFF", "butter": "#FFE9A8", "mint": "#D5F5E3", "white": "#FFFAEC"},
    "trim": {"wood": "#C98443", "white": "#FFFAEC", "walnut": "#A8622B", "teal": "#1CC7B5"},
    "door": {"blue": "#049CD8", "red": "#E52521", "green": "#43B047", "yellow": "#FBD000", "purple": "#8B5FD9", "pink": "#FF7EB6"},
}

def walls(S):
    """The four walls as (name, centre, direction along the wall, turn of a part that faces out of it, flat half-length)."""
    hx, hy, rc = S["hx"], S["hy"], S["rc"]
    return [("front", (0, -hy), (1, 0), 0.0, hx - rc), ("right", (hx, 0), (0, 1), pi / 2, hy - rc),
            ("rear", (0, hy), (-1, 0), pi, hx - rc), ("left", (-hx, 0), (0, -1), -pi / 2, hy - rc)]

def sockets(S):
    """Where things go on a body: [x, y, z, turn] for the door and each window, the porch (on the ground under the
    door) and the roof (the middle of the wall top)."""
    out = {"door": [0.0, -S["hy"], BASE, 0.0], "porch": [0.0, -S["hy"], 0.0, 0.0], "roof": [0.0, 0.0, BASE + S["h"], 0.0], "windows": []}
    for name, c, d, rz, half in walls(S):
        us = S["front"] if name == "front" else S["rear"] if name == "rear" else S["side"]
        for k, z in enumerate(S["wz"]):
            for u in us + ((0.0,) if (k == 1 and name == "front") else ()):
                out["windows"].append([round(c[0] + d[0] * u, 3), round(c[1] + d[1] * u, 3), round(BASE + z, 3), round(rz, 4)])
    return out

# ---------------------------------------------------------------- shapes
def rring(hx, hy, rc, n):
    out = []
    for cx, cy, a0 in ((hx - rc, hy - rc, 0), (-hx + rc, hy - rc, pi / 2), (-hx + rc, -hy + rc, pi), (hx - rc, -hy + rc, 3 * pi / 2)):
        out += [(cx + rc * cos(a0 + pi / 2 * i / n), cy + rc * sin(a0 + pi / 2 * i / n)) for i in range(n + 1)]
    return out

def rlathe(b, hx, hy, rc, prof, mats, n=5, loc=(0, 0, 0), caps=(True, True)):
    """A box with round corners whose wall follows a profile: prof is [(how far out from the plain box, height)] from
    the bottom up, mats the colour of each band between two profile points."""
    t = bmesh.new(); rings = []
    for o, z in prof: rings.append([t.verts.new((x, y, z)) for x, y in rring(hx + o, hy + o, max(rc + o, 0.02), n)])
    m = len(rings[0]); idx = [b.mi(x) for x in mats]
    for k in range(len(rings) - 1):
        p, q = rings[k], rings[k + 1]
        for i in range(m):
            j = (i + 1) % m; t.faces.new((p[i], p[j], q[j], q[i])).material_index = idx[min(k, len(idx) - 1)]
    if caps[0]: t.faces.new(rings[0][::-1]).material_index = idx[0]
    if caps[1]: t.faces.new(rings[-1]).material_index = idx[-1]
    b._add(t, None, _M(loc))

def offset_line(pts, T):
    """A line drawn left to right, moved T towards its upper side, with mitred corners."""
    P = [Vector(p) for p in pts]; out = []
    def up(a, c):
        d = (c - a).normalized(); return Vector((-d.y, d.x))
    for i, p in enumerate(P):
        if i == 0: out.append(p + up(P[0], P[1]) * T)
        elif i == len(P) - 1: out.append(p + up(P[-2], P[-1]) * T)
        else:
            n1, n2 = up(P[i - 1], p), up(p, P[i + 1]); m = (n1 + n2).normalized(); out.append(p + m * (T / max(0.3, m.dot(n1))))
    return [(v.x, v.y) for v in out]

def tile_slope(b, R0, d, n, ua, L, S, tile, tile2, T=0.12, tile_w=0.9, course=0.62, ns=5, thick=0.07, over=0.08, wf=None):
    """Courses of round-ended tiles on one flat slope, each course stepping over the one below (no tile shares a plane
    with another). R0: the middle of the slope's top edge. d: down the slope. n: out of the slope. ua: along the top
    edge. L: the slope's width, S: its length. wf(s): half the width at s down from the top, for a slope that narrows."""
    R0, d, n, ua = Vector(R0), Vector(d).normalized(), Vector(n).normalized(), Vector(ua).normalized()
    nt = max(1, round(L / tile_w)); tw = L / nt; dep = 0.3 * tw
    nc = max(2, round((S + over) / course)); p = (S + over) / nc
    i1, i2 = b.mi(tile), b.mi(tile2); t = bmesh.new()
    for k in range(nc):
        s_bot = S + over - k * p
        s_top = max(0.0, s_bot - p - dep - 0.03) if k < nc - 1 else 0.0
        off = tw / 2 if k % 2 else 0.0; lim = (wf(s_bot) + 1e-6) if wf else L / 2
        us = {-lim, lim}
        for i in range(-1, nt + 1):
            for j in range(ns + 1):
                u = -L / 2 + off + i * tw + tw * j / ns
                if -lim - 1e-9 <= u <= lim + 1e-9: us.add(round(u, 6))
        us = sorted(us)
        if len(us) < 2: continue
        def drop(u):
            ul = ((u + L / 2 - off) % tw) - tw / 2
            return dep * sqrt(max(0.0, 1 - (2 * ul / tw) ** 2))
        def hh(s): return 0.012 + (thick - 0.012) * (s - s_top) / (s_bot - s_top)
        def pt(u, s, h):
            if wf:
                w = wf(max(s, 0.0)); u = max(-w, min(w, u))
            return R0 + d * s + n * (T + h) + ua * u
        cols = []
        for u in us:
            se = s_bot - dep + drop(u)
            cols.append((t.verts.new(pt(u, s_top, hh(s_top))), t.verts.new(pt(u, se, hh(se))), t.verts.new(pt(u, se, -0.01)), t.verts.new(pt(u, s_top, -0.01))))
        for a, c, ua_, uc in zip(cols, cols[1:], us, us[1:]):
            ti = int(((ua_ + uc) / 2 + L / 2 - off) // tw)
            mi_ = i2 if (ti * 5 + k * 3) % 7 in (0, 3) else i1
            t.faces.new((a[0], c[0], c[1], a[1])).material_index = mi_
            t.faces.new((a[1], c[1], c[2], a[2])).material_index = mi_
        t.faces.new(cols[0]).material_index = i1
        t.faces.new(cols[-1][::-1]).material_index = i1
    kbuild._raw(b, t, flip=(ua.cross(d).dot(n) < 0))

# ---------------------------------------------------------------- body
def body(b, S):
    """Plinth, walls with a dark skirt, a belt between storeys, and a cornice the roof sits on. No holes: doors and
    windows are set on the walls."""
    hx, hy, h, rc = S["hx"], S["hy"], S["h"], S["rc"]; T = BASE + h
    seg = [((0.14, 0.0), None), ((0.2, 0.07), "wallC_dk"), ((0.2, BASE - 0.08), "wallC"), ((0.1, BASE), "wallC_lt"), ((0.0, BASE), "wallC_lt"), ((0.0, BASE + 0.5), "wallA_dk")]
    if S["storeys"] == 2:
        mid = BASE + h * 0.5
        seg += [((0.0, mid - 0.14), "wallA"), ((0.07, mid - 0.1), "trimA_dk"), ((0.07, mid + 0.1), "trimA"), ((0.0, mid + 0.14), "trimA_lt")]
    seg += [((0.0, T - 0.34), "wallA"), ((0.08, T - 0.3), "trimA_dk"), ((0.11, T - 0.24), "trimA"), ((0.11, T - 0.04), "trimA"), ((0.06, T), "trimA_lt")]
    rlathe(b, hx, hy, rc, [p for p, _ in seg], [m for _, m in seg[1:]])

def frame(b, S):
    """The body while it is being built: footing, posts, beams and rafters, a stack of boards and a bucket. Same
    origin and footprint as the finished body, so one replaces the other in place."""
    hx, hy, h = S["hx"], S["hy"], S["h"]; T = BASE + h; W = tn("wood", 0.2, None)
    rlathe(b, hx, hy, S["rc"], [(0.14, 0.0), (0.2, 0.07), (0.2, BASE - 0.08), (0.1, BASE)], ["wallC_dk", "wallC", "wallC_lt", "wallC_lt"])
    xs = (-hx + 0.16, 0.0, hx - 0.16); ys = (-hy + 0.16, 0.0, hy - 0.16)
    for x in xs:
        for y in ys:
            if x == 0.0 and y <= 0.0: continue
            b.box((0.26, 0.26, h - 0.06), (x, y, BASE + (h - 0.06) / 2), W, r=0.04)
    levels = (T,) if S["storeys"] == 1 else (BASE + h / 2, T)
    for z in levels:
        for y in (ys[0], ys[2]): b.box((2 * hx, 0.24, 0.22), (0, y, z - 0.11), "trunk_light", r=0.04)
        for x in (xs[0], xs[2]): b.box((0.24, 2 * hy, 0.22), (x, 0, z - 0.11), "trunk_light", r=0.04)
    th = atan(PITCH); ln = hx / cos(th) + 0.2
    for y in ys:
        for sg in (-1, 1): b.box((ln, 0.18, 0.18), (sg * hx / 2, y, T + PITCH * hx / 2), "wood", r=0.03, rot=(0, sg * th, 0))
    b.box((0.2, 2 * hy + 0.5, 0.2), (0, 0, T + PITCH * hx), "trunk_light", r=0.03)
    for i in range(4): b.box((1.7, 0.34, 0.09), (-hx * 0.45, -hy - 0.55 + 0.02 * (i % 2), 0.05 + 0.1 * i), "trunk_light" if i % 2 else "wood", r=0.02, rot=(0, 0, 0.12 * (i % 2)))
    b.lathe([(0, 0), (0.17, 0), (0.22, 0.3), (0.2, 0.3), (0.16, 0.05), (0, 0.05)], (hx * 0.5, -hy - 0.55, 0), m="steel", seg=12)

def timber(b, S):
    """A finish that goes over a body: fat corner posts, a stud each side of every opening, and a brace in the end
    panels. All of it is trimA."""
    h = S["h"]; z0 = BASE + 0.02; zt = BASE + h - 0.36; H = zt - z0; hx, hy, rc = S["hx"], S["hy"], S["rc"]; P = tn("trimA", 0.14, 0.88)
    for sx in (-1, 1):
        for sy in (-1, 1):
            k = (rc - 0.1) * 0.7071
            b.cyl(0.19, H, (sx * (hx - rc + k), sy * (hy - rc + k), z0), P, seg=12)
    for name, c, d, rz, half in walls(S):
        opens = [0.0] if name == "front" else []
        opens += list(S["front"] if name == "front" else S["rear"] if name == "rear" else S["side"])
        us = sorted({round(o + s * 0.98, 3) for o in opens for s in (-1, 1) if abs(o + s * 0.98) < half - 0.05})
        nx, ny = d[1], -d[0]                                   # out of the wall
        for u in us:
            b.box((0.18, 0.14, H), (c[0] + d[0] * u + nx * 0.02, c[1] + d[1] * u + ny * 0.02, z0 + H / 2), P, r=0.03, rot=(0, 0, rz))
        ends = [-half + 0.05] + us + [half - 0.05]
        for a, e, sg in ((ends[0], ends[1], 1), (ends[-2], ends[-1], -1)):
            w = e - a
            if w < 0.7: continue
            hb = min(H * 0.55, w * 1.3); ang = atan2(hb, w); u = (a + e) / 2
            b.box((hypot(w, hb), 0.1, 0.16), (c[0] + d[0] * u + nx * 0.01, c[1] + d[1] * u + ny * 0.01, z0 + hb / 2 + 0.05), "trimA", r=0.03,
                  rot=(Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(-sg * ang, 4, "Y")).to_3x3())

# ---------------------------------------------------------------- roofs (origin: the middle of the wall top)
def _vent(b, y, z, r=0.36):
    """A round attic window on a front gable."""
    b.lathe([(0, 0), (r, 0), (r + 0.04, 0.05), (r, 0.12), (r - 0.1, 0.12), (r - 0.1, 0.06), (0, 0.06)], (0, y + 0.02, z),
            mats=["trimA_dk", "trimA", "trimA", "trimA_lt", "trimA_dk", "glass"], seg=18, rot=(pi / 2, 0, 0))
    b.box((0.06, 0.05, 2 * r - 0.2), (0, y - 0.06, z), "trimA_lt"); b.box((2 * r - 0.2, 0.05, 0.06), (0, y - 0.06, z), "trimA_lt")

def roof_gable(b, S):
    """Two slopes with the gable to the front, round-ended tiles in two tones, a ridge cap, bargeboards, a round attic
    window and the sprout on the front of the ridge."""
    hx, hy = S["hx"], S["hy"]; W = hx + OVER; rise = PITCH * hx; H = rise * W / hx; L = 2 * hy + 2 * OVER; z0 = -H * (1 - hx / W)
    tb = B(); kbuild.gable_roof(tb, W, L, H, "roofA", "roofB", "roofC", "cream", tile_w=0.9, ns=5, finial=0.5 + 0.06 * S["plot"])
    me = tb.data("_kh_tmp_roof"); b.mesh(me, loc=(0, 0, z0)); bpy.data.meshes.remove(me)
    for y0 in (-hy, hy - 0.25): b.prism([(-hx + 0.03, 0), (hx - 0.03, 0), (0, rise - 0.024)], 0.25, "wallA", mtx=XZ(y0, 0, 0))
    _vent(b, -hy, rise * 0.4, min(0.42, 0.13 * hx + 0.05))
    return {"chimney": [round(hx * 0.45, 3), round(hy * 0.3, 3), round(rise * 0.55 + 0.2, 3)], "height": round(rise + 0.5, 2)}

def roof_hip(b, S):
    """Four slopes meeting in a short ridge, with fat caps down the hips, a cream eave board and the sprout on top."""
    hx, hy = S["hx"], S["hy"]; A, Bh = hx + OVER, hy + OVER; H = PITCH * Bh; ze = -PITCH * OVER; zr = PITCH * hy; rl = A - Bh
    Sl = hypot(Bh, H); T = 0.12
    for sg in (-1, 1):
        tile_slope(b, (0, 0, zr), (0, sg * Bh, -H), (0, sg * H, Bh), (1, 0, 0), 2 * A, Sl, "roofA", "roofB", T, wf=lambda s: rl + Bh * s / Sl)
        tile_slope(b, (sg * rl, 0, zr), (sg * Bh, 0, -H), (sg * H, 0, Bh), (0, 1, 0), 2 * Bh, Sl, "roofA", "roofB", T, wf=lambda s: Bh * s / Sl)
    t = bmesh.new(); o = T * H / Sl; zt = ze + T * Bh / Sl; za = zr + T * Sl / Bh
    lo = [t.verts.new((sx * A, sy * Bh, ze)) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    hi = [t.verts.new((sx * (A + o), sy * (Bh + o), zt)) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    rg = [t.verts.new((rl, 0, za)), t.verts.new((-rl, 0, za))] if rl > 0.01 else [t.verts.new((0, 0, za))] * 2
    i_r, i_c = b.mi("roofA"), b.mi("cream")
    t.faces.new(lo[::-1]).material_index = i_r
    for i in range(4): t.faces.new((lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i])).material_index = i_c
    for vs in ((hi[0], hi[1], rg[1], rg[0]), (hi[2], hi[3], rg[0], rg[1]), (hi[1], hi[2], rg[1]), (hi[3], hi[0], rg[0])):
        vs = [v for i, v in enumerate(vs) if v not in vs[:i]]
        if len(vs) >= 3: t.faces.new(vs).material_index = i_r
    b._add(t, None, None)
    zc = za + 0.1; r = 0.17
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.tube([(sx * rl, 0, zc), (sx * (A + 0.02), sy * (Bh + 0.02), zt + 0.14)], r, "roofC", seg=8); b.ball(r * 1.2, (sx * (A + 0.02), sy * (Bh + 0.02), zt + 0.14), "roofC", u=10, v=6)
        b.ball(r * 1.25, (sx * rl, 0, zc), "roofC", u=10, v=6)
    if rl > 0.01: b.tube([(-rl, 0, zc), (rl, 0, zc)], r, "roofC", seg=8)
    kbuild.sprout(b, (0, 0, zc + r * 0.8), 0.5 + 0.06 * S["plot"])
    return {"chimney": [round(hx * 0.5, 3), round(hy * 0.35, 3), round(PITCH * hy * 0.65 + 0.2, 3)], "height": round(zr + 0.5, 2)}

def roof_barn(b, S):
    """A barn roof, gable to the front: a steep lower slope and a shallow upper one each side, tiled like the others,
    with bargeboards that follow the bend, a round attic window and the sprout."""
    hx, hy = S["hx"], S["hy"]; e = 0.42; p1, p2 = 1.9, 0.42; W = hx + e; xb = hx * 0.62; ze = -p1 * e; zb = p1 * (hx - xb); za = zb + p2 * xb
    L = 2 * hy + 2 * OVER; T = 0.12; S1 = hypot(W - xb, zb - ze); S2 = hypot(xb, za - zb)
    for sg in (-1, 1):
        tile_slope(b, (sg * xb, 0, zb), (sg * (W - xb), 0, -(zb - ze)), (sg * (zb - ze), 0, W - xb), (0, 1, 0), L, S1, "roofA", "roofB", T)
        tile_slope(b, (0, 0, za), (sg * xb, 0, -(za - zb)), (sg * (za - zb), 0, xb), (0, 1, 0), L, S2, "roofA", "roofB", T, over=0.14)
    inner = [(-W, ze), (-xb, zb), (0, za), (xb, zb), (W, ze)]; outer = offset_line(inner, T)
    b.prism(inner + outer[::-1], L, "roofA", mtx=XZ(-L / 2))
    board = outer + offset_line(inner, T - 0.32)[::-1]
    b.prism(board, 0.1, "cream", mtx=XZ(-L / 2 - 0.1)); b.prism(board, 0.1, "cream", mtx=XZ(L / 2))
    zc = outer[2][1] + 0.03; r = 0.17
    b.tube([(0, -L / 2 - 0.06, zc), (0, L / 2 + 0.06, zc)], r, "roofC", seg=10)
    for y in (-L / 2 - 0.1, L / 2 + 0.1): b.ball(r * 1.18, (0, y, zc), "roofC", u=10, v=6)
    for y0 in (-hy, hy - 0.25): b.prism([(-hx + 0.012, 0), (hx - 0.012, 0), (xb - 0.02, zb - 0.01), (0, za - 0.02), (-xb + 0.02, zb - 0.01)], 0.25, "wallA", mtx=XZ(y0, 0, 0))
    _vent(b, -hy, zb * 0.62, min(0.5, 0.15 * hx + 0.05))
    kbuild.sprout(b, (0, -L / 2 - 0.1, zc + r * 0.9), 0.5 + 0.06 * S["plot"])
    return {"chimney": [round(xb * 0.5, 3), round(hy * 0.3, 3), round(zb + p2 * xb * 0.5 + 0.2, 3)], "height": round(za + 0.5, 2)}

ROOFS = {"Gable": roof_gable, "Hip": roof_hip, "Barn": roof_barn}
