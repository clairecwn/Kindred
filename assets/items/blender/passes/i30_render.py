"""Pass 30: pictures for checking, written to _to_delete/items_check. mode="row" photographs the showroom in
stretches; mode="items" photographs each item alone and joins the tiles into sheet.png, in showroom order.
Run with save=False: it hides things while it works."""
import bpy, os, math
import numpy as np
from ii import *
a = NS.get("ii_args", {}); out = a.get("out", os.path.join(ROOT, "_to_delete", "items_check")); os.makedirs(out, exist_ok=True)
sc = bpy.context.scene; cam = bpy.data.objects["Showroom_camera"]; sc.camera = cam
def aim(eye, target, lens):
    cam.location = eye; cam.rotation_euler = (Vector(eye) - Vector(target)).to_track_quat("Z", "Y").to_euler(); cam.data.lens = lens
def shot(path, w, h):
    r = sc.render; r.resolution_x = w; r.resolution_y = h; r.resolution_percentage = 100
    r.image_settings.file_format = "PNG"; r.filepath = path; bpy.ops.render.render(write_still=True)
items = sorted([o for o in bpy.data.objects if o.name.startswith("ITEM_")], key=lambda o: o.location.x)
items.sort(key=lambda o: (-o.location.y, o.location.x))
if a.get("only"): items = [o for o in items if o.name[5:] in a["only"]]
if a.get("shop"): items = [o for o in items if o.get("sr_row") in a["shop"]]
made = []
if a.get("mode", "row") == "row":
    tagged = [o for o in bpy.data.objects if o.get("sr_row")]
    for shop in sorted({o["sr_row"] for o in items}):
        for o in tagged: o.hide_render = o["sr_row"] != shop
        its = [o for o in items if o["sr_row"] == shop]; y0 = its[0].location.y
        x0 = -2.6; x1 = max(o.location.x for o in its) + 1.0; n = max(1, math.ceil((x1 - x0) / 6.6)); step = (x1 - x0) / n
        for i in range(n):
            cx = x0 + step * (i + 0.5); aim((cx, y0 - 7.2, 2.7), (cx, y0 + 0.2, 1.05), 35); p = os.path.join(out, "row_%s_%d.png" % (shop, i)); shot(p, 1600, 760); made.append(p)
else:
    T = a.get("tile", 420); tiles = []
    hide = [o for o in bpy.data.objects if o.name.startswith(("ITEM_", "SR_fix_", "SR_Labels", "SR_Kai_"))] + list(bpy.data.collections["SCALE_REFERENCE"].all_objects)
    for o in hide: o.hide_render = True
    for o in items:
        id = o.name[5:]; fx = bpy.data.objects.get("SR_fix_" + id)
        o.hide_render = False
        if fx: fx.hide_render = False
        lo, hi = wbb(o); c = (lo + hi) / 2; d = max(hi - lo)
        aim(c + Vector(a.get("dir", (0.55, -1, 0.42))).normalized() * (d * 2.3 + 0.35), c, 50)
        p = os.path.join(out, "tile_%s.png" % id); shot(p, T, T); tiles.append(p)
        o.hide_render = True
        if fx: fx.hide_render = True
    cols = a.get("cols", 5); rows = math.ceil(len(tiles) / cols); sheet = np.ones((rows * T, cols * T, 4), np.float32)
    for i, p in enumerate(tiles):
        im = bpy.data.images.load(p); px = np.empty(T * T * 4, np.float32); im.pixels.foreach_get(px); bpy.data.images.remove(im)
        r, c = divmod(i, cols); y0 = (rows - 1 - r) * T; sheet[y0:y0 + T, c * T:(c + 1) * T] = px.reshape(T, T, 4)
    img = bpy.data.images.new("sheet", cols * T, rows * T, alpha=False); img.pixels.foreach_set(sheet.ravel())
    p = os.path.join(out, a.get("name", "sheet") + ".png"); img.filepath_raw = p; img.file_format = "PNG"; img.save(); made.append(p)
    made.append("order: " + ", ".join(o.name[5:] for o in items))
report(made=made)
