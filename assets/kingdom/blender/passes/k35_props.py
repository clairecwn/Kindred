"""Pass 35: the camp pieces that move (kprops.py has the rules). Builds each rigged piece in KINGDOM_CREATURES,
bakes its loop and exports frontend/public/models/env/kingdom/props/<name>.glb and props.json (which kit mesh each one takes
the place of, and its loop)."""
import bpy, os, json, logging, importlib
from kk import *
import ktone; importlib.reload(ktone)
import kcrops; importlib.reload(kcrops)
import kcamp; importlib.reload(kcamp)
import kanimals; importlib.reload(kanimals)
import kprops; importlib.reload(kprops)
import kdecor; importlib.reload(kdecor)
import kdprops; importlib.reload(kdprops)
import kao; importlib.reload(kao)
OUT = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom", "props"); os.makedirs(OUT, exist_ok=True)
coll = ccol("KINGDOM_CREATURES"); show_collection("KINGDOM_CREATURES", True)
doc = {"version": 1, "note": "written by assets/kingdom/blender/passes/k35_props.py", "props": {}}
STANDS = {"Campfire": "KK_Campfire", "Tent": "KK_Tent", "Flame": None}; STANDS.update(kdprops.STANDS)
made = {}
for i, (name, make) in enumerate(kprops.PROPS.items()):
    rig, weights, loop = make()
    arm, ob = kprops.assemble(rig, coll, weights); kanimals.bake(arm, rig)
    arm.location = (0, 0, 0); bpy.context.view_layer.update()
    import kzfix; kzfix.fix_mesh(ob.data)                                       # no flicker (kzfix.py)
    if name not in ("Flame",): kao.bake(ob.data)                                  # the same soft corner shadows as the kit it stands in for
    for o in bpy.context.view_layer.objects:
        try: o.select_set(False)
        except RuntimeError: pass
    arm.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = arm
    path = os.path.join(OUT, name.lower() + ".glb")
    logging.disable(logging.INFO)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=False, export_skins=True, export_animations=True,
                              export_animation_mode="NLA_TRACKS", export_force_sampling=True, export_cameras=False, export_lights=False, export_extras=False, **kao.EXPORT)
    logging.disable(logging.NOTSET)
    arm.location = (16.0 + 6.0 * i, -332.0, 0.0)
    doc["props"][name] = {"file": "props/" + name.lower() + ".glb", "stands_for": STANDS[name], "loop": loop, "secs": rig.clips[loop][0],
                          "fire": name == "Campfire", "triangles": tris(ob.data), "bones": len(rig.order)}
    if name == "Campfire": doc["props"][name]["flame"] = "Flame"                    # drawn on top, turned to face the viewer
    if name == "Flame": doc["props"][name]["billboard"] = True
    made[name] = os.path.getsize(path)
json.dump(doc, open(os.path.join(OUT, "props.json"), "w"), indent=1, sort_keys=True)
report(made=made, props=doc["props"])
