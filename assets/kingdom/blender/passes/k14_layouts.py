"""Pass 14: layers and layouts. The file becomes three layers:
  KINGDOM_WORLD            what is always there: land, great tree, dock, arch, mailbox, the spine path
  KINGDOM_LAYOUT_SHOWCASE  a developed island. Since Phase 11 it is laid out from kit parts by k26_showcase.py; what
                           Codex built there (house, garden, farm, stable, trees, walks) is in KINGDOM_SUPERSEDED
  KINGDOM_LAYOUT_DAY1      what a new player finds: a tent and campfire where the house will stand, and wild growth
Only one layout is ticked at a time in the Outliner. Day 1 is built here from kit pieces and a fixed random seed."""
import bpy, random, importlib, json
from kk import *
import kbuild, kplants, kterrain, klayout, kgreen
import kcamp
for m in (kbuild, kgreen, kplants, kterrain, klayout): importlib.reload(m)
from math import atan2, hypot, floor
SEC, SECTIONS = klayout.read_sections()               # run k28_sections first: Day 1 grows only in the start area
(HX, HY), (HA, HB) = kterrain.HOME
sc = bpy.context.scene; root = sc.collection
def coll(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    p = parent or root
    if c.name not in p.children:
        for q in [root] + list(bpy.data.collections):
            if q is not p and c.name in q.children: q.children.unlink(c)
        p.children.link(c)
    return c
def move(o, c):
    for u in list(o.users_collection): u.objects.unlink(o)
    c.objects.link(o)
W = coll("KINGDOM_WORLD"); SH = coll("KINGDOM_LAYOUT_SHOWCASE"); D1 = coll("KINGDOM_LAYOUT_DAY1")
for n in ("K_Home_Island", "K_Home_Beach", "K_Hill_Terrace", "K_Great_Tree", "K_Dock", "K_Arrival_Arch", "K_Mailbox", "K_Mailbox_Sprout", "K_Path_Spine"):
    if n in bpy.data.objects: move(bpy.data.objects[n], W)
OLD = bpy.data.collections.get("KINGDOM_SUPERSEDED")
for n in ("KINGDOM_HOUSE", "KINGDOM_GARDEN", "KINGDOM_FARM", "KINGDOM_STABLE", "KINGDOM_TREES", "KINGDOM_DECOR"):
    if n in bpy.data.collections: coll(n, SH)
for o in list(bpy.data.objects):
    if (o.name == "K_Path_Walks" or o.name.startswith("K_Shore_Rock")) and not (OLD and OLD in o.users_collection): move(o, SH)
for n in ("KINGDOM_TERRAIN", "KINGDOM_PATHS", "KINGDOM_DOCK"):
    c = bpy.data.collections.get(n)
    if c and not c.objects and not c.children: bpy.data.collections.remove(c)
# showcase tidy: no tuft inside a rock
rocks = [o for o in SH.objects if o.name.startswith("K_Shore_Rock")]
for o in (C("KINGDOM_TREES").objects if "KINGDOM_TREES" in bpy.data.collections else ()):
    if o.name.startswith("K_Grass_"):
        for r in rocks:
            if (o.location.xy - r.location.xy).length < 1.3:
                a = atan2(o.location.y, o.location.x) + 0.11; d = hypot(o.location.x, o.location.y) - 0.6
                o.location.x, o.location.y = d * cos(a), d * sin(a)
# ---- Day 1
for o in list(D1.objects): bpy.data.objects.remove(o, do_unlink=True)      # Day 1 is generated: rebuilt from the seed each run
K = {n: bpy.data.meshes[n] for n in ("KK_Tree_Round", "KK_Bush", "KK_Rock", "KK_Grass_Tuft", "KK_Flower_pink", "KK_Flower_yellow", "KK_Flower_white", "KK_Flower_purple")} if "KK_Bush" in bpy.data.meshes else None
if K is None:
    kplants.build_all(); K = {n: bpy.data.meshes[n] for n in ("KK_Tree_Round", "KK_Bush", "KK_Rock", "KK_Grass_Tuft", "KK_Flower_pink", "KK_Flower_yellow", "KK_Flower_white", "KK_Flower_purple")}
def one(name, fn):
    b = B(); fn(b); return kit(name, b)
SITE = kterrain.SITE                                   # where the tent stands and the house will be built: the centre of every size of plot
SX, SY = SITE
put("K_D1_Tent", one("KK_Tent", kcamp.tent), D1, (SX, SY, Z))
put("K_D1_Campfire", one("KK_Campfire", kcamp.campfire), D1, (SX + 4.5, SY - 4.5, Z))
ls = one("KK_Log_Stool", kcamp.log_stool)
for i, (x, y) in enumerate(((SX + 6.5, SY - 4.5), (SX + 4.5, SY - 6.5))): put("K_D1_Log_Stool_%d" % i, ls, D1, (x, y, Z))
put("K_D1_Plot_Sign", one("KK_Sign_Sprout", kbuild.sign), D1, (SX - 3.5, SY - 3.5, Z), rz=0.25)
phi, rho = kterrain.home_rho(); hx, hy = kterrain.HILL; SOUTH = kterrain.rho_at(phi, rho, 1.5 * pi)
RX0, RX1, RY0, RY1 = json.loads(bpy.data.objects["K_Hill_Terrace"]["kk_terrace"])["ramp"]
spine = []
for p in json.loads(bpy.data.objects["K_Path_Spine"]["kk_paths"]):
    pts = p["points"]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for k in range(9): spine.append((x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8))
keep = []                                              # the top of each flight of beach steps and each bridge head stay clear
for o in bpy.data.objects:
    for k_ in ("kk_steps", "kk_bridge"):
        if o.get(k_):
            t = json.loads(o[k_])["top" if k_ == "kk_steps" else "from"]; r = hypot(*t); keep.append((t[0] * (1 - 1.5 / r), t[1] * (1 - 1.5 / r)))
rnd = random.Random(7); placed = []
def free(x, y, gap, path_gap):
    if hypot(x, y) > kterrain.rho_at(phi, rho, atan2(y, x)) - 1.2: return False
    if (x - hx) ** 2 + (y - hy) ** 2 < (kterrain.HILL_R + 1.0) ** 2: return False
    if RX0 - 0.7 < x < RX1 + 0.7 and RY0 - 1.5 < y < RY1: return False                 # ramp
    if SX - 4.0 < x < SX + 4.0 and SY - 4.2 < y < SY + 3.6: return False                # the first house plot, with a cell to spare
    if SX + 2.5 < x < SX + 8.0 and SY - 8.0 < y < SY - 2.5: return False                # camp
    if abs(x) < 3.2 and y < -(SOUTH - 3.5): return False                                # arch and mailbox
    if any((x - kx) ** 2 + (y - ky) ** 2 < 2.0 ** 2 for kx, ky in keep): return False
    if SEC.get((floor(x), floor(y))) != 0: return False                                 # not the start area: wild land has its own growth (k28)
    if any((x - px) ** 2 + (y - py) ** 2 < path_gap ** 2 for px, py in spine): return False
    return all((x - px) ** 2 + (y - py) ** 2 > max(gap, g) ** 2 for px, py, g in placed)
def scatter(prefix, meshes, n, gap, path_gap, sc_, zoff=0.0, snap=True):
    """snap: stand on the centre of a 1 m cell, because the thing takes that cell until the player clears it."""
    from math import floor
    k = 0; tries = 0
    while k < n and tries < 4000:
        tries += 1; a = rnd.uniform(0, tau); r = sqrt(rnd.random()); x, y = HX + HA * r * cos(a), HY + HB * r * sin(a)
        if snap: x, y = floor(x) + 0.5, floor(y) + 0.5
        if not free(x, y, gap, path_gap): continue
        me = meshes[k % len(meshes)]
        put("%s_%02d" % (prefix, k), me, D1, (x, y, Z + zoff), rz=rnd.uniform(0, tau), sc=rnd.uniform(*sc_)); placed.append((x, y, gap)); k += 1
    return k
def patches(prefix, meshes, count, per, path_gap, sc_, zoff=0.0):
    """Flowers grow in patches of one colour, a few cells together (kgreen rule: never evenly). Each still stands on the
    centre of its own cell."""
    k = 0; tries = 0; made = 0
    while made < count and tries < 4000:
        tries += 1; a = rnd.uniform(0, tau); r = sqrt(rnd.random()); x, y = floor(HX + HA * r * cos(a)) + 0.5, floor(HY + HB * r * sin(a)) + 0.5
        if not free(x, y, 2.6, path_gap): continue
        me = meshes[made % len(meshes)]; near = [(1, 0), (0, 1), (-1, 1), (1, -1), (-1, 0), (0, -1), (1, 1)]; rnd.shuffle(near); got = 0
        for dx, dy in [(0, 0)] + near:
            if got >= per: break
            if got and not free(x + dx, y + dy, 0.9, path_gap): continue
            put("%s_%02d" % (prefix, k), me, D1, (x + dx, y + dy, Z + zoff), rz=rnd.uniform(0, tau), sc=rnd.uniform(*sc_)); placed.append((x + dx, y + dy, 0.9)); k += 1; got += 1
        made += 1
    return k
n = {}
# the start area is about 1,200 cells: light growth the player can clear in the first days
n["trees"] = scatter("K_D1_Tree", [K["KK_Tree_Round"]], 9, 4.6, 4.0, (0.6, 1.0))
n["bushes"] = scatter("K_D1_Bush", [K["KK_Bush"]], 15, 2.2, 2.4, (0.8, 1.15))
n["rocks"] = scatter("K_D1_Rock", [K["KK_Rock"]], 11, 1.8, 2.2, (0.9, 1.6))
for o in [o for o in D1.objects if o.name.startswith("K_D1_Flower")]: bpy.data.objects.remove(o, do_unlink=True)      # a patch may come out smaller than last time
n["flowers"] = patches("K_D1_Flower", [K["KK_Flower_pink"], K["KK_Flower_yellow"], K["KK_Flower_white"], K["KK_Flower_purple"]], 7, 4, 1.8, (0.6, 0.85), -0.01)
n["tufts"] = scatter("K_D1_Grass", [K["KK_Grass_Tuft"]], 60, 0.8, 1.6, (0.9, 1.45), -0.03, snap=False)
# show one layout
def layer(c, lc=None):
    lc = lc or bpy.context.view_layer.layer_collection
    if lc.collection == c: return lc
    for ch in lc.children:
        r = layer(c, ch)
        if r: return r
show = (NS.get("kk_args") or {}).get("show", "showcase")
def excl(lc, v):
    lc.exclude = v
    for ch in lc.children: excl(ch, v)             # a child stays unticked when its parent is ticked again, so set each one
excl(layer(SH), show != "showcase"); excl(layer(D1), show != "day1")
klayout.show_wild(json.loads(SH.get("kk_opened", "[]")) if show == "showcase" else ())      # Day 1: every section wild. Showcase: the ones it has opened are clear
report(day1=n, showing=show, world=len(W.objects), showcase=len(SH.all_objects), day1_objects=len(D1.objects))
