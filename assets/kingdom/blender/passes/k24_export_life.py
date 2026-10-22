"""Pass 24: write the life kit for the game. frontend/public/models/env/kingdom/kingdom_life_kit.glb holds every part as a
node at the origin, named as its mesh (KL_*). kingdom_life_kit.json says what each part is: its group, its size, the
paint the player or the game can change, and the facts its builder gave (kind, home, pose, floats, hinge, seats)."""
import bpy, os, json, logging
from kk import *
import klife
OUT = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom"); sc = bpy.context.scene; vl = bpy.context.view_layer
names = ["KL_" + n for n, fn, g in klife.KIT]
missing = [n for n in names if n not in bpy.data.meshes]
if missing: raise RuntimeError("run k27_life_kit first; missing " + ", ".join(missing[:5]))
tmp = bpy.data.collections.new("KL_EXPORT"); sc.collection.children.link(tmp); objs = []
for n in names:
    o = bpy.data.objects.new(n + "__export", bpy.data.meshes[n]); tmp.objects.link(o); objs.append(o)
for o in sc.objects:
    try: o.select_set(False)
    except RuntimeError: pass
for o in objs: o.select_set(True)
vl.objects.active = objs[0]; path = os.path.join(OUT, "kingdom_life_kit.glb")
held = {}                              # a display object may hold a part's own name; lend it to the export copy for the write
for o in objs:
    other = bpy.data.objects.get(o.data.name)
    if other and other is not o: held[other] = other.name; other.name = other.name + "__held"
    o.name = o.data.name
logging.disable(logging.INFO)
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_cameras=False, export_lights=False, export_extras=False)
logging.disable(logging.NOTSET)
for o in objs: bpy.data.objects.remove(o, do_unlink=True)
for other, nm in held.items(): other.name = nm
bpy.data.collections.remove(tmp)
def plain(v):
    if isinstance(v, (bool, int, float, str)): return round(v, 3) if isinstance(v, float) else v
    return [plain(x) for x in v]
parts = {}
for n in names:
    me = bpy.data.meshes[n]; xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    d = {"group": me["kl_group"], "size": [round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2), round(max(zs) - min(zs), 2)],
         "min": [round(min(xs), 2), round(min(ys), 2), round(min(zs), 2)], "triangles": tris(me)}
    paint = sorted(m.name for m in me.materials if m and m.name.startswith("KV_"))
    if paint:
        d["recolour"] = paint; d["paint"] = {}
        for m in paint: d["paint"].setdefault(m.split("_")[1], m.split("_")[2])
    for k_ in me.keys():
        if k_.startswith("kl_") and k_ != "kl_group": d[k_[3:]] = plain(me[k_])
    if "floats" in d: d["floats"] = bool(d["floats"])
    parts[n] = d
poses = {}
for n in names:                         # KL_Pony and KL_Pony_Graze are one creature in two poses
    base = n.rsplit("_", 1)[0] if parts[n].get("pose") not in (None, "stand", "perch", "sit") else n
    if parts[n].get("kind") in ("animal", "flier"): poses.setdefault(base, {})[parts[n].get("pose", "stand")] = n
rules = {"frame": "the ground (the water line for a part that floats) is at 0, the part's middle is at the origin, its front looks to -Blender Y",
         "poses": "a creature that does more than stand has one mesh for each pose; the game swaps them and moves the whole mesh",
         "wings": "KL_Butterfly_Wing is the right wing with its hinge on the origin along Y; draw it twice on KL_Butterfly_Body, the second mirrored in X, and turn the two about Y to flap",
         "paint": "KV_A_<colour> is the coat, wing or hull; KV_B_<colour> the patches, spots or stripe; _dk and _lt are their steps",
         "water": "the sea's surface is 2.15 m below the lawn; a pond's is 0.07 m above it"}
doc = {"version": 1, "note": "written by assets/kingdom/blender/passes/k24_export_life.py", "rules": rules, "creatures": poses,
       "groups": {g: ["KL_" + n for n, fn, gg in klife.KIT if gg == g] for g in dict.fromkeys(g for n, fn, g in klife.KIT)}, "parts": parts}
json.dump(doc, open(os.path.join(OUT, "kingdom_life_kit.json"), "w"), indent=1, sort_keys=True)
report(bytes=os.path.getsize(path), parts=len(parts), triangles=sum(p["triangles"] for p in parts.values()), creatures=poses)
