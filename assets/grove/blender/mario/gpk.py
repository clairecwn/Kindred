"""Grove product kit. Every product is one mesh drawn around the origin: it stands on z = 0, its front faces -Y and its
width runs along X. Sizes are matched to Kai (2.0 m tall, hands at 0.6 to 0.8 m), so things are chunky like toys.
DEFS[name](builder, colours) draws the product; gp.prod() caches the result. Hanging items keep their hook at the origin."""
import bpy, math
from math import sin, cos, pi, tau, radians
from mathutils import Matrix, Vector
from gk import *
from gk import _M

EXTRA = {"kraft": "#D9A066", "bread": "#F0C070", "crust": "#C97B2E", "choc": "#6B3A1E", "steel": "#C9CED6", "mint": "#B8F0D0",
         "peach": "#FFC09A", "butter": "#FFE48A", "lilac": "#C9B3F5", "denim": "#3F6FC2", "ink": "#3A2A4A", "soil": "#7A4A2A"}
for _k, _v in EXTRA.items(): mat(_k, _v)
DEFS = {}
def P(name):
    def d(f): DEFS[name] = f; return f
    return d
def cc(col, *defs):
    if col is None: col = ()
    if isinstance(col, str): col = (col,)
    return tuple(col[i] if i < len(col) and col[i] is not None else defs[i] for i in range(len(defs)))
def lab(b, w, h, z, y, m="white", t=0.006): b.box((w, t, h), (0, y - t / 2, z), m)
def RZX(yaw, pitch): return Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(pitch, 4, "X")

# ------------------------------------------------------------------ packaged groceries
@P("cereal")
def _(b, col):
    c, d = cc(col, "red", "yellow")
    b.box((.17, .07, .25), (0, 0, .125), c); lab(b, .13, .12, .15, -.035); b.box((.06, .006, .06), (0, -.041, .15), d, rot=(0, pi / 4, 0))
@P("bag")
def _(b, col):
    c, d = cc(col, "orange", "white")
    b.prism([(-.07, 0), (.07, 0), (.085, .16), (.06, .19), (.075, .22), (-.075, .22), (-.06, .19), (-.085, .16)], .07, c, mtx=XZ(-.035))
    lab(b, .09, .07, .1, -.035, d)
@P("can")
def _(b, col):
    c, d = cc(col, "red", "steel")
    b.lathe([(.049, 0), (.052, .04), (.052, .1), (.049, .14)], mats=[c, "white", c], seg=7)
@P("tin")
def _(b, col):
    c, d = cc(col, "teal", "gold")
    b.lathe([(.055, 0), (.055, .12), (.058, .12), (.058, .15), (0, .155)], mats=[c, d, d, d], seg=7); lab(b, .06, .05, .06, -.052)
@P("jar")
def _(b, col):
    c, d = cc(col, "rose", "gold")
    b.lathe([(.045, 0), (.058, .015), (.058, .1), (.045, .118), (.05, .118), (.05, .15)], mats=[c, c, c, d, d], seg=7); lab(b, .06, .045, .06, -.054)
@P("bottle")
def _(b, col):
    c, d = cc(col, "orange", "white")
    b.lathe([(.048, 0), (.055, .02), (.055, .06), (.055, .13), (.055, .155), (.028, .215), (.034, .22), (.034, .26)], mats=[c, c, "white", c, c, d, d], seg=7)
@P("sauce")
def _(b, col):
    c, d = cc(col, "red", "green")
    b.lathe([(.03, 0), (.036, .015), (.036, .1), (.016, .14), (.02, .145), (.02, .18)], mats=[c, c, c, d, d], seg=7)
@P("carton")
def _(b, col):
    c, d = cc(col, "sky", "white")
    b.box((.11, .11, .18), (0, 0, .09), d); b.prism([(-.055, 0), (.055, 0), (0, .05)], .11, c, mtx=XZ(-.055, 0, .18))
    b.box((.012, .11, .022), (0, 0, .238), c); lab(b, .11, .07, .09, -.055, c, t=.004)
@P("tub")
def _(b, col):
    c, d = cc(col, "pink", "white")
    b.lathe([(.042, 0), (.058, .1), (.064, .1), (.064, .115)], mats=[c, d, d], seg=7)
@P("eggs")
def _(b, col):
    c, = cc(col, "yellow")
    b.box((.26, .12, .07), (0, 0, .035), "kraft", r=.018, seg=1); lab(b, .1, .035, .035, -.06, c)
@P("cheese")
def _(b, col):
    b.prism([(-.09, -.06), (.09, 0), (-.09, .06)], .08, "butter"); b.box((.06, .006, .05), (-.05, -.045, .04), "red", rot=(0, 0, -.32))
@P("spray")
def _(b, col):
    c, d = cc(col, "teal", "white")
    b.box((.11, .07, .15), (0, 0, .075), c, r=.02, seg=1); b.cyl(.02, .035, (0, 0, .15), d, seg=6)
    b.box((.1, .04, .035), (.02, 0, .2), d); b.box((.02, .025, .03), (.05, 0, .172), d); lab(b, .07, .06, .075, -.035)
@P("pump")
def _(b, col):
    c, d = cc(col, "pink", "white")
    b.lathe([(.045, 0), (.052, .015), (.052, .14), (.02, .165), (.02, .19)], m=c, seg=7)
    b.box((.016, .016, .04), (0, 0, .205), d); b.box((.07, .022, .016), (.02, 0, .228), d); lab(b, .055, .05, .08, -.05)
@P("soapbar")
def _(b, col):
    c, d = cc(col, "mint", "white")
    b.box((.13, .08, .045), (0, 0, .0225), c, r=.015, seg=1); b.box((.05, .084, .049), (0, 0, .0245), d)
@P("tpack")
def _(b, col):
    c, = cc(col, "sky")
    b.box((.24, .13, .14), (0, 0, .07), "white", r=.03, seg=1); b.box((.244, .134, .05), (0, 0, .07), c)
@P("jug")
def _(b, col):
    c, d = cc(col, "blue", "white")
    b.box((.15, .09, .19), (0, 0, .095), c, r=.025, seg=1); b.cyl(.028, .035, (-.035, 0, .19), d, seg=7); lab(b, .1, .08, .09, -.045)
    b.tube([(.015, 0, .185), (.045, 0, .215), (.07, 0, .185)], .012, c, seg=5)
@P("box")
def _(b, col):
    c, d = cc(col, "kraft", "white")
    b.box((.22, .16, .12), (0, 0, .06), c); lab(b, .1, .05, .06, -.08, d)

# ------------------------------------------------------------------ produce
@P("apple")
def _(b, col):
    c, = cc(col, "red")
    b.ball(.075, (0, 0, .066), c, sc=(1, 1, .88), u=7, v=4); b.box((.012, .012, .035), (0, 0, .14), "trunk")
@P("orange")
def _(b, col):
    c, = cc(col, "orange")
    b.ball(.072, (0, 0, .072), c, u=7, v=4); b.cyl(.014, .008, (0, 0, .14), "leaf_dark", seg=5)
@P("tomato")
def _(b, col):
    b.ball(.065, (0, 0, .055), "red", sc=(1, 1, .85), u=7, v=4); b.cyl(.032, .008, (0, 0, .106), "leaf_dark", seg=5); b.box((.01, .01, .025), (0, 0, .12), "leaf_dark")
@P("cabbage")
def _(b, col):
    b.lathe([(0, 0), (.075, .02), (.105, .07), (.105, .115), (.075, .17), (0, .19)], mats=["leaf_dark", "leaf_dark", "green", "leaf_light", "leaf_light"], seg=7)
@P("pumpkin")
def _(b, col):
    b.ball(.11, (0, 0, .083), "orange", sc=(1, 1, .75), u=7, v=4); b.cyl(.018, .04, (0, 0, .16), "leaf_dark", seg=5)
@P("melon")
def _(b, col):
    b.ball(.12, (0, 0, .12), "leaf_dark", sc=(1.2, 1, 1), u=10, v=6)
@P("pineapple")
def _(b, col):
    b.lathe([(0, 0), (.06, .02), (.075, .09), (.065, .17), (.03, .2), (0, .2)], m="gold", seg=7)
    for i in range(5):
        a = tau * i / 5; b.ball(.07, (.02 * cos(a), .02 * sin(a), .25), "leaf_dark" if i % 2 else "green", sc=(.3, .12, 1), u=6, v=3, rot=(0, .4, a))
@P("broccoli")
def _(b, col):
    b.cyl(.03, .09, (0, 0, 0), "leaf_light", seg=6)
    for (x, y, z) in ((0, 0, .13), (.05, .01, .11), (-.05, -.01, .11), (0, .05, .105), (0, -.05, .105)): b.ball(.05, (x, y, z), "leaf_dark", u=6, v=3)
@P("banana")
def _(b, col):
    for fx in (-.05, 0, .05):
        b.tube([(fx * (.3 + .7 * (1 - t) / 2 * 2) / 1.7, .1 * t, .026 + .05 * t * t) for t in (1, .4, -.4, -1)], [.012, .024, .024, .008], "yellow", seg=5)
    b.box((.05, .03, .03), (0, .1, .08), "trunk")
def _carrot(b, x, y, z, yaw, L=.26):
    b.lathe([(0, 0), (.028, .008), (.03, .03), (.012, L - .04), (0, L)], loc=(x, y, z), m="orange", seg=5, rot=RZX(yaw, pi / 2))
@P("carrots")
def _(b, col):
    """A bunch: three carrots under two, tips forward, tied below the leafy tops."""
    for k in (-1, 0, 1): _carrot(b, .06 * k, .1, .03, .12 * k)
    for k in (-.5, .5): _carrot(b, .06 * k, .1, .078, .1 * k)
    b.tube([(-.092, .07, .005), (-.092, .07, .095), (0, .07, .118), (.092, .07, .095), (.092, .07, .005)], .008, "blue", seg=4)
    for i, k in enumerate((-1.2, 0, 1.2)):
        b.ball(.11, (.04 * k, .175, .07 + .012 * (1.5 - abs(k))), "leaf_dark" if i % 2 else "green", sc=(.32, 1, .16), u=6, v=3, rot=(.28, 0, -.2 * k))
@P("bouquet")
def _(b, col):
    c, d = cc(col, "pink", "kraft")
    b.lathe([(0, 0), (.02, .02), (.075, .2), (0, .19)], m=d, seg=7, cap=False)
    for i, (x, y) in enumerate(((0, 0), (.04, .02), (-.04, .02), (0, -.04), (.01, .045))):
        b.ball(.036, (x, y, .215 + .012 * (i % 3)), c if i % 2 == 0 else "white", u=6, v=3)
    b.ball(.05, (.05, -.02, .2), "leaf_dark", sc=(.3, .12, 1), u=6, v=3, rot=(0, .7, -.4))

# ------------------------------------------------------------------ bakery and cafe
@P("loaf")
def _(b, col):
    c, = cc(col, "crust")
    b.box((.24, .12, .11), (0, 0, .055), c, r=.04, seg=1)
    for x in (-.06, 0, .06): b.box((.012, .09, .012), (x, 0, .108), "bread", rot=(0, 0, .5))
@P("baguette")
def _(b, col):
    b.ball(.04, (0, 0, .034), "crust", sc=(4.2, 1, .85), u=7, v=4)
    for x in (-.09, -.03, .03, .09): b.box((.012, .05, .01), (x, 0, .066), "bread", rot=(0, 0, .6))
@P("bun")
def _(b, col):
    c, = cc(col, "crust")
    b.ball(.06, (0, 0, .042), c, sc=(1, 1, .7), u=7, v=4)
@P("croissant")
def _(b, col):
    b.tube([(.07 * sin(a), .07 * cos(a) - .045, .04) for a in (-1.15, -.6, 0, .6, 1.15)], [.012, .034, .045, .034, .012], "crust", seg=6)
@P("donut")
def _(b, col):
    c, = cc(col, "pink"); R, r = .05, .028
    b.lathe([(R + r * cos(radians(k)), r + r * sin(radians(k))) for k in (180, 240, 300, 0, 60, 120, 180)], mats=["bread", "bread", "bread", c, c, c], seg=7, cap=False)
@P("cupcake")
def _(b, col):
    c, d = cc(col, "pink", "kraft")
    b.cyl(.04, .05, (0, 0, 0), d, seg=7, r2=.055); b.ball(.058, (0, 0, .075), c, sc=(1, 1, .75), u=7, v=4); b.ball(.018, (0, 0, .125), "red", u=6, v=3)
@P("cake")
def _(b, col):
    c, d = cc(col, "pink", "bread")
    b.lathe([(.11, 0), (.11, .045), (.11, .058), (.11, .1), (.1, .118), (0, .12)], mats=[d, "white", d, c, c], seg=10)
    for i in range(6): b.ball(.018, (.075 * cos(tau * i / 6), .075 * sin(tau * i / 6), .13), "red", u=6, v=3)
@P("slice")
def _(b, col):
    c, d = cc(col, "pink", "bread"); z = 0
    for h, m in ((.04, d), (.012, "white"), (.04, d), (.014, c)): b.prism([(0, -.08), (.05, .07), (-.05, .07)], h, m, loc=(0, 0, z)); z += h
    b.ball(.016, (0, .035, z + .012), "red", u=6, v=3)
@P("tart")
def _(b, col):
    c, = cc(col, "butter")
    b.lathe([(.045, 0), (.065, .028), (.055, .028), (0, .032)], mats=["crust", "crust", c], seg=7); b.ball(.016, (0, 0, .04), "white", u=6, v=3)
@P("sandwich")
def _(b, col):
    c, = cc(col, "pink"); z = 0
    for h, m in ((.028, "white"), (.012, "leaf_light"), (.012, c), (.028, "white")): b.prism([(-.09, -.055), (.09, -.055), (-.09, .075)], h, m, loc=(0, 0, z)); z += h
@P("burger")
def _(b, col):
    b.lathe([(.05, 0), (.066, .015), (.066, .03), (.072, .03), (.072, .05), (.078, .05), (.078, .058), (.066, .06), (.058, .09), (0, .105)],
            mats=["crust", "crust", "choc", "choc", "leaf_light", "leaf_light", "butter", "crust", "crust"], seg=7)
@P("togo")
def _(b, col):
    c, d = cc(col, "white", "kraft")
    b.lathe([(.034, 0), (.039, .035), (.045, .085), (.048, .11), (.052, .11), (.052, .124), (.04, .135), (0, .135)], mats=[c, d, c, "white", "white", "white", "white"], seg=7)
@P("boba")
def _(b, col):
    c, d = cc(col, "peach", "choc")
    b.lathe([(.036, 0), (.04, .03), (.05, .13), (.054, .13), (.054, .14), (.03, .165), (0, .168)], mats=[d, c, "white", "white", "white", "white"], seg=7)
    b.box((.012, .012, .1), (.01, 0, .17), "pink", rot=(0, .12, 0))
def _mug(b, c, d=None, s=1.0, z=0.0, seg=8):
    f = .085 if d else .02
    b.lathe([(.046 * s, z), (.055 * s, z + .012 * s), (.055 * s, z + .105 * s), (.047 * s, z + .105 * s), (.047 * s, z + f * s), (0, z + f * s)], mats=[c, c, c, c, d or c], seg=seg)
    b.tube([(.05 * s, 0, z + .085 * s), (.088 * s, 0, z + .085 * s), (.1 * s, 0, z + .055 * s), (.088 * s, 0, z + .028 * s), (.05 * s, 0, z + .028 * s)], .011 * s, c, seg=6)
@P("mug")
def _(b, col):
    c, d = cc(col, "sky", None); _mug(b, c, d)
@P("cupsaucer")
def _(b, col):
    c, d = cc(col, "white", "choc")
    b.lathe([(.03, 0), (.08, .012), (.08, .018), (.03, .01), (0, .01)], m=c, seg=8); _mug(b, c, d, s=.8, z=.01)
@P("cupstack")
def _(b, col):
    c, = cc(col, "white")
    pr = [(.034, 0)]
    for k in range(5): pr += [(.046, .1 + k * .022), (.05, .1 + k * .022), (.05, .108 + k * .022), (.04, .108 + k * .022)]
    b.lathe(pr + [(0, .2)], m=c, seg=7)
@P("kettle")
def _(b, col):
    c, d = cc(col, "red", "plum")
    b.lathe([(.07, 0), (.098, .03), (.1, .085), (.075, .145), (.03, .165), (0, .168)], m=c, seg=8); b.ball(.02, (0, 0, .182), d, u=6, v=3)
    b.tube([(.08, 0, .07), (.135, 0, .11), (.165, 0, .16)], [.024, .017, .013], c, seg=6)
    b.tube([(-.06, 0, .14), (-.075, 0, .21), (-.02, 0, .255), (.04, 0, .24), (.055, 0, .15)], .011, d, seg=6)
@P("teapot")
def _(b, col):
    c, d = cc(col, "white", "blue")
    b.lathe([(.05, 0), (.085, .03), (.09, .075), (.065, .12), (.03, .13), (0, .132)], mats=[c, c, d, c, c], seg=8); b.ball(.018, (0, 0, .145), d, u=6, v=3)
    b.tube([(.075, 0, .06), (.12, 0, .085), (.14, 0, .125)], [.02, .014, .011], c, seg=6)
    b.tube([(-.07, 0, .11), (-.115, 0, .105), (-.125, 0, .07), (-.11, 0, .04), (-.075, 0, .04)], .01, c, seg=6)
def _plate(b, c, d, loc=(0, 0, 0), rot=None, seg=16):
    b.lathe([(.05, 0), (.112, .016), (.115, .022), (.1, .022), (.06, .01), (0, .01)], loc=loc, mats=[c, c, d, c, c], seg=seg, rot=rot)
@P("plate")
def _(b, col):
    c, d = cc(col, "white", "blue"); _plate(b, c, d)
@P("plateup")
def _(b, col):
    """A plate standing on a little wooden stand so its face shows."""
    c, d = cc(col, "white", "blue")
    _plate(b, c, d, loc=(0, .028, .12), rot=(radians(76), 0, 0)); b.box((.09, .1, .02), (0, .01, .01), "wood"); b.box((.03, .02, .1), (0, .05, .06), "wood", rot=(.24, 0, 0))
    b.box((.09, .015, .03), (0, -.035, .025), "wood")
@P("platestack")
def _(b, col):
    cols = list(col) if isinstance(col, (list, tuple)) else [col or "white"] * 4; pr = [(.05, 0)]; ms = []
    for k, c in enumerate(cols):
        z = k * .014; pr += [(.115, z + .018), (.115, z + .024), (.075, z + .024)]; ms += [c, c, c]
    b.lathe(pr + [(0, z + .014)], mats=ms + [cols[-1]], seg=8)
def _bowl(b, c, z=0.0, d="white"):
    b.lathe([(.04, z), (.085, z + .05), (.092, z + .07), (.082, z + .07), (.045, z + .022), (0, z + .02)], mats=[c, c, c, d, d], seg=8)
@P("bowl")
def _(b, col):
    c, d = cc(col, "teal", "white"); _bowl(b, c, 0, d)
@P("bowlstack")
def _(b, col):
    cols = list(col) if isinstance(col, (list, tuple)) else [col or "teal"] * 3
    for k, c in enumerate(cols): _bowl(b, c, k * .024)
@P("vase")
def _(b, col):
    c, d = cc(col, "teal", None)
    b.lathe([(.04, 0), (.072, .05), (.078, .11), (.04, .19), (.036, .225), (.048, .25), (.036, .25), (0, .245)], m=c, seg=7)
    if d:
        for (x, y, h, m) in ((0, 0, .37, d), (.035, .01, .34, "white"), (-.035, -.005, .32, d)):
            b.box((.008, .008, h - .24), (x * .6, y * .6, (h + .24) / 2), "leaf_dark"); b.ball(.032, (x, y, h), m, u=6, v=3)
@P("candle")
def _(b, col):
    c, = cc(col, "lilac")
    b.lathe([(.045, 0), (.048, .01), (.048, .085), (.04, .085), (0, .08)], mats=[c, c, c, "cream"], seg=7); b.box((.006, .006, .02), (0, 0, .09), "plum"); lab(b, .05, .035, .045, -.044)
@P("cushion")
def _(b, col):
    c, d = cc(col, "pink", "white")
    b.box((.27, .09, .27), (0, 0, .135), c, r=.04, seg=2); b.box((.13, .01, .13), (0, -.045, .135), d, rot=(0, pi / 4, 0))
@P("throw")
def _(b, col):
    c, d = cc(col, "sky", "white")
    b.box((.3, .22, .075), (0, 0, .0375), c, r=.03, seg=1); b.box((.304, .04, .079), (0, -.04, .0375), d)
@P("towel")
def _(b, col):
    c, d = cc(col, "white", "teal")
    b.box((.24, .18, .06), (0, 0, .03), c, r=.025, seg=1); b.box((.244, .03, .064), (0, -.04, .03), d)
@P("towelroll")
def _(b, col):
    c, d = cc(col, "white", "teal")
    b.lathe([(0, 0), (.05, 0), (.05, .04), (.05, .07), (.05, .2), (0, .2)], loc=(0, -.1, .05), mats=[c, c, d, c, c], seg=7, rot=(-pi / 2, 0, 0))
@P("lamp")
def _(b, col):
    c, d = cc(col, "yellow", "wood")
    b.lathe([(.055, 0), (.06, .012), (.022, .03), (.018, .15)], m=d, seg=7); b.cyl(.095, .11, (0, 0, .135), c, seg=8, r2=.06)
@P("frame")
def _(b, col):
    c, = cc(col, "wood")
    b.box((.2, .025, .25), (0, 0, .125), c); b.box((.15, .006, .2), (0, -.0155, .125), "sky"); b.box((.04, .006, .04), (.03, -.0215, .17), "yellow")
    b.prism([(-.075, 0), (.075, 0), (.075, .04), (.02, .09), (-.03, .05), (-.075, .07)], .006, "green", mtx=XZ(-.0245, 0, .025))
@P("storagebox")
def _(b, col):
    c, d = cc(col, "sand", "white")
    b.box((.3, .22, .15), (0, 0, .075), c, r=.02, seg=1); b.box((.32, .24, .04), (0, 0, .165), d, r=.012, seg=1); lab(b, .1, .05, .08, -.11)
@P("basket")
def _(b, col):
    c, = cc(col, "wood")
    b.lathe([(.1, 0), (.13, .13), (.14, .13), (.14, .155), (.125, .155), (.1, .03), (0, .03)], mats=[c, c, "trunk", "trunk", "sand", "sand"], seg=8)
@P("clock")
def _(b, col):
    c, = cc(col, "red")
    b.cyl(.105, .04, (0, .02, .117), c, seg=10, rot=(pi / 2, 0, 0)); b.cyl(.085, .006, (0, -.02, .117), "white", seg=10, rot=(pi / 2, 0, 0))
    b.box((.008, .006, .06), (0, -.029, .14), "plum"); b.box((.045, .006, .008), (.02, -.029, .117), "plum"); b.box((.13, .05, .014), (0, 0, .007), c)
@P("plant")
def _(b, col):
    c, d = cc(col, "terracotta", "green")
    b.cyl(.05, .09, (0, 0, 0), c, seg=7, r2=.068); b.cyl(.074, .02, (0, 0, .085), c, seg=7)
    for i in range(5):
        a = tau * i / 5 + .3; b.ball(.1, (.045 * cos(a), .045 * sin(a), .19), d if i % 2 else "leaf_dark", sc=(.3, .1, 1), u=6, v=3, rot=(0, .45, a))
@P("succulent")
def _(b, col):
    c, = cc(col, "white")
    b.cyl(.04, .06, (0, 0, 0), c, seg=7, r2=.055); b.ball(.055, (0, 0, .08), "leaf_light", sc=(1, 1, .55), u=6, v=3); b.ball(.03, (0, 0, .105), "mint", u=6, v=3)
@P("cactus")
def _(b, col):
    c, = cc(col, "terracotta")
    b.cyl(.045, .07, (0, 0, 0), c, seg=7, r2=.06); b.ball(.045, (0, 0, .15), "green", sc=(1, 1, 1.9), u=7, v=4)
    b.ball(.022, (.055, 0, .15), "green", sc=(1, 1, 1.6), u=6, v=3); b.ball(.016, (0, 0, .242), "pink", u=6, v=3)
@P("tulips")
def _(b, col):
    c, d = cc(col, "red", "white")
    b.cyl(.05, .08, (0, 0, 0), d, seg=7, r2=.065)
    for (x, y, h, m) in ((0, 0, .25, c), (.04, .015, .22, "yellow"), (-.04, -.01, .21, c)):
        b.box((.01, .01, h - .08), (x, y, (h + .08) / 2), "leaf_dark"); b.ball(.03, (x, y, h), m, sc=(1, 1, 1.25), u=6, v=3)
    b.ball(.07, (.03, -.03, .13), "green", sc=(.3, .12, 1), u=6, v=3, rot=(0, .5, -.8))

# ------------------------------------------------------------------ clothing, shoes, accessories
def _hook(b): b.tube([(0, 0, -.06), (.022, 0, -.032), (.03, 0, 0), (.018, 0, .026), (-.012, 0, .03), (-.03, 0, .008)], .006, "steel", seg=5)
TEE = [(-.05, -.06), (.05, -.06), (.13, -.075), (.22, -.16), (.185, -.22), (.13, -.18), (.13, -.47), (-.13, -.47), (-.13, -.18), (-.185, -.22), (-.22, -.16), (-.13, -.075)]
@P("tee")
def _(b, col):
    c, d = cc(col, "sky", "white")
    _hook(b); b.prism(TEE, .05, c, mtx=XZ(-.025), r=.012); b.box((.1, .008, .08), (0, -.029, -.27), d, rot=(0, pi / 4, 0))
@P("jacket")
def _(b, col):
    c, d = cc(col, "navy", "white")
    J = [(-.05, -.06), (.05, -.06), (.14, -.075), (.24, -.2), (.22, -.44), (.17, -.44), (.15, -.2), (.14, -.52), (-.14, -.52), (-.15, -.2), (-.17, -.44), (-.22, -.44), (-.24, -.2), (-.14, -.075)]
    _hook(b); b.prism(J, .06, c, mtx=XZ(-.03), r=.012); b.prism([(-.05, -.06), (.05, -.06), (0, -.25)], .008, d, mtx=XZ(-.038))
    for z in (-.32, -.4): b.box((.022, .008, .022), (0, -.034, z), "gold")
@P("dress")
def _(b, col):
    c, d = cc(col, "pink", "white")
    D = [(-.04, -.06), (.04, -.06), (.1, -.08), (.085, -.22), (.21, -.62), (-.21, -.62), (-.085, -.22), (-.1, -.08)]
    _hook(b); b.prism(D, .05, c, mtx=XZ(-.025), r=.012); b.box((.18, .058, .03), (0, 0, -.225), d)
@P("trousers")
def _(b, col):
    c, = cc(col, "denim")
    _hook(b); b.box((.26, .012, .014), (0, 0, -.065), "wood")
    b.prism([(-.12, -.07), (.12, -.07), (.14, -.62), (.015, -.62), (0, -.24), (-.015, -.62), (-.14, -.62)], .05, c, mtx=XZ(-.025), r=.01); b.box((.245, .056, .035), (0, 0, -.09), c)
@P("skirt")
def _(b, col):
    c, d = cc(col, "yellow", "white")
    _hook(b); b.box((.26, .012, .014), (0, 0, -.065), "wood"); b.prism([(-.1, -.07), (.1, -.07), (.2, -.4), (-.2, -.4)], .05, c, mtx=XZ(-.025), r=.012); b.box((.205, .056, .03), (0, 0, -.085), d)
@P("foldtee")
def _(b, col):
    c, d = cc(col, "sky", "white")
    b.box((.26, .3, .05), (0, 0, .025), c, r=.018, seg=1); b.prism([(-.045, -.15), (.045, -.15), (0, -.09)], .004, d, loc=(0, 0, .05))
@P("jeans")
def _(b, col):
    c, = cc(col, "denim")
    b.box((.24, .3, .065), (0, 0, .0325), c, r=.018, seg=1); b.box((.08, .09, .004), (.05, -.06, .067), "gold")
@P("hat")
def _(b, col):
    c, d = cc(col, "sand", "red")
    b.lathe([(.19, 0), (.19, .012), (.09, .02), (.088, .05), (.085, .09), (.06, .12), (0, .125)], mats=[c, c, d, c, c, c], seg=10)
@P("hatstand")
def _(b, col):
    c, d = cc(col, "sand", "red")
    b.cyl(.07, .015, (0, 0, 0), "wood", seg=7); b.cyl(.012, .15, (0, 0, .015), "wood", seg=6); b.ball(.075, (0, 0, .2), "wood", sc=(1, 1, .8), u=6, v=3)
    b.lathe([(.19, .2), (.19, .212), (.09, .22), (.088, .25), (.085, .29), (.06, .32), (0, .325)], mats=[c, c, d, c, c, c], seg=10)
@P("cap")
def _(b, col):
    c, d = cc(col, "red", "white")
    b.lathe([(.085, 0), (.085, .03), (.07, .075), (.035, .1), (0, .105)], mats=[c, c, c, c], seg=8); b.prism([(-.075, -.04), (-.05, -.15), (.05, -.15), (.075, -.04)], .012, d, r=.004)
    b.ball(.012, (0, 0, .108), d, u=6, v=3)
@P("handbag")
def _(b, col):
    c, d = cc(col, "terracotta", "gold")
    b.box((.26, .1, .17), (0, 0, .085), c, r=.03, seg=1); b.box((.264, .104, .06), (0, 0, .14), c); b.box((.04, .012, .035), (0, -.055, .115), d)
    b.tube([(-.08, 0, .16), (-.08, 0, .23), (0, 0, .27), (.08, 0, .23), (.08, 0, .16)], .01, c, seg=5)
@P("tote")
def _(b, col):
    """Hangs from a peg: the handle top is at the origin."""
    c, d = cc(col, "cream", "pink")
    b.tube([(-.08, 0, -.2), (-.08, 0, -.05), (0, 0, 0), (.08, 0, -.05), (.08, 0, -.2)], .008, "trunk", seg=5); b.box((.3, .05, .32), (0, 0, -.33), c, r=.012, seg=1)
    bloom(b, (0, -.027, -.34), .085, "-y", d, "yellow", 6)
@P("socks")
def _(b, col):
    c, d = cc(col, "pink", "white")
    b.box((.1, .03, .2), (0, 0, .1), c, r=.012, seg=1); b.box((.104, .034, .04), (0, 0, .17), d); b.box((.104, .034, .02), (0, 0, .06), d)
@P("scarf")
def _(b, col):
    c, d = cc(col, "red", "white")
    b.lathe([(0, 0), (.05, 0), (.05, .03), (.05, .05), (.05, .08), (.05, .1), (.05, .13), (0, .13)], loc=(0, .065, .05), mats=[c, c, d, c, d, c, c], seg=7, rot=(pi / 2, 0, 0))
def _shoe(b, c, d, pts, toe=True):
    b.box((.32, .125, .03), (0, 0, .015), "white"); b.prism(pts, .105, c, mtx=XZ(-.0525), r=.014)
    if toe: b.box((.065, .11, .032), (.122, 0, .047), "white")
@P("sneaker")
def _(b, col):
    c, d = cc(col, "red", "white")
    _shoe(b, c, d, [(-.15, .03), (.15, .03), (.15, .065), (.1, .085), (.02, .112), (-.03, .15), (-.15, .15)])
    b.box((.1, .06, .012), (.055, 0, .103), "white", rot=(0, .33, 0)); b.box((.11, .11, .02), (-.055, 0, .085), d, rot=(0, -.5, 0)); b.box((.1, .07, .008), (-.09, 0, .15), "plum")
@P("hitop")
def _(b, col):
    c, d = cc(col, "blue", "white")
    _shoe(b, c, d, [(-.15, .03), (.15, .03), (.15, .065), (.1, .085), (.03, .12), (-.02, .21), (-.15, .21)])
    b.box((.1, .06, .012), (.06, 0, .108), "white", rot=(0, .36, 0)); b.cyl(.03, .008, (-.08, -.053, .165), d, seg=7, rot=(pi / 2, 0, 0)); b.box((.11, .07, .008), (-.085, 0, .21), "plum")
@P("boot")
def _(b, col):
    c, d = cc(col, "trunk", "plum")
    b.box((.31, .125, .035), (0, 0, .0175), d); b.prism([(-.15, .035), (.15, .035), (.15, .08), (.09, .1), (0, .12), (-.02, .27), (-.15, .27)], .105, c, mtx=XZ(-.0525), r=.014)
    b.box((.135, .11, .03), (-.085, 0, .255), d)
@P("loafer")
def _(b, col):
    c, d = cc(col, "trunk", "gold")
    b.box((.3, .12, .022), (0, 0, .011), "plum"); b.prism([(-.14, .022), (.145, .022), (.145, .05), (.08, .075), (-.02, .08), (-.06, .105), (-.14, .105)], .1, c, mtx=XZ(-.05), r=.014)
    b.box((.02, .08, .012), (.04, 0, .08), d, rot=(0, .15, 0)); b.box((.07, .06, .006), (-.1, 0, .105), "plum")
@P("sandal")
def _(b, col):
    c, d = cc(col, "yellow", "white")
    b.box((.3, .12, .03), (0, 0, .015), "sand", r=.012, seg=1); b.tube([(.06, -.06, .03), (.06, -.03, .08), (.06, .03, .08), (.06, .06, .03)], .014, c, seg=5)
    b.tube([(-.07, -.06, .03), (-.07, -.03, .075), (-.07, .03, .075), (-.07, .06, .03)], .012, d, seg=5)
@P("shoebox")
def _(b, col):
    c, d = cc(col, "blue", "white")
    b.box((.32, .19, .11), (0, 0, .055), c); b.box((.335, .205, .035), (0, 0, .11), d); lab(b, .12, .05, .05, -.095, "white")
@P("mannequin")
def _(b, col):
    c, d = cc(col, "pink", "white")
    b.cyl(.17, .03, (0, 0, 0), "steel", seg=10); b.cyl(.018, .5, (0, 0, .03), "steel", seg=6)
    b.lathe([(0, .46), (.1, .48), (.125, .56), (.095, .72), (.125, .9), (.13, .97), (.06, 1.05), (.045, 1.1), (0, 1.1)], mats=[c, c, c, c, c, "cream", "cream", "cream"], seg=8)
    b.lathe([(.1, .7), (.27, .3), (.25, .29), (.09, .68)], m=c, seg=8, cap=False); b.lathe([(.098, .7), (.1, .74), (.102, .7)], m=d, seg=8, cap=False)
    b.ball(.035, (0, 0, 1.125), "wood", u=6, v=3)

# ------------------------------------------------------------------ books, games, stationery
@P("bookface")
def _(b, col):
    """A book facing out, leaning back on a small easel."""
    c, d = cc(col, "teal", "white"); r = (-.2, 0, 0)
    b.box((.2, .03, .27), (0, .03, .14), c, rot=r); b.box((.14, .006, .09), (0, .0, .19), d, rot=r); b.box((.06, .006, .06), (0, .022, .09), "yellow", rot=(-.2, pi / 4, 0))
    b.box((.14, .09, .012), (0, .04, .006), "wood"); b.box((.14, .014, .03), (0, -.01, .02), "wood")
@P("notebook")
def _(b, col):
    c, d = cc(col, "pink", "plum")
    b.box((.17, .23, .025), (0, 0, .0125), c); b.box((.012, .234, .027), (.05, 0, .0135), d)
@P("pencilcup")
def _(b, col):
    c, = cc(col, "sky")
    b.cyl(.045, .1, (0, 0, 0), c, seg=7)
    for i, m in enumerate(("red", "yellow", "green", "blue")):
        a = tau * i / 4 + .4; b.box((.012, .012, .13), (.018 * cos(a), .018 * sin(a), .115), m, rot=(.12 * sin(a), -.12 * cos(a), 0))
@P("globe")
def _(b, col):
    b.lathe([(.07, 0), (.07, .012), (.012, .025), (.012, .06)], m="wood", seg=7); b.ball(.085, (0, 0, .14), "sky", u=10, v=6)
    b.ball(.03, (.05, -.05, .16), "green", sc=(1.4, .6, 1), u=6, v=3); b.ball(.028, (-.04, -.06, .12), "green", sc=(1, .6, 1.5), u=6, v=3)
@P("gamecase")
def _(b, col):
    c, d = cc(col, "red", "yellow")
    b.box((.17, .03, .23), (0, 0, .115), "white"); b.box((.15, .006, .2), (0, -.018, .115), c); b.box((.06, .006, .06), (0, -.024, .13), d, rot=(0, pi / 4, 0)); b.box((.15, .006, .03), (0, -.0185, .2), "plum")
@P("console")
def _(b, col):
    c, d = cc(col, "white", "teal")
    b.box((.32, .22, .07), (0, 0, .035), c, r=.02, seg=1); b.box((.2, .006, .012), (-.03, -.111, .04), "plum"); b.box((.02, .006, .02), (.12, -.111, .04), d)
@P("handheld")
def _(b, col):
    c, d = cc(col, "purple", "teal"); r = (-.3, 0, 0)
    b.box((.2, .1, .02), (0, .03, .01), "plum"); b.box((.2, .022, .13), (0, .02, .085), "plum", rot=r); b.box((.18, .006, .11), (0, .008, .09), "sky", rot=r)
    b.box((.05, .026, .13), (-.125, .02, .085), c, r=.012, seg=1, rot=r); b.box((.05, .026, .13), (.125, .02, .085), d, r=.012, seg=1, rot=r)
@P("controller")
def _(b, col):
    c, d = cc(col, "white", "plum")
    b.box((.2, .11, .04), (0, 0, .045), c, r=.018, seg=1); b.ball(.04, (-.085, -.035, .035), c, sc=(1, 1.3, .85), u=6, v=3); b.ball(.04, (.085, -.035, .035), c, sc=(1, 1.3, .85), u=6, v=3)
    b.box((.045, .015, .008), (-.05, .01, .069), d); b.box((.015, .045, .008), (-.05, .01, .069), d)
    for (x, y, m) in ((.04, .01, "red"), (.07, .025, "yellow"), (.07, -.005, "green"), (.1, .01, "blue")): b.cyl(.011, .008, (x, y, .065), m, seg=6)
@P("headset")
def _(b, col):
    c, d = cc(col, "purple", "plum")
    b.cyl(.07, .015, (0, 0, 0), d, seg=7); b.cyl(.014, .2, (0, 0, .015), d, seg=6); b.box((.09, .03, .02), (0, 0, .22), d)
    b.tube([(-.095, 0, .1), (-.1, 0, .19), (-.06, 0, .245), (0, 0, .262), (.06, 0, .245), (.1, 0, .19), (.095, 0, .1)], .013, c, seg=5)
    for sx in (-1, 1): b.cyl(.05, .04, (sx * .075, 0, .1), c, seg=7, rot=(0, sx * pi / 2, 0))
@P("cartridge")
def _(b, col):
    c, = cc(col, "red")
    b.box((.1, .02, .11), (0, 0, .055), "grey"); b.box((.08, .006, .06), (0, -.013, .065), c)
@P("arcade")
def _(b, col):
    c, d = cc(col, "purple", "yellow")
    b.prism([(-.11, 0), (.11, 0), (.11, .34), (.02, .34), (-.04, .22), (-.11, .2)], .2, c, mtx=YZ(-.1, 0, 0, False))
    b.box((.16, .008, .1), (0, -.012, .28), "sky", rot=(-.46, 0, 0)); b.box((.2, .09, .04), (0, .065, .36), d)
    b.cyl(.008, .035, (-.04, -.07, .205), "plum", seg=5); b.ball(.016, (-.04, -.07, .245), "red", u=6, v=3); b.cyl(.014, .008, (.04, -.07, .207), d, seg=6)
@P("plush")
def _(b, col):
    c, d = cc(col, "pink", "white")
    b.ball(.085, (0, 0, .075), c, sc=(1, .9, .88), u=7, v=4); b.ball(.03, (-.055, 0, .155), c, u=6, v=3); b.ball(.03, (.055, 0, .155), c, u=6, v=3)
    b.ball(.035, (0, -.065, .06), d, sc=(1, .5, .8), u=6, v=3); b.box((.014, .014, .02), (-.03, -.068, .1), "plum"); b.box((.014, .014, .02), (.03, -.068, .1), "plum")
@P("boardgame")
def _(b, col):
    c, d = cc(col, "red", "yellow")
    b.box((.28, .2, .06), (0, 0, .03), c); lab(b, .16, .03, .03, -.1, d); b.box((.12, .09, .004), (0, 0, .062), d)

# ------------------------------------------------------------------ craft
@P("yarn")
def _(b, col):
    c, = cc(col, "pink")
    b.ball(.075, (0, 0, .075), c, u=7, v=4); b.cyl(.078, .04, (0, 0, .055), "white", seg=7)
@P("bolt")
def _(b, col):
    c, = cc(col, "pink")
    b.box((.075, .24, .27), (0, 0, .135), c, r=.03, seg=1); b.box((.03, .006, .05), (0, -.122, .2), "white")
@P("paintcan")
def _(b, col):
    c, = cc(col, "red")
    b.lathe([(.06, 0), (.06, .025), (.06, .09), (.06, .11), (.064, .11), (.064, .122), (.05, .122), (0, .118)], mats=["steel", c, "steel", "steel", "steel", "steel", c], seg=8)
@P("brushjar")
def _(b, col):
    c, = cc(col, "white")
    b.cyl(.042, .09, (0, 0, 0), c, seg=7)
    for i, m in enumerate(("red", "blue", "yellow")):
        a = tau * i / 3; x, y = .016 * cos(a), .016 * sin(a); b.box((.01, .01, .12), (x, y, .13), "wood", rot=(.1 * sin(a), -.1 * cos(a), 0)); b.box((.016, .012, .035), (x * 1.5, y * 1.5, .2), m)
@P("spool")
def _(b, col):
    c, = cc(col, "red")
    b.lathe([(.04, 0), (.04, .012), (.03, .012), (.03, .075), (.04, .075), (.04, .087)], mats=["wood", "wood", c, "wood", "wood"], seg=7)
@P("kitbox")
def _(b, col):
    c, d = cc(col, "teal", "yellow")
    b.box((.3, .06, .22), (0, 0, .11), c); b.box((.2, .006, .12), (0, -.033, .1), "white"); bloom(b, (0, -.037, .1), .045, "-y", d, "white", 6)
@P("sketchbook")
def _(b, col):
    c, = cc(col, "plum")
    b.box((.2, .03, .26), (0, 0, .13), c); b.box((.16, .006, .05), (0, -.018, .19), "white")
    for i in range(5): b.cyl(.01, .036, (-.08 + .04 * i, .018, .262), "steel", seg=5, rot=(pi / 2, 0, 0))
@P("markers")
def _(b, col):
    b.box((.2, .03, .16), (0, 0, .08), "white")
    for i, m in enumerate(("red", "orange", "yellow", "green", "blue", "purple")): b.box((.024, .034, .13), (-.075 + .03 * i, 0, .085), m)
@P("clay")
def _(b, col):
    for i, m in enumerate(col if isinstance(col, (list, tuple)) else ("red", "yellow", "blue")): b.box((.14, .09, .05), (0, 0, .025 + .05 * i), m, r=.012, seg=1, rot=(0, 0, .12 * (i - 1)))
@P("washi")
def _(b, col):
    for i, m in enumerate(col if isinstance(col, (list, tuple)) else ("pink", "teal", "yellow")):
        b.lathe([(.022, i * .03), (.045, i * .03), (.045, i * .03 + .028), (.022, i * .03 + .028), (.022, i * .03)], m=m, seg=7, cap=False)
@P("canvas")
def _(b, col):
    c, = cc(col, "sky"); r = (-.22, 0, 0)
    for sx in (-1, 1): b.box((.014, .014, .34), (sx * .09, .04, .165), "wood", rot=(-.22, sx * .12, 0))
    b.box((.014, .014, .3), (0, .12, .14), "wood", rot=(.3, 0, 0)); b.box((.24, .02, .012), (0, .012, .08), "wood")
    b.box((.22, .015, .18), (0, .03, .18), "white", rot=r); b.box((.18, .006, .14), (0, .02, .182), c, rot=r); b.ball(.03, (.03, .014, .2), "yellow", sc=(1, .3, 1), u=6, v=3)
@P("toolbox")
def _(b, col):
    c, = cc(col, "red")
    b.box((.3, .15, .12), (0, 0, .06), c, r=.015, seg=1); b.box((.31, .16, .035), (0, 0, .125), "plum"); b.box((.03, .012, .03), (0, -.08, .09), "gold")
    b.tube([(-.07, 0, .14), (-.07, 0, .18), (.07, 0, .18), (.07, 0, .14)], .01, "plum", seg=5)
@P("sewing")
def _(b, col):
    c, = cc(col, "mint")
    b.box((.36, .16, .035), (0, 0, .0175), c, r=.012, seg=1); b.box((.08, .12, .2), (.13, 0, .135), c, r=.02, seg=1); b.box((.3, .11, .07), (-.01, 0, .225), c, r=.02, seg=1)
    b.box((.06, .1, .07), (-.13, 0, .16), c, r=.015, seg=1); b.box((.008, .008, .05), (-.13, 0, .1), "steel"); b.cyl(.04, .02, (.172, 0, .17), "white", seg=7, rot=(0, pi / 2, 0))
    b.lathe([(.022, .26), (.022, .268), (.016, .268), (.016, .31), (.022, .31), (.022, .318)], loc=(.02, 0, 0), mats=["wood", "wood", "red", "wood", "wood"], seg=6)

# ------------------------------------------------------------------ gifts and seasonal
def _gift(b, w, d, h, c, r, bow=True):
    b.box((w, d, h), (0, 0, h / 2), c); b.box((w * .2, d + .006, h + .006), (0, 0, h / 2), r); b.box((w + .006, d * .2, h + .006), (0, 0, h / 2), r)
    for s in ((-1, 1) if bow else ()): b.ball(w * .16, (s * w * .13, 0, h + w * .05), r, sc=(1, .55, .6), u=6, v=3, rot=(0, -s * .5, 0))
@P("gift_s")
def _(b, col):
    c, d = cc(col, "red", "yellow"); _gift(b, .16, .16, .12, c, d)
@P("gift_m")
def _(b, col):
    c, d = cc(col, "teal", "white"); _gift(b, .24, .2, .16, c, d)
@P("gift_l")
def _(b, col):
    c, d = cc(col, "purple", "yellow"); _gift(b, .32, .26, .2, c, d)
@P("giftbox_m")
def _(b, col):
    c, d = cc(col, "teal", "white"); _gift(b, .24, .2, .16, c, d, False)
@P("giftbox_l")
def _(b, col):
    c, d = cc(col, "purple", "yellow"); _gift(b, .32, .26, .2, c, d, False)
@P("card")
def _(b, col):
    c, d = cc(col, "sky", "yellow"); r = (-.16, 0, 0)
    b.box((.16, .008, .22), (0, .018, .11), "white", rot=r); b.box((.13, .006, .13), (0, .008, .13), c, rot=r); b.box((.04, .006, .04), (.02, .002, .15), d, rot=(-.16, pi / 4, 0))
    b.box((.12, .07, .025), (0, .03, .0125), "wood"); b.box((.12, .015, .05), (0, .05, .04), "wood")
@P("wreath")
def _(b, col):
    """Hangs from a peg: the top of the ring is at the origin."""
    c, d = cc(col, "pink", "yellow")
    b.tube([(.16 * sin(tau * i / 10), 0, -.17 + .16 * cos(tau * i / 10)) for i in range(10)], .028, "leaf_dark", seg=6, closed=True)
    for i in range(5):
        a = tau * i / 5 + .5; b.ball(.04, (.16 * sin(a), -.025, -.17 + .16 * cos(a)), c if i % 2 == 0 else d, u=6, v=3)
@P("lantern")
def _(b, col):
    c, = cc(col, "red")
    b.box((.14, .14, .02), (0, 0, .01), c); b.box((.11, .11, .16), (0, 0, .1), "glow"); b.box((.15, .15, .02), (0, 0, .19), c)
    for sx in (-1, 1):
        for sy in (-1, 1): b.box((.014, .014, .17), (sx * .058, sy * .058, .1), c)
    b.lathe([(.075, .2), (.02, .245), (0, .245)], m=c, seg=4, cap=False); b.tube([(-.04, 0, .235), (-.03, 0, .29), (.03, 0, .29), (.04, 0, .235)], .006, "plum", seg=4)
@P("wraproll")
def _(b, col):
    c, d = cc(col, "pink", "white")
    b.lathe([(.032, 0), (.032, .1), (.032, .2), (.032, .3), (.032, .4), (.032, .5)], mats=[c, d, c, d, c], seg=7)
@P("ornament")
def _(b, col):
    c, = cc(col, "red")
    b.ball(.055, (0, 0, .055), c, u=7, v=4); b.cyl(.016, .02, (0, 0, .105), "gold", seg=6)
@P("snowglobe")
def _(b, col):
    c, = cc(col, "red")
    b.lathe([(.07, 0), (.07, .03), (.055, .045)], m=c, seg=8); b.lathe([(.02, .045), (0, .11)], m="green", seg=6); b.ball(.07, (0, 0, .1), "glass", u=10, v=6)
@P("honey")
def _(b, col):
    b.lathe([(.04, 0), (.055, .02), (.055, .09), (.042, .105), (.046, .105), (.046, .13)], mats=["gold", "gold", "gold", "white", "white"], seg=7); lab(b, .05, .04, .055, -.051, "white")

# ------------------------------------------------------------------ fitness and wellness
@P("dumbbell")
def _(b, col):
    c, = cc(col, "red")
    for sx in (-1, 1): b.cyl(.05, .06, (sx * .05, 0, .05), c, seg=6, rot=(0, sx * pi / 2, 0))
    b.cyl(.016, .12, (-.06, 0, .05), "steel", seg=6, rot=(0, pi / 2, 0))
@P("kettlebell")
def _(b, col):
    c, = cc(col, "red")
    b.ball(.075, (0, 0, .068), c, sc=(1, 1, .9), u=7, v=4); b.tube([(-.045, 0, .12), (-.055, 0, .18), (0, 0, .205), (.055, 0, .18), (.045, 0, .12)], .014, "plum", seg=6); lab(b, .05, .035, .07, -.07, "white")
@P("yogamat")
def _(b, col):
    """A rolled mat lying with its spiral end to the front."""
    c, d = cc(col, "purple", "white")
    b.cyl(.06, .36, (0, .18, .06), c, seg=8, rot=(pi / 2, 0, 0)); b.cyl(.063, .025, (0, -.06, .06), d, seg=8, rot=(pi / 2, 0, 0)); b.cyl(.063, .025, (0, .1, .06), d, seg=8, rot=(pi / 2, 0, 0))
    b.cyl(.02, .006, (0, -.18, .06), d, seg=6, rot=(pi / 2, 0, 0))
@P("yogablock")
def _(b, col):
    c, = cc(col, "purple")
    b.box((.2, .1, .13), (0, 0, .065), c, r=.02, seg=1)
@P("roller")
def _(b, col):
    c, = cc(col, "blue")
    b.cyl(.06, .3, (0, 0, 0), c, seg=8); b.cyl(.03, .304, (0, 0, -.002), "plum", seg=7)
@P("medball")
def _(b, col):
    c, d = cc(col, "red", "white")
    b.ball(.09, (0, 0, .09), c, u=8, v=6); b.cyl(.092, .03, (0, 0, .075), d, seg=7)
@P("sportbottle")
def _(b, col):
    c, d = cc(col, "teal", "plum")
    b.lathe([(.04, 0), (.046, .015), (.046, .16), (.036, .19), (.036, .215), (.022, .225), (.022, .25), (0, .25)], mats=[c, c, c, d, d, d, d], seg=7)
@P("protein")
def _(b, col):
    c, = cc(col, "plum")
    b.lathe([(.07, 0), (.076, .02), (.076, .06), (.076, .15), (.076, .17), (.078, .17), (.078, .21), (0, .21)], mats=[c, c, "white", c, "plum", "plum", "plum"], seg=8)
@P("diffuser")
def _(b, col):
    c, = cc(col, "peach")
    b.lathe([(.04, 0), (.05, .02), (.05, .07), (.02, .1), (.02, .12)], m=c, seg=7)
    for i in range(3): b.box((.006, .006, .14), (.012 * (i - 1), 0, .18), "trunk", rot=(0, .22 * (i - 1), 0))
@P("band")
def _(b, col):
    c, = cc(col, "green")
    b.lathe([(.05, 0), (.085, 0), (.085, .03), (.05, .03), (.05, 0)], m=c, seg=8, cap=False)

# ------------------------------------------------------------------ garden
@P("seedpacket")
def _(b, col):
    c, d = cc(col, "leaf_light", "red"); r = (-.18, 0, 0)
    b.box((.13, .012, .18), (0, .018, .09), "white", rot=r); b.box((.13, .014, .06), (0, .005, .15), c, rot=r); b.ball(.03, (0, .01, .075), d, sc=(1, .3, 1), u=6, v=3)
    b.box((.11, .07, .02), (0, .03, .01), "wood"); b.box((.11, .014, .05), (0, .052, .035), "wood")
@P("pot")
def _(b, col):
    c, = cc(col, "terracotta")
    b.lathe([(.055, 0), (.08, .11), (.09, .11), (.09, .135), (.075, .135), (.06, .03), (0, .03)], mats=[c, c, c, c, "soil", "soil"], seg=8)
@P("potstack")
def _(b, col):
    c, = cc(col, "terracotta"); pr = [(.055, 0)]
    for k in range(3): pr += [(.08, .11 + k * .04), (.09, .11 + k * .04), (.09, .135 + k * .04), (.078, .135 + k * .04)]
    b.lathe(pr + [(.06, .1), (0, .1)], m=c, seg=8)
@P("wateringcan")
def _(b, col):
    c, = cc(col, "teal")
    b.lathe([(.075, 0), (.08, .01), (.08, .15), (.07, .16), (0, .16)], m=c, seg=8); b.tube([(.07, 0, .04), (.16, 0, .12), (.2, 0, .18)], [.02, .016, .014], c, seg=6)
    b.cyl(.03, .02, (.2, 0, .175), c, seg=7, rot=(0, .9, 0)); b.tube([(-.07, 0, .14), (-.14, 0, .15), (-.15, 0, .08), (-.075, 0, .04)], .012, c, seg=5)
    b.tube([(-.05, 0, .16), (-.03, 0, .22), (.03, 0, .22), (.05, 0, .16)], .012, c, seg=5)
@P("soilbag")
def _(b, col):
    c, d = cc(col, "leaf_dark", "yellow")
    b.box((.36, .26, .09), (0, 0, .045), c, r=.035, seg=1); b.box((.18, .12, .004), (0, 0, .092), d)
@P("toolcrock")
def _(b, col):
    c, = cc(col, "sky")
    b.cyl(.06, .12, (0, 0, 0), c, seg=7, r2=.07)
    b.box((.014, .014, .12), (-.02, 0, .17), "wood", rot=(0, -.12, 0)); b.box((.05, .01, .08), (-.036, 0, .27), "steel", rot=(0, -.12, 0))
    b.box((.014, .014, .12), (.025, .01, .17), "wood", rot=(0, .14, 0))
    for i in (-1, 0, 1): b.box((.008, .01, .07), (.045 + .014 * i, .01, .265), "steel", rot=(0, .14, 0))
@P("birdhouse")
def _(b, col):
    c, d = cc(col, "sky", "red")
    b.box((.16, .14, .16), (0, 0, .08), c); b.prism([(-.11, 0), (.11, 0), (0, .09)], .17, d, mtx=XZ(-.085, 0, .16))
    b.cyl(.03, .008, (0, -.07, .1), "plum", seg=7, rot=(pi / 2, 0, 0)); b.cyl(.008, .04, (0, -.07, .05), "wood", seg=5, rot=(pi / 2, 0, 0))
@P("trowel")
def _(b, col):
    c, = cc(col, "red")
    b.box((.03, .12, .03), (0, .06, .015), c, r=.01, seg=1); b.box((.012, .05, .012), (0, -.02, .012), "steel"); b.prism([(-.04, -.05), (.04, -.05), (.03, -.16), (0, -.2), (-.03, -.16)], .008, "steel")

# ------------------------------------------------------------------ hot food
@P("ramen")
def _(b, col):
    c, = cc(col, "red")
    b.lathe([(.05, 0), (.11, .07), (.118, .088), (.105, .088), (.1, .075), (0, .075)], mats=[c, c, "white", "white", "gold"], seg=8)
    b.ball(.06, (-.015, .01, .08), "butter", sc=(1, 1, .3), u=6, v=3); b.ball(.03, (.045, -.03, .085), "white", sc=(1, 1, .5), u=6, v=3); b.ball(.015, (.045, -.03, .095), "gold", sc=(1, 1, .5), u=6, v=3)
    b.cyl(.025, .008, (-.04, -.05, .08), "pink", seg=6); b.box((.05, .02, .006), (.03, .05, .083), "leaf_dark", rot=(0, 0, .5))
@P("steamer")
def _(b, col):
    b.lathe([(.1, 0), (.1, .012), (.095, .012), (.095, .06), (.1, .06), (.1, .072), (.095, .072), (.095, .12), (.1, .12), (.1, .132), (.085, .132), (.085, .115), (0, .115)],
            mats=["trunk", "wood", "wood", "trunk", "trunk", "wood", "wood", "trunk", "trunk", "trunk", "wood", "bread"], seg=8)
    for i in range(4): a = tau * i / 4 + .4; b.ball(.035, (.04 * cos(a), .04 * sin(a), .13), "white", sc=(1, 1, .7), u=6, v=3)
@P("salad")
def _(b, col):
    c, = cc(col, "kraft")
    _bowl(b, c, 0, "white"); b.ball(.075, (0, 0, .065), "leaf_light", sc=(1, 1, .4), u=6, v=3)
    for (x, y, m) in ((.03, -.02, "red"), (-.03, .02, "orange"), (-.02, -.04, "yellow"), (.035, .035, "leaf_dark")): b.ball(.02, (x, y, .09), m, u=6, v=3)
@P("wrap")
def _(b, col):
    c, = cc(col, "leaf_light")
    b.cyl(.04, .14, (-.1, 0, .04), "kraft", seg=6, rot=(0, pi / 2, 0)); b.cyl(.036, .07, (.03, 0, .04), "bread", seg=6, rot=(0, pi / 2, 0)); b.ball(.03, (.1, 0, .04), c, u=6, v=3)
@P("chopcup")
def _(b, col):
    c, = cc(col, "red")
    b.cyl(.04, .1, (0, 0, 0), c, seg=7)
    for i in range(4): a = tau * i / 4; b.box((.008, .008, .16), (.014 * cos(a), .014 * sin(a), .13), "wood", rot=(.08 * sin(a), -.08 * cos(a), 0))
@P("tray")
def _(b, col):
    c, = cc(col, "wood")
    b.box((.5, .34, .025), (0, 0, .0125), c, r=.01, seg=1)
@P("register")
def _(b, col):
    c, = cc(col, "red")
    b.box((.3, .26, .1), (0, 0, .05), c, r=.02, seg=1); b.box((.26, .12, .12), (0, .06, .15), c, r=.02, seg=1); b.box((.2, .008, .08), (0, -.003, .16), "sky", rot=(.25, 0, 0))
    for i in range(3):
        for j in range(2): b.box((.035, .03, .012), (-.05 + .05 * i, -.09 + .045 * j, .104), "white")
    b.box((.07, .03, .012), (.1, -.07, .104), "yellow")
@P("basketstack")
def _(b, col):
    """Five nested shopping baskets: one full basket and the rims of the four under it."""
    c, = cc(col, "green")
    for k in range(5):
        z = k * .05
        for (sx, sy, w, d) in ((0, -1, .46, .02), (0, 1, .46, .02), (-1, 0, .02, .3), (1, 0, .02, .3)): b.box((w, d, .045), (sx * .22, sy * .14, z + .16), c)
    b.prism([(-.19, -.11), (.19, -.11), (.23, -.15), (.23, .15), (.19, .11), (-.19, .11), (-.23, .15), (-.23, -.15)], .01, c)
    for (sx, sy, w, d) in ((0, -1, .42, .02), (0, 1, .42, .02), (-1, 0, .02, .26), (1, 0, .02, .26)): b.box((w, d, .14), (sx * .205, sy * .125, .075), c)
    for sy in (-1, 1): b.tube([(-.12, sy * .14, .38), (-.12, sy * .08, .47), (.12, sy * .08, .47), (.12, sy * .14, .38)], .012, "plum", seg=5)

# ------------------------------------------------------------------ shop equipment and hero pieces
@P("espresso")
def _(b, col):
    """Espresso machine. The working side faces -Y; the back carries the Grove bloom."""
    c, = cc(col, "red")
    b.box((.9, .5, .1), (0, 0, .05), "plum", r=.02, seg=1); b.box((.9, .34, .42), (0, .08, .31), c, r=.04, seg=1); b.box((.9, .5, .08), (0, 0, .5), c, r=.03, seg=1)
    b.box((.8, .02, .1), (0, -.1, .38), "steel"); bloom(b, (0, .252, .3), .1, "+y", "white", "yellow", 6)
    for x in (-.22, .22):
        b.cyl(.05, .06, (x, -.14, .31), "steel", seg=7); b.box((.04, .16, .03), (x, -.24, .3), "plum"); _mug(b, "white", None, s=.7, z=.1, seg=7)
    b.tube([(.4, -.12, .4), (.43, -.2, .3), (.43, -.2, .18)], .012, "steel", seg=5)
    for x in (-.3, -.1, .1, .3): b.cyl(.04, .1, (x, .08, .54), "white", seg=7, r2=.05)
@P("grinder")
def _(b, col):
    c, = cc(col, "plum")
    b.box((.2, .26, .3), (0, 0, .15), c, r=.03, seg=1); b.cyl(.06, .15, (0, .02, .3), "choc", seg=7, r2=.1); b.cyl(.105, .02, (0, .02, .45), c, seg=7); b.box((.08, .06, .05), (0, -.14, .2), "steel")
@P("cakedome")
def _(b, col):
    c, d = cc(col, "pink", "bread")
    b.lathe([(.08, 0), (.08, .012), (.02, .03), (.02, .09), (.15, .1), (.15, .115), (0, .115)], m="white", seg=10)
    b.lathe([(.11, .115), (.11, .16), (.11, .172), (.11, .21), (.1, .228), (0, .23)], mats=[d, "white", d, c, c], seg=10, cap=False)
    b.lathe([(.14, .115), (.14, .22), (.1, .3), (0, .33)], m="glass", seg=10, cap=False); b.ball(.02, (0, 0, .34), "white", u=6, v=3)
@P("openbook")
def _(b, col):
    c, = cc(col, "teal")
    b.box((.36, .26, .012), (0, 0, .006), c)
    for sx in (-1, 1): b.box((.165, .24, .02), (sx * .088, 0, .024), "cream", rot=(0, -sx * .08, 0))
@P("dispenser")
def _(b, col):
    b.box((.3, .3, .14), (0, 0, .07), "white", r=.03, seg=1); b.lathe([(.11, .14), (.12, .16), (.12, .38), (.06, .44), (0, .44)], m="sky", seg=8); b.box((.04, .05, .04), (0, -.17, .09), "blue")
@P("beanbag")
def _(b, col):
    c, = cc(col, "purple")
    b.ball(.42, (0, 0, .2), c, sc=(1, 1, .5), u=10, v=6); b.ball(.3, (0, .12, .36), c, sc=(1, .7, .5), u=8, v=5)
@P("tv")
def _(b, col):
    c, = cc(col, "plum")
    b.box((2.2, .1, 1.2), (0, 0, .82), c, r=.04, seg=1); b.box((2.04, .01, 1.04), (0, -.051, .82), "sky"); b.box((.2, .08, .22), (0, 0, .11), c); b.box((.9, .3, .04), (0, 0, .02), c)
    b.prism([(-1.02, 0), (1.02, 0), (1.02, .2), (.5, .42), (0, .25), (-.5, .5), (-1.02, .3)], .01, "lawn", mtx=XZ(-.066, 0, .3))
    b.cyl(.12, .01, (.7, -.056, 1.12), "yellow", seg=10, rot=(pi / 2, 0, 0)); b.ball(.14, (-.55, -.06, 1.1), "white", sc=(1.6, .08, .7), u=8, v=4)
    for i in range(3): b.box((.13, .012, .13), (-.15 + i * .15, -.062, .88), "gold" if i != 1 else "terracotta")
@P("fruitbowl")
def _(b, col):
    c, = cc(col, "white")
    b.lathe([(.06, 0), (.13, .06), (.14, .08), (.125, .08), (.07, .03), (0, .03)], m=c, seg=10)
    for (x, y, m) in ((-.05, 0, "red"), (.05, .02, "orange"), (0, -.05, "leaf_light"), (0, .03, "red")): b.ball(.05, (x, y, .075 + (.05 if y == .03 else 0)), m, u=7, v=4)
@P("footmirror")
def _(b, col):
    c, = cc(col, "blue")
    b.box((.6, .05, .5), (0, .1, .235), c, r=.02, seg=1, rot=(-.5, 0, 0)); b.box((.5, .01, .4), (0, .077, .248), "water_light", rot=(-.5, 0, 0)); b.box((.5, .36, .03), (0, .1, .015), c); b.box((.05, .04, .3), (0, .2, .16), c, rot=(.25, 0, 0))
