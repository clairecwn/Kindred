"""Pass 28: the wild land. The home island is built big, and most of it starts closed: this pass splits the lawn into
a start area and sections, fills every section with wild growth and writes what the game needs to open them one by one.
Run after k20_export (it reads the cells that can be built on) and before k14_layouts and k26_showcase.
  1. The start area is the lawn inside kterrain.HOME (an ellipse round the pier and the house plot).
  2. The rest is split into SECTIONS pieces of about the same size, each as round as the land allows. They are numbered
     from the nearest to home outwards. A section can be opened when it touches land that is already open.
  3. Each section gets wild growth and a sign on the side that faces home. The growth is laid out in groves and
     glades (see "growth" below): never evenly. Objects are KW_<section>_<n>_<part>, in the collection KW_<section>
     under KINGDOM_WILD, so unticking one collection shows that land opened.
  4. kingdom_sections.json is written: a 1 m grid that says which section every cell is in, and a list of the sections.
More land later is either another isle (kterrain.BRIDGE_POINTS has the places kept for bridges) or, on a bigger outline,
more sections: nothing here is drawn by hand.
Args: sections (int, default 16), seed (int, default 3)."""
import bpy, importlib, json, os, random, base64
import numpy as np
from kk import *
import ktone; importlib.reload(ktone)
import kterrain; importlib.reload(kterrain)
import kworld; importlib.reload(kworld)
import kgreen; importlib.reload(kgreen)
import kcrops, ktrees; importlib.reload(kcrops); importlib.reload(ktrees)
import klayout; importlib.reload(klayout)
from ktone import TB
from math import atan2, hypot, floor
ARGS = NS.get("kk_args") or {}; K = int(ARGS.get("sections", 16)); SEED = int(ARGS.get("seed", 3))
isl = klayout.read_island(); lawn = isl["lawn"]
(hx, hy), (ra, rb) = kterrain.HOME
home = {c for c in lawn if ((c[0] + 0.5 - hx) / ra) ** 2 + ((c[1] + 0.5 - hy) / rb) ** 2 <= 1.0}
rest = sorted(lawn - home); pts = np.array([(c[0] + 0.5, c[1] + 0.5) for c in rest])
# ---- split the rest into K round pieces (k-means from a fixed start: the same split every run)
cen = [pts[np.argmax(pts[:, 1])]]
for _ in range(K - 1):
    d = np.min([((pts - c) ** 2).sum(1) for c in cen], axis=0); cen.append(pts[np.argmax(d)])
cen = np.array(cen)
for _ in range(60):
    lab = np.argmin(((pts[:, None, :] - cen[None, :, :]) ** 2).sum(2), axis=1)
    new = np.array([pts[lab == k].mean(0) if (lab == k).any() else cen[k] for k in range(K)])
    if np.abs(new - cen).max() < 1e-3: break
    cen = new
order = np.argsort([hypot(c[0] - hx, c[1] - hy) for c in cen]); rank = {int(k): i + 1 for i, k in enumerate(order)}      # 1 is the nearest to home
sec = {c: 0 for c in home}; sec.update({c: rank[int(l)] for c, l in zip(rest, lab)})
# a scrap of a few cells cut off from its section (by a path, by the start area) joins the land it touches most
def pieces(cells):
    cells = set(cells); out = []
    while cells:
        todo = [cells.pop()]; comp = set(todo)
        while todo:
            i, j = todo.pop()
            for c in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if c in cells: cells.discard(c); comp.add(c); todo.append(c)
        out.append(comp)
    return out
moved = 0
for k in range(0, K + 1):
    ps = sorted(pieces([c for c, s in sec.items() if s == k]), key=len, reverse=True)
    for comp in ps[1:]:
        if len(comp) > 14: continue
        near = {}
        for (i, j) in comp:
            for c in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if c in sec and sec[c] != k: near[sec[c]] = near.get(sec[c], 0) + 1
        if near:
            to = max(near, key=near.get)
            for c in comp: sec[c] = to
            moved += len(comp)
# ---- facts about each section
cells_of = {k: sorted(c for c, s in sec.items() if s == k) for k in range(K + 1)}
def touching(k):
    out = set()
    for (i, j) in cells_of[k]:
        for a in range(-3, 4):                      # 3 cells: land on the two sides of a path still counts as touching
            for b_ in range(-3, 4):
                s = sec.get((i + a, j + b_))
                if s is not None and s != k: out.add(s)
    return sorted(out)
next_to = {k: touching(k) for k in range(1, K + 1)}
ring = {0: 0}; todo = [0]                             # how many sections lie between this one and home
while todo:
    k = todo.pop(0)
    for q in range(1, K + 1):
        if q not in ring and (k in next_to[q]): ring[q] = ring[k] + 1; todo.append(q)
spine = isl["spine"]
steps = {o.name: json.loads(o["kk_steps"])["top"] for o in bpy.data.objects if o.get("kk_steps")}
bridges = {o.name: json.loads(o["kk_bridge"])["from"] for o in bpy.data.objects if o.get("kk_bridge")}
def owner(p):
    """The section whose land is nearest a point on the island's edge."""
    best = min(sec, key=lambda c: (c[0] + 0.5 - p[0]) ** 2 + (c[1] + 0.5 - p[1]) ** 2); return sec[best]
# ---- kit meshes for wild land (kgreen.py has the rules of the look)
MESH = {}
for name, fn, args in (("KK_Tree_Wild_A", ktrees.wild_tree, ("A", "classic")), ("KK_Tree_Wild_A2", ktrees.wild_tree, ("A", "deep")), ("KK_Tree_Wild_B", ktrees.wild_tree, ("B", "classic")),
                       ("KK_Tree_Wild_B2", ktrees.wild_tree, ("B", "warm")), ("KK_Tree_Wild_C", ktrees.wild_tree, ("C", "deep")), ("KK_Tree_Wild_D", ktrees.wild_tree, ("D", "warm")),
                       ("KK_Tree_Wild_D2", ktrees.wild_tree, ("D", "classic")), ("KK_Tree_Blossom", ktrees.wild_tree, ("B", "blossom")), ("KK_Thicket_A", ktrees.shrub, ("A", "classic", "pink")),
                       ("KK_Thicket_B", ktrees.shrub, ("B", "deep")), ("KK_Fern", ktrees.fern, ()), ("KK_Mushrooms", ktrees.mushrooms, ()), ("KK_Log", ktrees.log, ()), ("KK_Stump", ktrees.stump, ())):
    b = TB(); fn(b, *args); MESH[name] = kit(name, b)
b = TB(); kworld.land_sign(b); MESH["KK_Land_Sign"] = kit("KK_Land_Sign", b)
kitc = bpy.data.collections.get("KINGDOM_KIT")
if kitc:                                               # on the kit shelf (a row of their own), so k20_export writes them with the other kit pieces
    for i, n in enumerate(MESH):
        o = bpy.data.objects.get("KIT_" + n[3:]) or bpy.data.objects.new("KIT_" + n[3:], MESH[n])
        if o.name not in kitc.objects: kitc.objects.link(o)
        o.data = MESH[n]; o.location = (-22.0 + 5.5 * i, -84.0, 0.0)
# ---- growth: groves and glades
# What the forest guides say, as rules:
#   a. Never space trees evenly. A grove is one big tree with two to four smaller ones close round it; groves stand
#      at least 7 m apart, and the lawn between them is a glade.
#   b. Low at the edge, tall further in: a big tree stands 3 cells or more in from the land next door, other trees 2,
#      small trees and shrubs 1. So every section has a soft edge and its trees do not hang over the neighbour's land.
#   c. Shrubs and ferns stand at the feet of trees, so trunks do not just stab the lawn.
#   d. Glades get flowers in patches of one colour, mushrooms, a log, a stump, rocks.
#   e. Sizes vary a lot (0.7 to 1.5), and nothing stands on the centre of its cell.
BIG = ["KK_Tree_Wild_A", "KK_Tree_Wild_B", "KK_Tree_Wild_A2", "KK_Tree_Wild_B2"]
MID = ["KK_Tree_Wild_A", "KK_Tree_Wild_C", "KK_Tree_Wild_B2", "KK_Tree_Wild_A2", "KK_Tree_Wild_D", "KK_Tree_Wild_B", "KK_Tree_Wild_D2"]
SMALL = ("KK_Tree_Wild_D", "KK_Tree_Wild_D2")
BLOOM = ["KK_Flower_pink", "KK_Flower_yellow", "KK_Flower_white", "KK_Flower_purple"]
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
WILD = ccol("KINGDOM_WILD")
for ch in list(WILD.children):
    for o in list(ch.objects): bpy.data.objects.remove(o, do_unlink=True)
    WILD.children.unlink(ch); bpy.data.collections.remove(ch)
for o in list(WILD.objects): bpy.data.objects.remove(o, do_unlink=True)
sections = []; total = 0; kinds = {}
for k in range(1, K + 1):
    col = bpy.data.collections.new("KW_%02d" % k); WILD.children.link(col); rnd = random.Random(SEED * 100 + k); cells = cells_of[k]; A_ = len(cells); cs = set(cells)
    cx = sum(c[0] + 0.5 for c in cells) / A_; cy = sum(c[1] + 0.5 for c in cells) / A_; n = 0; wild = []
    # the sign: on the cell of this section nearest the open land it will be reached from
    frm = min(next_to[k], key=lambda q: (ring.get(q, 99), q)) if next_to[k] else 0
    fc = cells_of[frm]; fx = sum(c[0] + 0.5 for c in fc) / len(fc); fy = sum(c[1] + 0.5 for c in fc) / len(fc)
    edge = [c for c in cells if any(sec.get((c[0] + a, c[1] + b_)) == frm for a in range(-3, 4) for b_ in range(-3, 4))] or cells
    sc_ = min(edge, key=lambda c: (c[0] + 0.5 - fx) ** 2 + (c[1] + 0.5 - fy) ** 2); sx, sy = sc_[0] + 0.5, sc_[1] + 0.5; rz = atan2(fx - sx, -(fy - sy))
    o = bpy.data.objects.new("KW_%02d_Sign" % k, MESH["KK_Land_Sign"]); col.objects.link(o); o.location = (sx, sy, Z); o.rotation_euler = (0, 0, rz)
    taken = {sc_}; spots = [(sx, sy, 1.6)]; trunks = [(sx, sy, 4.0)]            # spots: everything, by its own width; trunks: tree to tree (and the sign stays in view)
    free = [c for c in cells if not any((c[0] + a, c[1] + b_) in spine for a in (-1, 0, 1) for b_ in (-1, 0, 1))]      # the island's own paths stay clear
    fs = set(free)
    # how many cells in from land that is not this section's: `din` counts from other land and the paths, `dany` from the shore as well
    def depths(is_edge):
        d = {c: 0 for c in cells if any(is_edge((c[0] + a, c[1] + b_)) for a, b_ in N4)}; todo = list(d)
        while todo:
            c = todo.pop(0)
            for a, b_ in N4:
                q = (c[0] + a, c[1] + b_)
                if q in cs and q not in d: d[q] = d[c] + 1; todo.append(q)
        return d
    din = depths(lambda q: q not in cs and (q in sec or q in spine)); dany = depths(lambda q: q not in cs)
    def place(m, c, s_, width, zoff=0.0, jit=0.3, take=True, tree=0.0):
        """One thing on cell c, moved off its centre. Refused when the cell is taken, or it would stand in something, or (a tree) too near another tree."""
        global n
        if c not in fs or (take and c in taken): return None
        x = c[0] + 0.5 + rnd.uniform(-jit, jit); y = c[1] + 0.5 + rnd.uniform(-jit, jit)
        if any(hypot(x - px, y - py) < (width + g) / 2 for px, py, g in spots): return None
        if tree and any(hypot(x - px, y - py) < (tree + g) / 2 for px, py, g in trunks): return None
        r_ = rnd.uniform(0, tau); n += 1
        o = bpy.data.objects.new("KW_%02d_%03d_%s" % (k, n, m[3:]), bpy.data.meshes[m]); col.objects.link(o); o.location = (x, y, Z + zoff); o.rotation_euler = (0, 0, r_); o.scale = (s_, s_, s_)
        spots.append((x, y, width))
        if tree: trunks.append((x, y, tree))
        if take: taken.add(c)
        wild.append({"mesh": m, "x": round(x, 2), "z": round(-y, 2), "rot": round(r_, 3), "scale": round(s_, 3)}); kinds[m] = kinds.get(m, 0) + 1
        return (x, y)
    def near(p, lo, hi):
        a = rnd.uniform(0, tau); d = rnd.uniform(lo, hi); return (floor(p[0] + d * cos(a)), floor(p[1] + d * sin(a)))
    def some(count, pool, fn):
        """Try the cells of `pool` in a shuffled order until `count` are placed."""
        pool = list(pool); rnd.shuffle(pool); done = 0
        for c in pool:
            if done >= count: break
            if fn(c): done += 1
        return done
    trees = []
    # 1. a blossom tree in one section in three, near the edge where it is seen: rare, so it stays a treat
    if k % 3 == 1:
        some(1, [c for c in free if din.get(c, 9) == 2 and dany.get(c, 0) >= 2], lambda c: trees.append(p) or True if (p := place("KK_Tree_Blossom", c, rnd.uniform(0.8, 1.0), 0.9, tree=3.2)) else False)
    # 2. groves
    hearts = []; pool = [c for c in free if din.get(c, 9) >= 3 and dany.get(c, 0) >= 2]; rnd.shuffle(pool)
    for c in pool:
        if len(hearts) >= max(2, round(A_ / 60)): break
        if all(hypot(c[0] - g[0], c[1] - g[1]) >= 7.0 for g in hearts): hearts.append(c)
    for gi, g in enumerate(hearts):
        firs = rnd.random() < 0.12                      # one grove in eight is all tiered trees
        p = place("KK_Tree_Wild_C" if firs else BIG[(gi + k) % 4], g, rnd.uniform(1.2, 1.5), 0.9, tree=3.4)
        if not p: continue
        trees.append(p)
        for j in range(rnd.randint(2, 4)):
            for attempt in range(4):
                c = near(p, 2.6, 4.6); m = "KK_Tree_Wild_C" if firs else MID[rnd.randrange(len(MID))]; small = m in SMALL
                if din.get(c, 9) < (1 if small else 2) or dany.get(c, 0) < 1: continue
                q = place(m, c, rnd.uniform(0.7, 1.08), 0.9, tree=2.2 if small else 2.8)
                if q: trees.append(q); break
    # 3. a few trees on their own, small ones
    some(round(A_ / 120), [c for c in free if dany.get(c, 0) >= 1], lambda c: trees.append(p) or True if (p := place(SMALL[rnd.randrange(2)], c, rnd.uniform(0.8, 1.2), 0.9, tree=5.0)) else False)
    # 4. at the feet of the trees: shrubs and ferns
    for p in trees:
        for j in range(rnd.randint(0, 2)):
            place(("KK_Thicket_A", "KK_Thicket_B")[rnd.randrange(2)], near(p, 1.2, 2.0), rnd.uniform(0.8, 1.25), 1.2)
        for j in range(rnd.randint(0, 2)):
            place("KK_Fern", near(p, 0.9, 2.2), rnd.uniform(0.85, 1.3), 0.7, zoff=-0.02, jit=0.35, take=False)
    # 5. the glades
    some(round(A_ / 45), free, lambda c: place(("KK_Thicket_A", "KK_Thicket_B")[rnd.randrange(2)], c, rnd.uniform(0.8, 1.3), 1.2))
    some(round(A_ / 80), free, lambda c: place("KK_Rock", c, rnd.uniform(0.9, 1.7), 1.3))
    some(max(1, round(A_ / 230)), free, lambda c: place("KK_Log", c, rnd.uniform(0.9, 1.15), 2.0))
    some(max(1, round(A_ / 260)), free, lambda c: place("KK_Stump", c, rnd.uniform(0.85, 1.15), 1.1))
    some(round(A_ / 100), free, lambda c: place("KK_Mushrooms", c, rnd.uniform(0.9, 1.4), 0.6, jit=0.35, take=False))
    for d_ in range(round(A_ / 95)):                   # flowers in patches of one colour
        heart = free[rnd.randrange(len(free))]; m = BLOOM[rnd.randrange(4)]
        for j in range(rnd.randint(4, 7)):
            place(m, near((heart[0] + 0.5, heart[1] + 0.5), 0.0, 1.9), rnd.uniform(0.55, 0.85), 0.55, zoff=-0.01, jit=0.35, take=False)
    some(round(A_ / 8), free, lambda c: place("KK_Grass_Tuft", c, rnd.uniform(0.9, 1.5), 0.5, zoff=-0.03, jit=0.38, take=False))
    t_ = sum(tris(o.data) for o in col.objects); total += t_
    sections.append({"id": k, "name": col.name, "cells": A_, "ring": ring.get(k, 9), "nextTo": next_to[k], "centre": {"x": round(cx, 1), "z": round(-cy, 1)},
                     "sign": {"x": sx, "z": -sy, "rot": round(rz, 4)}, "steps": sorted(nm for nm, p in steps.items() if owner(p) == k), "bridges": sorted(nm for nm, p in bridges.items() if owner(p) == k),
                     "triangles": t_, "wild": wild})
# ---- the grid and the file
xs = [c[0] for c in sec]; ys = [c[1] for c in sec]; X0, X1, Y0, Y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1; nx, nz = X1 - X0, Y1 - Y0
grid = np.zeros((nz, nx), dtype=np.uint8)
for (i, j), s in sec.items(): grid[Y1 - 1 - j, i - X0] = s + 1            # row 0 is the northmost row: game z = -Blender y
def pack(a):
    flat = a.ravel(); edges = np.flatnonzero(np.diff(flat)) + 1; starts = np.concatenate(([0], edges)); runs = np.diff(np.concatenate((starts, [len(flat)])))
    out = bytearray()
    for value, run in zip(flat[starts], runs):
        while run > 0:
            q = min(int(run), 255); out += bytes((int(value), q)); run -= q
    return base64.b64encode(bytes(out)).decode("ascii")
phi, rho = kterrain.home_rho()
points = []
for i, deg in enumerate(kterrain.BRIDGE_POINTS):
    a = radians(deg); r = kterrain.rho_at(phi, rho, a); p = (r * cos(a), r * sin(a))
    points.append({"degrees": deg, "x": round(p[0], 2), "z": round(-p[1], 2), "section": owner(p), "used": i < 2})
doc = {"version": 1, "cell": 1.0, "note": "written by assets/kingdom/blender/passes/k28_sections.py",
       "rules": {"grid": "one value for every 1 m cell, in rows from minZ, each row from minX, run-length packed as (value, count) pairs: 0 not land to build on, 1 the start area, n + 1 section n",
                 "open": "a section can be opened when one of the sections in its nextTo list is open; 0 in that list is the start area",
                 "closed": "until a section is opened its cells cannot be built on or walked on, and its wild growth and its sign are drawn",
                 "paths": "the island's own paths, the great tree's terrace, the pier and the beach are in no section: they are open from the first day",
                 "ring": "how many sections lie between a section and the start area; a fair price rises with it"},
       "grid": {"minX": X0, "minZ": -Y1, "nx": nx, "nz": nz, "data": pack(grid)},
       "home": {"cells": len(cells_of[0]), "centre": {"x": hx, "z": -hy}, "radii": [ra, rb]},
       "sections": sections, "bridgePoints": points, "kit": sorted(MESH)}
out = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom", "kingdom_sections.json")
json.dump(doc, open(out, "w"), separators=(",", ":"))
WILD["kk_sections"] = json.dumps({"count": K, "home": len(cells_of[0])})
show_collection("KINGDOM_WILD", True); bpy.context.view_layer.update()
report(lawn=len(lawn), home=len(cells_of[0]), sections=[[s["id"], s["cells"], s["ring"], s["nextTo"], s["steps"] + s["bridges"]] for s in sections], scraps_moved=moved,
       objects=sum(len(c.objects) for c in WILD.children), triangles=total, kinds=kinds, kit={n: tris(m) for n, m in MESH.items()}, bytes=os.path.getsize(out))
