"""Pictures of the item displays standing in the Grove's shops, to judge them before the game draws them.
Run in a background Blender on grove_master_refined.blend and NEVER save: it copies the stands and the item models
in from kindred_items.blend, sets them out as shop_displays.json says and renders each shop from the game's camera.
    job step: {"code": "exec(open('.../i40_shop_preview.py').read())"}   (see assets/grove/blender/mario/bg.py)
Pictures go to _to_delete/shop_preview/<shop>.jpg. Options in bpy.app.driver_namespace["i40"]: shops, size, engine, wide."""
import bpy, json, os, colorsys
from math import pi, radians
from mathutils import Vector, Matrix
ROOT = "/Users/clairewn/Downloads/Kindred"; OUT = ROOT + "/_to_delete/shop_preview"; os.makedirs(OUT, exist_ok=True)
opt = bpy.app.driver_namespace.get("i40") or {}
doc = json.load(open(ROOT + "/frontend/public/models/items/shop_displays.json")); items = json.load(open(ROOT + "/frontend/public/models/items/items.json"))["items"]
PAL = {"green": "#43B047", "terracotta": "#F29A4A", "red": "#E52521", "blue": "#049CD8", "purple": "#8B5FD9", "gold": "#FFB91F", "rose": "#F45C8C", "teal": "#1CC7B5", "sky": "#4FB4F0", "orange": "#FF8A2A", "leaf_dark": "#2E9A45"}
shops = opt.get("shops") or list(doc["shops"])
need = {"SD_" + n[3:] if False else n for n in ()}
names = set(doc["stands"]) | {"SD_Hook", "SD_Board", "SD_Tag"}
for s in shops: names |= {"IT_" + items[i]["model"] for i in doc["shops"][s]["spots"]}
with bpy.data.libraries.load(ROOT + "/assets/items/blender/kindred_items.blend", link=False) as (src, dst):
    dst.meshes = [n for n in src.meshes if n in names]
ME = {m.name: m for m in dst.meshes if m}
missing = sorted(names - set(ME))
def srgb(h): h = h.lstrip("#"); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
def lin(c): return [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
def shade(rgb, kind):
    h, s, v = colorsys.rgb_to_hsv(*rgb)
    def toward(h, t, k): d = ((t - h + 0.5) % 1.0) - 0.5; return (h + max(-k, min(k, d))) % 1.0
    if kind == "lt": h, s, v = toward(h, 50 / 360, 0.035), s * 0.8, v + (1 - v) * 0.5
    elif kind == "dk": h, s, v = toward(h, 265 / 360, 0.02), min(1.0, s * 1.06 + 0.02), v * 0.8
    return colorsys.hsv_to_rgb(h, s, v)
def accent(m, colour):
    """A copy of a paint material in the shop's colour."""
    kind = m.name[-2:] if m.name.endswith(("_dk", "_lt")) else None; n = "PV_%s_%s" % (colour, kind or "main"); c = bpy.data.materials.get(n)
    if c is None:
        c = m.copy(); c.name = n; col = lin(shade(srgb(PAL[colour]), kind)); c.diffuse_color = (*col, 1)
        p = c.node_tree.nodes.get("Principled BSDF") if c.use_nodes else None
        if p: p.inputs["Base Color"].default_value = (*col, 1)
    return c
coll = bpy.data.collections.new("SHOP_DISPLAY_PREVIEW"); bpy.context.scene.collection.children.link(coll); count = 0
def put(mesh, base, e, colour=None):
    global count
    o = bpy.data.objects.new("PV_" + mesh, ME[mesh]); coll.objects.link(o); count += 1
    o.matrix_world = base @ Matrix.Translation((e["x"], e["y"], e.get("z", 0))) @ Matrix.Rotation(e.get("rz", 0), 4, "Z")
    if colour:
        for sl in o.material_slots:
            if sl.material and sl.material.name.startswith("KV_A_teal"): m = accent(sl.material, colour); sl.link = "OBJECT"; sl.material = m
    return o
bases = {}
for s in shops:
    d = doc["shops"][s]; g = d["game"]; base = Matrix.Translation((g["x"], -g["z"], d["floor"] * 5 + 0.03)) @ Matrix.Rotation(pi if g["k"] > 0 else 0.0, 4, "Z"); bases[s] = base
    for e in d["stands"]: put(e["stand"], base, e, d["accent"])
    for e in d["extras"]: put(e["mesh"], base, e, d["accent"])
    for id, e in d["spots"].items(): put("IT_" + items[id]["model"], base, e)
for o in bpy.data.objects:
    if "_Front_Canopy" in o.name: o.hide_render = True
bpy.context.view_layer.update()
sc = bpy.context.scene; cam = bpy.data.cameras.new("_pv_cam"); ob = bpy.data.objects.new("_pv_cam", cam); sc.collection.objects.link(ob); sc.camera = ob
cam.sensor_fit = "VERTICAL"; cam.angle_y = radians(50); cam.clip_start = 0.05; cam.clip_end = 400
W, H = opt.get("size", (960, 540)); r = sc.render; r.resolution_x, r.resolution_y, r.resolution_percentage = W, H, 100
if opt.get("engine"): r.engine = opt["engine"]
r.image_settings.file_format = "JPEG"; r.image_settings.quality = 86; made = []
for s in shops:
    d = doc["shops"][s]; base = bases[s]; st = d["stands"][0]; views = [("", (st["x"], st["y"] - 1.25))]
    if opt.get("wide"): views.append(("_wide", (0.0, -0.6)))
    for tag, (px, py) in views:
        eye = base @ Vector((px, py - 6.6, 4.1)); tgt = base @ Vector((px, py, 1.15)); ob.location = eye; ob.rotation_euler = (tgt - eye).to_track_quat("-Z", "Y").to_euler()
        r.filepath = "%s/%s%s.jpg" % (OUT, s, tag); bpy.ops.render.render(write_still=True); made.append(r.filepath)
result = {"placed": count, "missing": missing, "made": len(made), "engine": r.engine}
