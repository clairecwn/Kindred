"""Pass 13: restyle the 12 shops. Each shop gets its own colour, checker floor, walls with a wainscot, a low
wall towards the atrium so you can see in, a fascia with the shop name on every visible side, a striped awning
and an icon emblem. Shop materials are mapped onto the Grove palette. Layout and merchandise names are kept."""
import bpy, re, colorsys, math
from gk import *
from gk import _M

SHOPS = {  # key: (name, xc, yc, floor z, front faces +y?, accent, tint)
    "GROVE_GROCER": ("GROVE GROCER", -20, -14, 0, True, "green", "#C9EFB0"), "THREAD_THIMBLE": ("THREAD + THIMBLE", 20, -14, 0, True, "pink", "#FFD0E4"),
    "HOME_NOOK": ("HOME NOOK", 20, 14, 0, False, "terracotta", "#FFDDB8"), "CAFE_CANOPY": ("CAFE CANOPY", -20, 14, 0, False, "red", "#FFCFC6"),
    "SOLE_SEARCH": ("SOLE SEARCH", -20, -14, 5, True, "blue", "#BFE6F8"), "PIXEL_PANTRY": ("PIXEL PANTRY", 20, -14, 5, True, "purple", "#DCCFF7"),
    "MAKER_MEADOW": ("MAKER MEADOW", -20, 14, 5, False, "gold", "#FFF1AE"), "SEASONAL_POP_UP": ("SEASONAL POP-UP", 20, 14, 5, False, "rose", "#FFCEDB"),
    "BOOK_BURROW": ("BOOK BURROW", -20, -14, 10, True, "teal", "#BDF1EA"), "ALLTIMEFITNESS": ("ALLTIMEFITNESS", 20, -14, 10, True, "sky", "#D0EBFC"),
    "FOOD_HALL": ("FOOD HALL", -20, 14, 10, False, "orange", "#FFD8B5"), "ROOFTOP_GARDEN": ("ROOFTOP GARDEN", 20, 14, 10, False, "leaf_dark", "#D9F4BC"),
}
# ---------------------------------------------------------------- icons (drawn in the XZ plane, front facing -Y, inside radius 1)
def icon(key, tint):
    name = "GK_ShopIcon_" + key; b = B(); TM = mat("shop_" + key + "_tint", tint)
    def Pp(pts, m, y=0.06, d=0.08): b.prism(pts, d, m, mtx=XZ(-y - d))
    def R(x0, z0, x1, z1, m, y=0.06, d=0.08): Pp([(x0, z0), (x1, z0), (x1, z1), (x0, z1)], m, y, d)
    def E(cx, cz, rx, rz, m, y=0.06, d=0.08, n=16, rot=0.0):
        Pp([(cx + rx * cos(tau * i / n) * cos(rot) - rz * sin(tau * i / n) * sin(rot), cz + rx * cos(tau * i / n) * sin(rot) + rz * sin(tau * i / n) * cos(rot)) for i in range(n)], m, y, d)
    def bar(x0, z0, x1, z1, w, m, y=0.06, d=0.08):
        dx, dz = x1 - x0, z1 - z0; L = math.hypot(dx, dz); nx, nz = -dz / L * w / 2, dx / L * w / 2
        Pp([(x0 + nx, z0 + nz), (x0 - nx, z0 - nz), (x1 - nx, z1 - nz), (x1 + nx, z1 + nz)], m, y, d)
    E(0, 0, 1.0, 1.0, TM, y=0.0, d=0.06, n=28)
    b.tube([(cos(tau * i / 28), -0.05, sin(tau * i / 28)) for i in range(28)], 0.07, "gold", seg=6, closed=True)
    k = key
    if k == "GROVE_GROCER":
        E(0, -0.08, 0.52, 0.5, "red"); R(-0.04, 0.36, 0.04, 0.62, "trunk"); E(0.2, 0.54, 0.2, 0.1, "leaf_light", rot=0.4); E(-0.2, 0.1, 0.1, 0.16, "white", y=0.1, rot=0.5)
    elif k == "THREAD_THIMBLE":
        E(0, 0, 0.58, 0.58, "pink"); E(0, 0, 0.42, 0.42, "rose", y=0.1)
        for sx in (-1, 1):
            for sz in (-1, 1): E(sx * 0.14, sz * 0.14, 0.07, 0.07, "white", y=0.14, n=8)
    elif k == "HOME_NOOK":
        R(-0.45, -0.52, 0.45, 0.08, "white"); Pp([(-0.64, 0.08), (0.64, 0.08), (0, 0.64)], "red"); R(-0.12, -0.52, 0.12, -0.12, "trunk", y=0.1); E(0.26, -0.12, 0.1, 0.1, "sky", y=0.1, n=10)
    elif k == "CAFE_CANOPY":
        Pp([(-0.42, 0.22), (0.3, 0.22), (0.22, -0.4), (-0.34, -0.4)], "white"); E(0.4, -0.06, 0.2, 0.2, "white", y=0.03); E(0.4, -0.06, 0.1, 0.1, TM, y=0.08, n=10)
        R(-0.58, -0.52, 0.5, -0.43, "red"); E(-0.06, 0.2, 0.3, 0.05, "trunk", y=0.1)
        for sx in (-0.2, 0.08): bar(sx, 0.38, sx + 0.08, 0.66, 0.06, "white")
    elif k == "SOLE_SEARCH":
        Pp([(-0.62, -0.3), (0.62, -0.3), (0.62, -0.06), (0.3, 0.04), (0.05, 0.34), (-0.25, 0.4), (-0.62, 0.3)], "blue"); R(-0.66, -0.44, 0.7, -0.29, "white")
        for i in range(3): bar(-0.02 + 0.13 * i, 0.3 - 0.11 * i, 0.12 + 0.13 * i, 0.4 - 0.11 * i, 0.05, "white", y=0.1)
    elif k == "PIXEL_PANTRY":
        Pp([(-0.6, 0.3), (0.6, 0.3), (0.74, 0.05), (0.7, -0.38), (0.46, -0.42), (0.3, -0.16), (-0.3, -0.16), (-0.46, -0.42), (-0.7, -0.38), (-0.74, 0.05)], "purple")
        R(-0.46, 0.0, -0.22, 0.08, "white", y=0.1); R(-0.38, -0.08, -0.3, 0.16, "white", y=0.1); E(0.28, 0.1, 0.08, 0.08, "yellow", y=0.1, n=8); E(0.46, -0.02, 0.08, 0.08, "red", y=0.1, n=8)
    elif k == "MAKER_MEADOW":
        bar(-0.62, -0.62, 0.12, 0.12, 0.13, "wood"); bar(0.12, 0.12, 0.26, 0.26, 0.16, "grey"); Pp([(0.2, 0.34), (0.34, 0.2), (0.6, 0.6)], "red")
        E(-0.36, 0.34, 0.16, 0.14, "yellow"); E(0.42, -0.36, 0.14, 0.12, "blue"); E(-0.05, 0.52, 0.1, 0.09, "green")
    elif k == "SEASONAL_POP_UP":
        R(-0.5, -0.56, 0.5, 0.18, "red"); R(-0.58, 0.18, 0.58, 0.38, "rose"); R(-0.09, -0.56, 0.09, 0.38, "yellow", y=0.1)
        E(-0.2, 0.52, 0.2, 0.13, "yellow", rot=-0.4); E(0.2, 0.52, 0.2, 0.13, "yellow", rot=0.4)
    elif k == "BOOK_BURROW":
        Pp([(-0.76, -0.42), (0, -0.52), (0.76, -0.42), (0.76, 0.5), (0, 0.4), (-0.76, 0.5)], "teal")
        Pp([(-0.68, -0.32), (-0.03, -0.42), (-0.03, 0.4), (-0.68, 0.5)], "white", y=0.1); Pp([(0.68, -0.32), (0.03, -0.42), (0.03, 0.4), (0.68, 0.5)], "white", y=0.1)
        R(0.36, 0.1, 0.48, 0.5, "red", y=0.14)
    elif k == "ALLTIMEFITNESS":
        R(-0.5, -0.06, 0.5, 0.06, "grey")
        for sx in (-1, 1):
            R(min(sx * 0.5, sx * 0.72), -0.4, max(sx * 0.5, sx * 0.72), 0.4, "blue"); R(min(sx * 0.72, sx * 0.86), -0.28, max(sx * 0.72, sx * 0.86), 0.28, "navy")
    elif k == "FOOD_HALL":
        Pp([(-0.62, 0.0)] + [(0.62 * cos(pi + pi * i / 12), 0.62 * sin(pi + pi * i / 12)) for i in range(1, 12)] + [(0.62, 0.0)], "orange"); R(-0.68, 0.0, 0.68, 0.1, "white")
        bar(-0.1, 0.1, 0.5, 0.7, 0.05, "trunk", y=0.03); bar(0.02, 0.1, 0.62, 0.62, 0.05, "trunk", y=0.03)
        for sx in (-0.4, -0.18): bar(sx, 0.24, sx + 0.08, 0.5, 0.06, "white")
    else:
        Pp([(-0.36, -0.12), (0.36, -0.12), (0.27, -0.62), (-0.27, -0.62)], "terracotta"); R(-0.43, -0.12, 0.43, 0.0, "terracotta", y=0.1)
        R(-0.04, 0.0, 0.04, 0.42, "leaf_dark"); E(-0.24, 0.46, 0.25, 0.13, "leaf_light", rot=-0.5); E(0.24, 0.5, 0.25, 0.13, "green", rot=0.5)
    new = b.data(name + "__new"); old = bpy.data.meshes.get(name)
    if old: old.user_remap(new); bpy.data.meshes.remove(old)
    new.name = name; return new

# ---------------------------------------------------------------- palette mapping for shop contents
CHROMA = ["cream", "sand", "terracotta", "orange", "red", "pink", "rose", "yellow", "gold", "green", "leaf_dark", "leaf_light", "teal", "blue", "sky", "navy", "purple", "trunk", "wood"]
HSV = {k: colorsys.rgb_to_hsv(*srgb(PAL[k])) for k in CHROMA}
def to_srgb(c):
    f = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * (max(x, 0) ** (1 / 2.4)) - 0.055
    return tuple(min(1, max(0, f(x))) for x in c[:3])
def pick(m):
    n = m.name.lower(); bs = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
    if bs is None: return "cream"
    h, s, v = colorsys.rgb_to_hsv(*to_srgb(bs.inputs["Base Color"].default_value))
    if "glass" in n or bs.inputs["Alpha"].default_value < 0.95: return "glass"
    if "water" in n: return "water"
    if "glow" in n or bs.inputs["Emission Strength"].default_value > 0.2: return "glow"
    if s < 0.15: return "white" if v > 0.85 else "stone" if v > 0.6 else "grey" if v > 0.35 else "slate" if v > 0.2 else "plum"
    if v < 0.2: return "plum"
    return min(CHROMA, key=lambda k: min(abs(h - HSV[k][0]), 1 - abs(h - HSV[k][0])) * 3 + abs(v - HSV[k][2]) * 0.8 + abs(s - HSV[k][1]) * 0.4)

SHORT = {"GROVE_GROCER": "Grocer", "THREAD_THIMBLE": "Thread", "HOME_NOOK": "Home", "CAFE_CANOPY": "Cafe", "SOLE_SEARCH": "Sole", "PIXEL_PANTRY": "Pixel", "MAKER_MEADOW": "Maker",
         "SEASONAL_POP_UP": "Seasonal", "BOOK_BURROW": "Book", "ALLTIMEFITNESS": "Fitness", "FOOD_HALL": "Food", "ROOFTOP_GARDEN": "Garden"}   # short names avoid "canopy" and "roof", which the game reads as see-through structure
SHELL = re.compile(r"(_Back_Wall|_Left_Wall|_Right_Wall|_Ceiling|_Floor)$")
cache = {}; rep = {}; RAINW = "white"
for key, (label, xc, yc, z0, front_pos, accent, tint) in SHOPS.items():
    col = bpy.data.collections.get(key + "_INTERIOR_REFINEMENT")
    if not col: continue
    for o in [o for o in col.objects if o.name.startswith("Shop_")]:
        me = o.data; bpy.data.objects.remove(o, do_unlink=True)
        if me.users == 0: bpy.data.meshes.remove(me)
    gone = supersede([o for o in col.all_objects if o.type == "MESH" and SHELL.search(o.name)])
    remapped = 0
    for o in col.all_objects:
        if o.type != "MESH": continue
        for s in o.material_slots:
            m = s.material
            if m is None or m.name.startswith("GM_"): continue
            if m.name not in cache: cache[m.name] = M(pick(m))
            s.material = cache[m.name]; remapped += 1
    TM = mat("shop_" + key + "_tint", tint); ico = icon(key, tint)
    TL = mat("shop_" + key + "_tile", tint, tex=tex_tiles("gm_tile_" + key.lower(), tint, "#FFF4DC", PAL[accent]), tile=1.6)
    rot = front_pos                                   # local front is -Y; rotate half a turn when the shop faces +Y
    side = (1 if xc < 0 else -1) * (-1 if rot else 1)   # local X direction of the atrium
    # Four objects per shop, so the game can fade whichever part stands between the camera and the player:
    # ..._Shell (floor, low wall, columns), ..._Back_Wall, ..._Side_Wall and ..._Front_Canopy (fascia, name, awning).
    W, D, H = 5.75, 3.4, 4.55; b = B(); bw = B(); bs = B(); bf = B()
    slab(b, -W, -D - 0.35, W, D + 0.05, -0.02, 0.03, TL, accent)
    bw.box2((-W - 0.3, D + 0.05, 0), (W + 0.3, D + 0.35, H), TM)                                  # back wall
    bw.box2((-W, D + 0.01, 0.03), (W, D + 0.05, 0.75), accent); bw.box2((-W, D - 0.03, 0.75), (W, D + 0.05, 0.86), "white", r=0.03, seg=1)
    ox = -side                                                                                  # outer side: full wall
    bs.box2((ox * W, -D - 0.35, 0), (ox * (W + 0.3), D + 0.05, H), TM)
    bs.box2((ox * (W - 0.04), -D, 0.03), (ox * W, D + 0.01, 0.75), accent); bs.box2((ox * (W - 0.08), -D, 0.75), (ox * W, D + 0.01, 0.86), "white", r=0.03, seg=1)
    b.box2((side * W, -D - 0.05, 0), (side * (W + 0.3), D + 0.05, 0.62), TM)                     # atrium side: low wall with a cap
    b.box2((side * (W - 0.1), -D - 0.05, 0.62), (side * (W + 0.4), D + 0.05, 0.74), accent, r=0.05)
    for (px, py) in ((side * (W + 0.15), -D - 0.2), (ox * (W + 0.15), -D - 0.2), (side * (W + 0.15), D + 0.2)):
        b.lathe([(0.34, 0), (0.34, 0.16), (0.24, 0.3), (0.22, 2.85), (0.3, 2.95), (0.3, 3.0)], (px, py, 0), seg=12, mats=["gold", "gold", "white", "gold", "gold"])
    bf.box2((-W - 0.32, -D - 0.38, 3.0), (W + 0.32, -D - 0.02, 3.9), accent, r=0.12)              # front fascia
    bf.box2((side * (W - 0.02), -D - 0.38, 3.0), (side * (W + 0.34), D + 0.36, 3.9), accent, r=0.12)  # atrium-side fascia
    bf.text(label, 0.56, (0, -D - 0.41, 3.45), "white", face="-y", extrude=0.04, bevel=0.012)
    bf.text(label, 0.5, (side * (W + 0.37), 0, 3.45), "white", face="+x" if side > 0 else "-x", extrude=0.04, bevel=0.012)
    for sx in (-1, 1): bf.mesh(ico, None, mtx=_M((sx * 5.0, -D - 0.4, 3.45)) @ Matrix.Scale(0.4, 4))
    bw.mesh(ico, None, mtx=_M((0, D + 0.03, 3.3)) @ Matrix.Scale(0.95, 4))                         # big emblem on the back wall
    wb = yc + (-D if rot else D); back_faces_lane = abs(wb) < abs(yc)
    if back_faces_lane:
        bw.box2((-W - 0.32, D + 0.3, 3.0), (W + 0.32, D + 0.44, 3.9), accent, r=0.05)
        bw.text(label, 0.56, (0, D + 0.47, 3.45), "white", face="+y", extrude=0.04, bevel=0.012)
        bw.mesh(ico, None, mtx=_M((0, D + 0.37, 1.75), (0, 0, pi)) @ Matrix.Scale(0.95, 4))
        bw.box2((-W, D + 0.35, 0), (W, D + 0.39, 0.75), accent)
    prof = [(0, 0), (1.1, -0.45), (1.1, -0.72), (1.04, -0.72), (1.04, -0.5), (0, -0.08)]; nst = 20; sw = (2 * W + 0.6) / nst
    for i in range(nst):
        bf.prism(prof, sw, accent if i % 2 == 0 else "white", mtx=YZ(-W - 0.3 + i * sw, -D - 0.38, 3.02, True))
    base = "Shop_" + SHORT[key]
    for part, bb in (("Shell", b), ("Back_Wall", bw), ("Side_Wall", bs), ("Front_Canopy", bf)):
        o = bb.obj(base + "_" + part, col); o.location = (xc, yc, z0); o.rotation_euler = (0, 0, pi if rot else 0)
    rep[key] = {"old_shell_superseded": gone, "slots_remapped": remapped, "back_sign": back_faces_lane}
bpy.app.driver_namespace["gk_report"] = rep
