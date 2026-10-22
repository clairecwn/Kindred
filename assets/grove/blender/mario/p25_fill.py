"""Pass 25: give every part of the mall a job.

Before this pass the floors around the shops were bare: a four-metre corridor ran behind and beside every shop and
stopped dead at the outer wall, the bridges across the atrium were empty decks, and each wing was a 20 m square of
plain tile. This pass uses those spaces the way a real mall does:

  back of house   the dead corridors behind and beside each shop are closed off with a partition (staff door, poster),
                  flush with the shop front, so each shop reads as a full corner block
  lookouts        the stub of walkway left beside each partition becomes a seat with a planter
  bridges         planters along the atrium rail, benches facing the view, a runner down the middle
  wings           a centrepiece on a floor inset in the middle of each wing (tree and ring of benches, capsule-toy
                  corner, photo arch), a cart or two, and vending machines, lockers and bins along the outer wall
  concourse       benches and planters beside the garden arch

Everything is light on triangles (plain bevelled boxes, 7-sided bushes). Benches are separate objects named
Mall_Bench_<nn> so the game can seat a character on them; the rest is one object per zone. All of it lives in
MARIO_FILL, under the collection the game export already reads. The interior windows that end up inside the closed
back-of-house areas are retired, since nobody can see them any more."""
import bpy, re
from gk import *
import importlib, gv; importlib.reload(gv)
from gv import crown as gv_crown, dot

F = fresh("MARIO_FILL", "GROVE_PLAYABLE_MALL_REFINEMENT")
ACC = ["gold", "sky", "pink"]; ACC2 = ["yellow", "blue", "rose"]; CUSH = ["orange", "blue", "rose"]
rep = {"objects": 0, "benches": 0, "windows_retired": 0}; NB = [0]; NT = [0]

class At:
    """A local frame on the floor: origin (x, y, z), turned rz about Z. Items are drawn with their front to local -Y."""
    def __init__(s, b, x, y, z, rz=0.0):
        s.b = b; s.o = Vector((x, y, z)); s.rz = rz; s.R = Matrix.Rotation(rz, 3, "Z")
    def p(s, c): return s.o + s.R @ Vector(c)
    def box(s, size, c, m, r=0.0, seg=1): s.b.box(size, s.p(c), m, r=r, seg=seg, rot=(0, 0, s.rz))
    def ball(s, r, c, m, sc=(1, 1, 1), u=7, v=4): s.b.ball(r, s.p(c), m, sc=sc, u=u, v=v, rot=(0, 0, s.rz))
    def cyl(s, r, h, c, m, seg=8, lie=False): s.b.cyl(r, h, s.p(c), m, seg=seg, rot=(pi / 2 if lie else 0, 0, s.rz))   # lie: axis along local -Y
    def lathe(s, prof, c, mats, seg=10): s.b.lathe(prof, s.p(c), seg=seg, mats=mats)

def out(b, name):
    if len(b.bm.faces): b.obj(name, F, 55); rep["objects"] += 1
    else: b.bm.free()

def bench(x, y, z, L, rz, col, back=False):
    """Separate object so the game can sit a character on it. With a back, the sitter faces local -Y."""
    b = B(); h = .42
    b.box2((-L / 2, -.28, h - .1), (L / 2, .28, h), col, r=.04, seg=1)
    for f in (-.34, .34): b.box2((L * f - .08, -.22, 0), (L * f + .08, .22, h - .09), "white")
    if back:
        b.box2((-L / 2, .2, h + .2), (L / 2, .3, h + .62), "wood")
        for f in (-.4, .4): b.box2((L * f - .05, .2, h - .02), (L * f + .05, .3, h + .25), "white")
    o = b.obj("Mall_Bench_%02d" % NB[0], F, 55); NB[0] += 1; o.location = (x, y, z); o.rotation_euler = (0, 0, rz); rep["benches"] += 1

def planter(b, x, y, z, L, along="x", n=3, col="white", trim="gold", h=.5, w=.7, k=0):
    sx, sy = (L, w) if along == "x" else (w, L)
    b.box((sx, sy, h), (x, y, z + h / 2), col, r=.05, seg=1); b.box((sx + .06, sy + .06, .08), (x, y, z + h - .02), trim)
    b.box((sx - .12, sy - .12, .04), (x, y, z + h + .02), "trunk")
    # one clipped hedge with rounded shoulders per planter (the park hedges in small), and round blossoms on top
    b.box((sx - .16, sy - .16, .5), (x, y, z + h + .22), ["leaf_light", "green", "leaf_dark"][k % 3], r=.2, seg=2)
    for i in range(max(1, n - 1)):
        t = (i + .5) / max(1, n - 1) - .5; px, py = (x + t * (L - .5), y) if along == "x" else (x, y + t * (L - .5))
        dot(b, (px + .06, py - .08, z + h + .48), .1, ["pink", "yellow", "red", "white"][(i + k) % 4], .7)

SMALL = {}
def tree(b, x, y, z, crown=("leaf_light", "green", "leaf_dark"), fruit="orange"):
    """A small potted tree. The crown is one welded shape (gv.py), built once per colourway and copied in."""
    key = crown + (fruit,)
    if key not in SMALL:
        t = B()
        t.lathe([(.5, 0), (.64, .5), (.7, .52), (.7, .62), (.58, .62), (.58, .55), (0, .55)], seg=16, mats=["terracotta", "white", "white", "white", "white", "trunk"])
        t.cyl(.1, 1.5, (0, 0, .55), "trunk", seg=8)
        gv_crown(t, [((0, 0, 2.55), .72, (1, 1, .86)), ((.42, .1, 2.2), .52, (1, 1, .86)), ((-.38, -.16, 2.25), .5, (1, 1, .86))], 230,
                 crown[1], crown[2], crown[0], lo=(2.05, .1), hi=(2.72, .3), voxel=.045)
        for a in (0.6, 2.6, 4.4): dot(t, (.62 * cos(a), .62 * sin(a), 2.42 + .12 * sin(a * 3)), .1, fruit)
        old = bpy.data.meshes.get("GK_SmallTree_" + "_".join(key))
        if old and old.users == 0: bpy.data.meshes.remove(old)
        SMALL[key] = t.data("_small_tree_" + "_".join(key), 62)
    # Its own object (round 8): inside a whole-wing Fill object the game could not fade it when it came between the
    # camera and the character. The name keeps "Tree" so the game treats it as something to look past.
    o = bpy.data.objects.new("Fill_Tree_%02d" % NT[0], SMALL[key]); F.objects.link(o); o.location = (x, y, z); NT[0] += 1; rep["trees"] = NT[0]

def inset(b, x0, y0, x1, y1, z, col, inner="cream", w=.35):
    b.box2((x0, y0, z + .004), (x1, y1, z + .014), col); b.box2((x0 + w, y0 + w, z + .014), (x1 - w, y1 - w, z + .022), inner)

def vending(b, x, y, z, rz, col, k=0):
    a = At(b, x, y, z, rz); a.box((1.0, .72, 1.95), (0, 0, .975), col, r=.05); a.box((.6, .04, 1.1), (-.14, -.37, 1.25), "water_light")
    for i in range(3): a.box((.5, .03, .16), (-.14, -.385, .9 + .34 * i), ["red", "yellow", "green", "orange", "pink"][(i + k) % 5])
    a.box((.2, .04, .6), (.34, -.37, 1.25), "white"); a.box((.12, .05, .08), (.34, -.385, 1.05), "plum"); a.box((.6, .05, .2), (-.14, -.37, .36), "plum")
def lockers(b, x, y, z, rz, col):
    a = At(b, x, y, z, rz); a.box((2.4, .5, 1.9), (0, 0, .95), col, r=.04)
    for i in range(4):
        for j in range(3): a.box((.5, .03, .5), (-.87 + .58 * i, -.26, .36 + .59 * j), ["white", "yellow", "pink", "sky"][(i + j) % 4])
def bin_(b, x, y, z, col):
    b.lathe([(.2, 0), (.25, .7), (.27, .72), (.27, .78), (.16, .8), (0, .8)], (x, y, z), seg=8, mats=[col, "white", "white", "white", "plum"])
def gacha(b, x, y, z, rz, col, k=0):
    a = At(b, x, y, z, rz); a.box((.56, .5, .52), (0, 0, .26), col, r=.04); a.box((.5, .44, .08), (0, 0, .56), "white")
    a.ball(.27, (0, 0, .86), "water_light", u=8, v=5); a.box((.12, .04, .12), (0, -.27, .3), "gold"); a.box((.2, .04, .1), (0, -.26, .12), "plum")
    for i, (dx, dy) in enumerate(((-.1, -.06), (.1, 0), (0, .1))): a.ball(.09, (dx, dy, .74), ["red", "yellow", "blue", "pink", "green"][(i + k) % 5], u=5, v=3)
def claw(b, x, y, z, rz, col):
    a = At(b, x, y, z, rz); a.box((1.0, .9, .8), (0, 0, .4), col, r=.05); a.box((.92, .82, .9), (0, 0, 1.25), "glass"); a.box((1.0, .9, .25), (0, 0, 1.83), col, r=.05)
    for i, (dx, dy) in enumerate(((-.25, -.15), (.2, -.2), (0, .12), (-.2, .2), (.26, .15))): a.ball(.17, (dx, dy, .95), ["pink", "yellow", "sky", "leaf_light", "orange"][i], u=6, v=4)
    a.box((.3, .06, .14), (.2, -.46, .7), "white"); a.cyl(.03, .12, (-.25, -.5, .72), "red", seg=6)
def cart(b, x, y, z, rz, col, goods):
    a = At(b, x, y, z, rz); a.box((1.6, .8, .7), (0, 0, .57), col, r=.06); a.box((1.72, .92, .06), (0, 0, .95), "white", r=.02)
    for sx in (-.55, .55): a.cyl(.22, .08, (sx, -.41, .22), "plum", seg=10, lie=True)
    for sx in (-.76, .76): a.box((.06, .06, 1.25), (sx, 0, 1.6), "white")
    for i in range(4): a.box((.46, 1.05, .08), (-.69 + .46 * i, 0, 2.26), col if i % 2 else "white")
    for i in range(3): a.ball(.15, (-.45 + .45 * i, -.05, 1.12), goods[i % len(goods)], sc=(1, 1, 1.15), u=6, v=4)
def arch(b, x, y, z, rz, col):
    a = At(b, x, y, z, rz); pts = [a.p((1.35 * cos(radians(t)), 0, .25 + 2.45 * sin(radians(t)))) for t in range(0, 181, 20)]
    b.tube(pts, .13, col, seg=6)
    for sx in (-1.35, 1.35): a.lathe([(.34, 0), (.42, .3), (.42, .36), (0, .36)], (sx, 0, 0), ["white", "gold", "gold"], seg=8)
    for t in (30, 60, 90, 120, 150): a.ball(.2, (1.35 * cos(radians(t)), -.08, .25 + 2.45 * sin(radians(t))), "leaf_light" if t % 60 else "yellow", sc=(1, .6, 1), u=6, v=4)
def partition(b, x, y, z, L, rz, lv, door=True, k=0):
    """Back-of-house wall: wall along local X, public side at local -Y."""
    a = At(b, x, y, z, rz); a.box((L, .3, 4.5), (0, 0, 2.25), "cream"); a.box((L, .34, .95), (0, 0, .475), ACC[lv])   # a touch taller than the wainscot it meets (0.9), so the two tops are never in one plane; a.box((L, .36, .16), (0, 0, 4.41), "gold")
    px = L * .22 if door else 0
    if door:
        dx = -L * .24; a.box((1.3, .05, 2.45), (dx, -.155, 1.225), "white"); a.box((1.1, .06, 2.3), (dx, -.17, 1.15), "teal"); a.box((.4, .07, .4), (dx, -.175, 1.65), "glass")
        a.box((.06, .1, .2), (dx + .4, -.2, 1.1), "gold")
    a.box((1.5, .06, 2.0), (px, -.17, 2.3), "white"); a.box((1.3, .07, 1.8), (px, -.175, 2.3), ["sky", "pink", "leaf_light", "yellow"][k % 4])
    a.cyl(.36, .06, (px, -.17, 2.42), ["yellow", "white", "pink", "red"][k % 4], seg=24, lie=True); a.box((.9, .08, .16), (px, -.18, 1.72), "white")   # the disc is a true round one (it was a six-sided blob)

for lv, z in enumerate((0.0, 5.0, 10.0)):
    # ---- back of house: close the corridors behind and beside each shop
    b = B(); k = lv
    for sx in (-1, 1):
        for sy in (-1, 1):
            # each wall runs a little way into the walls it meets and sits 3 cm back from their faces,
            # so no two visible faces lie in the same plane (that shows as a flickering strip in the game)
            partition(b, sx * 27.83, sy * 10.45, z, 3.86, 0 if sy > 0 else pi, lv, True, k); k += 1
            partition(b, sx * 14.09, sy * 19.68, z, 4.26, -pi / 2 * sx, lv, False, k); k += 1
    out(b, "Fill_L%d_BackOfHouse" % (lv + 1))
    # ---- lookouts: the stub of walkway beside each back-of-house wall
    b = B()
    for sx in (-1, 1):
        for sy in (-1, 1):
            if lv == 0 and sy < 0 and sx < 0: continue                      # the stair foot
            bench(sx * 13.25, sy * 19.5, z, 2.2, -pi / 2 * sx, CUSH[lv], back=True)
            if not (sy < 0 and sx < 0): planter(b, sx * 12.0, sy * 21.25, z, 3.0, "x", 3, trim=ACC[lv], k=lv + sx)
    out(b, "Fill_L%d_Lookouts" % (lv + 1))
    # ---- bridges across the atrium (upper levels)
    if lv:
        b = B()
        for sy in (-1, 1):
            yc = sy * 13.0; inset(b, -9.4, yc - 1.1, 9.4, yc + 1.1, z, ACC[lv], "cream", .22)
            for i, x in enumerate((-7.0, 0.0, 7.0)): planter(b, x, sy * 10.3, z, 2.2, "x", 3, trim=ACC[lv], k=i)
            north = sy < 0
            for i, x in enumerate((0.0, 7.6) if north else (-7.6, 0.0, 7.6)): planter(b, x, sy * 15.75, z, 1.6, "x", 2, trim=ACC[lv], k=i + 1)
            for x in ((-3.0, 3.8) if north else (-3.8, 3.8)): bench(x, sy * 15.7, z, 2.4, 0 if sy > 0 else pi, CUSH[lv], back=True)
        out(b, "Fill_L%d_Bridges" % (lv + 1))
    # ---- east wing: centrepiece, a cart, and a service row along the outer wall
    b = B(); cx = 18.0
    inset(b, cx - 3.2, -3.2, cx + 3.2, 3.2, z, ACC[lv], ["cream", "white", "cream"][lv])
    if lv < 2:
        tree(b, cx, 0, z, fruit=["orange", "pink"][lv]) if lv == 0 else tree(b, cx, 0, z, ("pink", "rose", "pink"), "white")
        for a_ in range(4):
            ang = a_ * pi / 2; bench(cx + 1.75 * cos(ang), 1.75 * sin(ang), z, 1.45, ang + pi / 2, CUSH[lv])   # 1.45 long (round 10): the gaps between them are a real way through to the tree
    else:
        arch(b, cx, 0, z, pi / 2, "pink")
        for sy in (-1, 1): tree(b, cx + .2, sy * 2.3, z, ("pink", "rose", "pink"), "white"); bench(cx - 2.4, sy * 1.3, z, 2.0, pi / 2, CUSH[lv], back=True)
    if lv == 0: cart(b, 17.5, -6.3, z, pi, "pink", ["white", "pink", "yellow"]); cart(b, 17.5, 6.3, z, 0, "leaf_light", ["red", "yellow", "pink"])
    if lv == 1: claw(b, 16.9, -6.4, z, pi, "purple"); claw(b, 18.3, -6.4, z, pi, "teal"); cart(b, 17.5, 6.3, z, 0, "sky", ["orange", "yellow", "red"])
    if lv == 2: cart(b, 17.5, -6.3, z, pi, "rose", ["pink", "white", "yellow"])
    vending(b, 29.25, -6.7, z, -pi / 2, "red", lv); vending(b, 29.25, -5.55, z, -pi / 2, "blue", lv + 1); bin_(b, 29.3, -4.7, z, ACC2[lv])
    lockers(b, 29.35, 5.9, z, -pi / 2, ["sky", "teal", "purple"][lv]); bin_(b, 29.3, 4.3, z, ACC2[lv])
    out(b, "Fill_L%d_East" % (lv + 1))
    # ---- west wing
    b = B()
    if lv == 0:      # capsule-toy corner
        cx = -20.0; inset(b, cx - 3.0, -3.4, cx + 3.0, 3.4, z, ACC[lv])
        for i in range(4):
            y = -.93 + .62 * i; gacha(b, cx - .3, y, z, -pi / 2, ["red", "blue", "yellow", "green"][i], i); gacha(b, cx + .3, y, z, pi / 2, ["pink", "orange", "teal", "purple"][i], i + 2)
        b.box2((cx - .62, -1.3, z + 1.2), (cx + .62, 1.3, z + 1.3), "white", r=.03, seg=1); b.box2((cx - .5, -1.2, z + 1.3), (cx + .5, 1.2, z + 1.62), "red", r=.06, seg=1)
        for sy in (-1, 1): bench(cx, sy * 2.5, z, 2.2, 0, CUSH[lv])
    else:            # garden strips either side of the escalators, and a quiet corner beyond them
        if lv == 1:      # the 2 to 3 escalators climb east over this spot: a planter bed fills the low space under them
            planter(b, -18.2, 0, z, 3.4, "y", 4, trim=ACC[lv], k=0, w=.9)
        for sy in (-1, 1):
            planter(b, -23.4, sy * 3.5, z, 2.2, "x", 3, trim=ACC[lv], k=1); planter(b, -19.0, sy * 3.5, z, 2.2, "x", 3, trim=ACC[lv], k=2)
            bench(-21.2, sy * 3.5, z, 1.9, 0, CUSH[lv])
        cx = -27.4; inset(b, cx - 1.6, -2.9, cx + 1.6, 2.9, z, ACC[lv]); tree(b, cx, 0, z, fruit="yellow") if lv == 1 else tree(b, cx, 0, z, ("pink", "rose", "pink"), "white")
        for sy in (-1, 1): bench(cx, sy * 1.8, z, 1.9, 0, CUSH[lv])
    if lv == 0:
        claw(b, -29.2, -6.5, z, pi / 2, "teal"); claw(b, -29.2, -5.2, z, pi / 2, "pink"); bin_(b, -29.3, -4.3, z, ACC2[lv])
        bench(-29.25, 0, z, 2.4, pi / 2, CUSH[lv], back=True)
    vending(b, -29.25, 5.55, z, pi / 2, "green", lv + 2); vending(b, -29.25, 6.7, z, pi / 2, "orange", lv + 3); bin_(b, -29.3, 4.7, z, ACC2[lv])
    if lv: lockers(b, -29.35, -5.9, z, pi / 2, ["sky", "teal", "purple"][lv])
    out(b, "Fill_L%d_West" % (lv + 1))

# ---- ground floor: seats beside the garden arch on the north concourse
b = B(); bench(7.6, -21.1, 0.0, 2.4, pi, CUSH[0], back=True); planter(b, 9.4, -21.2, 0.0, 1.0, "x", 1, k=1); planter(b, 5.9, -21.2, 0.0, .7, "x", 1, k=2)
out(b, "Fill_L1_Concourse")

# ---- interior windows that are now inside the back-of-house areas
gone = []
for o in bpy.data.objects:
    if o.name.startswith("Mall_InWindow") and o.users_collection and not any("SUPERSEDED" in c.name for c in o.users_collection):
        lo, hi = wbb(o); x = abs((lo.x + hi.x) / 2); y = abs((lo.y + hi.y) / 2)
        if (x > 25.9 and y > 10.7) or (y > 17.8 and x > 14.3): gone.append(o)
rep["windows_retired"] = supersede(gone)
bpy.context.view_layer.update()
for key, me in SMALL.items(): me.name = "GK_SmallTree_" + "_".join(key)      # kept: the Fill_Tree objects use them
rep["tris"] = sum(len(p.vertices) - 2 for o in F.objects for p in o.data.polygons)
bpy.app.driver_namespace["gk_report"] = rep
print("P25", rep)
