"""Kingdom building parts. Each function adds one part to a builder (gk.B) in the part's own local frame, so the
same code serves the prototype cottage now and the house kit later."""
import bpy, bmesh
from kk import *
from math import atan2
import gk

def _raw(b, t, flip=False):
    if flip: bmesh.ops.reverse_faces(t, faces=t.faces[:])
    for f in t.faces: f.smooth = True
    me = gk._scr(); t.to_mesh(me); t.free(); b.bm.from_mesh(me)

def sprout(b, loc=(0, 0, 0), s=1.0, rz=0.0, bud=None):
    """The Kingdom's emblem: a seedling with two leaves, about 1 m tall at s = 1, leaves spread along local X so it
    reads from the front (-Y) and the back. bud: colour name for a small bud between the leaves."""
    x, y, z = loc; c, sn = cos(rz), sin(rz)
    P = lambda px, pz: (x + px * c * s, y + px * sn * s, z + pz * s)
    b.tube([P(0, -0.05), P(0.02, 0.25), P(0, 0.5)], [0.07 * s, 0.06 * s, 0.05 * s], "leaf_dark", seg=6)
    for sg in (-1, 1):
        b.ball(s, P(sg * 0.33, 0.68), "leaf_light", sc=(0.36, 0.2, 0.085), u=10, v=6, rot=(0, -sg * 0.6, rz))
    if bud: b.ball(0.11 * s, P(0, 0.62), bud, u=8, v=5)

def gable_roof(b, W, L, H, tile, tile2=None, cap=None, board="white", T=0.12, tile_w=0.8, course=0.62,
               boards=(True, True), ns=6, thick=0.07, finial=0.0, ridge=0.17):
    """A gable roof as ONE mesh. Local frame: ridge along Y through x = 0, eave underside at z = 0, ridge underside at
    z = H, half-width W, length L centred on y = 0.
    Parts: a solid slab, courses of round-ended tiles that step over each other (no tile shares a plane with another),
    a rounded ridge cap, and a V board on each gable end that follows the slope exactly.
    tile2: a second tile colour used on a scattering of tiles. boards: (front at -Y, back at +Y).
    finial: size of a sprout on the front end of the ridge (0 for none)."""
    tile2 = tile2 or tile; cap = cap or tile
    S = sqrt(W * W + H * H)
    apex = H + T * S / W
    We, Ze = W + T * H / S, T * W / S                      # slab top corner at the eave
    b.prism([(-W, 0), (0, H), (W, 0), (We, Ze), (0, apex), (-We, Ze)], L, tile, mtx=XZ(-L / 2))
    nt = max(1, round(L / tile_w)); tw = L / nt; dep = 0.3 * tw
    over = 0.08; nc = max(2, round((S + over) / course)); p = (S + over) / nc
    i1, i2 = b.mi(tile), b.mi(tile2)
    for sgn in (-1, 1):
        d = Vector((sgn * W, 0, -H)) / S; n = Vector((sgn * H, 0, W)) / S; R0 = Vector((0, 0, H))
        t = bmesh.new()
        for k in range(nc):
            s_bot = S + over - k * p
            s_top = max(0.0, s_bot - p - dep - 0.03) if k < nc - 1 else 0.0
            off = tw / 2 if k % 2 else 0.0
            us = {-L / 2, L / 2}
            for i in range(-1, nt + 1):
                for j in range(ns + 1):
                    u = -L / 2 + off + i * tw + tw * j / ns
                    if -L / 2 - 1e-9 <= u <= L / 2 + 1e-9: us.add(round(u, 6))
            us = sorted(us)
            def drop(u): 
                ul = ((u + L / 2 - off) % tw) - tw / 2
                return dep * sqrt(max(0.0, 1 - (2 * ul / tw) ** 2))
            def hh(s): return 0.012 + (thick - 0.012) * (s - s_top) / (s_bot - s_top)
            def pt(u, s, h): return R0 + d * s + n * (T + h) + Vector((0, u, 0))
            cols = []
            for u in us:
                se = s_bot - dep + drop(u)
                cols.append((t.verts.new(pt(u, s_top, hh(s_top))), t.verts.new(pt(u, se, hh(se))),
                             t.verts.new(pt(u, se, -0.01)), t.verts.new(pt(u, s_top, -0.01))))
            for a, c, ua, uc in zip(cols, cols[1:], us, us[1:]):
                ti = int(((ua + uc) / 2 + L / 2 - off) // tw)
                mi_ = i2 if (ti * 5 + k * 3) % 7 in (0, 3) else i1
                t.faces.new((a[0], c[0], c[1], a[1])).material_index = mi_
                t.faces.new((a[1], c[1], c[2], a[2])).material_index = mi_
            t.faces.new(cols[0]).material_index = i1
            t.faces.new(cols[-1][::-1]).material_index = i1
        _raw(b, t, flip=(sgn > 0))
    # ridge cap with a rounded end at each gable
    r = ridge
    b.tube([(0, -L / 2 - 0.06, apex + 0.03), (0, L / 2 + 0.06, apex + 0.03)], r, cap, seg=10)   # ends stop inside the boards
    for y in (-L / 2 - 0.1, L / 2 + 0.1): b.ball(r * 1.18, (0, y, apex + 0.03), cap, u=10, v=6)
    # gable boards: the top edge is the slab's top line, so a board can never stick out past the roof
    bh = max(0.2, min(0.34, 0.12 * S + 0.1))
    V = [(-We, Ze), (0, apex), (We, Ze), (We, Ze - bh), (0, apex - bh), (-We, Ze - bh)]
    if boards[0]: b.prism(V, 0.1, board, mtx=XZ(-L / 2 - 0.1))      # butts the slab end, never overlaps its top
    if boards[1]: b.prism(V, 0.1, board, mtx=XZ(L / 2))
    if finial: sprout(b, (0, -L / 2 - 0.1, apex + 0.03 + r * 0.9), finial)          # the emblem on the front gable
    return {"slope": round(S, 2), "courses": nc, "tiles_per_course": nt}

def arch(b, half=2.0, clear=2.75):
    """Arrival arch: two chunky posts, a wooden bow with leaves growing along it and a big sprout on top.
    Origin on the ground at the centre; the front faces -Y. half: post centre from the middle; clear: headroom."""
    for sg in (-1, 1):
        x = sg * half
        b.lathe([(0.46, 0), (0.46, 0.16), (0.36, 0.26), (0.36, 0.3)], (x, 0, 0), "stone", seg=14)
        b.cyl(0.27, clear - 0.3, (x, 0, 0.3), "cream", seg=14)
        b.lathe([(0.33, 0), (0.36, 0.06), (0.33, 0.12)], (x, 0, 1.2), "red", seg=14)
        b.lathe([(0.3, 0), (0.37, 0.08), (0.37, 0.2), (0.24, 0.3), (0, 0.34)], (x, 0, clear), "gold", seg=14)
    n = 14; rise = 1.0; pts = []
    for i in range(n + 1):
        u = i / n; a = pi * (1 - u); pts.append((half * cos(a), 0, clear + 0.12 + rise * sin(a)))
    b.tube(pts, 0.19, "wood", seg=8)
    for i in (2, 4, 10, 12):
        px, _, pz = pts[i]; sprout(b, (px, 0, pz + 0.1), 0.42)
    sprout(b, (0, 0, clear + 0.12 + rise + 0.1), 1.25, bud="pink")
    # a hanging board with the emblem on it (no words: icons cost a quarter of what letters do)
    zb = clear + 0.12 + rise - 0.62
    for sx in (-0.42, 0.42): b.cyl(0.02, 0.3, (sx, 0, zb + 0.2), "wood", seg=5)
    b.box((1.3, 0.1, 0.5), (0, 0, zb), "cream", r=0.05)
    for sg in (-1, 1): b.ball(1.0, (sg * 0.2, -0.06, zb + 0.03), "leaf_light", sc=(0.2, 0.02, 0.09), u=10, v=6, rot=(0, -sg * 0.55, 0))
    b.box((0.05, 0.03, 0.26), (0, -0.06, zb - 0.1), "leaf_dark", r=0.01)

def tent(b):
    """Day 1 home: a 4 x 4 cell tent, the first step of the house ladder (tent, cabin 6 x 6, cottage 8 x 8, house 10 x 10).
    Origin on the ground at the centre; the door faces -Y."""
    b.box((3.7, 3.7, 0.06), (0, 0, 0.03), "sand", r=0.02)
    b.prism([(-1.65, 0.05), (1.65, 0.05), (0, 3.0)], 3.2, "cream", mtx=XZ(-1.6), r=0.04)
    b.prism([(-0.88, 0.06), (0.88, 0.06), (0, 2.2)], 0.05, "trunk", mtx=XZ(-1.64))              # the way in
    for sg in (-1, 1):
        b.tube([(sg * 0.92, -1.66, 0.08), (0, -1.66, 2.28)], 0.055, "red", seg=6)
        b.tube([(sg * 1.62, -1.62, 0.1), (sg * 1.62, 1.62, 0.1)], 0.06, "red", seg=6)                # hem
        for y in (-1.2, 1.2): b.cyl(0.05, 0.3, (sg * 1.95, y, 0), "wood", seg=6, rot=(0, -sg * 0.5, 0))
    b.tube([(0, -1.9, 3.0), (0, 1.9, 3.0)], 0.06, "wood", seg=6)
    for y in (-1.9, 1.9): b.ball(0.09, (0, y, 3.0), "gold", u=8, v=5)
    sprout(b, (0, -1.72, 3.02), 0.6)

def campfire(b):
    for i in range(8):
        a = tau * i / 8; b.ball(0.17, (0.56 * cos(a), 0.56 * sin(a), 0.07), "stone" if i % 2 else "grey", sc=(1, 0.8, 0.62), u=7, v=4, rot=(0, 0, a))
    for a in (0.2, 1.3, 2.4):
        c, s_ = cos(a), sin(a); b.tube([(-0.42 * c, -0.42 * s_, 0.09), (0.42 * c, 0.42 * s_, 0.16)], 0.075, "trunk", seg=6)
    b.lathe([(0, 0.12), (0.2, 0.2), (0.25, 0.36), (0.13, 0.62), (0, 0.86)], m="orange", seg=8)
    b.lathe([(0, 0.16), (0.11, 0.24), (0.13, 0.36), (0.06, 0.52), (0, 0.62)], (0.02, -0.03, 0.02), "glow", seg=6)

def log_stool(b):
    b.cyl(0.36, 0.4, (0, 0, 0), "trunk", seg=12, bev=0.03)
    b.cyl(0.3, 0.025, (0, 0, 0.4), "trunk_light", seg=12)

def sign(b, icon="sprout"):
    """A marker post with the emblem on its board. Front faces -Y."""
    b.cyl(0.07, 1.25, (0, 0, 0), "wood", seg=8)
    b.box((0.95, 0.09, 0.6), (0, -0.02, 1.3), "cream", r=0.05)
    for sg in (-1, 1): b.ball(1.0, (sg * 0.17, -0.075, 1.36), "leaf_light", sc=(0.17, 0.02, 0.08), u=10, v=6, rot=(0, -sg * 0.55, 0))
    b.box((0.045, 0.03, 0.24), (0, -0.075, 1.24), "leaf_dark", r=0.01)

# ---------------------------------------------------------------- the house ladder: cabin, 6 x 6 cells
CABIN = dict(hx=2.8, y0=-2.2, y1=2.8, base=0.26, wall=3.0, rise=1.7)

def cabin_frame(b):
    """The cabin while it is being built: footing, posts, beams and rafters, with a stack of boards. Same footprint
    and origin as the finished cabin, so one replaces the other in place."""
    c = CABIN; hx, y0, y1, z0 = c["hx"], c["y0"], c["y1"], c["base"]; top = z0 + c["wall"]; cy = (y0 + y1) / 2
    b.box((5.8, 5.2, z0), (0, cy, z0 / 2), "stone", r=0.06)
    for x in (-hx + 0.11, 0, hx - 0.11):
        for y in (y0 + 0.11, cy, y1 - 0.11):
            if x == 0 and y == cy: continue
            b.box((0.22, 0.22, c["wall"]), (x, y, z0 + c["wall"] / 2), "wood")
    for y in (y0 + 0.11, y1 - 0.11): b.box((2 * hx, 0.22, 0.2), (0, y, top), "trunk_light")
    for x in (-hx + 0.11, hx - 0.11): b.box((0.22, y1 - y0, 0.2), (x, cy, top), "trunk_light")
    th = atan2(c["rise"], hx); ln = sqrt(hx * hx + c["rise"] ** 2)
    for y in (y0 + 0.11, cy, y1 - 0.11):
        for sg in (-1, 1): b.box((ln, 0.16, 0.16), (sg * hx / 2, y, top + c["rise"] / 2), "wood", rot=(0, sg * th, 0))
    b.box((0.18, y1 - y0 + 0.4, 0.18), (0, cy, top + c["rise"]), "trunk_light")
    for i in range(4): b.box((1.9, 0.34, 0.09), (-1.3, -0.9 + 0.02 * (i % 2), z0 + 0.05 + 0.1 * i), "trunk_light" if i % 2 else "wood", rot=(0, 0, 0.12 * (i % 2)))
    b.box((0.5, 0.5, 0.32), (1.5, -1.0, z0 + 0.16), "wood", r=0.03)

def cabin(b):
    """The first built house: a log cabin on a 6 x 6 cell plot. Origin on the ground at the centre of the plot; the
    door faces -Y. The roof's three tones are the materials roofA, roofB, roofC and nothing else uses them."""
    c = CABIN; hx, y0, y1, z0 = c["hx"], c["y0"], c["y1"], c["base"]; top = z0 + c["wall"]; cy = (y0 + y1) / 2
    b.box((5.8, 5.2, z0), (0, cy, z0 / 2), "stone", r=0.06)
    n = 6; ch = c["wall"] / n
    for i in range(n): b.box((2 * hx, y1 - y0, ch), (0, cy, z0 + ch * (i + 0.5)), "wood" if i % 2 == 0 else "trunk_light", r=0.07)
    for y in (y0, y1 - 0.22): b.prism([(-hx, 0), (hx, 0), (0, c["rise"])], 0.22, "wood", mtx=XZ(y, 0, top))
    W = hx + 0.55; H = c["rise"] * W / hx
    tb = B(); gable_roof(tb, W, y1 - y0 + 0.9, H, "roofA", "roofB", "roofC", "white", finial=0.7)
    me = tb.data("_kk_tmp_roof"); b.mesh(me, loc=(0, cy, top - H * (1 - hx / W))); bpy.data.meshes.remove(me)
    yf = y0 - 0.04
    b.box((1.7, 0.16, 2.5), (0, yf, z0 + 1.25), "white", r=0.04)
    b.box((1.3, 0.14, 2.25), (0, yf - 0.06, z0 + 1.125), "blue", r=0.04)
    b.ball(0.075, (0.45, yf - 0.16, z0 + 1.1), "gold", u=8, v=5)
    for sx in (-1.85, 1.85):
        b.box((1.0, 0.14, 1.0), (sx, yf, z0 + 1.7), "white", r=0.04)
        b.box((0.76, 0.1, 0.76), (sx, yf - 0.06, z0 + 1.7), "glass")
        b.box((0.06, 0.05, 0.76), (sx, yf - 0.12, z0 + 1.7), "white"); b.box((0.76, 0.05, 0.06), (sx, yf - 0.12, z0 + 1.7), "white")
        b.box((1.16, 0.26, 0.1), (sx, yf - 0.1, z0 + 1.14), "trunk_light", r=0.03)
    for sg in (-1, 1):
        b.box((0.14, 1.0, 1.0), (sg * (hx + 0.04), cy, z0 + 1.7), "white", r=0.04)
        b.box((0.1, 0.76, 0.76), (sg * (hx + 0.1), cy, z0 + 1.7), "glass")
    b.box((2.2, 0.7, 0.14), (0, y0 - 0.35, 0.07), "stone", r=0.04)
    zr = top - H * (1 - hx / W) + H * (1 - 1.5 / W)
    b.box((0.7, 0.7, 1.6), (1.5, cy + 1.0, zr + 0.45), "stone", r=0.05)
    b.box((0.9, 0.9, 0.14), (1.5, cy + 1.0, zr + 1.3), "roofC", r=0.03)

def bench(b):
    """Garden bench, 2 x 1 cells. Seat top 0.42 m, back to 1.05 m (sized to the cast's body). Front faces -Y."""
    for sx in (-1, 1): b.box((0.18, 0.5, 0.34), (sx * 0.72, 0.0, 0.17), "white", r=0.05)
    b.box((1.9, 0.6, 0.1), (0, 0.0, 0.37), "wood", r=0.04)
    b.box((1.9, 0.12, 0.62), (0, 0.33, 0.74), "wood", r=0.05, rot=(-0.14, 0, 0))
    for sx in (-1, 1): b.box((0.14, 0.14, 0.75), (sx * 0.88, 0.33, 0.7), "white", r=0.04, rot=(-0.14, 0, 0))
    for sg in (-1, 1): b.ball(1.0, (sg * 0.15, 0.24, 0.84), "leaf_light", sc=(0.16, 0.02, 0.075), u=10, v=6, rot=(0, -sg * 0.55, 0))
    b.box((0.04, 0.03, 0.2), (0, 0.25, 0.72), "leaf_dark")

def fence_post(b):
    """The first fence the player puts up, from the same wood as the cabin frame: a rounded post with a domed cap
    and a darker ring where it meets the ground (bare white boxes read as plastic)."""
    b.cyl(0.1, 0.12, (0, 0, 0), "trunk", seg=10, bev=0.02)
    b.cyl(0.085, 0.86, (0, 0, 0.08), "wood", seg=10, bev=0.02)
    b.lathe([(0.1, 0.9), (0.105, 0.94), (0.07, 1.0), (0.0, 1.02)], m="trunk", seg=10)

def fence_rail(b):
    """Half a fence bay: two rails from the post at the cell centre to the cell's +X edge. The game draws one of
    these towards each neighbouring fence, so runs, corners and T-joints need no extra pieces."""
    for z in (0.36, 0.72):
        b.box((0.5, 0.06, 0.12), (0.25, 0, z), "wood", r=0.022)
        for sy in (-1, 1): b.box((0.42, 0.006, 0.012), (0.27, sy * 0.031, z + 0.02 * sy), "trunk")     # a grain line each side
