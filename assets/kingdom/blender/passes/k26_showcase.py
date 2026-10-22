"""Pass 26: the showcase island, laid out again from kit parts only. Run after k20_export (it reads the cells that can
be built on from kingdom_collision.json), after k25_world_finish (it keeps the steps and bridge heads clear) and after
k27_life_kit (it sets creatures out).
  1. What stood in KINGDOM_LAYOUT_SHOWCASE before (Codex's house, garden, farm and stable, the curved side walks, the
     shore rocks) is retired to KINGDOM_SUPERSEDED.
  2. The island is laid out with klayout.Land: the biggest house from the house kit, a brick street past its front,
     a pond garden, twelve fenced crop beds, a shed, a stable and paddock, a well, a camp, an orchard, seats and
     lamps, then wild trees, bushes and flowers. Each area keeps a few cells of open lawn between it and the next.
     Every part goes down on whole 1 m cells and is checked as it is placed.
  3. kingdom_showcase.json is written: the same layout as data, for the game to load as a ready-made island.
Objects are named KS_<n>_<part>. Everything here is rebuilt on every run; nothing is edited by hand."""
import bpy, importlib, json, os
from kk import *
import klayout; importlib.reload(klayout)
import kterrain; importlib.reload(kterrain)
from klayout import Land, read_island
from math import hypot, floor
SH = C("KINGDOM_LAYOUT_SHOWCASE")
show_collection("KINGDOM_LAYOUT_SHOWCASE", True)          # first: objects in an unticked collection are not measured
retired = supersede([o for o in SH.all_objects if not o.name.startswith("KS_")])
for ch in list(SH.children):
    if not ch.all_objects: SH.children.unlink(ch); bpy.data.collections.remove(ch)
for o in [o for o in SH.all_objects if o.name.startswith("KS_")]: bpy.data.objects.remove(o, do_unlink=True)
SEC, SECTIONS = klayout.read_sections()                    # k28: which section every cell is in (0 is the start area)
ORIGIN = (0, int(kterrain.SITE[1]) - 9)                    # the layout is written with the house plot's centre at (-3, 9); this puts it on kterrain.SITE
L = Land(SH, "KS", read_island(), origin=ORIGIN); OX, OY = ORIGIN
def rect(i0, i1, j0, j1): return [(i, j) for i in range(i0, i1 + 1) for j in range(j0, j1 + 1)]
def ring(i0, i1, j0, j1): return [(i, j) for (i, j) in rect(i0, i1, j0, j1) if i in (i0, i1) or j in (j0, j1)]

# ---- what must stay clear: the top of each flight of steps and each bridge head
targets = []
for o in bpy.data.objects:
    if o.get("kk_steps"):
        t = json.loads(o["kk_steps"])["top"]; r = hypot(*t); p = (t[0] * (1 - 1.5 / r), t[1] * (1 - 1.5 / r)); L.reserve(p[0], p[1], 1.3, o.name); targets.append((o.name, (floor(p[0]), floor(p[1]))))
    if o.get("kk_bridge"):
        t = json.loads(o["kk_bridge"])["from"]; r = hypot(*t); p = (t[0] * (1 - 1.5 / r), t[1] * (1 - 1.5 / r)); L.reserve(p[0], p[1], 1.3, o.name); targets.append((o.name, (floor(p[0]), floor(p[1]))))

# ---- paths. A brick street runs past the house front from the great tree's walk to the east bridge; brick lanes go
#      north and south from it on the east side, stone lanes serve the pond garden in the south-west. Each ends at
#      steps, a bridge head, a gate or a door.
L.paths({
    "Brick": rect(-18, 24, 0, 1) + rect(6, 7, 2, 18) + rect(16, 16, 2, 3) + rect(8, 9, 7, 7)
             + rect(1, 11, -15, -14) + rect(2, 9, -22, -21),
    "Stone": rect(-17, -16, -18, -6),
})
# ---- the house: the biggest size, on the plot the tent stood on
L.house("House", dict(size="Manor", roof="Hip", door="Double", window="Arch", porch="Deck", chimney="Brick", timber=False,
                      col=dict(roof="red", wall="cream", trim="white", door="blue")), -10, 2)
L.put("KD_Planter_Urn", -11, 2); L.put("KD_Planter_Urn", 4, 2)
L.put("KD_Pond_Fountain", 1, -6)                                   # a small square where the arrival path meets the street
for i, m in ((-9, "Apple"), (-4, "Citrus"), (1, "Apple")): L.put("KK_Tree_" + m, i, 18, cells=(1, 1))      # the orchard behind the house
# ---- west of the house: the well, and a camp under the great tree
L.put("KH_Well", -15, 4)
L.put("KK_Campfire", -15, 10, cells=(2, 2)); L.put("KK_Log_Stool", -16, 12, cells=(1, 1)); L.put("KK_Log_Stool", -12, 10, cells=(1, 1)); L.put("KK_Log_Stool", -16, 9, cells=(1, 1))
# ---- the pond garden, south-west
L.pond(rect(-12, -7, -17, -14) + rect(-9, -7, -18, -18) + rect(-12, -11, -13, -13))
L.put("KD_Pond_Lily", -11, -16, kind="afloat"); L.put("KD_Pond_Lily", -8, -15, q=1, kind="afloat"); L.put("KD_Pond_Lily", -8, -18, q=2, kind="afloat")
L.put("KD_Pond_Reeds", -13, -15); L.put("KD_Pond_Reeds", -13, -17, q=1); L.put("KD_Pond_Rock", -6, -17)
L.put("KD_Seat_Bench", -9, -12); L.put("KD_Lamp_Lantern", -7, -12)
L.put("KD_Bed_Wood_2x1", -13, -12, plants=("KK_Tulip_S4", 4, 1, 0.2)); L.put("KD_Bed_Wood_2x1", -6, -12, plants=("KK_Daisy_S4", 3, 1, 0.3))
L.put("KD_Bed_Stone_2x2", -5, -16, plants=("KK_Rose_S4", 2, 2, 0.25)); L.put("KD_Bed_Brick_2x1", -5, -18, plants=("KK_Lavender_S4", 5, 1, 0.2))
L.put("KD_Arch_Rose", -17, -8, kind="over"); L.put("KD_Seat_Swing", -12, -20, q=2)
# ---- the farm, north-east: twelve beds inside a picket fence, a shed, sunflowers
L.fence("Picket", ring(10, 22, 4, 13), gates=[(16, 4, 0), (10, 7, 1)])
CROPS = ("Carrot", "Cabbage", "Pumpkin", "Tomato", "Corn", "Strawberry")
for k_, (i, j) in enumerate((i, j) for j in (5, 8, 11) for i in (11, 14, 17, 20)):
    L.put("KD_Bed_Wood_2x2", i, j, plants=("KK_Crop_" + CROPS[(k_ + k_ // 4) % 6], 2, 2, 0.43))
L.house("Shed", dict(size="Shed", roof="Barn", door="Plank", window="Round", porch="Steps", chimney=None, timber=False,
                     col=dict(roof="blue", wall="white", trim="wood", door="red")), 12, 16)
L.put("KD_Planter_Tub", 11, 16); L.put("KD_Planter_Tub", 16, 16); L.put("KD_Bed_Wood_2x1", 17, 17, plants=("KK_Sunflower_S4", 3, 1, 0.3))
# ---- the stable and its paddock, south-east
L.put("KH_Stable", 13, -12)
L.fence("Ranch", rect(12, 12, -17, -12) + rect(19, 19, -17, -12) + rect(13, 18, -17, -17), gates=[(12, -15, 1)], joins=[(13, -12), (18, -12)])
# ---- places to sit, south of the paddock lane
L.put("KD_Pergola", 4, -19, kind="over"); L.put("KD_Seat_Picnic", 5, -19, under=True)
L.put("KD_Seat_Hammock", 9, -18); L.put("KK_Tree_Citrus", 8, -19, cells=(1, 1)); L.put("KK_Tree_Apple", 12, -17 - 2, cells=(1, 1))
L.put("KD_Seat_Deckchair", 13, -22); L.put("KD_Seat_Deckchair", 15, -22)                    # facing the south sea
# ---- lamps and signs where paths meet
for i, j in ((-6, -1), (-1, -1), (8, -1), (17, -1), (-13, -1), (-4, -21), (2, -20), (-18, -12), (11, -16)): L.put("KD_Lamp_Post", i, j)
L.put("KD_Lamp_Double", 24, 2); L.put("KD_Sign_Arrow", 3, -1); L.put("KD_Lamp_Lantern", 3, -20)
# ---- which land this layout has opened. The showcase is an island part-way through the game: the start area and the
#      sections its buildings, paths and pond stand on are open; every other section is still wild (k28 drew that).
used = set(L.solid) | set(L.path) | L.water | set(L.over)
opened = sorted({SEC[c] for c in used if SEC.get(c)})
INFO = {s["id"]: s for s in SECTIONS}; got = {0}; todo = list(opened)
while True:                                            # could a player have opened these, each one touching open land?
    new = [k for k in todo if set(INFO[k]["nextTo"]) & got]
    if not new: break
    got |= set(new); todo = [k for k in todo if k not in got]
if todo: L.problems.append("sections %s could not have been opened: they touch no open land" % todo)
is_open = lambda c: SEC.get(c, 0) == 0 or SEC[c] in opened              # a cell in no section (a path, the terrace) is open
L.closed = {c for c in SEC if not is_open(c)}
L.isl["lawn"] = {c for c in L.isl["lawn"] if is_open(c)}; L.isl["walk"] = {c for c in L.isl["walk"] if is_open(c)}
OWNER = {nm: s_["id"] for s_ in SECTIONS for nm in s_["steps"] + s_["bridges"]}
targets = [t for t in targets if OWNER.get(t[0], 0) in opened or OWNER.get(t[0], 0) == 0]        # steps and bridge heads in wild land are not reached yet
# ---- what grows by itself, from a fixed seed
wild = lambda x, y: not (12 < x < 20 and -17 < y < -12) and not (10 < x < 23 and 4 < y < 14) and not (-9 < x < 6 and -8 < y < 0)      # not in the paddock, the farm or the square
n = {"trees": L.scatter("Tree", ["KK_Tree_Round"], 12, 6.0, clear=2, sc=(0.65, 1.05), where=wild),
     "bushes": L.scatter("Bush", ["KK_Bush"], 16, 3.0, clear=1, sc=(0.8, 1.1), where=wild),
     "rocks": L.scatter("Rock", ["KK_Rock"], 10, 2.6, clear=1, sc=(0.9, 1.5), where=wild),
     "flowers": L.scatter("Flower", ["KK_Flower_pink", "KK_Flower_yellow", "KK_Flower_white", "KK_Flower_purple"], 30, 1.2, clear=1, sc=(0.6, 0.8), zoff=-0.01, where=wild),
     "tufts": L.scatter("Grass", ["KK_Grass_Tuft"], 64, 0.9, clear=0, sc=(0.9, 1.25), zoff=-0.03, takes=False)}
# ---- life (Phase 12): creatures and effects from the life kit. They move in the game, so they take no cells
SEA_H = -0.15 - Z; POND_H = 0.07
for m, x, y, rz in (("KL_Pony", 14.2, -13.3, 0.4), ("KL_Pony_Graze", 18.0, -13.6, -2.4), ("KL_Cow_Graze", 15.6, -14.9, 1.9),
                    ("KL_Sheep", -19.5, 11.5, -1.0), ("KL_Sheep_Graze", -20.6, 13.3, 0.7), ("KL_Sheep_Graze", -18.2, 14.6, 2.6),
                    ("KL_Chicken", 9.5, 14.5, 0.4), ("KL_Chicken_Peck", 10.5, 15.4, 2.2), ("KL_Chicken_Peck", 8.7, 16.3, -1.2), ("KL_Chick", 10.8, 14.8, 1.0), ("KL_Chick", 10.2, 14.4, -0.5), ("KL_Chick", 9.1, 14.2, 2.8),
                    ("KL_Duck", -13.5, -13.4, 1.9)):
    L.live(m, x, y, 0.0, rz)
for x, y, rz in ((-9.5, -14.6, 0.9), (-8.4, -16.8, -2.0)): L.live("KL_Duck_Swim", x, y, POND_H, rz); L.live("KL_Ripple", x, y, POND_H + 0.004, 0.0, 0.7)
porch = bpy.data.objects["KS_House_Porch"]; chim = bpy.data.objects["KS_House_Chimney"]; pl, ph = wbb(porch); cl, ch_ = wbb(chim)
L.live("KL_Cat_Sit", ph.x - 0.9, pl.y + 0.7, 0.3, 0.3, world=True)                                               # on the porch deck
for x, y, h, rz in ((-12.2, -11.4, 1.1, 0.5), (-5.2, -11.6, 1.0, 2.2), (-4.2, -15.2, 1.25, -1.0), (-4.4, -17.6, 0.9, 3.0), (17.9, 17.6, 1.9, 1.3), (1.9, -4.6, 1.7, -2.4), (-14.2, 4.8, 1.3, 0.2)):
    L.live("KL_Butterfly", x, y, h, rz)
for x, y, h, rz in ((13.5, 13.5, 1.16, 2.6), (22.5, 8.5, 1.16, -1.9), (12.5, -13.5, 0.99, 1.2)): L.live("KL_Bird", x, y, h, rz)      # on fence posts
for x, y, h, rz in ((-8.0, 3.0, 11.5, 1.0), (7.0, -9.0, 7.5, -2.2), (-19.0, -14.0, 6.5, 0.2), (21.0, 13.0, 8.0, 2.7)): L.live("KL_Bird_Fly", x, y, h, rz)
cx, cy = (cl.x + ch_.x) / 2, (cl.y + ch_.y) / 2
for k_, (dx, dz, s_) in enumerate(((0.0, 0.35, 1.0), (0.25, 1.3, 1.45), (0.65, 2.5, 1.9))): L.live("KL_Smoke_Puff", cx + dx, cy, ch_.z - Z + dz, 0.8 * k_, s_, world=True)
dock = json.loads(bpy.data.objects["K_Dock"]["kk_dock"])
L.live("KL_Boat", dock["moor"][0], dock["moor"][1], SEA_H, pi, world=True)                                        # a visitor's boat alongside the pier, bow to the island
for x, y, s_ in ((dock["moor"][0] - 1.4, dock["moor"][1] + 2.6, 1.0), (2.1, dock["end"][1] + 1.0, 0.8), (-2.0, dock["from"][1] - 8.2, 0.9)): L.live("KL_Ripple", x, y, SEA_H + 0.006, 0.0, s_, world=True)
# ---- can everything be walked to?
gates = [("gate " + str(list(c)), c) for c in sorted(L.gate)]
paths = [("path cell", c) for c in sorted(L.path)]
inside = [("the paddock", (15, -14)), ("the farm", (13, 7)), ("the bench by the pond", (-10, -12)), ("the picnic table", (4, -17)), ("the well", (-16, 4)), ("the swing", (-11, -19)),
          ("the fountain", (0, -5)), ("the campfire", (-13, 9))]
inside = [(nm, (c[0] + OX, c[1] + OY)) for nm, c in inside]
walked = L.reach((0 + OX, -20 + OY), targets + L.fronts + gates + paths + inside)
SH["kk_opened"] = json.dumps(opened); klayout.show_wild(opened)
bpy.context.view_layer.update()
# ---- the layout as data
R3 = lambda v: round(float(v), 3)
for p in L.pieces: p["x"] = R3(p["x"]); p["z"] = R3(p["z"])
for b_ in L.buildings: b_["x"] = R3(b_["x"]); b_["z"] = R3(b_["z"])
data = {"version": 1, "cell": 1.0, "note": "written by assets/kingdom/blender/passes/k26_showcase.py. A cell is [x, z] of its corner with the lower x and z; a part's cell is that corner of its footprint.",
        "buildings": L.buildings, "paths": L.path_sets, "pond": L.pond_cells, "fences": L.fences, "pieces": L.pieces, "wild": L.wild, "life": L.life, "opened": opened, "origin": {"x": OX, "z": -OY},
        "clear": sorted([i, -(j + 1)] for i, j in L.reserved), "counts": dict(n, life=len(L.life), pieces=len(L.pieces), taken=len(L.solid), path=len(L.path), water=len(L.water), lawn=len(SEC), open=len(L.isl["lawn"]), sections=len(SECTIONS), opened=len(opened))}
out = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom", "kingdom_showcase.json")
if not L.problems: json.dump(data, open(out, "w"), separators=(",", ":"))
show_collection("KINGDOM_LAYOUT_SHOWCASE", True)
report(retired=retired, objects=len(SH.all_objects), tris=sum(tris(o.data) for o in SH.all_objects if o.type == "MESH"), counts=data["counts"], walked=walked,
       opened=opened, problems=L.problems[:40], n_problems=len(L.problems), wrote=None if L.problems else os.path.getsize(out))
