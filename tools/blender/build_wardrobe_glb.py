"""
build_wardrobe_glb.py — real 3D clothing for the Kindred cast.

Every garment is a SEPARATE mesh weighted to the SAME 22-bone armature the
characters use (rig.py), exported together into
public/models/kindred_wardrobe.glb. The runtime clones a garment and
rebinds it, by bone name, onto whichever character is wearing it, so one
garment fits the whole cast and moves with the body instead of floating.

Rig first, garments second — garments are lofted from the same torso /
limb / head profiles build_characters.py uses, offset outwards by a fixed
clearance, so a top can never end up buried inside the body it is worn on.

Materials: exactly two tintable slots per garment, mat_main and mat_trim,
so colourways are a runtime tint and cost no extra geometry.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import build_characters as BC  # noqa: E402
from geom import ellipsoid, tube, cone, join, tri_count  # noqa: E402
from rig import BONES, BONE_LIST, world_rest  # noqa: E402

REST = {n: world_rest(n) for n in BONE_LIST}
CLEAR = 0.022            # garment clearance over the reference body
REF = 1.08               # cut for the widest body in the cast (species widths
                         # are clamped to 1.00-1.12 in species_defs.py so one
                         # set of garments fits every character)


def torso_shell(name, y0, y1, extra=0.0, segs=22):
    """A shell following the reference torso profile between two heights."""
    prof = [
        (0.38, 0.180, 0.170),
        (0.48, 0.222, 0.200),
        (0.58, 0.215, 0.194),
        (0.68, 0.218, 0.196),
        (0.78, 0.210, 0.190),
        (0.86, 0.150, 0.140),
    ]
    path = []
    for (y, rx, rz) in prof:
        if y < y0 - 0.001 or y > y1 + 0.001:
            continue
        path.append(((0.0, y, 0.0), rx * REF + CLEAR + extra, rz * REF + CLEAR + extra))
    if len(path) < 2:
        path = [((0.0, y0, 0.0), 0.22 + extra), ((0.0, y1, 0.0), 0.22 + extra)]
        path = [(p, r, r) for (p, r) in path]
    return tube(name, path, segs=segs)


def sleeve(name, s, y_end, r0=0.144, r1=0.126):
    return tube(name, [
        ((s * 0.195, 0.800, 0.0), r0, r0),
        ((s * 0.278, 0.735, 0.0), r0 * 0.94, r0 * 0.94),
        ((s * 0.322, 0.615, 0.0), r1, r1),
        ((s * 0.340, y_end, 0.0), r1 * 0.96, r1 * 0.96),
    ], segs=14)


def leg_shell(name, s, y0, y1, r=0.160):
    return tube(name, [
        ((s * 0.110, y0, 0.0), r, r),
        ((s * 0.120, (y0 + y1) / 2, 0.0), r * 0.94, r * 0.94),
        ((s * 0.124, y1, 0.0), r * 0.90, r * 0.94),
    ], segs=14)


HEAD_Y = 1.175
HEAD_R = 0.31
HEAD_TOP = HEAD_Y + 0.30   # crown of the reference head; hats are laid out from here


# ── garment builders: (main parts, trim parts, bone for rigid parts) ────
def g_hoodie():
    main = [torso_shell("body", 0.47, 0.86)]
    main += [sleeve("sl", s, 0.50) for s in (1, -1)]
    # hood roll sitting on the shoulders, behind the head
    main.append(tube("hood", [
        ((0.0, 0.86, -0.02), 0.155, 0.150),
        ((0.0, 0.96, -0.09), 0.215, 0.185),
        ((0.0, 1.08, -0.14), 0.225, 0.180),
        ((0.0, 1.16, -0.13), 0.150, 0.120),
    ], segs=18))
    trim = [tube("hem", [((0.0, 0.455, 0.0), 0.245, 0.222), ((0.0, 0.50, 0.0), 0.252, 0.230)], segs=22)]
    trim += [tube("cuff", [((s * 0.336, 0.487, 0.0), 0.140, 0.140),
                           ((s * 0.340, 0.520, 0.0), 0.140, 0.140)], segs=14) for s in (1, -1)]
    trim.append(tube("pocket", [((0.0, 0.52, 0.150), 0.135, 0.075), ((0.0, 0.60, 0.150), 0.135, 0.075)], segs=16))
    return main, trim


def g_linen():
    main = [torso_shell("body", 0.47, 0.86)]
    main += [sleeve("sl", s, 0.66, r0=0.148, r1=0.142) for s in (1, -1)]
    trim = [tube("collar", [((0.0, 0.80, 0.0), 0.185, 0.172), ((0.0, 0.865, 0.0), 0.172, 0.160)], segs=20)]
    trim.append(tube("hem", [((0.0, 0.455, 0.0), 0.248, 0.226), ((0.0, 0.49, 0.0), 0.252, 0.230)], segs=22))
    return main, trim


def g_vest():
    main = [torso_shell("body", 0.50, 0.84)]
    trim = [tube("placket", [((0.0, 0.50, 0.190), 0.040, 0.055), ((0.0, 0.84, 0.175), 0.040, 0.055)], segs=10)]
    trim.append(tube("collar", [((0.0, 0.78, 0.0), 0.195, 0.182), ((0.0, 0.845, 0.0), 0.178, 0.166)], segs=20))
    return main, trim


def g_kimono():
    main = [torso_shell("body", 0.47, 0.86)]
    main += [sleeve("sl", s, 0.56, r0=0.172, r1=0.172) for s in (1, -1)]
    main.append(tube("skirt", [((0.0, 0.30, 0.0), 0.265, 0.240), ((0.0, 0.47, 0.0), 0.250, 0.228)], segs=22))
    trim = [tube("sash", [((0.0, 0.555, 0.0), 0.252, 0.230), ((0.0, 0.615, 0.0), 0.252, 0.230)], segs=22)]
    trim.append(tube("lapel", [((0.0, 0.50, 0.195), 0.055, 0.060), ((0.0, 0.86, 0.150), 0.055, 0.060)], segs=10))
    return main, trim


def g_overalls():
    main = [tube("bib", [((0.0, 0.60, 0.150), 0.125, 0.080), ((0.0, 0.80, 0.140), 0.120, 0.080)], segs=16)]
    main.append(torso_shell("waist", 0.38, 0.58))
    main += [leg_shell("leg", s, 0.22, 0.50) for s in (1, -1)]
    main += [tube("strap", [((s * 0.085, 0.795, 0.145), 0.032, 0.030),
                            ((s * 0.135, 0.855, 0.020), 0.032, 0.030),
                            ((s * 0.120, 0.800, -0.140), 0.032, 0.030)], segs=10) for s in (1, -1)]
    trim = [ellipsoid("btn_%d" % i, (s * 0.095, 0.795, 0.185), (0.026, 0.026, 0.018), segs=10, rings=8)
            for i, s in enumerate((1, -1))]
    trim.append(tube("cuff", [((0.0, 0.215, 0.0), 0.0, 0.0)], segs=4) if False else
                tube("hem", [((0.0, 0.375, 0.0), 0.252, 0.232), ((0.0, 0.41, 0.0), 0.252, 0.232)], segs=20))
    return main, trim


def g_shorts():
    main = [torso_shell("waist", 0.38, 0.52)]
    main += [leg_shell("leg", s, 0.315, 0.47, r=0.166) for s in (1, -1)]
    trim = [tube("band", [((0.0, 0.505, 0.0), 0.258, 0.238), ((0.0, 0.545, 0.0), 0.256, 0.236)], segs=20)]
    return main, trim


def g_trousers():
    main = [torso_shell("waist", 0.38, 0.52)]
    main += [leg_shell("leg", s, 0.135, 0.47, r=0.158) for s in (1, -1)]
    trim = [tube("band", [((0.0, 0.505, 0.0), 0.258, 0.238), ((0.0, 0.545, 0.0), 0.256, 0.236)], segs=20)]
    trim += [tube("cuff", [((s * 0.124, 0.125, 0.0), 0.135, 0.138),
                           ((s * 0.124, 0.165, 0.0), 0.135, 0.138)], segs=14) for s in (1, -1)]
    return main, trim


def g_skirt():
    main = [tube("skirt", [((0.0, 0.28, 0.0), 0.300, 0.275),
                           ((0.0, 0.40, 0.0), 0.268, 0.246),
                           ((0.0, 0.52, 0.0), 0.250, 0.230)], segs=22)]
    trim = [tube("band", [((0.0, 0.515, 0.0), 0.256, 0.236), ((0.0, 0.555, 0.0), 0.254, 0.234)], segs=20)]
    return main, trim


def g_leggings():
    main = [torso_shell("waist", 0.40, 0.52)]
    main += [leg_shell("leg", s, 0.125, 0.47, r=0.146) for s in (1, -1)]
    trim = [tube("band", [((0.0, 0.505, 0.0), 0.252, 0.232), ((0.0, 0.540, 0.0), 0.250, 0.230)], segs=20)]
    return main, trim


def g_beanie():
    main = [tube("cap", [
        ((0.0, HEAD_Y + 0.100, 0.0), HEAD_R * 1.03, HEAD_R * 1.00),
        ((0.0, HEAD_TOP - 0.075, 0.0), HEAD_R * 0.92, HEAD_R * 0.90),
        ((0.0, HEAD_TOP + 0.020, 0.0), HEAD_R * 0.56, HEAD_R * 0.55),
        ((0.0, HEAD_TOP + 0.065, 0.0), HEAD_R * 0.16, HEAD_R * 0.16),
    ], segs=22)]
    trim = [tube("fold", [((0.0, HEAD_Y + 0.090, 0.0), HEAD_R * 1.08, HEAD_R * 1.05),
                          ((0.0, HEAD_Y + 0.180, 0.0), HEAD_R * 1.06, HEAD_R * 1.03)], segs=22)]
    trim.append(ellipsoid("bobble", (0.0, HEAD_TOP + 0.105, 0.0), (0.060, 0.060, 0.060), segs=14, rings=10))
    return main, trim


def g_felt_hat():
    main = [tube("crown", [
        ((0.0, HEAD_Y + 0.165, 0.0), HEAD_R * 0.98, HEAD_R * 0.96),
        ((0.0, HEAD_TOP + 0.060, 0.0), HEAD_R * 0.86, HEAD_R * 0.84),
        ((0.0, HEAD_TOP + 0.110, 0.0), HEAD_R * 0.78, HEAD_R * 0.76),
    ], segs=22)]
    trim = [tube("brim", [((0.0, HEAD_Y + 0.160, 0.0), HEAD_R * 1.55, HEAD_R * 1.50),
                          ((0.0, HEAD_Y + 0.200, 0.0), HEAD_R * 1.48, HEAD_R * 1.44)], segs=24)]
    trim.append(tube("band", [((0.0, HEAD_Y + 0.203, 0.0), HEAD_R * 1.00, HEAD_R * 0.98),
                              ((0.0, HEAD_Y + 0.258, 0.0), HEAD_R * 0.99, HEAD_R * 0.97)], segs=22))
    return main, trim


def g_cap():
    main = [tube("crown", [
        ((0.0, HEAD_Y + 0.135, 0.0), HEAD_R * 1.02, HEAD_R * 1.00),
        ((0.0, HEAD_TOP - 0.050, 0.0), HEAD_R * 0.90, HEAD_R * 0.88),
        ((0.0, HEAD_TOP + 0.030, 0.0), HEAD_R * 0.48, HEAD_R * 0.48),
    ], segs=22)]
    trim = [tube("peak", [((0.0, HEAD_Y + 0.150, HEAD_R * 0.85), HEAD_R * 0.72, 0.032),
                          ((0.0, HEAD_Y + 0.135, HEAD_R * 1.55), HEAD_R * 0.54, 0.028)], segs=16)]
    return main, trim


def g_beret():
    main = [tube("disc", [
        ((0.0, HEAD_TOP - 0.075, -0.030), HEAD_R * 0.82, HEAD_R * 0.80),
        ((0.0, HEAD_TOP + 0.000, -0.050), HEAD_R * 1.18, HEAD_R * 1.10),
        ((0.0, HEAD_TOP + 0.055, -0.065), HEAD_R * 0.88, HEAD_R * 0.82),
    ], segs=22)]
    trim = [ellipsoid("nub", (0.0, HEAD_TOP + 0.090, -0.070), (0.034, 0.034, 0.034), segs=10, rings=8)]
    return main, trim


def g_crown():
    main = [tube("band", [((0.0, HEAD_TOP - 0.030, 0.0), HEAD_R * 0.80, HEAD_R * 0.78),
                          ((0.0, HEAD_TOP + 0.045, 0.0), HEAD_R * 0.76, HEAD_R * 0.74)], segs=20)]
    trim = []
    for i in range(6):
        a = (i / 6.0) * math.tau
        bx, bz = math.cos(a) * HEAD_R * 0.78, math.sin(a) * HEAD_R * 0.76
        trim.append(cone("pt", (bx, HEAD_TOP + 0.035, bz), (bx * 1.05, HEAD_TOP + 0.150, bz * 1.05),
                         0.038, 0.038, segs=8))
    return main, trim


def g_blossom_crown():
    main = [tube("ring", [((0.0, HEAD_TOP - 0.055, 0.0), HEAD_R * 0.84, HEAD_R * 0.82),
                          ((0.0, HEAD_TOP - 0.018, 0.0), HEAD_R * 0.84, HEAD_R * 0.82)], segs=20)]
    trim = []
    for i in range(8):
        a = (i / 8.0) * math.tau
        bx, bz = math.cos(a) * HEAD_R * 0.86, math.sin(a) * HEAD_R * 0.84
        trim.append(ellipsoid("pet", (bx, HEAD_TOP - 0.030, bz), (0.054, 0.038, 0.054), segs=10, rings=8))
    return main, trim


def g_scarf():
    main = [tube("loop", [((0.0, 0.845, 0.0), 0.170, 0.160),
                          ((0.0, 0.905, 0.0), 0.172, 0.162)], segs=20)]
    main.append(tube("tailA", [((0.055, 0.855, 0.120), 0.048, 0.034),
                               ((0.075, 0.740, 0.155), 0.052, 0.032),
                               ((0.070, 0.630, 0.150), 0.044, 0.028)], segs=10))
    trim = [tube("fringe", [((0.070, 0.615, 0.150), 0.046, 0.030),
                            ((0.070, 0.585, 0.148), 0.044, 0.028)], segs=10)]
    return main, trim


def g_satchel():
    main = [tube("bag", [((0.0, 0.520, -0.185), 0.145, 0.070),
                         ((0.0, 0.660, -0.190), 0.150, 0.075)], segs=16)]
    main.append(tube("strap", [((0.150, 0.660, -0.150), 0.028, 0.026),
                               ((0.140, 0.830, 0.010), 0.028, 0.026),
                               ((-0.060, 0.800, 0.175), 0.028, 0.026)], segs=10))
    trim = [tube("flap", [((0.0, 0.640, -0.195), 0.152, 0.080),
                          ((0.0, 0.690, -0.192), 0.148, 0.078)], segs=16)]
    return main, trim


def g_glasses():
    main = []
    for s in (1, -1):
        main.append(tube("rim", [
            ((s * 0.130, 1.157, 0.238), 0.098, 0.030),
            ((s * 0.130, 1.157, 0.258), 0.098, 0.030),
        ], segs=18))
    main.append(tube("bridge", [((-0.055, 1.157, 0.252), 0.014, 0.014),
                                ((0.055, 1.157, 0.252), 0.014, 0.014)], segs=8))
    trim = [tube("arm", [((s * 0.215, 1.157, 0.225), 0.014, 0.014),
                         ((s * 0.285, 1.157, 0.030), 0.014, 0.014)], segs=8) for s in (1, -1)]
    return main, trim


GARMENTS = {
    # id                  builder          bone for rigid weighting
    "body_hoodie":            (g_hoodie,   None),
    "body_floral_hoodie":     (g_hoodie,   None),
    "body_linen":             (g_linen,    None),
    "body_forest_vest":       (g_vest,     None),
    "body_kimono":            (g_kimono,   None),
    "body_overalls":          (g_overalls, None),
    "legs_shorts":            (g_shorts,   None),
    "legs_trousers":          (g_trousers, None),
    "legs_skirt":             (g_skirt,    None),
    "legs_leggings":          (g_leggings, None),
    "head_beanie":            (g_beanie,       "Head"),
    "head_felt_hat":          (g_felt_hat,     "Head"),
    "head_stargazer_cap":     (g_cap,          "Head"),
    "head_sunrise_beret":     (g_beret,        "Head"),
    "head_crown":             (g_crown,        "Head"),
    "head_cherry_blossom_crown": (g_blossom_crown, "Head"),
    "back_scarf":             (g_scarf,    "Neck"),
    "back_satchel":           (g_satchel,  "Spine_02"),
    "face_round_glasses":     (g_glasses,  "Head"),
}


def main(render=False):
    BC.reset_scene()
    arm = BC.build_armature()
    m_main = BC.mat("mat_main", 0xC96A4E)
    m_trim = BC.mat("mat_trim", 0xF6DCB6)

    objs = []
    total = 0
    for gid, (builder, bone) in GARMENTS.items():
        main_parts, trim_parts = builder()
        mo = join(main_parts, "garment_%s__main" % gid)
        BC.set_mat(mo, m_main)
        pieces = [mo]
        if trim_parts:
            to = join(trim_parts, "garment_%s__trim" % gid)
            BC.set_mat(to, m_trim)
            pieces.append(to)
        for piece in pieces:
            if bone:
                BC.rigid_weight(piece, arm, bone)
            else:
                BC.auto_weight(piece, arm)
            total += tri_count(piece)
        objs += pieces

    bpy.context.view_layer.update()
    out = os.path.join(BC.OUT_DIR, "kindred_wardrobe.glb")
    BC.export([arm] + objs, out)
    print("built wardrobe  %6d tris, %d garments -> %s"
          % (total, len(GARMENTS), os.path.relpath(out, BC.REPO)))
    return out


if __name__ == "__main__":
    main()
