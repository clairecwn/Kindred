"""Pass 22: write the outdoor decor kit for the game. frontend/public/models/env/kingdom/kingdom_decor_kit.glb holds every
part as a node at the origin, named as its mesh (KD_*). kingdom_decor_kit.json says what each part is: its group, the
cells it takes, its size, the paint the player can change and the facts its builder gave (soil, seat, light, walk,
clear, hinge). It also names the sets that are laid by rule (paths, fences, pond) and states the rules."""
import bpy, os, json
from kk import *
import kdecor
OUT = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom"); sc = bpy.context.scene; vl = bpy.context.view_layer
names = ["KD_" + n for n, fn, g, c in kdecor.KIT]
missing = [n for n in names if n not in bpy.data.meshes]
if missing: raise RuntimeError("run k17_decor_kit first; missing " + ", ".join(missing[:5]))
tmp = bpy.data.collections.new("KD_EXPORT"); sc.collection.children.link(tmp); objs = []
for n in names:
    o = bpy.data.objects.new(n + "__export", bpy.data.meshes[n]); tmp.objects.link(o); objs.append(o)
import kwater, importlib; importlib.reload(kwater)
waters = [w for o in objs for w in kwater.attach(o, tmp, o.data.name)]      # the moving water (the Grove's rig) as children of its part
for o in sc.objects:
    try: o.select_set(False)
    except RuntimeError: pass
for o in objs + waters: o.select_set(True)
import kao, kzfix, importlib; importlib.reload(kao); importlib.reload(kzfix)
zf = kzfix.fix_all({o.data for o in objs})                                    # no flicker (kzfix.py)
kao.bake_all({o.data for o in objs})
vl.objects.active = objs[0]; path = os.path.join(OUT, "kingdom_decor_kit.glb")
held = {}                              # a display object may hold a part's own name; lend it to the export copy for the write
for o in objs:
    other = bpy.data.objects.get(o.data.name)
    if other and other is not o: held[other] = other.name; other.name = other.name + "__held"
    o.name = o.data.name
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_cameras=False, export_lights=False, export_extras=False, **kao.EXPORT)
for o in waters + objs: bpy.data.objects.remove(o, do_unlink=True)
for other, nm in held.items(): other.name = nm
bpy.data.collections.remove(tmp)
def plain(v):
    if isinstance(v, (int, float, str)): return round(v, 3) if isinstance(v, float) else v
    return [plain(x) for x in v]
parts = {}
for n in names:
    me = bpy.data.meshes[n]; xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    d = {"group": me["kd_group"], "cells": plain(me["kd_cells"]), "size": [round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2), round(max(zs) - min(zs), 2)],
         "min": [round(min(xs), 2), round(min(ys), 2), round(min(zs), 2)], "triangles": tris(me)}
    paint = sorted(m.name for m in me.materials if m and m.name.startswith("KV_"))
    if paint:
        d["recolour"] = paint; d["paint"] = {}
        for m in paint:
            ch, col = m.split("_")[1], m.split("_")[2]
            if not m.endswith(("_dk", "_lt")) or col not in d["paint"].get(ch, ""): d["paint"].setdefault(ch, col)
    for k_ in me.keys():
        if k_.startswith("kd_") and k_ not in ("kd_group", "kd_cells"): d[k_[3:]] = plain(me[k_])
    parts[n] = d
sets = {"paths": {t: {"tile": "KD_Path_" + t, "edge": "KD_Path_%s_Edge" % t, "corner": "KD_Path_%s_Corner" % t} for t in ("Stone", "Brick", "Wood", "Sand")},
        "fences": {t: {"post": "KD_Fence_%s_Post" % t, "rail": "KD_Fence_%s_Rail" % t} for t in ("Picket", "Ranch", "Wall", "Hedge", "Rope")},
        "gates": {t: {"posts": "KD_Gate_" + t, "leaf": "KD_Gate_%s_Leaf" % t, "hinge": plain(bpy.data.meshes["KD_Gate_" + t]["kd_hinge"])} for t in ("Picket", "Ranch")},
        "pond": {"tile": "KD_Pond_Water", "edge": "KD_Pond_Edge", "corner": "KD_Pond_Corner", "inner": "KD_Pond_Inner", "water": kdecor.WATER}}
sets["paths"]["Step"] = {"tile": "KD_Path_Step"}
rules = {"turns": "a quarter turn is 90 degrees about the up axis, counter-clockwise seen from above",
         "edge": "drawn on the -Y side of its cell; 0, 1, 2, 3 quarter turns bring it to the -Y, +X, +Y, -X side",
         "corner": "drawn on the (-X, -Y) corner; with the turn of a side it sits between that side and the side one turn before it",
         "paths": "a tile in every path cell; an edge on each side with no path next to it (any surface counts); a corner where two such sides meet",
         "pond": "as paths; and an inner piece where two neighbouring sides are water but the cell diagonally between them is not",
         "fences": "a post in every fence cell; one rail towards each neighbouring fence, gate or arch. The rail is drawn towards +X; 0, 1, 2, 3 quarter turns point it at +X, +Y, -X, -Y",
         "gates": "a gate takes one cell and lies along X; its leaf is a separate part placed at the hinge, to swing about the up axis",
         "paint": "materials KV_A_<colour> (main) and KV_B_<colour> (accent), with _dk and _lt steps, are the paint of a part; recolour them on the one object and keep the steps"}
doc = {"version": 1, "note": "written by assets/kingdom/blender/passes/k22_export_decor.py", "cell": CELL, "rules": rules, "sets": sets,
       "groups": {g: ["KD_" + n for n, fn, gg, c in kdecor.KIT if gg == g] for g in dict.fromkeys(g for n, fn, g, c in kdecor.KIT)}, "parts": parts}
json.dump(doc, open(os.path.join(OUT, "kingdom_decor_kit.json"), "w"), indent=1, sort_keys=True)
report(bytes=os.path.getsize(path), parts=len(names), triangles=sum(p["triangles"] for p in parts.values()), painted=sum(1 for p in parts.values() if "paint" in p))
