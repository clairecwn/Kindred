"""Kindred landmark architecture — the silhouette-carrying buildings.

    python3 tools/blender/env_buildings.py   -> public/models/env/buildings.glb

Every building is authored around the same grammar so the world reads as
one place: a stone plinth, warm plaster walls, a deep-overhang pitched or
conical roof in a district accent colour, a sign board over a door cut
into the local -Y face, and at least one piece of "someone lives here"
detail (chimney, window boxes, bunting, a stack of crates). Doors are
always centred on local -Y at ground level so the runtime can compute an
approach point from the placement transform alone.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from env_common import *  # noqa

reset_scene()
NAMES = []
DOOR_W = 2.0


def piece(name, fn):
    finish(name, fn())
    NAMES.append(name)


def walls_with_door(w, d, h, color="cream", door_w=DOOR_W, t=0.28):
    """Four walls, box-modelled, with a doorway gap centred on -Y."""
    hw, hd = w / 2, d / 2
    o = [
        box((w, t, h), (0, hd, h / 2), color=color),                 # +Y back
        box((t, d, h), (-hw, 0, h / 2), color=color),                # -X
        box((t, d, h), (hw, 0, h / 2), color=color),                 # +X
    ]
    side = (w - door_w) / 2
    for sx in (-1, 1):
        o.append(box((side, t, h), (sx * (door_w / 2 + side / 2), -hd, h / 2), color=color))
    o.append(box((door_w + 0.3, t * 1.1, h - 2.35), (0, -hd, h - (h - 2.35) / 2), color=color))  # lintel
    return o


def gable_roof(w, d, h, rise=1.9, color="roof_terra", over=0.55):
    W = w + over * 2
    D = d + over * 2
    o = [wedge((W, D, rise), (0, 0, h), color=color)]
    # A ridge cap flush with the gable ends. No eave fascia sticks: at
    # game distance they only ever read as loose poles beside the roof.
    o.append(box((0.34, D * 0.99, 0.20), (0, 0, h + rise - 0.06), color="wood_dark"))
    return o


def plinth(w, d, color="stone_dark", h=0.28):
    return [box((w + 0.5, d + 0.5, h), (0, 0, h / 2), color=color)]


def sign(text_color, w=2.2, z=3.15, d=0.0):
    o = [box((w, 0.18, 0.62), (0, d, z), color=text_color)]
    o.append(box((w + 0.24, 0.10, 0.12), (0, d - 0.05, z + 0.36), color="wood_dark"))
    o.append(box((w + 0.24, 0.10, 0.12), (0, d - 0.05, z - 0.36), color="wood_dark"))
    return o


def window(x, z, y, w=0.9, h=1.0, frame="wood_dark", glass="glass", face="-Y"):
    yy = y - 0.02 if face == "-Y" else y + 0.02
    o = [box((w + 0.18, 0.12, h + 0.18), (x, yy, z), color=frame),
         box((w, 0.16, h), (x, yy - 0.02 if face == "-Y" else yy + 0.02, z), color=glass),
         box((w + 0.34, 0.26, 0.12), (x, yy - 0.10 if face == "-Y" else yy + 0.10, z - h / 2 - 0.12), color="wood_light")]
    return o


def door(hd, color="wood_dark", accent="gold", w=DOOR_W, h=2.35):
    """A door you can actually see from across the plaza: a painted leaf
    set into the wall reveal, a threshold step, and a handle."""
    o = [box((w + 0.30, 0.20, h + 0.26), (0, -hd - 0.02, (h + 0.26) / 2), color="wood_dark")]
    o.append(box((w - 0.05, 0.16, h - 0.08), (0, -hd - 0.14, (h - 0.08) / 2), color=color))
    o.append(box((w - 0.55, 0.10, h - 0.75), (0, -hd - 0.22, (h + 0.35) / 2), color=accent))
    o.append(blob(0.09, (w / 2 - 0.30, -hd - 0.26, 1.05), "gold", sub=0))
    o.append(box((w + 0.7, 0.75, 0.14), (0, -hd - 0.42, 0.07), color="stone"))
    return o


def shopfront(w, d, h, wall, roof, accent, awning_color):
    hd = d / 2
    o = plinth(w, d) + walls_with_door(w, d, h, wall) + gable_roof(w, d, h, 1.9, roof)
    o += sign(accent, min(2.6, w * 0.55), h + 0.25, -hd - 0.24)
    o += door(hd, color=awning_color, accent=accent)
    o += window(-w / 2 + 1.1, 1.6, -hd, 1.2, 1.3)
    o += window(w / 2 - 1.1, 1.6, -hd, 1.2, 1.3)
    # awning over the door
    o.append(box((DOOR_W + 1.0, 1.0, 0.12), (0, -hd - 0.5, 2.62), rot=(math.radians(-16), 0, 0), color=awning_color))
    o.append(box((DOOR_W + 1.0, 0.09, 0.22), (0, -hd - 0.94, 2.44), color="cream"))
    for sx in (-1, 1):
        o.append(cyl(0.055, 0.9, (sx * (DOOR_W / 2 + 0.42), -hd - 0.9, 2.0), color="wood_dark", verts=6))
    return o


# ── The mall street: three shopfronts ──────────────────────────────────
def shop_grocer():
    o = shopfront(8.0, 6.0, 3.4, "cream", "roof_moss", "leaf_gold", "fabric_sage")
    o.append(box((0.7, 0.62, 0.5), (-3.0, -3.6, 0.25), color="wood_light"))
    o.append(box((0.7, 0.62, 0.5), (-3.0, -3.6, 0.75), color="wood"))
    o.append(blob(0.26, (-3.0, -3.6, 1.14), "leaf_gold", sub=0, scale=(1.5, 1.2, 0.8)))
    o.append(box((0.72, 0.6, 0.45), (3.1, -3.55, 0.23), color="wood"))
    o.append(blob(0.24, (3.1, -3.55, 0.6), "rose", sub=0, scale=(1.5, 1.2, 0.8)))
    o.append(cyl(0.44, 1.5, (2.1, 1.4, 4.35), color="stone_dark", verts=8))
    return o


def shop_furnish():
    o = shopfront(8.6, 6.4, 3.6, "stone", "roof_terra", "clay", "fabric_gold")
    # a big display window instead of the left small one
    o += window(-2.3, 1.7, -3.2, 2.2, 1.9, "wood_dark", "glass")
    o.append(cyl(0.5, 1.6, (2.0, 1.5, 4.6), color="clay", verts=8))
    o.append(cyl(0.58, 0.22, (2.0, 1.5, 5.45), color="stone_dark", verts=8))
    o.append(box((1.1, 0.7, 0.5), (3.3, -3.7, 0.25), color="wood_light"))
    o.append(box((1.0, 0.12, 0.6), (3.3, -3.7, 0.8), color="fabric_rose"))
    return o


def shop_boutique():
    o = shopfront(7.0, 5.6, 3.9, "cream", "roof_plum", "lilac", "fabric_rose")
    # bay window above the door
    o.append(box((2.4, 0.9, 1.4), (0, -3.1, 4.2), color="cream"))
    o.append(box((2.0, 0.9, 1.0), (0, -3.5, 4.2), color="glass"))
    o.append(wedge((2.8, 1.3, 0.6), (0, -3.15, 4.92), color="roof_plum"))
    o.append(box((2.6, 0.3, 0.22), (0, -3.55, 3.48), color="wood_light"))
    for sx in (-0.7, 0.0, 0.7):
        o.append(blob(0.2, (sx, -3.6, 3.68), "rose", sub=0, scale=(1.2, 1.2, 0.9)))
    return o


# ── District landmarks ─────────────────────────────────────────────────
def cafe_pavilion():
    """Open-sided: a counter, six posts and a broad hipped roof."""
    o = plinth(8.5, 7.0, "stone", 0.36)
    o.append(box((8.0, 6.5, 0.14), (0, 0, 0.4), color="stone"))
    for (sx, sy) in [(-3.7, -3.0), (0, -3.0), (3.7, -3.0), (-3.7, 3.0), (0, 3.0), (3.7, 3.0)]:
        o.append(cyl(0.16, 3.1, (sx, sy, 1.95), color="wood_light", verts=8))
    o.append(box((8.6, 7.2, 0.2), (0, 0, 3.55), color="wood_dark"))
    o.append(cone(6.6, 2.0, (0, 0, 4.6), color="roof_teal", verts=8))
    o.append(blob(0.3, (0, 0, 5.8), "gold", sub=0))
    # back counter + shelves + kettle
    o.append(box((5.6, 0.9, 1.1), (0, 2.6, 0.95), color="wood"))
    o.append(box((5.8, 1.05, 0.12), (0, 2.6, 1.56), color="wood_light"))
    o.append(box((5.0, 0.35, 1.5), (0, 3.2, 2.5), color="cream"))
    for sx in (-1.6, 0.0, 1.6):
        o.append(cyl(0.16, 0.3, (sx, 3.1, 2.35), color=["rose", "teal", "gold"][int(sx) + 1], verts=8))
    return o


def glasshouse():
    """A hexagonal conservatory for the Quiet Garden."""
    o = plinth(7.2, 7.2, "stone_dark", 0.3)
    o.append(cyl(3.6, 0.18, (0, 0, 0.38), color="stone", verts=6))
    for i in range(6):
        a = i * math.pi / 3 + math.pi / 6
        x, y = math.cos(a) * 3.3, math.sin(a) * 3.3
        o.append(cyl(0.12, 3.0, (x, y, 1.8), color="wood_light", verts=6))
    # glass panels: a low-poly hexagonal drum plus a faceted cap
    o.append(cyl(3.25, 2.8, (0, 0, 1.75), color="glass", verts=6))
    o.append(torus(3.3, 0.11, (0, 0, 3.2), color="wood_light", major_segs=6, minor_segs=4))
    o.append(cone(3.5, 1.7, (0, 0, 3.35), color="glass", verts=6))
    o.append(cyl(0.14, 0.7, (0, 0, 4.9), color="wood_dark", verts=6))
    o.append(blob(0.24, (0, 0, 5.3), "gold", sub=0))
    # doorway frame on -Y
    o.append(box((2.2, 0.3, 2.4), (0, -3.25, 1.2), color="wood_light"))
    o.append(box((1.7, 0.42, 2.0), (0, -3.25, 1.0), color="leaf_dark"))
    return o


def workshop_barn():
    o = plinth(9.0, 7.0, "stone_dark")
    o += walls_with_door(9.0, 7.0, 3.3, "clay", door_w=2.6)
    o += door(3.5, color="wood", accent="roof_teal", w=2.6, h=2.6)
    o += gable_roof(9.0, 7.0, 3.3, 2.6, "roof_terra", over=0.7)
    o += sign("wood_light", 2.8, 3.6, -3.78)
    o += window(-3.0, 1.7, -3.5, 1.2, 1.3)
    o += window(3.0, 1.7, -3.5, 1.2, 1.3)
    o.append(cyl(0.5, 1.9, (2.2, 1.6, 4.9), color="stone_dark", verts=8))
    # waterwheel on +X
    o.append(torus(1.5, 0.16, (5.2, 0.5, 1.7), rot=(0, math.radians(90), 0), color="wood_dark", major_segs=12))
    o.append(torus(1.05, 0.12, (5.2, 0.5, 1.7), rot=(0, math.radians(90), 0), color="wood_dark", major_segs=12))
    for i in range(8):
        a = i * math.pi / 4
        o.append(box((0.12, 0.5, 1.5), (5.2, 0.5 + math.cos(a) * 1.28, 1.7 + math.sin(a) * 1.28),
                     rot=(a, math.radians(90), 0), color="wood_light"))
    o.append(box((1.0, 0.9, 0.7), (-4.0, -4.0, 0.35), color="wood_light"))
    o.append(box((0.9, 0.8, 0.6), (-4.0, -4.0, 1.0), color="wood"))
    return o


def stage_bandstand():
    o = [cyl(4.6, 0.5, (0, 0, 0.25), color="stone_dark", verts=12, r2=4.9)]
    o.append(cyl(4.3, 0.24, (0, 0, 0.62), color="wood_light", verts=12))
    for i in range(6):
        a = i * math.pi / 3 + math.pi / 6
        o.append(cyl(0.16, 3.1, (math.cos(a) * 3.7, math.sin(a) * 3.7, 2.3), color="cream", verts=8))
    o.append(torus(3.8, 0.14, (0, 0, 3.85), color="wood_dark", major_segs=14, minor_segs=5))
    o.append(cone(4.5, 2.1, (0, 0, 4.0), color="roof_plum", verts=8))
    o.append(cone(1.4, 0.9, (0, 0, 5.9), color="lilac", verts=8))
    o.append(blob(0.26, (0, 0, 6.5), "gold", sub=0))
    for i in range(6):
        a = i * math.pi / 3 + math.pi / 6
        o.append(cyl(0.13, 0.24, (math.cos(a) * 3.7, math.sin(a) * 3.7, 3.65), color="glow", verts=6))
    return o


def home_cottage():
    o = plinth(7.4, 6.2, "stone_dark")
    o += walls_with_door(7.4, 6.2, 3.0, "sand")
    o += door(3.1, color="teal", accent="gold")
    o += gable_roof(7.4, 6.2, 3.0, 2.2, "roof_terra", over=0.65)
    o += window(-2.4, 1.5, -3.1, 1.1, 1.2)
    o += window(2.4, 1.5, -3.1, 1.1, 1.2)
    # porch
    o.append(box((3.4, 1.5, 0.16), (0, -3.7, 0.36), color="wood_light"))
    for sx in (-1.5, 1.5):
        o.append(cyl(0.11, 2.5, (sx, -4.2, 1.6), color="wood_light", verts=6))
    o.append(wedge((4.0, 1.9, 0.6), (0, -4.1, 2.85), rot=(0, 0, math.radians(90)), color="roof_terra"))
    # dormer
    o.append(box((1.6, 1.2, 1.0), (0, -1.2, 3.5), color="sand"))
    o.append(box((1.1, 0.5, 0.8), (0, -1.75, 3.5), color="glass"))
    o.append(wedge((2.0, 1.6, 0.6), (0, -1.2, 4.0), color="roof_terra"))
    o.append(cyl(0.42, 1.8, (1.9, 1.5, 4.35), color="clay", verts=8))
    o.append(cyl(0.5, 0.2, (1.9, 1.5, 5.3), color="stone_dark", verts=8))
    return o


def dock_jetty():
    o = [box((3.4, 10.0, 0.22), (0, 0, 1.0), color="wood_light")]
    for sy in (-4.4, -2.0, 0.4, 2.8, 4.6):
        for sx in (-1.45, 1.45):
            o.append(cyl(0.16, 2.2, (sx, sy, 0.0), color="wood_dark", verts=6))
    for sy in (-4.0, 0.0, 4.0):
        for sx in (-1.6, 1.6):
            o.append(cyl(0.13, 1.6, (sx, sy, 1.5), color="wood", verts=6))
    o.append(box((3.6, 0.11, 0.11), (0, 0, 2.24), color="wood"))
    o.append(cyl(0.22, 1.2, (1.7, -4.9, 1.7), color="wood_dark", verts=8))
    o.append(cyl(0.3, 0.16, (1.7, -4.9, 2.35), color="glow", verts=8))
    return o


def kindred_tree():
    """The hub landmark: a great broad tree over a tiered basin. ~11m."""
    o = [cyl(3.9, 0.5, (0, 0, 0.25), color="stone", verts=16, r2=4.3)]
    o.append(cyl(3.3, 0.42, (0, 0, 0.68), color="stone_dark", verts=16, r2=3.6))
    o.append(cyl(2.6, 0.3, (0, 0, 0.98), color="water", verts=16))
    o.append(cyl(1.15, 1.0, (0, 0, 1.4), color="stone", verts=12, r2=1.35))
    o.append(cyl(0.72, 3.6, (0, 0, 3.4), color="wood", verts=10, r2=0.5))
    for i in range(4):
        a = i * math.pi / 2 + 0.5
        o.append(cyl(0.22, 2.1, (math.cos(a) * 0.9, math.sin(a) * 0.9, 5.3),
                     rot=(math.sin(a) * 0.7, -math.cos(a) * 0.7, 0), color="wood", verts=6))
    for (dx, dy, dz, r, c) in [(-1.5, 0.5, 7.0, 2.6, "leaf"), (1.7, -0.8, 7.5, 2.3, "leaf_warm"),
                               (0.2, 1.7, 8.1, 2.1, "leaf_dark"), (-0.6, -1.5, 8.4, 1.9, "leaf"),
                               (0.9, 0.6, 9.2, 1.6, "leaf_warm")]:
        o.append(blob(r, (dx, dy, dz), c, sub=1, scale=(1.0, 1.0, 0.78)))
    # hanging lanterns under the canopy
    for i in range(6):
        a = i * math.pi / 3
        x, y = math.cos(a) * 2.5, math.sin(a) * 2.5
        o.append(cyl(0.03, 1.0, (x, y, 6.1), color="wood_dark", verts=4))
        o.append(cyl(0.2, 0.32, (x, y, 5.45), color="glow", verts=8))
        o.append(cone(0.26, 0.18, (x, y, 5.7), color="roof_terra", verts=8))
    return o


for n, f in [("shop_grocer", shop_grocer), ("shop_furnish", shop_furnish), ("shop_boutique", shop_boutique),
             ("cafe_pavilion", cafe_pavilion), ("glasshouse", glasshouse), ("workshop_barn", workshop_barn),
             ("stage_bandstand", stage_bandstand), ("home_cottage", home_cottage),
             ("dock_jetty", dock_jetty), ("kindred_tree", kindred_tree)]:
    piece(n, f)

assign_shared_material()
export_glb(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                        "public", "models", "env", "buildings.glb"))
print("buildings:", NAMES)
