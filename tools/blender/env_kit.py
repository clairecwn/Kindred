"""Kindred environment kit — small, instanceable dressing props.

    python3 tools/blender/env_kit.py

Exports public/models/env/kit.glb. Every piece is one joined mesh with
flat vertex colours, origin centred on its footprint with its base at
z=0, authored Z-up and exported Y-up. The runtime (src/grove/scene/
assets.js) pulls each named geometry out and draws it as an InstancedMesh,
so "how many benches are in the world" never changes the draw-call count.
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from env_common import *  # noqa

random.seed(7)
reset_scene()
PIECES = []


def piece(name, fn):
    objs = fn()
    o = finish(name, objs)
    PIECES.append(name)
    return o


# ── Trees & planting ───────────────────────────────────────────────────
def tree_broad():
    o = [cyl(0.20, 1.7, (0, 0, 0.85), color="wood", verts=8, r2=0.15)]
    o.append(cyl(0.30, 0.30, (0, 0, 0.12), color="wood_dark", verts=8, r2=0.20))
    for (dx, dy, dz, r, c) in [(-0.35, 0.1, 2.15, 0.86, "leaf"), (0.42, -0.18, 2.45, 0.74, "leaf_warm"),
                               (0.05, 0.34, 2.85, 0.66, "leaf_dark"), (-0.18, -0.32, 2.62, 0.58, "leaf")]:
        o.append(blob(r, (dx, dy, dz), c, sub=1, scale=(1.0, 1.0, 0.82)))
    return o


def tree_pine():
    o = [cyl(0.16, 1.1, (0, 0, 0.55), color="wood_dark", verts=7, r2=0.12)]
    for i, (z, r, h) in enumerate([(1.4, 1.05, 1.5), (2.3, 0.82, 1.35), (3.1, 0.55, 1.2)]):
        o.append(cone(r, h, (0, 0, z), color="leaf_dark" if i % 2 else "leaf", verts=7))
    return o


def tree_blossom():
    o = [cyl(0.17, 1.5, (0, 0, 0.75), color="wood_light", verts=8, r2=0.13)]
    for (dx, dy, dz, r) in [(-0.3, 0.12, 1.95, 0.72), (0.36, -0.2, 2.15, 0.62), (0.0, 0.3, 2.4, 0.55)]:
        o.append(blob(r, (dx, dy, dz), "rose", sub=1, scale=(1.1, 1.1, 0.75)))
    o.append(blob(0.5, (0.1, -0.05, 2.6), "fabric_rose", sub=1, scale=(1.0, 1.0, 0.7)))
    return o


def bush():
    o = []
    for (dx, dy, dz, r, c) in [(0, 0, 0.34, 0.46, "leaf_dark"), (0.30, 0.14, 0.42, 0.34, "leaf"),
                               (-0.26, -0.16, 0.38, 0.30, "leaf_warm")]:
        o.append(blob(r, (dx, dy, dz), c, sub=1, scale=(1.0, 1.0, 0.8)))
    return o


def flower_clump():
    o = [blob(0.28, (0, 0, 0.14), "leaf_dark", sub=1, scale=(1.3, 1.3, 0.5))]
    for i in range(5):
        a = i * 1.257 + 0.3
        x, y = math.cos(a) * 0.22, math.sin(a) * 0.22
        o.append(cyl(0.022, 0.30, (x, y, 0.26), color="leaf", verts=4))
        o.append(blob(0.10, (x, y, 0.44), ["rose", "gold", "lilac", "cream", "fabric_rose"][i], sub=0))
    return o


def rock_a():
    o = [blob(0.55, (0, 0, 0.3), "stone_dark", sub=0, scale=(1.2, 0.9, 0.7), rot=(0.2, 0.1, 0.6))]
    o.append(blob(0.28, (0.42, 0.2, 0.2), "stone", sub=0, scale=(1.0, 0.9, 0.8)))
    return o


def rock_b():
    return [blob(0.34, (0, 0, 0.2), "stone", sub=0, scale=(1.4, 1.0, 0.65), rot=(0, 0.15, 1.1))]


def reeds():
    o = []
    for i in range(6):
        a = i * 1.05
        x, y = math.cos(a) * 0.18, math.sin(a) * 0.18
        h = 0.6 + (i % 3) * 0.22
        o.append(cyl(0.03, h, (x, y, h / 2), rot=(0.12 * math.cos(a), 0.12 * math.sin(a), 0),
                     color="leaf_dark" if i % 2 else "leaf", verts=4))
    return o


# ── Seating & social furniture ─────────────────────────────────────────
def bench():
    o = [box((1.55, 0.42, 0.10), (0, 0, 0.44), color="wood_light")]
    o.append(box((1.55, 0.10, 0.36), (0, -0.20, 0.62), rot=(math.radians(-9), 0, 0), color="wood_light"))
    for sx in (-0.62, 0.62):
        o.append(box((0.12, 0.42, 0.40), (sx, 0, 0.20), color="wood_dark"))
    return o


def stool():
    o = [cyl(0.26, 0.10, (0, 0, 0.46), color="wood_light", verts=10)]
    for i in range(3):
        a = i * 2.094
        o.append(cyl(0.045, 0.46, (math.cos(a) * 0.16, math.sin(a) * 0.16, 0.23), color="wood_dark", verts=6))
    return o


def table_round():
    o = [cyl(0.58, 0.09, (0, 0, 0.70), color="cream", verts=16)]
    o.append(cyl(0.09, 0.66, (0, 0, 0.35), color="wood_dark", verts=8))
    o.append(cyl(0.34, 0.07, (0, 0, 0.04), color="wood_dark", verts=12))
    return o


def parasol():
    o = [cyl(0.055, 2.15, (0, 0, 1.07), color="wood_light", verts=8)]
    o.append(cone(1.25, 0.62, (0, 0, 2.25), color="fabric_gold", verts=8))
    o.append(cone(1.05, 0.30, (0, 0, 2.02), color="fabric_rose", verts=8))
    o.append(blob(0.09, (0, 0, 2.62), "gold", sub=0))
    return o


def picnic_set():
    o = [box((1.5, 0.7, 0.09), (0, 0, 0.72), color="wood_light")]
    for sy in (-0.62, 0.62):
        o.append(box((1.5, 0.28, 0.08), (0, sy, 0.44), color="wood"))
        o.append(box((0.10, 0.28, 0.42), (0, sy, 0.22), color="wood_dark"))
    for sx in (-0.6, 0.6):
        o.append(box((0.12, 0.66, 0.70), (sx, 0, 0.36), color="wood_dark"))
    return o


def firebowl():
    o = [cyl(0.62, 0.30, (0, 0, 0.42), color="stone_dark", verts=12, r2=0.44)]
    o.append(cyl(0.46, 0.24, (0, 0, 0.13), color="stone", verts=12, r2=0.56))
    o.append(blob(0.36, (0, 0, 0.56), "glow", sub=1, scale=(1, 1, 0.5)))
    return o


# ── Lighting & signage ─────────────────────────────────────────────────
def lamp_post():
    o = [cyl(0.13, 0.24, (0, 0, 0.12), color="stone_dark", verts=10, r2=0.10)]
    o.append(cyl(0.075, 2.55, (0, 0, 1.4), color="wood_dark", verts=8))
    o.append(cyl(0.26, 0.42, (0, 0, 2.86), color="glow", verts=8, r2=0.20))
    o.append(cone(0.34, 0.26, (0, 0, 3.18), color="roof_terra", verts=8))
    o.append(blob(0.07, (0, 0, 3.35), "gold", sub=0))
    return o


def hanging_lantern():
    o = [cyl(0.18, 0.28, (0, 0, 0.14), color="glow", verts=8)]
    o.append(cone(0.24, 0.16, (0, 0, 0.34), color="roof_terra", verts=8))
    o.append(cyl(0.02, 0.26, (0, 0, 0.55), color="wood_dark", verts=4))
    return o


def signpost():
    o = [cyl(0.09, 2.0, (0, 0, 1.0), color="wood_dark", verts=8)]
    o.append(box((0.9, 0.07, 0.34), (0.36, 0, 1.72), color="wood_light"))
    o.append(box((0.72, 0.07, 0.28), (-0.28, 0, 1.30), rot=(0, 0, math.radians(180)), color="gold"))
    o.append(cone(0.16, 0.2, (0, 0, 2.08), color="roof_teal", verts=6))
    return o


def planter():
    o = [cyl(0.46, 0.52, (0, 0, 0.26), color="clay", verts=10, r2=0.36)]
    o.append(torus(0.47, 0.05, (0, 0, 0.5), color="wood_light", major_segs=12))
    o.append(blob(0.38, (0, 0, 0.68), "leaf", sub=1, scale=(1.1, 1.1, 0.6)))
    o.append(blob(0.2, (0.2, 0.1, 0.82), "fabric_rose", sub=0))
    return o


def crate():
    o = [box((0.62, 0.62, 0.52), (0, 0, 0.26), color="wood")]
    o.append(box((0.66, 0.10, 0.10), (0, -0.28, 0.42), color="wood_light"))
    o.append(box((0.66, 0.10, 0.10), (0, -0.28, 0.12), color="wood_light"))
    return o


def barrel():
    o = [cyl(0.34, 0.78, (0, 0, 0.39), color="wood", verts=12)]
    o.append(torus(0.36, 0.04, (0, 0, 0.18), color="wood_dark", major_segs=12))
    o.append(torus(0.36, 0.04, (0, 0, 0.60), color="wood_dark", major_segs=12))
    return o


def fence_panel():
    o = [box((2.0, 0.07, 0.10), (0, 0, 0.78), color="wood_light"),
         box((2.0, 0.07, 0.10), (0, 0, 0.46), color="wood_light")]
    for sx in (-0.95, 0.95):
        o.append(box((0.11, 0.11, 0.95), (sx, 0, 0.47), color="wood_dark"))
    return o


def arch_gate():
    o = []
    for sx in (-1.6, 1.6):
        o.append(cyl(0.17, 2.6, (sx, 0, 1.3), color="stone", verts=8))
        o.append(cyl(0.24, 0.22, (sx, 0, 0.11), color="stone_dark", verts=8, r2=0.19))
    o.append(arc(1.6, 0.17, (0, 0, 2.6), rot=(math.radians(90), 0, 0), color="stone"))
    o.append(box((0.9, 0.12, 0.42), (0, 0, 3.05), color="gold"))
    o.append(hanging_lantern_at(-1.15, 2.35))
    o.append(hanging_lantern_at(1.15, 2.35))
    return [x for x in o if x]


def hanging_lantern_at(x, z):
    return cyl(0.15, 0.26, (x, 0, z), color="glow", verts=8)


def awning():
    """A striped shopfront awning, origin at the wall face."""
    o = [box((2.6, 1.1, 0.10), (0, 0.5, 0.0), rot=(math.radians(-18), 0, 0), color="fabric_rose")]
    o.append(box((0.5, 1.1, 0.12), (-0.9, 0.5, 0.005), rot=(math.radians(-18), 0, 0), color="cream"))
    o.append(box((0.5, 1.1, 0.12), (0.9, 0.5, 0.005), rot=(math.radians(-18), 0, 0), color="cream"))
    o.append(box((2.7, 0.08, 0.20), (0, 1.02, -0.26), color="wood_dark"))
    return o


def market_stall():
    o = [box((2.3, 1.1, 0.95), (0, 0, 0.48), color="wood")]
    o.append(box((2.5, 1.3, 0.10), (0, 0, 0.99), color="wood_light"))
    for (sx, sy) in [(-1.05, -0.5), (1.05, -0.5), (-1.05, 0.5), (1.05, 0.5)]:
        o.append(cyl(0.06, 2.1, (sx, sy, 1.05), color="wood_dark", verts=6))
    o.append(wedge((2.85, 1.7, 0.7), (0, 0, 2.1), color="fabric_gold"))
    o.append(box((2.9, 0.09, 0.22), (0, -0.86, 2.02), color="fabric_rose"))
    o.append(crate_at(-0.6, 0.0, 1.04))
    o.append(blob(0.22, (0.55, 0.0, 1.2), "leaf_gold", sub=0, scale=(1.4, 1.0, 0.8)))
    return [x for x in o if x]


def crate_at(x, y, z):
    return box((0.5, 0.45, 0.34), (x, y, z + 0.17), color="wood_light")


def koi_rock():
    o = [cyl(1.9, 0.24, (0, 0, 0.12), color="stone_dark", verts=16, r2=2.1)]
    o.append(cyl(1.75, 0.10, (0, 0, 0.23), color="water", verts=16))
    o.append(blob(0.3, (1.2, 0.7, 0.22), "stone", sub=0, scale=(1.2, 1.0, 0.6)))
    return o


def easel():
    o = [cyl(0.05, 1.6, (0, 0.28, 0.8), rot=(math.radians(14), 0, 0), color="wood_dark", verts=6)]
    for sx in (-0.32, 0.32):
        o.append(cyl(0.05, 1.55, (sx, -0.2, 0.78), rot=(math.radians(-10), 0, 0), color="wood_dark", verts=6))
    o.append(box((0.78, 0.06, 0.62), (0, 0.02, 1.12), rot=(math.radians(10), 0, 0), color="cream"))
    o.append(box((0.82, 0.12, 0.07), (0, 0.06, 0.78), color="wood_light"))
    return o


for name, fn in [
    ("tree_broad", tree_broad), ("tree_pine", tree_pine), ("tree_blossom", tree_blossom),
    ("bush", bush), ("flower_clump", flower_clump), ("rock_a", rock_a), ("rock_b", rock_b),
    ("reeds", reeds), ("bench", bench), ("stool", stool), ("table_round", table_round),
    ("parasol", parasol), ("picnic_set", picnic_set), ("firebowl", firebowl),
    ("lamp_post", lamp_post), ("hanging_lantern", hanging_lantern), ("signpost", signpost),
    ("planter", planter), ("crate", crate), ("barrel", barrel), ("fence_panel", fence_panel),
    ("arch_gate", arch_gate), ("awning", awning), ("market_stall", market_stall),
    ("koi_pond", koi_rock), ("easel", easel),
]:
    piece(name, fn)

assign_shared_material()
export_glb(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                        "public", "models", "env", "kit.glb"))
print("pieces:", len(PIECES), PIECES)
