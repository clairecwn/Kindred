"""Pass 18: re-attach things that belong to a product. Bread loaves go back on their shelf, the seed-packet
rack goes back up on its panel, and every price label or score mark is centred on the face of its own product
(shrunk if the product is now smaller than the label). Safe to re-run."""
import bpy, re
from mathutils import Vector, Matrix
sc = bpy.context.scene
def bb(o):
    vs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))), Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
def mv(o, d): o.matrix_world = Matrix.Translation(d) @ o.matrix_world
def find(base, col):
    """Match inside the same shop only (hidden legacy collections reuse names); Codex also duplicated some products as name.001."""
    pool = [o for o in col.all_objects if o.type == "MESH" and (o.name == base or o.name.startswith(base + "."))]
    return pool[0] if pool else None
rep = {"loaves": 0, "seed_rack": 0, "labels": 0, "labels_shrunk": 0, "unmatched": []}
sh = bpy.data.objects.get("Refined_Grocer_Island_Shelf_0")
if sh:
    sa, sb = bb(sh)
    for o in [o for o in sc.objects if re.match(r"Bakery_Loaf_\d+$", o.name)]:
        a, b = bb(o); d = Vector((0, max(sa.y + 0.03 - a.y, 0) + min(sb.y - 0.03 - b.y, 0), sb.z + 0.002 - a.z))
        if d.length > 0.004: mv(o, d); rep["loaves"] += 1
# seed packets stand on the three lowest retail shelves, at the front edge
for o in [o for o in sc.objects if o.name.startswith("Seed_Packet_")]:
    m = re.match(r"Seed_Packet_(\d+)_", o.name); shf = bpy.data.objects.get("RoofGarden_Retail_Shelf_" + m.group(1)) if m else None
    if shf:
        a, b = bb(o); fa, fb = bb(shf); d = Vector((0, fa.y + 0.04 - a.y, fb.z + 0.002 - a.z))
        if d.length > 0.004: mv(o, d); rep["seed_rack"] += 1
# yarn: the ball fills its paper band, and the pair stands on the shelf under it
for w in [o for o in sc.objects if o.name.startswith("Yarn_Wrap_")]:
    i = w.name.rsplit("_", 1)[1]; ball = next((o for o in sc.objects if re.match(r"Yarn_Ball_%s(\.\d+)?$" % i, o.name)), None)
    shf = bpy.data.objects.get("Maker_Supply_Shelf_6.12")
    if not ball or not shf: continue
    wa, wb = bb(w); ba_, bb2 = bb(ball); f = 0.92 * (wb.z - wa.z) / max(bb2.z - ba_.z, 1e-4)
    if abs(f - 1) > 0.03:
        cen = (ba_ + bb2) / 2; ball.matrix_world = Matrix.Translation(cen) @ Matrix.Scale(f, 4) @ Matrix.Translation(-cen) @ ball.matrix_world
        bpy.context.view_layer.update(); ba_, bb2 = bb(ball)
    mv(ball, (wa + wb) / 2 - (ba_ + bb2) / 2); bpy.context.view_layer.update(); ba_, bb2 = bb(ball)
    fa, fb = bb(shf); lo = min(wa.z, ba_.z); ymin = min(wa.y, ba_.y)
    d = Vector((0, max(fa.y + 0.03 - ymin, 0), fb.z + 0.002 - lo))
    if d.length > 0.004:
        mv(ball, d); mv(w, d); rep["yarn"] = rep.get("yarn", 0) + 1
# necks, caps and lids sit on top of their own container
PART = re.compile(r"_(Neck|Lid|Cap)(?=_|$)")
for c in bpy.data.collections:
    if not c.name.endswith("_INTERIOR_REFINEMENT"): continue
    for p_ in [o for o in c.all_objects if o.type == "MESH" and PART.search(o.name)]:
        I = find(PART.sub("", p_.name), c)
        if I is None: continue
        pa, pb = bb(p_); ia, ib = bb(I)
        f = min(1.0, 0.8 * (ib.x - ia.x) / max(pb.x - pa.x, 1e-4), 0.8 * (ib.y - ia.y) / max(pb.y - pa.y, 1e-4))
        if f < 0.97:
            cen = (pa + pb) / 2; p_.matrix_world = Matrix.Translation(cen) @ Matrix.Scale(f, 4) @ Matrix.Translation(-cen) @ p_.matrix_world
            bpy.context.view_layer.update(); pa, pb = bb(p_)
        d = Vector(((ia.x + ib.x) / 2 - (pa.x + pb.x) / 2, (ia.y + ib.y) / 2 - (pa.y + pb.y) / 2, ib.z - 0.004 - pa.z))
        if d.length > 0.004: mv(p_, d); rep["parts"] = rep.get("parts", 0) + 1
bpy.context.view_layer.update()
LAB = re.compile(r"_(Label|Score|Tag)(?=_|$)")
for c in bpy.data.collections:
    if not c.name.endswith("_INTERIOR_REFINEMENT"): continue
    for L in [o for o in c.all_objects if o.type == "MESH" and LAB.search(o.name)]:
        base = LAB.sub("", L.name).replace("Book_Spine_", "Book_Volume_")
        I = find(base, c)
        if I is None:
            rep["unmatched"].append(L.name); continue
        la, lb = bb(L); ia, ib = bb(I); ld = lb - la; idm = ib - ia
        ax = 0 if ld.x < ld.y else 1; ot = 1 - ax
        f = min(1.0, 0.8 * idm.z / max(ld.z, 1e-4), 0.9 * idm[ot] / max(ld[ot], 1e-4))
        if f < 0.98:
            cen = (la + lb) / 2; L.matrix_world = Matrix.Translation(cen) @ Matrix.Scale(f, 4) @ Matrix.Translation(-cen) @ L.matrix_world
            bpy.context.view_layer.update(); la, lb = bb(L); ld = lb - la; rep["labels_shrunk"] += 1
        side = 1 if (la[ax] + lb[ax]) / 2 >= (ia[ax] + ib[ax]) / 2 else -1
        d = Vector((0, 0, 0)); d[ot] = (ia[ot] + ib[ot]) / 2 - (la[ot] + lb[ot]) / 2; d.z = (ia.z + ib.z) / 2 - (la.z + lb.z) / 2
        d[ax] = (ib[ax] - 0.003 - la[ax]) if side > 0 else (ia[ax] + 0.003 - lb[ax])
        if d.length > 0.003: mv(L, d); rep["labels"] += 1
bpy.app.driver_namespace["gk_report"] = rep
