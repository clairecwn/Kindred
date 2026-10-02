"""
rig.py — the single source of truth for Kindred's character rig, shared by
build_characters.py (Blender authoring) and, via the JSON it dumps
(tools/blender/rig_spec.json), by src/avatar/skeleton.js on the JS side.

Coordinate convention: every offset below is expressed in THREE.js space
(Y up, +Z forward/toward camera), because that is the space the runtime
rig and all of clips.js already live in. Blender is Z-up, so the authoring
script converts with blender = (x, -z, y) when it lays out edit bones.
"""

import json
import os

AVATAR_HEIGHT = 1.6

# name -> (parent, local offset from parent bone head, in three-space)
# Proportions: 3-heads-tall chunky mascot. Ground 0, foot bone 0.09,
# knee 0.34, hip 0.62, chest 0.86, neck 1.00, head bone 1.06 (head ball
# centre 1.30, crown 1.56).
H = AVATAR_HEIGHT
BONES = [
    ("Hips",       None,        (0.0,     0.48,  0.0)),
    ("Spine_01",   "Hips",      (0.0,     0.12,  0.0)),
    ("Spine_02",   "Spine_01",  (0.0,     0.14,  0.0)),
    ("Neck",       "Spine_02",  (0.0,     0.12,  0.0)),
    ("Head",       "Neck",      (0.0,     0.04,  0.0)),
    ("Shoulder_L", "Spine_02",  ( 0.200,  0.06,  0.0)),
    ("UpperArm_L", "Shoulder_L",( 0.060, -0.02,  0.0)),
    ("LowerArm_L", "UpperArm_L",( 0.050, -0.16,  0.0)),
    ("Hand_L",     "LowerArm_L",( 0.020, -0.14,  0.0)),
    ("Shoulder_R", "Spine_02",  (-0.200,  0.06,  0.0)),
    ("UpperArm_R", "Shoulder_R",(-0.060, -0.02,  0.0)),
    ("LowerArm_R", "UpperArm_R",(-0.050, -0.16,  0.0)),
    ("Hand_R",     "LowerArm_R",(-0.020, -0.14,  0.0)),
    ("Back",       "Spine_02",  (0.0,     0.06, -0.13)),
    ("Thigh_L",    "Hips",      ( 0.115, -0.02,  0.0)),
    ("Shin_L",     "Thigh_L",   ( 0.005, -0.225, 0.0)),
    ("Foot_L",     "Shin_L",    (0.0,    -0.160, 0.02)),
    ("Thigh_R",    "Hips",      (-0.115, -0.02,  0.0)),
    ("Shin_R",     "Thigh_R",   (-0.005, -0.225, 0.0)),
    ("Foot_R",     "Shin_R",    (0.0,    -0.160, 0.02)),
    ("Tail_01",    "Hips",      (0.0,     0.02, -0.15)),
    ("Tail_02",    "Tail_01",   (0.0,     0.00, -0.12)),
]

BONE_LIST = [b[0] for b in BONES]

# socket name -> (host bone, local offset in three-space)
SOCKETS = {
    "SOCKET_head":   ("Head",   (0.0,  0.50, 0.0)),
    "SOCKET_face":   ("Head",   (0.0,  0.31, 0.23)),
    "SOCKET_back":   ("Back",   (0.0,  0.0, -0.02)),
    "SOCKET_hand_L": ("Hand_L", (0.0, -0.05, 0.0)),
    "SOCKET_hand_R": ("Hand_R", (0.0, -0.05, 0.0)),
    "SOCKET_foot_L": ("Foot_L", (0.0, -0.04, 0.03)),
    "SOCKET_foot_R": ("Foot_R", (0.0, -0.04, 0.03)),
    "SOCKET_aura":   ("Root",   (0.0,  0.0,  0.0)),
}


def world_rest(name, table=None):
    """World-space rest position of a bone head, in three-space."""
    table = table or {b[0]: (b[1], b[2]) for b in BONES}
    parent, off = table[name]
    if parent is None:
        return off
    p = world_rest(parent, table)
    return (p[0] + off[0], p[1] + off[1], p[2] + off[2])


def to_blender(v):
    """three (x, y, z) -> blender (x, -z, y)."""
    return (v[0], -v[2], v[1])


def dump_spec(path):
    spec = {
        "avatarHeight": AVATAR_HEIGHT,
        "boneList": BONE_LIST,
        "bones": {n: {"parent": p, "offset": list(o)} for (n, p, o) in BONES},
        "sockets": {k: {"bone": v[0], "offset": list(v[1])} for k, v in SOCKETS.items()},
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(spec, f, indent=2)
    return spec


if __name__ == "__main__":
    dump_spec(os.path.join(os.path.dirname(__file__), "rig_spec.json"))
    for n in BONE_LIST:
        print(n, [round(c, 3) for c in world_rest(n)])
