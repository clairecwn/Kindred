"""Pass 10: build every registered item (ib_*.py) and set it out in the showroom. Each shop has its own row, 7 m in
front of the last, with a back wall that carries the shop's name and the heights everything is sized against, and the
character standing at the head of the row. Table things stand on a display table, wall things on a board, hanging
things on a hook, hats on a head form, so each is seen the way it will be used. Each item has a floor label with its
name and size. The showroom is for looking at; only the IT_ meshes are ever exported."""
import bpy, bmesh, glob, importlib, os
from ii import *
import ii
ii.REG.clear(); ii.ALIAS.clear()
import ip; importlib.reload(ip)
for p in sorted(glob.glob(os.path.join(ii.HERE, "ib_*.py"))):
    importlib.reload(importlib.import_module(os.path.basename(p)[:-3]))
SHOPS = [("grove-grocer", "Grove Grocer"), ("thread-and-thimble", "Thread + Thimble"), ("home-nook", "Home Nook"), ("cafe-canopy", "Cafe Canopy"),
         ("sole-search", "Sole Search"), ("pixel-pantry", "Pixel Pantry"), ("maker-meadow", "Maker Meadow"), ("seasonal-pop-up", "Seasonal Pop-Up"),
         ("book-burrow", "Book Burrow"), ("alltimefitness", "AllTimeFitness"), ("food-hall", "Food Hall"), ("rooftop-garden", "Rooftop Garden"),
         ("furniture", "Furniture range (not in a shop yet)")]
NAMES = dict(SHOPS); ROW = 7.0
only = NS.get("ii_args", {}).get("only")           # rebuild just these ids (the rest keep their meshes)

built = {}; errs = []
for id, sp in ii.REG.items():
    me = bpy.data.meshes.get("IT_" + id)
    if me is None or not only or id in only:
        b = TB(); sp["build"](b); me = kit("IT_" + id, b, 50)
    lo, hi = bounds(me)
    me["ki_id"] = id; me["ki_label"] = sp["label"]; me["ki_shop"] = sp["shop"]; me["ki_type"] = sp["type"]; me["ki_cells"] = [float(c) for c in sp["cells"]]
    for k, v in sp["props"].items(): me["ki_" + k] = [float(x) for x in v] if isinstance(v, (tuple, list)) else v
    built[id] = (me, lo, hi)
me_alias = [a["id"] + "=" + a["of"] for a in ii.ALIAS.values()]
for k in [k for k in bpy.data.meshes.keys() if k.startswith("IT_") and k[3:] not in ii.REG]:
    if bpy.data.meshes[k].users == 0: bpy.data.meshes.remove(bpy.data.meshes[k])

# display furniture
b = B(); b.box((0.5, 0.34, 0.74), (0, 0, 0.37), "stone", r=0.03); b.box((0.9, 0.6, 0.06), (0, 0, 0.77), "white", r=0.02); TABLE = kit("SR_Table", b)
b = B(); b.box((0.9, 0.34, 0.74), (0, 0, 0.37), "stone", r=0.03); b.box((1.3, 0.7, 0.06), (0, 0, 0.77), "white", r=0.02); TABLE_W = kit("SR_Table_Wide", b)
b = B(); b.box((1.0, 0.08, 2.1), (0, 0.04, 1.05), "white", r=0.02); b.box((1.0, 0.5, 0.06), (0, 0.2, 0.03), "stone", r=0.02); PANEL = kit("SR_Panel", b)
b = B(); b.cyl(0.25, 0.05, (0, 0.35, 0), "stone", seg=14); b.cyl(0.04, 2.2, (0, 0.35, 0), "stone", seg=10)
b.tube([(0, 0.35, 2.18), (0, 0.2, 2.22), (0, 0.0, 2.2), (0, 0.0, 2.12)], 0.022, "stone", seg=6); HANGER = kit("SR_Hanger", b)
# a head the size of the character's (with hair), for hats; the brim line is at 1.6 m
b = B(); b.cyl(0.3, 0.05, (0, 0, 0), "stone", seg=14); b.cyl(0.07, 1.2, (0, 0, 0), "stone", seg=10)
b.ball(1.0, (0, 0, 1.5), "white", sc=(0.52, 0.52, 0.37), u=16, v=10); HEAD = kit("SR_Head", b); HEAD_Z = 1.6

room = ccol("ITEMS_SHOWROOM"); ccol("ITEMS")
for o in [o for o in room.objects if o.name.startswith("SR_")]: bpy.data.objects.remove(o, do_unlink=True)
for o in [o for o in bpy.data.objects if o.name.startswith("ITEM_")]: bpy.data.objects.remove(o, do_unlink=True)
entries = [dict(sp, mesh=sp["id"]) for sp in ii.REG.values()]
for a in ii.ALIAS.values():
    src = ii.REG[a["of"]]; entries.append(dict(src, id=a["id"], label=a["label"], shop=a["shop"], mesh=a["of"]))
rows = []; xmax = 0.0; k = 0; ref = bpy.data.collections.get("SCALE_REFERENCE")
for shop, shop_name in SHOPS:
    es = [e for e in entries if e["shop"] == shop]
    if not es: continue
    y0 = -ROW * k; x = 0.0; labels = B()
    for sp in es:
        id = sp["id"]; me, lo, hi = built[sp["mesh"]]; size = hi - lo; t = sp["type"]
        on_head = sp["props"].get("stand") == "head"
        on_table = not on_head and (t in ("table", "wear") or (t == "pack" and size.z < 0.5))
        wide = on_table and (size.x > 0.8 or size.y > 0.55)
        w = max(size.x, (1.3 if wide else 0.9) if on_table else 1.0 if t == "wall" else 0.5)
        cx = x + w / 2; fix = None; front = lo.y
        if on_head: fix, loc = HEAD, (cx, y0, sp["props"].get("lift", HEAD_Z))
        elif on_table: fix, loc, front = (TABLE_W if wide else TABLE), (cx, y0, 0.8), min(front, -0.35)
        elif t == "wall": fix, loc = PANEL, (cx, y0, 1.45)
        elif t == "hang": fix, loc = HANGER, (cx, y0, 2.12)
        else: loc = (cx, y0, 0)
        if fix:
            f = put("SR_fix_" + id, fix, room, (cx, y0, 0)); f["sr_for"] = id; f["sr_row"] = shop
        o = put("ITEM_" + id, me, ccol("ITEMS_" + shop, "ITEMS"), loc); o["sr_row"] = shop; o["ki_id"] = id
        yl = y0 + min(front, -0.3) - 0.28
        labels.text(sp["label"], 0.1, (cx, yl, 0.007), "plum", face="+z", extrude=0.006)
        labels.text("%.2f x %.2f x %.2f m" % (size.x, size.y, size.z), 0.06, (cx, yl - 0.15, 0.007), "slate", face="+z", extrude=0.006)
        if sp["mesh"] == id: rows.append("%s %s %.2fx%.2fx%.2f %dt" % (id, t, size.x, size.y, size.z, tris(me)))
        x += w + 0.6
    lo_ = labels.obj("SR_Labels_" + shop, room); lo_["sr_row"] = shop
    x0, x1 = -4.0, math.ceil(x) + 0.5; xmax = max(xmax, x1)
    wall = B(); wall.box2((x0, y0 + 1.3, 0), (x1, y0 + 1.45, 2.7), "wall")
    for h, name, col in ((0.45, "seat", "teal"), (0.80, "table", "orange"), (AVATAR, "character", "rose")):
        wall.box2((x0, y0 + 1.292, h - 0.012), (x1, y0 + 1.3, h + 0.012), col)
        wall.text("%.2f m  %s" % (h, name), 0.085, (x0 + 0.7, y0 + 1.29, h + 0.08), col, face="-y", extrude=0.006)
    tm = text_mesh(shop_name, 0.2, 0.008, 0); mx = min(v.co.x for v in tm.vertices)
    wall.mesh(tm, M("navy"), loc=(-mx, y0 + 1.288, 2.38), rot=gk.FACE["-y"]); bpy.data.meshes.remove(tm)
    wo = wall.obj("SR_Wall_" + shop, room); wo["sr_row"] = shop
    if k > 0 and ref:
        ko = bpy.data.objects.new("SR_Kai_" + shop, None); ko.instance_type = "COLLECTION"; ko.instance_collection = ref
        ko.location = (0, y0, 0); room.objects.link(ko); ko["sr_row"] = shop
    k += 1

bm = bmesh.new(); me = bpy.data.meshes.new("SR_Floor"); me.materials.append(M("cream")); me.materials.append(M("stone"))
fx0, fx1, fy0, fy1 = -4.0, xmax, -ROW * (k - 1) - 3.0, 1.5
nx, ny = int(round((fx1 - fx0) / 0.5)), int(round((fy1 - fy0) / 0.5))
for i in range(nx):
    for j in range(ny):
        ax, ay = fx0 + i * 0.5, fy0 + j * 0.5
        f = bm.faces.new([bm.verts.new((ax, ay, 0)), bm.verts.new((ax + 0.5, ay, 0)), bm.verts.new((ax + 0.5, ay + 0.5, 0)), bm.verts.new((ax, ay + 0.5, 0))])
        f.material_index = (i + j) % 2
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5); bm.to_mesh(me); bm.free()
room.objects.link(bpy.data.objects.new("SR_Floor", me))
want = NS.get("ii_args", {}).get("list")
report(items=len(built), aliases=me_alias, shop_rows=k, rows=[r for r in rows if not want or r.split(" ")[0] in want] if (want or len(rows) <= 12) else len(rows))
