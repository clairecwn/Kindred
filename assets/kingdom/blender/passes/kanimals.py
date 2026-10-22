"""Animals, second build (21 Oct 2026). Claire judged the first rigged animals "blobs put together": balls and
cylinders, each stuck to one bone, read as a toy made of parts, not as an animal. What the research says the games do
(Nintendo's Mario and Animal Crossing animals, Overcooked, Hay Day), as rules:
  1. One continuous body. The torso, neck, head and legs are one smooth surface that flows from one part into the
     next, so the silhouette reads as one animal. Here the body is modelled as clay: metaball forms (barrel, chest,
     haunch, neck, skull, muzzle, tapered legs) that melt together, turned into a mesh and thinned out.
  2. Bend like skin. The body is weighted to its bones by Blender's bone heat (automatic weights), so a knee, a neck
     or a spine bends smoothly. Only hard things are rigid: hooves, horns, eyes, a bell.
  3. Shape language and proportions. Round, soft forms for friendly animals; a big head (a third to a half of the body
     length, the Animal Crossing and Mario rule), big eyes high on the face with a light in them, a chunky body, and
     legs short enough to look cute but with the real joints: a front knee that bends back, a hind leg that zig-zags
     (stifle forward, hock back), and a hoof wider than the leg above it.
  4. Read the species from the silhouette. Cow: a broad barrel, short thick neck, a big pink muzzle, small horns,
     ears out to the side, a tufted tail, an udder, a collar with a bell (the Mario Kart cow). Pony: a long arched
     neck with a mane, a long face with a wide soft muzzle, a full tail, slimmer legs. Sheep: a cloud of wool over a
     dark face and legs. Chicken: a teardrop body, a raised tail fan, comb and wattles.
  5. Colour is painted on the one surface: cow patches, a pale muzzle and dark hooves are faces of the body in another
     material, not blobs stuck on. Paint stays on KV_A_ (coat) and KV_B_ (patches) so the game can recolour.
  6. Move like the animal, with weight and overlap: the four-beat walk (left hind, left fore, right hind, right fore),
     the hips rolling over the planted leg, the hoof flicking back as it lifts, the head nodding twice a stride, the
     tail and ears following a beat late; idles that breathe, blink, look about, flick an ear, swat the tail.
The frame is the life kit's: the ground at z = 0, the front towards -Y."""
import bpy, bmesh
from math import sin, cos, pi, tau, sqrt, atan2, acos
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
from kk import *
from ktone import TB, tn, derive, V
import gk
from klife import A, P, cone

FPS = 24
THR, STIFF = 0.6, 3.0
def _k(stiff=STIFF): return sqrt(1 - (THR / stiff) ** (1 / 3))       # surface radius / field radius for one element

# ---------------------------------------------------------------- clay: the body as metaball forms
class Clay:
    """Forms given by their surface size; they melt together where they meet."""
    def __init__(s): s.els = []
    def ell(s, c, axes, rot=(0, 0, 0), stiff=STIFF):
        s.els.append(("ELLIPSOID", Vector(c), 1 / _k(stiff), axes, rot, stiff)); return s
    def ball(s, c, R, stiff=STIFF):
        s.els.append(("BALL", Vector(c), R / _k(stiff), None, (0, 0, 0), stiff)); return s
    def limb(s, pts, radii, stiff=STIFF):
        """A tapering limb through pts: capsules between the points, each a little thinner than the last."""
        for i in range(len(pts) - 1):
            a, b = Vector(pts[i]), Vector(pts[i + 1]); d = b - a; L = d.length
            for k in range(3):                                            # three capsules a segment, so it tapers
                u0, u1 = k / 3, (k + 1) / 3; pa, pb = a + d * u0, a + d * u1
                R = radii[i] + (radii[i + 1] - radii[i]) * (u0 + u1) / 2
                q = Vector((1, 0, 0)).rotation_difference(d.normalized())
                s.els.append(("CAPSULE", (pa + pb) / 2, R / _k(stiff), (L / 6 / (R / _k(stiff)), 1, 1), q, stiff))
        return s
    def mesh(s, name, res=0.028, keep=0.45):
        mb = bpy.data.metaballs.new("_clay"); mb.resolution = res; mb.render_resolution = res; mb.threshold = THR
        for kind, c, r, size, rot, stiff in s.els:
            e = mb.elements.new(type=kind); e.co = c; e.radius = r; e.stiffness = stiff
            if size is not None:
                if kind == "CAPSULE": e.size_x = size[0] * r
                else: e.size_x, e.size_y, e.size_z = size
            e.rotation = rot if isinstance(rot, Quaternion) else Matrix.Rotation(rot[2], 3, "Z").to_quaternion() @ Matrix.Rotation(rot[0], 3, "X").to_quaternion()
        ob = bpy.data.objects.new("_clay", mb); bpy.context.scene.collection.objects.link(ob)
        bpy.context.view_layer.update()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(ob); bpy.data.metaballs.remove(mb)
        tmp = bpy.data.objects.new("_clay", me); bpy.context.scene.collection.objects.link(tmp)
        d = tmp.modifiers.new("thin", "DECIMATE"); d.ratio = keep
        sm = tmp.modifiers.new("even", "SMOOTH"); sm.factor = 0.5; sm.iterations = 2
        bpy.context.view_layer.update()
        out = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(tmp); bpy.data.meshes.remove(me); out.name = name
        for p in out.polygons: p.use_smooth = True
        return out

def paint(me, rules, default):
    """Gives each face of the body its material: the first rule whose test passes on the face's middle and normal."""
    mats = [default] + [m for m, f in rules]; slots = []
    for m in mats:
        mm = M(m) if isinstance(m, str) else m
        if mm not in slots: slots.append(mm)
    for m in slots: me.materials.append(m)
    idx = {id(m): i for i, m in enumerate(slots)}
    def index(m): return idx[id(M(m) if isinstance(m, str) else m)]
    for p in me.polygons:
        c, n = p.center, p.normal; p.material_index = index(default)
        for m, f in rules:
            if f(c, n): p.material_index = index(m); break

def onto(bvh, at, d, back=0.0):
    """The point where a ray from `at` along `d` meets the body, pulled back into it by `back`; and the normal there."""
    d = Vector(d).normalized(); hit, nor, _, _ = bvh.ray_cast(Vector(at) - d * 0.5, d, 2.0)
    if hit is None: return Vector(at), -d
    return hit - nor * back, nor

def decal(b, bvh, p, nor, shape, m, lift=0.004, face=None):
    """A flat shape painted on the body: its outline is laid in the surface's own plane at p and every point is
    dropped onto the surface, then lifted a hair off it, so it follows the curve of the face like a printed sticker.
    shape: points (across, up) in metres round the middle."""
    face = Vector(face).normalized() if face is not None else nor       # the way the shape is printed on: laid flat across it
    up = Vector((0, 0, 1)); up = (up - face * up.dot(face)).normalized() if abs(face.z) < 0.98 else Vector((0, 1, 0))
    across = up.cross(face).normalized()
    def drop(q):
        hit, n2, _, _ = bvh.ray_cast(q + face * 0.08, -face, 0.3)
        return (hit + n2 * lift) if hit is not None else q + nor * lift
    t = bmesh.new(); mid = t.verts.new(drop(p)); rings = []
    for k in (1, 2, 3):                                                     # three rings in, so the shape lies on the curve
        rings.append([t.verts.new(drop(p + (across * x + up * y) * (k / 3))) for x, y in shape])
    n = len(shape)
    for i in range(n): t.faces.new((mid, rings[0][i], rings[0][(i + 1) % n]))
    for k in range(2):
        for i in range(n): t.faces.new((rings[k][i], rings[k + 1][i], rings[k + 1][(i + 1) % n], rings[k][(i + 1) % n]))
    bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
    for f in t.faces:
        if f.normal.dot(nor) < 0: f.normal_flip()
    i = b.mi(m)
    for f in t.faces: f.material_index = i; f.smooth = True
    me = bpy.data.meshes.new("_decal"); t.to_mesh(me); t.free(); b.bm.from_mesh(me); bpy.data.meshes.remove(me)

def oval(rx, ry, cx=0.0, cy=0.0, n=20):
    return [(cx + rx * cos(tau * k / n), cy + ry * sin(tau * k / n)) for k in range(n)]

def eye(b, bvh, p, nor, r, side, lid=False):
    """An eye painted on the face. What reads as friendly in the games and the drawing guides: a small round bead of
    a dark eye, big enough to see but not big enough to stare, set wide apart and low on the face, looking forward,
    with one round light well inside it, near its top towards the outside, so the light never breaks the eye's edge.
    Only one light: a second speck beside it read as one shape with it, a teardrop. And no lid: a dark arc over the
    eye read as a frown. (lid is kept as an argument so the callers need not change.)
    All of it is printed flat on the skin, looking forward, in its own materials (KI_eye*), which the game draws a
    hair in front of the face so the face never shows through when the head turns."""
    face = (nor + Vector((0, -1.0, 0))).normalized()
    decal(b, bvh, p, nor, oval(r, r * 1.08, 0, 0, 24), "eyeInk", 0.004, face)
    decal(b, bvh, p, nor, oval(r * 0.27, r * 0.27, side * r * 0.3, r * 0.34, 14), "eyeShine", 0.007, face)

def blobs(c, n, spots, wobble=0.18):
    """A cow's patches: inside one of `spots` (centre, radius), with a ragged edge."""
    for sc, sr in spots:
        d = (c - Vector(sc)).length
        wob = 1 + wobble * sin(c.x * 23 + c.y * 17) * cos(c.z * 19 - c.y * 7)
        if d < sr * wob: return True
    return False

# ---------------------------------------------------------------- the rig
class Rig:
    def __init__(s, name):
        s.name = name; s.bones = {}; s.order = []; s.parts = {}; s.clips = {}; s.statics = {}; s.body = None; s.rules = []; s.coat = None
        s.thick = {}; s.skin = set()           # how thick the body is round each bone; which bones the body follows
    def bone(s, n, head, tail, parent=None):
        s.bones[n] = (Vector(head), Vector(tail), parent); s.order.append(n); s.parts[n] = TB(); return s.parts[n]
    def __getitem__(s, n): return s.parts[n]
    def clip(s, name, secs):
        def deco(fn): s.clips[name] = (secs, fn); return fn
        return deco

def _clear(name):
    for n in ("KC_" + name, "KCA_" + name, "_body_" + name):
        o = bpy.data.objects.get(n)
        if o:
            d = o.data; bpy.data.objects.remove(o, do_unlink=True)
            if d is not None and d.users == 0:
                (bpy.data.armatures if isinstance(d, bpy.types.Armature) else bpy.data.meshes).remove(d)
    for a in [a for a in bpy.data.actions if a.name.startswith(name + "_")]: bpy.data.actions.remove(a)

def assemble(rig, coll):
    """The armature, the body weighted softly to its bones (skin_weights), and the hard parts bound wholly to theirs."""
    name = rig.name; _clear(name); vl = bpy.context.view_layer
    ad = bpy.data.armatures.new("KCA_" + name); arm = bpy.data.objects.new("KCA_" + name, ad); coll.objects.link(arm)
    for o in vl.objects:
        try: o.select_set(False)
        except RuntimeError: pass
    vl.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for n in rig.order:
        h, t, p = rig.bones[n]; eb = ad.edit_bones.new(n); eb.head, eb.tail, eb.roll = h, t, 0.0
        eb.use_deform = not n.startswith("root")
        if p: eb.parent = ad.edit_bones[p]; eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    body = bpy.data.objects.new("_body_" + name, rig.body); coll.objects.link(body)
    order = rig.order; gi = {n: i for i, n in enumerate(order)}
    bm = bmesh.new(); bm.from_mesh(body.data); dl = bm.verts.layers.deform.verify()
    skin_weights(bm, dl, rig, gi)                           # the body follows its bones; the hard parts follow theirs
    mats = list(body.data.materials)
    for n in order:
        b = rig.parts[n]
        if not len(b.bm.verts): b.bm.free(); continue
        tmp = bpy.data.meshes.new("_kcpart"); b.bm.to_mesh(tmp); b.bm.free(); local = list(b.mats)
        v0, f0 = len(bm.verts), len(bm.faces); bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        for v in bm.verts[v0:]: v[dl].clear(); v[dl][gi[n]] = 1.0
        for f in bm.faces[f0:]:
            m = local[min(f.material_index, len(local) - 1)]
            if m not in mats: mats.append(m)
            f.material_index = mats.index(m)
    me = bpy.data.meshes.new("KC_" + name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    if any(m.get("gm_tile") for m in mats): gk.box_uv(me)
    gk.hard_normals(me, 85)
    bodymesh = body.data; bpy.data.objects.remove(body, do_unlink=True); bpy.data.meshes.remove(bodymesh)
    ob = bpy.data.objects.new("KC_" + name, me); coll.objects.link(ob)
    for n in order: ob.vertex_groups.new(name=n)
    ob.parent = arm; mod = ob.modifiers.new("Armature", "ARMATURE"); mod.object = arm
    for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
    arm["kc_creature"] = name
    return arm, ob

def _seg_dist(p, a, b):
    ab = b - a; u = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9))); return (p - (a + ab * u)).length

def _side(n):
    core = n.split("_")[0]
    return 1 if core.endswith("L") else -1 if core.endswith("R") else 0

def skin_weights(bm, dl, rig, gi, soft=0.35, smooth_iters=4):
    """Each point of the body follows the bones it is nearest, measured in units of how thick the body is round each
    bone (so the belly follows the spine, not the top of a leg), blended where two are close; a leg or an ear never
    takes a point from the other side. Then the weights are smoothed along the surface, so a joint bends in a curve."""
    segs = {n: (rig.bones[n][0], rig.bones[n][1], rig.thick.get(n, 0.12)) for n in rig.order if n in rig.skin}
    eyes = [(rig.bones[n][0], 0.13 if rig.thick.get("head", 0.1) > 0.15 else 0.07) for n in rig.order if n.startswith("eye")]
    W = []
    for v in bm.verts:
        p = v.co; d = {}
        near = max([max(0.0, 1 - (p - c).length / rr) for c, rr in eyes] or [0.0])
        if near > 0.5 and "head" in segs: W.append({"head": 1.0}); continue
        for n, (a, b, th) in segs.items():
            sd = _side(n)
            if sd and p.x * sd < -0.02: continue
            d[n] = _seg_dist(p, a, b) / th
        best = min(d.values()); w = {n: (1 - (x - best) / soft) ** 2 for n, x in d.items() if x - best < soft}
        tot = sum(w.values()); W.append({n: x / tot for n, x in w.items()})
    bm.verts.ensure_lookup_table()
    for _ in range(smooth_iters):
        new = []
        for i, v in enumerate(bm.verts):
            acc = {n: x * 2.0 for n, x in W[i].items()}
            for e in v.link_edges:
                for n, x in W[e.other_vert(v).index].items(): acc[n] = acc.get(n, 0.0) + x
            tot = sum(acc.values()); new.append({n: x / tot for n, x in acc.items() if x / tot > 0.01})
        W = new
    for v, w in zip(bm.verts, W):
        w = dict(sorted(w.items(), key=lambda kv: -kv[1])[:4])           # a game engine blends four bones a point
        v[dl].clear(); tot = sum(w.values())
        for n, x in w.items(): v[dl][gi[n]] = x / tot

def pose(arm, values):
    """values = {bone: {p, y, r: turns about world X, Z, Y (radians); x, f, z: shifts (metres; f is forward, -Y);
    s: a scale (one number, or (across, along, up))}}. Positive p lowers a part that points forward and swings a leg back."""
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    for pb in arm.pose.bones:
        v = values.get(pb.name, {}); R = pb.bone.matrix_local.to_3x3(); Rt = R.transposed()
        pb.rotation_quaternion = Quaternion(Rt @ Z, v.get("y", 0.0)) @ Quaternion(Rt @ X, v.get("p", 0.0)) @ Quaternion(Rt @ Y, v.get("r", 0.0))
        pb.location = Rt @ Vector((v.get("x", 0.0), -v.get("f", 0.0), v.get("z", 0.0)))
        sc = v.get("s", 1.0)
        if isinstance(sc, (int, float)): pb.scale = (sc, sc, sc)
        else:                                                  # world (across, along, up) into the bone's own axes
            pb.scale = tuple(sum(R[j][i] ** 2 * sc[j] for j in range(3)) for i in range(3))

AIR = ("Fly", "Swim", "Hop", "Rest")
_FEET = {}
def _feet(ob):
    """The points that stand on the ground, foot by foot: the hooves, paws or feet (whatever is bound to a foot bone)."""
    if ob.name not in _FEET:
        ids = {vg.index: vg.name for vg in ob.vertex_groups if vg.name.endswith("_ft") or vg.name.startswith("foot")}
        feet = {}
        for v in ob.data.vertices:
            for g in v.groups:
                if g.group in ids and g.weight > 0.5: feet.setdefault(ids[g.group], []).append(v.index)
        _FEET[ob.name] = feet
    return _FEET[ob.name]
def grounded(arm, ob, values, clip):
    """The pose, set down so its lowest point touches the ground: a creature on its feet never floats or sinks,
    whatever its legs are doing (a clip in the air or on the water is left as it is)."""
    pose(arm, values)
    if clip in AIR or ob is None: return values
    bpy.context.view_layer.update()
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); feet = _feet(ob)
    if feet:
        lows = sorted(min(ev.data.vertices[i].co.z for i in ids) for ids in feet.values())
        # four legs: stand on the feet that are down. A hoof rested on its toe dips lower than the rest and must not
        # lift the animal off its other three (that was the float and the bob in the idle)
        low = lows[1] if len(lows) >= 4 else lows[0]
    else: low = min(v.co.z for v in ev.data.vertices)
    v = {k: dict(x) for k, x in values.items()}; v.setdefault("root", {}); v["root"]["z"] = v["root"].get("z", 0.0) - low
    pose(arm, v); return v

def bake(arm, rig, ob=None):
    ad = arm.animation_data or arm.animation_data_create()
    for tr in list(ad.nla_tracks): ad.nla_tracks.remove(tr)
    for cname, (secs, fn) in rig.clips.items():
        act = bpy.data.actions.new(rig.name + "_" + cname); ad.action = act
        n = max(2, round(secs * FPS)); step = 2 if n > 16 else 1
        frames = list(range(0, n + 1, step))
        if frames[-1] != n: frames.append(n)
        for f in frames:
            vals = fn((f / n) % 1.0 if f < n else 0.0)
            if cname == "Walk": grounded(arm, ob, vals, cname)
            else:                                    # standing still: one setting down for the whole clip, so the body never bobs
                if f == 0: base_z = grounded(arm, ob, fn(0.0), cname).get("root", {}).get("z", 0.0) - fn(0.0).get("root", {}).get("z", 0.0)
                vals = {k: dict(x) for k, x in vals.items()}; vals.setdefault("root", {}); vals["root"]["z"] = vals["root"].get("z", 0.0) + base_z
                pose(arm, vals)
            for pb in arm.pose.bones:
                pb.keyframe_insert("rotation_quaternion", frame=f + 1); pb.keyframe_insert("location", frame=f + 1); pb.keyframe_insert("scale", frame=f + 1)
        ad.action = None
        tr = ad.nla_tracks.new(); tr.name = cname; tr.strips.new(cname, 1, act)
    pose(arm, {})

def static(arm, ob, fn, t, name, clip=""):
    grounded(arm, ob, fn(t), clip); bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.validate(); gk.hard_normals(me, 70)
    old = bpy.data.meshes.get(name)
    if old:
        for k_ in old.keys(): me[k_] = old[k_]
        old.user_remap(me); bpy.data.meshes.remove(old)
    me.name = name; pose(arm, {}); bpy.context.view_layer.update(); return me

# ---------------------------------------------------------------- motion
def smooth(u): return u * u * (3 - 2 * u)
def blip(t, at, width):
    d = ((t - at + 0.5) % 1.0) - 0.5
    if abs(d) >= width: return 0.0
    u = 1 - abs(d) / width; return u * u * (3 - 2 * u)
def hold(t, keys, move=0.07):
    """Jumps between held values: keys = [(time, value)], in order."""
    cur, prev = keys[-1][1], keys[-2][1] if len(keys) > 1 else keys[-1][1]; start = keys[-1][0] - 1.0
    for i, (tk, v) in enumerate(keys):
        if t >= tk: cur, prev, start = v, keys[i - 1][1], tk
    u = min(1.0, (t - start) / move); return prev + (cur - prev) * smooth(u)
def leg3(p, a, knee, flick, st=0.6, hind=False):
    """One leg through a stride, as (upper, lower, foot) pitches. On the ground (first `st`) it sweeps from forward to
    back; then it lifts: the knee folds, the hoof flicks back (and points down), and it reaches forward to land."""
    if p < st:
        u = p / st; up = -a + 2 * a * u
        return up, 0.0, -up * 0.6 if not hind else -up * 0.4
    u = (p - st) / (1 - st); s = smooth(u); up = a - 2 * a * s
    fold = sin(pi * u) ** 1.2
    if hind: return up, -knee * 0.6 * fold, knee * fold + flick * fold
    return up, knee * fold, flick * fold
def reach(neck_at, head_at, tip, target_z, extra=0.4):
    neck_at, head_at, tip = Vector(neck_at), Vector(head_at), Vector(tip); best = 0.0
    for k in range(0, 160):
        th = k * 0.01; Rn = Matrix.Rotation(th, 3, "X"); hp = neck_at + Rn @ (head_at - neck_at)
        tp = hp + Matrix.Rotation(th + extra, 3, "X") @ (tip - head_at); best = th
        if tp.z <= target_z: break
    return best

RIGS = {}
def creature(fn):
    RIGS[fn.__name__.capitalize()] = fn; return fn

# ---------------------------------------------------------------- four-legged: shared clips
def quad_clips(r, sp):
    A_, K_, F_ = sp["swing"], sp["knee"], sp["flick"]
    PH = {"HL": 0.0, "FL": 0.25, "HR": 0.5, "FR": 0.75}
    has = lambda n: n in r.bones
    @r.clip("Walk", sp["walk"])
    def walk(t):
        v = {}
        for nm, ph in PH.items():
            hind = nm[0] == "H"; u, l, f = leg3((t + ph) % 1.0, A_ * (1.1 if hind else 1.0), K_, F_, hind=hind)
            v[nm] = {"p": u}; v[nm + "_lo"] = {"p": l}; v[nm + "_ft"] = {"p": f}
        # hips roll over the planted hind leg, the chest over the planted fore; the body dips twice a stride
        v["pelvis"] = {"r": 0.05 * sin(tau * t), "z": -sp["bob"] * (1 + cos(4 * pi * t)), "y": 0.03 * sin(tau * t)}
        v["spine"] = {"r": -0.06 * sin(tau * t + 1.6), "y": -0.03 * sin(tau * t)}
        v["neck"] = {"p": sp["nod"] * sin(4 * pi * t + 0.9) + sp.get("neck_walk", 0.0), "y": -0.03 * sin(tau * t)}
        v["head"] = {"p": -0.5 * sp["nod"] * sin(4 * pi * t + 0.9)}
        for i, tl in enumerate(("tail", "tail2", "tail3")):
            if has(tl): v[tl] = {"y": (0.1 + 0.07 * i) * sin(tau * t - 0.7 * i), "p": sp.get("tail_up", 0.0) if i == 0 else 0.0}
        for e, s_ in (("earL", 1), ("earR", -1)):
            if has(e): v[e] = {"p": 0.12 * sin(4 * pi * t - 0.6)}
        return v
    @r.clip("Idle", sp["idle"])
    def idle(t):
        look = hold(t, [(0.0, 0.0), (0.18, 0.35), (0.42, 0.1), (0.62, -0.3), (0.86, 0.0)], 0.1)
        breathe = sin(tau * 3 * t)
        v = {"spine": {"p": -0.015 * breathe}, "pelvis": {"z": 0.004 * breathe, "r": 0.03 * sin(tau * t)},
             "neck": {"y": look * 0.55, "p": 0.04 * sin(tau * t)}, "head": {"y": look * 0.45, "r": 0.08 * hold(t, [(0.0, 0.0), (0.3, 1.0), (0.5, 0.0)], 0.12)}}
        swat = blip(t, 0.55, 0.1) - 0.6 * blip(t, 0.7, 0.08)
        if has("tail"): v["tail"] = {"y": 0.06 * sin(tau * 2 * t) + 0.55 * swat, "p": sp.get("tail_up", 0.0) - 0.3 * abs(swat)}
        if has("tail2"): v["tail2"] = {"y": 0.08 * sin(tau * 2 * t - 0.7) + 0.7 * (blip(t, 0.58, 0.1) - 0.6 * blip(t, 0.73, 0.08))}
        if has("tail3"): v["tail3"] = {"y": 0.1 * sin(tau * 2 * t - 1.4) + 0.8 * (blip(t, 0.61, 0.1) - 0.6 * blip(t, 0.76, 0.08))}
        if has("earL"): v["earL"] = {"y": 0.6 * blip(t, 0.32, 0.04), "p": -0.1 * look}
        if has("earR"): v["earR"] = {"y": -0.6 * blip(t, 0.8, 0.04), "p": 0.1 * look}
        bl = max(blip(t, 0.12, 0.025), blip(t, 0.66, 0.025))
        for e in ("eyeL", "eyeR"):
            if has(e): v[e] = {"s": (1, 1, 1 - 0.9 * bl)}
        v["HL"] = {"p": 0.04 * hold(t, [(0.0, 0.0), (0.45, 1.0), (0.9, 0.0)], 0.12)}
        v["HL_lo"] = {"p": 0.12 * hold(t, [(0.0, 0.0), (0.45, 1.0), (0.9, 0.0)], 0.12)}       # eases one hind leg, as a horse does
        return v
    if sp.get("eat") is not None:
        g = sp["eat"]
        @r.clip("Eat", sp["graze"])
        def eat(t):
            bite = abs(sin(3 * tau * t))
            v = {"spine": {"p": 0.03}, "FL": {"p": -0.07}, "FR": {"p": 0.03}, "pelvis": {"z": -0.004},
                 "neck": {"p": g["neck"], "f": g["f"], "z": -g.get("dz", 0.0), "y": 0.06 * sin(tau * t)}, "head": {"p": g["head"] - 0.1 * bite, "y": 0.08 * sin(tau * t + 1)}}
            if has("tail"): v["tail"] = {"y": 0.35 * sin(tau * t) + 0.4 * blip(t, 0.75, 0.1)}
            if has("tail2"): v["tail2"] = {"y": 0.4 * sin(tau * t - 0.7)}
            if has("tail3"): v["tail3"] = {"y": 0.45 * sin(tau * t - 1.4)}
            if has("earL"): v["earL"] = {"p": -0.25, "y": 0.4 * blip(t, 0.3, 0.05)}
            if has("earR"): v["earR"] = {"p": -0.25, "y": -0.4 * blip(t, 0.85, 0.05)}
            bl = blip(t, 0.45, 0.03)
            for e in ("eyeL", "eyeR"):
                if has(e): v[e] = {"s": (1, 1, 1 - 0.9 * bl)}
            return v

def graze_pose(S, muzzle_z=0.1):
    """How a grazer reaches the grass without folding its head into its chest: the neck swings down and stretches
    forward from the shoulders, and the head stays pointing down and ahead of the forelegs, as a cow's or a horse's
    does. The back stays level, so all four hooves stay on the ground. Found by trying the turns and keeping the
    gentlest that puts the muzzle in the grass well in front of the front hooves."""
    wi, po, no = (Vector(S[k]) for k in ("withers", "poll", "nose")); fore_y = S["fore"][3][1]
    best = None
    for fi in range(0, 8):
        f = fi * 0.04
        for di in range(0, 5):
            dz = di * 0.04
            for ti in range(0, 66):
                th = ti * 0.04; P = wi + Vector((0, -f, -dz)) + Matrix.Rotation(th, 3, "X") @ (po - wi)
                for hi in range(-16, 15):
                    ph = hi * 0.05; T = P + Matrix.Rotation(th + ph, 3, "X") @ (no - po); d = T - P
                    if not (muzzle_z - 0.05 < T.z < muzzle_z + 0.08) or T.y > fore_y - 0.18 or d.y > 0.1 * d.length: continue
                    if ((P + T) / 2).y > wi.y - 0.12: continue                                             # the head stays clear of the chest
                    cost = abs(T.z - muzzle_z) * 4 + f * 1.2 + dz * 1.5 + abs(ph) * 0.3 + th * 0.05
                    if best is None or cost < best[0]: best = (cost, dict(spine=0.0, f=f, dz=dz, neck=th, head=ph))
    return best[1] if best else dict(spine=0.0, f=0.2, dz=0.08, neck=1.0, head=0.2)

def quad_bones(r, spec):
    """The skeleton of a four-legged animal from a few landmarks."""
    S = spec
    r.bone("root", (0, 0, 0), (0, 0, 0.3)); r.body_bone = "pelvis"
    r.bone("pelvis", S["hip"], S["mid"], "root")
    r.bone("spine", S["mid"], S["withers"], "pelvis")
    r.bone("neck", S["withers"], S["poll"], "spine")
    r.bone("head", S["poll"], S["nose"], "neck")
    prev = "pelvis"; pts = S["tail"]
    for i, nm in enumerate(("tail", "tail2", "tail3")[: len(pts) - 1]):
        r.bone(nm, pts[i], pts[i + 1], prev); prev = nm
    for side, sx in (("L", 1), ("R", -1)):
        for leg, par in (("F", "spine"), ("H", "pelvis")):
            p = [Vector((sx * q[0], q[1], q[2])) for q in S["fore" if leg == "F" else "hind"]]
            r.bone(leg + side, p[0], p[1], par); r.bone(leg + side + "_lo", p[1], p[2], leg + side); r.bone(leg + side + "_ft", p[2], p[3], leg + side + "_lo")
            r.thick.setdefault(leg + side, 0.14); r.thick.setdefault(leg + side + "_lo", 0.1); r.thick.setdefault(leg + side + "_ft", 0.09)
    r.skin |= {n for n in r.order if n != "root"}

def legs_clay(c, spec, radii_f, radii_h, top=0.085):
    """The legs, down to the top of the hoof (the hoof is its own hard part)."""
    for sx in (1, -1):
        for key, radii in (("fore", radii_f), ("hind", radii_h)):
            pts = [(sx * q[0], q[1], q[2]) for q in spec[key]]; pts[-1] = (pts[-1][0], pts[-1][1], top)
            c.limb(pts, radii)

def hooves(r, spec, R, m="plum", h=0.09):
    for side, sx in (("L", 1), ("R", -1)):
        for leg, key in (("F", "fore"), ("H", "hind")):
            q = spec[key][3]; b = r[leg + side + "_ft"]
            b.lathe([(R * 0.98, 0.0), (R * 1.02, h * 0.35), (R * 0.86, h), (R * 0.6, h + 0.01)], (sx * q[0], q[1] - 0.01, 0.0), mats=[m, m, m], seg=14)
            b.lathe([(R * 0.98, 0.0), (0.0, 0.0)], (sx * q[0], q[1] - 0.01, 0.0), mats=[m + "_dk"], seg=14, cap=False)

def coat_rules(coat, body_hi=0.62, body_lo=-0.55):
    """Three values of the coat, as the rest of the island has: light on the faces turned up, darker under."""
    return [(A(coat, "lt"), lambda c, n: n.z > body_hi and c.z > 0.5), (A(coat, "dk"), lambda c, n: n.z < body_lo)]

# ---------------------------------------------------------------- the cow
@creature
def cow():
    r = Rig("Cow"); coat, patch = "white", "trunk"
    S = dict(hip=(0, 0.46, 0.98), mid=(0, 0.02, 0.98), withers=(0, -0.42, 1.04), poll=(0, -0.7, 1.22), nose=(0, -1.2, 1.06),
             tail=[(0, 0.7, 1.08), (0, 0.8, 0.86), (0, 0.82, 0.62), (0, 0.82, 0.42)],
             fore=[(0.23, -0.4, 0.74), (0.23, -0.41, 0.38), (0.23, -0.43, 0.11), (0.23, -0.44, 0.0)],
             hind=[(0.23, 0.44, 0.78), (0.24, 0.34, 0.5), (0.24, 0.48, 0.28), (0.24, 0.45, 0.0)])
    quad_bones(r, S)
    r.thick.update(pelvis=0.4, spine=0.4, neck=0.24, head=0.24, tail=0.06, tail2=0.05, tail3=0.05)
    c = Clay()
    c.ell((0, 0.04, 0.9), (0.42, 0.62, 0.36))                    # the barrel
    c.ell((0, -0.34, 0.93), (0.38, 0.32, 0.36))                  # chest and shoulders
    c.ell((0, 0.42, 0.94), (0.37, 0.3, 0.33))                    # haunches
    c.ell((0, 0.06, 0.74), (0.32, 0.5, 0.2))                     # a round belly
    c.limb([(0, -0.48, 1.0), (0, -0.66, 1.14)], [0.24, 0.21])   # a short, thick neck
    c.ell((0, -0.78, 1.22), (0.25, 0.24, 0.23))                  # the skull: broad, rounded
    c.ell((0, -0.98, 1.13), (0.22, 0.2, 0.18))                   # the face narrowing to the muzzle
    c.ell((0, -1.12, 1.06), (0.25, 0.14, 0.16))                  # the big soft muzzle
    legs_clay(c, S, [0.15, 0.1, 0.085, 0.09], [0.18, 0.13, 0.09, 0.09])
    c.limb([(0, 0.68, 1.06), (0, 0.78, 0.86)], [0.05, 0.035])   # root of the tail
    r.body = c.mesh("_cowbody", keep=0.14)
    spots = [((0.36, 0.22, 1.02), 0.26), ((-0.38, -0.12, 0.98), 0.22), ((0.12, -0.18, 1.26), 0.2), ((-0.22, 0.5, 1.05), 0.21), ((0.3, -0.55, 1.0), 0.13), ((-0.05, -0.85, 1.42), 0.12)]
    paint(r.body, [(P(patch), lambda c_, n: c_.z > 0.62 and c_.y > -1.0 and blobs(c_, n, spots)),
                   ("pink", lambda c_, n: c_.y < -1.02 and c_.z < 1.2),
                   ] + coat_rules(coat), A(coat))
    bvh = BVHTree.FromObject(_tmpobj(r.body), bpy.context.evaluated_depsgraph_get()); _tmpdrop()
    h = r["head"]
    for side, sx in (("L", 1), ("R", -1)):
        p, nor = onto(bvh, (sx * 0.15, -0.97, 1.25), (-sx * 0.45, 1.0, -0.05))
        e = r.bone("eye" + side, p, p + Vector((0, 0, 0.05)), "head"); eye(e, bvh, p, nor, 0.042, sx, lid=True)
        q, n2 = onto(bvh, (sx * 0.08, -1.12, 1.08), (0, 1, 0))
        decal(h, bvh, q, n2, oval(0.022, 0.032), "noseRose", 0.004)                                          # nostrils
        cone(h, 0.05, 0.16, (sx * 0.14, -0.78, 1.4), "cream", rot=(-0.3, sx * 0.55, 0), seg=10)           # small horns
        ea = r.bone("ear" + side, (sx * 0.2, -0.74, 1.3), (sx * 0.42, -0.72, 1.28), "head")
        ea.ball(1.0, (sx * 0.31, -0.73, 1.29), A(coat), sc=(0.13, 0.05, 0.075), u=12, v=7, rot=(0, sx * 0.25, 0))
        ea.ball(1.0, (sx * 0.32, -0.765, 1.29), "pink", sc=(0.09, 0.02, 0.05), u=10, v=6, rot=(0, sx * 0.25, 0))
    hooves(r, S, 0.1)
    b = r["pelvis"]; b.ball(0.15, (0, 0.3, 0.6), "pink", sc=(1, 1, 0.7), u=14, v=9)                     # udder
    for sx in (-1, 1):
        for sy in (-1, 1): b.cyl(0.024, 0.07, (sx * 0.06, 0.3 + sy * 0.06, 0.48), "pink", seg=8, r2=0.018)
    n = r["neck"]; ring = [Vector((0.245 * cos(a), 0.0, 0.245 * sin(a))) for a in [tau * i / 16 for i in range(16)]]
    Rn = Matrix.Rotation(-0.6, 3, "X"); c0 = Vector((0, -0.57, 1.06))
    n.tube([tuple(c0 + Rn @ p) for p in ring], 0.032, "blue", seg=6, closed=True)
    bell = c0 + Rn @ Vector((0, 0, -0.26)) - Vector((0, 0.02, 0.1))
    n.lathe([(0.0, 0.0), (0.05, 0.01), (0.075, 0.09), (0.04, 0.13), (0.0, 0.135)], tuple(bell), "gold", seg=14); n.ball(0.022, tuple(bell - Vector((0, 0, 0.01))), "gold_dk", u=6, v=4)
    t3 = r["tail3"]; t3.ball(1.0, (0, 0.82, 0.38), P(patch), sc=(0.07, 0.07, 0.12), u=10, v=7)
    r["tail"].tube([(0, 0.76, 0.9), (0, 0.82, 0.62)], 0.03, A(coat), seg=8); r["tail2"].tube([(0, 0.82, 0.62), (0, 0.82, 0.42)], 0.026, A(coat), seg=8)
    dn = graze_pose(S)
    quad_clips(r, dict(swing=0.3, knee=0.9, flick=0.7, bob=0.008, nod=0.07, walk=1.3, idle=6.0, graze=3.2, eat=dn))
    r.statics = {"KL_Cow": ("Idle", 0.0), "KL_Cow_Graze": ("Eat", 0.0)}
    return r

_TMP = []
def _tmpobj(me):
    o = bpy.data.objects.new("_bvh", me); bpy.context.scene.collection.objects.link(o); bpy.context.view_layer.update(); _TMP.append(o); return o
def _tmpdrop():
    while _TMP: bpy.data.objects.remove(_TMP.pop(), do_unlink=True)

def place_eyes(r, bvh, at, d, size, back=0.4, parent="head", lid=False):
    """Both eyes, set into the face where a ray from `at` (left side; mirrored for the right) along `d` meets it."""
    for side, sx in (("L", 1), ("R", -1)):
        p, nor = onto(bvh, (sx * at[0], at[1], at[2]), (sx * d[0], d[1], d[2]))
        e = r.bone("eye" + side, p, p + Vector((0, 0, 0.04)), parent); eye(e, bvh, p, nor, size, sx, lid)

def folded_wing(w, sx, at, L, H, coat, tilt=-0.25):
    """A wing folded against a bird's side, as a cute chicken or duck is drawn: a teardrop, round at the shoulder and
    pointed at the back, in the body's own colour a step lighter (a darker grey plate reads as something stuck on),
    with three rounded feather tips stepping down at the back. It sits half sunk in the body so its edge melts in.
    at: the shoulder end's middle; L: length towards the tail (+Y); H: height."""
    x, y, z = at; t = sin(tilt)
    w.ball(1.0, (sx * x, y + L * 0.38, z), A(coat, "lt"), sc=(H * 0.32, L * 0.5, H * 0.5), u=14, v=9, rot=(tilt, 0, 0))
    for k in range(3):                                   # the feather tips, smaller and lower towards the tail
        f = 0.62 + 0.14 * k; q = 1 - 0.18 * k
        w.ball(1.0, (sx * (x - 0.002 * k), y + L * f, z - H * (0.08 + 0.14 * k) - L * f * t * 0.3), A(coat, "lt"),
               sc=(H * 0.24 * q, L * 0.22 * q, H * 0.16 * q), u=10, v=6, rot=(tilt - 0.25 - 0.1 * k, 0, 0))

def open_wing(w, sg, x0, span, chord, z, coat):
    """A small bird's wing laid out along X (folded or spread by its bone): a rounded arm in front, a row of
    rounded secondaries behind it and four long primaries fanning from the tip, the way a songbird's wing reads in
    cartoon drawings, rather than one flat slab."""
    m, d = A(coat), A(coat, "dk")
    w.ball(1.0, (sg * (x0 + span * 0.36), -0.012, z + 0.004), m, sc=(span * 0.42, chord * 0.42, 0.018), u=12, v=7)
    for k in range(3):                                   # secondaries along the back edge
        w.ball(1.0, (sg * (x0 + span * (0.16 + 0.2 * k)), chord * 0.26, z), d, sc=(span * 0.13, chord * 0.3, 0.012), u=10, v=5)
    for k in range(4):                                   # primaries fanning out at the tip
        a = -0.5 + 0.33 * k
        cx = x0 + span * (0.74 + 0.08 * cos(a)); cy = chord * 0.42 * sin(a)
        w.ball(1.0, (sg * cx, cy, z - 0.002 * k), d, sc=(span * 0.24, chord * 0.12, 0.01), u=10, v=5, rot=(0, 0, sg * a * 0.6))

def bvh_of(me):
    t = _tmpobj(me); b = BVHTree.FromObject(t, bpy.context.evaluated_depsgraph_get()); _tmpdrop(); return b

# ---------------------------------------------------------------- the pony
@creature
def pony():
    r = Rig("Pony"); coat, mane = "trunk_light", "cream"
    S = dict(hip=(0, 0.44, 1.06), mid=(0, 0.02, 1.04), withers=(0, -0.38, 1.14), poll=(0, -0.62, 1.62), nose=(0, -1.08, 1.36),
             tail=[(0, 0.62, 1.12), (0, 0.78, 1.0), (0, 0.82, 0.76), (0, 0.82, 0.5)],
             fore=[(0.19, -0.36, 0.86), (0.19, -0.37, 0.45), (0.19, -0.39, 0.13), (0.19, -0.4, 0.0)],
             hind=[(0.19, 0.42, 0.9), (0.2, 0.3, 0.58), (0.2, 0.46, 0.32), (0.2, 0.43, 0.0)])
    quad_bones(r, S); r.thick.update(pelvis=0.36, spine=0.36, neck=0.19, head=0.17, tail=0.06, tail2=0.05, tail3=0.05)
    for leg in ("FL", "FR", "HL", "HR"): r.thick[leg] = 0.12; r.thick[leg + "_lo"] = 0.08; r.thick[leg + "_ft"] = 0.07
    c = Clay()
    c.ell((0, 0.03, 1.01), (0.33, 0.56, 0.32)); c.ell((0, -0.3, 1.03), (0.31, 0.28, 0.33)); c.ell((0, 0.4, 1.04), (0.32, 0.27, 0.31))
    c.limb([(0, -0.38, 1.1), (0, -0.5, 1.33), (0, -0.6, 1.55)], [0.21, 0.16, 0.14])                     # a long, arched neck
    c.ell((0, -0.67, 1.62), (0.17, 0.19, 0.17))                                                           # the skull
    c.ell((0, -0.86, 1.5), (0.14, 0.21, 0.13), rot=(0.55, 0, 0))                                          # the long face
    c.ell((0, -1.02, 1.38), (0.15, 0.13, 0.13))                                                           # a wide, soft muzzle
    legs_clay(c, S, [0.12, 0.075, 0.062, 0.068], [0.15, 0.1, 0.068, 0.068])
    c.limb([(0, 0.6, 1.12), (0, 0.72, 1.04)], [0.06, 0.05])
    r.body = c.mesh("_ponybody", keep=0.14)
    paint(r.body, [(mane, lambda c_, n: c_.y < -0.95 and c_.z < 1.48)] + coat_rules(coat), A(coat))
    bvh = bvh_of(r.body)
    place_eyes(r, bvh, (0.1, -0.8, 1.6), (-0.6, 1.0, -0.05), 0.036, lid=True)
    h = r["head"]
    for sx in (1, -1):
        q, n2 = onto(bvh, (sx * 0.06, -1.06, 1.38), (0, 1, 0.2)); decal(h, bvh, q, n2, oval(0.016, 0.026), "noseBrown", 0.004)
        ea = r.bone("ear" + ("L" if sx > 0 else "R"), (sx * 0.08, -0.6, 1.74), (sx * 0.1, -0.58, 1.94), "head")
        cone(ea, 0.055, 0.18, (sx * 0.08, -0.6, 1.73), A(coat), rot=(-0.15, sx * 0.2, 0), seg=10)
        cone(ea, 0.03, 0.12, (sx * 0.08, -0.622, 1.75), "pink", rot=(-0.15, sx * 0.2, 0), seg=8)
    h.ball(1.0, (0, -0.7, 1.78), mane, sc=(0.09, 0.1, 0.07), u=12, v=8); h.ball(1.0, (0, -0.79, 1.74), mane, sc=(0.07, 0.07, 0.05), u=10, v=6)   # forelock
    n = r["neck"]
    for k in range(6):                                                                                    # the mane, tuft by tuft along the crest
        u = k / 5; p = Vector((0, -0.62, 1.66)).lerp(Vector((0, -0.3, 1.22)), u) + Vector((0, 0.11, 0.02))
        n.ball(1.0, tuple(p + Vector((0.02 * (-1) ** k, 0, 0))), mane, sc=(0.07, 0.1, 0.09 - 0.01 * u), u=12, v=8, rot=(-0.6, 0, 0))
    for i, (nm, a, b, ra, rb) in enumerate((("tail", (0, 0.68, 1.1), (0, 0.8, 0.98), 0.07, 0.1), ("tail2", (0, 0.8, 0.98), (0, 0.84, 0.74), 0.1, 0.09), ("tail3", (0, 0.84, 0.74), (0, 0.83, 0.48), 0.09, 0.04))):
        r[nm].tube([a, b], [ra, rb], mane, seg=10); r[nm].ball(rb, b, mane, u=10, v=7)
    hooves(r, S, 0.078)
    dn = graze_pose(S)
    quad_clips(r, dict(swing=0.34, knee=1.0, flick=0.8, bob=0.01, nod=0.09, walk=1.1, idle=6.0, graze=3.2, eat=dn, tail_up=0.0))
    r.statics = {"KL_Pony": ("Idle", 0.0), "KL_Pony_Graze": ("Eat", 0.0)}
    return r

# ---------------------------------------------------------------- the sheep
@creature
def sheep():
    r = Rig("Sheep"); wool, skin = "white", "slate"
    S = dict(hip=(0, 0.26, 0.6), mid=(0, 0.0, 0.62), withers=(0, -0.26, 0.64), poll=(0, -0.42, 0.8), nose=(0, -0.66, 0.68),
             tail=[(0, 0.4, 0.66), (0, 0.48, 0.58)],
             fore=[(0.14, -0.22, 0.44), (0.14, -0.23, 0.24), (0.14, -0.24, 0.08), (0.14, -0.25, 0.0)],
             hind=[(0.14, 0.24, 0.46), (0.15, 0.18, 0.3), (0.15, 0.27, 0.17), (0.15, 0.26, 0.0)])
    quad_bones(r, S); r.thick.update(pelvis=0.34, spine=0.34, neck=0.13, head=0.13, tail=0.06)
    for leg in ("FL", "FR", "HL", "HR"): r.thick[leg] = 0.07; r.thick[leg + "_lo"] = 0.05; r.thick[leg + "_ft"] = 0.045
    c = Clay(); fleece = []
    for x, y, z, R in ((0, 0, 0.62, 0.3), (0.16, -0.18, 0.66, 0.2), (-0.16, -0.18, 0.66, 0.2), (0.17, 0.18, 0.64, 0.2), (-0.17, 0.18, 0.64, 0.2), (0, -0.02, 0.84, 0.2),
                       (0.12, 0.14, 0.82, 0.16), (-0.12, -0.12, 0.84, 0.16), (0, 0.3, 0.7, 0.18), (0, -0.28, 0.72, 0.17), (0.2, 0.0, 0.5, 0.17), (-0.2, 0.0, 0.5, 0.17), (0, 0.0, 0.46, 0.2)):
        c.ball((x, y, z), R, stiff=4.0); fleece.append((Vector((x, y, z)), R * 1.22))                 # a cloud of wool: firm lumps
    c.limb([(0, -0.26, 0.66), (0, -0.4, 0.78)], [0.09, 0.08])
    c.ell((0, -0.47, 0.8), (0.11, 0.13, 0.11)); c.ell((0, -0.6, 0.72), (0.085, 0.1, 0.08), rot=(0.4, 0, 0))   # a small dark face
    legs_clay(c, S, [0.06, 0.045, 0.04, 0.042], [0.07, 0.05, 0.04, 0.042], top=0.07)
    r.body = c.mesh("_sheepbody", res=0.024, keep=0.22)
    cap = (Vector((0, -0.42, 0.9)), 0.12)
    in_wool = lambda c_: any((c_ - p).length < R for p, R in fleece) or (c_ - cap[0]).length < cap[1]
    paint(r.body, [(A(wool, "lt"), lambda c_, n: in_wool(c_) and n.z > 0.5), (A(wool), lambda c_, n: in_wool(c_))], P(skin))
    bvh = bvh_of(r.body)
    place_eyes(r, bvh, (0.065, -0.56, 0.8), (-0.6, 1.0, -0.05), 0.027, lid=True)
    h = r["head"]
    for k in range(5):                                                                                    # a woolly tuft on the brow
        a = tau * k / 5; h.ball(0.05, (0.05 * cos(a), -0.43 + 0.04 * sin(a), 0.9), A(wool, "lt"), u=10, v=7)
    q, n2 = onto(bvh, (0, -0.66, 0.71), (0, 1, 0.3)); decal(h, bvh, q, n2, oval(0.024, 0.014), "nosePink", 0.004)
    for side, sx in (("L", 1), ("R", -1)):
        e = r.bone("ear" + side, (sx * 0.09, -0.44, 0.84), (sx * 0.24, -0.43, 0.8), "head")
        e.ball(1.0, (sx * 0.17, -0.44, 0.82), P(skin), sc=(0.08, 0.03, 0.04), u=10, v=6, rot=(0, sx * 0.4, 0))
        e.ball(1.0, (sx * 0.17, -0.456, 0.82), "pink", sc=(0.05, 0.012, 0.025), u=8, v=5, rot=(0, sx * 0.4, 0))
    r["tail"].ball(0.07, (0, 0.44, 0.62), A(wool), u=10, v=7)
    hooves(r, S, 0.045, h=0.07)
    dn = graze_pose(S)
    quad_clips(r, dict(swing=0.34, knee=0.9, flick=0.7, bob=0.01, nod=0.06, walk=0.9, idle=5.0, graze=2.6, eat=dn))
    r.statics = {"KL_Sheep": ("Idle", 0.0), "KL_Sheep_Graze": ("Eat", 0.0)}
    return r

# ---------------------------------------------------------------- the cat
@creature
def cat():
    r = Rig("Cat"); coat = "orange"
    S = dict(hip=(0, 0.16, 0.3), mid=(0, 0.0, 0.3), withers=(0, -0.18, 0.32), poll=(0, -0.28, 0.44), nose=(0, -0.42, 0.42),
             tail=[(0, 0.24, 0.32), (0, 0.32, 0.42), (0, 0.34, 0.54), (0, 0.3, 0.64)],
             fore=[(0.075, -0.17, 0.26), (0.075, -0.18, 0.13), (0.075, -0.19, 0.04), (0.075, -0.2, 0.0)],
             hind=[(0.075, 0.15, 0.28), (0.08, 0.1, 0.17), (0.08, 0.17, 0.08), (0.08, 0.16, 0.0)])
    quad_bones(r, S); r.thick.update(pelvis=0.12, spine=0.12, neck=0.08, head=0.11, tail=0.035, tail2=0.03, tail3=0.03)
    for leg in ("FL", "FR", "HL", "HR"): r.thick[leg] = 0.05; r.thick[leg + "_lo"] = 0.035; r.thick[leg + "_ft"] = 0.03
    c = Clay()
    c.ell((0, -0.01, 0.3), (0.12, 0.22, 0.11)); c.ell((0, -0.14, 0.32), (0.11, 0.1, 0.11)); c.ell((0, 0.14, 0.3), (0.12, 0.1, 0.11))
    c.limb([(0, -0.18, 0.34), (0, -0.25, 0.41)], [0.07, 0.065])
    c.ell((0, -0.3, 0.45), (0.13, 0.11, 0.105))                                                          # a round head, wide at the cheeks
    c.ell((0, -0.39, 0.42), (0.06, 0.04, 0.04))                                                          # a little muzzle
    legs_clay(c, S, [0.042, 0.033, 0.03, 0.032], [0.06, 0.04, 0.03, 0.032], top=0.02)
    c.limb([(0, 0.24, 0.32), (0, 0.32, 0.42), (0, 0.34, 0.54), (0, 0.3, 0.64)], [0.03, 0.028, 0.025, 0.022])   # the tail
    r.body = c.mesh("_catbody", res=0.014, keep=0.25)
    paint(r.body, [("cream", lambda c_, n: (c_.y < -0.2 and c_.z < 0.36 and abs(c_.x) < 0.07) or c_.z < 0.06 or (c_.y < -0.36 and c_.z < 0.44) or (c_.y > 0.31 and c_.z > 0.58)),
                   (A(coat, "dk"), lambda c_, n: n.z > 0.75 and c_.z > 0.3 and sin(c_.y * 60) > 0.55)] + coat_rules(coat), A(coat))      # tabby stripes on the back
    bvh = bvh_of(r.body)
    place_eyes(r, bvh, (0.055, -0.38, 0.48), (-0.5, 1, -0.1), 0.03)
    h = r["head"]; q, n2 = onto(bvh, (0, -0.42, 0.44), (0, 1, 0.2)); decal(h, bvh, q, n2, [(-0.016, 0.008), (0.016, 0.008), (0.0, -0.012)], "nosePink", 0.004)
    for sx in (1, -1):
        for k in (0, 1): h.tube([(sx * 0.04, -0.42, 0.42 + 0.012 * k), (sx * 0.17, -0.41, 0.42 + 0.03 * k)], 0.0028, "white", seg=4)
        e = r.bone("ear" + ("L" if sx > 0 else "R"), (sx * 0.07, -0.29, 0.53), (sx * 0.08, -0.29, 0.62), "head")
        cone(e, 0.045, 0.085, (sx * 0.07, -0.29, 0.53), A(coat), rot=(0, sx * 0.3, 0), seg=10); cone(e, 0.024, 0.05, (sx * 0.069, -0.302, 0.54), "pink", rot=(0, sx * 0.3, 0), seg=8)
    quad_clips(r, dict(swing=0.42, knee=1.1, flick=0.7, bob=0.006, nod=0.03, walk=0.8, idle=4.5, tail_up=-0.25))
    @r.clip("Sit", 4.0)
    def sit(t):
        flick = blip(t, 0.4, 0.06) - blip(t, 0.75, 0.06)
        bl = max(blip(t, 0.2, 0.025), blip(t, 0.7, 0.025))
        return {"root": {"z": -0.085}, "pelvis": {"p": -0.6}, "FL": {"p": 0.6}, "FR": {"p": 0.6}, "HL": {"p": -1.2}, "HR": {"p": -1.2},
                "HL_lo": {"p": 1.9}, "HR_lo": {"p": 1.9}, "HL_ft": {"p": -0.7}, "HR_ft": {"p": -0.7},
                "neck": {"p": -0.25}, "head": {"p": 0.15, "y": 0.3 * hold(t, [(0.0, 0.0), (0.3, 0.6), (0.6, 0.0), (0.85, -0.5)])},
                "tail": {"p": 1.4, "y": 0.6}, "tail2": {"y": 0.8}, "tail3": {"y": 0.5 + 0.6 * flick},
                "earL": {"y": 0.4 * blip(t, 0.15, 0.04)}, "earR": {"y": -0.4 * blip(t, 0.65, 0.04)}, "eyeL": {"s": (1, 1, 1 - 0.9 * bl)}, "eyeR": {"s": (1, 1, 1 - 0.9 * bl)}}
    r.statics = {"KL_Cat_Sit": ("Sit", 0.0)}
    return r

# ---------------------------------------------------------------- two legs: chicken, chick, duck, and the bird
def bird_bones(r, body, neck, head, tail, wings, legs, foot):
    r.bone("root", (0, 0, 0), (0, 0, 0.1)); r.body_bone = "body"
    r.bone("body", *body, "root"); r.bone("neck", *neck, "body"); r.bone("head", *head, "neck"); r.bone("tail", *tail, "body")
    for nm, sx in (("wingL", 1), ("wingR", -1)): r.bone(nm, (sx * wings[0][0], wings[0][1], wings[0][2]), (sx * wings[1][0], wings[1][1], wings[1][2]), "body")
    x, hip, y = legs
    for nm, sx in (("legL", 1), ("legR", -1)):
        r.bone(nm, (sx * x, y, hip), (sx * x, y, 0.03), "root"); r.bone(nm.replace("leg", "foot"), (sx * x, y, 0.03), (sx * x, y - foot * 2.4, 0.0), nm)
    r.skin |= {"body", "neck", "head", "tail"}

def bird_legs(r, x, hip, y, m, foot, web=False, top=None):
    for nm, sx in (("legL", 1), ("legR", -1)):
        px = sx * x; l = r[nm]; top_ = top if top is not None else hip
        l.cyl(foot * 0.45, top_ - 0.03, (px, y, 0.03), m, seg=8)
        f = r[nm.replace("leg", "foot")]
        if web: f.ball(1.0, (px, y - foot * 1.2, 0.012), m, sc=(foot * 1.4, foot * 1.9, 0.012), u=12, v=5)
        else:
            for a in (-0.5, 0, 0.5): f.ball(1.0, (px + foot * 1.2 * sin(a), y - foot * 1.1 * cos(a), 0.012), m, sc=(foot * 0.42, foot * 1.25, foot * 0.4), u=8, v=5, rot=(0, 0, -a))
            f.ball(1.0, (px, y + foot * 0.7, 0.012), m, sc=(foot * 0.35, foot * 0.7, foot * 0.35), u=8, v=5)

def biped_walk(r, secs, swing, bob, thrust, roll=0.0):
    @r.clip("Walk", secs)
    def walk(t):
        a = sin(tau * t)
        v = {"legL": {"p": -swing * a}, "legR": {"p": swing * a},
             "footL": {"p": -0.6 * max(0.0, sin(tau * t + 0.6))}, "footR": {"p": -0.6 * max(0.0, -sin(tau * t + 0.6))},
             "body": {"z": bob * abs(cos(tau * t)) - bob * 0.5, "r": roll * a, "y": roll * 0.5 * a, "p": 0.04 * sin(4 * pi * t)}}
        if thrust:                               # the head holds still in the air, then thrusts forward: twice a stride
            u = (2 * t) % 1.0; v["head"] = {"f": thrust * (0.5 - u / 0.75) if u < 0.75 else thrust * (-0.5 + (u - 0.75) / 0.25)}
        else: v["head"] = {"p": 0.06 * sin(4 * pi * t)}
        v["tail"] = {"p": -0.1 * sin(4 * pi * t - 0.6), "y": 0.08 * a}
        v["wingL"] = {"r": 0.06 * a}; v["wingR"] = {"r": -0.06 * a}
        return v

@creature
def chicken():
    r = Rig("Chicken"); coat = "white"
    bird_bones(r, ((0, 0.04, 0.24), (0, 0.0, 0.42)), ((0, -0.08, 0.42), (0, -0.14, 0.5)), ((0, -0.14, 0.5), (0, -0.3, 0.5)), ((0, 0.16, 0.4), (0, 0.24, 0.56)),
               ((0.15, -0.04, 0.38), (0.16, 0.16, 0.34)), (0.07, 0.24, 0.03), 0.04)
    r.thick.update(body=0.18, neck=0.08, head=0.09, tail=0.08)
    c = Clay()
    c.ell((0, 0.03, 0.33), (0.17, 0.22, 0.16)); c.ell((0, -0.09, 0.37), (0.13, 0.11, 0.13))                 # a teardrop body, full in the breast
    c.ell((0, 0.17, 0.42), (0.1, 0.1, 0.12), rot=(-0.6, 0, 0))                                            # rising to the tail
    c.limb([(0, -0.09, 0.42), (0, -0.15, 0.5)], [0.08, 0.075]); c.ball((0, -0.17, 0.52), 0.095)            # neck and head
    r.body = c.mesh("_chickbody", res=0.014, keep=0.25)
    paint(r.body, coat_rules(coat, 0.7, -0.5), A(coat))
    bvh = bvh_of(r.body)
    place_eyes(r, bvh, (0.06, -0.22, 0.55), (-1, 0.5, -0.1), 0.026)
    h = r["head"]
    cone(h, 0.04, 0.09, (0, -0.25, 0.51), "gold", rot=(pi / 2, 0, 0), seg=10)
    h.ball(0.032, (0, -0.24, 0.45), "red", sc=(0.75, 0.8, 1.4), u=10, v=7)                                 # wattle
    for k, y in enumerate((-0.22, -0.17, -0.12)): h.ball(0.038 - 0.004 * k, (0, y, 0.62 - 0.012 * k), "red", sc=(0.55, 1, 1), u=10, v=7)   # comb
    tl = r["tail"]
    for k, a in enumerate((-0.4, -0.13, 0.13, 0.4)):
        tl.ball(1.0, (0.1 * sin(a), 0.22, 0.5 + 0.03 * (k in (1, 2))), A(coat, "lt"), sc=(0.04, 0.09, 0.14), u=12, v=8, rot=(-0.45, 0, a * 0.8))
    for nm, sx in (("wingL", 1), ("wingR", -1)):
        folded_wing(r[nm], sx, (0.155, -0.04, 0.35), 0.24, 0.2, coat)
    bird_legs(r, 0.07, 0.24, 0.03, "gold", 0.04)
    biped_walk(r, 0.7, 0.42, 0.018, 0.05)
    @r.clip("Idle", 4.0)
    def idle(t):
        look = hold(t, [(0.0, 0.0), (0.15, 0.6), (0.35, -0.4), (0.55, 0.0), (0.7, 0.5), (0.85, -0.2)], 0.05)
        tilt = hold(t, [(0.0, 0.0), (0.15, 0.3), (0.35, -0.3), (0.55, 0.0), (0.7, 0.25), (0.85, 0.0)], 0.05)
        ruffle = blip(t, 0.5, 0.06); bl = blip(t, 0.27, 0.02)
        return {"head": {"y": look, "r": tilt}, "neck": {"y": look * 0.3}, "tail": {"p": -0.15 * blip(t, 0.25, 0.05)}, "wingL": {"r": 0.3 * ruffle}, "wingR": {"r": -0.3 * ruffle},
                "body": {"z": 0.004 * sin(tau * 3 * t), "s": (1 + 0.06 * ruffle, 1, 1 + 0.04 * ruffle)}, "eyeL": {"s": (1, 1, 1 - 0.9 * bl)}, "eyeR": {"s": (1, 1, 1 - 0.9 * bl)}}
    @r.clip("Peck", 1.6)
    def peck(t):
        bow = smooth(min(1.0, t / 0.2)) if t < 0.8 else smooth(max(0.0, 1 - (t - 0.8) / 0.2))
        stab = sum(blip(t, a, 0.06) for a in (0.3, 0.45, 0.6))
        return {"body": {"p": 0.7 * bow, "f": 0.02 * bow}, "neck": {"p": 0.3 * bow + 0.25 * stab}, "head": {"p": 0.25 * bow + 0.2 * stab}, "tail": {"p": -0.4 * bow},
                "legL": {"p": -0.2 * bow}, "legR": {"p": -0.2 * bow}}
    r.statics = {"KL_Chicken": ("Idle", 0.0), "KL_Chicken_Peck": ("Peck", 0.45)}
    return r

@creature
def chick():
    r = Rig("Chick"); c_ = "yellow"
    bird_bones(r, ((0, 0.01, 0.05), (0, 0.0, 0.14)), ((0, -0.03, 0.13), (0, -0.05, 0.17)), ((0, -0.05, 0.17), (0, -0.14, 0.19)), ((0, 0.08, 0.11), (0, 0.12, 0.14)),
               ((0.075, -0.0, 0.12), (0.075, 0.06, 0.09)), (0.035, 0.06, 0.01), 0.02)
    r.thick.update(body=0.08, neck=0.05, head=0.06, tail=0.04)
    c = Clay(); c.ell((0, 0.01, 0.1), (0.08, 0.095, 0.08)); c.ball((0, -0.05, 0.19), 0.065); c.ball((0, 0.09, 0.12), 0.03)
    r.body = c.mesh("_chickbody2", res=0.008, keep=0.3)
    paint(r.body, coat_rules(c_, 0.7, -0.5), A(c_))
    bvh = bvh_of(r.body)
    place_eyes(r, bvh, (0.04, -0.1, 0.21), (-1, 0.5, -0.1), 0.016)
    cone(r["head"], 0.02, 0.045, (0, -0.11, 0.19), "orange", rot=(pi / 2, 0, 0), seg=8)
    r["head"].ball(0.02, (0, -0.04, 0.26), A(c_, "lt"), sc=(0.6, 1.2, 0.8), u=8, v=5)                           # a wisp of down
    for nm, sx in (("wingL", 1), ("wingR", -1)): folded_wing(r[nm], sx, (0.074, -0.02, 0.11), 0.09, 0.075, c_, tilt=-0.35)
    bird_legs(r, 0.035, 0.06, 0.01, "orange", 0.02)
    biped_walk(r, 0.4, 0.5, 0.025, 0.0)
    @r.clip("Idle", 3.0)
    def idle(t):
        look = hold(t, [(0.0, 0.0), (0.2, 0.5), (0.45, -0.5), (0.7, 0.0)], 0.05); cheep = blip(t, 0.85, 0.05)
        return {"head": {"y": look, "p": -0.3 * cheep}, "wingL": {"r": 0.6 * cheep}, "wingR": {"r": -0.6 * cheep}, "root": {"z": 0.03 * blip(t, 0.6, 0.06)}, "body": {"s": (1, 1, 1 - 0.08 * blip(t, 0.56, 0.03) + 0.06 * blip(t, 0.62, 0.04))}}
    @r.clip("Peck", 1.2)
    def peck(t):
        stab = sum(blip(t, a, 0.07) for a in (0.25, 0.5, 0.75)); return {"body": {"p": 0.35 + 0.25 * stab}, "head": {"p": 0.2 + 0.3 * stab}}
    r.statics = {"KL_Chick": ("Idle", 0.0)}
    return r

@creature
def duck():
    r = Rig("Duck"); coat = "white"; z0 = 0.14
    bird_bones(r, ((0, 0.06, z0 + 0.06), (0, 0.0, z0 + 0.24)), ((0, -0.14, z0 + 0.2), (0, -0.2, z0 + 0.38)), ((0, -0.2, z0 + 0.38), (0, -0.38, z0 + 0.38)), ((0, 0.2, z0 + 0.16), (0, 0.3, z0 + 0.26)),
               ((0.13, -0.08, z0 + 0.17), (0.14, 0.2, z0 + 0.17)), (0.07, z0 + 0.06, 0.06), 0.035)
    r.thick.update(body=0.16, neck=0.06, head=0.08, tail=0.06)
    c = Clay()
    c.ell((0, 0.03, z0 + 0.13), (0.16, 0.26, 0.13)); c.ell((0, -0.1, z0 + 0.15), (0.13, 0.12, 0.12))
    c.ell((0, 0.24, z0 + 0.19), (0.07, 0.09, 0.06), rot=(-0.7, 0, 0))                                      # the tail, turned up
    c.limb([(0, -0.14, z0 + 0.2), (0, -0.19, z0 + 0.33), (0, -0.2, z0 + 0.4)], [0.065, 0.055, 0.06]); c.ball((0, -0.22, z0 + 0.43), 0.09)
    r.body = c.mesh("_duckbody", res=0.014, keep=0.25)
    paint(r.body, coat_rules(coat, 0.7, -0.5), A(coat))
    bvh = bvh_of(r.body)
    place_eyes(r, bvh, (0.06, -0.27, z0 + 0.46), (-1, 0.5, -0.1), 0.022)
    h = r["head"]
    h.ball(1.0, (0, -0.33, z0 + 0.405), "orange", sc=(0.06, 0.085, 0.022), u=14, v=7); h.ball(1.0, (0, -0.32, z0 + 0.388), "orange_dk", sc=(0.05, 0.07, 0.014), u=12, v=6)
    r["tail"].tube([(0, 0.29, z0 + 0.25), (0, 0.29, z0 + 0.3), (0, 0.25, z0 + 0.31)], 0.011, A(coat, "lt"), seg=5)
    for nm, sx in (("wingL", 1), ("wingR", -1)):
        folded_wing(r[nm], sx, (0.14, -0.09, z0 + 0.17), 0.3, 0.16, coat, tilt=-0.12)
    bird_legs(r, 0.07, z0 + 0.06, 0.06, "orange", 0.035, web=True)
    biped_walk(r, 0.6, 0.38, 0.012, 0.0, roll=0.16)
    @r.clip("Idle", 5.0)
    def idle(t):
        preen = smooth(min(1.0, max(0.0, (t - 0.4) / 0.08))) * smooth(min(1.0, max(0.0, (0.75 - t) / 0.08)))
        look = hold(t, [(0.0, 0.0), (0.15, 0.4), (0.3, 0.0), (0.85, -0.4)], 0.06); bl = blip(t, 0.2, 0.02)
        return {"neck": {"y": look * 0.5 + 1.1 * preen, "p": 0.3 * preen}, "head": {"y": look * 0.5 + 0.8 * preen, "p": 0.4 * preen + 0.1 * preen * sin(tau * 6 * t)},
                "wingL": {"r": 0.18 * preen}, "tail": {"y": 0.3 * blip(t, 0.9, 0.04) - 0.3 * blip(t, 0.95, 0.04)}, "eyeL": {"s": (1, 1, 1 - 0.9 * bl)}, "eyeR": {"s": (1, 1, 1 - 0.9 * bl)}}
    @r.clip("Swim", 2.0)
    def swim(t):
        a = sin(tau * t)
        return {"root": {"z": -(z0 + 0.04) + 0.008 * sin(2 * tau * t)}, "body": {"p": 0.03 * sin(tau * t)},
                "legL": {"p": 0.6 + 0.45 * a}, "legR": {"p": 0.6 - 0.45 * a}, "footL": {"p": 0.4 * max(0.0, -cos(tau * t))}, "footR": {"p": 0.4 * max(0.0, cos(tau * t))},
                "neck": {"p": -0.05 * sin(tau * t)}, "tail": {"y": 0.15 * sin(2 * tau * t)}}
    r.statics = {"KL_Duck": ("Idle", 0.0), "KL_Duck_Swim": ("Swim", 0.0)}
    return r

@creature
def bird():
    r = Rig("Bird"); coat = "blue"; z = 0.13
    bird_bones(r, ((0, 0.01, 0.06), (0, 0.01, 0.2)), ((0, -0.04, z + 0.04), (0, -0.06, z + 0.07)), ((0, -0.06, z + 0.07), (0, -0.18, z + 0.05)), ((0, 0.1, z + 0.02), (0, 0.25, z + 0.06)),
               ((0.09, 0.0, z + 0.03), (0.4, 0.0, z + 0.03)), (0.04, 0.06, 0.0), 0.015)
    r.thick.update(body=0.11, neck=0.06, head=0.08, tail=0.04)
    c = Clay(); c.ell((0, 0.02, z), (0.11, 0.14, 0.105)); c.ball((0, -0.06, z + 0.07), 0.085); c.ell((0, 0.12, z + 0.02), (0.05, 0.07, 0.03))
    r.body = c.mesh("_birdbody", res=0.01, keep=0.3)
    paint(r.body, [("cream", lambda c_, n: c_.y < -0.02 and c_.z < z + 0.02 and n.y < 0.2)] + coat_rules(coat, 0.7, -0.5), A(coat))
    bvh = bvh_of(r.body)
    place_eyes(r, bvh, (0.05, -0.11, z + 0.09), (-1, 0.6, -0.1), 0.021)
    cone(r["head"], 0.028, 0.07, (0, -0.135, z + 0.06), "gold", rot=(pi / 2, 0, 0), seg=8)
    r["head"].ball(0.035, (0, -0.04, z + 0.15), A(coat, "lt"), sc=(0.7, 1.2, 1), u=10, v=6)
    for nm, sg in (("wingL", 1), ("wingR", -1)):
        open_wing(r[nm], sg, 0.085, 0.31, 0.15, z + 0.03, coat)
    for k, a in enumerate((-0.3, 0.0, 0.3)):            # a tail of three rounded feathers, fanned a little
        r["tail"].ball(1.0, (0.03 * sin(a), 0.17, z + 0.045), A(coat, "dk"), sc=(0.024, 0.075, 0.009), u=10, v=5, rot=(-0.35, 0, a * 0.7))
    for nm, sx in (("legL", 1), ("legR", -1)):
        r[nm].cyl(0.008, 0.06, (sx * 0.04, 0.06, 0.0), "gold", seg=6); r[nm.replace("leg", "foot")].ball(1.0, (sx * 0.04, 0.045, 0.006), "gold", sc=(0.022, 0.03, 0.006), u=8, v=4)
    FOLD = {"wingL": {"y": 1.5, "r": 0.35}, "wingR": {"y": -1.5, "r": -0.35}}
    @r.clip("Idle", 3.0)
    def idle(t):
        look = hold(t, [(0.0, 0.0), (0.2, 0.7), (0.4, -0.5), (0.65, 0.2), (0.8, -0.2)], 0.05); bl = blip(t, 0.5, 0.02)
        v = dict(FOLD); v["head"] = {"y": look, "r": 0.2 * look}; v["tail"] = {"p": -0.3 * blip(t, 0.5, 0.04)}; v["eyeL"] = v["eyeR"] = {"s": (1, 1, 1 - 0.9 * bl)}
        return v
    @r.clip("Hop", 0.5)
    def hop(t):
        v = dict(FOLD); up = sin(pi * t); v["root"] = {"z": 0.08 * up}; v["legL"] = {"p": 0.5 * up}; v["legR"] = {"p": 0.5 * up}; v["tail"] = {"p": -0.3 * up}
        v["body"] = {"s": (1 + 0.08 * (1 - up) * (t < 0.15 or t > 0.85), 1, 1 - 0.1 * (1 - up) * (t < 0.15 or t > 0.85) + 0.06 * up)}
        return v
    @r.clip("Fly", 0.4)
    def fly(t):
        a = sin(tau * t)
        return {"wingL": {"r": -0.9 * a}, "wingR": {"r": 0.9 * a}, "body": {"z": 0.02 * a, "p": -0.1}, "legL": {"p": 0.9}, "legR": {"p": 0.9}, "tail": {"p": -0.1 * a}}
    r.statics = {"KL_Bird": ("Idle", 0.0), "KL_Bird_Fly": ("Fly", 0.0)}
    return r
