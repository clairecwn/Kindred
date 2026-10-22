"""Pass 34: the animals, second build (kanimals.py has the rules; creatures not rebuilt there yet come from kcreatures).
Same outputs as k33: the armature and skinned mesh in KINGDOM_CREATURES, the posed stills written into the life kit
meshes, the clips baked onto NLA tracks, frontend/public/models/env/kingdom/creatures/<name>.glb and creatures.json.
kk_args: only=[names] to build some of them."""
import bpy, os, json, logging, importlib
from kk import *
import ktone; importlib.reload(ktone)
import klife; importlib.reload(klife)
import kcreatures; importlib.reload(kcreatures)
import kanimals; importlib.reload(kanimals)
OUT = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom", "creatures"); os.makedirs(OUT, exist_ok=True)
coll = ccol("KINGDOM_CREATURES"); show_collection("KINGDOM_CREATURES", True)
only = (NS.get("kk_args") or {}).get("only")
path_json = os.path.join(OUT, "creatures.json")
doc = json.load(open(path_json)) if os.path.exists(path_json) else {"version": 1, "creatures": {}}
doc["note"] = "written by assets/kingdom/blender/passes/k34_animals.py"; doc["fps"] = kanimals.FPS
# walking speed (m/s) that keeps the feet from sliding: the ground a foot sweeps while it is down, over the time it is down
SPEED = {"Cow": 0.5, "Pony": 0.66, "Sheep": 0.45, "Cat": 0.35, "Chicken": 0.45, "Chick": 0.24, "Duck": 0.4, "Bird": 0.5, "Butterfly": 0.6}
made = {}; order = list(dict.fromkeys(list(kcreatures.RIGS) + list(kanimals.RIGS)))
for i, name in enumerate(order):
    if only and name not in only: continue
    mod = kanimals if name in kanimals.RIGS else kcreatures
    rig = mod.RIGS[name]()
    arm, ob = mod.assemble(rig, coll)
    for still, (clip, t) in rig.statics.items():
        if mod is kanimals: mod.static(arm, ob, rig.clips[clip][1], t, still, clip)
        else: mod.static(arm, ob, rig.clips[clip][1], t, still)
    if mod is kanimals: mod.bake(arm, rig, ob)
    else: mod.bake(arm, rig)
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
    arm.location = (-14.0 + 3.0 * i, -332.0, 0.0)
    zs = [v.co.z for v in ob.data.vertices]
    doc["creatures"][name] = {"file": "creatures/" + name.lower() + ".glb", "clips": {c: round(s_, 3) for c, (s_, f_) in rig.clips.items()},
                              "stands_for": sorted(rig.statics), "height": round(max(zs) - min(zs), 2), "triangles": tris(ob.data),
                              "bones": len(rig.order), "speed": SPEED.get(name), "build": "clay" if mod is kanimals else "parts"}
    made[name] = os.path.getsize(path)
json.dump(doc, open(path_json, "w"), indent=1, sort_keys=True)
bpy.context.view_layer.update()
report(made=made, creatures={k: (v["clips"], v["triangles"], v["build"]) for k, v in doc["creatures"].items() if k in made})
