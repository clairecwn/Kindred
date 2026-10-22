"""Outdoor decor kit: the things the player sets out on the island. Every part is drawn in its own frame with the
ground at z = 0, the middle of its cells at the origin and its front towards -Y, in the same look as the item models
(fat and round, three values of each colour, cream trim, one emblem).
  paths    a 1 x 1 tile, an Edge that lies along the tile's -Y side and a Corner that sits on its (-X, -Y) corner.
           The game lays a tile in every path cell, an Edge on each side with no path next to it and a Corner where
           two such sides meet, turned in quarter turns.
  fences   a Post at the middle of the cell and a Rail from the post to the cell's +X side (half a bay). The game
           draws one Rail towards each neighbouring fence, so runs, corners and T joints need no other pieces. Rails
           look the same from both sides. A Gate takes one cell; its Leaf is a separate mesh with its origin on the
           hinge so it can swing.
  pond     Water tiles with an Edge, a Corner (outer) and an Inner (inner corner), laid by the same rule as paths.
Paint the player can change is the material KV_A_<colour> (main) and KV_B_<colour> (accent), see ktone.V.
A builder may return facts about the part (soil height, seat points, light points); k17 writes them on the mesh."""
import bpy, bmesh
from kk import *
from ktone import TB, tn, derive, V
import kbuild, gk
from math import atan
xf = gk._M
class SmoothTB(TB):
    """The decor builder. A ball or a rounded box is given enough faces for its size that its outline never shows
    corners up close (a knob of 8 x 5 faces read as a cut gem): a ball 8.5 cm or more in radius gets 10 faces round
    plus 5 for every 10 cm (up to 20), and three bevel steps on a rounded box bigger than 15 cm."""
    def ball(s, r, loc=(0, 0, 0), m="green", sc=(1, 1, 1), u=12, v=8, rot=None):
        size = r * max(sc); want = min(20, int(10 + size * 50))
        if size >= 0.085 and want > u: u, v = want, max(v, int(want * 0.6))
        return super().ball(r, loc, m, sc, u, v, rot)
    def box(s, size, loc=(0, 0, 0), m="cream", r=0.0, seg=2, rot=None):
        if r > 0 and min(size) > 0.15: seg = max(seg, 3)
        return super().box(size, loc, m, r, seg, rot)
KIT = []          # (name, builder, group, cells)
def part(name, group, cells=(1, 1)):
    def deco(fn): KIT.append((name, fn, group, cells)); return fn
    return deco
def A(col, kind=None): return V("A", col, kind)
def P(col, kind=None): return V("B", col, kind)

# ---------------------------------------------------------------- shared shapes
def rnd_poly(pts, k=0.24):
    """Cut the corners off an outline, so a prism of it reads as a rounded slab."""
    out = []; n = len(pts)
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        out.append(tuple(p1 + (p0 - p1) * k)); out.append(tuple(p1 + (p2 - p1) * k))
    return out
def shrink(pts, g):
    c = sum((Vector(p) for p in pts), Vector((0, 0))) / len(pts)
    return [tuple(c + (Vector(p) - c) * (1 - g / max((Vector(p) - c).length, 1e-3))) for p in pts]
def round_top(w, h, n=6):
    """An upright outline with a round top, standing on y = 0: a picket, a hedge section."""
    r = w / 2; return [(-r, 0), (r, 0)] + [(r * cos(pi * i / n), h - r + r * sin(pi * i / n)) for i in range(n + 1)]
def blossom(b, loc, r, petal, core="yellow", n=5, rot=(pi / 2, 0, 0)):
    """A flat five-petal flower. rot (pi/2, 0, 0) faces -Y, (-pi/2, 0, 0) faces +Y, (0, 0, 0) faces up."""
    k = 4 * n; pts = []
    for i in range(k):
        a = tau * i / k; q = r * (0.55 + 0.45 * abs(cos(n * a / 2)) ** 0.6); pts.append((q * cos(a), q * sin(a)))
    b.prism(pts, 0.04, petal, mtx=xf(loc, rot) @ Matrix.Translation((0, 0, -0.02)))
    b.ball(r * 0.36, loc, core, u=6, v=4)
def leaf(b, loc, l, m="leaf_light", rot=None):
    b.ball(1.0, loc, m, sc=(l, l * 0.5, l * 0.13), u=8, v=4, rot=rot)
def leaf_pair(b, loc, s=1.0, y=-1):
    """The two-leaf emblem on an upright face. y = -1: on a face that looks to -Y; +1: to +Y."""
    x, yy, z = loc
    for sg in (-1, 1): b.ball(1.0, (x + sg * 0.17 * s, yy, z), "leaf_light", sc=(0.17 * s, 0.02, 0.08 * s), u=8, v=4, rot=(0, -sg * 0.55, 0))
    b.box((0.045 * s, 0.03, 0.2 * s), (x, yy, z - 0.11 * s), "leaf_dark", r=0.008)
def pebble(b, x, y, r, m, k=0.55, rz=0.0): b.ball(r, (x, y, r * k), m, sc=(1.2, 0.95, k), u=8, v=5, rot=(0, 0, rz))
def knob(b, loc, r=0.1, m="cream"): b.ball(r, loc, m, u=8, v=5)
def foot(b, x, y, r, m):
    """The fat foot of a pole."""
    b.lathe([(0, 0), (r * 2.6, 0), (r * 2.8, 0.06), (r * 1.8, 0.15), (r * 1.25, 0.3), (r, 0.36)], (x, y, 0), mats=[m, m, m, m, m], seg=12)
def lantern(b, loc, s=1.0, m="gold"):
    """A hanging carriage lantern, as storybook porches and parks have them; loc is the point it hangs from: a ring,
    a small square roof with a finial, four corner posts round a glowing glass box, and a base with a drip knob.
    (The first one was a bell turned on a lathe, which read as a yellow cone.)"""
    x, y, z = loc; k = s
    b.lathe([(0.022 * k, 0.0), (0.03 * k, -0.02 * k), (0.022 * k, -0.04 * k)], (x, y, z), m=m, seg=12, cap=False)
    b.lathe([(0.0, -0.035 * k), (0.035 * k, -0.05 * k), (0.15 * k, -0.13 * k), (0.135 * k, -0.15 * k), (0.0, -0.15 * k)], (x, y, z), m=m, seg=4, rot=(0, 0, pi / 4))
    b.box((0.17 * k, 0.17 * k, 0.21 * k), (x, y, z - 0.26 * k), "glow")
    for sx in (-1, 1):
        for sy in (-1, 1): b.box((0.03 * k, 0.03 * k, 0.23 * k), (x + sx * 0.09 * k, y + sy * 0.09 * k, z - 0.26 * k), m, r=0.006)
    b.box((0.22 * k, 0.22 * k, 0.04 * k), (x, y, z - 0.385 * k), m, r=0.012); b.ball(0.035 * k, (x, y, z - 0.425 * k), m, u=10, v=6)
    return [round(x, 3), round(y, 3), round(z - 0.26 * s, 3)]

def slab(b, w, d, h, loc, m, ch=0.012, rz=0.0):
    """A low block with its top edge cut off: 20 triangles where a rounded box takes over a hundred. For the parts a
    path is made of, which repeat by the hundred."""
    t = bmesh.new(); x, y = w / 2, d / 2
    R = lambda a, c, z: [t.verts.new((sx * a, sy * c, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    lo, mid, top = R(x, y, 0.0), R(x, y, h - ch), R(x - ch, y - ch, h)
    for i in range(4):
        j = (i + 1) % 4; t.faces.new((lo[i], lo[j], mid[j], mid[i])); t.faces.new((mid[i], mid[j], top[j], top[i]))
    t.faces.new(top); t.faces.new(lo[::-1]); b._add(t, m, xf(loc, (0, 0, rz) if rz else None))

# ---------------------------------------------------------------- paths
@part("Path_Stone", "path")
def path_stone(b):
    """Four flagstones on a darker bed."""
    b.box((1, 1, 0.02), (0, 0, 0.01), "rock_dk")
    c0, c1, c2, c3 = (-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5); e0, e1, e2, e3 = (.1, -.5), (.5, -.05), (-.15, .5), (-.5, .1); p, q = (-.05, -.1), (.15, .12)
    for pts, m, h in (([c0, e0, p, e3], "rock", 0.05), ([e0, c1, e1, q, p], "rock_lt", 0.042), ([e1, c2, e2, q], "grey_lt", 0.05), ([e2, c3, e3, p, q], "rock", 0.044)):
        b.prism(rnd_poly(shrink(pts, 0.035)), h, m)
@part("Path_Stone_Edge", "path")
def edge_stone(b):
    for x, w, m, h in ((-0.33, 0.32, "rock", 0.1), (0.0, 0.3, "grey_lt", 0.085), (0.33, 0.32, "rock", 0.1)): slab(b, w, 0.12, h, (x, -0.435, 0), m, ch=0.03)
@part("Path_Stone_Corner", "path")
def corner_stone(b): b.ball(0.12, (-0.435, -0.435, 0.1), "rock", sc=(1, 1, 0.83), u=10, v=6)

@part("Path_Brick", "path")
def path_brick(b):
    """Terracotta bricks in a running bond on sand. The bond carries on from tile to tile."""
    b.box((1, 1, 0.02), (0, 0, 0.01), "sand_dk"); cols = ("terracotta", "terracotta_lt", "terracotta", "terracotta_dk")
    for j in range(4):
        y = -0.375 + 0.25 * j
        if j % 2 == 0:
            for i in range(2): slab(b, 0.46, 0.21, 0.045, (-0.25 + 0.5 * i, y, 0), cols[(i + j) % 4])
        else:
            slab(b, 0.46, 0.21, 0.045, (0, y, 0), cols[j])
            for sx in (-1, 1): slab(b, 0.21, 0.21, 0.045, (sx * 0.375, y, 0), cols[(j + 1 + (sx > 0)) % 4])
@part("Path_Brick_Edge", "path")
def edge_brick(b):
    for i in range(5): slab(b, 0.185, 0.11, 0.13, (-0.4 + 0.2 * i, -0.44, 0), ("terracotta", "terracotta_lt")[i % 2], ch=0.025)
@part("Path_Brick_Corner", "path")
def corner_brick(b):
    """A little brick pier where two path edges meet: two courses of brick under a cream cap."""
    for z, m in ((0.045, "terracotta"), (0.115, "terracotta_lt")): b.box((0.17, 0.17, 0.066), (-0.44, -0.44, z), m, r=0.015)
    b.box((0.2, 0.2, 0.04), (-0.44, -0.44, 0.168), "cream", r=0.015)

@part("Path_Wood", "path")
def path_wood(b):
    """A boardwalk: four planks on two bearers, with round nail heads."""
    for sx in (-1, 1): b.box((0.1, 1.0, 0.03), (sx * 0.3, 0, 0.015), "trunk_dk")
    for j in range(4):
        y = -0.375 + 0.25 * j; slab(b, 1.0, 0.225, 0.03, (0, y, 0.025), ("wood", "wood_lt", "wood", "wood_dk")[j], ch=0.01)
        b.cyl(0.022, 0.006, ((-0.3, 0.3)[j % 2], y, 0.055), "plum", seg=6)
@part("Path_Wood_Edge", "path")
def edge_wood(b): b.cyl(0.062, 1.008, (-0.504, -0.44, 0.062), tn("trunk", 0.3, 0.75), seg=10, rot=(0, pi / 2, 0))     # a hair long, so its ends are not in the plane of the plank ends
@part("Path_Wood_Corner", "path")
def corner_wood(b): b.cyl(0.085, 0.2, (-0.44, -0.44, 0), "trunk", seg=10, bev=0.02); b.cyl(0.065, 0.012, (-0.44, -0.44, 0.2), "trunk_light", seg=10)

@part("Path_Sand", "path")
def path_sand(b):
    """Soft sand with paler patches and a few pebbles."""
    b.box((1, 1, 0.035), (0, 0, 0.0175), "sand")
    for x, y, r in ((-.2, .15, .2), (.22, -.2, .16), (.1, .32, .1)): b.cyl(r, 0.005, (x, y, 0.035), "sand_lt", seg=10)
    for x, y, r, m in ((-.3, -.28, .05, "rock"), (.33, .2, .04, "grey_lt"), (-.05, -.05, .035, "rock_lt")): b.ball(r, (x, y, 0.04), m, sc=(1, .8, .5), u=7, v=4)
@part("Path_Sand_Edge", "path")
def edge_sand(b):
    for x, r, m in ((-0.38, 0.07, "rock"), (-0.18, 0.055, "grey_lt"), (0.04, 0.075, "rock_lt"), (0.26, 0.06, "rock"), (0.42, 0.05, "grey_lt")): pebble(b, x, -0.44, r, m, 0.8)
@part("Path_Sand_Corner", "path")
def corner_sand(b): pebble(b, -0.44, -0.44, 0.11, "grey_lt", 0.8)

@part("Path_Step", "path")
def path_step(b):
    """One big stepping stone, for a path with grass between the stones."""
    b.lathe([(0, 0), (0.4, 0), (0.43, 0.03), (0.4, 0.06), (0.26, 0.066), (0.2, 0.062), (0, 0.062)], mats=["rock_dk", "rock_dk", "rock", "rock_lt", "rock", "rock_lt"], seg=28)

def rose(b, p, r, m, core="yellow"):
    """A round rose that reads from every side (a flat five-petal disc only reads from the front): a cupped heart and
    five fat petals round it, tipped outward."""
    x, y, z = p
    b.ball(r * 0.55, (x, y, z + r * 0.15), derive(m, "dk") if isinstance(m, str) and m.startswith("KV_") else m, sc=(1, 1, 0.8), u=6, v=4)
    for i in range(5):
        t = tau * i / 5; b.ball(r * 0.5, (x + r * 0.55 * cos(t), y + r * 0.55 * sin(t), z), m, sc=(1.1, 0.8, 0.6), u=6, v=4, rot=(0, 0.5, t))
    b.ball(r * 0.18, (x, y, z + r * 0.42), core, u=5, v=3)

# ---------------------------------------------------------------- planting beds
def _soil(b, w, d, z):
    """Tilled earth: a dark bed with rounded ridges running across it and a few clods, as a garden game draws a
    planted bed."""
    b.box((w, d, 0.1), (0, 0, z - 0.05), "soil_dk"); n = max(2, round(d / 0.26))
    for i in range(n):
        y = -d / 2 + d * (i + 0.5) / n; b.ball(1.0, (0, y, z - 0.03), "soil", sc=(w / 2 - 0.03, d / n * 0.42, 0.06), u=14, v=6)
    for k in range(max(3, int(w * d * 6))):
        x = (((k * 37) % 100) / 100 - 0.5) * (w - 0.12); y = (((k * 61) % 100) / 100 - 0.5) * (d - 0.12)
        b.ball(0.022 + 0.008 * (k % 3), (x, y, z + 0.02), "soil_lt", sc=(1.2, 1, 0.7), u=6, v=4)
def _bed_wood(b, cw, cd):
    W, D, H = cw - 0.08, cd - 0.08, 0.34
    for sy in (-1, 1): b.box((W, 0.1, H), (0, sy * (D / 2 - 0.05), H / 2), tn("wood", 0.3, 0.8), r=0.03)
    for sx in (-1, 1): b.box((0.1, D - 0.2, H), (sx * (W / 2 - 0.05), 0, H / 2), tn("wood", 0.3, 0.8), r=0.03)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (W / 2 - 0.04), sy * (D / 2 - 0.04); b.cyl(0.075, H + 0.06, (x, y, 0), "wood_dk", seg=8); knob(b, (x, y, H + 0.09), 0.09)
    _soil(b, W - 0.2, D - 0.2, H - 0.07); leaf_pair(b, (0, -D / 2 - 0.005, H * 0.62), 0.6)
    return dict(soil=[round(H - 0.07, 3), round((W - 0.2) / 2, 3), round((D - 0.2) / 2, 3)])
@part("Bed_Wood_1x1", "bed", (1, 1))
def bed_wood_1(b): return _bed_wood(b, 1, 1)
@part("Bed_Wood_2x1", "bed", (2, 1))
def bed_wood_2(b): return _bed_wood(b, 2, 1)
@part("Bed_Wood_2x2", "bed", (2, 2))
def bed_wood_4(b): return _bed_wood(b, 2, 2)
@part("Bed_Stone_2x2", "bed", (2, 2))
def bed_stone(b):
    """A round bed in a ring of fat stones."""
    R = 0.8; n = 12
    for i in range(n):
        a = tau * i / n; r = 0.2 + 0.03 * ((i * 7) % 3)
        b.ball(r, (R * cos(a), R * sin(a), r * 0.62), ("rock", "grey_lt", "rock_lt")[i % 3], sc=(0.8, 1.15, 0.62), u=14, v=8, rot=(0, 0, a))
    b.lathe([(0.8, 0.02), (0.76, 0.16), (0.5, 0.25), (0, 0.27)], mats=["soil_dk", "soil", "soil"], seg=28)
    for k in range(9):                                                         # clods on the mound
        a = tau * k / 9 + 0.4; rr = 0.18 + 0.32 * ((k * 5) % 7) / 7
        b.ball(0.026 + 0.008 * (k % 3), (rr * cos(a), rr * sin(a), 0.255 - 0.06 * rr), "soil_lt", sc=(1.2, 1, 0.7), u=6, v=4)
    return dict(soil=[0.24, 0.55, 0.55])
@part("Bed_Brick_2x1", "bed", (2, 1))
def bed_brick(b):
    """A low brick wall with a cream coping."""
    W, D = 1.92, 0.92
    for sy in (-1, 1): b.box((W - 0.02, 0.12, 0.3), (0, sy * (D / 2 - 0.07), 0.15), "cream_dk"); b.box((W + 0.06, 0.2, 0.07), (0, sy * (D / 2 - 0.07), 0.33), "cream", r=0.03)
    for sx in (-1, 1): b.box((0.12, D - 0.26, 0.3), (sx * (W / 2 - 0.07), 0, 0.15), "cream_dk"); b.box((0.2, D - 0.34, 0.07), (sx * (W / 2 - 0.07), 0, 0.33), "cream", r=0.03)
    # three courses of fat rounded bricks laid on the mortar, every other course offset by half a brick (with a half
    # brick at each end), in warm tones that vary brick to brick
    BL, BH, T = 0.24, 0.085, ("terracotta", "terracotta_lt", "terracotta")
    for c in range(3):
        z = 0.05 + c * 0.1
        for sy in (-1, 1):                                                      # the long sides
            if c % 2 == 0: runs = [(-W / 2 + BL * (i + 0.5), BL) for i in range(int(round(W / BL)))]
            else: runs = [(-W / 2 + BL / 4, BL / 2)] + [(-W / 2 + BL * (i + 1), BL) for i in range(int(round(W / BL)) - 1)] + [(W / 2 - BL / 4, BL / 2)]
            for i, (x, L) in enumerate(runs): b.box((L - 0.018, 0.15, BH), (x, sy * (D / 2 - 0.07), z), T[(i + c) % 3], r=0.018, seg=1)
        for sx in (-1, 1):                                                      # the short ends, between the long sides
            n = 2; off = BL / 4 if c % 2 else -BL / 4
            for i in range(n): b.box((0.15, BL - 0.018, BH), (sx * (W / 2 - 0.07), (i - (n - 1) / 2) * BL + off, z), T[(i + c + 1) % 3], r=0.018, seg=1)
    _soil(b, W - 0.28, D - 0.28, 0.27)
    return dict(soil=[0.27, round((W - 0.28) / 2, 3), round((D - 0.28) / 2, 3)])
@part("Planter_Tub", "bed")
def planter_tub(b):
    """Half a barrel: bellied staves with a dark groove between each, two gold hoops, and earth inside."""
    b.lathe([(0, 0), (0.36, 0), (0.44, 0.22), (0.46, 0.42), (0.4, 0.42), (0.38, 0.36), (0, 0.36)], mats=["wood_dk", "wood_dk", "wood", "wood_lt", "wood_dk", "soil"], seg=32)
    for i in range(16):                                                       # the grooves between the staves
        t = tau * i / 16; c_, s_ = cos(t), sin(t)
        b.tube([(0.365 * c_, 0.365 * s_, 0.02), (0.445 * c_, 0.445 * s_, 0.22), (0.462 * c_, 0.462 * s_, 0.41)], 0.007, "wood_dk", seg=4)
    for r, z in ((0.385, 0.07), (0.448, 0.29)): b.lathe([(r - 0.012, z), (r + 0.03, z + 0.012), (r + 0.036, z + 0.058), (r - 0.006, z + 0.07)], m="gold", seg=32, cap=False)
    for sx in (-1, 1): knob(b, (sx * 0.49, 0, 0.325), 0.055, "gold")
    return dict(soil=[0.36, 0.28, 0.28])
@part("Planter_Urn", "bed")
def planter_urn(b):
    """A painted urn on a foot."""
    a, d, l = A("white"), A("white", "dk"), A("white", "lt")
    b.lathe([(0, 0), (0.3, 0), (0.3, 0.08), (0.2, 0.12), (0.12, 0.2), (0.12, 0.3), (0.3, 0.42), (0.42, 0.62), (0.44, 0.74), (0.48, 0.78), (0.46, 0.82), (0.36, 0.82), (0.34, 0.74), (0, 0.74)],
            mats=[d, d, d, d, d, a, a, a, l, l, l, "soil", "soil"], seg=28)
    blossom(b, (0, -0.4, 0.56), 0.11, P("pink"), "yellow", rot=(pi / 2 + 0.3, 0, 0))
    return dict(soil=[0.74, 0.24, 0.24])

# ---------------------------------------------------------------- fences
@part("Fence_Picket_Post", "fence")
def picket_post(b):
    b.box((0.15, 0.15, 0.96), (0, 0, 0.48), tn(A("white"), 0.14, 0.9), r=0.03)
    b.box((0.2, 0.2, 0.05), (0, 0, 0.975), A("white", "lt"), r=0.02); knob(b, (0, 0, 1.06), 0.09, A("white", "lt"))
@part("Fence_Picket_Rail", "fence")
def picket_rail(b):
    for z in (0.3, 0.72): b.box((0.5, 0.075, 0.08), (0.25, 0, z), A("white", "dk"))
    for x in (0.2, 0.4): b.prism(round_top(0.13, 0.86), 0.04, tn(A("white"), 0.14, 0.9), mtx=XZ(-0.02, x, 0.06))
@part("Fence_Ranch_Post", "fence")
def ranch_post(b): b.cyl(0.1, 0.98, (0, 0, 0), tn(A("wood"), 0.14, 0.88), seg=10, bev=0.02); b.cyl(0.075, 0.012, (0, 0, 0.98), A("wood", "lt"), seg=10)
@part("Fence_Ranch_Rail", "fence")
def ranch_rail(b):
    for z in (0.38, 0.74): b.cyl(0.05, 0.5, (0, 0, z), A("wood"), seg=8, rot=(0, pi / 2, 0))
# A garden wall of dry stone, as a storybook draws one: courses of fat rounded stones, every course split in a
# different place so the joints never line up, in three tones of stone, under a cream coping.
STONE = ("rock", "rock_lt", "grey_lt")
@part("Fence_Wall_Post", "fence")
def wall_post(b):
    b.box((0.34, 0.34, 0.84), (0, 0, 0.42), "rock_dk")                            # the mortar core, showing in the joints
    for k in range(4):
        b.box((0.39, 0.39, 0.19), (0.004 * (k % 2), -0.004 * (k % 2), 0.1 + 0.205 * k), STONE[k % 3], r=0.045, seg=2)
    b.box((0.47, 0.47, 0.1), (0, 0, 0.89), "cream", r=0.035); knob(b, (0, 0, 1.04), 0.13, "rock_lt")
@part("Fence_Wall_Rail", "fence")
def wall_rail(b):
    b.box((0.5, 0.22, 0.6), (0.25, 0, 0.3), "rock_dk")
    COURSES = ((0.0, 0.29, 0.5), (0.0, 0.15, 0.37, 0.5), (0.0, 0.22, 0.5))
    for k, cuts in enumerate(COURSES):
        z = 0.105 + 0.2 * k
        for i in range(len(cuts) - 1):
            x0, x1 = cuts[i], cuts[i + 1]; w = x1 - x0 - (0.012 if 0 < i < len(cuts) - 2 or len(cuts) == 3 else 0.006)
            b.box((w, 0.27, 0.19), ((x0 + x1) / 2, 0, z), STONE[(i + k) % 3], r=0.04, seg=2)
    b.box((0.5, 0.33, 0.08), (0.25, 0, 0.66), "cream", r=0.02)
# A hedge is drawn the way the bushes on the island are: a few overlapping leafy puffs, each lit on top and shaded
# underneath (kgreen.puff), so its outline is soft and lumpy like clipped leaves instead of one smooth plastic shape.
@part("Fence_Hedge_Post", "fence")
def hedge_post(b):
    """A clipped hedge, built of many small leafy puffs packed into its shape, so its outline is bumpy all over like
    clipped leaves (a few big puffs read as boulders)."""
    import kgreen
    P_ = []
    for k, z in enumerate((0.14, 0.44, 0.72)):
        for i in range(5):
            t = tau * (i + 0.5 * (k % 2)) / 5; P_.append(((0.17 * cos(t), 0.17 * sin(t), z), 0.155, (1, 1, 1), (14, 9)))
    P_ += [((0, 0, 0.84), 0.15, (1, 1, 0.85), (14, 9)), ((0, 0, 0.45), 0.2, (1, 1, 1.6), (8, 5))]
    kgreen.puff(b, P_, "deep", floor=0.0)
@part("Fence_Hedge_Rail", "fence")
def hedge_rail(b):
    import kgreen
    P_ = []
    for k, z in enumerate((0.14, 0.44, 0.72)):
        for i, x in enumerate((0.04, 0.24, 0.44)):
            for sy in (-1, 1): P_.append(((x + 0.06 * (k % 2), sy * 0.12, z), 0.15, (1, 1, 1), (14, 8)))
    for x in (0.08, 0.3, 0.5): P_.append(((x, 0.0, 0.8), 0.14, (1, 1, 0.85), (14, 8)))
    P_.append(((0.25, 0.0, 0.45), 0.24, (1.3, 0.6, 1.4), (8, 5)))                                     # the core, so no gap shows through
    kgreen.puff(b, P_, "deep", floor=0.0)
    bmesh.ops.bisect_plane(b.bm, geom=b.bm.verts[:] + b.bm.edges[:] + b.bm.faces[:], plane_co=(0.5, 0, 0), plane_no=(1, 0, 0), clear_outer=True)   # it ends on the cell edge, where the next rail begins
    pts = sorted({(round(v.co.y, 5), round(v.co.z, 5)) for v in b.bm.verts if abs(v.co.x - 0.5) < 1e-4})
    if len(pts) > 2:                                     # close the cut with its outline (a convex hull), so a rail seen on its own is not hollow
        def half(ps):
            h = []
            for q in ps:
                while len(h) > 1 and (h[-1][0] - h[-2][0]) * (q[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (q[0] - h[-2][0]) <= 0: h.pop()
                h.append(q)
            return h
        hull = half(pts)[:-1] + half(pts[::-1])[:-1]
        f = b.bm.faces.new([b.bm.verts.new((0.4995, y, z)) for y, z in hull]); f.material_index = b.mi(kgreen.leafmat("canopyDeep"))
    rose(b, (0.16, -0.27, 0.52), 0.06, P("pink")); rose(b, (0.36, 0.27, 0.38), 0.06, P("pink", "lt"))
@part("Fence_Rope_Post", "fence")
def rope_post(b):
    b.cyl(0.085, 0.8, (0, 0, 0), tn("wood", 0.14, 0.88), seg=10, bev=0.02); b.lathe([(0.1, 0.78), (0.11, 0.82), (0.06, 0.9), (0, 0.92)], m="gold", seg=10)
    b.lathe([(0.085, 0.6), (0.108, 0.615), (0.108, 0.685), (0.085, 0.7)], m="gold", seg=10, cap=False)
@part("Fence_Rope_Rail", "fence")
def rope_rail(b):
    """A thick rope hanging from the post: two strands twisted round each other, so it reads as rope, not a plank."""
    C = [(0.05, 0.65), (0.2, 0.58), (0.34, 0.535), (0.43, 0.52), (0.5, 0.52)]
    pts = []
    for i in range(24):                                                          # the hang, smoothly, at even steps
        u = i / 23 * (len(C) - 1); k = min(int(u), len(C) - 2); f = u - k
        pts.append(Vector((C[k][0] + (C[k + 1][0] - C[k][0]) * f, 0, C[k][1] + (C[k + 1][1] - C[k][1]) * f)))
    for ph in (0.0, pi):
        strand = []
        for i, p in enumerate(pts):
            th = tau * 3.0 * i / 23 + ph; strand.append((p.x, 0.016 * cos(th), p.z + 0.016 * sin(th)))
        strand[-1] = (0.5, strand[-1][1], strand[-1][2])
        b.tube(strand, 0.022, "rope" if ph == 0 else tn("rope", None, 0.85), seg=7)
    bmesh.ops.bisect_plane(b.bm, geom=b.bm.verts[:] + b.bm.edges[:] + b.bm.faces[:], plane_co=(0.5, 0, 0), plane_no=(1, 0, 0), clear_outer=True)   # ends on the cell edge, where the next rail's rope carries on

def _leaf_of_gate(b, col, kind):
    """A gate leaf, origin on the hinge at the ground, running 0.66 m along +X."""
    W = 0.66; a = A(col)
    if kind == "picket":
        for i in range(4):
            x = 0.085 + 0.163 * i; b.prism(round_top(0.13, 0.78 + 0.18 * sin(pi * x / W)), 0.04, tn(a, 0.14, 0.9), mtx=XZ(-0.02, x, 0.1))
        for z in (0.32, 0.7): b.box((W - 0.02, 0.07, 0.08), (W / 2, 0, z), A(col, "dk"))
    else:
        for z in (0.3, 0.6, 0.9): b.cyl(0.045, W, (0, 0, z), a, seg=8, rot=(0, pi / 2, 0))
        for x in (0.05, W - 0.05): b.cyl(0.05, 0.84, (x, 0, 0.18), tn(a, 0.14, 0.88), seg=8)
    b.box((0.7, 0.05, 0.06), (W / 2, 0, 0.51), A(col, "dk"), rot=(0, -0.52, 0))
    for z in (0.32, 0.7): b.box((0.14, 0.02, 0.05), (0.05, -0.045, z), "gold", r=0.008)
    knob(b, (W - 0.07, -0.06, 0.78), 0.045, "gold")
@part("Gate_Picket", "fence")
def gate_picket(b):
    for sx in (-1, 1): b.box((0.16, 0.16, 1.25), (sx * 0.42, 0, 0.625), tn(A("white"), 0.12, 0.9), r=0.03); knob(b, (sx * 0.42, 0, 1.32), 0.11, A("white", "lt"))
    return dict(hinge=[-0.33, 0.0, 0.0], leaf="KD_Gate_Picket_Leaf")
@part("Gate_Picket_Leaf", "fence")
def gate_picket_leaf(b): _leaf_of_gate(b, "white", "picket")
@part("Gate_Ranch", "fence")
def gate_ranch(b):
    for sx in (-1, 1): b.cyl(0.11, 1.2, (sx * 0.42, 0, 0), tn(A("wood"), 0.12, 0.9), seg=10, bev=0.02); b.cyl(0.085, 0.012, (sx * 0.42, 0, 1.2), A("wood", "lt"), seg=10)
    return dict(hinge=[-0.33, 0.0, 0.0], leaf="KD_Gate_Ranch_Leaf")
@part("Gate_Ranch_Leaf", "fence")
def gate_ranch_leaf(b): _leaf_of_gate(b, "wood", "ranch")

# ---------------------------------------------------------------- lamps (each returns where its light is)
@part("Lamp_Post", "lamp")
def lamp_post(b):
    """A street lamp with one big glowing globe."""
    a = A("teal"); foot(b, 0, 0, 0.09, A("teal", "dk")); b.cyl(0.075, 2.25, (0, 0, 0.32), tn(a, 0.1, 0.9), seg=10)
    b.lathe([(0.075, 1.3), (0.11, 1.32), (0.11, 1.4), (0.075, 1.42)], m="gold", seg=10, cap=False)
    b.lathe([(0.075, 2.5), (0.17, 2.56), (0.21, 2.64), (0.2, 2.68), (0.0, 2.68)], m="gold", seg=12)
    b.ball(0.28, (0, 0, 2.9), "glow", u=12, v=8)
    b.lathe([(0.2, 3.1), (0.25, 3.13), (0.1, 3.26), (0, 3.3)], mats=[A("teal", "dk"), a, A("teal", "lt")], seg=12); knob(b, (0, 0, 3.33), 0.055, "gold")
    for sg in (-1, 1): leaf(b, (sg * 0.24, 0, 2.52), 0.2, "leaf_light", rot=(0, -sg * 0.5, 0))
    return dict(light=[0, 0, 2.9])
@part("Lamp_Double", "lamp")
def lamp_double(b):
    """A taller post with a lantern hanging from each of two curled arms."""
    a = A("navy"); foot(b, 0, 0, 0.09, A("navy", "dk")); b.cyl(0.075, 2.75, (0, 0, 0.32), tn(a, 0.1, 0.9), seg=10); knob(b, (0, 0, 3.12), 0.11, "gold")
    b.lathe([(0.075, 1.3), (0.11, 1.32), (0.11, 1.4), (0.075, 1.42)], m="gold", seg=10, cap=False); L = []
    for sx in (-1, 1):
        b.tube([(0, 0, 2.7), (sx * 0.25, 0, 2.95), (sx * 0.52, 0, 2.95), (sx * 0.62, 0, 2.82), (sx * 0.6, 0, 2.7)], 0.035, a, seg=6); L += lantern(b, (sx * 0.6, 0, 2.72), 1.1)
    return dict(light=L)
@part("Lamp_Lantern", "lamp")
def lamp_lantern(b):
    """A knee-high stone lantern for the side of a path."""
    b.box((0.34, 0.34, 0.5), (0, 0, 0.25), tn("rock", 0.25, None), r=0.05); b.box((0.42, 0.42, 0.07), (0, 0, 0.535), "cream", r=0.025)
    b.box((0.25, 0.25, 0.3), (0, 0, 0.72), "glow", r=0.02)
    for sx in (-1, 1):
        for sy in (-1, 1): b.box((0.045, 0.045, 0.3), (sx * 0.125, sy * 0.125, 0.72), A("red", "dk"))
    b.lathe([(0.0, 0.87), (0.3, 0.87), (0.31, 0.91), (0.1, 1.07), (0, 1.1)], mats=[A("red", "dk"), A("red", "dk"), A("red"), A("red", "lt")], seg=8); knob(b, (0, 0, 1.12), 0.05, "gold")
    return dict(light=[0, 0, 0.72])
@part("Lamp_Garland", "lamp", (4, 1))
def lamp_garland(b):
    """Two poles with a string of coloured bulbs between them."""
    for sx in (-1, 1): foot(b, sx * 1.8, 0, 0.07, A("white", "dk")); b.cyl(0.06, 2.4, (sx * 1.8, 0, 0.25), tn(A("white"), 0.1, 0.9), seg=8); knob(b, (sx * 1.8, 0, 2.7), 0.09, "gold")
    n = 9; pts = [(-1.8 + 3.6 * i / (n - 1), 0, 2.6 - 0.5 * sin(pi * i / (n - 1))) for i in range(n)]; b.tube(pts, 0.018, "plum", seg=5); L = []
    for i in range(1, n - 1):
        x, _, z = pts[i]; b.cyl(0.032, 0.06, (x, 0, z - 0.07), "plum", seg=6)
        b.ball(0.085, (x, 0, z - 0.15), ("glow", P("pink"), "glow", "sky")[i % 4], sc=(1, 1, 1.2), u=8, v=6); L += [round(x, 2), 0, round(z - 0.15, 2)]
    return dict(light=L)

# ---------------------------------------------------------------- seats (each returns the points to sit at: x, y, seat height, repeated)
@part("Seat_Bench", "seat", (2, 1))
def seat_bench(b):
    """A park bench: cream sides with round knobs, painted slats, the leaf emblem on the back."""
    a = A("teal")
    for sx in (-1, 1):
        x = sx * 0.8
        b.box((0.12, 0.12, 0.46), (x, -0.2, 0.23), tn("cream", 0.2, None), r=0.035); b.box((0.12, 0.12, 1.06), (x, 0.27, 0.53), tn("cream", 0.12, None), r=0.035, rot=(-0.1, 0, 0))
        b.box((0.13, 0.62, 0.08), (x, 0.02, 0.66), "cream", r=0.035); knob(b, (x, -0.3, 0.67), 0.08); knob(b, (x, 0.33, 1.1), 0.085)
    for i in range(3): b.box((1.5, 0.155, 0.06), (0, -0.2 + 0.17 * i, 0.47), (A("teal", "lt"), a, a)[i], r=0.02)
    for i, z in enumerate((0.66, 0.83, 1.0)): b.box((1.5, 0.05, 0.14), (0, 0.215 + 0.1 * (z - 0.53), z), (a, a, A("teal", "lt"))[i], r=0.02, rot=(-0.1, 0, 0))
    leaf_pair(b, (0, 0.205, 0.87), 0.7)
    return dict(seat=[-0.38, -0.08, 0.5, 0.38, -0.08, 0.5])
@part("Seat_Stump", "seat")
def seat_stump(b):
    """A log stool with rings on top and a sprout growing from its side."""
    b.lathe([(0, 0), (0.4, 0), (0.36, 0.08), (0.34, 0.4), (0.33, 0.43), (0.3, 0.445)], mats=["trunk_dk", "trunk_dk", "trunk", "trunk", "trunk_light"], seg=28, cap=False)
    b.lathe([(0.3, 0.445), (0.24, 0.45), (0.17, 0.45), (0.1, 0.452), (0.04, 0.452), (0, 0.453)], mats=["sand", "trunk_light", "sand", "trunk_light", "trunk"], seg=28, cap=False)   # the cut top, in rings
    for i in range(14):                                                        # bark ridges up the side
        t = tau * (i + 0.3 * (i % 2)) / 14; c_, s_ = cos(t), sin(t)
        b.tube([(0.37 * c_, 0.37 * s_, 0.035), (0.352 * c_, 0.352 * s_, 0.2), (0.342 * c_, 0.342 * s_, 0.41)], 0.018, "trunk_dk", seg=5)
    for i in range(4):                                                         # roots flaring into the grass
        t = tau * i / 4 + 0.5; c_, s_ = cos(t), sin(t)
        b.tube([(0.3 * c_, 0.3 * s_, 0.12), (0.44 * c_, 0.44 * s_, 0.04), (0.54 * c_, 0.54 * s_, 0.022)], [0.08, 0.055, 0.025], "trunk", seg=7)
    kbuild.sprout(b, (0.3, -0.24, 0.02), 0.34, 0.5)
    return dict(seat=[0, 0, 0.45])
@part("Seat_Swing", "seat", (3, 1))
def seat_swing(b):
    """A swing seat for two under a timber frame."""
    a = A("pink")
    for sx in (-1, 1):
        for sy in (-1, 1): b.tube([(sx * 1.3, sy * 0.46, 0.014), (sx * 1.3, 0.0, 2.25)], 0.065, "wood", seg=8)
        b.box((0.08, 0.5, 0.08), (sx * 1.3, 0, 1.0), "wood_dk", r=0.02); knob(b, (sx * 1.42, 0, 2.25), 0.1)
        for sy in (-0.2, 0.2): b.cyl(0.02, 1.5, (sx * 0.8, sy, 0.75), "rope", seg=5)
        b.box((0.07, 0.5, 0.06), (sx * 0.8, 0, 0.76), "cream", r=0.02); b.box((0.07, 0.07, 0.24), (sx * 0.8, -0.2, 0.64), "cream", r=0.02)
    b.cyl(0.075, 2.8, (-1.4, 0, 2.25), tn("wood", 0.3, 0.75), seg=10, rot=(0, pi / 2, 0))
    b.box((1.66, 0.5, 0.07), (0, -0.02, 0.52), A("pink", "dk"), r=0.03); b.box((1.66, 0.07, 0.56), (0, 0.25, 0.84), tn(a, None, 0.62), r=0.03, rot=(-0.12, 0, 0))
    b.box((1.44, 0.42, 0.09), (0, -0.05, 0.6), P("yellow"), r=0.04); blossom(b, (0, 0.2, 0.9), 0.1, "cream", "yellow", rot=(pi / 2 - 0.12, 0, 0))
    return dict(seat=[-0.36, -0.06, 0.65, 0.36, -0.06, 0.65])
@part("Seat_Picnic", "seat", (2, 2))
def seat_picnic(b):
    """A picnic table with a bench down each side, a runner and a potted flower."""
    for i in range(4): b.box((1.7, 0.2, 0.06), (0, -0.315 + 0.21 * i, 0.76), ("wood", "wood_lt")[i % 2], r=0.02)
    for sy in (-1, 1): b.box((1.7, 0.27, 0.06), (0, sy * 0.74, 0.45), tn("wood", None, 0.5), r=0.02)
    for sx in (-1, 1):
        x = sx * 0.6
        for sy in (-1, 1): b.tube([(x, sy * 0.86, 0.035), (x, sy * 0.2, 0.74)], 0.05, "wood_dk", seg=6)
        b.box((0.08, 1.72, 0.08), (x, 0, 0.385), "wood_dk", r=0.02)
    b.box((0.5, 0.93, 0.014), (0, 0, 0.797), P("red")); 
    for sy in (-1, 1): b.box((0.5, 0.014, 0.17), (0, sy * 0.458, 0.719), P("red"))
    for sx in (-1, 1): b.box((0.06, 0.94, 0.014), (sx * 0.15, 0, 0.801), "cream")
    b.lathe([(0, 0.8), (0.07, 0.8), (0.1, 0.92), (0.085, 0.92), (0, 0.9)], mats=["pot", "pot", "pot", "soil"], seg=10)
    b.tube([(0, 0, 0.9), (0.01, 0, 1.05)], 0.012, "leaf_dark", seg=5); blossom(b, (0.01, 0, 1.07), 0.075, "yellow", "orange", rot=(0.3, 0, 0))
    return dict(seat=[-0.45, -0.74, 0.48, 0.45, -0.74, 0.48, -0.45, 0.74, 0.48, 0.45, 0.74, 0.48])
def _ribbon(b, pts, t, w, mats, along="x", start=0.0):
    """A sagging strip of cloth in stripes. pts: its top line as (run, height); t: thickness; w: stripe width."""
    poly = list(pts) + [(p[0], p[1] - t) for p in reversed(pts)]
    for i, m in enumerate(mats):
        b.prism(poly, w, m, mtx=YZ(start + i * w, 0, 0) if along == "x" else XZ(start + i * w, 0, 0))
@part("Seat_Deckchair", "seat", (1, 2))
def seat_deckchair(b):
    """A folding deck chair with a striped sling."""
    line = []
    for i in range(9):
        t = i / 8; line.append((0.55 - 1.1 * t, 1.0 - 0.68 * t - 0.16 * sin(pi * t)))
    _ribbon(b, line, 0.025, 0.14, [A("red"), "cream", A("red"), "cream", A("red")], "x", -0.35)
    for sx in (-1, 1):
        x = sx * 0.39
        b.tube([(x, 0.62, 1.08), (x, -0.32, 0.03)], 0.035, "wood", seg=6); b.tube([(x, -0.62, 0.36), (x, 0.48, 0.035)], 0.035, "wood", seg=6)
        knob(b, (x, 0.62, 1.09), 0.055); knob(b, (x, -0.62, 0.37), 0.055)
    for y, z in ((0.55, 1.0), (-0.55, 0.32), (0.4, 0.03)): b.cyl(0.03, 0.78, (-0.39, y, z), "wood_dk", seg=6, rot=(0, pi / 2, 0))
    return dict(seat=[0, -0.12, 0.4])
@part("Seat_Hammock", "seat", (3, 1))
def seat_hammock(b):
    """A striped hammock between two posts, with a pillow."""
    line = []
    for i in range(11):
        t = i / 10; line.append((-1.05 + 2.1 * t, 1.0 - 0.5 * sin(pi * t)))
    _ribbon(b, line, 0.025, 0.15, [A("pink"), "cream", A("pink"), "cream", A("pink")], "y", -0.375)
    for sx in (-1, 1):
        b.tube([(sx * 1.25, 0, 0.008), (sx * 1.36, 0, 1.3)], 0.08, "wood", seg=8); knob(b, (sx * 1.37, 0, 1.36), 0.1, "gold")
        for sy in (-1, 1): b.tube([(sx * 1.35, 0, 1.22), (sx * 1.05, sy * 0.34, 0.99)], 0.018, "rope", seg=5)
    b.ball(1.0, (-0.66, 0, 0.74), P("yellow"), sc=(0.24, 0.3, 0.1), u=10, v=6, rot=(0, -0.45, 0))
    return dict(seat=[0.1, 0, 0.52])

# ---------------------------------------------------------------- arches (each returns the opening: width, height)
def _hoop(R, H, y, n=10): return [(-R, y, 0), (-R, y, H)] + [(-R * cos(pi * i / n), y, H + R * sin(pi * i / n)) for i in range(1, n)] + [(R, y, H), (R, y, 0)]
@part("Arch_Rose", "arch", (2, 1))
def arch_rose(b):
    """Two painted hoops joined by rungs, with a climber in flower over the top."""
    import kgreen
    R, H = 0.82, 1.75; a = A("white")
    for sy in (-0.22, 0.22): b.tube(_hoop(R, H, sy, 16), 0.048, a, seg=8)                 # two painted hoops
    for sx in (-1, 1):
        for z in (0.45, 0.85, 1.25): b.cyl(0.03, 0.44, (sx * R, -0.22, z), A("white", "dk"), seg=6, rot=(-pi / 2, 0, 0))
        # a terracotta pot at each foot, the rose's roots in it
        b.lathe([(0, 0), (0.2, 0), (0.25, 0.05), (0.27, 0.26), (0.3, 0.3), (0.29, 0.34), (0.24, 0.33), (0, 0.33)], (sx * R, 0, 0),
                mats=["terracotta", "terracotta", "terracotta", "terracotta_lt", "terracotta_lt", "terracotta", "soil"], seg=20)
    for i in range(1, 8):
        t = pi * i / 8; b.cyl(0.03, 0.44, (-R * cos(t), -0.22, H + R * sin(t)), A("white", "dk"), seg=6, rot=(-pi / 2, 0, 0))
    # the climber: round leafy clusters here and there up the posts and over the top, leaving the white hoops showing
    # between them, and big round roses on the clusters, as a storybook rose arch is drawn
    vine = []
    for sx in (-1, 1):
        for z in (0.62, 1.32): vine.append(((sx * R, 0.0, z), 0.19, (1.0, 1.35, 1.05), (14, 8)))
    for i in (1, 3, 5, 7):
        t = pi * i / 8; vine.append(((-R * cos(t), 0.0, H + R * sin(t)), 0.2, (1.05, 1.35, 1.0), (14, 8)))
    kgreen.puff(b, vine, "deep", seg=(14, 8))
    k = 0
    for (x, y, z), rr, sc_, uv in vine:
        for sy in (-1, 1):
            rose(b, (x + 0.06 * sy * (1 if x < 0 else -1), sy * 0.25, z + 0.06), 0.11, P("pink") if k % 3 else P("pink", "lt")); k += 1
        if k >= 12: break
    return dict(clear=[1.5, 2.5])
@part("Arch_Wood", "arch", (2, 1))
def arch_wood(b):
    """A timber gateway with curved braces and a lantern."""
    a = A("wood")
    for sx in (-1, 1):
        b.box((0.3, 0.3, 0.2), (sx * 0.84, 0, 0.1), "cream", r=0.05); b.box((0.2, 0.2, 2.5), (sx * 0.84, 0, 1.43), tn(a, 0.1, 0.9), r=0.04)
        b.prism([(0, 0), (0.5, 0.5), (0.5, 0.62), (0.3, 0.54), (0.1, 0.3), (-0.02, 0.1)] if sx < 0 else [(0, 0), (0.02, 0.1), (-0.1, 0.3), (-0.3, 0.54), (-0.5, 0.62), (-0.5, 0.5)], 0.12, A("wood", "dk"), mtx=XZ(-0.06, sx * 0.74, 2.0))
    b.box((2.4, 0.24, 0.24), (0, 0, 2.74), tn(a, 0.3, 0.75), r=0.05)
    for x in (-0.9, -0.3, 0.3, 0.9): b.box((0.14, 0.9, 0.12), (x, 0, 2.92), A("wood", "lt"), r=0.035)
    for sx in (-1, 1): knob(b, (sx * 1.22, 0, 2.74), 0.12)
    b.cyl(0.012, 0.2, (0, 0, 2.42), "plum", seg=5); L = lantern(b, (0, 0, 2.44), 1.2); leaf_pair(b, (0, -0.125, 2.78), 0.6)
    return dict(clear=[1.45, 2.6], light=L)
@part("Arch_Stone", "arch", (2, 1))
def arch_stone(b):
    """Two stone piers and a ring of blocks with a cream keystone."""
    for sx in (-1, 1):
        b.box((0.5, 0.6, 0.22), (sx * 0.85, 0, 0.11), "rock_dk", r=0.05); b.box((0.4, 0.5, 1.5), (sx * 0.85, 0, 0.95), tn("rock", 0.2, None), r=0.05)
        b.box((0.48, 0.58, 0.1), (sx * 0.85, 0, 1.73), "cream", r=0.035)
    for i in range(7):
        t = pi * (i + 0.5) / 7; key = i == 3
        b.box((0.5, 0.58, 0.46) if key else (0.4, 0.5, 0.4), (0.85 * cos(t), 0, 1.78 + 0.85 * sin(t)), "cream" if key else ("rock", "rock_lt")[i % 2], r=0.05, rot=(0, -t, 0))
    leaf_pair(b, (0, -0.3, 2.66), 0.62)
    return dict(clear=[1.3, 2.4])
@part("Pergola", "arch", (4, 3))
def pergola(b):
    """Four posts under beams and rafters, with a climber along the top and two lanterns."""
    a = A("white"); L = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((0.32, 0.32, 0.24), (sx * 1.7, sy * 1.2, 0.12), "rock", r=0.06); b.box((0.2, 0.2, 2.5), (sx * 1.7, sy * 1.2, 1.45), tn(a, 0.1, 0.9), r=0.04)
    for sy in (-1, 1): b.box((4.0, 0.16, 0.22), (0, sy * 1.2, 2.8), A("white", "dk"), r=0.04)
    for i in range(7): b.box((0.12, 3.1, 0.16), (-1.8 + 0.6 * i, 0, 2.98), a if i % 2 else A("white", "lt"), r=0.035)
    # the climber: leafy puffs that run along the beams and over the rafters and droop down at the ends, as wisteria
    # or a rose grows over a pergola, with flowers in small bunches (not flat discs laid on top)
    import kgreen
    vine = []                                            # one continuous leafy roof over the rafters: three rows of
    for j, y in enumerate((-1.1, 0.0, 1.1)):             # overlapping puffs, a little lumpy, hiding the rafter ends
        for i in range(7):
            x = -1.8 + 0.6 * i + 0.15 * (j % 2); vine.append(((x, y + 0.06 * sin(i * 2.1 + j), 3.04 + 0.07 * cos(i * 1.7 + j)), 0.4 - 0.04 * ((i + j) % 2), (1.0, 1.1, 0.72), (15, 9)))
    for x, sy in ((-1.7, -1), (1.7, 1), (-1.7, 1), (1.7, -1), (0.0, -1), (0.0, 1)):    # and droops down the posts and the beams
        vine.append(((x, sy * 1.3, 2.62), 0.22, (0.9, 0.9, 1.5), (12, 7)))
    kgreen.puff(b, vine, "deep", seg=(12, 7), shade=False)            # no dark rim underneath: seen from below it is all leaves
    for i, (x, y, z) in enumerate(((-1.45, -1.5, 2.82), (-0.2, -1.52, 2.78), (1.1, -1.5, 2.84), (-0.85, 1.5, 2.8), (0.5, 1.52, 2.83), (1.6, 1.48, 2.78), (-0.3, 0.45, 3.36), (0.9, -0.35, 3.35))):
        for q in range(4): b.ball(0.058, (x + 0.06 * cos(q * 1.7), y + 0.03 * sin(q * 1.7), z - 0.07 * q), P("pink") if q % 2 == 0 else P("pink", "lt"), u=6, v=3)
    for x, y, h in ((-1.5, -1.2, 0.5), (0.9, -1.2, 0.36), (1.5, 1.2, 0.46), (-0.3, 1.2, 0.3)):
        b.tube([(x, y - 0.09, 2.9), (x + 0.03, y - 0.1, 2.9 - h * 0.5), (x, y - 0.1, 2.9 - h)], 0.016, "leaf_dark", seg=5); leaf(b, (x + 0.02, y - 0.11, 2.9 - h), 0.12, "leaf_light", rot=(pi / 2, 0.6, 0))
    for x in (-0.9, 0.9): b.cyl(0.012, 0.22, (x, 0, 2.7), "plum", seg=5); L += lantern(b, (x, 0, 2.72), 1.2)
    return dict(clear=[3.2, 2.69], light=L)

# ---------------------------------------------------------------- pond
WATER = 0.07
def _pad(b, x, y, r, rz, m="leaf_light", z=WATER + 0.004):
    pts = [(0, 0)] + [(r * cos(0.35 + (tau - 0.7) * i / 9), r * sin(0.35 + (tau - 0.7) * i / 9)) for i in range(10)]
    b.prism(pts, 0.012, m, loc=(x, y, z), rot=(0, 0, rz))
def _lily(b, x, y, z, s=1.0, m="white"):
    for i in range(6):
        t = tau * i / 6; b.ball(1.0, (x + 0.055 * s * cos(t), y + 0.055 * s * sin(t), z + 0.045 * s), m, sc=(0.075 * s, 0.04 * s, 0.022 * s), u=6, v=4, rot=(0, -0.6, t))
    b.ball(0.035 * s, (x, y, z + 0.05 * s), "yellow", u=6, v=4)
@part("Pond_Water", "pond")
def pond_water(b):
    b.box((1, 1, WATER - 0.012), (0, 0, (WATER - 0.012) / 2), "water")      # the body; the surface is kwater's Tile (WATER_Pondtile_Pool), lined up across the pond
@part("Pond_Edge", "pond")
def pond_edge(b):
    for x, w, m, h, rz in ((-0.34, 0.3, "rock", 0.2, 0.0), (0.0, 0.27, "grey_lt", 0.17, -0.06), (0.34, 0.3, "rock", 0.2, 0.0)): b.box((w, 0.22, h), (x, -0.39, h / 2), m, r=0.07, rot=(0, 0, rz))
@part("Pond_Corner", "pond")
def pond_corner(b): b.box((0.32, 0.32, 0.23), (-0.37, -0.37, 0.115), "rock", r=0.1, rot=(0, 0, 0.78))
@part("Pond_Inner", "pond")
def pond_inner(b): b.ball(0.13, (-0.46, -0.46, 0.115), "grey_lt", sc=(1, 1, 0.88), u=8, v=5)
@part("Pond_Round", "pond", (2, 2))
def pond_round(b):
    """A small round pond in a ring of stones, with lily pads and a flower."""
    b.cyl(0.8, WATER - 0.012, (0, 0, 0), "water", seg=24)                  # the floor; the water itself is kwater's Pool (WATER_Pondround_Pool)
    for i in range(11):
        t = tau * i / 11; h = 0.2 + 0.03 * (i % 3)
        b.ball(1.0, (0.84 * cos(t), 0.84 * sin(t), h * 0.5), ("rock", "grey_lt", "rock_lt")[i % 3], sc=(0.17, 0.26, h / 2), u=14, v=8, rot=(0, 0, t))     # round pond stones
    _pad(b, -0.25, 0.2, 0.17, 0.5); _pad(b, 0.22, 0.28, 0.12, 2.6, "green"); _pad(b, 0.18, -0.25, 0.15, 4.2); _lily(b, 0.18, -0.25, WATER + 0.016, 1.2, P("pink"))
# the fountain's measurements, shared with its water (kwater.py builds the moving water to these)
FOUNTAIN = dict(basin_r=0.865, pool_z=0.34, foot_r=0.31, bowl_r=0.556, bowl_z=1.24, neck_r=0.12, jet_r=0.1, jet_z=1.63, bowl_land=0.42,
                fall=[(0.64, 1.272), (0.675, 1.262), (0.71, 1.2), (0.735, 1.02), (0.75, 0.74), (0.758, 0.5), (0.76, 0.34)])
@part("Pond_Fountain", "pond", (2, 2))
def pond_fountain(b):
    """A two-tier garden fountain in the Grove's way: a wide stone basin with a cream lip of round stones, a turned
    pedestal with a gold band, a scalloped bowl, and a closed bloom bud on a short column at the top. Its water is not
    in this mesh: it is the Grove's moving water (kwater.py), a pool and a bowl whose ripples spread, a sheet spilling all
    round the bowl's rim and eight jets arcing from under the bud into the bowl."""
    F = FOUNTAIN
    b.lathe([(0, 0), (0.98, 0), (1.02, 0.05), (1.0, 0.12), (0.97, 0.36), (1.01, 0.41), (1.0, 0.48), (0.93, 0.515), (0.875, 0.48), (0.865, 0.3), (0, 0.3)],
            mats=["rock_dk", "rock_dk", "rock", "rock", "cream", "cream", "cream", "cream", "rock_lt", "water"], seg=32)
    for i in range(14):                                                        # the lip: round stones, cream and pale grey by turns
        t = tau * i / 14; b.ball(0.078, (0.94 * cos(t), 0.94 * sin(t), 0.5), "cream" if i % 2 else "rock_lt", sc=(1.05, 1.45, 0.62), u=10, v=6, rot=(0, 0, t + pi / 2))
    for i in range(12):                                                        # big round stones round its foot
        t = tau * i / 12 + 0.26; b.ball(0.11, (1.0 * cos(t), 1.0 * sin(t), 0.12), ("rock_lt", "rock")[i % 2], sc=(0.6, 1.05, 0.95), u=10, v=6, rot=(0, 0, t))
    b.lathe([(0.31, 0.3), (0.33, 0.38), (0.21, 0.5), (0.15, 0.74), (0.19, 0.79), (0.19, 0.86), (0.15, 0.91), (0.2, 1.0)],
            mats=["rock", "cream", "cream", "gold", "gold", "gold", "cream"], seg=22, cap=False)
    b.lathe([(0.2, 1.0), (0.45, 1.07), (0.6, 1.17), (0.645, 1.25), (0.61, 1.29), (0.565, 1.265), (0.556, 1.2), (0, 1.2)],
            mats=["rock", "rock_lt", "cream", "cream", "cream", "rock_lt", "water"], seg=30, cap=False)
    for i in range(18):                                                        # the bowl's scalloped rim
        t = tau * i / 18; b.ball(0.034, (0.625 * cos(t), 0.625 * sin(t), 1.282), "cream", sc=(1, 1, 0.8), u=8, v=5)
    b.lathe([(0.13, 1.2), (0.1, 1.4), (0.13, 1.45), (0.13, 1.5), (0.1, 1.54)], mats=["cream", "gold", "gold", "cream"], seg=16, cap=False)
    bud = [(0.1, 1.54), (0.13, 1.58), (0.158, 1.64), (0.172, 1.7), (0.168, 1.76), (0.15, 1.815), (0.118, 1.862), (0.075, 1.898), (0.03, 1.918), (0, 1.922)]
    b.lathe(bud, mats=[P("pink"), P("pink"), P("pink"), P("pink"), P("pink"), P("pink", "lt"), P("pink", "lt"), P("pink", "lt"), P("pink", "lt")], seg=32)      # a closed tulip bud, smooth
    for i in range(5):                                                         # its petals' edges, wrapping round it
        t = tau * i / 5; b.ball(1.0, (0.155 * cos(t), 0.155 * sin(t), 1.72), P("pink", "lt"), sc=(0.03, 0.06, 0.15), u=10, v=7, rot=(0, -0.12, t + 0.35))
    for i in range(4):                                                         # four leaves cupping the bud
        t = tau * i / 4 + pi / 4; b.ball(1.0, (0.13 * cos(t), 0.13 * sin(t), 1.6), "leaf_light", sc=(0.13, 0.065, 0.022), u=12, v=6, rot=(0, -0.5, t))
@part("Pond_Lily", "pond")
def pond_lily(b):
    """Lily pads and a flower, to put on a water tile."""
    _pad(b, -0.18, 0.1, 0.2, 0.4); _pad(b, 0.2, 0.22, 0.14, 2.9, "green"); _pad(b, 0.14, -0.2, 0.17, 4.4); _lily(b, 0.14, -0.2, WATER + 0.016, 1.3, P("pink"))
@part("Pond_Reeds", "pond")
def pond_reeds(b):
    """A clump of bulrushes."""
    for i, (x, y, h, lean) in enumerate(((-0.12, 0.05, 1.25, -0.08), (0.08, 0.12, 1.05, 0.1), (0.14, -0.1, 0.85, 0.16), (-0.05, -0.14, 0.95, -0.12), (0.0, 0.0, 1.4, 0.02))):
        b.tube([(x, y, 0), (x + lean * 0.5, y, h * 0.6), (x + lean, y, h)], 0.016, "leaf_dark", seg=5); b.cyl(0.042, 0.2, (x + lean * 0.86, y, h - 0.28), "trunk", seg=7, bev=0.015, rot=(0, lean * 0.4, 0))
    for i in range(7):
        t = tau * i / 7 + 0.3; h = 0.6 + 0.12 * (i % 3); b.tube([(0.08 * cos(t), 0.08 * sin(t), 0.012), (0.2 * cos(t), 0.2 * sin(t), h * 0.6), (0.36 * cos(t), 0.36 * sin(t), h)], [0.03, 0.024, 0.006], ("green", "leaf_light")[i % 2], seg=4)
@part("Pond_Rock", "pond")
def pond_rock(b):
    """Three rocks with moss on top."""
    for x, y, r, m in ((0.0, 0.06, 0.3, "grey"), (-0.26, -0.14, 0.18, "rock"), (0.24, -0.16, 0.14, "grey")):
        b.ball(r, (x, y, r * 0.86), tn(m, 0.3, None, 0.3), sc=(1.1, 0.95, 0.85), u=18, v=10, rot=(0, 0, x * 3))
    import kgreen                                                              # soft cushions of moss on the two big rocks
    kgreen.puff(b, [((0.0, 0.07, 0.47), 0.2, (1.15, 1.0, 0.42), (12, 7)), ((0.1, -0.05, 0.43), 0.12, (1, 1, 0.45), (10, 6)), ((-0.26, -0.14, 0.29), 0.1, (1.1, 1, 0.45), (10, 6))], "classic")

# ---------------------------------------------------------------- bridges (each returns the height of its deck along the walk: y, z, repeated)
@part("Bridge_Arch", "bridge", (2, 4))
def bridge_arch(b):
    """A humped footbridge with painted rails. It is walked along Y."""
    a = A("red"); z = lambda y: 0.06 + 0.46 * (1 - (y / 2.0) ** 2); n = 16; walk = []
    for i in range(n):
        y = -2.0 + 4.0 * (i + 0.5) / n; sl = -0.46 * 2 * y / 4.0
        b.box((1.6, 0.245, 0.06), (0, y, z(y) - 0.03), ("wood", "wood_lt")[i % 2], r=0.015, rot=(atan(sl), 0, 0))
    top = [(-2.0 + 4.0 * i / 12, z(-2.0 + 4.0 * i / 12) - 0.05) for i in range(13)]
    for sx in (-1, 1):
        b.prism(top[::-1] + [(p[0], max(0.0, p[1] - 0.2)) for p in top], 0.12, "wood_dk", mtx=YZ(sx * 0.82 - 0.06, 0, 0))
        rail = []
        for i, y in enumerate((-1.9, -0.95, 0.0, 0.95, 1.9)):
            h = 0.86; b.cyl(0.065, h + 0.04, (sx * 0.82, y, z(y) - 0.06), tn(a, 0.12, 0.9), seg=8); knob(b, (sx * 0.82, y, z(y) + h + 0.04), 0.095, "gold" if abs(y) > 1.5 else "cream"); rail.append((sx * 0.82, y, z(y) + h - 0.14))
        mid = lambda p, q, k: (p[0], p[1] + (q[1] - p[1]) * k, z(p[1] + (q[1] - p[1]) * k) + 0.72)
        line = [rail[0]]
        for p, q in zip(rail, rail[1:]): line += [mid(p, q, 0.5), q]
        b.tube(line, 0.05, a, seg=6); b.tube([(p[0], p[1], p[2] - 0.36) for p in line], 0.03, A("red", "dk"), seg=5)
    for i in range(9):
        y = -2.0 + 0.5 * i; walk += [round(y, 2), round(z(y), 3)]
    return dict(walk=walk, width=1.4)
@part("Bridge_Plank", "bridge", (1, 2))
def bridge_plank(b):
    """A flat plank bridge on two logs, with a rope each side. It is walked along Y."""
    for sx in (-1, 1): b.cyl(0.07, 2.0, (sx * 0.3, -1.0, 0.07), "trunk", seg=8, rot=(-pi / 2, 0, 0))
    for i in range(8): b.box((0.92, 0.235, 0.05), (0, -0.875 + 0.25 * i, 0.165), ("wood", "wood_lt", "wood", "wood_dk")[i % 4], r=0.012)
    for sx in (-1, 1):
        for sy in (-1, 1): b.cyl(0.05, 0.62, (sx * 0.43, sy * 0.9, 0.0), tn("wood", 0.14, 0.88), seg=8); knob(b, (sx * 0.43, sy * 0.9, 0.65), 0.07, "gold")
        b.tube([(sx * 0.43, -0.9, 0.52), (sx * 0.43, -0.45, 0.42), (sx * 0.43, 0, 0.39), (sx * 0.43, 0.45, 0.42), (sx * 0.43, 0.9, 0.52)], 0.028, "rope", seg=6)
    return dict(walk=[-1.0, 0.19, 1.0, 0.19], width=0.76)

# ---------------------------------------------------------------- signs
@part("Sign_Arrow", "sign")
def sign_arrow(b):
    """A signpost with two arrows."""
    b.cyl(0.07, 1.95, (0, 0, 0), tn("wood", 0.1, 0.9), seg=10); knob(b, (0, 0, 1.98), 0.1)
    arrow = [(-0.42, -0.14), (0.3, -0.14), (0.3, -0.2), (0.52, 0), (0.3, 0.2), (0.3, 0.14), (-0.42, 0.14)]
    b.prism(arrow, 0.07, tn(A("blue"), 0.25, 0.8), mtx=XZ(-0.115, 0.08, 1.62), r=0.012)
    b.prism([(-p[0], p[1]) for p in arrow][::-1], 0.07, tn(P("yellow"), 0.25, 0.8), mtx=XZ(-0.115, -0.08, 1.22), r=0.012)
    for x, z in ((-0.1, 1.62), (0.1, 1.22)): b.cyl(0.03, 0.02, (x, -0.115, z), "gold", seg=6, rot=(pi / 2, 0, 0))
@part("Sign_Board", "sign", (2, 1))
def sign_board(b):
    """A notice board under a little painted roof, with three notes pinned to it."""
    for sx in (-1, 1): b.cyl(0.07, 1.85, (sx * 0.72, 0, 0), tn("wood", 0.1, 0.9), seg=10)
    b.box((1.34, 0.08, 0.96), (0, -0.02, 1.2), "wood_dk", r=0.03); b.box((1.18, 0.05, 0.8), (0, -0.055, 1.2), "cream", r=0.02)
    for x, z, w, h, m, rz in ((-0.34, 1.28, 0.3, 0.36, "yellow", 0.06), (0.05, 1.12, 0.32, 0.3, "sky", -0.05), (0.38, 1.34, 0.26, 0.3, "pink", 0.04)):
        b.box((w, 0.012, h), (x, -0.086, z), m, rot=(0, rz, 0)); knob(b, (x, -0.094, z + h / 2 - 0.05), 0.025, "red")
    for sx in (-1, 1): b.box((0.95, 0.42, 0.07), (sx * 0.42, 0, 1.93), A("red") if sx < 0 else A("red", "lt"), r=0.02, rot=(0, sx * 0.42, 0))
    b.cyl(0.05, 0.46, (0, -0.23, 2.13), A("red", "dk"), seg=8, rot=(-pi / 2, 0, 0))
@part("Sign_Easel", "sign")
def sign_easel(b):
    """A standing chalk board with a flower drawn on it."""
    for sy in (-1, 1): b.box((0.66, 0.05, 1.12), (0, sy * 0.15, 0.55), tn("wood", 0.12, None), r=0.02, rot=(sy * 0.24, 0, 0))
    F = xf((0, -0.15, 0.55), (-0.24, 0, 0)); at = lambda x, d, z: tuple(F @ Vector((x, -d, z)))
    b.box((0.54, 0.02, 0.84), at(0, 0.034, 0.06), "plum", rot=(-0.24, 0, 0))
    b.box((0.02, 0.012, 0.3), at(0.0, 0.048, -0.02), "cream", rot=(-0.24, 0, 0)); blossom(b, at(0.0, 0.05, 0.2), 0.12, "pink", "yellow", rot=(pi / 2 - 0.24, 0, 0))
    for sg in (-1, 1): b.ball(1.0, at(sg * 0.09, 0.05, -0.06), "leaf_light", sc=(0.085, 0.012, 0.04), u=6, v=4, rot=(-0.24, -sg * 0.5, 0))
    b.cyl(0.035, 0.7, (-0.35, 0, 1.08), "wood_dk", seg=6, rot=(0, pi / 2, 0))
    for sx in (-1, 1): knob(b, (sx * 0.36, 0, 1.08), 0.05, "gold")
