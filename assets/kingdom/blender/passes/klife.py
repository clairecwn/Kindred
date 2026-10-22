"""Life kit (Phase 12): the things that make the island feel lived in. Animals for the stable and the yard, a duck for
the pond, a cat for the porch, butterflies and birds, a puff of chimney smoke, a ripple ring, and a visitor's boat.
Every part is drawn in its own frame: the ground (or the water line, for the swimming duck, the ripple and the boat)
at z = 0, the middle of the part at the origin, its front towards -Y. Same look as the item models: fat and round, three
values of each colour, cream trim.
  poses     an animal that does more than stand has a second mesh in another pose (Pony_Graze, Chicken_Peck). The game
            moves a creature by hopping and turning the whole mesh and swaps poses; nothing here has bones.
  wings     Butterfly_Wing is one wing with its hinge on the origin along Y. The game draws it twice (mirrored in X)
            on Butterfly_Body and turns the two about Y to flap. Butterfly is the same thing with the wings set open.
  paint     KV_A_<colour> is the coat, the wing or the hull; KV_B_<colour> the patches, the wing spots, the sail stripe.
A builder returns facts about its part (what it is, where it belongs, span: the room it needs in metres); k27 writes
them on the mesh. No fact may be called size: the export measures that."""
import bpy, bmesh
from kk import *
from ktone import TB, tn, derive, V
import kbuild, gk
from mathutils import Matrix
KIT = []          # (name, builder, group)
def part(name, group):
    def deco(fn): KIT.append((name, fn, group)); return fn
    return deco
def A(col, kind=None): return V("A", col, kind)
def P(col, kind=None): return V("B", col, kind)

# ---------------------------------------------------------------- shared shapes
def frame(loc, pitch=0.0, yaw=0.0):
    """A head's own frame: returns f(x, y, z) -> world point, and the turn to give a ball drawn in it."""
    M = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(pitch, 4, "X")
    return (lambda x, y, z: tuple(M @ Vector((x, y, z)))), (pitch, 0.0, yaw)
def eye(b, p, r=0.05, rot=None, side=1):
    """A round dark eye with a small light in it. p: its middle; the face looks to -Y in the head's frame."""
    b.ball(r, p, "plum", sc=(0.8, 0.8, 1.1), u=8, v=6, rot=rot); b.ball(r * 0.38, (p[0] - side * r * 0.2, p[1] - r * 0.55, p[2] + r * 0.45), "white", u=6, v=4)
def legs(b, pts, r, h, m, foot=0.24):
    for x, y in pts: b.cyl(r, h, (x, y, 0), tn(m, foot, None), seg=10, bev=r * 0.3)
def cone(b, r, h, loc, m, rot=None, seg=8): b.cyl(r, h, loc, m, seg=seg, r2=r * 0.12, rot=rot)

# ---------------------------------------------------------------- stable and yard
def _pony(b, graze):
    coat = A("trunk_light"); body = tn(coat, 0.3, 0.75, 0.3)
    legs(b, [(sx * 0.2, sy * 0.36 + 0.02) for sx in (-1, 1) for sy in (-1, 1)], 0.105, 0.64, coat)
    b.ball(1.0, (0, 0.04, 0.88), body, sc=(0.37, 0.6, 0.36), u=14, v=10)
    neck = [(0, -0.4, 0.96), (0, -0.7, 0.74), (0, -0.86, 0.52)] if graze else [(0, -0.36, 1.0), (0, -0.54, 1.2), (0, -0.6, 1.34)]
    b.tube(neck, [0.27, 0.23, 0.2], coat, seg=10)
    F, rot = frame((0, -0.96, 0.41) if graze else (0, -0.74, 1.45), 1.15 if graze else 0.3)
    b.ball(1.0, F(0, 0, 0), body, sc=(0.22, 0.31, 0.23), u=12, v=8, rot=rot)
    b.ball(1.0, F(0, -0.25, -0.05), "cream", sc=(0.165, 0.16, 0.15), u=10, v=7, rot=rot)                    # muzzle
    for sg in (-1, 1):
        eye(b, F(sg * 0.16, -0.1, 0.06), 0.05, rot, sg); b.ball(0.02, F(sg * 0.06, -0.4, -0.03), "plum", u=6, v=4)
        cone(b, 0.065, 0.17, F(sg * 0.12, 0.12, 0.15), coat, rot=(rot[0] - 0.2, sg * 0.25, 0))
        b.ball(0.05, F(sg * 0.17, -0.2, -0.04), "pink", sc=(0.5, 1, 0.8), u=8, v=5, rot=rot)                # cheeks
    b.ball(0.11, F(0, 0.02, 0.2), "cream", sc=(1, 1.3, 0.8), u=8, v=6, rot=rot)                             # forelock
    for k, p in enumerate(neck):                                                                          # mane, along the top of the neck
        b.ball(0.15 - 0.012 * k, (0, p[1] + (0.17 if graze else 0.2), p[2] + (0.24 if graze else 0.16)), "cream", sc=(0.6, 1, 1), u=8, v=6)
    b.tube([(0, 0.6, 0.98), (0, 0.8, 0.8), (0, 0.8, 0.42)], [0.07, 0.1, 0.05], "cream", seg=8)
    return dict(kind="animal", home="paddock", pose="graze" if graze else "stand", span=1.6)
@part("Pony", "yard")
def pony(b): return _pony(b, False)
@part("Pony_Graze", "yard")
def pony_graze(b): return _pony(b, True)

def _cow(b, graze):
    coat = A("white"); body = tn(coat, 0.28, 0.78, 0.3); patch = P("trunk")
    legs(b, [(sx * 0.23, sy * 0.4 + 0.04) for sx in (-1, 1) for sy in (-1, 1)], 0.11, 0.62, coat, 0.26)
    b.ball(1.0, (0, 0.06, 0.9), body, sc=(0.43, 0.68, 0.4), u=14, v=10)
    for x, y, z, r in ((0.3, 0.3, 1.05, 0.26), (-0.36, -0.1, 0.95, 0.22), (0.1, -0.2, 1.24, 0.2), (-0.2, 0.52, 0.98, 0.2)):   # patches lie on the coat
        n = Vector((x / 0.43 ** 2, (y - 0.06) / 0.68 ** 2, (z - 0.9) / 0.4 ** 2)).normalized()
        b.ball(r, (x, y, z), patch, sc=(1, 1, 0.3), u=10, v=6, rot=n.to_track_quat("Z", "Y").to_matrix())
    b.ball(0.15, (0, 0.3, 0.56), "pink", sc=(1, 1, 0.75), u=10, v=6)                                      # udder
    neck = [(0, -0.46, 0.98), (0, -0.74, 0.74), (0, -0.9, 0.52)] if graze else [(0, -0.44, 1.02), (0, -0.66, 1.16), (0, -0.78, 1.26)]
    b.tube(neck, [0.27, 0.23, 0.2], coat, seg=10)
    F, rot = frame((0, -0.98, 0.4) if graze else (0, -0.92, 1.34), 1.05 if graze else 0.2)
    b.ball(1.0, F(0, 0, 0), body, sc=(0.24, 0.28, 0.24), u=12, v=8, rot=rot)
    b.ball(1.0, F(0, -0.22, -0.07), "pink", sc=(0.2, 0.15, 0.15), u=10, v=7, rot=rot)                       # muzzle
    for sg in (-1, 1):
        eye(b, F(sg * 0.18, -0.12, 0.07), 0.052, rot, sg); b.ball(0.022, F(sg * 0.07, -0.35, -0.04), "plum", u=6, v=4)
        b.ball(1.0, F(sg * 0.3, 0.06, 0.1), coat, sc=(0.12, 0.05, 0.07), u=8, v=5, rot=(rot[0], sg * 0.3, 0))  # ears
        cone(b, 0.05, 0.17, F(sg * 0.14, 0.08, 0.2), "cream", rot=(rot[0], sg * 0.5, 0))                    # horns
    b.ball(0.13, F(0.02, 0.02, 0.2), patch, sc=(1.2, 1, 0.5), u=8, v=5, rot=rot)                             # a patch on the brow
    b.tube([(0, 0.7, 1.0), (0, 0.84, 0.8), (0, 0.84, 0.5)], 0.035, coat, seg=6); b.ball(0.08, (0, 0.84, 0.44), patch, sc=(0.9, 0.9, 1.3), u=8, v=5)
    return dict(kind="animal", home="paddock", pose="graze" if graze else "stand", span=1.8)
@part("Cow", "yard")
def cow(b): return _cow(b, False)
@part("Cow_Graze", "yard")
def cow_graze(b): return _cow(b, True)

def _sheep(b, graze):
    wool = A("white"); face = P("sand")
    legs(b, [(sx * 0.15, sy * 0.24) for sx in (-1, 1) for sy in (-1, 1)], 0.065, 0.36, face, 0.3)
    for x, y, z, r, k in ((0, 0, 0.6, 0.33, None), (0.17, -0.2, 0.62, 0.22, "lt"), (-0.17, -0.2, 0.6, 0.22, None), (0.18, 0.2, 0.6, 0.22, None), (-0.18, 0.2, 0.62, 0.22, "lt"),
                          (0, -0.02, 0.84, 0.23, "lt"), (0, 0.34, 0.66, 0.2, None), (0.12, 0.0, 0.42, 0.2, "dk"), (-0.12, 0.0, 0.42, 0.2, "dk"), (0, -0.33, 0.7, 0.19, "lt"), (0, 0.4, 0.74, 0.09, "lt")):
        b.ball(r, (x, y, z), A("white", k) if k else wool, u=10, v=7)
    F, rot = frame((0, -0.56, 0.3) if graze else (0, -0.5, 0.78), 1.0 if graze else 0.15)
    b.ball(1.0, F(0, 0, 0), tn(face, 0.3, 0.8, 0.3), sc=(0.14, 0.19, 0.15), u=10, v=8, rot=rot)
    b.ball(0.11, F(0, 0.1, 0.12), A("white", "lt"), sc=(1.2, 1, 0.8), u=8, v=6)                              # a tuft between the ears
    for sg in (-1, 1):
        eye(b, F(sg * 0.105, -0.08, 0.04), 0.036, rot, sg)
        b.ball(1.0, F(sg * 0.19, 0.06, 0.03), face, sc=(0.085, 0.04, 0.05), u=8, v=5, rot=(rot[0], sg * 0.5, 0))
    b.ball(0.028, F(0, -0.19, -0.02), "pink", sc=(1.2, 0.6, 0.8), u=6, v=4)
    return dict(kind="animal", home="lawn", pose="graze" if graze else "stand", span=0.9)
@part("Sheep", "yard")
def sheep(b): return _sheep(b, False)
@part("Sheep_Graze", "yard")
def sheep_graze(b): return _sheep(b, True)

def _chicken(b, peck):
    coat = A("white"); body = tn(coat, 0.3, 0.8, 0.3); tilt = 0.75 if peck else 0.0
    for sg in (-1, 1):
        b.cyl(0.018, 0.2, (sg * 0.07, 0.02, 0), "gold", seg=6)
        for a in (-0.5, 0, 0.5): b.ball(1.0, (sg * 0.07 + 0.04 * sin(a), -0.03 - 0.02 * cos(a), 0.012), "gold", sc=(0.014, 0.04, 0.012), u=6, v=4, rot=(0, 0, -a))
    F, rot = frame((0, 0.02, 0.33), tilt)
    b.ball(1.0, F(0, 0, 0), body, sc=(0.19, 0.24, 0.19), u=12, v=8, rot=rot)
    for k, a in enumerate((-0.35, 0, 0.35)): b.ball(1.0, F(0.06 * sin(a) * 2, 0.2, 0.13 + 0.03 * (k == 1)), A("white", "lt"), sc=(0.05, 0.1, 0.14), u=8, v=5, rot=(rot[0] - 0.5, 0, a))      # tail
    for sg in (-1, 1): b.ball(1.0, F(sg * 0.17, 0.03, 0.0), A("white", "dk"), sc=(0.05, 0.16, 0.11), u=8, v=6, rot=(rot[0] - 0.2, 0, 0))                                                # wings
    H, hr = frame(F(0, -0.2, 0.17), tilt * 1.1)
    b.ball(0.115, H(0, 0, 0), coat, u=10, v=8)
    cone(b, 0.045, 0.1, H(0, -0.1, -0.01), "gold", rot=(hr[0] + pi / 2, 0, 0), seg=6)
    b.ball(0.035, H(0, -0.09, -0.07), "red", sc=(0.8, 0.8, 1.4), u=6, v=5)
    for k, y in enumerate((-0.05, 0.0, 0.05)): b.ball(0.04 - 0.004 * k, H(0, y, 0.11 - 0.012 * k), "red", sc=(0.6, 1, 1), u=6, v=5)
    for sg in (-1, 1): eye(b, H(sg * 0.085, -0.055, 0.02), 0.026, hr, sg)
    return dict(kind="animal", home="yard", pose="peck" if peck else "stand", span=0.5)
@part("Chicken", "yard")
def chicken(b): return _chicken(b, False)
@part("Chicken_Peck", "yard")
def chicken_peck(b): return _chicken(b, True)

@part("Chick", "yard")
def chick(b):
    c = A("yellow")
    b.ball(1.0, (0, 0.01, 0.1), tn(c, 0.3, 0.8, 0.3), sc=(0.085, 0.1, 0.085), u=10, v=8); b.ball(0.07, (0, -0.06, 0.2), c, u=10, v=8)
    cone(b, 0.022, 0.05, (0, -0.125, 0.195), "orange", rot=(pi / 2, 0, 0), seg=6)
    for sg in (-1, 1):
        eye(b, (sg * 0.05, -0.1, 0.215), 0.016, None, sg); b.ball(1.0, (sg * 0.035, -0.02, 0.008), "orange", sc=(0.02, 0.035, 0.008), u=6, v=4)
        b.ball(1.0, (sg * 0.08, 0.02, 0.1), A("yellow", "dk"), sc=(0.02, 0.05, 0.04), u=6, v=5)
    return dict(kind="animal", home="yard", pose="stand", span=0.27)

def _duck(b, swim):
    c = A("white"); z0 = 0.0 if swim else 0.14
    if not swim:
        for sg in (-1, 1):
            b.cyl(0.018, 0.16, (sg * 0.07, 0.03, 0), "orange", seg=6); b.ball(1.0, (sg * 0.07, -0.02, 0.012), "orange", sc=(0.05, 0.07, 0.012), u=8, v=4)
    b.ball(1.0, (0, 0.03, z0 + 0.13), tn(c, 0.3, 0.8, 0.3), sc=(0.16, 0.25, 0.14), u=12, v=8)
    cone(b, 0.07, 0.14, (0, 0.24, z0 + 0.16), A("white", "lt"), rot=(-0.9, 0, 0), seg=8)                        # tail
    for sg in (-1, 1): b.ball(1.0, (sg * 0.14, 0.05, z0 + 0.15), A("white", "dk"), sc=(0.04, 0.17, 0.085), u=8, v=6)
    b.tube([(0, -0.14, z0 + 0.2), (0, -0.19, z0 + 0.32), (0, -0.2, z0 + 0.4)], [0.07, 0.06, 0.06], c, seg=8)
    b.ball(0.095, (0, -0.21, z0 + 0.43), c, u=10, v=8)
    b.ball(1.0, (0, -0.33, z0 + 0.4), "orange", sc=(0.055, 0.075, 0.024), u=8, v=5)
    for sg in (-1, 1): eye(b, (sg * 0.07, -0.26, z0 + 0.46), 0.022, None, sg)
    return dict(kind="animal", home="pond", pose="swim" if swim else "stand", span=0.5, floats=bool(swim))
@part("Duck", "pond")
def duck(b): return _duck(b, False)
@part("Duck_Swim", "pond")
def duck_swim(b): return _duck(b, True)

@part("Cat_Sit", "yard")
def cat_sit(b):
    c = A("orange"); body = tn(c, 0.3, 0.8, 0.3)
    b.ball(1.0, (0, 0.03, 0.2), body, sc=(0.15, 0.17, 0.21), u=12, v=8)
    b.ball(1.0, (0, -0.07, 0.19), "cream", sc=(0.1, 0.09, 0.15), u=10, v=7)                                   # chest
    for sg in (-1, 1):
        b.ball(1.0, (sg * 0.06, -0.14, 0.035), "cream", sc=(0.04, 0.06, 0.035), u=8, v=5)                     # front paws
        b.ball(1.0, (sg * 0.13, 0.02, 0.06), c, sc=(0.06, 0.1, 0.06), u=8, v=5)                               # haunches
    b.ball(1.0, (0, -0.05, 0.47), body, sc=(0.15, 0.13, 0.125), u=12, v=8)
    b.ball(1.0, (0, -0.15, 0.435), "cream", sc=(0.07, 0.045, 0.045), u=8, v=5); b.ball(0.016, (0, -0.19, 0.45), "pink", u=6, v=4)
    for sg in (-1, 1):
        eye(b, (sg * 0.065, -0.155, 0.5), 0.028, None, sg)
        cone(b, 0.055, 0.1, (sg * 0.09, -0.03, 0.56), c, rot=(0, sg * 0.3, 0), seg=6); cone(b, 0.03, 0.06, (sg * 0.088, -0.045, 0.572), "pink", rot=(0, sg * 0.3, 0), seg=6)
        for k in (0, 1): b.tube([(sg * 0.05, -0.17, 0.43 + 0.012 * k), (sg * 0.2, -0.17, 0.44 + 0.03 * k)], 0.004, "white", seg=4)                # whiskers
    b.tube([(0, 0.17, 0.06), (0.14, 0.2, 0.05), (0.22, 0.08, 0.05), (0.2, -0.06, 0.06)], [0.045, 0.045, 0.04, 0.03], c, seg=8)
    b.ball(0.036, (0.2, -0.07, 0.06), "cream", u=6, v=5)
    return dict(kind="animal", home="porch", pose="sit", span=0.6)

# ---------------------------------------------------------------- in the air
def _smooth(pts, n=3):
    """Chaikin: round off a closed outline, so a wing has curved edges, not corners."""
    for _ in range(n):
        q = []
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            q += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        pts = q
    return pts
def _inset(pts, k):
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    return [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in pts]
# A butterfly's wings as a picture book draws them: a big rounded forewing reaching forward and out, a smaller round
# hindwing behind it, each with a dark border round its edge and pale spots near the edge. Both are convex outlines,
# rounded off, so they read as soft shapes (the old one outline with corners read as cut card).
FORE = _smooth([(0.0, -0.03), (0.06, -0.15), (0.17, -0.22), (0.25, -0.18), (0.23, -0.06), (0.12, -0.005)])
HIND = _smooth([(0.0, 0.0), (0.12, 0.0), (0.19, 0.06), (0.16, 0.15), (0.08, 0.175), (0.02, 0.1)])
WING = FORE
def _wing(b, mtx):
    """One right wing: flat, its inner edge on the Y axis. The border is the whole shape in the dark colour; the
    main colour is the shape drawn a little smaller and a little thicker, so it shows on both faces inside the border
    and the two never share a face."""
    for shape, spots in ((FORE, ((0.2, -0.17, 0.018), (0.215, -0.1, 0.014))), (HIND, ((0.13, 0.12, 0.02),))):
        b.prism(shape, 0.01, A("pink", "dk"), mtx=mtx @ Matrix.Translation((0, 0, -0.005)))
        b.prism(_inset(shape, 0.8), 0.014, A("pink"), mtx=mtx @ Matrix.Translation((0, 0, -0.007)))
        for x, y, r in spots: b.cyl(r, 0.018, tuple(mtx @ Vector((x, y, -0.009))), P("yellow"), seg=12, rot=mtx.to_3x3())
def _bfly_body(b):
    for y, r in ((-0.07, 0.022), (-0.03, 0.026), (0.02, 0.024), (0.07, 0.018)): b.ball(r, (0, y, 0), "plum", u=6, v=5)
    for sg in (-1, 1): b.tube([(sg * 0.008, -0.085, 0.01), (sg * 0.03, -0.13, 0.05), (sg * 0.045, -0.14, 0.07)], 0.004, "plum", seg=4); b.ball(0.009, (sg * 0.045, -0.14, 0.072), "plum", u=5, v=4)
@part("Butterfly", "air")
def butterfly(b):
    _bfly_body(b)
    for sg in (-1, 1): _wing(b, Matrix.Rotation(-sg * 0.6, 4, "Y") @ Matrix.Scale(sg, 4, (1, 0, 0)) @ Matrix.Translation((0.012, 0, 0)))
    return dict(kind="flier", home="flowers", span=0.5, flap="swap the wings for two Butterfly_Wing turned about Y")
@part("Butterfly_Body", "air")
def butterfly_body(b): _bfly_body(b); return dict(kind="part", of="Butterfly")
@part("Butterfly_Wing", "air")
def butterfly_wing(b): _wing(b, Matrix.Translation((0.012, 0, 0))); return dict(kind="part", of="Butterfly", hinge=[0.0, 0.0, 0.0], axis="Y", mirror="X")

def _bird(b, fly):
    c = A("blue"); body = tn(c, 0.3, 0.8, 0.3); z = 0.13 if not fly else 0.0
    b.ball(1.0, (0, 0.01, z), body, sc=(0.12, 0.15, 0.12), u=12, v=8)
    b.ball(1.0, (0, -0.045, z - 0.025), "cream", sc=(0.09, 0.1, 0.085), u=10, v=7)                              # belly
    cone(b, 0.032, 0.075, (0, -0.145, z + 0.03), "gold", rot=(pi / 2, 0, 0), seg=6)
    for sg in (-1, 1): eye(b, (sg * 0.07, -0.11, z + 0.055), 0.022, None, sg)
    b.ball(0.035, (0, -0.02, z + 0.12), A("blue", "lt"), sc=(0.7, 1.2, 1), u=6, v=5)                           # crest
    if fly:
        for sg in (-1, 1):
            b.prism([(0.0, -0.07), (0.16, -0.1), (0.3, -0.04), (0.33, 0.03), (0.2, 0.06), (0.0, 0.07)], 0.022, A("blue", "dk"), mtx=Matrix.Translation((sg * 0.09, 0.0, 0.03)) @ Matrix.Rotation(-sg * 0.35, 4, "Y") @ Matrix.Scale(sg, 4, (1, 0, 0)))
        for a in (-0.35, 0, 0.35): b.prism([(-0.03, 0), (0.03, 0), (0.04, 0.16), (-0.04, 0.16)], 0.016, A("blue", "dk") if a else c, mtx=Matrix.Translation((0, 0.12, -0.008 * (a != 0))) @ Matrix.Rotation(-a, 4, "Z"))
    else:
        for sg in (-1, 1):
            b.ball(1.0, (sg * 0.105, 0.03, z + 0.01), A("blue", "dk"), sc=(0.03, 0.11, 0.07), u=8, v=6)
            b.cyl(0.008, 0.05, (sg * 0.04, 0.0, 0), "gold", seg=5); b.ball(1.0, (sg * 0.04, -0.015, 0.006), "gold", sc=(0.022, 0.03, 0.006), u=6, v=4)
        b.prism([(-0.035, 0), (0.035, 0), (0.045, 0.15), (-0.045, 0.15)], 0.018, A("blue", "dk"), mtx=Matrix.Translation((0, 0.1, z + 0.02)) @ Matrix.Rotation(0.35, 4, "X"))
    return dict(kind="flier", home="roofs", pose="fly" if fly else "perch", span=0.3 if not fly else 0.68)
@part("Bird", "air")
def bird(b): return _bird(b, False)
@part("Bird_Fly", "air")
def bird_fly(b): return _bird(b, True)

# ---------------------------------------------------------------- effects
@part("Smoke_Puff", "effect")
def smoke_puff(b):
    for x, y, z, r, k in ((0, 0, 0.0, 0.2, None), (0.14, 0.03, 0.08, 0.15, "lt"), (-0.13, -0.02, 0.07, 0.14, "dk"), (0.02, -0.04, 0.2, 0.13, "lt")):
        b.ball(r, (x, y, z), "white_" + k if k else "white", u=10, v=7)
    return dict(kind="effect", home="chimney", span=0.5, use="rises 2 m while growing to twice its size, then is drawn no more")
@part("Ripple", "effect")
def ripple(b):
    for r, w in ((0.5, 0.045), (0.3, 0.03)): b.lathe([(r - w, 0.004), (r + w, 0.004)], m="water_light", seg=28, cap=False)
    return dict(kind="effect", home="water", span=1.1, floats=True, use="lies on water: grows to three times its size and is drawn no more")

# ---------------------------------------------------------------- the visitor's boat
def hull_ring(L, W, z, k=1.0, n=28):
    """A boat-shaped ring at height z: pointed at the bow (-Y), round at the stern. Anticlockwise seen from above."""
    out = []
    for i in range(n):
        t = tau * i / n; s, c = sin(t), cos(t)
        y = -c * L / 2 * (1.0 if c > 0 else 0.86); x = (abs(s) ** (1.5 if c > 0 else 0.85)) * (1 if s >= 0 else -1) * W / 2
        out.append(Vector((x * k, y * (0.9 + 0.1 * k), z)))
    return out
@part("Boat", "boat")
def boat(b):
    """A small sailing boat for a visitor: 3.8 m long. Its origin is on the water line."""
    L, W = 3.8, 1.6; hull = A("red"); ins = "wood"
    rings = [hull_ring(L, W, -0.34, 0.3), hull_ring(L, W, -0.2, 0.72), hull_ring(L, W, 0.12, 0.95), hull_ring(L, W, 0.36, 1.0), hull_ring(L, W, 0.42, 1.0), hull_ring(L, W, 0.42, 0.9), hull_ring(L, W, 0.34, 0.88), hull_ring(L, W, 0.07, 0.8)]      # the floor is above the water line, or the sea would show inside the hull
    t = bmesh.new(); Vv = [[t.verts.new(p) for p in r] for r in rings]; n = len(Vv[0])
    mats = [derive(hull, "dk"), hull, hull, "cream", "cream", "cream", ins]
    for k in range(len(Vv) - 1):
        mi_ = b.mi(mats[k])
        for i in range(n): j = (i + 1) % n; t.faces.new((Vv[k][i], Vv[k][j], Vv[k + 1][j], Vv[k + 1][i])).material_index = mi_
    t.faces.new(Vv[0][::-1]).material_index = b.mi(derive(hull, "dk")); t.faces.new(Vv[-1]).material_index = b.mi("wood_dk")
    b._add(t, None, None)
    for y in (0.75, -0.35): b.box((1.12 if y > 0 else 1.2, 0.3, 0.06), (0, y, 0.27), "wood_lt", r=0.02)        # thwarts
    b.cyl(0.055, 2.42, (0, -0.72, 0.05), tn("wood", 0.1, 0.92), seg=10); b.ball(0.08, (0, -0.72, 2.47), "cream", u=8, v=6)        # mast
    b.cyl(0.03, 1.5, (0, -0.62, 0.72), "wood_lt", seg=8, rot=(-pi / 2, 0, 0))                                 # boom
    sail = [(-0.66, 0.78), (0.8, 0.78), (-0.66, 2.34)]                                                       # in the boat's YZ plane, behind the mast
    b.prism(sail, 0.02, "cream", mtx=YZ(-0.01, 0, 0))
    b.prism([(-0.668, 1.2), (0.42, 1.2), (0.16, 1.48), (-0.668, 1.48)], 0.032, P("red"), mtx=YZ(-0.016, 0, 0))    # a stripe on the sail
    kbuild.sprout(b, (0, -0.72, 2.5), 0.34, rz=pi / 2)
    b.box((0.06, 0.34, 0.5), (0, 1.62, 0.02), "wood_dk", r=0.015); b.cyl(0.02, 0.6, (0, 1.2, 0.5), "wood_lt", seg=6, rot=(-pi / 2 + 0.3, 0, 0))      # rudder and tiller
    b.cyl(0.035, 0.34, (0, -1.5, 0.4), "wood", seg=8); b.ball(0.06, (0, -1.5, 0.76), "gold", u=8, v=6)        # bow post
    b.tube([(0.45, -1.2, 0.44), (0.62, -1.0, 0.3), (0.55, -0.9, 0.44)], 0.022, "rope", seg=5)                   # a coil of mooring line over the side
    return dict(kind="boat", home="dock", span=3.8, floats=True, seats=[0.0, 0.75, 0.3, 0.0, -0.35, 0.3])
