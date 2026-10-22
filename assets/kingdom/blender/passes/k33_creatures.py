"""Pass 33: the rigged creatures (kcreatures.py has the rules). For every creature: builds its armature and skinned
mesh in KINGDOM_CREATURES (south of the life kit, y = -332), writes its posed stills into the life kit's meshes
(KL_Cow, KL_Cow_Graze, ...: the gallery and the showcase keep using those), bakes its clips onto NLA tracks, and
exports frontend/public/models/env/kingdom/creatures/<name>.glb (the armature, the mesh and one animation per clip) and
creatures.json (each creature's clips, how fast it walks, which life kit meshes it stands in for)."""
import bpy, os, json, logging, importlib
from math import sin, pi
from kk import *
import ktone; importlib.reload(ktone)
import klife; importlib.reload(klife)
import kcreatures; importlib.reload(kcreatures)
OUT = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom", "creatures"); os.makedirs(OUT, exist_ok=True)
coll = ccol("KINGDOM_CREATURES"); show_collection("KINGDOM_CREATURES", True)
only = (NS.get("kk_args") or {}).get("only")
doc = {"version": 1, "note": "written by assets/kingdom/blender/passes/k33_creatures.py", "fps": kcreatures.FPS, "creatures": {}}
old = os.path.join(OUT, "creatures.json")
if os.path.exists(old): doc["creatures"] = json.load(open(old)).get("creatures", {})
# walking speed (m/s) that keeps the feet from sliding: the ground a foot sweeps while it is down (2 x leg x sin(swing)),
# over the time it is down (the stance share of one stride)
SPEED = {"Cow": 0.51, "Pony": 0.7, "Sheep": 0.47, "Cat": 0.35, "Chicken": 0.5, "Chick": 0.24, "Duck": 0.44, "Bird": 0.5, "Butterfly": 0.6}
made = {}; x = -14.0
for name, make in kcreatures.RIGS.items():
    if only and name not in only: continue
    rig = make(); arm, ob = kcreatures.assemble(rig, coll)
    for still, (clip, t) in rig.statics.items(): kcreatures.static(arm, ob, rig.clips[clip][1], t, still)
    kcreatures.bake(arm, rig)
    # export with the armature at the origin
    arm.location = (0, 0, 0); bpy.context.view_layer.update()
    for o in bpy.context.view_layer.objects:
        try: o.select_set(False)
        except RuntimeError: pass
    arm.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = arm
    path = os.path.join(OUT, name.lower() + ".glb")
    logging.disable(logging.INFO)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=False, export_skins=True, export_animations=True,
                              export_animation_mode="NLA_TRACKS", export_force_sampling=True, export_cameras=False, export_lights=False, export_extras=False)
    logging.disable(logging.NOTSET)
    arm.location = (x, -332.0, 0.0); x += 3.0
    xs = [v.co.x for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
    doc["creatures"][name] = {"file": "creatures/" + name.lower() + ".glb", "clips": {c: round(s_, 3) for c, (s_, f_) in rig.clips.items()},
                              "stands_for": sorted(rig.statics), "height": round(max(zs) - min(zs), 2), "triangles": tris(ob.data),
                              "bones": len(rig.order), "speed": SPEED.get(name)}
    made[name] = os.path.getsize(path)
json.dump(doc, open(old, "w"), indent=1, sort_keys=True)
# the life kit's display rows, spaced again for the new stills (k27 spaced them for the old ones)
for names, y0 in ((["Pony", "Pony_Graze", "Cow", "Cow_Graze", "Sheep", "Sheep_Graze"], -320.0), (["Chicken", "Chicken_Peck", "Chick", "Duck", "Cat_Sit", "Bird", "Bird_Fly", "Butterfly", "Butterfly_Body", "Butterfly_Wing", "Smoke_Puff"], -324.0)):
    x = -14.0
    for n in names:
        o = bpy.data.objects.get("KLP_" + n)
        if not o: continue
        xs = [v.co.x for v in o.data.vertices]; w = max(max(xs) - min(xs), 0.5)
        o.location.x = x + w / 2 - (max(xs) + min(xs)) / 2; x += w + (1.4 if y0 == -320.0 else 0.9)
bpy.context.view_layer.update()
report(made=made, creatures={k: (v["clips"], v["triangles"]) for k, v in doc["creatures"].items() if k in made})
