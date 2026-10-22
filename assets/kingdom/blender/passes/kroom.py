"""Interior room kit. A room is seen like a Grove shop: from its open front (-Y) towards the back wall, with no
ceiling. A shell is a floor, a back wall and two side walls; everything else is a part set on a wall or on the floor.
  shell     origin on the floor in the middle of the room. The inside is W x D metres; walls are H high.
  wall part (window, door, fireplace, sconce, wainscot, stair) drawn with the wall at y = 0 behind it and the room
            towards -Y, origin on the wall (windows and sconces at their middle, the rest on the floor line).
            On the back wall it is used as drawn; on the left wall turned a quarter turn (+90 degrees), on the right
            wall the other way.
What the player changes: the floor finish (material KI_roomFloor is swapped for a finish), the wall finish
(KI_roomWall), the trim colour (KI_roomTrim with its _dk and _lt steps), and paint KV_A / KV_B on parts.
Every floor finish is drawn 2 m to a tile and every wall finish 1 m, so one set of UVs serves them all."""
import bpy, bmesh
from kk import *
from ktone import TB, tn, derive, V
import kbuild, gk
from khparts import arch_pts
H = 3.0; T = 0.3
ROOMS = {"Shed": (4, 4), "Cabin": (6, 6), "Cottage": (8, 8), "Upper": (6, 6), "Manor": (10, 8)}
# The House uses Cottage downstairs and Upper upstairs. The Manor (body 11.6 x 9.2 m outside, two full storeys) uses the Manor
# hall on both floors and Upper under its roof.
FLOOR_TILE, WALL_TILE = 2.0, 1.0
# The furniture of each example room (k19_room_furnish sets it out, k23_export_room writes it for the game).
# A floor piece is (id, x, y, quarter turns); on a surface (id, x, y, height); on a wall (id, wall, along, height).
FURNITURE = {
    "Shed": dict(floor=[("fur-bed", -1.5, 1.0, 0), ("fur-bedside", -0.75, 1.75, 0), ("fur-trunk", -1.5, -0.25, 0), ("fur-armchair", 1.5, -0.25, -1), ("fur-plant", 1.75, 1.75, 0), ("fur-rug", 0.1, -0.2, 0)],
                 on=[("fur-tablelamp", -0.75, 1.75, 0.6)], wall=[("fur-clock", "back", -0.9, 2.05)]),
    "Cabin": dict(floor=[("fur-bigrug", 0.0, 1.0, 0), ("fur-sofa", 0.0, 0.0, 2), ("fur-coffeetable", 0.0, 1.5, 0), ("fur-armchair", -2.0, 1.5, 1), ("fur-sidetable", -2.25, 2.5, 0), ("fur-bookcase", 2.5, 2.75, 0),
                         ("fur-plant", -2.75, -1.25, 0), ("fur-media", 2.75, -1.25, -1), ("fur-diningtable", -1.5, -1.5, 0), ("fur-chair", -2.0, -0.75, 0), ("fur-chair", -1.0, -0.75, 0), ("fur-chair", -2.0, -2.25, 2), ("fur-chair", -1.0, -2.25, 2)],
                  on=[("fur-tablelamp", -2.25, 2.5, 0.56), ("eat-teapot", -1.5, -1.5, 0.8), ("boo-storybook", 0.3, 1.5, 0.46)], wall=[("fur-picture", "left", -1.75, 2.05)]),
    "Cottage": dict(floor=[("fur-bigrug", -0.75, 1.75, 0), ("fur-sofa", -0.75, 0.75, 2), ("fur-coffeetable", -0.75, 2.0, 0), ("fur-armchair", -3.0, 2.0, 1), ("fur-sidetable", -3.25, 3.0, 0), ("fur-piano", -3.5, -0.5, 1),
                           ("fur-fridge", 3.75, 2.25, -1), ("fur-counter", 3.75, 1.25, -1), ("fur-sink", 3.75, 0.25, -1), ("fur-counter", 3.75, -0.75, -1), ("fur-stove", 3.75, -1.75, -1),
                           ("fur-diningtable", 1.5, -0.5, 1), ("fur-chair", 0.75, -1.0, 1), ("fur-chair", 0.75, 0.0, 1), ("fur-chair", 2.25, -1.0, -1), ("fur-chair", 2.25, 0.0, -1), ("fur-plant", 3.75, -3.25, 0)],
                    on=[("fur-tablelamp", -3.25, 3.0, 0.56), ("gro-fruitbowl", 1.5, -0.5, 0.8), ("gro-breadloaf", 3.72, -0.75, 0.92)], wall=[("fur-cupboard", "right", -1.75, 1.95), ("fur-picture", "left", -0.75, 2.2)]),
    "Upper": dict(floor=[("fur-doublebed", -1.5, 2.0, 0), ("fur-bedside", -2.75, 2.75, 0), ("fur-bedside", -0.25, 2.75, 0), ("fur-trunk", -1.5, 0.75, 0), ("fur-rug", -0.5, -0.75, 0), ("fur-desk", -2.75, -1.75, 1), ("fur-deskchair", -2.25, -1.75, -1),
                         ("fur-wardrobe", 2.75, -0.75, -1), ("fur-dresser", 2.75, 1.0, -1), ("fur-bathtub", 1.0, -2.25, 0), ("fur-washstand", 2.75, -2.25, -1)],
                  on=[("fur-tablelamp", -0.25, 2.75, 0.6), ("wel-candle", 2.7, 0.6, 0.87)], wall=[("fur-clock", "back", 1.9, 2.25), ("fur-wallshelf", "left", -1.75, 1.6)]),
    "Manor": dict(floor=[("fur-bigrug", 0.0, 1.75, 0), ("fur-sofa", 0.0, 0.75, 2), ("fur-coffeetable", 0.0, 2.0, 0), ("fur-armchair", -2.0, 2.0, 1), ("fur-armchair", 2.0, 1.75, -1), ("fur-sofa", -2.75, -0.25, 1),
                         ("fur-sidetable", -2.25, 3.25, 0), ("fur-bookcase", -1.75, 3.75, 0), ("fur-piano", -4.25, 2.0, 1), ("fur-plant", -4.75, 3.75, 0), ("fur-plant", -4.75, 0.9, 0),
                         ("fur-diningtable", 2.5, -1.5, 0), ("fur-chair", 2.0, -0.75, 0), ("fur-chair", 3.0, -0.75, 0), ("fur-chair", 2.0, -2.25, 2), ("fur-chair", 3.0, -2.25, 2), ("fur-chair", 1.25, -1.5, 1), ("fur-chair", 3.75, -1.5, -1),
                         ("fur-fridge", 4.75, 2.25, -1), ("fur-counter", 4.75, 1.25, -1), ("fur-sink", 4.75, 0.25, -1), ("fur-counter", 4.75, -0.75, -1), ("fur-stove", 4.75, -1.75, -1), ("fur-plant", 4.75, -3.25, 0)],
                  on=[("fur-tablelamp", -2.25, 3.25, 0.56), ("boo-storybook", 0.3, 2.0, 0.46), ("gro-fruitbowl", 2.5, -1.5, 0.8), ("gro-breadloaf", 4.72, -0.75, 0.92)],
                  wall=[("fur-cupboard", "right", 1.6, 1.95), ("fur-picture", "back", -1.75, 2.5)]),
}
def A(col, kind=None): return V("A", col, kind)
def P(col, kind=None): return V("B", col, kind)
def knob(b, loc, r=0.06, m="gold"): b.ball(r, loc, m, u=8, v=5)

def room(b, W, D):
    hw, hd = W / 2, D / 2
    b.box((W + 2 * T + 0.1, D + T + 0.35, 0.28), (0, (T - 0.25) / 2, -0.16), "roomTrim_dk", r=0.04)
    b.box((W, D, 0.02), (0, 0, -0.01), "roomFloor")
    b.box((W + 2 * T, T, H + 0.02), (0, hd + T / 2, H / 2 - 0.01), "roomWall")
    for sx in (-1, 1):
        b.box((T, D, H + 0.02), (sx * (hw + T / 2), 0, H / 2 - 0.01), "roomWall")
        b.box((T + 0.08, 0.24, H + 0.12), (sx * (hw + T / 2), -hd + 0.08, H / 2 + 0.04), tn("roomTrim", 0.08, None), r=0.03)       # the cut end of the wall
        b.box((T + 0.1, D - 0.2, 0.1), (sx * (hw + T / 2), 0.1, H + 0.05), "roomTrim_lt", r=0.025)
        b.box((0.07, D - 0.25, 0.16), (sx * (hw - 0.015), 0.075, 0.08), "roomTrim")        # a centimetre into the wall, so its back is not in the wall plane where parts meet it
    b.box((W + 2 * T + 0.1, T + 0.1, 0.1), (0, hd + T / 2, H + 0.05), "roomTrim_lt", r=0.025); b.box((W + 0.03, 0.07, 0.16), (0, hd - 0.015, 0.08), "roomTrim")
    return dict(inside=[W, D], height=H)

# ---------------------------------------------------------------- windows
def _cloud(b, x, z, s=1.0):
    for dx, dz, r in ((-0.13, 0.0, 0.1), (0.0, 0.05, 0.14), (0.14, 0.0, 0.09)): b.cyl(r * s, 0.011, (x + dx * s, -0.130, z + dz * s), "white", seg=10, rot=(pi / 2, 0, 0))
def _curtains(b, top, bottom, half=0.92, col="red"):
    b.cyl(0.03, 2 * half + 0.16, (-half - 0.08, -0.21, top + 0.04), "roomTrim_dk", seg=8, rot=(0, pi / 2, 0))
    for sx in (-1, 1):
        knob(b, (sx * (half + 0.1), -0.21, top + 0.04), 0.06)
        pts = [(sx * half, top), (sx * (half - 0.62), top), (sx * (half - 0.5), top - 0.45), (sx * (half - 0.34), (top + bottom) / 2 - 0.05), (sx * (half - 0.42), bottom), (sx * half, bottom)]
        b.prism(pts if sx < 0 else pts[::-1], 0.07, tn(P(col), 0.16, 0.82), mtx=XZ(-0.245, 0, 0)); knob(b, (sx * (half - 0.3), -0.25, (top + bottom) / 2 - 0.05), 0.05)
def win_square(b):
    """Four panes with a deep sill and curtains tied back."""
    b.box((1.35, 0.14, 1.35), (0, -0.06, 0), tn("roomTrim", 0.12, None), r=0.05, seg=3); b.box((1.05, 0.06, 1.05), (0, -0.105, 0), "glass"); _cloud(b, 0.2, 0.22)
    b.box((0.07, 0.05, 1.04), (0, -0.14, 0), "roomTrim_lt"); b.box((1.04, 0.05, 0.07), (0, -0.14, 0), "roomTrim_lt")
    b.box((1.6, 0.3, 0.1), (0, -0.15, -0.72), "roomTrim_lt", r=0.03); _curtains(b, 0.84, -0.66)
def win_round(b):
    """A porthole."""
    b.lathe([(0, 0), (0.7, 0), (0.74, 0.05), (0.7, 0.14), (0.54, 0.14), (0.54, 0.1), (0, 0.1)], (0, 0.01, 0), mats=["roomTrim_dk", "roomTrim", "roomTrim", "roomTrim_lt", "roomTrim_dk", "glass"], seg=24, rot=(pi / 2, 0, 0))
    b.box((0.07, 0.05, 1.08), (0, -0.115, 0), "roomTrim_lt"); b.box((1.08, 0.05, 0.07), (0, -0.115, 0), "roomTrim_lt")
    for dx, dz, r in ((0.1, 0.2, 0.09), (0.22, 0.24, 0.12), (0.34, 0.2, 0.08)): b.cyl(r, 0.01, (dx, -0.086, dz), "white", seg=10, rot=(pi / 2, 0, 0))
def win_arch(b):
    """A tall round-topped window with long curtains."""
    b.prism(arch_pts(1.25, 1.7), 0.14, tn("roomTrim", 0.12, None), mtx=XZ(-0.13, 0, -0.85), r=0.04); b.prism(arch_pts(0.95, 1.42), 0.06, "glass", mtx=XZ(-0.135, 0, -0.71)); _cloud(b, -0.12, 0.2, 0.9)
    b.box((0.07, 0.05, 1.36), (0, -0.16, -0.03), "roomTrim_lt"); b.box((0.94, 0.05, 0.07), (0, -0.16, -0.12), "roomTrim_lt")
    b.box((1.5, 0.3, 0.1), (0, -0.15, -0.9), "roomTrim_lt", r=0.03); _curtains(b, 1.0, -0.84, 0.9, "red")
WINDOWS = {"Square": win_square, "Round": win_round, "Arch": win_arch}

# ---------------------------------------------------------------- other wall parts
def door(b):
    """A panelled door in its frame, for the way to another room."""
    b.box((1.5, 0.14, 2.5), (0, -0.06, 1.25), tn("roomTrim", 0.08, None), r=0.05, seg=3); b.box((1.2, 0.08, 2.3), (0, -0.12, 1.16), tn(A("blue"), 0.14, 0.88), r=0.03)
    for z, h in ((0.62, 0.86), (1.72, 0.9)): b.box((0.86, 0.03, h), (0, -0.165, z), A("blue", "dk"), r=0.02)
    knob(b, (0.44, -0.2, 1.12), 0.07)
def fireplace(b):
    """A stone fireplace with a wooden mantel to stand things on, a fire and its chimney breast up the wall."""
    b.box((2.0, 0.8, 0.1), (0, -0.4, 0.05), "rock_dk", r=0.03); b.box((1.8, 0.5, 1.3), (0, -0.25, 0.75), tn("rock", 0.2, None), r=0.06)
    b.prism(arch_pts(1.16, 1.02), 0.04, "rock_lt", mtx=XZ(-0.53, 0, 0.08)); b.prism(arch_pts(0.9, 0.88), 0.04, "plum", mtx=XZ(-0.545, 0, 0.07))
    for x, z, w in ((-0.72, 0.55, 0.26), (0.7, 0.9, 0.3), (-0.66, 1.15, 0.24), (0.74, 0.4, 0.22)): b.box((w, 0.03, 0.12), (x, -0.508, z), "rock_lt", r=0.012)
    for a in (0.25, -0.3): b.tube([(-0.32, -0.66 + a * 0.2, 0.17), (0.32, -0.6 - a * 0.2, 0.19 + abs(a) * 0.1)], 0.07, "trunk", seg=6)
    import kprops                                                     # the same flame shapes as the campfire's, flat, facing the room
    out = kprops._smooth_outline(kprops.FLAME)
    for x0, H_, W_, back in ((0.0, 0.62, 0.42, 0.0), (-0.16, 0.42, 0.28, 0.02), (0.17, 0.4, 0.26, 0.02)):
        for name, sw, sh, dep, m, dph, pace in kprops.BANDS:
            t = bmesh.new(); vs = [t.verts.new((x0 + x * W_ * sw, -(0.6 - back + dep), 0.17 + y * H_ * sh)) for x, y in out]
            f = t.faces.new(vs[::-1]); bmesh.ops.triangulate(t, faces=[f], quad_method="BEAUTY", ngon_method="BEAUTY")
            i = b.mi(m)
            for f in t.faces: f.material_index = i
            me = bpy.data.meshes.new("_fl"); t.to_mesh(me); t.free(); b.bm.from_mesh(me); bpy.data.meshes.remove(me)
    b.box((2.1, 0.62, 0.1), (0, -0.29, 1.45), tn("wood", 0.3, None), r=0.03); b.box((1.1, 0.36, H - 1.5), (0, -0.18, 1.5 + (H - 1.5) / 2), "rock")
    for sg in (-1, 1): b.ball(1.0, (sg * 0.17, -0.365, 2.3), "leaf_light", sc=(0.17, 0.02, 0.08), u=8, v=4, rot=(0, -sg * 0.55, 0))
    b.box((0.045, 0.03, 0.2), (0, -0.365, 2.19), "leaf_dark", r=0.008)
    return dict(surface=[-1.0, -0.56, 1.0, -0.04, 1.5], light=[0, -0.62, 0.45], cells=[4, 2])
def _lamp(b, top, metal):
    """A carriage lantern hanging from a bracket: a small square roof with a finial, four corner posts round a
    glowing glass box and a base with a drip knob, as a storybook street or porch lamp is drawn. (The old one, a
    bell turned on a lathe, read as a yellow cone.)"""
    x, y, z = top
    b.cyl(0.02, 0.05, (x, y, z - 0.03), metal, seg=6)
    b.lathe([(0.0, 0.02), (0.035, 0.0), (0.15, -0.09), (0.13, -0.11), (0.0, -0.11)], (x, y, z - 0.03), m=metal, seg=4, rot=(0, 0, pi / 4))
    b.box((0.17, 0.17, 0.2), (x, y, z - 0.25), "glow")
    for sx in (-1, 1):
        for sy in (-1, 1): b.box((0.03, 0.03, 0.22), (x + sx * 0.09, y + sy * 0.09, z - 0.25), metal, r=0.006)
    b.box((0.22, 0.22, 0.04), (x, y, z - 0.37), metal, r=0.012); b.ball(0.035, (x, y, z - 0.41), metal, u=8, v=5)
def sconce(b):
    """A wall lamp."""
    b.box((0.2, 0.06, 0.3), (0, -0.02, 0.1), "roomTrim", r=0.02); b.tube([(0, -0.04, 0.16), (0, -0.2, 0.26), (0, -0.34, 0.2), (0, -0.36, 0.08)], 0.03, "gold", seg=6)
    _lamp(b, (0, -0.36, 0.12), "gold")
    return dict(light=[0, -0.36, -0.15])
def wainscot(b):
    """One metre of wood panelling; set side by side along a wall."""
    b.box((1.0, 0.03, 0.97), (0, -0.015, 0.485), "roomTrim"); b.box((1.0, 0.07, 0.08), (0, -0.035, 1.02), "roomTrim_lt")
    for x in (-0.33, 0.0, 0.33): b.box((0.08, 0.02, 0.8), (x, -0.04, 0.56), "roomTrim_lt", r=0.008)
def stair_up(b):
    """Six steps along the wall to a landing and a doorway: the way upstairs. 3 m long, 1 m deep."""
    for i in range(6):
        h = 0.25 * (i + 1); x = -1.5 + 0.3 * i
        b.box((0.3, 1.0, h - 0.04), (x + 0.15, -0.5, (h - 0.04) / 2), "roomTrim" if i % 2 else "roomTrim_dk"); b.box((0.34, 1.03, 0.04), (x + 0.15, -0.525, h - 0.02), "wood", r=0.012)
    b.box((1.2, 1.0, 1.46), (0.9, -0.5, 0.73), tn("roomTrim", 0.1, None)); b.box((1.22, 1.03, 0.04), (0.91, -0.525, 1.48), "wood", r=0.012)
    b.prism(arch_pts(1.1, 1.46), 0.1, tn("roomTrim", 0.1, None), mtx=XZ(-0.1, 0.9, 1.5), r=0.03); b.prism(arch_pts(0.84, 1.3), 0.03, "plum", mtx=XZ(-0.115, 0.9, 1.5))
    posts = [(-1.42, 0.25 + 0.86), (0.36, 1.5 + 0.86), (1.44, 1.5 + 0.86)]
    for (x, top), base in zip(posts, (0.25, 1.5, 1.5)):
        b.cyl(0.05, top - base, (x, -1.0, base), tn(A("wood"), 0.1, 0.9), seg=8); knob(b, (x, -1.0, top + 0.05), 0.075, "cream")
    b.tube([(x, -1.0, top - 0.08) for x, top in posts], 0.04, A("wood"), seg=6); b.tube([(x, -1.0, top - 0.45) for x, top in posts], 0.025, A("wood", "dk"), seg=5)
    b.box((0.05, 0.9, 0.05), (1.44, -0.52, 2.28), A("wood")); b.box((0.035, 0.9, 0.035), (1.44, -0.52, 1.91), A("wood", "dk"))
    return dict(cells=[6, 2], top=[0.9, -0.5, 1.5])
def stair_down(b):
    """The top of the stairs in the upper room: a hatch in the floor with a rail on three sides. 2 x 1 m, on the floor."""
    b.box((2.0, 1.0, 0.05), (0, 0, 0.025), "roomTrim", r=0.015); b.box((1.8, 0.8, 0.012), (0, 0, 0.052), "plum")
    for i in range(3): b.box((0.28, 0.76, 0.012), (-0.72 + 0.3 * i, 0, 0.058), ("wood_lt", "wood", "wood_dk")[i])
    pts = [(-0.95, 0.45), (0.95, 0.45), (0.95, -0.45), (-0.95, -0.45)]
    for x, y in pts: b.cyl(0.05, 0.92, (x, y, 0.05), tn(A("wood"), 0.1, 0.9), seg=8); knob(b, (x, y, 1.02), 0.075, "cream")
    for z, r in ((0.88, 0.04), (0.5, 0.025)): b.tube([(x, y, z) for x, y in pts], r, A("wood") if r > 0.03 else A("wood", "dk"), seg=6)
    return dict(cells=[4, 2])
def beam(b, W):
    """A tie beam from wall to wall with a lantern hung from its middle. Origin on the floor under its middle."""
    b.box((W + 2 * T + 0.06, 0.24, 0.26), (0, 0, H - 0.1), tn("wood", 0.3, 0.8), r=0.04)
    for sx in (-1, 1): b.prism([(0, 0), (0.5, 0.5), (0.5, 0.36), (0.14, 0)] if sx > 0 else [(0, 0), (-0.14, 0), (-0.5, 0.36), (-0.5, 0.5)], 0.14, "wood_dk", mtx=XZ(-0.07, -sx * (W / 2), H - 0.73))
    b.cyl(0.012, 0.36, (0, 0, H - 0.58), "plum", seg=5)
    b.lathe([(0, 0.0), (0.06, 0.0), (0.2, -0.09), (0.16, -0.12), (0.16, -0.4), (0.19, -0.45), (0.06, -0.53), (0, -0.55)], (0, 0, H - 0.56), mats=["gold", "gold", "gold", "glow", "gold", "gold", "gold"], seg=10)
    return dict(light=[0, 0, H - 0.84])
def doormat(b):
    """The way out: a mat at the open front of the room."""
    import math
    def rr(w, d, r, n=4):
        out = []
        for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, pi / 2), (-w / 2 + r, -d / 2 + r, pi), (w / 2 - r, -d / 2 + r, 3 * pi / 2)): out += [(cx + r * cos(a0 + pi / 2 * i / n), cy + r * sin(a0 + pi / 2 * i / n)) for i in range(n + 1)]
        return out
    b.prism(rr(1.4, 0.7, 0.12), 0.03, A("green", "dk")); b.prism(rr(1.24, 0.54, 0.08), 0.036, A("green"))
    for sg in (-1, 1): b.ball(1.0, (sg * 0.15, 0.03, 0.036), "cream", sc=(0.16, 0.075, 0.012), u=8, v=4, rot=(0, 0, sg * 0.55))
    b.box((0.04, 0.2, 0.012), (0, -0.1, 0.04), "cream")
PARTS = {"Door": door, "Fireplace": fireplace, "Sconce": sconce, "Wainscot": wainscot, "Stair_Up": stair_up, "Stair_Down": stair_down, "Doormat": doormat}

# ---------------------------------------------------------------- finishes: tiling pictures, tinted by the material's colour where `tint` is set
def _planks(a, b_, c, gap, rows=8, size=128):
    cols = [np.array(gk.srgb(x)) for x in (a, b_, c)]; arr = np.zeros((size, size, 3), np.float32); rh = size // rows
    for y in range(size):
        r = y // rh; off = (r * 37) % size
        for x in range(size):
            xx = (x + off) % size; arr[y, x] = gk.srgb(gap) if (y % rh == 0 or xx % (size // 2) == 0) else cols[(r + xx // (size // 2)) % 3]
    return arr
def _stripes(n=4, size=64, lo=0.84):
    arr = np.ones((size, size, 3), np.float32); w = size // n
    for x in range(size):
        if (x // w) % 2: arr[:, x] = lo
    return arr
def _dots(size=128, lo=0.84, r=0.045):
    yy, xx = np.mgrid[0:size, 0:size] / size; arr = np.ones((size, size, 3), np.float32)
    # small polka dots in a half-drop grid, as nursery wallpaper is printed (two big dots a tile read as stains)
    for cx, cy in [((i + 0.5 * (j % 2)) / 4 + 0.125, j / 4 + 0.125) for i in range(4) for j in range(4)]:
        dx = np.minimum(abs(xx - cx), 1 - abs(xx - cx)); dy = np.minimum(abs(yy - cy), 1 - abs(yy - cy)); arr[(dx * dx + dy * dy) < r * r] = lo
    return arr
def _boards(n=5, size=80, lo=0.72):
    arr = np.ones((size, size, 3), np.float32); w = size // n
    for x in range(size):
        if x % w == 0: arr[:, x] = lo
        elif (x // w) % 2: arr[:, x] = 0.94
    return arr
def _speckle(size=64, lo=0.9):
    arr = np.ones((size, size, 3), np.float32)
    for i in range(0, size, 4):
        for j in range(0, size, 4): arr[(i * 7 + j * 3) % size, (j * 5 + i) % size] = lo
    return arr
def _check(n=4, size=64, lo=0.8):
    yy, xx = np.mgrid[0:size, 0:size]; k = ((xx * n // size) + (yy * n // size)) % 2; arr = np.ones((size, size, 3), np.float32); arr[k == 1] = lo; return arr
def finish_material(name, arr, tile, tint=None, rough=0.8):
    """KI_fin_<name>: a tiling picture, multiplied by the material's own colour if tint is given (so the game can
    repaint it by setting that colour)."""
    img = gk._img("ki_fin_" + name, arr); n = "KI_fin_" + name; m = bpy.data.materials.get(n) or bpy.data.materials.new(n); m.use_nodes = True; nt = m.node_tree
    p = nt.nodes["Principled BSDF"]; p.inputs["Roughness"].default_value = rough; p.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.get("GMTex") or nt.nodes.new("ShaderNodeTexImage"); tex.name = "GMTex"; tex.image = img; tex.location = (-520, 300)
    for l in list(p.inputs["Base Color"].links): nt.links.remove(l)
    if tint:
        mix = nt.nodes.get("Tint") or nt.nodes.new("ShaderNodeMix"); mix.name = "Tint"; mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.location = (-260, 300)
        mix.inputs[0].default_value = 1.0; nt.links.new(tex.outputs["Color"], mix.inputs[6]); mix.inputs[7].default_value = (*lin(tint), 1); nt.links.new(mix.outputs[2], p.inputs["Base Color"]); m.diffuse_color = (*lin(tint), 1); m["ki_hex"] = tint
    else:
        nt.links.new(tex.outputs["Color"], p.inputs["Base Color"]); m.diffuse_color = (*[float(v) for v in arr.reshape(-1, 3).mean(0) ** 2.2], 1)
    m["gm_tile"] = tile; m["ki_tint"] = bool(tint); return m
def finishes():
    F = {"floor": {}, "wall": {}}
    F["floor"]["planks"] = finish_material("floor_planks", _planks("#D9A066", "#C98443", "#E0AE74", "#9A5F2E"), FLOOR_TILE)
    F["floor"]["checker"] = finish_material("floor_checker", _check(4), FLOOR_TILE, tint="#8FD8D0", rough=0.5)
    F["floor"]["carpet"] = finish_material("floor_carpet", _speckle(), FLOOR_TILE, tint="#F49AB8", rough=1.0)
    F["floor"]["stone"] = finish_material("floor_stone", _planks("#E0D2B4", "#D0C0A0", "#D8C9A9", "#B4A484", rows=4), FLOOR_TILE)
    F["wall"]["stripes"] = finish_material("wall_stripes", _stripes(4), WALL_TILE, tint="#FFE48A")
    F["wall"]["dots"] = finish_material("wall_dots", _dots(), WALL_TILE, tint="#B8E8FF")
    F["wall"]["boards"] = finish_material("wall_boards", _boards(), WALL_TILE, tint="#F0C890")
    return F
