"""Pass 3: plants. Trees, flowers, crops, grass and clouds were piles of separate primitives (a flower was 8 objects,
a crown 5 balls, a pumpkin 7). Each is now one kit mesh, and every repeat is an instance of the same mesh, placed
where Codex's was and at its size."""
import bpy, re, importlib, collections
from kk import *
import kplants; importlib.reload(kplants)
K = kplants.build_all()
sc = bpy.context.scene
def groups(coll, rx):
    g = collections.OrderedDict()
    for o in sorted(C(coll).objects, key=lambda o: o.name):
        m = re.match(rx, o.name)
        if m: g.setdefault(m.group(1), []).append(o)
    return g
def base(objs, key):
    lo, hi = world_bb([o for o in objs if key in o.name][:1] or objs)
    return (lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z
old = []; n = collections.Counter()
# trees
for i, (k, objs) in enumerate(groups("KINGDOM_TREES", r"((?:Island_tree|Orchard)_\d+)_").items()):
    x, y, z = base(objs, "trunk"); lo, hi = world_bb(objs)
    me = K["KK_Tree_Citrus"] if k.startswith("Orchard") else K["KK_Tree_Round"]
    put("K_" + k.replace("Island_tree", "Tree"), me, "KINGDOM_TREES", (x, y, Z), rz=(i * 1.7) % 1.2 - 0.6, sc=(hi.z - Z) / kplants.TREE_H)
    old += objs; n["trees"] += 1
for i, (k, objs) in enumerate(groups("KINGDOM_BACKDROP", r"(Distant_Tree_\d+_\d+)_").items()):
    x, y, z = base(objs, "trunk")
    put("K_" + k, K["KK_Tree_Round_Far"], "KINGDOM_BACKDROP", (x, y, z), rz=(i * 2.3) % tau, sc=1.0)
    old += objs; n["far_trees"] += 1
# garden flowers: one colour per bed
for i, (k, objs) in enumerate(groups("KINGDOM_GARDEN", r"(Garden_\d+_\d+)_").items()):
    x, y, z = base(objs, "stem"); col = [o for o in objs if "petal" in o.name][0].data.materials[0].name[3:]
    put("K_Flower_" + k[7:], K["KK_Flower_" + col], "KINGDOM_GARDEN", (x, y, z - 0.01), rz=(i * 2.4) % tau, sc=0.62 + 0.05 * ((i * 7) % 3 - 1))
    old += objs; n["flowers"] += 1
# window-box flowers
stems = sorted((o for o in C("KINGDOM_GARDEN").objects if o.name.startswith("Window_flower_stem")), key=lambda o: o.matrix_world.translation.x)
for i, o in enumerate(stems):
    lo, hi = wbb(o)
    put("K_WindowFlower_%02d" % i, K["KK_Flower_" + ("pink", "yellow", "white")[i % 3]], "KINGDOM_GARDEN", ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z - 0.01), rz=(i * 1.9) % tau, sc=0.36)
    n["window_flowers"] += 1
old += [o for o in C("KINGDOM_GARDEN").objects if o.name.startswith("Window_flower_")]
# crops: six to a bed
KIND = {"0": "Carrot", "1": "Cabbage", "2": "Pumpkin"}
for o in sorted(C("KINGDOM_FARM").objects, key=lambda o: o.name):
    m = re.match(r"Plot_(\d+)_(\d+)_soil$", o.name)
    if not m: continue
    lo, hi = wbb(o); cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2; kind = KIND[m.group(1)]; j = 0
    for dx in (-0.6, 0.0, 0.6):
        for dy in (-0.3, 0.3):
            put("K_%s_%s_%s_%d" % (kind, m.group(1), m.group(2), j), K["KK_Crop_" + kind], "KINGDOM_FARM", (cx + dx, cy + dy, hi.z - 0.005),
                rz=(j * 2.1 + int(m.group(2))) % tau, sc=0.94 + 0.04 * (j % 3))
            j += 1; n["crops"] += 1
old += [o for o in C("KINGDOM_FARM").objects if re.match(r"Plot_\d+_\d+_(carrot|cabbage|pumpkin|stem)", o.name)]
# grass: three loose blades made one tuft
blades = sorted((o for o in C("KINGDOM_TREES").objects if o.name.startswith("Shore_grass")), key=lambda o: o.name)
for i in range(0, len(blades), 3):
    lo, hi = world_bb(blades[i:i + 3])
    put("K_Grass_%02d" % (i // 3), K["KK_Grass_Tuft"], "KINGDOM_TREES", ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z + 0.03), rz=(i * 0.9) % tau, sc=0.95 + 0.1 * ((i // 3) % 3))
    n["grass"] += 1
old += blades
# clouds
for k, objs in groups("KINGDOM_BACKDROP", r"(Cloud_\d+)_").items():
    lo, hi = world_bb(objs)
    put("K_" + k, K["KK_Cloud"], "KINGDOM_BACKDROP", ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2 - 0.3), sc=(hi.x - lo.x) / 3.9)
    old += objs; n["clouds"] += 1
n["retired"] = supersede(old)
report(placed=dict(n), kit_tris={k: tris(v) for k, v in K.items()})
