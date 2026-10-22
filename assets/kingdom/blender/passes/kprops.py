"""Camp pieces that move (21 Oct 2026): rigged like the animals, so the game plays them.
  campfire  the stone ring, logs and a bed of embers that pulse, and the flame built the way game fire is: flat flame
            cards, each a drawn flame outline (a full round root, a lick to each side, the main tip drawn to a point)
            with its orange and pale yellow heart inside, crossed at 60 degrees so the fire reads from every side.
            Each card bends on a chain of three bones: a wave runs up it (the tip moves most and last), the root swells
            and settles, the tip flickers taller and shorter, each card at its own pace; small licks break off the
            top, rise and go out.
  tent      the canvas is still; a pennant on a short pole at the back of the ridge ripples in the breeze, a wave
            running out along it from the pole.
Same frame as the kit pieces (origin on the ground at the middle, front to -Y), so a rigged piece takes the place of
its kit mesh exactly."""
import bpy, bmesh
from math import sin, cos, pi, tau, atan2
from mathutils import Vector, Matrix
from kk import *
from ktone import TB
import gk, kcamp, kcrops
import kanimals
from kanimals import Rig, pose, bake, smooth

def assemble(rig, coll, weights):
    """Like the animals' assemble, but every piece is weighted by its own rule: weights[bone] is either None (the
    piece follows that bone wholly) or a function of a point giving {bone: weight}."""
    name = rig.name; kanimals._clear(name); vl = bpy.context.view_layer
    ad = bpy.data.armatures.new("KCA_" + name); arm = bpy.data.objects.new("KCA_" + name, ad); coll.objects.link(arm)
    for o in vl.objects:
        try: o.select_set(False)
        except RuntimeError: pass
    vl.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for n in rig.order:
        h, t, p = rig.bones[n]; eb = ad.edit_bones.new(n); eb.head, eb.tail, eb.roll = h, t, 0.0
        if p: eb.parent = ad.edit_bones[p]; eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    gi = {n: i for i, n in enumerate(rig.order)}
    bm = bmesh.new(); dl = bm.verts.layers.deform.verify(); mats = []
    for n in rig.order:
        b = rig.parts[n]
        if not len(b.bm.verts): b.bm.free(); continue
        tmp = bpy.data.meshes.new("_kp"); b.bm.to_mesh(tmp); b.bm.free(); local = list(b.mats)
        v0, f0 = len(bm.verts), len(bm.faces); bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table(); rule = weights.get(n)
        for v in bm.verts[v0:]:
            v[dl].clear()
            for bn, w in (rule(v.co) if rule else {n: 1.0}).items():
                if w > 0.001: v[dl][gi[bn]] = w
        for f in bm.faces[f0:]:
            m = local[min(f.material_index, len(local) - 1)]
            if m not in mats: mats.append(m)
            f.material_index = mats.index(m)
    me = bpy.data.meshes.new("KC_" + name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    if any(m.get("gm_tile") for m in mats): gk.box_uv(me)
    gk.hard_normals(me, 60)
    ob = bpy.data.objects.new("KC_" + name, me); coll.objects.link(ob)
    for n in rig.order: ob.vertex_groups.new(name=n)
    ob.parent = arm; mod = ob.modifiers.new("Armature", "ARMATURE"); mod.object = arm
    for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
    arm["kc_creature"] = name
    return arm, ob

PROPS = {}
def prop(fn): PROPS[fn.__name__.capitalize()] = fn; return fn

TONGUES = [(0.0, 0.0, 0.22, 0.95, 0.0, 0.0), (0.16, 0.06, 0.15, 0.64, 0.25, 0.3), (-0.15, 0.08, 0.15, 0.7, -0.25, 0.55),
           (0.04, -0.16, 0.14, 0.6, 0.2, 0.8), (-0.06, 0.17, 0.13, 0.56, -0.2, 0.15)]
def tongue(b, base, h, R, lean_a, lean, curl, seg=9, rings=8, bands=(0.42, 0.72), mats=("flameCore", "flameMid", "flameTip")):
    """One tongue of flame, as a cartoon fire draws it: a round full belly low down, drawn up to a sharp tip that
    leans out and curls back (an S), flattened a little across, and banded yellow at the root, orange, red at the tip.
    Returns the spine function, so its bones can follow it."""
    base = Vector(base); d = Vector((cos(lean_a), sin(lean_a), 0)); side = Vector((-sin(lean_a), cos(lean_a), 0))
    spine = lambda u: base + Vector((0, 0, h * u)) + d * (h * (lean * u * u - curl * u ** 4))
    rad = lambda u: R * (sin(pi * (0.15 + 0.85 * u)) ** 0.7) * (1 - u) ** 0.35
    t = bmesh.new(); ringsv = []
    for j in range(rings + 1):
        u = j / rings; c = spine(u); r_ = rad(u)
        if j == rings: ringsv.append([t.verts.new(c)]); continue
        ringsv.append([t.verts.new(c + d * (r_ * 0.75 * cos(tau * k / seg)) + side * (r_ * sin(tau * k / seg))) for k in range(seg)])
    mi = [b.mi(m) for m in mats]
    for j in range(rings):
        u = (j + 0.5) / rings; m = mi[0] if u < bands[0] else mi[1] if u < bands[1] else mi[2]
        A_, B_ = ringsv[j], ringsv[j + 1]
        for k in range(seg):
            k2 = (k + 1) % seg
            f = t.faces.new((A_[k], A_[k2], B_[0], ) if len(B_) == 1 else (A_[k], A_[k2], B_[k2], B_[k])); f.material_index = m
    f = t.faces.new(ringsv[0][::-1]); f.material_index = mi[0]
    bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
    for f in t.faces: f.smooth = True
    me = bpy.data.meshes.new("_tongue"); t.to_mesh(me); t.free(); b.bm.from_mesh(me); bpy.data.meshes.remove(me)
    return spine

# A cartoon flame's outline, hand drawn on a unit card (across -0.5..0.5, up 0..1): a full round root, a lick out to
# each side, and the main tip drawn up to a point. Sharp points are kept sharp when the outline is smoothed.
FLAME = [(0.0, 0.0), (0.3, 0.03), (0.46, 0.14), (0.5, 0.3), (0.44, 0.45), (0.37, 0.54), (0.47, 0.68, 1), (0.29, 0.6), (0.24, 0.7),
         (0.15, 0.85), (0.04, 1.0, 1), (-0.07, 0.84), (-0.16, 0.71), (-0.33, 0.82, 1), (-0.28, 0.62), (-0.4, 0.5), (-0.49, 0.32), (-0.45, 0.14), (-0.3, 0.03)]

def _smooth_outline(pts, passes=1):
    """Chaikin's corner cutting, except at the sharp points (the tips of the flame)."""
    for _ in range(passes):
        out = []; n = len(pts)
        for i in range(n):
            p, q = pts[i], pts[(i + 1) % n]
            if len(p) > 2: out.append(p)
            else: out.append((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]))
            if len(q) > 2: out.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
            else: out.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
        pts = out
    return [(p[0], p[1]) for p in pts]

def flame_card(b, at, turn, W, H, mats=("flameTip", "flameMid", "flameCore")):
    """One flame card: the outline in red-orange, inside it a smaller one in orange, inside that the pale yellow
    heart, each a hair in front of the last, on both faces of the card, so it reads from front and back alike.
    Three cards crossed at 60 degrees make a fire that reads from every side, as game fire is built."""
    outline = _smooth_outline(FLAME)
    layers = [(1.0, 1.0, 0.0), (0.7, 0.76, 0.006), (0.42, 0.5, 0.012)]           # (width, height, offset) of each band
    R = Matrix.Rotation(turn, 3, "Z"); at = Vector(at)
    for (sw, sh, off), m in zip(layers, mats):
        for side in (1, -1):
            t = bmesh.new()
            vs = [t.verts.new(at + R @ Vector((x * W * sw, side * off, y * H * sh))) for x, y in outline]
            f = t.faces.new(vs if side > 0 else vs[::-1])
            bmesh.ops.triangulate(t, faces=[f])
            i = b.mi(m)
            for f in t.faces: f.material_index = i; f.smooth = False
            me = bpy.data.meshes.new("_card"); t.to_mesh(me); t.free(); b.bm.from_mesh(me); bpy.data.meshes.remove(me)

@prop
def campfire():
    """The fire's bed: stones, logs, embers that pulse and a glow in the middle. The flame is its own piece (Flame,
    below), because the game turns it to face whoever is looking, as game fire always faces the camera."""
    r = Rig("Campfire"); weights = {}
    base = r.bone("root", (0, 0, 0), (0, 0, 0.2)); kcamp.campfire(base)
    em = r.bone("embers", (0, 0, 0.04), (0, 0, 0.12), "root")
    for k in range(5):
        a = tau * k / 5 + 0.7; em.ball(0.055, (0.1 * cos(a), 0.1 * sin(a), 0.07), "glow", sc=(1, 1, 0.6), u=8, v=5)
    r.bone("glow", (0, 0, 0.1), (0, 0, 0.25), "root").ball(0.14, (0, 0, 0.16), "glow", sc=(1.3, 1.3, 0.8), u=10, v=6)
    @r.clip("Burn", 2.0)
    def burn(t):
        return {"embers": {"s": 1 + 0.12 * sin(tau * 4 * t)}, "glow": {"s": 1 + 0.08 * sin(tau * 6 * t + 1)}}
    return r, weights, "Burn"

def flame_layer(b, x0, z0, W, H, depth, m, outline):
    """One band of a flame, flat, facing the front (-Y): the outline at its size, a hair in front of the band behind."""
    t = bmesh.new()
    vs = [t.verts.new((x0 + x * W, -depth, z0 + y * H)) for x, y in outline]
    f = t.faces.new(vs[::-1]); bmesh.ops.triangulate(t, faces=[f], quad_method="BEAUTY", ngon_method="BEAUTY")
    bmesh.ops.subdivide_edges(t, edges=t.edges[:], cuts=2, use_grid_fill=True)          # points inside, so the bones bend it as a curve
    i = b.mi(m)
    for f in t.faces: f.material_index = i; f.smooth = False
    me = bpy.data.meshes.new("_layer"); t.to_mesh(me); t.free(); b.bm.from_mesh(me); bpy.data.meshes.remove(me)

def _dense(outline, step=0.035):
    """More points along the outline, so the flame bends as a curve and not as a folded sheet."""
    out = []
    for i in range(len(outline)):
        p, q = outline[i], outline[(i + 1) % len(outline)]; n = max(1, int(((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2) ** 0.5 / step))
        for k in range(n): out.append((p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n))
    return out

# (x, height, width, phase): the big flame in the middle and a smaller one each side, a little behind it
UNITS = [(0.0, 1.25, 0.95, 0.0), (-0.22, 0.8, 0.6, 0.37), (0.23, 0.74, 0.56, 0.71)]
# (name, width, height, depth in front, material, phase shift, pace): the rim, the body, the heart
BANDS = [("rim", 1.0, 1.0, 0.0, "flameTip", 0.0, 1.0), ("body", 0.74, 0.8, 0.012, "flameMid", 0.18, 1.25), ("heart", 0.46, 0.54, 0.024, "flameCore", 0.4, 1.5)]
FLICKS = [(0.04, 0.0), (-0.12, 1 / 3), (0.13, 2 / 3)]

@prop
def flame():
    """The flame, drawn as game fire is: flat flame shapes that always face the camera (the game turns this piece to
    the viewer, so it is never seen edge-on, which is what made the crossed cards look like paper). Three flames side
    by side, each in three bands, rim (red-orange), body (orange) and heart (pale yellow), each band on its own bones
    so the colours slide against each other as they do in a real fire: the heart licks up inside the body, the body
    inside the rim, each at its own pace. Every band bends on a spine of three bones (a wave runs up it, the tip
    moving most and last), its tip stretches tall and drops back fast, its side licks flare out and fold in, and
    little flicks break off the top, rise and go out."""
    r = Rig("Flame"); weights = {}; outline = _smooth_outline(FLAME)
    r.bone("root", (0, 0, 0), (0, 0, 0.2))
    for ui, (x0, H, W, ph) in enumerate(UNITS):
        z0 = 0.03; depth0 = 0.03 * (ui > 0)                                           # the side flames sit a little behind
        for name, sw, sh, dep, m, dph, pace in BANDS:
            p = "u%d%s" % (ui, name); w, h = W * sw, H * sh
            b0 = r.bone(p + "0", (x0, 0, z0), (x0, 0, z0 + h * 0.35), "root")
            r.bone(p + "1", (x0, 0, z0 + h * 0.35), (x0, 0, z0 + h * 0.7), p + "0"); r.bone(p + "2", (x0, 0, z0 + h * 0.7), (x0, 0, z0 + h), p + "1")
            r.bone(p + "L", (x0 - w * 0.2, 0, z0 + h * 0.5), (x0 - w * 0.4, 0, z0 + h * 0.75), p + "1")
            r.bone(p + "R", (x0 + w * 0.2, 0, z0 + h * 0.5), (x0 + w * 0.42, 0, z0 + h * 0.66), p + "1")
            flame_layer(b0, x0, z0, w, h, dep - depth0, m, outline)
            def rule(q, p=p, x0=x0, z0=z0, w=w, h=h):
                u = max(0.0, min(1.0, (q.z - z0) / h)); lat = (q.x - x0) / w
                s3 = u * 3.0 - 0.5; k = int(max(0.0, min(1.999, s3))); f = smooth(max(0.0, min(1.0, s3 - k)))
                out = {p + str(k): 1 - f, p + str(k + 1): f}
                lick = smooth(max(0.0, min(1.0, (abs(lat) - 0.2) / 0.15))) * max(0.0, 1 - abs(u - 0.66) / 0.22)
                if lick > 0:
                    out = {n: x * (1 - lick) for n, x in out.items()}; out[p + ("L" if lat < 0 else "R")] = lick
                return out
            weights[p + "0"] = rule
    for k, (x, ph) in enumerate(FLICKS):
        b = r.bone("flick%d" % k, (x, -0.04, 0.9), (x, -0.04, 1.05), "root")
        for name, sw, sh, dep, m, dph, pace in BANDS[:2]:
            flame_layer(b, x, 0.9, 0.16 * sw, 0.24 * sh, 0.04 + dep, m, _smooth_outline(FLAME))
    @r.clip("Burn", 2.0)
    def burn(t):
        v = {}
        for ui, (x0, H, W, ph) in enumerate(UNITS):
            for bi, (name, sw, sh, dep, m, dph, pace) in enumerate(BANDS):
                p = "u%d%s" % (ui, name); q = ph + dph; fa = (3, 4, 5)[bi]; fb = (2, 2, 3)[bi]; fc = (5, 6, 7)[bi]
                a = tau * (fa * t + q); b_ = tau * (fb * t + q)
                v[p + "0"] = {"s": (1 + 0.05 * sin(a + 1), 1, 1 + 0.1 * sin(a)), "r": 0.03 * sin(b_)}
                v[p + "1"] = {"r": 0.1 * sin(b_ - 0.8) + 0.03 * sin(tau * 7 * t + q * 3)}
                v[p + "2"] = {"r": 0.24 * sin(b_ - 1.6) + 0.06 * sin(tau * 9 * t + q * 5), "s": (1 - 0.1 * sin(tau * fc * t + q), 1, 1 + 0.32 * sin(tau * fc * t + q))}
                flare = 0.5 + 0.5 * sin(tau * (fa + 1) * t + q * 2)
                v[p + "L"] = {"r": -0.35 * flare, "s": 0.75 + 0.4 * flare}
                v[p + "R"] = {"r": 0.35 * (1 - flare), "s": 0.75 + 0.4 * (1 - flare)}
        for k, (x, ph) in enumerate(FLICKS):                                # a flick breaks off the top, rises and goes out
            u = (2 * t + ph) % 1.0; grow = smooth(min(1.0, u * 5)) * (1 - u) ** 0.9
            v["flick%d" % k] = {"z": 0.55 * u, "x": 0.06 * sin(tau * u + k), "s": max(0.001, grow)}
        return v
    return r, weights, "Burn"

@prop
def tent():
    r = Rig("Tent"); weights = {}
    base = r.bone("root", (0, 0, 0), (0, 0, 0.3)); kcamp.tent(base)
    top = Vector((0, 1.9, 3.0)); pole = top + Vector((0, 0, 0.62))
    base.cyl(0.022, 0.64, tuple(top), "wood", seg=8); base.ball(0.04, tuple(pole + Vector((0, 0, 0.02))), "gold", u=8, v=5)
    L = 0.62; names = ["flag1", "flag2", "flag3"]
    for k, n in enumerate(names):
        r.bone(n, pole + Vector((L * k / 3, 0, -0.02)), pole + Vector((L * (k + 1) / 3, 0, -0.02)), "root" if k == 0 else names[k - 1])
    fl = r["flag1"]
    def flag(u, v):                       # a pennant: tapering from the pole to a point
        w = 0.2 * (1 - 0.85 * u); return pole + Vector((L * u, 0, -0.02 - w * (v - 0.5) * 2 * 0.5 - w * 0.5 + 0.1))
    kcrops.surface(fl, flag, 2, 8, "red", 0.01)
    def rule(p):
        u = max(0.0, min(0.999, (p.x - pole.x) / L)) * 3; k = int(u); f = u - k
        if k >= 2: return {"flag3": 1.0}
        return {names[k]: 1 - smooth(f), names[k + 1]: smooth(f)}
    weights["flag1"] = rule
    @r.clip("Breeze", 2.0)
    def breeze(t):
        v = {}
        for k, n in enumerate(names):
            v[n] = {"y": 0.32 * sin(tau * (2 * t) - 0.9 * k) + (0.12 if k == 0 else 0.0), "r": 0.12 * sin(tau * (2 * t) - 0.9 * k - 0.6)}
        return v
    return r, weights, "Breeze"
