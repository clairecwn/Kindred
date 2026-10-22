"""Pass 20: write the item models for the game, to frontend/public/models/items/. One file per shop (items_<shop>.glb), so a shop
loads only its own stock; each item is a node at the origin named by its Grove id. items.json lists every id that can
be bought: which file and node it is, its type, cells, size, the parts that can be recoloured and their default
colours, and anything else the builder declared (seat, surface, stand). An item sold in two shops is listed twice and
points at one model. Run with save=False."""
import bpy, os, json, sys, importlib
sys.path.insert(0, "/Users/clairewn/Downloads/Kindred/assets/kingdom/blender/passes")
import kao; importlib.reload(kao)
from ii import *
import ii
OUT = os.path.join(ROOT, "frontend", "public", "models", "items"); os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene; vl = bpy.context.view_layer
tmp = bpy.data.collections.new("ITEMS_EXPORT"); sc.collection.children.link(tmp)
meshes = sorted([m for m in bpy.data.meshes if m.name.startswith("IT_") and m.get("ki_id")], key=lambda m: m.name)
shops = sorted({m["ki_shop"] for m in meshes}); files = {}; items = {}
for shop in shops:
    objs = []
    for me in [m for m in meshes if m["ki_shop"] == shop]:
        o = bpy.data.objects.new(me["ki_id"], me); tmp.objects.link(o); objs.append(o)
    for o in sc.objects:
        try: o.select_set(False)
        except RuntimeError: pass
    for o in objs: o.select_set(True)
    import kzfix; importlib.reload(kzfix); kzfix.fix_all({o.data for o in objs})      # no flicker (kingdom passes kzfix.py)
    kao.bake_all({o.data for o in objs})
    vl.objects.active = objs[0]; name = "items_%s.glb" % shop; path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_cameras=False, export_lights=False, export_extras=False, **kao.EXPORT)
    files[shop] = {"file": name, "bytes": os.path.getsize(path), "items": len(objs)}
    for o in objs:
        me = o.data; lo, hi = bounds(me); rec = {}
        for m in me.materials:
            if m and m.name.startswith("KV_") and not m.name.endswith(("_lt", "_dk")): rec[m.name[3]] = {"material": m.name, "color": m["ki_hex"]}
        e = {"model": me["ki_id"], "file": name, "shop": shop, "label": me["ki_label"], "type": me["ki_type"], "cells": [round(c, 3) for c in me["ki_cells"]],
             "size": [round(v, 3) for v in (hi - lo)], "min": [round(v, 3) for v in lo], "triangles": tris(me), "recolour": rec}
        for k in me.keys():
            if k.startswith("ki_") and k[3:] not in ("id", "shop", "label", "type", "cells"):
                v = me[k]; e[k[3:]] = v if isinstance(v, (str, int, float)) else [round(x, 3) for x in v]
        items[me["ki_id"]] = e
    for o in objs: bpy.data.objects.remove(o, do_unlink=True)
bpy.data.collections.remove(tmp)
for o in bpy.data.objects:                         # ids sold a second time in another shop
    id = o.get("ki_id")
    if o.name.startswith("ITEM_") and id and id not in items:
        src = items[o.data["ki_id"]]; items[id] = dict(src, shop=o["sr_row"], label=src["label"])
json.dump({"version": 1, "note": "written by assets/items/blender/passes/i20_export.py", "shops": files, "items": items},
          open(os.path.join(OUT, "items.json"), "w"), indent=1, sort_keys=True)
report(files={k: v["bytes"] for k, v in files.items()}, total=sum(v["bytes"] for v in files.values()), items=len(items))
