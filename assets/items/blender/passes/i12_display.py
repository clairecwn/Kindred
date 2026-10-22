"""Pass 12: the shop display kit. The stands the item models are shown on inside the Grove's shops: tables with a
back riser, a round stand, plinths, a stepped rack, a head form, and the small things that go with them (a hook for
hanging items, a board for wall items, a price tag). Sizes and surfaces come from sdspec.py, which the layout script
(assets/items/shop_displays.py) reads too. Meshes are SD_<name> in the collection SHOP_DISPLAY, set out in a row
behind the showroom. The accent of a stand (its apron, rim or band) is the material KV_A_teal: the game repaints it
in the colour of the shop the stand is in."""
import bpy, importlib
from ii import *
import ii, ip, sdspec; importlib.reload(sdspec)
from ip import bloom_at, leaves_at, rrect
from sdspec import TOP, STEP, PLINTH, RISER, RING, CROWN, TIERS, HOOK, BOARD, TAG, STANDS
A = lambda kind=None: V("A", "teal", kind)

def legs(b, pts, h, r=0.07):
    for x, y in pts:
        b.cyl(r, h - 0.05, (x, y, 0.05), tn("wood", 0.16, 0.9), seg=10); b.ball(r * 1.5, (x, y, 0.055), A("dk"), sc=(1, 1, 0.55), u=10, v=5)
def table(b, L):
    D = 0.95; t = 0.07
    legs(b, [(sx * (L / 2 - 0.16), sy * (D / 2 - 0.16)) for sx in (-1, 1) for sy in (-1, 1)], TOP - t - 0.12)
    b.prism(rrect(L - 0.12, D - 0.12, 0.08), 0.17, tn(A(), 0.3, None), loc=(0, 0, TOP - t - 0.17))                     # apron
    b.prism(rrect(L, D, 0.1), t, "white", loc=(0, 0, TOP - t), r=0.018)                                                 # top
    b.prism(rrect(L - 0.22, RISER[1], 0.07), STEP - 0.035, tn(A(), None, 0.7), loc=(0, RISER[0], TOP))                   # riser
    b.prism(rrect(L - 0.18, RISER[1] + 0.04, 0.08), 0.035, "white", loc=(0, RISER[0], TOP + STEP - 0.035), r=0.01)
    bloom_at(b, (0, -D / 2 + 0.055, TOP - t - 0.085), 0.075, "cream", "yellow", 6, "-y", 0.05)
    for sx in (-1, 1): leaves_at(b, -D / 2 + 0.058, TOP - t - 0.09, 0.14, "cream", sx * (L / 2 - 0.42))
def round_stand(b):
    r, z = RING; R = STANDS["SD_Round"]["size"][0] / 2
    b.lathe([(0, 0), (0.42, 0), (0.44, 0.05), (0.3, 0.12), (0.22, 0.3), (0.22, z - 0.2), (0.5, z - 0.1)], mats=[A("dk"), A("dk"), A("dk"), "wood", "wood", A()], seg=18, cap=False)
    b.lathe([(0.5, z - 0.1), (R - 0.02, z - 0.08), (R, z - 0.04), (R - 0.02, z), (0, z)], mats=[A(), A("lt"), "white", "white"], seg=24, cap=False)
    b.lathe([(0.2, z), (0.22, CROWN - 0.1), (0.3, CROWN - 0.05), (0.3, CROWN - 0.015), (0.28, CROWN), (0, CROWN)], mats=[A(), A("lt"), "white", "white", "white"], seg=18, cap=False)
    for i in range(8):
        a = tau * (i + 0.5) / 8; b.ball(0.035, ((R - 0.005) * cos(a), (R - 0.005) * sin(a), z - 0.045), "gold", u=6, v=4)
def plinth(b, w, d):
    if w == d:
        R = w / 2; b.lathe([(0, 0), (R - 0.03, 0), (R, 0.03), (R, PLINTH - 0.04), (R - 0.03, PLINTH), (0, PLINTH)], mats=[A("dk"), A("dk"), A(), "white", "white"], seg=28)
        b.lathe([(R - 0.2, PLINTH), (R - 0.19, PLINTH + 0.006), (R - 0.14, PLINTH + 0.006), (R - 0.13, PLINTH)], m=A("lt"), seg=28, cap=False)
    else:
        b.prism(rrect(w, d, 0.14), PLINTH - 0.035, tn(A(), 0.3, None), loc=(0, 0, 0)); b.prism(rrect(w, d, 0.14), 0.035, "white", loc=(0, 0, PLINTH - 0.035), r=0.012)
        b.prism(rrect(w - 0.2, d - 0.2, 0.09), 0.006, A("lt"), loc=(0, 0, PLINTH)); b.prism(rrect(w - 0.28, d - 0.28, 0.07), 0.007, "white", loc=(0, 0, PLINTH))
        bloom_at(b, (0, -d / 2 + 0.006, PLINTH * 0.42), 0.05, "cream", "yellow", 6, "-y", 0.04)
def rack(b):
    w, d, h = STANDS["SD_Rack"]["size"]; dy = TIERS[1][0] - TIERS[0][0]
    for i, (y, z) in enumerate(TIERS):
        b.box((w - 0.1, dy + 0.02, z - 0.03), (0, y, (z - 0.03) / 2), tn(A(), None, None) if i else tn(A(), 0.25, None))
        b.box((w - 0.06, dy + 0.03, 0.03), (0, y - 0.005, z - 0.015), "white", r=0.008)
        b.box((w - 0.06, 0.02, 0.05), (0, y - dy / 2 - 0.012, z + 0.012), A("lt"), r=0.006)        # a lip, so packets lean and do not slide
    for sx in (-1, 1):
        b.prism([(-d / 2 + 0.02, 0), (d / 2 - 0.02, 0), (d / 2 - 0.02, h + 0.22), (d / 2 - 0.14, h + 0.3), (0.1, h + 0.02), (-0.12, TIERS[1][1] + 0.04), (-d / 2 + 0.02, TIERS[0][1] + 0.06)], 0.06, tn("wood", 0.12, 0.85), mtx=YZ(sx * (w / 2 - 0.03) - 0.03, 0, 0))
        b.ball(0.07, (sx * (w / 2 - 0.03), d / 2 - 0.08, h + 0.32), "cream", u=8, v=5)
    b.box((w - 0.1, 0.05, 0.34), (0, d / 2 - 0.045, h + 0.14), "white", r=0.02); bloom_at(b, (0, d / 2 - 0.075, h + 0.15), 0.1, V("A", "teal"), "yellow", 6, "-y", 0.05)
    for sx in (-1, 1): leaves_at(b, d / 2 - 0.072, h + 0.14, 0.2, "leaf_light", sx * 0.42)
def head(b):
    """A bust: a head the size of the character's on a short post. The brim line is at sdspec.HEAD_Z."""
    c = sdspec.HEAD_Z - 0.1
    b.lathe([(0, 0), (0.28, 0), (0.3, 0.05), (0.14, 0.1), (0.07, 0.16)], mats=[A("dk"), A("dk"), A(), A()], seg=16); b.cyl(0.06, c - 0.44, (0, 0, 0.14), tn("wood", 0.1, 0.9), seg=10)
    b.lathe([(0.06, c - 0.3), (0.1, c - 0.28), (0.1, c - 0.24), (0.06, c - 0.22)], m="gold", seg=10, cap=False)
    b.ball(1.0, (0, 0, c), tn("white", 0.2, None), sc=(0.52, 0.52, 0.37), u=16, v=10)
def hook(b):
    """Origin on the surface under the hang point; the post stands behind it."""
    y = HOOK["post"]; h = HOOK["height"]
    b.lathe([(0, 0), (0.09, 0), (0.1, 0.02), (0.03, 0.05), (0.022, 0.08)], (0, y, 0), mats=[A("dk"), A("dk"), A(), A()], seg=10)
    b.tube([(0, y, 0.06), (0, y, h + 0.05), (0, y - 0.05, h + 0.12), (0, 0.02, h + 0.13), (0, 0.0, h + 0.06), (0, 0.0, h)], 0.018, "gold", seg=6); b.ball(0.03, (0, 0, h), "gold", u=6, v=4)
def board(b):
    """Origin on the surface under the board; its face is at y = BOARD face, leaning back a little."""
    H = BOARD["height"]
    b.box((0.5, 0.03, 0.62), (0, BOARD["face"] + 0.03, H), tn(A(), 0.18, None), r=0.012, rot=(-0.1, 0, 0)); b.box((0.42, 0.012, 0.54), (0, BOARD["face"] + 0.008, H), "white", rot=(-0.1, 0, 0))
    b.box((0.07, 0.3, 0.03), (0, 0.1, 0.015), A("dk"), r=0.01); b.tube([(0, 0.2, 0.02), (0, 0.06, H + 0.2)], 0.014, "wood", seg=5)
def tag(b):
    b.cyl(0.011, 0.07, (0, 0, 0), "gold", seg=5); b.cyl(0.035, 0.012, (0, 0, 0), "gold", seg=8)
    b.box((TAG, 0.012, 0.09), (0, 0.004, 0.105), "paper", r=0.004, seg=1, rot=(-0.32, 0, 0)); b.box((TAG, 0.014, 0.022), (0, 0.0145, 0.136), V("A", "teal"), rot=(-0.32, 0, 0))

BUILD = {"SD_Table_S": lambda b: table(b, STANDS["SD_Table_S"]["size"][0]), "SD_Table_M": lambda b: table(b, STANDS["SD_Table_M"]["size"][0]), "SD_Round": round_stand,
         "SD_Plinth": lambda b: plinth(b, *STANDS["SD_Plinth"]["size"][:2]), "SD_Plinth_Wide": lambda b: plinth(b, *STANDS["SD_Plinth_Wide"]["size"][:2]),
         "SD_Stage": lambda b: plinth(b, *STANDS["SD_Stage"]["size"][:2]), "SD_Rack": rack, "SD_Head": head, "SD_Hook": hook, "SD_Board": board, "SD_Tag": tag}
coll = ccol("SHOP_DISPLAY")
for o in list(coll.objects): bpy.data.objects.remove(o, do_unlink=True)
x = 0.0; out = {}
for name, fn in BUILD.items():
    b = TB(); fn(b); me = kit(name, b); lo, hi = bounds(me); w = hi.x - lo.x
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.location = (x + w / 2, 9.0, 0.0); x += w + 0.7
    out[name] = [tris(me), [round(v, 2) for v in (hi - lo)]]
bpy.context.view_layer.update()
report(parts=len(out), tris=sum(v[0] for v in out.values()), sizes=out)
