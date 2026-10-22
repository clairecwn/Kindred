"""Pass 22: write the shop display kit for the game: frontend/public/models/items/shop_display_kit.glb, every stand a node at
the origin named SD_<name>. Where the stands go in each shop is in shop_displays.json, written by
assets/items/shop_displays.py. Run with save=False."""
import bpy, os, logging
from ii import *
OUT = os.path.join(ROOT, "frontend", "public", "models", "items"); sc = bpy.context.scene; vl = bpy.context.view_layer
names = sorted(m.name for m in bpy.data.meshes if m.name.startswith("SD_"))
tmp = bpy.data.collections.new("SD_EXPORT"); sc.collection.children.link(tmp); held = {}; objs = []
for n in names:
    other = bpy.data.objects.get(n)
    if other: held[other] = n; other.name = n + "__held"
    o = bpy.data.objects.new(n, bpy.data.meshes[n]); tmp.objects.link(o); objs.append(o)
for o in sc.objects:
    try: o.select_set(False)
    except RuntimeError: pass
for o in objs: o.select_set(True)
vl.objects.active = objs[0]; path = os.path.join(OUT, "shop_display_kit.glb"); logging.disable(logging.INFO)
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_cameras=False, export_lights=False, export_extras=False)
logging.disable(logging.NOTSET)
for o in objs: bpy.data.objects.remove(o, do_unlink=True)
for other, n in held.items(): other.name = n
bpy.data.collections.remove(tmp)
report(bytes=os.path.getsize(path), parts=names, triangles=sum(tris(bpy.data.meshes[n]) for n in names))
