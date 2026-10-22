"""Pass 21: write the house kit for the game. frontend/public/models/env/kingdom/kingdom_house_kit.glb holds every part as a
node at the origin, named as its mesh (KH_*). kingdom_house_kit.json says how they go together: for each size the
plot, the body's size and its sockets; which roofs, doors, windows, porches and chimneys there are and which sizes
each fits; the materials a house is recoloured by and the colour choices; and the example houses."""
import bpy, os, json, importlib
from kk import *
import khouse, khparts
from khouse import SIZES, BASE
OUT = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom"); sc = bpy.context.scene; vl = bpy.context.view_layer
names = sorted(m.name for m in bpy.data.meshes if m.name.startswith("KH_") and m.name not in ("KH_Display", "KH_Ground"))
tmp = bpy.data.collections.new("KH_EXPORT"); sc.collection.children.link(tmp); objs = []
for n in names:
    o = bpy.data.objects.new(n + "__export", bpy.data.meshes[n]); tmp.objects.link(o); objs.append(o)
for o in sc.objects:
    try: o.select_set(False)
    except RuntimeError: pass
for o in objs: o.select_set(True)
import kao, kzfix, importlib; importlib.reload(kao); importlib.reload(kzfix)
zf = kzfix.fix_all({o.data for o in objs})                                    # no flicker inside a part
for root in [o for o in bpy.data.objects if o.name.startswith("KHX_") and o.type == "EMPTY"]:     # nor where the parts of a house meet
    kzfix.fix_assembly([c for c in root.children_recursive if c.type == "MESH" and c.data.library is None])
kao.bake_all({o.data for o in objs})
vl.objects.active = objs[0]; path = os.path.join(OUT, "kingdom_house_kit.glb")
for o in objs: o.name = o.data.name
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_cameras=False, export_lights=False, export_extras=False, **kao.EXPORT)
for o in objs: bpy.data.objects.remove(o, do_unlink=True)
bpy.data.collections.remove(tmp)
def dims(me):
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    return [round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2), round(max(zs) - min(zs), 2)]
def lst(v): return [round(x, 3) for x in v]
sizes = {}
for sz, S in SIZES.items():
    me = bpy.data.meshes["KH_Body_" + sz]; w = lst(me["kh_windows"])
    sizes[sz] = {"plot": [S["plot"], S["plot"]], "back": S["back"], "storeys": S["storeys"], "body": lst(me["kh_size"]), "meshes": {"body": "KH_Body_" + sz, "frame": "KH_Frame_" + sz, "timber": "KH_Timber_" + sz},
                 "sockets": {"door": lst(me["kh_door"]), "porch": lst(me["kh_porch"]), "roof": lst(me["kh_roof"]), "windows": [w[i:i + 4] for i in range(0, len(w), 4)]},
                 "roofs": {rn: {"mesh": "KH_Roof_%s_%s" % (rn, sz), "chimney": lst(bpy.data.meshes["KH_Roof_%s_%s" % (rn, sz)]["kh_chimney"])} for rn in khouse.ROOFS}}
fits = {"Door": {"Double": ["Cottage", "House", "Manor"]}, "Porch": {"Deck": ["Cabin", "Cottage", "House", "Manor"]}}
parts = {}
for group, table in (("Door", khparts.DOORS), ("Window", khparts.WINDOWS), ("Porch", khparts.PORCHES), ("Chimney", khparts.CHIMNEYS)):
    parts[{"Door": "doors", "Window": "windows", "Porch": "porches", "Chimney": "chimneys"}[group]] = {n: {"mesh": "KH_%s_%s" % (group, n), "sizes": fits.get(group, {}).get(n, list(SIZES))} for n in table}
parts["extras"] = {n: {"mesh": "KH_" + n} for n in khparts.EXTRAS}
parts["whole"] = {n: {"mesh": "KH_" + n, "cells": [cw, cd]} for n, (fn, cw, cd) in khparts.WHOLE.items()}
recolour = {"roof": ["KI_roofA", "KI_roofB", "KI_roofC"], "wall": ["KI_wallA", "KI_wallA_dk"], "trim": ["KI_trimA", "KI_trimA_dk", "KI_trimA_lt"],
            "door": ["KI_doorA", "KI_doorA_dk", "KI_doorA_lt"], "plinth": ["KI_wallC", "KI_wallC_dk", "KI_wallC_lt"]}
examples = [json.loads(o["kh_example"]) for o in sorted(bpy.data.objects, key=lambda o: o.name) if o.get("kh_example")]
doc = {"version": 1, "note": "written by assets/kingdom/blender/passes/k21_export_house.py", "base": BASE, "sizes": sizes, "parts": parts,
       "recolour": recolour, "colours": khouse.COLOURS,
       "steps": {"lt": "lighter step of the chosen colour", "dk": "darker step of the chosen colour"}, "examples": examples,
       "meshes": {n: {"size": dims(bpy.data.meshes[n]), "triangles": tris(bpy.data.meshes[n])} for n in names}}
json.dump(doc, open(os.path.join(OUT, "kingdom_house_kit.json"), "w"), indent=1, sort_keys=True)
report(bytes=os.path.getsize(path), parts=len(names), triangles=sum(tris(bpy.data.meshes[n]) for n in names))
