"""Pass 20: fit out and stock the twelve shops. Codex's loose stock and plain box fixtures are moved to the hidden
superseded collection; every shop gets kit fixtures and a planogram: one product per section, sections divided and
price-tagged, a category per bay, heavy things low, a sign on top, and a different kind of display for each kind of
goods (tipped crates, rails, face-out arms, stacks, baskets, cases). Run one shop at a time: gk_run('p20_merch', shops=[...])."""
import bpy, importlib
import gp; importlib.reload(gp)
from gp import *
from gk import *
ns = bpy.app.driver_namespace; ARGS = ns.get("gk_args") or {}
def I(kind, col=None, n=None, **o): return (kind, col, n, o)
def G(kind, col=None, n=None, **o): o.setdefault("sc", 1.55); return (kind, col, n, o)
def register(S, pat, fx=.8, rz=pi):
    bb = S.lbb(pat)
    if bb: lo, hi = bb; S.put("register", S.acc, lo.x + (hi.x - lo.x) * fx, (lo.y + hi.y) / 2, hi.z, rz=rz, sc=1.15)

def GROVE_GROCER():
    S = Shop("GROVE_GROCER", r"^Shop_|Pendant|Checkout_(Base|Belt)|Entry_Mat|Queue")
    S.begin("Chilled", 3.2, 3.36); U = S.wallunit(4.6, back="water_light", acc="sky"); A, B_ = U["bays"]
    S.shelf(A[0], [G("carton", ("sky", "white")), G("carton", ("pink", "white")), G("carton", ("leaf_light", "white"))])
    S.shelf(A[1], [G("tub", "pink", stack=2), G("tub", "butter", stack=2), G("tub", "sky", stack=2), G("tub", "mint", stack=2)])
    S.shelf(A[2], [G("carton", ("yellow", "white")), G("eggs", "yellow", 2, stack=2), G("cheese", None, 3)])
    S.shelf(B_[0], [G("bottle", "orange"), G("bottle", "green"), G("bottle", "purple")])
    S.shelf(B_[1], [G("bottle", "red"), G("bottle", "yellow"), G("bottle", "pink")])
    S.shelf(B_[2], [G("can", "red", stack=2), G("can", "teal", stack=2), G("can", "purple", stack=2), G("can", "orange", stack=2)])
    S.header(A[3], "carton", ("sky", "white"), board="sky"); S.header(B_[3], "bottle", "orange", board="sky")
    S.begin("Pantry", -2.8, 3.36); U = S.wallunit(4.6); A, B_ = U["bays"]
    S.shelf(A[0], [G("bag", ("sand", "white")), G("bag", ("white", "red")), G("box", ("kraft", "white"), stack=2)])
    S.shelf(A[1], [G("bag", ("orange", "white")), G("bag", ("green", "white")), G("bag", ("red", "white"))])
    S.shelf(A[2], [G("cereal", ("red", "yellow")), G("cereal", ("blue", "yellow")), G("cereal", ("yellow", "red")), G("cereal", ("purple", "yellow"))])
    S.shelf(B_[0], [G("bottle", ("gold", "green")), G("bottle", ("leaf_dark", "gold")), G("jug", ("yellow", "red"))])
    S.shelf(B_[1], [G("can", "red", stack=2), G("can", "green", stack=2), G("can", "yellow", stack=2), G("tin", ("teal", "gold"))])
    S.shelf(B_[2], [G("jar", ("rose", "gold")), G("jar", ("orange", "gold")), G("honey"), G("sauce", ("red", "green")), G("sauce", ("choc", "red"))])
    S.header(A[3], "cereal", ("red", "yellow")); S.header(B_[3], "jar", ("rose", "gold"))
    S.begin("Aisle", .2, .15); Gd = S.gondola(4.5)
    S.shelf(Gd["A"][1], [G("loaf", "crust", tray="wood"), G("loaf", "bread", tray="wood"), G("bun", "crust", tray="wood"), G("croissant", tray="white"), G("donut", ["pink", "choc", "white"], tray="white")])
    S.shelf(Gd["A"][0], [G("baguette", tray="wood"), G("loaf", "choc", tray="wood"), G("cupcake", ["pink", "sky", "yellow"], tray="white"), G("bun", "bread", tray="wood")])
    S.shelf(Gd["B"][1], [G("spray", "teal"), G("spray", "pink"), G("pump", "pink"), G("pump", "mint"), G("soapbar", ["mint", "pink", "sky"], stack=3)])
    S.shelf(Gd["B"][0], [G("jug", "blue"), G("jug", "green"), G("tpack", "sky"), G("tpack", "pink")])
    T = Gd["top"]
    for x, c in ((-1.5, "wood"), (1.5, "wood")):
        S.put("basket", c, x, 0, T["top"], sc=1.7)
        for k in range(5): S.put("baguette", None, x + .06 * (k - 2), .03 * ((k % 2) * 2 - 1), T["top"] + .045 + .2, rz=.5 * k, tilt=Matrix.Rotation(radians(-78 + 6 * (k - 2)), 4, "Y"), sc=1.15)
    S.group(T, [("cakedome", ("pink", "bread"), .5, .5, {"sc": 1.3}), ("plant", ("white", "green"), .33, .5), ("plant", ("white", "green"), .67, .5)])
    S.begin("Produce", 3.65, -1.55); b = S.b
    b.box2((-1.9, -.66, 0), (1.9, -.02, .34), "wood", r=.03, seg=1); b.box2((-1.9, -.02, 0), (1.9, .64, .62), "wood", r=.03, seg=1)
    b.box2((-1.92, -.68, .2), (1.92, -.66, .3), "green"); b.box2((-1.92, -.68, .06), (1.92, -.66, .12), "white")
    front = [("apple", "red", 3, 2, 2, 1.3), ("orange", "orange", 3, 2, 2, 1.3), ("apple", "leaf_light", 3, 2, 2, 1.3), ("tomato", None, 3, 2, 2, 1.4), ("banana", None, 3, 2, 1, 1.25)]
    back = [("carrots", None, 2, 1, 2, 1.05), ("cabbage", None, 2, 2, 2, 1.2), ("pumpkin", None, 2, 2, 2, 1.1), ("broccoli", None, 3, 2, 1, 1.25), ("pineapple", None, 3, 1, 1, 1.15)]
    for i in range(5):
        x = -1.52 + i * .76
        for (row, y, z, tilt) in ((front, -.34, .34, 15), (back, .3, .62, 20)):
            kind, col, nx, ny, lay, sc = row[i]; low = kind == "carrots"
            pre = S.crate(x, y, z, w=.7, d=.5, tilt=tilt, hgt=.07 if low else .13, back=not low)
            S.fill(pre, kind, col, nx, ny, w=.7, d=.5, layers=lay, sc=sc, my=.0 if low else .05, jit=.5 if kind in ("apple", "orange", "tomato", "pumpkin", "cabbage") else 0, seed=i)
            S.picksign(pre, -.27, .47, "yellow" if (i + (row is back)) % 2 else "white")
    for sx in (-1, 1):
        b.box((.09, .09, 2.75), (sx * 1.95, .6, 1.375), "white", r=.02, seg=1); b.cyl(.03, 2.3, (sx * 1.9, -.74, 0), "white", seg=6)
        b.box((.06, 1.4, .06), (sx * 1.95, -.08, 2.56), "white", rot=(-.19, 0, 0))
    prof = [(0, 0), (1.45, -.27), (1.45, -.42), (1.41, -.42), (1.41, -.31), (0, -.05)]
    for i in range(10): b.prism(prof, .4, "green" if i % 2 == 0 else "white", mtx=YZ(-2.0 + i * .4, .68, 2.75, True))
    S.bucket(-2.25, -.45, 0, ["pink", "yellow", "red"], 1.3); S.bucket(-2.25, .1, 0, ["white", "purple", "pink"], 1.3)
    S.begin("Front"); S.put("basketstack", "green", 2.3, -2.95, 0, sc=1.25); register(S, "Checkout_Base", .1)
    S.begin("Offer", -3.3, .9, rz=-.5); S.promo("cereal", [("orange", "white"), ("teal", "white")], 3)
    return S.done()

PASTEL = ["rose", "pink", "peach", "butter", "mint", "sky", "lilac"]
def THREAD_THIMBLE():
    S = Shop("THREAD_THIMBLE", r"^Shop_|Pendant|Thread_Checkout|Entry_Mat")
    S.begin("Womenswear", 2.85, 3.36); R = S.railunit(4.7, ["face", "side", "face"], depth=.74); mid = [(r["x0"] + r["x1"]) / 2 for r in R]
    S.hang_face(R[0], mid[0] - .37, [("dress", ("pink", "white")), ("dress", ("rose", "white"))], sc=1.3)
    S.hang_face(R[0], mid[0] + .37, [("skirt", ("yellow", "white")), ("skirt", ("teal", "white"))], sc=1.4)
    S.hang_side(R[1], [("tee", (c, "white")) for c in PASTEL], sc=1.45)
    S.hang_face(R[2], mid[2] - .37, [("tee", ("lilac", "white")), ("tee", ("sky", "white")), ("tee", ("mint", "white"))], sc=1.45)
    S.hang_face(R[2], mid[2] + .37, [("dress", ("purple", "yellow")), ("dress", ("teal", "white"))], sc=1.3)
    S.shelf(R[0]["base"], [I("handbag", ("pink", "gold"), 2, sc=1.25), I("handbag", ("terracotta", "gold"), 2, sc=1.25)])
    S.shelf(R[1]["base"], [I("foldtee", [(c, "white") for c in PASTEL[:4]], 4, stack=3, sc=1.2)])
    S.shelf(R[2]["base"], [I("shoebox", ("pink", "white"), 2, stack=2, sc=1.1), I("sandal", ("yellow", "white"), 2, sc=1.3)])
    S.group(R[0]["top"], [("hatstand", ("sand", "rose"), .3, .5, {"sc": 1.3}), ("hatstand", ("white", "pink"), .7, .5, {"sc": 1.3})])
    S.group(R[1]["top"], [("plant", ("white", "green"), .5, .5, {"sc": 1.5}), ("handbag", ("yellow", "gold"), .2, .5, {"sc": 1.3}), ("handbag", ("sky", "gold"), .8, .5, {"sc": 1.3})])
    S.group(R[2]["top"], [("hatstand", ("pink", "white"), .5, .5, {"sc": 1.3}), ("scarf", ("rose", "white"), .2, .5, {"sc": 1.5}), ("scarf", ("teal", "white"), .8, .5, {"sc": 1.5})])
    S.begin("Menswear", -2.85, 3.36); R = S.railunit(4.7, ["side", "face", "side"], depth=.74); mid = [(r["x0"] + r["x1"]) / 2 for r in R]
    S.hang_side(R[0], [("jacket", ("navy", "white")), ("jacket", ("plum", "white")), ("jacket", ("denim", "white")), ("tee", ("navy", "white")), ("tee", ("blue", "white")), ("tee", ("teal", "white")), ("tee", ("green", "white"))], sc=1.4)
    S.hang_face(R[1], mid[1] - .37, [("jacket", ("navy", "white")), ("jacket", ("slate", "white"))], sc=1.35)
    S.hang_face(R[1], mid[1] + .37, [("trousers", "denim"), ("trousers", "plum")], sc=1.25)
    S.hang_side(R[2], [("trousers", "denim"), ("trousers", "slate"), ("trousers", "trunk"), ("tee", ("red", "white")), ("tee", ("orange", "white")), ("tee", ("yellow", "white")), ("tee", ("terracotta", "white"))], sc=1.3)
    S.shelf(R[0]["base"], [I("jeans", ["denim", "navy", "slate", "plum"], 4, stack=3, sc=1.2)])
    S.shelf(R[1]["base"], [I("loafer", ("trunk", "gold"), 2, sc=1.4, rz=-.3), I("sneaker", ("navy", "white"), 2, sc=1.4, rz=-.3)])
    S.shelf(R[2]["base"], [I("shoebox", ("navy", "white"), 2, stack=2, sc=1.1), I("boot", ("trunk", "plum"), 2, sc=1.3, rz=-.3)])
    S.group(R[0]["top"], [("cap", ("red", "white"), .25, .5, {"sc": 1.6}), ("cap", ("navy", "white"), .5, .5, {"sc": 1.6}), ("cap", ("green", "white"), .75, .5, {"sc": 1.6})])
    S.group(R[1]["top"], [("plant", ("white", "green"), .5, .5, {"sc": 1.5})])
    S.group(R[2]["top"], [("foldtee", [("red", "white"), ("orange", "white"), ("yellow", "white")], .3, .5, {"sc": 1.2, "stack": 3}), ("hatstand", ("trunk", "plum"), .7, .5, {"sc": 1.3})])
    S.begin("Table", -2.65, -.65); T, T2 = S.table(3.0, 1.2, tier=(1.7, .46, .16))
    S.shelf(T, [I("foldtee", [(c, "white") for c in PASTEL], 7, stack=3, sc=1.2)], tags=False)
    S.group(T2, [("hatstand", ("sand", "red"), .5, .5, {"sc": 1.3}), ("handbag", ("teal", "gold"), .15, .5, {"sc": 1.3}), ("handbag", ("rose", "gold"), .85, .5, {"sc": 1.3})])
    S.group(T, [("scarf", ("red", "white"), .06, .78, {"sc": 1.4}), ("scarf", ("blue", "white"), .13, .78, {"sc": 1.4}), ("socks", ("pink", "white"), .88, .78, {"sc": 1.3}), ("socks", ("sky", "white"), .93, .78, {"sc": 1.3}), ("socks", ("yellow", "white"), .98, .78, {"sc": 1.3})])
    S.begin("Mannequins")
    for x, c, a in ((4.44, "pink", -.35), (1.96, "teal", .3)):
        S.pedestal(.4, .14, x, -1.6); S.put("mannequin", (c, "white"), x, -1.6, .14, sc=1.45, rz=a)
    S.begin("Bench", 3.45, -.4); S.bench(2.3); S.put("sneaker", ("red", "white"), -.5, -.62, 0, sc=1.45, rz=-.5); S.put("sneaker", ("red", "white"), -.1, -.66, 0, sc=1.45, rz=-.2)
    S.begin("Mirror", 5.3, 1.1, rz=-pi / 2); S.mirror()
    S.begin("Fitting", -4.85, 1.0); S.booth()
    S.begin("Front"); register(S, "Thread_Checkout")
    return S.done()

def HOME_NOOK():
    S = Shop("HOME_NOOK", r"^Shop_|Pendant|Home_Checkout|Entry_Mat|Armchair|Living_Rug|Side_Table|Table_Lamp")
    S.begin("Kitchen", -2.85, 3.36); U = S.wallunit(4.7); A, B_ = U["bays"]
    S.shelf(A[2], [G("mug", c, stack=2, rz=-.6) for c in ("sky", "pink", "yellow", "mint")])
    S.shelf(A[1], [G("kettle", ("red", "plum"), 2), G("teapot", ("white", "blue"), 2), G("kettle", ("teal", "plum"), 2)])
    S.shelf(A[0], [G("storagebox", ("sand", "white"), 2), G("basket", "wood", 2), G("storagebox", ("sky", "white"), 2)])
    S.shelf(B_[2], [G("plateup", ("white", "blue"), 3), G("plateup", ("white", "red"), 3), G("plateup", ("butter", "orange"), 2)])
    S.shelf(B_[1], [G("bowlstack", ("teal", "sky", "mint"), 3), G("platestack", ("white", "sky", "pink", "butter"), 3), G("bowl", ("orange", "white"), 3)])
    S.shelf(B_[0], [G("tin", ("mint", "gold")), G("tin", ("pink", "gold")), G("jar", ("white", "wood")), G("teapot", ("butter", "orange"), 2)])
    S.header(A[3], "mug", "sky"); S.header(B_[3], "plate", ("white", "blue"), sc=1.2)
    S.group(A[3], [("vase", ("teal", "pink"), .15, .5, {"sc": 1.3}), ("vase", ("yellow", "rose"), .85, .5, {"sc": 1.3})])
    S.begin("Living", 3.15, 3.36); U = S.wallunit(4.7); A, B_ = U["bays"]
    S.shelf(A[2], [G("candle", "lilac", stack=2), G("candle", "peach", stack=2), G("candle", "mint", stack=2), G("vase", "teal", 2), G("vase", "rose", 2)])
    S.shelf(A[1], [I("cushion", [("pink", "white"), ("sky", "white"), ("yellow", "white"), ("mint", "white"), ("lilac", "white")], 5, sc=1.4)])
    S.shelf(A[0], [I("throw", [("sky", "white"), ("pink", "white"), ("butter", "white"), ("mint", "white")], 4, stack=3, sc=1.4)])
    S.shelf(B_[2], [G("lamp", ("yellow", "wood"), 2), G("lamp", ("pink", "white"), 2), G("lamp", ("teal", "wood"), 2)])
    S.shelf(B_[1], [G("frame", "wood", 2), G("clock", "red", 2), G("frame", "white", 2), G("clock", "teal", 1)])
    S.shelf(B_[0], [G("plant", ("terracotta", "green"), 2), G("cactus", None, 2), G("succulent", None, 3), G("tulips", ("red", "white"), 2)])
    S.header(A[3], "cushion", ("pink", "white"), sc=.9); S.header(B_[3], "lamp", ("yellow", "wood"))
    S.begin("Table", -2.1, -.3); T, T2 = S.table(2.8, 1.1, tier=(1.3, .42, .14))
    S.group(T2, [("teapot", ("white", "blue"), .5, .5, {"sc": 1.7}), ("vase", ("teal", "pink"), .12, .5, {"sc": 1.3}), ("candle", "peach", .82, .5, {"sc": 1.5}), ("candle", "lilac", .93, .5, {"sc": 1.2})])
    S.group(T, [("plate", ("white", "blue"), .2, .22, {"sc": 1.6}), ("plate", ("white", "blue"), .8, .22, {"sc": 1.6}), ("mug", "sky", .31, .3, {"sc": 1.5, "rz": -.6}), ("mug", "pink", .91, .3, {"sc": 1.5, "rz": -.6}),
                ("bowlstack", ("teal", "sky", "mint"), .5, .2, {"sc": 1.5}), ("platestack", ("white", "sky", "pink", "butter"), .06, .7, {"sc": 1.4}), ("cupsaucer", ("white", "choc"), .94, .72, {"sc": 1.5, "rz": -.6})])
    S.begin("Plant", -3.35, -2.3); S.put("plant", ("white", "green"), 0, 0, 0, sc=3.2)
    S.begin("Front"); register(S, "Home_Checkout")
    return S.done()

def CAFE_CANOPY():
    S = Shop("CAFE_CANOPY", r"^Shop_|Pendant|Cafe_(Counter_Top|Service_Counter|Staff|Queue|Stool|Table_(Base|Stem|Top))|Entry_Mat")
    z = S.lbb("Cafe_Counter_Top")[1].z
    S.begin("Counter"); C = S.case(2.3, .62, z, levels=(.03, .3), H=.58, x=2.0, y=.88)
    S.shelf(C[0], [I("croissant", None, None, sc=1.5), I("donut", ["pink", "choc", "white"], None, sc=1.5), I("sandwich", "pink", None, stack=2, sc=1.2)], tags=False)
    S.shelf(C[1], [I("tart", "butter", None, sc=1.5), I("cupcake", [("pink", "kraft"), ("sky", "kraft")], None, sc=1.4), I("slice", ("pink", "bread"), None, sc=1.4)], tags=False)
    S.put("espresso", "red", -1.65, .9, z, rz=pi); S.put("grinder", "plum", -.9, .9, z, rz=pi); S.put("register", "red", .2, .92, z, rz=pi, sc=1.15); S.put("cakedome", ("pink", "bread"), .62, .72, z, sc=1.2)
    S.put("tray", "wood", -2.72, .85, z, sc=1.2)
    for i in range(3): S.put("togo", ("white", "kraft"), -2.92 + .2 * i, .85, z + .03, sc=1.5)
    S.begin("Backbar", 0, 3.36); U = S.wallunit(5.6, depth=.45, levels=(.42, .86), cap=1.3, bays=3); A, B_, C_ = U["bays"]
    S.shelf(A[1], [G("bag", ("choc", "kraft")), G("bag", ("red", "white")), G("bag", ("kraft", "choc"))]); S.shelf(A[0], [G("cupstack", "white", sc=1.4), G("tin", ("red", "gold"))])
    S.shelf(B_[1], [G("sauce", (c, "white"), 2, sc=1.7) for c in ("red", "gold", "choc", "pink", "green")]); S.shelf(B_[0], [G("mug", "white", stack=2, rz=-.6), G("mug", "red", stack=2, rz=-.6)])
    S.shelf(C_[1], [G("teapot", ("white", "red"), 2), G("tin", ("teal", "gold")), G("tin", ("butter", "gold"))]); S.shelf(C_[0], [G("jar", ("choc", "wood")), G("jar", ("bread", "wood")), G("honey")])
    S.group(A[2], [("plant", ("white", "green"), .5, .5, {"sc": 1.6})]); S.group(C_[2], [("plant", ("white", "green"), .5, .5, {"sc": 1.6})]); S.group(B_[2], [("kettle", ("red", "plum"), .3, .5, {"sc": 1.5}), ("cupstack", "white", .7, .5, {"sc": 1.5})])
    b = S.b; b.box2((-2.75, -.12, 2.05), (2.75, .09, 4.3), "red", r=.05, seg=1); b.box2((-2.62, -.13, 2.17), (2.62, -.12, 4.18), "slate"); b.box2((-2.4, -.14, 3.92), (2.4, -.13, 4.06), "yellow")
    for x, kind, col, k in ((-1.7, "cupsaucer", ("white", "choc"), 2.4), (0, "croissant", None, 2.8), (1.7, "slice", ("pink", "bread"), 2.4)):
        b.box2((x - .42, -.3, 3.3), (x + .42, -.12, 3.34), "wood"); S.put(kind, col, x, -.21, 3.34, sc=k)
        for i in range(5): b.box2((x - .5, -.14, 3.08 - i * .18), (x + (.2 if i % 2 else .3), -.13, 3.14 - i * .18), "white"); b.box2((x + .36, -.14, 3.08 - i * .18), (x + .5, -.13, 3.14 - i * .18), "yellow")
    S.begin("Tables"); tz = S.lbb("Cafe_Table_Top")[1].z
    for (x, y) in ((-1.0, -.8), (3.35, -1.15)):
        S.put("cupsaucer", ("white", "choc"), x - .38, y - .08, tz, sc=1.5, rz=2.4); S.put("cupsaucer", ("white", "choc"), x + .38, y + .08, tz, sc=1.5, rz=-.7); S.put("succulent", "white", x, y, tz, sc=1.5)
    S.put("plant", ("white", "green"), 4.65, -2.1, 0, sc=3.2)
    return S.done()

RB = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"]
def SOLE_SEARCH():
    S = Shop("SOLE_SEARCH", r"^Shop_|Pendant|Sole_Checkout|Entry_Mat|Sole_Fitting_Bench|Sole_Bench_Cushion")
    S.begin("ShoeWall", 0, 3.36); U = S.wallunit(9.6, bays=4); SH = lambda k, c, n=2, sc=1.45: I(k, c, n, sc=sc, rz=-.3)
    plan = [("sneaker", [("red", "white"), ("blue", "yellow"), ("green", "white"), ("yellow", "navy")]), ("hitop", [("blue", "white"), ("red", "white"), ("purple", "yellow"), ("plum", "white")]),
            ("boot", [("trunk", "plum"), ("plum", "slate")]), ("sandal", [("yellow", "white"), ("pink", "white"), ("teal", "white")])]
    BX = [("red", "white"), ("blue", "white"), ("green", "white"), ("yellow", "white"), ("purple", "white"), ("pink", "white"), ("teal", "white"), ("orange", "white")]
    for i, (kind, cs) in enumerate(plan):
        bay = U["bays"][i]
        if kind == "boot":
            S.shelf(bay[2], [SH("boot", cs[0]), SH("boot", cs[1])]); S.shelf(bay[1], [SH("loafer", ("trunk", "gold")), SH("loafer", ("navy", "gold"))])
        elif kind == "sandal":
            S.shelf(bay[2], [SH("sandal", cs[0]), SH("sandal", cs[1])]); S.shelf(bay[1], [SH("sneaker", ("pink", "white"), 3, 1.1), SH("sandal", cs[2])])
        else:
            S.shelf(bay[2], [SH(kind, cs[0]), SH(kind, cs[1])]); S.shelf(bay[1], [SH(kind, cs[2]), SH(kind, cs[3])])
        S.shelf(bay[0], [I("shoebox", [BX[(i * 2 + j) % 8] for j in range(4)], 4, stack=2, sc=1.15)])
        S.header(bay[3], kind, cs[0], sc=.8)
    S.begin("Hero")
    for x, kind, col, a in ((3.42, "sneaker", ("red", "yellow"), -.5), (-3.0, "hitop", ("blue", "yellow"), .5)):
        S.pedestal(.5, .6, x, -1.35); S.riser(x - .32, x + .32, -1.55, -1.15, .6, .08, "white"); S.put(kind, col, x, -1.35, .68, sc=2.0, rz=a)
    S.begin("Socks", -3.45, .65); T, T2 = S.table(2.4, .94, tier=(1.3, .34, .14))
    S.shelf(T, [I("socks", [(c, "white") for c in RB], 8, sc=1.3, rows=1)], tags=False)
    S.group(T2, [("tin", ("plum", "gold"), .15, .5, {"sc": 1.2, "stack": 2}), ("tin", ("trunk", "gold"), .35, .5, {"sc": 1.2}), ("spray", ("white", "blue"), .62, .5, {"sc": 1.3}), ("box", ("white", "blue"), .88, .5, {"sc": 1.0})])
    S.begin("TryOn"); S.put("shoebox", ("blue", "white"), 3.75, -.15, 0, sc=1.2, rz=.3); S.put("sneaker", ("blue", "yellow"), 2.75, -.2, 0, sc=1.45, rz=-.4); S.put("sneaker", ("blue", "yellow"), 3.15, -.28, 0, sc=1.45, rz=-.1)
    S.put("footmirror", "blue", 1.45, .65, 0, rz=pi / 2, sc=1.2); register(S, "Sole_Checkout")
    return S.done()

def PIXEL_PANTRY():
    S = Shop("PIXEL_PANTRY", r"^Shop_|Pendant|Pixel_Service_Counter|Pixel_Staff|Entry_Mat|Pixel_Demo_Rug")
    S.begin("GameWall", 0, 3.36); U = S.wallunit(9.6, bays=4); A, B_, C_, D_ = U["bays"]; GC = lambda c, d="yellow", n=None: I("gamecase", (c, d), n, sc=1.5)
    S.shelf(A[2], [GC("red"), GC("blue"), GC("green")]); S.shelf(A[1], [GC("purple"), GC("orange", "white"), GC("teal")])
    S.shelf(A[0], [I("boardgame", [("red", "yellow"), ("blue", "white"), ("green", "yellow")], 3, stack=3, sc=1.3)])
    S.shelf(B_[2], [GC("pink", "white"), GC("navy"), GC("yellow", "red")]); S.shelf(B_[1], [I("cartridge", RB, None, sc=1.7), I("console", ("white", "teal"), 2, sc=1.2)])
    S.shelf(B_[0], [I("box", ("white", "teal"), 2, stack=2, sc=1.5), I("box", ("white", "purple"), 2, stack=2, sc=1.5)])
    S.shelf(C_[2], [I("headset", ("purple", "plum"), 2, sc=1.3), I("headset", ("teal", "plum"), 2, sc=1.3)])
    S.shelf(C_[1], [I("controller", [("white", "plum"), ("red", "plum"), ("blue", "plum"), ("yellow", "plum")], 4, sc=1.5)])
    S.shelf(C_[0], [I("handheld", [("purple", "teal"), ("red", "blue"), ("yellow", "green")], 3, sc=1.4)])
    S.shelf(D_[2], [G("bag", ("purple", "yellow")), G("bag", ("teal", "white")), G("bag", ("red", "yellow"))]); S.shelf(D_[1], [G("can", "red", stack=2), G("can", "green", stack=2), G("can", "purple", stack=2)])
    S.shelf(D_[0], [I("plush", [("pink", "white"), ("sky", "white"), ("yellow", "white"), ("mint", "white")], 4, sc=1.6)])
    S.header(A[3], "gamecase", ("red", "yellow")); S.header(C_[3], "controller", ("white", "plum")); S.header(D_[3], "bag", ("purple", "yellow"))
    S.group(B_[3], [("arcade", ("purple", "yellow"), .5, .5, {"sc": 1.7}), ("plush", ("pink", "white"), .15, .5, {"sc": 1.6}), ("plush", ("sky", "white"), .85, .5, {"sc": 1.6})])
    S.begin("Island", 0, .1); T, T2 = S.table(4.2, 1.2, tier=(2.4, .42, .16))
    S.shelf(T, [I("handheld", [("purple", "teal"), ("red", "blue"), ("yellow", "green"), ("pink", "sky")], 4, sc=1.5)], tags=False, maxgap=.6)
    S.group(T2, [("console", ("white", "teal"), .22, .5, {"sc": 1.4}), ("console", ("plum", "purple"), .78, .5, {"sc": 1.4}), ("gamecase", ("red", "yellow"), .5, .5, {"sc": 1.6})])
    S.begin("Accessories", -3.55, .4); T = S.table(2.25, 1.0)
    S.group(T, [("headset", ("purple", "plum"), .2, .7, {"sc": 1.4}), ("headset", ("teal", "plum"), .5, .7, {"sc": 1.4}), ("headset", ("pink", "plum"), .8, .7, {"sc": 1.4}),
                ("controller", ("white", "plum"), .2, .22, {"sc": 1.5, "rz": .3}), ("controller", ("red", "plum"), .5, .22, {"sc": 1.5}), ("controller", ("blue", "plum"), .8, .22, {"sc": 1.5, "rz": -.3})])
    rz0 = S.lbb("Pixel_Demo_Rug")[1].z
    S.begin("Demo", 3.75, -.85, z=rz0); b = S.b; b.box2((-1.05, -.35, 0), (1.05, .35, .6), "purple", r=.04, seg=1); b.box2((-.95, -.36, .08), (.95, -.35, .5), "plum")
    S.put("tv", "plum", 0, .12, .6); S.put("console", ("white", "teal"), -.55, -.14, .6, sc=1.2); S.put("controller", ("red", "plum"), .15, -.2, .6, sc=1.3, rz=.2); S.put("controller", ("blue", "plum"), .6, -.2, .6, sc=1.3, rz=-.2)
    # Each beanbag is its own object, so the game can find it by name and let a character sit on it (facing the screen).
    for tag, col, x, rz in (("A", "teal", 3.05, .2), ("B", "yellow", 4.45, -.2)):
        S.begin("Beanbag_" + tag, x, -1.72, rz=pi + rz, z=rz0); S.put("beanbag", col, 0, 0, 0, sc=1.15)
    S.begin("Front"); register(S, "Pixel_Service_Counter")
    return S.done()

def MAKER_MEADOW():
    S = Shop("MAKER_MEADOW", r"^Shop_|Pendant|Maker_Checkout|Entry_Mat|Maker_Stool")
    S.begin("Supplies", 0, 3.36); U = S.wallunit(9.5, bays=4); A, B_, C_, D_ = U["bays"]
    S.shelf(A[2], [I("yarn", RB, None, rows=2, sc=1.4, tray="wood")]); S.shelf(A[1], [I("yarn", RB[::-1], None, rows=2, sc=1.4, tray="wood")]); S.shelf(A[0], [I("yarn", ["white", "cream", "sand", "trunk", "slate", "plum"], None, rows=2, sc=1.4, tray="wood")])
    S.shelf(B_[2], [I("bolt", RB, None, sc=1.45)]); S.shelf(B_[1], [I("bolt", PASTEL, None, sc=1.45)]); S.shelf(B_[0], [I("kitbox", [("teal", "yellow"), ("pink", "white"), ("purple", "yellow"), ("orange", "white")], 4, sc=1.4)])
    S.shelf(C_[2], [I("brushjar", "white", 2, sc=1.5), I("markers", None, 3, sc=1.4), I("sketchbook", ["plum", "red", "teal"], 3, sc=1.3)])
    S.shelf(C_[1], [I("paintcan", RB, None, stack=2, sc=1.5)]); S.shelf(C_[0], [I("clay", ("red", "yellow", "blue"), 3, sc=1.5), I("clay", ("green", "pink", "purple"), 3, sc=1.5)])
    S.shelf(D_[2], [I("spool", RB, None, sc=1.6, rows=2)]); S.shelf(D_[1], [I("washi", ("pink", "teal", "yellow"), 3, sc=1.6), I("washi", ("purple", "orange", "green"), 3, sc=1.6), I("jar", ("pink", "white"), 3, sc=1.5)])
    S.shelf(D_[0], [I("toolbox", "red", 2, sc=1.3), I("storagebox", ("sand", "white"), 2, sc=1.4)])
    S.header(A[3], "yarn", "pink"); S.header(B_[3], "bolt", "teal", sc=1.0); S.header(C_[3], "paintcan", "red"); S.header(D_[3], "spool", "red")
    S.group(C_[3], [("canvas", "sky", .85, .5, {"sc": 1.3})])
    S.begin("Workbench", -3.15, .5); T = S.table(2.7, 1.2, h=.5, top="wood", leg="trunk")
    S.group(T, [("canvas", "sky", .25, .62, {"sc": 1.8}), ("brushjar", "white", .47, .55, {"sc": 1.6}), ("paintcan", "red", .1, .22, {"sc": 1.5}), ("paintcan", ["yellow", "blue"], .2, .28, {"sc": 1.5, "stack": 2}),
                ("toolbox", "red", .78, .6, {"sc": 1.4}), ("clay", ("red", "yellow", "blue"), .62, .25, {"sc": 1.5}), ("sketchbook", "plum", .92, .25, {"sc": 1.3, "rz": .3})])
    S.begin("Sewing", 3.15, .55); T = S.table(2.55, 1.15, h=.5)
    S.group(T, [("sewing", "mint", .5, .55, {"sc": 1.9}), ("spool", "red", .12, .3, {"sc": 1.6}), ("spool", "yellow", .19, .42, {"sc": 1.6}), ("spool", "blue", .1, .55, {"sc": 1.6}),
                ("throw", [("pink", "white"), ("teal", "white"), ("yellow", "white")], .86, .55, {"sc": 1.2, "stack": 3, "twist": .2}), ("tomato", None, .8, .18, {"sc": .9})])
    S.begin("YarnBaskets")
    for n, x in enumerate((3.85, 4.6)):
        S.put("basket", "wood", x, -2.05, 0, sc=2.4)
        for i in range(4): a = tau * i / 3 + n; S.put("yarn", RB[(i * 2 + n * 3) % 8], x + (.1 * cos(a) if i < 3 else 0), -2.05 + (.1 * sin(a) if i < 3 else 0), .08 if i < 3 else .24, sc=1.4)
    S.begin("Front"); register(S, "Maker_Checkout")
    return S.done()

def SEASONAL_POP_UP():
    S = Shop("SEASONAL_POP_UP", r"^Shop_|Pendant|Seasonal_Checkout|Seasonal_Wrapping_Table|Seasonal_Staff|Entry_Mat")
    S.begin("SlatWall", 0, 3.36); S.slatwall(9.4)
    for x, z, c in ((-4.0, 1.6, ("pink", "yellow")), (-3.15, 1.15, ("white", "rose")), (-2.3, 1.6, ("yellow", "white"))):
        S.peg(x, z); S.put("wreath", c, x, -.13, z + .011 + .038 * 1.5, hang=True, sc=1.5)
    L = S.ledge(-4.4, -2.2, .55); S.shelf(L, [I("gift_s", [("red", "yellow"), ("teal", "white"), ("purple", "yellow"), ("pink", "white")], 4, sc=1.2), I("ornament", ["red", "gold", "teal"], 3, sc=1.4)])
    for k, (z, cs) in enumerate(((.6, ["sky", "pink", "yellow"]), (1.05, ["mint", "rose", "lilac"]), (1.5, ["orange", "teal", "purple"]))):
        L = S.ledge(-1.9, -.1, z, d=.16); S.shelf(L, [I("card", [(c, "yellow") for c in cs], 6, sc=1.35)])
    L = S.ledge(.1, 1.9, .6); S.shelf(L, [I("honey", None, 3, sc=1.5), I("candle", ["lilac", "peach", "mint"], 3, sc=1.5)])
    L = S.ledge(.1, 1.9, 1.15); S.shelf(L, [I("snowglobe", ["red", "teal", "purple"], 3, sc=1.5), I("tulips", ("red", "white"), 2, sc=1.3)])
    for x, c in ((2.65, ("cream", "pink")), (3.45, ("white", "teal")), (4.25, ("butter", "rose"))): S.peg(x, 1.72); S.put("tote", c, x, -.12, 1.72 + .011 + .008 * 1.5, hang=True, sc=1.5)
    L = S.ledge(2.3, 4.5, .45); S.shelf(L, [I("lantern", ["red", "teal", "yellow"], 3, sc=1.5)], maxgap=.4)
    S.begin("Hero", 0, 1.4); S.pedestal(1.1, .26); S.kit("GK_Tree_Blossom", 0, 0, .26, h=2.7)
    for i in range(6):
        a = tau * i / 6 + .3; S.put(("gift_m", "gift_s", "gift_l")[i % 3], [("red", "yellow"), ("teal", "white"), ("purple", "yellow"), ("pink", "white"), ("yellow", "red"), ("sky", "white")][i], .72 * cos(a), .72 * sin(a), .26, rz=a + .4, sc=1.4)
    for x, y, c in ((-.95, -1.5, "red"), (0, -1.75, "yellow"), (.95, -1.5, "teal")): S.put("lantern", c, x, y, 0, sc=2.0, rz=.3)
    S.begin("Pedestals")
    for i, (x, y) in enumerate(((-3.3, -1.1), (3.3, -1.1), (-3.3, .75), (3.3, .75))):
        S.pedestal(.55, .6, x, y)
        if i in (0, 3):
            cs = [("purple", "yellow"), ("teal", "white"), ("red", "yellow")] if i == 0 else [("pink", "white"), ("yellow", "red"), ("sky", "white")]
            S.put("giftbox_l", cs[0], x, y, .6, sc=1.5, rz=.2); S.put("giftbox_m", cs[1], x, y, .6 + .206 * 1.5, sc=1.4, rz=-.3); S.put("gift_s", cs[2], x, y, .6 + .206 * 1.5 + .166 * 1.4, sc=1.3, rz=.4)
        elif i == 1:
            S.put("tulips", ("red", "white"), x, y + .15, .6, sc=2.2); S.put("honey", None, x - .22, y - .15, .6, sc=1.6); S.put("candle", "peach", x + .22, y - .15, .6, sc=1.6)
        else:
            S.put("plush", ("pink", "white"), x, y + .12, .6, sc=2.4); S.put("plush", ("sky", "white"), x - .25, y - .2, .6, sc=1.5, rz=.3); S.put("plush", ("yellow", "white"), x + .25, y - .2, .6, sc=1.5, rz=-.3)
    S.begin("Wrap"); bb = S.lbb("Seasonal_Wrapping_Table"); lo, hi = bb; cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    S.put("gift_m", ("sky", "white"), cx - .45, cy, hi.z, sc=1.4, rz=.2)
    for i, c in enumerate(("red", "yellow", "teal")): S.put("spool", c, cx + .1 + .2 * i, cy - .15, hi.z, sc=1.7)
    S.put("wraproll", ("pink", "white"), cx - .1, cy + .25, hi.z + .04, sc=1.2, tilt=Matrix.Rotation(pi / 2, 4, "Y"))
    S.put("basket", "wood", lo.x - .5, cy, 0, sc=2.6)
    for i, c in enumerate((("pink", "white"), ("teal", "white"), ("yellow", "white"), ("purple", "white"), ("red", "white"))):
        a = tau * i / 5; S.put("wraproll", c, lo.x - .5 + .1 * cos(a), cy + .1 * sin(a), .08, sc=1.6, rz=a, tilt=Matrix.Rotation(.2, 4, "Y"))
    register(S, "Seasonal_Checkout")
    return S.done()

def BOOK_BURROW():
    S = Shop("BOOK_BURROW", r"^Shop_|Pendant|Book_Checkout|Book_Staff_Workspot|Entry_Mat|Reading_")
    S.begin("Library", 0, 3.36); U = S.wallunit(9.6, bays=4, levels=(.2, .62, 1.04, 1.46), cap=1.9); b = S.b
    def tag(bd, x): b.box((.1, .01, .045), (x, bd["yf"] - .019, bd["top"] - .027), "yellow")
    def faces(bd, x, cols):
        for j, c in enumerate(cols): S.put("bookface", (c, "white"), x + j * .3, bd["yf"] + .14, bd["top"], sc=1.2)
        tag(bd, x + .15 * (len(cols) - 1))
    for i, bay in enumerate(U["bays"]):
        for k in range(4):
            bd = bay[k]; a, c = bd["x0"] + .04, bd["x1"] - .04; v = (i + k) % 3; sd = i * 10 + k
            if v == 0:
                S.books(bd, a, a + .9, sd); tag(bd, a + .45); faces(bd, a + 1.12, [BOOKC[(sd * 3) % 14], BOOKC[(sd * 3 + 5) % 14]]); S.books(bd, a + 1.62, c, sd + 100); tag(bd, (a + 1.62 + c) / 2)
            elif v == 1:
                faces(bd, a + .14, [BOOKC[(sd * 5) % 14], BOOKC[(sd * 5 + 4) % 14], BOOKC[(sd * 5 + 9) % 14]]); S.books(bd, a + .95, a + 1.75, sd); tag(bd, a + 1.35)
                zt = S.bookstack(c - .22, bd["yf"] + .2, bd["top"], 3, sd); S.put("succulent" if k % 2 else "globe", None, c - .22, bd["yf"] + .2, zt, sc=1.0 if k % 2 else .7) if bd["clear"] > .5 else None
            else:
                S.books(bd, a, a + .75, sd); tag(bd, a + .37); S.bookstack(a + .98, bd["yf"] + .2, bd["top"], 4, sd + 7); S.put("plant" if k == 3 else "mug", ("white", "green") if k == 3 else "teal", a + 1.3, bd["yf"] + .2, bd["top"], sc=1.1 if k == 3 else 1.5)
                S.books(bd, a + 1.5, c, sd + 50); tag(bd, (a + 1.5 + c) / 2)
        S.header(bay[4], "bookface", (["red", "teal", "yellow", "purple"][i], "white"), sc=1.0)
    S.group(U["bays"][1][4], [("globe", None, .15, .5, {"sc": 1.6})]); S.group(U["bays"][2][4], [("plant", ("white", "green"), .85, .5, {"sc": 1.6})])
    S.begin("NewBooks", 2.65, 1.35); T, T2 = S.table(2.5, .92, h=.5, tier=(1.5, .3, .14))
    for j, (c, n) in enumerate((("red", 4), ("teal", 3), ("yellow", 5), ("purple", 3), ("blue", 4))): S.bookstack(-.92 + j * .46, -.22, T["top"], n, j, 1.25, c, .08)
    for j, c in enumerate(("red", "yellow", "blue")): S.put("bookface", (c, "white"), -.45 + j * .45, T2["yf"] + .14, T2["top"], sc=1.25)
    S.begin("StaffPicks", -2.65, 1.35); T = S.table(2.5, .92, h=.5)
    for j, c in enumerate(("green", "orange", "pink", "navy", "teal")):
        S.put("bookface", (c, "white"), -.9 + j * .45, .08, T["top"], sc=1.3); S.put("card", ("butter", "red"), -.9 + j * .45, -.27, T["top"], sc=.8)
    S.begin("Reading")
    for k, (lo, hi) in enumerate(S.each("Reading_Table_Top")):
        x, y = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2; S.put("openbook", ("teal", "red")[k % 2], x - .1, y - .06, hi.z, sc=1.0, rz=.3); S.put("mug", ("sky", "choc"), x + .17, y + .12, hi.z, sc=1.2, rz=-.6)
    S.put("basket", "wood", 4.55, -2.4, 0, sc=2.6); S.bookstack(4.55, -2.4, .08, 3, 5, 1.1)
    bb = S.lbb("Book_Checkout"); register(S, "Book_Checkout"); lo, hi = bb
    S.put("pencilcup", "teal", lo.x + .3, (lo.y + hi.y) / 2, hi.z, sc=1.3); S.stack("notebook", ["pink", "sky", "yellow"], lo.x + .62, (lo.y + hi.y) / 2, hi.z, 3, sc=1.2, twist=.15)
    return S.done()

def ALLTIMEFITNESS():
    S = Shop("ALLTIMEFITNESS", r"^Shop_|Pendant|Wellness_Reception|Wellness_Staff|Entry_Mat|Wellness_Yoga_Rug|Meditation_Rug|Yoga_Demo_Mat|Meditation_Cushion|Hydration_Table")
    S.ground("Meditation_Rug|Meditation_Cushion"); S.ground("Wellness_Yoga_Rug|Yoga_Demo_Mat")
    S.begin("ProductWall", 0, 3.36); U = S.wallunit(9.6, bays=4); A, B_, C_, D_ = U["bays"]; WT = [("white", "teal"), ("white", "pink"), ("white", "purple"), ("white", "blue")]
    S.shelf(A[2], [I("sportbottle", [(c, "plum") for c in ("teal", "pink", "yellow", "purple", "green")], None, sc=1.5)])
    S.shelf(A[1], [I("protein", "plum", 3, sc=1.5), I("protein", "red", 3, sc=1.5)]); S.shelf(A[0], [I("medball", [("red", "white"), ("blue", "white"), ("yellow", "white")], 3, sc=1.6), I("roller", ["blue", "purple"], 2, sc=1.3)])
    S.shelf(B_[2], [I("band", ["yellow", "green", "blue", "red"], 4, stack=3, sc=1.5), I("yogablock", ["teal", "pink"], 2, stack=2, sc=1.3)])
    S.shelf(B_[1], [I("dumbbell", "yellow", 2, sc=1.3), I("dumbbell", "orange", 2, sc=1.55), I("dumbbell", "red", 2, sc=1.8)]); S.shelf(B_[0], [I("kettlebell", ["yellow", "orange", "red", "purple"], 4, sc=1.7)], maxgap=.25)
    y = C_[2]["yf"] + .045 + .15
    for x, cs in ((-.5, WT[:2]), (.5, WT[2:])): S.pyramid("towelroll", cs, (C_[2]["x0"] + C_[2]["x1"]) / 2 + x, y, C_[2]["top"], 3, sc=1.5)
    S.shelf(C_[1], [I("yogablock", ["purple", "teal", "pink", "blue"], 4, stack=2, sc=1.4)])
    for x, cs in ((-.52, [("purple", "white"), ("teal", "white")]), (.52, [("pink", "white"), ("blue", "white")])): S.pyramid("yogamat", cs, (C_[0]["x0"] + C_[0]["x1"]) / 2 + x, C_[0]["yf"] + .045 + .19, C_[0]["top"], 4, sc=1.0)
    S.shelf(D_[2], [I("candle", ["lilac", "peach", "mint"], 3, stack=2, sc=1.5), I("diffuser", ["peach", "mint", "lilac"], 3, sc=1.5)])
    S.shelf(D_[1], [I("tin", [("teal", "gold"), ("pink", "gold"), ("butter", "gold")], None, sc=1.5)]); S.shelf(D_[0], [I("towel", WT, 4, stack=4, sc=1.4)])
    S.header(A[3], "sportbottle", ("teal", "plum")); S.header(B_[3], "dumbbell", "red", sc=1.6); S.header(C_[3], "yogablock", "purple", sc=1.4); S.header(D_[3], "candle", "lilac")
    S.begin("MatRack", 4.8, 1.55, rz=-pi / 2); T = S.table(1.9, .62, h=.3); S.pyramid("yogamat", [("purple", "white"), ("teal", "white"), ("pink", "white"), ("blue", "white"), ("green", "white")], 0, 0, T["top"], 5, sc=1.35)
    S.begin("Studio"); mz = S.lbb("Yoga_Demo_Mat")[1].z; rz = S.lbb("Meditation_Rug")[1].z
    S.put("yogablock", "purple", 3.85, .6, mz, sc=1.4); S.put("yogablock", "teal", 2.65, .6, mz, sc=1.4); S.put("sportbottle", ("teal", "plum"), 4.45, -.9, S.lbb("Wellness_Yoga_Rug")[1].z, sc=1.5)
    S.put("plant", ("white", "green"), -3.15, 1.15, rz, sc=3.4); S.put("tray", "wood", -3.1, .2, rz, sc=1.2)
    for i, c in enumerate(("lilac", "peach", "mint")): S.put("candle", c, -3.3 + .2 * i, .2, rz + .03, sc=1.4 - .15 * i)
    bb = S.lbb("Hydration_Table"); lo, hi = bb; cy = (lo.y + hi.y) / 2
    S.put("dispenser", None, lo.x + .4, cy, hi.z, sc=1.3, rz=pi); S.put("cupstack", "white", lo.x + .85, cy, hi.z, sc=1.3); S.put("fruitbowl", "white", hi.x - .32, cy, hi.z, sc=1.4)
    register(S, "Wellness_Reception"); bb = S.lbb("Wellness_Reception"); S.stack("towel", WT, bb[0].x + .35, (bb[0].y + bb[1].y) / 2, bb[1].z, 3, sc=1.2)
    return S.done()

def FOOD_HALL():
    S = Shop("FOOD_HALL", r"^Shop_|Pendant|Food_(Communal_(Bench|Table)|Queue|Stall_\w+_(Counter|StaffSpot|Top)|Standing)|Entry_Mat|Bake_Awning|Garden_Trellis|Noodle_Portal|Noodle_Lantern")
    z = S.lbb("Food_Stall_Bake_Top")[1].z
    def tray(x, y, kind, cols, nx, ny, sc=1.0, tw=.62, td=.42, zz=None):
        zz = z if zz is None else zz; S.b.box2((x - tw / 2, y - td / 2, zz), (x + tw / 2, y + td / 2, zz + .03), "wood", r=.01, seg=1)
        S.fill(Matrix.Translation((x, y - td / 2, zz + .01)), kind, cols, nx, ny, w=tw, d=td, sc=sc)
    def menu(x, y, col): S.picksign(Matrix.Translation((x, y, z - .02)), 0, 0, col, h=.34)
    S.begin("Bake"); R = S.riser(-4.15, -2.95, 1.4, 1.75, z, .16, "white")
    S.put("cakedome", ("pink", "bread"), -3.85, 1.57, R["top"], sc=1.3); S.group(R, [("cupcake", ("pink", "kraft"), .5, .5, {"sc": 1.5}), ("cupcake", ("sky", "kraft"), .7, .5, {"sc": 1.5}), ("cupcake", ("yellow", "kraft"), .9, .5, {"sc": 1.5})])
    tray(-3.85, 1.0, "croissant", None, 3, 2, 1.4); tray(-3.1, 1.0, "donut", ["pink", "choc", "white"], 3, 2, 1.4)
    S.put("basket", "wood", -2.25, 1.3, z, sc=1.8)
    for k in range(5): S.put("baguette", None, -2.25 + .06 * (k - 2), 1.3 + .03 * ((k % 2) * 2 - 1), z + .05 + .21, rz=.5 * k, tilt=Matrix.Rotation(radians(-78 + 6 * (k - 2)), 4, "Y"), sc=1.2)
    menu(-2.6, .9, "yellow")
    S.begin("Garden"); R = S.riser(-.2, 1.1, 1.4, 1.75, z, .16, "white")
    S.group(R, [("bottle", ("orange", "white"), .12, .5, {"sc": 1.2}), ("bottle", ("green", "white"), .37, .5, {"sc": 1.2}), ("bottle", ("pink", "white"), .62, .5, {"sc": 1.2}), ("bottle", ("yellow", "white"), .87, .5, {"sc": 1.2})])
    for i in range(3): S.put("salad", "kraft", -.95 + i * .42, 1.0, z, sc=1.7)
    tray(.55, 1.0, "wrap", ["leaf_light", "red", "orange"], 1, 3, 1.5); S.put("fruitbowl", "white", -.8, 1.55, z, sc=1.6); menu(1.05, .9, "white")
    S.begin("Noodle"); R = S.riser(1.85, 2.75, 1.4, 1.75, z, .16, "white")
    S.put("steamer", None, 2.08, 1.57, R["top"], sc=1.3); S.put("teapot", ("white", "red"), 2.5, 1.57, R["top"], sc=1.5)
    S.put("ramen", "red", 2.3, 1.0, z, sc=1.7); S.put("ramen", "blue", 2.85, 1.0, z, sc=1.7); S.put("steamer", None, 3.5, 1.05, z, sc=1.6)
    S.put("chopcup", "red", 3.2, 1.55, z, sc=1.5)
    for i, c in enumerate((("red", "green"), ("choc", "red"), ("gold", "white"))): S.put("sauce", c, 3.55 + .14 * i, 1.55, z, sc=1.5)
    menu(4.05, .9, "yellow")
    S.begin("Dining"); bb = S.lbb(r"Food_Communal_Table$"); lo, hi = bb; L = hi.x - lo.x; mains = [("ramen", "red"), ("salad", "kraft"), ("burger", None), ("burger", None), ("ramen", "blue"), ("salad", "kraft")]
    for i in range(6):
        x = lo.x + L * (.18, .5, .82)[i % 3]; side = -1 if i < 3 else 1; y = (lo.y + .26) if side < 0 else (hi.y - .26); a = 0 if side < 0 else pi
        S.put("tray", "wood", x, y, hi.z, sc=.95, rz=a); S.put(mains[i][0], mains[i][1], x - .09 * side * -1, y, hi.z + .024, sc=1.25, rz=a); S.put("boba" if i % 2 else "togo", None, x + .15 * side * -1, y + .04 * side, hi.z + .024, sc=1.2)
    cy = (lo.y + hi.y) / 2
    for x in (lo.x + L * .34, lo.x + L * .66): S.put("chopcup", "red", x, cy, hi.z, sc=1.3); S.put("sauce", ("red", "green"), x + .14, cy, hi.z, sc=1.3); S.put("sauce", ("choc", "red"), x - .14, cy, hi.z, sc=1.3)
    bb = S.lbb(r"Food_Standing_Rail$")
    if bb: S.put("boba", ("peach", "choc"), (bb[0].x + bb[1].x) / 2, bb[0].y + .6, bb[1].z, sc=1.3); S.put("boba", ("mint", "choc"), (bb[0].x + bb[1].x) / 2, bb[1].y - .6, bb[1].z, sc=1.3)
    return S.done()

def ROOFTOP_GARDEN():
    S = Shop("ROOFTOP_GARDEN", r"^Shop_|Pendant|Entry_Mat|RoofGarden_(Bench|Raised|Skylight|Staff|Trellis|Vine|Lantern)|Support_RoofGarden")
    S.ground("RoofGarden_Raised")
    S.begin("Retail", 3.25, 3.36); U = S.wallunit(3.9, bays=2); A, B_ = U["bays"]
    S.shelf(A[2], [I("seedpacket", [("leaf_light", "red"), ("yellow", "orange"), ("pink", "purple"), ("sky", "yellow")], None, sc=1.5, rows=2)])
    S.shelf(A[1], [I("pot", "terracotta", 3, sc=1.4), I("potstack", "terracotta", 2, sc=1.4)]); S.shelf(A[0], [I("soilbag", [("leaf_dark", "yellow"), ("trunk", "white")], 2, stack=3, sc=1.2)])
    S.shelf(B_[2], [I("succulent", "white", 3, sc=1.6), I("cactus", "terracotta", 2, sc=1.5), I("tulips", ("red", "white"), 2, sc=1.5)])
    S.shelf(B_[1], [I("wateringcan", ["teal", "red", "yellow"], 3, sc=1.2)]); S.shelf(B_[0], [I("toolcrock", "sky", 2, sc=1.3), I("jug", ("green", "white"), 3, sc=1.5)])
    S.header(A[3], "seedpacket", ("leaf_light", "red"), sc=1.5); S.header(B_[3], "wateringcan", "teal", sc=1.0); S.group(A[3], [("birdhouse", ("sky", "red"), .85, .5, {"sc": 1.6})])
    S.begin("Potting", .55, 1.25); T = S.table(3.0, .9, h=.8, top="wood", leg="trunk"); b = S.b; b.box2((-1.36, -.34, .22), (1.36, .34, .27), "wood")
    for x, c in ((-.8, ("leaf_dark", "yellow")), (0, ("trunk", "white")), (.8, ("leaf_dark", "yellow"))): S.stack("soilbag", [c], x, 0, .27, 3, sc=1.5, twist=.06)
    b.box2((.25, -.3, .8), (.95, .18, .84), "trunk"); b.box2((.28, -.27, .84), (.92, .15, .85), "soil"); S.put("trowel", "red", .6, -.06, .85, sc=1.5, rz=.6)
    S.group(T, [("pot", "terracotta", .08, .5, {"sc": 1.6}), ("tulips", ("pink", "terracotta"), .2, .55, {"sc": 1.7}), ("potstack", "terracotta", .34, .6, {"sc": 1.5}), ("succulent", "terracotta", .46, .3, {"sc": 1.6}), ("wateringcan", "teal", .9, .55, {"sc": 1.4, "rz": -.4})])
    S.begin("Bed"); bb = S.lbb("Raised_Soil"); lo, hi = bb; z = hi.z; W = hi.x - lo.x; cx = (lo.x + hi.x) / 2
    fl = sorted(m.name for m in bpy.data.meshes if m.name.startswith("GK_Flower"))
    S.kit("GK_Tree_Citrus", cx, hi.y - .75, z, h=2.3); S.kit("GK_Bush", lo.x + .6, hi.y - .6, z, h=.7); S.kit("GK_Bush", hi.x - .6, hi.y - .6, z, h=.7)
    for i in range(6): S.kit(fl[i % len(fl)], lo.x + W * (i + .5) / 6, hi.y - 1.65, z, h=.55) if fl else None
    for i in range(5): S.put("cabbage", None, lo.x + W * (i + .5) / 5, hi.y - 2.35, z - .012, sc=1.7)
    for i in range(6): S.kit(fl[(i + 2) % len(fl)], lo.x + W * (i + .5) / 6, hi.y - 3.0, z, h=.45) if fl else None
    for i in range(4): S.put("pumpkin", None, lo.x + W * (i + .5) / 4, lo.y + .5, z - .012, sc=1.6, rz=i)
    for k, y in enumerate((hi.y - 1.65, hi.y - 2.35, hi.y - 3.0, lo.y + .5)): S.picksign(Matrix.Translation((lo.x + .12, y, z - .02)), 0, 0, ("yellow", "white")[k % 2], h=.36)
    S.put("plant", ("terracotta", "green"), 1.15, -1.45, 0, sc=3.2); S.put("plant", ("terracotta", "green"), 5.15, -1.45, 0, sc=3.2)
    return S.done()

def WINDOWS():
    """The four park-side display windows. Each scene sits on the window floor, facing the glass."""
    rep = {}; keep = r"_Window_"
    def win(key, cx): return Shop(key, keep, src="GROVE_STOREFRONT_REFINEMENT", base=Matrix.Translation((cx, 23.05, .67)) @ Matrix.Rotation(pi, 4, "Z"), acc={"WIN_FRESH": "green", "WIN_STYLE": "pink", "WIN_HOME": "terracotta", "WIN_TASTE": "red"}[key], short=key.title().replace("_", ""), tint="cream")
    PZ = .19
    def stage(S): S.b.box2((-2.56, -.12, 0), (2.56, .44, PZ), S.acc)
    S = win("WIN_FRESH", -22.0); S.begin("Scene"); stage(S)
    for i, (kind, col, sc) in enumerate((("apple", "red", 1.9), ("orange", "orange", 1.9), ("cabbage", None, 1.7))):
        pre = S.crate(-1.5 + i * 1.5, -.43, PZ, w=1.1, d=.52, hgt=.2, tilt=13); S.fill(pre, kind, col, 3, 1, w=1.1, d=.52, sc=sc, layers=2, jit=.5, seed=i); S.picksign(pre, -.42, .48, "yellow", h=.34)
    R = S.riser(-2.0, 2.0, .0, .44, PZ, .5, "wood"); S.group(R, [("cereal", ("red", "yellow"), .08, .5, {"sc": 2.4}), ("carton", ("sky", "white"), .25, .5, {"sc": 2.4}), ("bottle", ("orange", "white"), .41, .5, {"sc": 2.4}), ("pineapple", None, .58, .5, {"sc": 2.2}), ("jar", ("rose", "gold"), .75, .5, {"sc": 2.4}), ("loaf", "crust", .92, .5, {"sc": 2.0})])
    rep["WIN_FRESH"] = S.done()
    S = win("WIN_STYLE", -14.0); S.begin("Scene"); stage(S)
    for x, c, a in ((-.75, "pink", .25), (.75, "teal", -.25)): S.put("mannequin", (c, "white"), x, -.12, PZ, sc=1.85, rz=a)
    S.put("sneaker", ("red", "white"), -1.95, -.4, PZ, sc=2.2, rz=-.4); S.put("hatstand", ("sand", "rose"), -1.9, .06, PZ, sc=1.8); S.put("handbag", ("yellow", "gold"), 1.9, -.4, PZ, sc=2.2, rz=.2); S.put("boot", ("trunk", "plum"), 1.95, .2, PZ, sc=2.0, rz=-.3)
    rep["WIN_STYLE"] = S.done()
    S = win("WIN_HOME", 14.0); S.begin("Scene"); stage(S)
    S.begin("Table", 0, .14, z=PZ); T = S.table(2.2, .56, h=.56)
    S.group(T, [("lamp", ("yellow", "wood"), .15, .5, {"sc": 2.6}), ("vase", ("teal", "pink"), .5, .5, {"sc": 2.0}), ("cushion", ("pink", "white"), .85, .5, {"sc": 1.8})])
    S.begin("Front"); S.put("plant", ("white", "green"), -2.0, -.3, PZ, sc=2.8); S.put("kettle", ("red", "plum"), -.75, -.48, PZ, sc=2.0); S.put("mug", "sky", .1, -.48, PZ, sc=2.2, rz=-.6); S.put("mug", "pink", .6, -.48, PZ, sc=2.2, rz=-.6); S.put("plateup", ("white", "blue"), 1.9, -.4, PZ, sc=2.2)
    rep["WIN_HOME"] = S.done()
    S = win("WIN_TASTE", 22.0); S.begin("Scene"); stage(S); R = S.riser(-1.9, 1.9, .0, .44, PZ, .46, "white")
    S.group(R, [("cakedome", ("pink", "bread"), .14, .5, {"sc": 1.4}), ("cupcake", ("pink", "kraft"), .36, .5, {"sc": 2.4}), ("cupcake", ("sky", "kraft"), .5, .5, {"sc": 2.4}), ("cupcake", ("yellow", "kraft"), .64, .5, {"sc": 2.4}), ("teapot", ("white", "red"), .86, .5, {"sc": 2.2})])
    S.put("croissant", None, -1.9, -.45, PZ, sc=2.6); S.put("croissant", None, -1.3, -.45, PZ, sc=2.6, rz=.4); S.stack("donut", ["pink", "choc", "white"], -.35, -.45, PZ, 3, sc=2.6); S.put("togo", ("white", "kraft"), .7, -.45, PZ, sc=2.6); S.put("togo", ("white", "kraft"), 1.2, -.45, PZ, sc=2.6); S.put("cupsaucer", ("white", "choc"), 1.95, -.45, PZ, sc=2.2)
    rep["WIN_TASTE"] = S.done()
    return rep

FUN = {k: v for k, v in globals().items() if (k in SHOPS or k == "WINDOWS") and callable(v)}
rep = {}
for key in ARGS.get("shops", list(FUN)):
    rep[key] = FUN[key]()
if ARGS.get("tris"): rep["tris"] = tri_total()
ns["gk_report"] = rep
