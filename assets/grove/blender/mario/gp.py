"""Grove merchandising engine. A Shop builds fixtures and stock in the shop's own frame (front faces -Y at y = -3.4,
back wall at y = +3.45, x from -5.75 to 5.75, z = 0 on the floor tiles). Every fixture is one object whose origin sits at
the fixture, so a unit and its stock move together. Stock is placed from each product's bounding box onto a known
surface, so nothing can float, sink or overhang; shelf() splits a board into sections with dividers and price tags."""
import bpy, bmesh, math, random, re, importlib
from math import sin, cos, pi, tau, radians
from mathutils import Vector, Matrix
import gk
from gk import *
from gk import _M
import gpk; importlib.reload(gpk)
from gpk import DEFS, cc

SHOPS = {  # key: (xc, yc, floor z, turned half a turn, accent, short name)
    "GROVE_GROCER": (-20, -14, 0, True, "green", "Grocer"), "THREAD_THIMBLE": (20, -14, 0, True, "pink", "Thread"),
    "HOME_NOOK": (20, 14, 0, False, "terracotta", "Home"), "CAFE_CANOPY": (-20, 14, 0, False, "red", "Cafe"),
    "SOLE_SEARCH": (-20, -14, 5, True, "blue", "Sole"), "PIXEL_PANTRY": (20, -14, 5, True, "purple", "Pixel"),
    "MAKER_MEADOW": (-20, 14, 5, False, "gold", "Maker"), "SEASONAL_POP_UP": (20, 14, 5, False, "rose", "Seasonal"),
    "BOOK_BURROW": (-20, -14, 10, True, "teal", "Book"), "ALLTIMEFITNESS": (20, -14, 10, True, "sky", "Fitness"),
    "FOOD_HALL": (-20, 14, 10, False, "orange", "Food"), "ROOFTOP_GARDEN": (20, 14, 10, False, "leaf_dark", "Garden"),
}
_K = {}
def prod(kind, col=None):
    key = (kind, repr(col)); v = _K.get(key)
    if v is not None:
        try:
            v[0].name; return v
        except ReferenceError: pass
    b = B(); DEFS[kind](b, col)
    xs = [v.co for v in b.bm.verts]
    lo = Vector((min(c.x for c in xs), min(c.y for c in xs), min(c.z for c in xs))); hi = Vector((max(c.x for c in xs), max(c.y for c in xs), max(c.z for c in xs)))
    me = bpy.data.meshes.new("GKP_" + kind); b.bm.to_mesh(me); b.bm.free()
    for m in b.mats: me.materials.append(m)
    _K[key] = (me, lo, hi, sum(len(p.vertices) - 2 for p in me.polygons)); return _K[key]
def purge():
    for me in [m for m in bpy.data.meshes if m.name.startswith("GKP_") and m.users == 0]: bpy.data.meshes.remove(me)
    _K.clear()
def dims(kind, col=None, rz=0.0, sc=1.0):
    me, lo, hi, nt = prod(kind, col); w, d, h = (hi - lo)
    return (abs(w * cos(rz)) + abs(d * sin(rz))) * sc, (abs(w * sin(rz)) + abs(d * cos(rz))) * sc, h * sc
def put(b, kind, col, x, y, z, rz=0.0, sc=1.0, tilt=None, pre=None, hang=False):
    me, lo, hi, nt = prod(kind, col)
    T0 = Matrix.Identity(4) if hang else Matrix.Translation((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, "Z")
    if tilt is not None: m = m @ tilt
    m = m @ Matrix.Scale(sc, 4) @ T0
    if pre is not None: m = pre @ m
    b.mesh(me, None, mtx=m)
BOOKC = ["red", "orange", "yellow", "green", "teal", "blue", "navy", "purple", "pink", "rose", "terracotta", "leaf_dark", "sky", "plum"]

class RB(B):
    """Builder that remembers which faces belong to which placed product (face attribute 'pid', 0 = fixture)."""
    def __init__(s):
        super().__init__(); s.lay = s.bm.faces.layers.int.new("pid"); s.pid = 0
    def _add(s, t, m=None, mtx=None):
        n0 = len(s.bm.faces); super()._add(t, m, mtx)
        if s.pid:
            s.bm.faces.ensure_lookup_table()
            for f in s.bm.faces[n0:]: f[s.lay] = s.pid

class Shop:
    def __init__(s, key, keep, src=None, base=None, acc=None, short=None, tint=None):
        xc, yc, z0, rot, acc0, short0 = SHOPS.get(key, (0, 0, 0, False, "pink", key))
        s.key = key; s.short = short or short0; s.src = bpy.data.collections[src or key + "_INTERIOR_REFINEMENT"]; s.col = fresh("MERCH_" + key, s.src.name)
        s.acc = acc or acc0; s.tint = M(tint) if tint else M("shop_" + key + "_tint")
        s.base = base or (Matrix.Translation((xc, yc, z0 + 0.03)) @ Matrix.Rotation(pi if rot else 0.0, 4, "Z")); s.inv = s.base.inverted()
        s.side = (1 if xc < 0 else -1) * (-1 if rot else 1)
        s.b = None; s.rep = {"objects": 0, "tris": 0, "notes": [], "superseded": 0}
        rx = re.compile(keep); gone = [o for o in s.src.objects if o.type == "MESH" and not rx.search(o.name)]
        s.rep["superseded"] = supersede(gone); s.rep["kept"] = len([o for o in s.src.objects if o.type == "MESH"])
    def note(s, t):
        if len(s.rep["notes"]) < 30: s.rep["notes"].append(t)
    def lbb(s, pat):
        """Bounding box, in the shop frame, of the kept objects whose name matches."""
        rx = re.compile(pat); pts = [s.inv @ (o.matrix_world @ Vector(c)) for o in s.src.objects if o.type == "MESH" and rx.search(o.name) for c in o.bound_box]
        if not pts: s.note("no match " + pat); return None
        return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    def ground(s, pat):
        """Kept Codex pieces that hover: lower the matched set together until the lowest one rests on the floor."""
        rx = re.compile(pat); obs = [o for o in s.src.objects if o.type == "MESH" and rx.search(o.name)]
        if not obs: return
        z = min((s.inv @ (o.matrix_world @ Vector(c))).z for o in obs for c in o.bound_box)
        if 0.004 < z < .08:
            for o in obs: o.location.z -= z
            bpy.context.view_layer.update(); s.note("grounded %s by %.3f" % (pat, z))
    def each(s, pat):
        rx = re.compile(pat); out = []
        for o in s.src.objects:
            if o.type == "MESH" and rx.search(o.name):
                pts = [s.inv @ (o.matrix_world @ Vector(c)) for c in o.bound_box]
                out.append((Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))))
        return out
    def drop(s, pat):
        rx = re.compile(pat); s.rep["superseded"] += supersede([o for o in s.src.objects if o.type == "MESH" and rx.search(o.name)])
    def begin(s, name, x=0.0, y=0.0, rz=0.0, z=0.0):
        s.end(); s.b = RB(); s.kinds = []; s.name = name; s.frame = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, "Z"); return s.b
    def end(s):
        if s.b is None: return
        if len(s.b.bm.faces):
            o = s.b.obj("M_%s_%s" % (s.short, s.name), s.col, 62); o.matrix_world = s.base @ s.frame; o.data["gm_kinds"] = ",".join(s.kinds)
            s.rep["objects"] += 1; s.rep["tris"] += sum(len(p.vertices) - 2 for p in o.data.polygons)
        else: s.b.bm.free()
        s.b = None
    def done(s):
        s.end(); purge(); return s.rep
    def put(s, kind, col, x, y, z, **kw):
        s.kinds.append(kind); s.b.pid = len(s.kinds); put(s.b, kind, col, x, y, z, **kw); s.b.pid = 0
    def pbox(s, pre, p0, p1, m, r=0.0):
        c = Vector([(p0[i] + p1[i]) / 2 for i in range(3)]); s.b.box([abs(p1[i] - p0[i]) for i in range(3)], pre @ c, m, r=r, seg=1, rot=pre.to_3x3())

    # ------------------------------------------------------------ fixtures (drawn in the current object's frame)
    def wallunit(s, L, depth=.46, levels=(.2, .72, 1.24), cap=1.8, bays=None, board="white", back=None, acc=None):
        """Shelving against a wall: back at y = 0, front towards -Y. Returns U['bays'][bay][level]; the last level is the cap."""
        b = s.b; acc = acc or s.acc; x0, x1 = -L / 2, L / 2; yf = -depth; n = bays or max(1, round(L / 2.3)); bw = L / n; lv = list(levels)
        b.box2((x0, -.05, 0), (x1, 0, cap), back or s.tint); b.box2((x0 + .05, yf + .08, 0), (x1 - .05, -.05, .1), "slate")
        for i in range(n + 1): b.box2((x0 + i * bw - .05, yf + .03, 0), (x0 + i * bw + .05, -.05, cap), acc, r=.03, seg=1)
        b.box2((x0 - .06, yf - .03, cap), (x1 + .06, 0, cap + .09), acc, r=.04, seg=1)
        U = {"bays": [], "L": L, "n": n, "top": cap + .09, "depth": depth}
        for i in range(n):
            a, c = x0 + i * bw + .05, x0 + (i + 1) * bw - .05; row = []
            for k, z in enumerate(lv):
                b.box2((a, yf, z - .05), (c, -.05, z), board); b.box2((a, yf - .014, z - .055), (c, yf, z + .006), acc)
                row.append({"x0": a, "x1": c, "yf": yf, "yb": -.05, "top": z, "clear": (lv[k + 1] - .05 if k + 1 < len(lv) else cap) - z, "f": -1})
            row.append({"x0": a - .05, "x1": c + .05, "yf": yf, "yb": -.02, "top": cap + .09, "clear": None, "f": -1, "nolip": True}); U["bays"].append(row)
        return U
    def gondola(s, L, half=.38, levels=(.18, .62), H=1.1, board="white"):
        """Double-sided aisle unit along X. Returns {'A': levels facing -Y, 'B': levels facing +Y, 'top': cap}."""
        b = s.b; acc = s.acc; x0, x1 = -L / 2, L / 2; lv = list(levels); G = {"A": [], "B": []}
        b.box2((x0, -.03, 0), (x1, .03, H), s.tint); b.box2((x0 + .05, -half + .08, 0), (x1 - .05, half - .08, .08), "slate")
        for xx in (x0, x1): b.box2((xx - .05, -half + .03, 0), (xx + .05, half - .03, H), acc, r=.03, seg=1)
        b.box2((x0 - .06, -.22, H), (x1 + .06, .22, H + .07), acc, r=.03, seg=1)
        for key, f in (("A", -1), ("B", 1)):
            for k, z in enumerate(lv):
                b.box2((x0 + .05, f * half, z - .05), (x1 - .05, f * .03, z), board); b.box2((x0 + .05, f * half, z - .055), (x1 - .05, f * (half + .014), z + .006), acc)
                G[key].append({"x0": x0 + .05, "x1": x1 - .05, "yf": f * half, "yb": f * .03, "top": z, "clear": (lv[k + 1] - .05 if k + 1 < len(lv) else H) - z, "f": f})
        G["top"] = {"x0": x0, "x1": x1, "yf": -.2, "yb": .2, "top": H + .07, "clear": None, "f": -1, "nolip": True}; return G
    def table(s, w, d, h=.56, top="white", leg=None, tier=None, cloth=None):
        """Display table centred on the origin. tier = (width, depth, height) adds a raised step along the back."""
        b = s.b; leg = leg or s.acc
        b.box2((-w / 2, -d / 2, h - .07), (w / 2, d / 2, h), top, r=.03, seg=1); b.box2((-w / 2 + .07, -d / 2 + .07, h - .17), (w / 2 - .07, d / 2 - .07, h - .07), leg)
        for sx in (-1, 1):
            for sy in (-1, 1): b.box((.09, .09, h - .07), (sx * (w / 2 - .12), sy * (d / 2 - .12), (h - .07) / 2), leg, r=.02, seg=1)
        z = h
        if cloth: b.box2((-w / 2 + .12, -d / 2 - .0, h), (w / 2 - .12, d / 2 + .0, h + .008), cloth); z = h + .008
        T = {"x0": -w / 2 + .03, "x1": w / 2 - .03, "yf": -d / 2 + .02, "yb": d / 2 - .03, "top": z, "clear": None, "f": -1, "nolip": True}
        if tier:
            tw, td, th = tier; b.box2((-tw / 2, d / 2 - .05 - td, z), (tw / 2, d / 2 - .05, z + th), "wood", r=.015, seg=1)
            return T, {"x0": -tw / 2 + .02, "x1": tw / 2 - .02, "yf": d / 2 - .05 - td + .01, "yb": d / 2 - .07, "top": z + th, "clear": None, "f": -1, "nolip": True}
        return T
    def pedestal(s, r, h, x=0.0, y=0.0, col=None):
        s.b.lathe([(r, 0), (r, .05), (r * .88, .07), (r * .88, h - .07), (r, h - .05), (r, h), (0, h)], (x, y, 0), mats=[col or s.acc, "white", "white", "white", col or s.acc, "white"], seg=14)
        return {"x0": x - r * .68, "x1": x + r * .68, "yf": y - r * .68, "yb": y + r * .68, "top": h, "clear": None, "f": -1, "nolip": True}
    def riser(s, x0, x1, y0, y1, z, h, col="wood"):
        s.b.box2((x0, y0, z), (x1, y1, z + h), col, r=.012, seg=1)
        return {"x0": x0 + .01, "x1": x1 - .01, "yf": min(y0, y1) + .01, "yb": max(y0, y1) - .01, "top": z + h, "clear": None, "f": -1, "nolip": True}
    def railunit(s, L, modes, depth=.52, H=1.66, rail_z=1.42, shelf_z=.2):
        """Clothing unit: back at y = 0. modes gives one entry per bay: 'side' (a rail to hang sideways) or 'face' (two arms to show fronts)."""
        b = s.b; acc = s.acc; x0, x1 = -L / 2, L / 2; n = len(modes); bw = L / n; R = []
        b.box2((x0, -.05, 0), (x1, 0, H), s.tint); b.box2((x0 + .05, -depth + .08, 0), (x1 - .05, -.05, .1), "slate")
        for i in range(n + 1): b.box2((x0 + i * bw - .05, -depth + .03, 0), (x0 + i * bw + .05, -.05, H), acc, r=.03, seg=1)
        b.box2((x0 - .06, -depth - .03, H), (x1 + .06, 0, H + .09), acc, r=.04, seg=1)
        for i, mode in enumerate(modes):
            a, c = x0 + i * bw + .05, x0 + (i + 1) * bw - .05
            b.box2((a, -depth, shelf_z - .05), (c, -.05, shelf_z), "white"); b.box2((a, -depth - .014, shelf_z - .055), (c, -depth, shelf_z + .006), acc)
            bay = {"x0": a, "x1": c, "mode": mode, "rail_y": -depth * .52, "rail_z": rail_z, "depth": depth,
                   "base": {"x0": a, "x1": c, "yf": -depth, "yb": -.05, "top": shelf_z, "clear": .46, "f": -1},
                   "top": {"x0": a - .05, "x1": c + .05, "yf": -depth, "yb": -.02, "top": H + .09, "clear": None, "f": -1, "nolip": True}}
            if mode == "side": b.cyl(.02, c - a, (a, -depth * .52, rail_z), "steel", seg=8, rot=(0, pi / 2, 0))
            R.append(bay)
        return R
    def hang_side(s, bay, items, pad=.2, turn=1, sc=1.0):
        """Hang garments sideways on the bay's rail, evenly spaced. items = [(kind, colour), ...]."""
        n = len(items); a, c = bay["x0"] + pad, bay["x1"] - pad
        for i, (kind, col) in enumerate(items):
            x = (a + c) / 2 if n == 1 else a + (c - a) * i / (n - 1)
            s.put(kind, col, x, bay["rail_y"], bay["rail_z"] - (.024 * sc - .02), rz=turn * pi / 2, hang=True, sc=sc)
    def hang_face(s, bay, x, items, sc=1.0):
        """A straight arm out of the back panel with garments facing the shopper, front one fully visible."""
        d = bay["depth"]; z = bay["rail_z"]; b = s.b
        b.cyl(.014, d - .1, (x, -.05, z), "steel", seg=6, rot=(pi / 2, 0, 0)); b.ball(.024, (x, -d + .05, z), s.acc, u=8, v=4)
        for k, (kind, col) in enumerate(items): s.put(kind, col, x, -d + .1 + k * .085 * sc, z - (.024 * sc - .014), hang=True, sc=sc)
    def slatwall(s, L, H=1.85, z0=.25):
        b = s.b; x0, x1 = -L / 2, L / 2
        b.box2((x0, -.05, 0), (x1, 0, H), s.tint); b.box2((x0 - .06, -.1, H), (x1 + .06, 0, H + .09), s.acc, r=.035, seg=1)
        for xx in (x0, x1): b.box2((xx - .05, -.09, 0), (xx + .05, 0, H), s.acc, r=.03, seg=1)
        z = z0
        while z < H - .1: b.box2((x0 + .05, -.066, z), (x1 - .05, -.05, z + .035), "white"); z += .2
    def peg(s, x, z, length=.13):
        s.b.cyl(.011, length, (x, -.05, z), "steel", seg=6, rot=(pi / 2, 0, 0)); s.b.ball(.018, (x, -.05 - length, z), s.acc, u=8, v=4)
    def ledge(s, xa, xb, z, d=.27):
        b = s.b; b.box2((xa, -.05 - d, z - .035), (xb, -.05, z), "white"); b.box2((xa, -.05 - d - .014, z - .04), (xb, -.05 - d, z + .012), s.acc)
        for xx in (xa + .12, xb - .12): b.prism([(0, 0), (d * .8, 0), (0, -d * .7)], .03, s.acc, mtx=YZ(xx - .015, -.05, z - .035, True))
        return {"x0": xa, "x1": xb, "yf": -.05 - d, "yb": -.07, "top": z, "clear": None, "f": -1}
    def case(s, L, d, z, levels=(.03, .24), H=.46, x=0.0, y=0.0):
        """Glass-fronted counter case sitting at height z. Returns its shelves, front towards -Y."""
        b = s.b; x0, x1 = x - L / 2, x + L / 2; y0, y1 = y - d / 2, y + d / 2; out = []
        b.box2((x0, y0, z), (x1, y1, z + levels[0]), "white", r=.01, seg=1)
        for sx in (x0 + .02, x1 - .02):
            for sy in (y0 + .02, y1 - .02): b.box((.03, .03, H - levels[0]), (sx, sy, z + (H + levels[0]) / 2), s.acc)
        for k, lz in enumerate(levels):
            if k: b.box2((x0 + .02, y0 + .03, z + lz - .015), (x1 - .02, y1 - .02, z + lz), "white")
            out.append({"x0": x0 + .05, "x1": x1 - .05, "yf": y0 + .04, "yb": y1 - .03, "top": z + lz, "clear": (levels[k + 1] - .015 if k + 1 < len(levels) else H - .02) - lz, "f": -1, "nolip": True})
        b.box2((x0, y0, z + H - .02), (x1, y1, z + H), "white", r=.008, seg=1); b.box2((x0 + .03, y0, z + levels[0]), (x1 - .03, y0 + .01, z + H - .02), "glass")
        return out
    def booth(s, w=1.7, d=1.5, h=2.5):
        """Fitting room with a striped curtain across the front (-Y) and a stool inside. Tall enough for Kai."""
        b = s.b
        for sx in (-1, 1):
            for sy in (-1, 1): b.box((.1, .1, h), (sx * (w / 2 - .05), sy * (d / 2 - .05), h / 2), "white", r=.02, seg=1)
            b.box2((sx * (w / 2 - .07), -d / 2 + .1, .08), (sx * (w / 2 - .03), d / 2 - .1, h - .13), s.tint)
        b.box2((-w / 2 + .1, d / 2 - .07, .08), (w / 2 - .1, d / 2 - .03, h - .13), s.tint)
        b.box2((-w / 2 - .04, -d / 2 - .04, h - .14), (w / 2 + .04, d / 2 + .04, h), s.acc, r=.04, seg=1); bloom(b, (0, -d / 2 - .045, h - .07), .09, "-y", "white", "yellow", 6)
        b.cyl(.018, w - .2, (-w / 2 + .1, -d / 2 + .05, h - .22), "steel", seg=6, rot=(0, pi / 2, 0)); n = 7; pw = (w - .22) / n
        for i in range(n): b.box((pw, .07, h - .4), (-w / 2 + .11 + pw * (i + .5), -d / 2 + .05 + (.02 if i % 2 else -.015), .16 + (h - .4) / 2), s.acc if i % 2 else "white", r=.03, seg=1)
        b.lathe([(.2, 0), (.2, .04), (.07, .08), (.07, .32), (.26, .35), (.26, .4), (.23, .42), (0, .42)], (0, .25, 0), mats=["wood", "wood", "wood", "wood", s.acc, s.acc, s.acc], seg=10)
    def bench(s, L, d=.7, h=.42, col=None):
        """Upholstered bench. Seat top at h: 0.42 m suits the cast's body (see p24_seating)."""
        s.b.box2((-L / 2 + .08, -d / 2 + .08, 0), (L / 2 - .08, d / 2 - .08, h - .13), "wood", r=.03, seg=1); s.b.box2((-L / 2, -d / 2, h - .14), (L / 2, d / 2, h), col or s.acc, r=.06, seg=2)
    def mirror(s, w=.9, h=2.15):
        b = s.b; b.box((w, .06, h), (0, .11, h / 2), s.acc, r=.03, seg=1, rot=(-.1, 0, 0)); b.box((w - .14, .01, h - .14), (0, .078, h / 2 - .003), "water_light", rot=(-.1, 0, 0))
        b.box((w * .8, .5, .04), (0, .25, .02), "wood"); b.box((.05, .04, h * .8), (0, .33, h * .4), "wood", rot=(.14, 0, 0))
    def kit(s, name, x, y, z, h=None, sc=None, rz=0.0):
        """Drop one of the shared GK_ kit meshes (trees, bushes, flowers) into the current object, scaled to height h."""
        me = bpy.data.meshes.get(name)
        if me is None: s.note("no kit mesh " + name); return
        zs = [v.co.z for v in me.vertices]; k = sc or h / (max(zs) - min(zs))
        s.b.mesh(me, None, mtx=Matrix.Translation((x, y, z - min(zs) * k)) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Scale(k, 4))
    def crate(s, x, y, z, w=.64, d=.46, hgt=.13, tilt=17, col="wood", wedge=True, back=True):
        """Open wooden crate tipped towards the shopper (front at -Y). Returns the crate's frame: floor at z = .02, y from 0 (front) to d."""
        a = radians(tilt); pre = Matrix.Translation((x, y - d / 2 * cos(a), z)) @ Matrix.Rotation(a, 4, "X"); P = s.pbox
        P(pre, (-w / 2, 0, 0), (w / 2, d, .02), "trunk_light"); P(pre, (-w / 2, 0, 0), (w / 2, .022, hgt * .55), col)
        if back: P(pre, (-w / 2, d - .022, 0), (w / 2, d, hgt), col)
        P(pre, (-w / 2, 0, 0), (-w / 2 + .022, d, hgt), col); P(pre, (w / 2 - .022, 0, 0), (w / 2, d, hgt), col)
        if wedge and tilt > 1: s.b.prism([(0, 0), (d * cos(a), 0), (d * cos(a), d * sin(a))], w - .08, "trunk", mtx=YZ(x - (w - .08) / 2, y - d / 2 * cos(a), z))
        return pre
    def fill(s, pre, kind, cols, nx, ny, w=.64, d=.46, z=.02, rz=0.0, sc=1.0, layers=1, mx=.05, my=.05, jit=0.0, seed=1):
        """Grid of one product inside a crate or tray frame; further layers sit in the gaps of the one below."""
        cols = cols if isinstance(cols, list) else [cols]; pw, pd, ph = dims(kind, cols[0], rz, sc); rnd = random.Random(seed); k = 0
        nx = max(1, min(nx, int((w - 2 * mx + .004) / pw))); ny = max(1, min(ny, int((d - 2 * my + .004) / pd)))
        sx = (w - 2 * mx - pw) / (nx - 1) if nx > 1 else 0.0; sy = (d - 2 * my - pd) / (ny - 1) if ny > 1 else 0.0; r = min(pw, pd) / 2 * .97
        dh = math.hypot(sx / 2 if nx > 1 else 0, sy / 2 if ny > 1 else 0); flat = ph < .6 * min(pw, pd)
        dz = ph * .8 if flat else math.sqrt(max(0.0, 4 * r * r - dh * dh)) * .93
        for L in range(layers):
            ax, ay = (nx - L if nx > 1 else 1), (ny - L if ny > 1 else 1)
            if ax < 1 or ay < 1 or (L and (nx == 1 and ny == 1)) or (L and dz < .25 * ph): break
            for i in range(ax):
                for j in range(ay):
                    px = 0 if nx == 1 else (-w / 2 + mx + pw / 2) + (w - 2 * mx - pw) * (i + L / 2) / (nx - 1)
                    py = d / 2 if ny == 1 else (my + pd / 2) + (d - 2 * my - pd) * (j + L / 2) / (ny - 1)
                    s.put(kind, cols[k % len(cols)], px, py, z + L * dz, rz=rz + rnd.uniform(-jit, jit), sc=sc, pre=pre); k += 1
    def picksign(s, pre, x, y, col="yellow", h=.2):
        s.pbox(pre, (x - .006, y - .006, .02), (x + .006, y + .006, h), "wood"); s.pbox(pre, (x - .07, y - .014, h - .03), (x + .07, y - .004, h + .06), col, r=.01)
    def header(s, bd, kind, col, x=None, sc=None, board=None):
        """Sign on top of a unit: a rounded board with the bay's product standing in front of it as the icon."""
        x = (bd["x0"] + bd["x1"]) / 2 if x is None else x; z = bd["top"]; b = s.b; w, d, h = dims(kind, col)
        k = sc or min(.3 / max(h, .01), .36 / max(w, .01), 1.6)
        b.box((.54, .05, .4), (x, -.085, z + .2), board or s.acc, r=.045, seg=1); b.box((.44, .008, .3), (x, -.113, z + .2), "white")
        s.put(kind, col, x, -.13 - d * k / 2, z, sc=k)
    def shelf(s, bd, items, x0=None, x1=None, rows=1, tags=True, div=True, margin=.04, gap=.02, secgap=.07, maxgap=.06):
        """Lay out sections of facings on one board. items = [(kind, colour or [colours], facings, {rows, rz, sc, stack})]."""
        b = s.b; f = bd["f"]; xa = (bd["x0"] if x0 is None else x0) + margin; xb = (bd["x1"] if x1 is None else x1) - margin
        usable = abs(bd["yb"] - bd["yf"]); S = []
        for it in items:
            kind, col, n = it[:3]; o = it[3] if len(it) > 3 else {}
            cols = col if isinstance(col, list) else [col]; rz = o.get("rz", 0.0) + (0.0 if f < 0 else pi); sc = o.get("sc", 1.0); st = o.get("stack", 1)
            w, d, h = dims(kind, cols[0], rz, sc)
            if bd["clear"] is not None:
                lim = bd["clear"] - .025
                while st > 1 and h * st > lim: st -= 1
                if h > lim:
                    k = lim / h; sc *= k; w, d, h = w * k, d * k, h * k; s.note("%s shrunk x%.2f in %s" % (kind, k, s.name))
            auto = 2 if (prod(kind, cols[0])[3] <= 64 and d <= .2) else 1
            if d > usable - .022:
                k = (usable - .022) / d; sc *= k; w, d, h = w * k, d * k, h * k; s.note("%s shrunk x%.2f for depth in %s" % (kind, k, s.name))
            S.append({"kind": kind, "cols": cols, "n": n, "rz": rz, "sc": sc, "w": w, "d": d, "h": h, "st": st, "fm": min(.045, usable - .01 - d), "rows": o.get("rows", max(rows, auto)), "tray": o.get("tray")})
        avail = xb - xa; share = (avail - secgap * (len(S) - 1)) / len(S)
        for e in S:
            if not e["n"]: e["n"] = max(1, int((share + gap) / (e["w"] + gap)))
        nat = lambda e: e["n"] * e["w"] + (e["n"] - 1) * gap
        while sum(nat(e) for e in S) + secgap * (len(S) - 1) > avail:
            e = max(S, key=nat)
            if e["n"] <= 1: s.note("overfull " + s.name); break
            e["n"] -= 1
        gaps = sum(e["n"] - 1 for e in S); extra = avail - sum(nat(e) for e in S) - secgap * (len(S) - 1)
        g = gap + (min(maxgap - gap, extra / gaps) if gaps else 0.0); nat2 = lambda e: e["n"] * e["w"] + (e["n"] - 1) * g
        rem = max(0.0, avail - sum(nat2(e) for e in S) - secgap * (len(S) - 1)); sg = secgap + rem / (len(S) + 1); x = xa + rem / (len(S) + 1)
        for i, e in enumerate(S):
            sw = nat2(e); nr = max(1, min(e["rows"], int((usable - .03) / (e["d"] + .02)))); zt = 0.0
            if e["tray"]:
                zt = .02; dd = nr * (e["d"] + .02) + .04; b.box2((x - .03, bd["yf"] - f * .02, bd["top"]), (x + sw + .03, bd["yf"] - f * (.02 + dd), bd["top"] + zt), e["tray"], r=.008, seg=1)
            for j in range(e["n"]):
                px = x + e["w"] / 2 + j * (e["w"] + g); c = e["cols"][j % len(e["cols"])]
                for r in range(nr):
                    py = bd["yf"] - f * (e["fm"] + e["d"] / 2 + r * (e["d"] + .02))
                    for k in range(e["st"]): s.put(e["kind"], c, px, py, bd["top"] + zt + k * e["h"], rz=e["rz"], sc=e["sc"])
            if tags and not bd.get("nolip"): b.box((.1, .01, .045), (x + sw / 2, bd["yf"] + f * .019, bd["top"] - .027), "yellow")
            if div and i < len(S) - 1: b.box((.012, usable - .06, .1), (x + sw + sg / 2, (bd["yf"] + bd["yb"]) / 2, bd["top"] + .05), "cream")
            x += sw + sg
    def books(s, bd, x0, x1, seed=1, end=True):
        """A run of upright books, spines to the front, with a bookend at the open end."""
        b = s.b; f = bd["f"]; rnd = random.Random(seed); lim = (bd["clear"] or .34) - .03; x = x0; yfr = bd["yf"] - f * .05; k = rnd.randrange(len(BOOKC))
        while True:
            w = rnd.uniform(.045, .075); h = min(lim, rnd.uniform(.22, .3)); d = rnd.uniform(.18, .21)
            if x + w > x1 - (.03 if end else 0): break
            c = BOOKC[k % len(BOOKC)]; k += rnd.choice((1, 1, 2, 3)); b.box((w - .004, d, h), (x + w / 2, yfr - f * d / 2, bd["top"] + h / 2), c)
            if rnd.random() < .7: b.box((w - .002, .006, .03), (x + w / 2, yfr + f * .002, bd["top"] + h * rnd.choice((.25, .7, .8))), rnd.choice(("white", "yellow", "cream")))
            x += w
        if end: b.box((.02, .12, .16), (x + .012, yfr - f * .07, bd["top"] + .08), s.acc); b.box((.07, .12, .012), (x + .037, yfr - f * .07, bd["top"] + .006), s.acc)
    def bookstack(s, x, y, z, n=3, seed=1, sc=1.0, col=None, turn=.25):
        rnd = random.Random(seed); k = rnd.randrange(len(BOOKC))
        for i in range(n):
            s.b.box((.2 * sc, .27 * sc, .045 * sc), (x, y, z + (.0225 + i * .045) * sc), col or BOOKC[(k + i * 3) % len(BOOKC)], rot=(0, 0, rnd.uniform(-turn, turn))); s.b.box((.19 * sc, .262 * sc, .03 * sc), (x + .008 * sc, y, z + (.0225 + i * .045) * sc), "cream", rot=(0, 0, 0))
        return z + n * .045 * sc
    def stack(s, kind, cols, x, y, z, n, rz=0.0, sc=1.0, twist=.0):
        cols = cols if isinstance(cols, list) else [cols]; w, d, h = dims(kind, cols[0], 0, sc)
        for i in range(n): s.put(kind, cols[i % len(cols)], x, y, z + i * h, rz=rz + twist * ((i % 2) * 2 - 1), sc=sc)
        return z + n * h
    def pyramid(s, kind, cols, x, y, z, base=3, rz=0.0, sc=1.0, lift=.86):
        """Rows of base, base-1 ... items side by side along X (for rolls and round things)."""
        cols = cols if isinstance(cols, list) else [cols]; w, d, h = dims(kind, cols[0], rz, sc); k = 0
        for sx in (-1, 1): s.b.prism([(0, 0), (sx * .07, 0), (0, .06)], d * .7, "wood", mtx=XZ(y - d * .35, x + sx * (base * w / 2 - .012), z))
        for L in range(base):
            for i in range(base - L): s.put(kind, cols[k % len(cols)], x + (i - (base - L - 1) / 2) * w, y, z + L * h * lift, rz=rz, sc=sc); k += 1
    def group(s, bd, items):
        """Loose placement on a surface: items = [(kind, colour, fx, fy, {rz, sc, stack})], fx and fy are 0..1 across and front to back."""
        for it in items:
            kind, col, fx, fy = it[:4]; o = it[4] if len(it) > 4 else {}; n = o.get("stack", 1); sc = o.get("sc", 1.0); f = bd["f"]
            x = bd["x0"] + (bd["x1"] - bd["x0"]) * fx; y = bd["yf"] + (bd["yb"] - bd["yf"]) * fy; rz = o.get("rz", 0.0) + (0.0 if f < 0 else pi); h = dims(kind, col[0] if isinstance(col, list) else col, 0, sc)[2]
            for i in range(n): s.put(kind, col if not isinstance(col, list) else col[i % len(col)], x, y, bd["top"] + i * h, rz=rz + o.get("twist", 0.0) * (i % 2), sc=sc)
    def bucket(s, x, y, z, cols, r=1.0):
        s.b.lathe([(.1 * r, 0), (.13 * r, .22 * r), (.14 * r, .22 * r), (.14 * r, .24 * r), (.125 * r, .24 * r), (.125 * r, .2 * r), (0, .2 * r)], (x, y, z), mats=["steel", "steel", "steel", "steel", "steel", "water"], seg=10)
        for i, c in enumerate(cols):
            a = tau * i / len(cols) + .5; s.put("bouquet", c, x + .05 * r * cos(a), y + .05 * r * sin(a), z + .1 * r, rz=a, sc=r, tilt=Matrix.Rotation(.28, 4, "Y"))
    def promo(s, kind, cols, base=3, sign="red"):
        """Floor stack on a pallet with a price burst on a stick: the classic aisle-end offer."""
        b = s.b; cols = cols if isinstance(cols, list) else [cols]; w, d, h = dims(kind, cols[0]); W = base * (w + .02) + .12; Dp = 2 * (d + .02) + .12
        for sx in (-1, 0, 1): b.box((.1, Dp, .06), (sx * (W / 2 - .05), 0, .03), "trunk")
        b.box((W, Dp, .03), (0, 0, .075), "wood"); k = 0
        for L in range(base):
            for i in range(base - L):
                for j in range(2 if L < base - 1 else 1):
                    s.put(kind, cols[(L + i) % len(cols)], (i - (base - L - 1) / 2) * (w + .02), ((j - .5) * (d + .02)) if L < base - 1 else 0, .09 + L * h); k += 1
        zt = .09 + base * h; b.box((.02, .02, .22), (0, 0, zt + .11), "wood")
        b.cyl(.15, .02, (0, .01, zt + .34), sign, seg=10, rot=(pi / 2, 0, 0)); b.cyl(.11, .008, (0, -.01, zt + .34), "yellow", seg=10, rot=(pi / 2, 0, 0))

def tri_total():
    """Triangles after modifiers for everything that is exported."""
    dg = bpy.context.evaluated_depsgraph_get(); out = {}; skip = ("MARIO_BACKDROP", "MARIO_LIGHTS", "MARIO_SCALE_REFERENCE", "GROVE_SUPERSEDED_BY_MARIO_PASS")
    for c in bpy.context.scene.collection.children:
        if c.name in skip or c.hide_viewport: continue
        t = 0
        for o in c.all_objects:
            if o.type != "MESH": continue
            me = o.evaluated_get(dg).data; t += sum(len(p.vertices) - 2 for p in me.polygons)
        out[c.name] = t
    out["TOTAL"] = sum(out.values()); return out
