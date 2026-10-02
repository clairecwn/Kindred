"""
build_characters.py — authors the whole Kindred cast in Blender (as a
Python module: `python3 tools/blender/build_characters.py`, bpy imported
directly, no Blender UI) and exports rigged .glb into public/models/.

What one character is made of:
  Body     one voxel-fused watertight mesh (torso + arms + mitts + legs +
           foot pads + neck + head ball + cheeks), skinned to the 22-bone
           rig with automatic weights. Fusing is what stops the character
           reading as a pile of intersecting spheres.
  Muzzle / Belly / EarInner  light-tone accent meshes, rigid-weighted.
  Ears / Tail / Nose / Eyes / Pupils / Shines  crisp separate meshes,
           rigid-weighted to Head / Tail_01 / Tail_02.
Garments are built by build_wardrobe_glb() against the SAME armature and
exported to public/models/kindred_wardrobe.glb, so the runtime can rebind
any garment onto any character's skeleton by bone name.

Run:  python3 tools/blender/build_characters.py [--species fox,bear] [--render]
"""

import argparse
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector, Matrix  # noqa: E402

import geom  # noqa: E402
from geom import ellipsoid, loft, tube, cone, join, fuse, tri_count, finish, new_mesh  # noqa: E402
from rig import BONES, BONE_LIST, SOCKETS, AVATAR_HEIGHT, to_blender, world_rest, dump_spec  # noqa: E402
from species_defs import SPECIES, SPECIES_LIST  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_DIR = os.path.join(REPO, "public", "models")
RENDER_DIR = os.path.join(HERE, "renders")

REST = {n: world_rest(n) for n in BONE_LIST}


# ── scene / material plumbing ─────────────────────────────────────────
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.scale_length = 1.0


def hexcol(h):
    def srgb(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (srgb((h >> 16) & 255), srgb((h >> 8) & 255), srgb(h & 255), 1.0)


def mat(name, hexval, unlit=False):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hexcol(hexval)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.85
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.1
    if unlit and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = hexcol(hexval)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return m


def set_mat(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


# ── body construction ─────────────────────────────────────────────────
def build_body_parts(p):
    """Everything that gets voxel-fused into the single Body mesh.

    Shape language: one pear-shaped torso mass, arms that swing OUT and
    down so there is a real gap between arm and body (that gap is what
    makes the silhouette readable), short thick legs, and a head ball
    that is deliberately the largest single form in the character.
    """
    parts = []
    chest, waist, hip = p["chest"], p["waist"], p["hip"]

    # Torso: hips -> waist -> chest -> shoulder shelf, as one tapered mass.
    parts.append(tube("Torso", [
        ((0.0, 0.38, 0.0),  0.180 * hip,   0.170 * hip),
        ((0.0, 0.48, 0.0),  0.222 * hip,   0.200 * hip),
        ((0.0, 0.58, 0.0),  0.215 * waist, 0.194 * waist),
        ((0.0, 0.68, 0.0),  0.218 * chest, 0.196 * chest),
        ((0.0, 0.78, 0.0),  0.210 * chest, 0.190 * chest),
        ((0.0, 0.86, 0.0),  0.150 * chest, 0.140 * chest),
    ], segs=24))

    # Neck stub -> head ball: one connected mass, never a floating head.
    parts.append(tube("Neck", [
        ((0.0, 0.82, 0.0), 0.118, 0.110),
        ((0.0, 0.99, 0.0), 0.145, 0.140),
    ], segs=18))

    hr = p["head"]
    hy = p["headY"]
    parts.append(ellipsoid("HeadBall", (0.0, hy, 0.005), hr, segs=32, rings=22))
    # Jaw/cheek mass: widens the lower head so the face is chunky, and
    # gives the muzzle a surface to seat into.
    parts.append(ellipsoid("Cheeks", (0.0, hy - 0.085, 0.050),
                           (hr[0] * 0.92, hr[1] * 0.62, hr[2] * 0.93), segs=24, rings=16))

    # Arms: from the shoulder shelf, angled outward, ending in a mitt.
    at = p["armT"]
    for s in (1, -1):
        parts.append(tube("Arm", [
            ((s * 0.195, 0.800, 0.0), 0.108 * at, 0.106 * at),
            ((s * 0.278, 0.735, 0.0), 0.099 * at, 0.098 * at),
            ((s * 0.322, 0.615, 0.0), 0.088 * at, 0.089 * at),
            ((s * 0.340, 0.515, 0.0), 0.084 * at, 0.086 * at),
        ], segs=18))
        parts.append(ellipsoid("Mitt", (s * 0.348, 0.442, 0.012),
                               (0.100 * at, 0.112 * at, 0.098 * at), segs=18, rings=14))

    # Legs: short thick columns + a forward-pointing foot pad.
    lt = p["legT"]
    for s in (1, -1):
        parts.append(tube("Leg", [
            ((s * 0.110, 0.480, 0.0), 0.124 * lt, 0.120 * lt),
            ((s * 0.118, 0.350, 0.0), 0.116 * lt, 0.114 * lt),
            ((s * 0.122, 0.200, 0.0), 0.108 * lt, 0.110 * lt),
            ((s * 0.124, 0.115, 0.0), 0.104 * lt, 0.112 * lt),
        ], segs=18))
        parts.append(ellipsoid("Foot", (s * 0.126, 0.068, 0.070),
                               (0.115 * lt, 0.070, 0.165 * lt), segs=20, rings=14))
    return parts


def build_face(p, skin_l, ink, white, pupil, shine):
    objs = []
    hy = p["headY"]
    hr = p["head"]
    mz = p["muzzle"]
    mzY = p["muzzleY"] - 0.055
    muzzle = ellipsoid("Muzzle", (0.0, hy + mzY, hr[2] * 0.78),
                       (mz[0] * 1.18, mz[1] * 1.10, mz[2] * 1.20), segs=22, rings=16)
    set_mat(muzzle, skin_l)
    objs.append(("Muzzle", muzzle, "Head"))

    nose = ellipsoid("Nose", (0.0, hy + mzY + 0.030, hr[2] * 0.78 + mz[2] * 0.92),
                     (0.050, 0.041, 0.042), segs=14, rings=10)
    set_mat(nose, ink)
    objs.append(("Nose", nose, "Head"))

    # Eyes: oversized, forward-facing, high contrast. The single biggest
    # appeal lever, per the Design Bible's "eyes tell everything".
    ex = hr[0] * 0.42
    ey = hy - 0.018
    ez = hr[2] * 0.78
    eyes, pupils, shines, patches, rings = [], [], [], [], []
    for s in (1, -1):
        # Dark ink ring behind each eye. Without it the sclera has no
        # contrast on a pale character (rabbit, panda) and the pupil has
        # none on a dark one (bear, otter) — the ring gives every species
        # the same guaranteed light/dark/light read from any distance,
        # and is the "dark rim" the style calls for.
        rings.append(ellipsoid("Ring", (s * ex, ey, ez - 0.012),
                               (0.114, 0.132, 0.062), segs=20, rings=14))
        eyes.append(ellipsoid("Eye", (s * ex, ey, ez), (0.088, 0.104, 0.066), segs=20, rings=14))
        pupils.append(ellipsoid("Pupil", (s * ex + s * 0.007, ey - 0.005, ez + 0.040),
                                (0.048, 0.060, 0.046), segs=18, rings=12))
        shines.append(ellipsoid("Shine", (s * ex - 0.023, ey + 0.038, ez + 0.062),
                                (0.021, 0.023, 0.018), segs=10, rings=8))
        if p.get("eyePatch"):
            patches.append(ellipsoid("Patch", (s * ex + s * 0.014, ey - 0.006, ez - 0.030),
                                     (0.150, 0.166, 0.080), segs=18, rings=12))
    rg = join(rings, "EyeRings"); set_mat(rg, ink); objs.append(("EyeRings", rg, "Head"))
    e = join(eyes, "Eyes"); set_mat(e, white); objs.append(("Eyes", e, "Head"))
    pu = join(pupils, "Pupils"); set_mat(pu, pupil); objs.append(("Pupils", pu, "Head"))
    sh = join(shines, "Shines"); set_mat(sh, shine); objs.append(("Shines", sh, "Head"))
    if patches:
        pa = join(patches, "EyePatches"); set_mat(pa, ink); objs.append(("EyePatches", pa, "Head"))

    # Mouth: two short dark strokes meeting under the nose — a soft
    # closed smile, not an open cartoon grin.
    strokes = []
    for s2 in (1, -1):
        strokes.append(tube("M", [
            ((0.0, hy + mzY - 0.022, hr[2] * 0.78 + mz[2] * 0.86),
             0.013, 0.013),
            ((s2 * 0.036, hy + mzY - 0.044, hr[2] * 0.78 + mz[2] * 0.70),
             0.012, 0.012),
            ((s2 * 0.058, hy + mzY - 0.042, hr[2] * 0.78 + mz[2] * 0.50),
             0.009, 0.009),
        ], segs=8))
    mouth = join(strokes, "Mouth")
    set_mat(mouth, ink)
    objs.append(("Mouth", mouth, "Head"))
    return objs


def build_ears(p, skin, skin_l):
    hy, hr = p["headY"], p["head"]
    kind, size = p["ear"], p["earSize"]
    outer, inner = [], []
    for s in (1, -1):
        if kind == "long":            # tall upright ears — rabbit
            b = (s * hr[0] * 0.34, hy + hr[1] * 0.76, -0.015)
            outer.append(tube("Ear", [
                (b, 0.052 * size, 0.036 * size),
                ((b[0] + s * 0.030, b[1] + 0.15, -0.030), 0.066 * size, 0.040 * size),
                ((b[0] + s * 0.058, b[1] + 0.30, -0.050), 0.058 * size, 0.036 * size),
                ((b[0] + s * 0.074, b[1] + 0.40, -0.065), 0.016 * size, 0.012 * size),
            ], segs=14))
            inner.append(tube("EarIn", [
                ((b[0], b[1] + 0.04, 0.005), 0.030 * size, 0.020 * size),
                ((b[0] + s * 0.052, b[1] + 0.28, -0.030), 0.032 * size, 0.020 * size),
                ((b[0] + s * 0.064, b[1] + 0.35, -0.042), 0.012 * size, 0.008 * size),
            ], segs=12))
        elif kind == "triangle":      # sharp upright triangles — fox, cat
            b = (s * hr[0] * 0.55, hy + hr[1] * 0.62, -0.02)
            t = (s * hr[0] * 0.82, hy + hr[1] * 0.62 + 0.21 * size, -0.055)
            outer.append(cone("Ear", b, t, 0.090 * size, 0.055 * size, segs=14))
            inner.append(cone("EarIn", (b[0], b[1] + 0.015, b[2] + 0.030),
                              (t[0] * 0.94, t[1] - 0.045, t[2] + 0.030),
                              0.050 * size, 0.026 * size, segs=12))
        elif kind == "floppy":        # ears hanging past the jaw — dog
            b = (s * hr[0] * 0.82, hy + hr[1] * 0.34, -0.01)
            outer.append(tube("Ear", [
                (b, 0.055 * size, 0.046 * size),
                ((b[0] + s * 0.042, b[1] - 0.10, 0.010), 0.074 * size, 0.050 * size),
                ((b[0] + s * 0.040, b[1] - 0.21, 0.030), 0.062 * size, 0.042 * size),
                ((b[0] + s * 0.030, b[1] - 0.27, 0.045), 0.024 * size, 0.018 * size),
            ], segs=14))
        elif kind == "round":         # big flat discs — bear, panda
            b = (s * hr[0] * 0.68, hy + hr[1] * 0.74, -0.025)
            outer.append(ellipsoid("Ear", b, (0.090 * size, 0.090 * size, 0.044 * size),
                                   segs=18, rings=12))
            inner.append(ellipsoid("EarIn", (b[0], b[1], b[2] + 0.028),
                                   (0.052 * size, 0.052 * size, 0.030 * size), segs=14, rings=10))
        else:                         # "tiny" — otter, hedgehog
            b = (s * hr[0] * 0.82, hy + hr[1] * 0.48, -0.035)
            outer.append(ellipsoid("Ear", b, (0.052 * size, 0.048 * size, 0.034 * size),
                                   segs=14, rings=10))
    res = []
    o = join(outer, "Ears"); set_mat(o, skin); res.append(("Ears", o, "Head"))
    if inner:
        i = join(inner, "EarsInner"); set_mat(i, skin_l); res.append(("EarsInner", i, "Head"))
    return res


def build_tail(p, skin, skin_l):
    kind, sc = p["tail"], p["tailScale"]
    if kind == "none":
        return []
    ty, tz = 0.50, -0.16
    if kind == "sweep":               # one huge sweeping brush — fox
        o = tube("Tail", [
            ((0.0, ty - 0.04, tz + 0.05), 0.088, 0.088),
            ((0.0, ty - 0.03, tz - 0.09 * sc), 0.126 * sc, 0.122 * sc),
            ((0.0, ty + 0.06, tz - 0.17 * sc), 0.146 * sc, 0.140 * sc),
            ((0.0, ty + 0.20, tz - 0.20 * sc), 0.136 * sc, 0.130 * sc),
            ((0.0, ty + 0.34, tz - 0.18 * sc), 0.096 * sc, 0.092 * sc),
            ((0.0, ty + 0.44, tz - 0.13 * sc), 0.040 * sc, 0.038 * sc),
        ], segs=18)
    elif kind == "poof":              # cotton puff — rabbit
        o = ellipsoid("Tail", (0.0, ty - 0.02, tz - 0.04 * sc),
                      (0.098 * sc, 0.098 * sc, 0.090 * sc), segs=18, rings=14)
    elif kind == "paddle":            # flat rudder — otter
        o = tube("Tail", [
            ((0.0, ty - 0.02, tz + 0.03), 0.078, 0.072),
            ((0.0, ty - 0.10, tz - 0.14 * sc), 0.105 * sc, 0.044),
            ((0.0, ty - 0.16, tz - 0.30 * sc), 0.090 * sc, 0.036),
            ((0.0, ty - 0.19, tz - 0.40 * sc), 0.036 * sc, 0.022),
        ], segs=16)
    elif kind == "whip":              # long thin tail, curled tip — cat
        o = tube("Tail", [
            ((0.0, ty, tz + 0.03), 0.050, 0.050),
            ((0.0, ty + 0.14 * sc, tz - 0.10 * sc), 0.044, 0.044),
            ((0.0, ty + 0.32 * sc, tz - 0.06 * sc), 0.040, 0.040),
            ((0.0, ty + 0.42 * sc, tz + 0.06), 0.032, 0.032),
        ], segs=12)
    elif kind == "curl":              # tight curl over the back — dog
        o = tube("Tail", [
            ((0.0, ty, tz + 0.03), 0.058, 0.058),
            ((0.0, ty + 0.15, tz - 0.05), 0.052, 0.052),
            ((0.0, ty + 0.26, tz + 0.05), 0.044, 0.044),
            ((0.0, ty + 0.24, tz + 0.12), 0.030, 0.030),
        ], segs=12)
    else:                             # stub — bear, panda
        o = ellipsoid("Tail", (0.0, ty - 0.01, tz - 0.01),
                      (0.072 * sc, 0.064 * sc, 0.062 * sc), segs=14, rings=10)
    set_mat(o, skin)
    return [("Tail", o, "Tail_01")]


def build_quills(p, ink):
    """Hedgehog's signature: a crown of quills shelled over the skull."""
    hy, hr = p["headY"], p["head"]
    parts = []
    for i in range(16):
        a = (i / 16.0) * math.tau
        ring = 0.50 + 0.40 * ((i % 3) / 2.0)
        bx = math.cos(a) * hr[0] * ring
        bz = math.sin(a) * hr[2] * ring - 0.04
        by = hy + hr[1] * (0.70 - 0.22 * ring)
        parts.append(cone("Q", (bx, by, bz), (bx * 1.7, by + 0.16, bz * 1.7 - 0.06),
                          0.038, 0.038, segs=8))
    o = join(parts, "Quills")
    set_mat(o, ink)
    return [("Quills", o, "Head")]


# ── armature ──────────────────────────────────────────────────────────
def build_armature(name="Armature"):
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = {}
    children = {}
    for (n, parent, _o) in BONES:
        children.setdefault(parent, []).append(n)
    for (n, parent, _o) in BONES:
        eb = arm_data.edit_bones.new(n)
        head = Vector(to_blender(REST[n]))
        kids = children.get(n, [])
        if kids:
            tail = Vector(to_blender(REST[kids[0]]))
            if (tail - head).length < 0.02:
                tail = head + Vector((0, 0, 0.05))
        else:
            # leaf bone: continue the direction it came from
            ph = Vector(to_blender(REST[parent])) if parent else head - Vector((0, 0, 0.08))
            d = (head - ph)
            d = d.normalized() * 0.09 if d.length > 1e-4 else Vector((0, 0, 0.09))
            tail = head + d
        eb.head = head
        eb.tail = tail
        ebs[n] = eb
    for (n, parent, _o) in BONES:
        if parent:
            ebs[n].parent = ebs[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def add_sockets(arm):
    """Socket empties parented to their bone, exported as glTF nodes."""
    out = []
    for sname, (bone, off) in SOCKETS.items():
        e = bpy.data.objects.new(sname, None)
        e.empty_display_size = 0.04
        bpy.context.collection.objects.link(e)
        if bone == "Root":
            e.parent = arm
            e.location = Vector(to_blender(off))
        else:
            world = REST[bone]
            e.parent = arm
            e.parent_type = "BONE"
            e.parent_bone = bone
            # bone-parenting anchors at the bone TAIL, so express the
            # offset relative to that instead of the bone head.
            tail = arm.data.bones[bone].tail_local
            head_v = Vector(to_blender(world))
            target = head_v + Vector(to_blender(off))
            e.matrix_parent_inverse = Matrix.Identity(4)
            e.location = target - tail
        out.append(e)
    return out


def rigid_weight(obj, arm, bone_name):
    """100% weight to one bone — used for crisp parts (eyes, ears, tail)
    that must not smear across joints."""
    vg = obj.vertex_groups.new(name=bone_name)
    vg.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")
    m = obj.modifiers.new("Armature", "ARMATURE")
    m.object = arm
    obj.parent = arm


def auto_weight(obj, arm):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")


# ── one character ─────────────────────────────────────────────────────
def build_character(sid, render=False):
    reset_scene()
    p = SPECIES[sid]
    m_skin = mat("mat_skin", p["skin"])
    m_light = mat("mat_skin_light", p["light"])
    m_ink = mat("mat_ink", p["ink"])
    m_white = mat("mat_eye_white", 0xFFFBF2, unlit=True)
    m_pupil = mat("mat_eye_pupil", 0x241A12, unlit=True)
    m_shine = mat("mat_eye_shine", 0xFFFFFF, unlit=True)

    arm = build_armature()

    parts = build_body_parts(p)
    body = join(parts, "Body")
    fuse(body, voxel=0.0090, target_tris=7000)
    set_mat(body, m_skin)

    extras = []
    extras += build_face(p, m_light, m_ink, m_white, m_pupil, m_shine)
    extras += build_ears(p, m_skin, m_light)
    extras += build_tail(p, m_skin, m_light)
    if p.get("quills"):
        extras += build_quills(p, m_ink)
    if p.get("belly"):
        b = ellipsoid("Belly", (0.0, 0.605, 0.128 * p["chest"]),
                      (0.128 * p["chest"], 0.170, 0.072 * p["chest"]), segs=20, rings=14)
        set_mat(b, m_light)
        extras.append(("Belly", b, "Spine_01"))

    auto_weight(body, arm)
    for (_name, obj, bone) in extras:
        rigid_weight(obj, arm, bone)

    sockets = add_sockets(arm)
    bpy.context.view_layer.update()

    total = tri_count(body) + sum(tri_count(o) for (_n, o, _b) in extras)
    out = os.path.join(OUT_DIR, "kindred_%s.glb" % sid)
    export([arm, body] + [o for (_n, o, _b) in extras] + sockets, out)
    if render:
        render_turnaround(sid)
    return out, total


# ── export / render ───────────────────────────────────────────────────
def export(objects, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_skins=True,
        export_animations=False,
        export_materials="EXPORT",
        export_texcoords=False,
        export_normals=True,
        export_extras=False,
    )


def render_turnaround(label, angles=(0, 90, 180), width=360, height=520):
    os.makedirs(RENDER_DIR, exist_ok=True)
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"   # CPU Cycles: no GPU/EGL in this container
    scn.cycles.device = "CPU"
    scn.cycles.samples = 24
    scn.cycles.use_denoising = True
    scn.render.resolution_x = width
    scn.render.resolution_y = height
    scn.render.film_transparent = False
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = hexcol(0xF6E7CE)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.4
    scn.world = world
    # golden-hour key + cool fill, per the Design Bible's lighting rules
    for (loc, energy, col) in (((2.6, -3.2, 3.4), 900, 0xFFEFD2),
                               ((-3.0, -2.0, 1.6), 300, 0xD6E4FF),
                               ((0.0, 3.4, 2.4), 260, 0xFFD4BB)):
        lt = bpy.data.lights.new("L", "POINT")
        lt.energy = energy
        lt.color = hexcol(col)[:3]
        lt.shadow_soft_size = 1.2
        lo = bpy.data.objects.new("L", lt)
        lo.location = loc
        bpy.context.collection.objects.link(lo)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 60
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scn.camera = cam
    for a in angles:
        r = math.radians(a)
        dist = 3.1
        cam.location = (math.sin(r) * dist, -math.cos(r) * dist, 0.95)
        direction = Vector((0, 0, 0.78)) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scn.render.filepath = os.path.join(RENDER_DIR, "%s_%03d.png" % (label, a))
        bpy.ops.render.render(write_still=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--species", default=",".join(SPECIES_LIST))
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--no-wardrobe", action="store_true")
    args = ap.parse_args()
    dump_spec(os.path.join(HERE, "rig_spec.json"))
    for sid in args.species.split(","):
        sid = sid.strip()
        if not sid:
            continue
        path, tris = build_character(sid, render=args.render)
        print("built %-9s %6d tris -> %s" % (sid, tris, os.path.relpath(path, REPO)))
    if not args.no_wardrobe:
        import build_wardrobe_glb
        build_wardrobe_glb.main(render=args.render)


if __name__ == "__main__":
    main()
