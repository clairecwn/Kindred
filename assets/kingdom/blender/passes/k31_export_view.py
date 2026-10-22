"""Pass 31: the showcase island piece by piece, for the game to draw exactly as it stands in this file.
kingdom_showcase.json says what the showcase is (a house of this size, a path over these cells); putting that together
again in the game belongs to the game phase. Until then the game can show the developed island from this list:
frontend/public/models/env/kingdom/kingdom_view.json, one entry for every object of KINGDOM_LAYOUT_SHOWCASE:
  m  the kit mesh (a node of that name is in kingdom_kit.glb, kingdom_decor_kit.glb, kingdom_house_kit.glb or kingdom_life_kit.glb)
  p  where it stands, in the game's axes (x = Blender x, y = Blender z - lawn, z = -Blender y)
  r  its turn about the up axis, or q: its whole rotation (x, y, z, w) when it also leans
  s  its scale, when it is not 1
  c  colours set on this one object: {material of the kit mesh: colour}. The house's roof, walls, trim and door.
Places are worked out from each object's own numbers and its parent's, so the list is right in a background Blender
even though the showcase collection may be unticked there. Run after k26_showcase; nothing in the file is changed."""
import bpy, os, json
from kk import *
import ktone
from mathutils import Matrix
def world(o):
    m = o.matrix_basis
    return world(o.parent) @ o.matrix_parent_inverse @ m if o.parent else m.copy()
SH = bpy.data.collections["KINGDOM_LAYOUT_SHOWCASE"]; out = []; meshes = set()
for o in sorted(SH.all_objects, key=lambda o: o.name):
    if o.type != "MESH": continue
    loc, rot, sc = world(o).decompose(); e = {"m": o.data.name, "p": [round(loc.x, 3), round(loc.z - Z, 3), round(-loc.y, 3)]}
    if abs(rot.x) < 1e-4 and abs(rot.y) < 1e-4: e["r"] = round(rot.to_euler().z, 4)
    else: e["q"] = [round(rot.x, 5), round(rot.z, 5), round(-rot.y, 5), round(rot.w, 5)]
    if abs(sc.x - 1) > 1e-3: e["s"] = round(sc.x, 3)
    cols = {o.data.materials[i].name: ktone.hex_of(sl.material) for i, sl in enumerate(o.material_slots) if sl.link == "OBJECT" and sl.material and i < len(o.data.materials) and o.data.materials[i]}
    if cols: e["c"] = cols
    out.append(e); meshes.add(o.data.name)
doc = {"version": 1, "note": "written by assets/kingdom/blender/passes/k31_export_view.py: the showcase island piece by piece, for viewing in the game",
       "opened": json.loads(SH.get("kk_opened", "[]")), "meshes": sorted(meshes), "showcase": out}
path = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom", "kingdom_view.json")
json.dump(doc, open(path, "w"), separators=(",", ":"))
report(pieces=len(out), meshes=len(meshes), recoloured=sum(1 for e in out if "c" in e), leaning=sum(1 for e in out if "q" in e), scaled=sum(1 for e in out if "s" in e), opened=doc["opened"], bytes=os.path.getsize(path))
