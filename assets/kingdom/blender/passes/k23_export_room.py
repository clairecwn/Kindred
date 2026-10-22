"""Pass 23: write the interior room kit for the game. frontend/public/models/env/kingdom/kingdom_room_kit.glb holds every
shell and part as a node at the origin named as its mesh (KR_*), and a 1 m sample of every finish so that the finish
materials and their pictures are in the file. kingdom_room_kit.json says how they go together: the rooms and their
walls, the parts with their sizes and facts, the finishes (which are tinted by the material's colour), what the
player recolours, and the example rooms."""
import bpy, os, json, logging
from kk import *
import kroom
OUT = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom"); sc = bpy.context.scene; vl = bpy.context.view_layer
names = sorted(m.name for m in bpy.data.meshes if m.name.startswith("KR_") and m.name != "KR_Display")
tmp = bpy.data.collections.new("KR_EXPORT"); sc.collection.children.link(tmp); objs = []; held = {}
for n in names:
    other = bpy.data.objects.get(n)
    if other: held[other] = n; other.name = n + "__held"
    o = bpy.data.objects.new(n, bpy.data.meshes[n]); tmp.objects.link(o); objs.append(o)
for o in sc.objects:
    try: o.select_set(False)
    except RuntimeError: pass
for o in objs: o.select_set(True)
import kao, kzfix, importlib; importlib.reload(kao); importlib.reload(kzfix)
zf = kzfix.fix_all({o.data for o in objs if not o.data.name.startswith("KR_Room_")})          # no flicker inside a part
zf.update(kzfix.fix_all({o.data for o in objs if o.data.name.startswith("KR_Room_")}, ground=True))   # a room's floor stands on the ground: it must not fight it
for root in [o for o in bpy.data.objects if o.name.startswith("KRX_") and o.type == "EMPTY"]:     # nor where a room's own parts meet
    kzfix.fix_assembly([c for c in root.children_recursive if c.type == "MESH" and c.data.library is None and not c.name.startswith("KRF_")])
kao.bake_all({o.data for o in objs})
vl.objects.active = objs[0]; path = os.path.join(OUT, "kingdom_room_kit.glb"); logging.disable(logging.INFO)
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_cameras=False, export_lights=False, export_extras=False, **kao.EXPORT)
logging.disable(logging.NOTSET)
for o in objs: bpy.data.objects.remove(o, do_unlink=True)
for other, n in held.items(): other.name = n
bpy.data.collections.remove(tmp)
def plain(v):
    if isinstance(v, (int, float, str)): return round(v, 3) if isinstance(v, float) else v
    return [plain(x) for x in v]
def facts(me):
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    d = {"mesh": me.name, "size": [round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2), round(max(zs) - min(zs), 2)], "min": [round(min(xs), 2), round(min(ys), 2), round(min(zs), 2)], "triangles": tris(me)}
    paint = sorted(m.name for m in me.materials if m and m.name.startswith("KV_"))
    if paint: d["recolour"] = paint
    for k_ in me.keys():
        if k_.startswith("kr_"): d[k_[3:]] = plain(me[k_])
    return d
rooms = {}
for n, (W, D) in kroom.ROOMS.items():
    r = facts(bpy.data.meshes["KR_Room_" + n]); r["cells"] = [2 * W, 2 * D]
    r["walls"] = {"back": {"from": [-W / 2, D / 2], "to": [W / 2, D / 2], "turn": 0}, "left": {"from": [-W / 2, -D / 2 + 0.2], "to": [-W / 2, D / 2], "turn": 90}, "right": {"from": [W / 2, -D / 2 + 0.2], "to": [W / 2, D / 2], "turn": -90}}
    r["doormat"] = [0, -D / 2 + 0.45, 0]; r["beam"] = "KR_Beam_%d" % W; rooms[n] = r
parts = {"windows": {n: facts(bpy.data.meshes["KR_Window_" + n]) for n in kroom.WINDOWS}, "wall": {}, "floor": {}, "beams": {str(W): facts(bpy.data.meshes["KR_Beam_%d" % W]) for W in sorted({w for w, d in kroom.ROOMS.values()})}}
for n in kroom.PARTS: parts["floor" if n in ("Stair_Down", "Doormat") else "wall"][n] = facts(bpy.data.meshes["KR_" + n])
fin = {"floor": {}, "wall": {}}
for m in bpy.data.materials:
    if m.name.startswith("KI_fin_"):
        kind, n = m.name[7:].split("_", 1); fin[kind][n] = {"material": m.name, "tint": m.get("ki_hex") if m.get("ki_tint") else None, "sample": "KR_Finish_%s_%s" % (kind, n)}
doc = {"version": 1, "note": "written by assets/kingdom/blender/passes/k23_export_room.py", "height": kroom.H, "wall": kroom.T, "snap": 0.5,
       "view": "a room is seen from its open front (-Y) towards the back wall, like a Grove shop; it has no ceiling",
       "rules": {"wall parts": "drawn with the wall at y = 0 behind them and the room towards -Y; on a wall, turn them by that wall's turn (degrees about the up axis, counter-clockwise seen from above)",
                 "finishes": "swap the material KI_roomFloor for a floor finish and KI_roomWall for a wall finish (or keep KI_roomWall and set its colour, for plain paint). A finish with a tint is a pale picture multiplied by the material's colour: set that colour to repaint it. All floor finishes share one UV scale (2 m) and all wall finishes another (1 m)",
                 "trim": "KI_roomTrim with its _dk and _lt steps is the skirting, the frames and the wall caps; recolour the three together"},
       "rooms": rooms, "houses": {"Shed": ["Shed"], "Cabin": ["Cabin"], "Cottage": ["Cottage"], "House": ["Cottage", "Upper"], "Manor": ["Manor", "Manor", "Upper"]}, "parts": parts, "finishes": fin,
       "furniture": kroom.FURNITURE, "recolour": {"floor": "KI_roomFloor", "wall": "KI_roomWall", "trim": ["KI_roomTrim", "KI_roomTrim_dk", "KI_roomTrim_lt"]},
       "examples": [json.loads(o["kr_example"]) for o in sorted(bpy.data.objects, key=lambda o: o.name) if o.get("kr_example")]}
json.dump(doc, open(os.path.join(OUT, "kingdom_room_kit.json"), "w"), indent=1, sort_keys=True)
report(bytes=os.path.getsize(path), meshes=len(names), triangles=sum(tris(bpy.data.meshes[n]) for n in names))
