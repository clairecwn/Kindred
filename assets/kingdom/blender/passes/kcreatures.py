"""Creatures, rigged (20 Oct 2026). Every animal of the life kit is built again with bones so the game can play it:
walk, idle, and what that animal does (graze, peck, swim, fly, sit). How they move follows the research Claire asked
for, kept bouncy and readable as in Hay Day and the Mario games:
  - cows, ponies and sheep walk in the four-beat lateral walk of a real one: left hind, left fore, right hind, right
    fore, a quarter of a stride apart. The body dips twice a stride, rolls a little over the leg that is down, the head
    nods with the forelegs and the tail swings behind. Idle: the head looks about, an ear flicks, the tail swats.
    Graze: the neck reaches down until the muzzle is in the grass and the head bobs as it bites; the tail swishes.
  - a chicken walks with its head held still in the air while the body passes under it, then thrusts it forward (the
    hold-and-thrust of a real bird); pecking is a quick bow with three stabs at the ground. Idle: quick head turns
    with holds between, as a hen looks with one eye then the other.
  - a duck waddles: its legs are set far back, so it rocks from side to side over each foot. Swimming, the body rides
    level and the feet paddle under water: a push back with the web spread, then forward again folded.
  - the cat walks like the others, tail up; it sits by dropping its haunches with its forelegs straight, tail curled
    round, the tip flicking.
  - the bird hops and looks about on its perch and flaps when it flies; the butterfly flaps fast in flight and slowly
    when it rests.
Rig: one armature per creature, each body part bound wholly to one bone (a toy's jointed parts: the look is chunky
and round, so rigid parts read right and cost nothing). A ball at each knee hides the joint. The frame is the life
kit's: the ground at z = 0, the front towards -Y. Paint stays on KV_A_ / KV_B_ so the game can recolour a coat.
A clip is a function of the time through it (0 to 1, looping); it gives for each bone a turn about the world axes
(pitch about X: positive lowers a part that points forward and swings a leg back; yaw about Z; roll about Y) and a
shift in metres."""
import bpy, bmesh
from math import sin, cos, pi, tau, sqrt, atan2
from mathutils import Vector, Matrix, Quaternion
from kk import *
from ktone import TB, tn, derive
import gk
from klife import A, P, eye, cone, frame

FPS = 24

# ---------------------------------------------------------------- the rig
class Rig:
    def __init__(s, name):
        s.name = name; s.bones = {}; s.order = []; s.parts = {}; s.clips = {}; s.statics = {}
    def bone(s, n, head, tail, parent=None):
        s.bones[n] = (Vector(head), Vector(tail), parent); s.order.append(n); s.parts[n] = TB(); return s.parts[n]
    def __getitem__(s, n): return s.parts[n]
    def clip(s, name, secs):
        def deco(fn): s.clips[name] = (secs, fn); return fn
        return deco

def assemble(rig, coll):
    """The armature and one skinned mesh: each bone's parts weighted wholly to it."""
    bm = bmesh.new(); dl = bm.verts.layers.deform.verify(); mats = []
    for gi, n in enumerate(rig.order):
        b = rig.parts[n]
        if not len(b.bm.verts): b.bm.free(); continue
        tmp = bpy.data.meshes.new("_kcpart"); b.bm.to_mesh(tmp); b.bm.free()
        local = list(b.mats)
        v0, f0 = len(bm.verts), len(bm.faces)
        bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        for v in bm.verts[v0:]: v[dl][gi] = 1.0
        for f in bm.faces[f0:]:
            m = local[f.material_index] if f.material_index < len(local) else local[0]
            if m not in mats: mats.append(m)
            f.material_index = mats.index(m)
    name = rig.name
    old = bpy.data.objects.get("KC_" + name)
    if old: bpy.data.objects.remove(old, do_unlink=True)
    olda = bpy.data.objects.get("KCA_" + name)
    if olda:
        ad = olda.data; bpy.data.objects.remove(olda, do_unlink=True)
        if ad.users == 0: bpy.data.armatures.remove(ad)
    for a in [a for a in bpy.data.actions if a.name.startswith(name + "_")]: bpy.data.actions.remove(a)
    me = bpy.data.meshes.get("KC_" + name)
    if me: me.name = "KC_" + name + "__old"
    me = bpy.data.meshes.new("KC_" + name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    if any(m.get("gm_tile") for m in mats): gk.box_uv(me)
    gk.hard_normals(me, 62)
    stale = bpy.data.meshes.get("KC_" + name + "__old")
    if stale and stale.users == 0: bpy.data.meshes.remove(stale)
    ad = bpy.data.armatures.new("KCA_" + name); arm = bpy.data.objects.new("KCA_" + name, ad); coll.objects.link(arm)
    ob = bpy.data.objects.new("KC_" + name, me); coll.objects.link(ob)
    for n in rig.order: ob.vertex_groups.new(name=n)
    vl = bpy.context.view_layer
    for o in vl.objects:
        try: o.select_set(False)
        except RuntimeError: pass
    vl.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for n in rig.order:
        h, t, p = rig.bones[n]; eb = ad.edit_bones.new(n); eb.head, eb.tail, eb.roll = h, t, 0.0
        if p: eb.parent = ad.edit_bones[p]; eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    ob.parent = arm; mod = ob.modifiers.new("Armature", "ARMATURE"); mod.object = arm
    for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
    arm["kc_creature"] = name
    return arm, ob

def pose(arm, values):
    """Sets the pose: values = {bone: {p, y, r (radians about world X, Z, Y), x, f, z (metres; f is forward, -Y)}}."""
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    for pb in arm.pose.bones:
        v = values.get(pb.name, {}); R = pb.bone.matrix_local.to_3x3(); Rt = R.transposed()
        q = Quaternion(Rt @ Z, v.get("y", 0.0)) @ Quaternion(Rt @ X, v.get("p", 0.0)) @ Quaternion(Rt @ Y, v.get("r", 0.0))
        pb.rotation_quaternion = q
        pb.location = Rt @ Vector((v.get("x", 0.0), -v.get("f", 0.0), v.get("z", 0.0)))

def bake(arm, rig):
    """Every clip as an action, each on its own NLA track (the exporter writes one animation per track)."""
    ad = arm.animation_data or arm.animation_data_create()
    for tr in list(ad.nla_tracks): ad.nla_tracks.remove(tr)
    for cname, (secs, fn) in rig.clips.items():
        act = bpy.data.actions.new(rig.name + "_" + cname); ad.action = act
        n = max(2, round(secs * FPS)); step = 2 if n > 16 else 1
        frames = list(range(0, n + 1, step))
        if frames[-1] != n: frames.append(n)
        for f in frames:
            pose(arm, fn((f / n) % 1.0 if f < n else 0.0))
            for pb in arm.pose.bones:
                pb.keyframe_insert("rotation_quaternion", frame=f + 1); pb.keyframe_insert("location", frame=f + 1)
        ad.action = None
        tr = ad.nla_tracks.new(); tr.name = cname; tr.strips.new(cname, 1, act)
    pose(arm, {})

def static(arm, ob, fn, t, name):
    """The posed creature at time t of a clip fn, written into the life kit mesh `name` (keeping its facts). Run
    before bake: once the clips are on NLA tracks they would override a pose set by hand."""
    pose(arm, fn(t)); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    me.validate(); gk.hard_normals(me, 62)
    old = bpy.data.meshes.get(name)
    if old:                                          # replace it in place, keeping its facts (kl_*) and every user
        for k_ in old.keys(): me[k_] = old[k_]
        old.user_remap(me); bpy.data.meshes.remove(old)
    me.name = name
    pose(arm, {}); bpy.context.view_layer.update(); return me

# ---------------------------------------------------------------- motion helpers
def smooth(u): return u * u * (3 - 2 * u)
def stride(p, a, knee, st=0.62):
    """One leg through a stride. p: where the leg is in its own stride (0 to 1). Returns (hip pitch, knee pitch):
    on the ground (the first `st` of it) the leg sweeps from forward to back; then it lifts, folding at the knee,
    and swings forward again."""
    if p < st: u = p / st; return -a + 2 * a * u, 0.0
    u = (p - st) / (1 - st); return a - 2 * a * smooth(u), knee * sin(pi * u)
def blip(t, at, width):
    """0 most of the time, rising to 1 and back round time `at` (a quick move, held nowhere)."""
    d = ((t - at + 0.5) % 1.0) - 0.5
    return max(0.0, 1 - abs(d) / width) ** 2 * (3 - 2 * max(0.0, 1 - abs(d) / width)) if abs(d) < width else 0.0
def hold(t, keys):
    """A value that jumps quickly between held positions: keys = [(time, value)] in order; 0.06 to move."""
    for i, (tk, v) in enumerate(keys):
        tn_ = keys[(i + 1) % len(keys)][0] + (1.0 if i + 1 == len(keys) else 0.0)
        if tk <= t < tn_ or (i == len(keys) - 1 and t < keys[0][0]):
            prev = keys[i - 1][1]; u = min(1.0, ((t - tk) % 1.0) / 0.06)
            return prev + (v - prev) * smooth(u)
    return keys[0][1]

def reach(neck_at, head_at, tip, target_z, extra=0.4):
    """How far the neck must pitch (radians, positive is down) for the muzzle at `tip` to come down to target_z,
    with the head itself bent a further `extra` at its own joint."""
    neck_at, head_at, tip = Vector(neck_at), Vector(head_at), Vector(tip); best = 0.0
    for k in range(0, 160):
        th = k * 0.01; Rn = Matrix.Rotation(th, 3, "X"); hp = neck_at + Rn @ (head_at - neck_at)
        tp = hp + Matrix.Rotation(th + extra, 3, "X") @ (tip - head_at); best = th
        if tp.z <= target_z: break
    return best

RIGS = {}
def creature(fn):
    RIGS[fn.__name__.capitalize()] = fn; return fn

# ---------------------------------------------------------------- four legs: cow, pony, sheep, cat
def legs4(r, spec, coat, hoof, knee_ball=True, sock=None):
    """spec: dict(x, fore, hind, hip, knee, ur, lr) -> bones FL/FR/HL/HR (upper) and their lower bones (_lo)."""
    x, yf, yh, hip, kz = spec["x"], spec["fore"], spec["hind"], spec["hip"], spec["knee"]
    for nm, sx, y in (("FL", 1, yf), ("FR", -1, yf), ("HL", 1, yh), ("HR", -1, yh)):
        px = sx * x
        up = r.bone(nm, (px, y, hip), (px, y, kz), "root")
        up.cyl(spec["ur"], hip - kz + 0.12, (px, y, kz), coat, seg=12, bev=0.0)
        lo = r.bone(nm + "_lo", (px, y, kz), (px, y, 0.0), nm)
        lo.cyl(spec["lr"], kz - 0.05, (px, y, 0.05), sock or coat, seg=12)
        if knee_ball: lo.ball(spec["ur"] * 1.02, (px, y, kz), sock or coat, u=12, v=7)
        if hoof: lo.cyl(spec["lr"] * 1.06, 0.075, (px, y, 0.0), hoof, seg=12, bev=0.015)
        else: lo.ball(spec["lr"] * 1.15, (px, y - 0.02, spec["lr"] * 0.55), sock or coat, sc=(1, 1.3, 0.6), u=12, v=8)

def quad_clips(r, sp):
    """Walk, Idle and Eat (or Sit for the cat) for a four-legged rig. sp: speeds and sizes for this animal."""
    A_, K_, bob, nod = sp["swing"], sp["knee"], sp["bob"], sp["nod"]
    PH = {"HL": 0.0, "FL": 0.25, "HR": 0.5, "FR": 0.75}           # the lateral walk: LH, LF, RH, RF
    @r.clip("Walk", sp["walk"])
    def walk(t):
        v = {}
        for nm, ph in PH.items():
            th, kn = stride((t + ph) % 1.0, A_ * (1.1 if nm[0] == "H" else 1.0), K_)
            v[nm] = {"p": th}; v[nm + "_lo"] = {"p": kn}
        v["body"] = {"z": -bob * cos(4 * pi * t) - bob, "r": 0.035 * sin(tau * t), "p": 0.02 * sin(4 * pi * t)}
        v["neck"] = {"p": nod * sin(4 * pi * t + 0.8) + sp.get("neck_walk", 0.0)}
        v["head"] = {"p": -0.5 * nod * sin(4 * pi * t + 0.8)}
        v["tail"] = {"y": 0.16 * sin(tau * t), "p": sp.get("tail_up", 0.0)}; v["tail2"] = {"y": 0.22 * sin(tau * t - 0.7)}
        if "tail3" in r.bones: v["tail3"] = {"y": 0.25 * sin(tau * t - 1.3)}
        for e, s in (("earL", 1), ("earR", -1)): v[e] = {"p": 0.08 * sin(4 * pi * t)}
        return v
    @r.clip("Idle", sp["idle"])
    def idle(t):
        look = hold(t, [(0.0, 0.0), (0.22, 0.32), (0.5, 0.0), (0.7, -0.28), (0.9, 0.0)])
        v = {"body": {"z": 0.006 * sin(tau * 2 * t)}, "neck": {"y": look * 0.6, "p": 0.03 * sin(tau * t)}, "head": {"y": look * 0.5, "r": 0.05 * sin(tau * t)}}
        swat = blip(t, 0.6, 0.12)
        v["tail"] = {"y": 0.08 * sin(tau * 2 * t) + 0.5 * swat, "p": sp.get("tail_up", 0.0) - 0.25 * swat}
        v["tail2"] = {"y": 0.1 * sin(tau * 2 * t - 0.6) + 0.6 * blip(t, 0.63, 0.12)}
        if "tail3" in r.bones: v["tail3"] = {"y": 0.3 * sin(tau * 2 * t - 1.2)}
        v["earL"] = {"y": 0.5 * blip(t, 0.35, 0.05)}; v["earR"] = {"y": -0.5 * blip(t, 0.82, 0.05)}
        return v
    if sp.get("eat"):
        dn = sp["eat"]
        @r.clip("Eat", sp["graze"])
        def eat(t):
            bite = abs(sin(3 * tau * t))
            v = {"neck": {"p": dn, "y": 0.1 * sin(tau * t)}, "head": {"p": 0.4 - 0.12 * bite}, "body": {"p": 0.03, "z": -0.01}}
            v["FL"] = {"p": -0.06}; v["FR"] = {"p": -0.06}
            v["tail"] = {"y": 0.3 * sin(tau * t) + 0.4 * blip(t, 0.75, 0.1)}; v["tail2"] = {"y": 0.35 * sin(tau * t - 0.7)}
            v["earL"] = {"p": -0.2, "y": 0.3 * blip(t, 0.3, 0.05)}; v["earR"] = {"p": -0.2}
            return v

def face(b, F, rot, sc_head, body_m, eyes, muzzle=None, nostrils=None, cheeks=None):
    b.ball(1.0, F(0, 0, 0), body_m, sc=sc_head, u=16, v=10, rot=rot)
    if muzzle: b.ball(1.0, F(*muzzle[0]), muzzle[1], sc=muzzle[2], u=14, v=8, rot=rot)
    for sg in (-1, 1):
        ex, ey, ez, er = eyes; eye(b, F(sg * ex, ey, ez), er, rot, sg)
        if nostrils: b.ball(nostrils[3], F(sg * nostrils[0], nostrils[1], nostrils[2]), "plum", sc=(1, 0.6, 1), u=8, v=5, rot=rot)
        if cheeks: b.ball(cheeks[3], F(sg * cheeks[0], cheeks[1], cheeks[2]), "pink", sc=(0.5, 1, 0.8), u=8, v=5, rot=rot)

@creature
def cow():
    r = Rig("Cow"); coat = A("white"); body = tn(coat, 0.28, 0.78, 0.3); patch = P("trunk")
    r.bone("root", (0, 0, 0), (0, 0, 0.3))
    legs4(r, dict(x=0.23, fore=-0.38, hind=0.44, hip=0.7, knee=0.34, ur=0.115, lr=0.1), coat, "plum")
    b = r.bone("body", (0, 0.04, 0.72), (0, 0.04, 1.0), "root")
    b.ball(1.0, (0, 0.06, 0.92), body, sc=(0.43, 0.7, 0.4), u=20, v=12)
    for x, y, z, rr in ((0.3, 0.3, 1.05, 0.26), (-0.36, -0.1, 0.95, 0.22), (0.1, -0.2, 1.24, 0.2), (-0.2, 0.52, 0.98, 0.2)):
        n = Vector((x / 0.43 ** 2, (y - 0.06) / 0.7 ** 2, (z - 0.92) / 0.4 ** 2)).normalized()
        b.ball(rr, (x, y, z), patch, sc=(1, 1, 0.3), u=12, v=6, rot=n.to_track_quat("Z", "Y").to_matrix())
    b.ball(0.15, (0, 0.3, 0.57), "pink", sc=(1, 1, 0.75), u=14, v=8)
    for sx in (-1, 1):
        for sy in (-1, 1): b.cyl(0.026, 0.06, (sx * 0.06, 0.3 + sy * 0.06, 0.47), "pink", seg=8, r2=0.02)
    n = r.bone("neck", (0, -0.36, 0.94), (0, -0.72, 1.22), "body")
    n.tube([(0, -0.36, 0.94), (0, -0.6, 1.14), (0, -0.74, 1.24)], [0.26, 0.25, 0.22], coat, seg=14)
    ring = [Vector((0.272 * cos(a), 0.0, 0.272 * sin(a))) for a in [tau * i / 16 for i in range(16)]]
    Rn = Matrix.Rotation(-0.55, 3, "X"); c0 = Vector((0, -0.6, 1.12))
    n.tube([tuple(c0 + Rn @ p) for p in ring], 0.035, "red", seg=6, closed=True)                                # a collar with a bell
    n.lathe([(0.0, 0.0), (0.05, 0.01), (0.075, 0.09), (0.04, 0.13), (0.0, 0.135)], tuple(c0 + Rn @ Vector((0, 0, -0.29)) - Vector((0, 0, 0.13))), "gold", seg=12)
    n.ball(0.022, tuple(c0 + Rn @ Vector((0, 0, -0.29)) - Vector((0, 0, 0.14))), "gold_dk", u=6, v=4)
    h = r.bone("head", (0, -0.76, 1.26), (0, -1.28, 1.2), "neck")
    F, rot = frame((0, -0.92, 1.34), 0.2)
    face(h, F, rot, (0.25, 0.29, 0.25), body, (0.18, -0.12, 0.07, 0.054), ((0, -0.22, -0.07), "pink", (0.21, 0.16, 0.16)), (0.07, -0.36, -0.04, 0.026))
    for sg in (-1, 1): cone(h, 0.05, 0.17, F(sg * 0.14, 0.08, 0.21), "cream", rot=(rot[0], sg * 0.5, 0))
    h.ball(0.13, F(0.02, 0.02, 0.21), patch, sc=(1.2, 1, 0.5), u=10, v=6, rot=rot)
    for nm, sg in (("earL", 1), ("earR", -1)):
        e = r.bone(nm, F(sg * 0.2, 0.06, 0.1), F(sg * 0.42, 0.06, 0.08), "head")
        e.ball(1.0, F(sg * 0.31, 0.06, 0.09), coat, sc=(0.12, 0.05, 0.07), u=10, v=6, rot=(rot[0], sg * 0.3, 0))
        e.ball(1.0, F(sg * 0.31, 0.03, 0.09), "pink", sc=(0.08, 0.03, 0.045), u=8, v=5, rot=(rot[0], sg * 0.3, 0))
    t1 = r.bone("tail", (0, 0.74, 1.0), (0, 0.84, 0.72), "body"); t1.tube([(0, 0.7, 1.02), (0, 0.82, 0.86), (0, 0.84, 0.72)], 0.035, coat, seg=8)
    t2 = r.bone("tail2", (0, 0.84, 0.72), (0, 0.84, 0.36), "tail"); t2.tube([(0, 0.84, 0.74), (0, 0.84, 0.48)], 0.032, coat, seg=8)
    t2.ball(0.08, (0, 0.84, 0.42), patch, sc=(0.9, 0.9, 1.3), u=10, v=7)
    dn = reach((0, -0.36, 0.94), (0, -0.76, 1.26), (0, -1.28, 1.2), 0.12)
    quad_clips(r, dict(swing=0.3, knee=0.75, bob=0.012, nod=0.06, walk=1.3, idle=5.0, graze=3.0, eat=dn))
    r.statics = {"KL_Cow": ("Idle", 0.0), "KL_Cow_Graze": ("Eat", 0.0)}
    return r

@creature
def pony():
    r = Rig("Pony"); coat = A("trunk_light"); body = tn(coat, 0.3, 0.75, 0.3)
    r.bone("root", (0, 0, 0), (0, 0, 0.3))
    legs4(r, dict(x=0.2, fore=-0.34, hind=0.4, hip=0.72, knee=0.36, ur=0.105, lr=0.09), coat, "plum")
    b = r.bone("body", (0, 0.04, 0.74), (0, 0.04, 1.0), "root")
    b.ball(1.0, (0, 0.04, 0.9), body, sc=(0.37, 0.62, 0.36), u=22, v=14)
    n = r.bone("neck", (0, -0.32, 0.94), (0, -0.6, 1.36), "body")
    neck = [(0, -0.32, 0.94), (0, -0.52, 1.2), (0, -0.6, 1.36)]
    n.tube(neck, [0.27, 0.23, 0.2], coat, seg=14)
    for k, p in enumerate(neck + [(0, -0.64, 1.46)]): n.ball(0.15 - 0.012 * k, (0, p[1] + 0.2, p[2] + 0.14), "cream", sc=(0.6, 1, 1), u=12, v=8)    # mane
    h = r.bone("head", (0, -0.62, 1.4), (0, -1.14, 1.32), "neck")
    F, rot = frame((0, -0.76, 1.48), 0.3)
    face(h, F, rot, (0.22, 0.32, 0.23), body, (0.16, -0.1, 0.06, 0.05), ((0, -0.26, -0.05), "cream", (0.17, 0.17, 0.155)), (0.06, -0.41, -0.03, 0.02), (0.17, -0.2, -0.04, 0.05))
    h.ball(0.11, F(0, 0.02, 0.21), "cream", sc=(1, 1.3, 0.8), u=10, v=7, rot=rot)
    for nm, sg in (("earL", 1), ("earR", -1)):
        e = r.bone(nm, F(sg * 0.12, 0.12, 0.15), F(sg * 0.14, 0.12, 0.34), "head")
        cone(e, 0.065, 0.18, F(sg * 0.12, 0.12, 0.15), coat, rot=(rot[0] - 0.2, sg * 0.25, 0))
    t1 = r.bone("tail", (0, 0.6, 0.98), (0, 0.8, 0.78), "body"); t1.tube([(0, 0.58, 1.0), (0, 0.76, 0.86), (0, 0.8, 0.74)], [0.08, 0.1, 0.1], "cream", seg=10)
    t2 = r.bone("tail2", (0, 0.8, 0.78), (0, 0.8, 0.4), "tail"); t2.tube([(0, 0.8, 0.8), (0, 0.81, 0.58), (0, 0.8, 0.42)], [0.1, 0.09, 0.05], "cream", seg=10)
    dn = reach((0, -0.32, 0.94), (0, -0.62, 1.4), (0, -1.14, 1.32), 0.1)
    quad_clips(r, dict(swing=0.34, knee=0.9, bob=0.015, nod=0.07, walk=1.1, idle=5.0, graze=3.0, eat=dn))
    r.statics = {"KL_Pony": ("Idle", 0.0), "KL_Pony_Graze": ("Eat", 0.0)}
    return r

@creature
def sheep():
    r = Rig("Sheep"); wool = A("white"); face_m = P("sand")
    r.bone("root", (0, 0, 0), (0, 0, 0.2))
    legs4(r, dict(x=0.15, fore=-0.24, hind=0.24, hip=0.42, knee=0.2, ur=0.07, lr=0.062), face_m, "plum")
    b = r.bone("body", (0, 0.0, 0.45), (0, 0.0, 0.7), "root")
    for x, y, z, rr, k in ((0, 0, 0.6, 0.33, None), (0.17, -0.2, 0.62, 0.22, "lt"), (-0.17, -0.2, 0.6, 0.22, None), (0.18, 0.2, 0.6, 0.22, None), (-0.18, 0.2, 0.62, 0.22, "lt"),
                           (0, -0.02, 0.84, 0.23, "lt"), (0, 0.34, 0.66, 0.2, None), (0.12, 0.0, 0.42, 0.2, "dk"), (-0.12, 0.0, 0.42, 0.2, "dk"), (0, -0.33, 0.7, 0.19, "lt"), (0.1, 0.22, 0.8, 0.16, "lt"), (-0.12, -0.18, 0.8, 0.15, None)):
        b.ball(rr, (x, y, z), A("white", k) if k else wool, u=12, v=8)
    n = r.bone("neck", (0, -0.3, 0.68), (0, -0.44, 0.78), "body")
    n.ball(0.12, (0, -0.38, 0.72), face_m, u=12, v=8)
    h = r.bone("head", (0, -0.44, 0.78), (0, -0.72, 0.72), "neck")
    F, rot = frame((0, -0.52, 0.8), 0.15)
    face(h, F, rot, (0.14, 0.19, 0.15), tn(face_m, 0.3, 0.8, 0.3), (0.105, -0.08, 0.04, 0.036))
    h.ball(0.12, F(0, 0.08, 0.12), A("white", "lt"), sc=(1.25, 1.1, 0.8), u=12, v=8, rot=rot)
    h.ball(0.028, F(0, -0.19, -0.02), "pink", sc=(1.2, 0.6, 0.8), u=8, v=5, rot=rot)
    for nm, sg in (("earL", 1), ("earR", -1)):
        e = r.bone(nm, F(sg * 0.11, 0.05, 0.03), F(sg * 0.28, 0.06, 0.02), "head")
        e.ball(1.0, F(sg * 0.19, 0.06, 0.03), face_m, sc=(0.09, 0.04, 0.05), u=10, v=6, rot=(rot[0], sg * 0.5, 0))
    t1 = r.bone("tail", (0, 0.42, 0.66), (0, 0.5, 0.56), "body"); t1.ball(0.08, (0, 0.47, 0.62), wool, sc=(0.9, 0.9, 1.2), u=10, v=7)
    r.bone("tail2", (0, 0.5, 0.56), (0, 0.52, 0.5), "tail")
    dn = reach((0, -0.3, 0.68), (0, -0.44, 0.78), (0, -0.72, 0.72), 0.08)
    quad_clips(r, dict(swing=0.32, knee=0.8, bob=0.012, nod=0.05, walk=0.9, idle=4.5, graze=2.6, eat=dn))
    r.statics = {"KL_Sheep": ("Idle", 0.0), "KL_Sheep_Graze": ("Eat", 0.0)}
    return r

LIFT = 0.05
@creature
def cat():
    r = Rig("Cat"); c = A("orange"); body = tn(c, 0.3, 0.8, 0.3)
    r.bone("root", (0, 0, 0), (0, 0, 0.12))
    b = r.bone("body", (0, 0.16, 0.24), (0, -0.2, 0.26), "root")                       # from the hips to the shoulders
    b.ball(1.0, (0, -0.01, 0.25), body, sc=(0.13, 0.25, 0.12), u=18, v=12)
    b.ball(1.0, (0, -0.15, 0.22), "cream", sc=(0.09, 0.1, 0.09), u=14, v=9)
    spec = dict(x=0.075, fore=-0.17, hind=0.15, hip=0.27, knee=0.135, ur=0.05, lr=0.04)
    for nm, sx, y, par in (("FL", 1, spec["fore"], "body"), ("FR", -1, spec["fore"], "body"), ("HL", 1, spec["hind"], "root"), ("HR", -1, spec["hind"], "root")):
        px = sx * spec["x"]; up = r.bone(nm, (px, y, spec["hip"]), (px, y, spec["knee"]), par)
        up.cyl(spec["ur"], spec["hip"] - spec["knee"] + 0.05, (px, y, spec["knee"]), c, seg=12)
        if nm[0] == "H": up.ball(1.0, (px * 1.25, y, 0.19 + LIFT), c, sc=(0.06, 0.1, 0.08), u=12, v=8)                       # haunch
        lo = r.bone(nm + "_lo", (px, y, spec["knee"]), (px, y, 0.0), nm)
        lo.cyl(spec["lr"], spec["knee"] - 0.02, (px, y, 0.02), c, seg=12); lo.ball(spec["ur"], (px, y, spec["knee"]), c, u=12, v=8)
        lo.ball(1.0, (px, y - 0.02, 0.022), "cream", sc=(0.045, 0.06, 0.03), u=12, v=7)
    n = r.bone("neck", (0, -0.2, 0.3), (0, -0.26, 0.38), "body")
    n.tube([(0, -0.17, 0.28), (0, -0.23, 0.34), (0, -0.28, 0.41)], [0.075, 0.07, 0.065], c, seg=12)
    h = r.bone("head", (0, -0.27, 0.4), (0, -0.42, 0.38), "neck")
    F, rot = frame((0, -0.3, 0.42), 0.0)
    face(h, F, rot, (0.13, 0.115, 0.11), body, (0.058, -0.095, 0.03, 0.026))
    h.ball(1.0, F(0, -0.1, -0.03), "cream", sc=(0.065, 0.04, 0.04), u=12, v=8); h.ball(0.014, F(0, -0.14, -0.015), "pink", u=6, v=4)
    for sg in (-1, 1):
        for k in (0, 1): h.tube([F(sg * 0.04, -0.12, -0.035 + 0.012 * k), F(sg * 0.17, -0.12, -0.03 + 0.03 * k)], 0.003, "white", seg=4)
    for nm, sg in (("earL", 1), ("earR", -1)):
        e = r.bone(nm, F(sg * 0.075, 0.0, 0.07), F(sg * 0.09, 0.0, 0.16), "head")
        cone(e, 0.048, 0.09, F(sg * 0.078, 0.0, 0.07), c, rot=(0, sg * 0.3, 0), seg=8); cone(e, 0.026, 0.055, F(sg * 0.076, -0.014, 0.08), "pink", rot=(0, sg * 0.3, 0), seg=8)
    pts = [(0, 0.24, 0.27), (0, 0.32, 0.36), (0, 0.34, 0.46), (0, 0.3, 0.55)]
    for i, nm in enumerate(("tail", "tail2", "tail3")):
        t_ = r.bone(nm, pts[i], pts[i + 1], "body" if i == 0 else ("tail", "tail2")[i - 1])
        t_.tube([pts[i], pts[i + 1]], [0.032 - 0.004 * i, 0.028 - 0.004 * i], c if i < 2 else "cream", seg=10); t_.ball(0.028 - 0.004 * i, pts[i + 1], c if i < 2 else "cream", u=10, v=7)
    for n_ in r.order:                       # a cat stands taller than its first drawing: everything but the legs goes up
        if n_ == "root" or n_[:2] in ("FL", "FR", "HL", "HR"): continue
        h_, t_, p_ = r.bones[n_]; r.bones[n_] = (h_ + Vector((0, 0, LIFT)), t_ + Vector((0, 0, LIFT)), p_)
        bmesh.ops.translate(r.parts[n_].bm, vec=(0, 0, LIFT), verts=r.parts[n_].bm.verts[:])
    quad_clips(r, dict(swing=0.4, knee=1.0, bob=0.006, nod=0.03, walk=0.8, idle=4.0, tail_up=-0.2))
    @r.clip("Sit", 4.0)
    def sit(t):
        flick = blip(t, 0.4, 0.06) - blip(t, 0.75, 0.06)
        return {"root": {"z": -0.1}, "body": {"p": -0.5}, "FL": {"p": 0.5}, "FR": {"p": 0.5}, "HL": {"p": -1.25}, "HR": {"p": -1.25}, "HL_lo": {"p": 2.1}, "HR_lo": {"p": 2.1},
                "neck": {"p": -0.3}, "head": {"p": 0.1, "y": 0.3 * hold(t, [(0.0, 0.0), (0.3, 0.6), (0.6, 0.0), (0.85, -0.5)])},
                "tail": {"p": 1.5, "y": 0.5}, "tail2": {"y": 0.9}, "tail3": {"y": 0.6 + 0.6 * flick},
                "earL": {"y": 0.4 * blip(t, 0.2, 0.04)}, "earR": {"y": -0.4 * blip(t, 0.65, 0.04)}}
    r.statics = {"KL_Cat_Sit": ("Sit", 0.0)}
    return r

# ---------------------------------------------------------------- two legs: chicken, chick, duck
def bird_legs(r, x, hip, y, m, foot, toes=True, web=False):
    for nm, sx in (("legL", 1), ("legR", -1)):
        px = sx * x; l = r.bone(nm, (px, y, hip), (px, y, 0.03), "root")
        l.cyl(foot * 0.45, hip - 0.03, (px, y, 0.03), m, seg=8)
        f = r.bone(nm.replace("leg", "foot"), (px, y, 0.03), (px, y - foot * 2.4, 0.0), nm)
        if web: f.ball(1.0, (px, y - foot * 1.2, 0.012), m, sc=(foot * 1.4, foot * 1.9, 0.012), u=10, v=5)
        else:
            for a in (-0.5, 0, 0.5): f.ball(1.0, (px + foot * 1.2 * sin(a), y - foot * 1.1 * cos(a), 0.012), m, sc=(foot * 0.42, foot * 1.25, foot * 0.4), u=8, v=5, rot=(0, 0, -a))

def biped_walk(r, secs, swing, bob, thrust, roll=0.0):
    @r.clip("Walk", secs)
    def walk(t):
        a = sin(tau * t); v = {"legL": {"p": -swing * a}, "legR": {"p": swing * a},
                              "footL": {"p": -0.5 * max(0.0, sin(tau * t + 0.6))}, "footR": {"p": -0.5 * max(0.0, -sin(tau * t + 0.6))},
                              "body": {"z": bob * abs(cos(tau * t)) - bob * 0.5, "r": roll * a, "y": roll * 0.6 * a}}
        if thrust:                                                         # the head holds still, then thrusts forward: twice a stride
            u = (2 * t) % 1.0; v["head"] = {"f": thrust * (0.5 - u / 0.75) if u < 0.75 else thrust * (-0.5 + (u - 0.75) / 0.25)}
        else: v["head"] = {"p": 0.05 * sin(4 * pi * t)}
        v["tail"] = {"p": -0.08 * sin(4 * pi * t)}
        v["wingL"] = {"r": 0.05 * a}; v["wingR"] = {"r": -0.05 * a}
        return v

@creature
def chicken():
    r = Rig("Chicken"); coat = A("white"); body = tn(coat, 0.3, 0.8, 0.3)
    r.bone("root", (0, 0, 0), (0, 0, 0.1))
    bird_legs(r, 0.07, 0.24, 0.03, "gold", 0.04)
    b = r.bone("body", (0, 0.04, 0.22), (0, 0.04, 0.44), "root")
    b.ball(1.0, (0, 0.02, 0.33), body, sc=(0.19, 0.24, 0.19), u=18, v=12)
    tl = r.bone("tail", (0, 0.18, 0.4), (0, 0.24, 0.56), "body")
    for k, a in enumerate((-0.35, 0, 0.35)): tl.ball(1.0, (0.12 * sin(a), 0.22, 0.47 + 0.03 * (k == 1)), A("white", "lt"), sc=(0.05, 0.1, 0.14), u=10, v=7, rot=(-0.5, 0, a))
    for nm, sg in (("wingL", 1), ("wingR", -1)):
        w = r.bone(nm, (sg * 0.16, -0.04, 0.38), (sg * 0.17, 0.16, 0.34), "body")
        w.ball(1.0, (sg * 0.17, 0.05, 0.33), A("white", "dk"), sc=(0.05, 0.16, 0.11), u=12, v=8, rot=(-0.2, 0, 0))
    h = r.bone("head", (0, -0.16, 0.46), (0, -0.3, 0.5), "body")
    H = Vector((0, -0.18, 0.5))
    h.ball(0.115, tuple(H), coat, u=16, v=11)
    cone(h, 0.045, 0.1, tuple(H + Vector((0, -0.1, -0.01))), "gold", rot=(pi / 2, 0, 0), seg=8)
    h.ball(0.035, tuple(H + Vector((0, -0.09, -0.07))), "red", sc=(0.8, 0.8, 1.4), u=8, v=6)
    for k, y in enumerate((-0.05, 0.0, 0.05)): h.ball(0.04 - 0.004 * k, tuple(H + Vector((0, y, 0.11 - 0.012 * k))), "red", sc=(0.6, 1, 1), u=8, v=6)
    for sg in (-1, 1): eye(h, tuple(H + Vector((sg * 0.085, -0.055, 0.02))), 0.026, None, sg)
    biped_walk(r, 0.7, 0.45, 0.02, 0.05)
    @r.clip("Idle", 4.0)
    def idle(t):
        look = hold(t, [(0.0, 0.0), (0.15, 0.6), (0.35, -0.4), (0.55, 0.0), (0.7, 0.5), (0.85, -0.2)])
        tilt = hold(t, [(0.0, 0.0), (0.15, 0.3), (0.35, -0.3), (0.55, 0.0), (0.7, 0.25), (0.85, 0.0)])
        ruffle = blip(t, 0.5, 0.06)
        return {"head": {"y": look, "r": tilt}, "tail": {"p": -0.15 * blip(t, 0.25, 0.05)}, "wingL": {"r": 0.25 * ruffle}, "wingR": {"r": -0.25 * ruffle},
                "body": {"z": 0.004 * sin(tau * 3 * t)}}
    @r.clip("Peck", 1.6)
    def peck(t):
        bow = smooth(min(1.0, t / 0.2)) if t < 0.8 else smooth(max(0.0, 1 - (t - 0.8) / 0.2))
        stab = sum(blip(t, a, 0.06) for a in (0.3, 0.45, 0.6))
        return {"body": {"p": 0.75 * bow, "f": 0.02 * bow}, "head": {"p": 0.5 * bow + 0.35 * stab, "f": 0.04 * stab}, "tail": {"p": -0.4 * bow},
                "legL": {"p": -0.25 * bow}, "legR": {"p": -0.25 * bow}}
    r.statics = {"KL_Chicken": ("Idle", 0.0), "KL_Chicken_Peck": ("Peck", 0.45)}
    return r

@creature
def chick():
    r = Rig("Chick"); c = A("yellow")
    r.bone("root", (0, 0, 0), (0, 0, 0.05))
    bird_legs(r, 0.035, 0.06, 0.01, "orange", 0.02)
    b = r.bone("body", (0, 0.01, 0.05), (0, 0.01, 0.17), "root")
    b.ball(1.0, (0, 0.01, 0.1), tn(c, 0.3, 0.8, 0.3), sc=(0.085, 0.1, 0.085), u=16, v=11)
    for nm, sg in (("wingL", 1), ("wingR", -1)):
        w = r.bone(nm, (sg * 0.08, -0.01, 0.12), (sg * 0.08, 0.06, 0.09), "body"); w.ball(1.0, (sg * 0.08, 0.02, 0.1), A("yellow", "dk"), sc=(0.02, 0.05, 0.04), u=8, v=6)
    r.bone("tail", (0, 0.09, 0.11), (0, 0.12, 0.14), "body").ball(0.025, (0, 0.1, 0.13), A("yellow", "lt"), u=8, v=6)
    h = r.bone("head", (0, -0.05, 0.16), (0, -0.14, 0.2), "body")
    h.ball(0.07, (0, -0.06, 0.2), c, u=16, v=11)
    cone(h, 0.022, 0.05, (0, -0.125, 0.195), "orange", rot=(pi / 2, 0, 0), seg=8)
    for sg in (-1, 1): eye(h, (sg * 0.05, -0.1, 0.215), 0.016, None, sg)
    biped_walk(r, 0.4, 0.5, 0.03, 0.0)
    @r.clip("Idle", 3.0)
    def idle(t):
        look = hold(t, [(0.0, 0.0), (0.2, 0.5), (0.45, -0.5), (0.7, 0.0)])
        cheep = blip(t, 0.85, 0.05)
        return {"head": {"y": look, "p": -0.3 * cheep}, "wingL": {"r": 0.6 * cheep}, "wingR": {"r": -0.6 * cheep}, "root": {"z": 0.03 * blip(t, 0.6, 0.06)}}
    @r.clip("Peck", 1.2)
    def peck(t):
        stab = sum(blip(t, a, 0.07) for a in (0.25, 0.5, 0.75))
        return {"body": {"p": 0.4 + 0.25 * stab}, "head": {"p": 0.2 + 0.3 * stab}}
    r.statics = {"KL_Chick": ("Idle", 0.0)}
    return r

@creature
def duck():
    r = Rig("Duck"); c = A("white"); z0 = 0.14
    r.bone("root", (0, 0, 0), (0, 0, 0.1))
    bird_legs(r, 0.07, z0 + 0.06, 0.06, "orange", 0.035, web=True)
    b = r.bone("body", (0, 0.05, z0 + 0.06), (0, 0.05, z0 + 0.25), "root")
    b.ball(1.0, (0, 0.03, z0 + 0.13), tn(c, 0.3, 0.8, 0.3), sc=(0.16, 0.25, 0.14), u=18, v=12)
    t = r.bone("tail", (0, 0.22, z0 + 0.16), (0, 0.32, z0 + 0.26), "body"); cone(t, 0.07, 0.14, (0, 0.24, z0 + 0.16), A("white", "lt"), rot=(-0.9, 0, 0), seg=10)
    t.tube([(0, 0.3, z0 + 0.26), (0, 0.29, z0 + 0.31), (0, 0.25, z0 + 0.31)], 0.012, A("white", "lt"), seg=5)            # the curl of a drake's tail
    for nm, sg in (("wingL", 1), ("wingR", -1)):
        w = r.bone(nm, (sg * 0.13, -0.08, z0 + 0.17), (sg * 0.14, 0.2, z0 + 0.17), "body")
        w.ball(1.0, (sg * 0.14, 0.05, z0 + 0.15), A("white", "dk"), sc=(0.04, 0.17, 0.085), u=12, v=8)
    n = r.bone("neck", (0, -0.15, z0 + 0.2), (0, -0.2, z0 + 0.38), "body")
    n.tube([(0, -0.14, z0 + 0.2), (0, -0.19, z0 + 0.32), (0, -0.2, z0 + 0.4)], [0.07, 0.06, 0.06], c, seg=12)
    h = r.bone("head", (0, -0.2, z0 + 0.4), (0, -0.38, z0 + 0.4), "neck")
    h.ball(0.095, (0, -0.21, z0 + 0.43), c, u=16, v=11)
    h.ball(1.0, (0, -0.33, z0 + 0.405), "orange", sc=(0.06, 0.08, 0.022), u=12, v=6); h.ball(1.0, (0, -0.32, z0 + 0.385), "orange_dk", sc=(0.05, 0.065, 0.014), u=10, v=5)
    for sg in (-1, 1): eye(h, (sg * 0.07, -0.26, z0 + 0.46), 0.022, None, sg)
    biped_walk(r, 0.6, 0.4, 0.015, 0.0, roll=0.16)
    @r.clip("Idle", 5.0)
    def idle(t):
        preen = smooth(min(1.0, max(0.0, (t - 0.4) / 0.08))) * smooth(min(1.0, max(0.0, (0.75 - t) / 0.08)))
        look = hold(t, [(0.0, 0.0), (0.15, 0.4), (0.3, 0.0), (0.85, -0.4)])
        return {"neck": {"y": look * 0.5 + 1.1 * preen, "p": 0.3 * preen}, "head": {"y": look * 0.5 + 0.8 * preen, "p": 0.4 * preen + 0.1 * preen * sin(tau * 6 * t)},
                "wingL": {"r": 0.15 * preen}, "tail": {"y": 0.3 * blip(t, 0.9, 0.04) - 0.3 * blip(t, 0.95, 0.04)}}
    @r.clip("Swim", 2.0)
    def swim(t):
        a = sin(tau * t)
        return {"root": {"z": -(z0 + 0.04) + 0.008 * sin(2 * tau * t)}, "body": {"p": 0.03 * sin(tau * t)},
                "legL": {"p": 0.6 + 0.45 * a}, "legR": {"p": 0.6 - 0.45 * a},                                      # under the water: push back, swing forward
                "footL": {"p": 0.4 * max(0.0, -cos(tau * t))}, "footR": {"p": 0.4 * max(0.0, cos(tau * t))},
                "neck": {"p": -0.05 * sin(tau * t)}, "tail": {"y": 0.15 * sin(2 * tau * t)}}
    r.statics = {"KL_Duck": ("Idle", 0.0), "KL_Duck_Swim": ("Swim", 0.0)}
    return r

# ---------------------------------------------------------------- in the air: bird, butterfly
@creature
def bird():
    r = Rig("Bird"); c = A("blue"); body = tn(c, 0.3, 0.8, 0.3); z = 0.13
    r.bone("root", (0, 0, 0), (0, 0, 0.05))
    for nm, sx in (("legL", 1), ("legR", -1)):
        l = r.bone(nm, (sx * 0.04, 0.0, 0.06), (sx * 0.04, 0.0, 0.0), "root")
        l.cyl(0.008, 0.06, (sx * 0.04, 0.0, 0), "gold", seg=6); l.ball(1.0, (sx * 0.04, -0.015, 0.006), "gold", sc=(0.022, 0.03, 0.006), u=8, v=4)
    b = r.bone("body", (0, 0.01, 0.06), (0, 0.01, 0.2), "root")
    b.ball(1.0, (0, 0.01, z), body, sc=(0.12, 0.15, 0.12), u=18, v=12)
    b.ball(1.0, (0, -0.045, z - 0.025), "cream", sc=(0.09, 0.1, 0.085), u=14, v=9)
    h = r.bone("head", (0, -0.06, z + 0.05), (0, -0.18, z + 0.04), "body")
    cone(h, 0.032, 0.075, (0, -0.145, z + 0.03), "gold", rot=(pi / 2, 0, 0), seg=8)
    for sg in (-1, 1): eye(h, (sg * 0.07, -0.11, z + 0.055), 0.022, None, sg)
    h.ball(0.035, (0, -0.02, z + 0.12), A("blue", "lt"), sc=(0.7, 1.2, 1), u=8, v=6)
    for nm, sg in (("wingL", 1), ("wingR", -1)):
        w = r.bone(nm, (sg * 0.09, 0.0, z + 0.03), (sg * 0.4, 0.0, z + 0.03), "body")
        w.prism([(0.0, -0.07), (0.16, -0.1), (0.3, -0.04), (0.33, 0.03), (0.2, 0.06), (0.0, 0.07)], 0.022, A("blue", "dk"),
                mtx=Matrix.Translation((sg * 0.09, 0.0, z + 0.03)) @ Matrix.Scale(sg, 4, (1, 0, 0)))
    t = r.bone("tail", (0, 0.1, z + 0.02), (0, 0.25, z + 0.06), "body")
    t.prism([(-0.035, 0), (0.035, 0), (0.05, 0.15), (-0.05, 0.15)], 0.018, A("blue", "dk"), mtx=Matrix.Translation((0, 0.1, z + 0.02)) @ Matrix.Rotation(0.35, 4, "X"))
    FOLD = {"wingL": {"y": 1.5, "r": 0.35}, "wingR": {"y": -1.5, "r": -0.35}}        # folded along the body when perched
    @r.clip("Idle", 3.0)
    def idle(t):
        look = hold(t, [(0.0, 0.0), (0.2, 0.7), (0.4, -0.5), (0.65, 0.2), (0.8, -0.2)])
        v = dict(FOLD); v["head"] = {"y": look, "r": 0.2 * look}; v["tail"] = {"p": -0.3 * blip(t, 0.5, 0.04)}
        return v
    @r.clip("Hop", 0.5)
    def hop(t):
        v = dict(FOLD); up = sin(pi * t); v["root"] = {"z": 0.08 * up, "f": 0.0}; v["legL"] = {"p": 0.5 * up}; v["legR"] = {"p": 0.5 * up}; v["tail"] = {"p": -0.3 * up}
        return v
    @r.clip("Fly", 0.4)
    def fly(t):
        a = sin(tau * t)
        return {"wingL": {"r": -0.9 * a}, "wingR": {"r": 0.9 * a}, "body": {"z": 0.02 * a, "p": -0.1}, "legL": {"p": 0.9}, "legR": {"p": 0.9}, "tail": {"p": -0.1 * a}}
    r.statics = {"KL_Bird": ("Idle", 0.0), "KL_Bird_Fly": ("Fly", 0.0)}
    return r

@creature
def butterfly():
    import klife
    r = Rig("Butterfly")
    b = r.bone("body", (0, 0.08, 0), (0, -0.1, 0))
    klife._bfly_body(b)
    for nm, sg in (("wingL", 1), ("wingR", -1)):
        w = r.bone(nm, (0, 0, 0), (sg * 0.2, 0, 0), "body")
        klife._wing(w, Matrix.Scale(sg, 4, (1, 0, 0)) @ Matrix.Translation((0.012, 0, 0)))
    @r.clip("Fly", 0.24)
    def fly(t):
        a = cos(tau * t)
        return {"wingL": {"r": -(0.2 + 1.0 * (a + 1) / 2)}, "wingR": {"r": 0.2 + 1.0 * (a + 1) / 2}, "body": {"z": 0.015 * sin(tau * t)}}
    @r.clip("Rest", 3.0)
    def rest(t):
        o = 0.6 + 0.6 * (0.5 - 0.5 * cos(tau * t))
        return {"wingL": {"r": -o}, "wingR": {"r": o}}
    r.statics = {}
    return r
