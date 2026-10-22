"""Pass 30: pictures of the house kit for checking, written to _to_delete/house_check (or dir=...). Renders with the scene's own sun
and sky. mode="examples": one tile per example house, joined into sheet.png. mode="shots": shots=[[name, eye, target, lens]].
Leaves the file as it found it (the camera it adds is removed)."""
import bpy, os, math
import numpy as np
from kk import *
a = NS.get("kk_args") or {}; out = os.path.join(ROOT, "_to_delete", a.get("dir", "house_check")); os.makedirs(out, exist_ok=True)
sc = bpy.context.scene; cam = bpy.data.objects.new("_k30_cam", bpy.data.cameras.new("_k30_cam")); sc.collection.objects.link(cam)
cam.data.clip_start = 0.1; cam.data.clip_end = 2000; old = (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage, sc.render.filepath)
sc.camera = cam
bpy.context.view_layer.update()            # parts made earlier in this run have no world position until now
def shot(path, eye, target, lens, w, h):
    cam.location = eye; cam.rotation_euler = (Vector(eye) - Vector(target)).to_track_quat("Z", "Y").to_euler(); cam.data.lens = lens
    r = sc.render; r.resolution_x = w; r.resolution_y = h; r.resolution_percentage = 100; r.image_settings.file_format = "PNG"; r.filepath = path
    bpy.ops.render.render(write_still=True)
made = []
if a.get("mode", "examples") == "examples":
    T = a.get("tile", 520); tiles = []; d = Vector(a.get("dir", (0.62, -1.0, 0.5))).normalized()
    roots = sorted([o for o in bpy.data.objects if o.name.startswith("KHX_") and o.type == "EMPTY"], key=lambda o: o.name)
    if a.get("only") is not None: roots = [r for i, r in enumerate(roots) if i in a["only"]]
    for r in roots:
        lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
        for ch in r.children:
            p, q = wbb(ch)
            for i in range(3): lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], q[i])
        c = (lo + hi) / 2; size = max(hi - lo)
        p = os.path.join(out, "tile_%s.png" % r.name); shot(p, c + d * (size * 1.75 + 1.0), c, 50, T, T); tiles.append(p)
    cols = a.get("cols", 3); rows = math.ceil(len(tiles) / cols); sheet = np.ones((rows * T, cols * T, 4), np.float32)
    for i, p in enumerate(tiles):
        im = bpy.data.images.load(p); px = np.empty(T * T * 4, np.float32); im.pixels.foreach_get(px); bpy.data.images.remove(im)
        rr, cc = divmod(i, cols); y0 = (rows - 1 - rr) * T; sheet[y0:y0 + T, cc * T:(cc + 1) * T] = px.reshape(T, T, 4)
    img = bpy.data.images.new("sheet", cols * T, rows * T, alpha=False); img.pixels.foreach_set(sheet.ravel())
    p = os.path.join(out, a.get("name", "sheet") + ".png"); img.filepath_raw = p; img.file_format = "PNG"; img.save(); bpy.data.images.remove(img); made.append(p)
elif a.get("mode") == "objs":            # one tile per named object (the first whose name starts with each entry), joined into a sheet
    T = a.get("tile", 420); tiles = []; d = Vector(a.get("view", (0.55, -1.0, 0.55))).normalized()
    for nm in a["names"]:
        o = next((o for o in sorted(bpy.data.objects, key=lambda o: o.name) if o.name.startswith(nm)), None)
        if o is None: continue
        lo, hi = wbb(o); c = (lo + hi) / 2; size = max(max(hi - lo), 0.6)
        p = os.path.join(out, "tile_%s.png" % nm); shot(p, c + d * (size * 1.9 + 0.8) * a.get("zoom", 1.0), c, 50, T, T); tiles.append(p)
    cols = a.get("cols", 4); rows = math.ceil(len(tiles) / cols); sheet = np.ones((rows * T, cols * T, 4), np.float32)
    for i, p in enumerate(tiles):
        im = bpy.data.images.load(p); px = np.empty(T * T * 4, np.float32); im.pixels.foreach_get(px); bpy.data.images.remove(im)
        rr, cc = divmod(i, cols); y0 = (rows - 1 - rr) * T; sheet[y0:y0 + T, cc * T:(cc + 1) * T] = px.reshape(T, T, 4)
    img = bpy.data.images.new("sheet", cols * T, rows * T, alpha=False); img.pixels.foreach_set(sheet.ravel())
    p = os.path.join(out, a.get("sheet", "objs") + ".png"); img.filepath_raw = p; img.file_format = "PNG"; img.save(); bpy.data.images.remove(img); made.append(p)
else:
    for name, eye, target, lens in a["shots"]:
        p = os.path.join(out, name + ".png"); shot(p, eye, target, lens, a.get("w", 1500), a.get("h", 800)); made.append(p)
sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage, sc.render.filepath = old
cd = cam.data; bpy.data.objects.remove(cam); bpy.data.cameras.remove(cd)
report(made=made)
