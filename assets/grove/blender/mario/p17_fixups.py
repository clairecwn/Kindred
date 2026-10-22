"""Pass 17 (one-time, guarded): hand corrections for display items that sat in the wrong place.
Storefront windows: produce on crate tops, loose roll and bottle on the plinth, bag on the plinth, cushions on the
table, pastries, cake and cups on the counter. Shops: soaps on their own shelf, plates on a shelf, croissants on
the lower pastry shelf, headphones on the table beside the cable coils, controllers either side of the console."""
import bpy
from mathutils import Vector, Matrix
sc = bpy.context.scene
def bb(o):
    vs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))), Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
def gbb(objs):
    bs = [bb(o) for o in objs]
    return Vector((min(a.x for a, b in bs), min(a.y for a, b in bs), min(a.z for a, b in bs))), Vector((max(b.x for a, b in bs), max(b.y for a, b in bs), max(b.z for a, b in bs)))
def shift(objs, d):
    for o in objs: o.matrix_world = Matrix.Translation(d) @ o.matrix_world
def place(objs, cx=None, cy=None, bottom=None, scale=1.0):
    if not objs: return
    a, b = gbb(objs); piv = Vector(((a.x + b.x) / 2, (a.y + b.y) / 2, a.z))
    new = Vector((piv.x if cx is None else cx, piv.y if cy is None else cy, piv.z if bottom is None else bottom))
    Mx = Matrix.Translation(new) @ Matrix.Scale(scale, 4) @ Matrix.Translation(-piv)
    for o in objs: o.matrix_world = Mx @ o.matrix_world
P = lambda *pre: [o for o in bpy.data.collections["GROVE_STOREFRONT_REFINEMENT"].all_objects if o.name.startswith(pre)]
S = lambda *pre: [o for o in sc.objects if o.type == "MESH" and o.visible_get() and o.name.startswith(pre)]   # visible only: hidden legacy collections reuse names
done = []
if not sc.get("gm_storefront_fixed"):
    for o in P("Fresh_Orange", "Fresh_Cabbage"):
        a, b = bb(o); shift([o], Vector((0, 0, 1.402 - a.z)))
    shift(P("Fresh_Crate", "Fresh_Apple", "Fresh_Orange", "Fresh_Cabbage"), Vector((-0.3, 0, 0)))
    place(P("Fresh_Paper"), cx=-19.98, cy=23.47, bottom=0.862, scale=0.7); place(P("Fresh_Cleaner"), cx=-19.6, cy=23.47, bottom=0.862, scale=0.7)
    place(P("Style_Bag"), cx=-16.32, cy=23.47, bottom=0.862)
    u = P("Style_Shoe_Right_Upper"); so = P("Style_Shoe_Right_Sole")
    if u and so:
        ua, ub = bb(u[0]); sa, sb = bb(so[0]); shift(u, Vector((sa.x - ua.x, 0, 0))); shift(u + so, Vector((0.2, 0, 0)))
    place(P("Home_Cushion_0"), cx=14.55, cy=23.36, bottom=1.212); place(P("Home_Cushion_1"), cx=14.38, cy=23.0, bottom=1.212)
    place(P("Taste_Pastry"), bottom=1.402); shift(P("Taste_Pastry"), Vector((-0.35, 0, 0)))
    cake = P("Taste_Cake"); a, b = gbb(cake); shift(cake, Vector((-0.27, 0, 1.402 - a.z)))
    c1 = P("Taste_Cup_1", "Taste_Cup_Handle_1"); place(c1, cx=21.95, bottom=1.402)
    a0, b0 = bb(bpy.data.objects["Taste_Cup_0"]); a1, b1 = bb(bpy.data.objects["Taste_Cup_1"]); shift(c1, Vector((0, (a0.y + b0.y) / 2 - (a1.y + b1.y) / 2, 0)))
    sc["gm_storefront_fixed"] = 1; done.append("storefront")
if not sc.get("gm_item_handfix"):
    sh = bb(bpy.data.objects["Refined_Grocer_Island_Shelf_1"])
    for i in range(4):
        grp = [o for o in S("HomeCare_Soap_") if o.name.endswith("_" + str(i))]
        body = [o for o in grp if "Label" not in o.name]
        if body:
            a, b = bb(body[0]); shift(grp, Vector((0, sh[1].y - 0.03 - b.y, sh[1].z + 0.002 - a.z)))
    ks = bb(bpy.data.objects["Kitchenware_Bay_Shelf_1.68"])
    for o in S("Dinner_Plate_"):
        a, b = bb(o); shift([o], Vector((0, (ks[0].y + ks[1].y) / 2 - (a.y + b.y) / 2, ks[1].z + 0.002 - a.z)))
    low = bb(bpy.data.objects["Pastry_Case_Shelf_1.305"])
    for nme in ("Butter_Croissant_0", "Butter_Croissant_3"):
        o = bpy.data.objects.get(nme)
        if o:
            a, b = bb(o); shift([o], Vector((0, 0, low[1].z + 0.002 - a.z)))
    tb = bb(bpy.data.objects["Pixel_Accessory_Table"])
    for o in S("Gaming_Headphones_"):
        a, b = bb(o); shift([o], Vector((0, -14.2 - (a.y + b.y) / 2, tb[1].z + 0.002 - a.z)))
    shift(S("Demo_Controller_A"), Vector((-0.25, 0, 0))); shift(S("Demo_Controller_B"), Vector((0.25, 0, 0)))
    sc["gm_item_handfix"] = 1; done.append("shop items")
if not sc.get("gm_item_handfix2"):
    hb = S("Handbag_"); shift(hb, Vector((-0.2, 0, 0)))
    tab = bb(bpy.data.objects["Refined_Accessory_Table"])
    for o in [o for o in hb if "Flap" not in o.name]:
        pass
    body = [o for o in hb if "Body" in o.name]
    if body:
        a, b = bb(body[0]); shift([o for o in hb if "Flap" not in o.name], Vector((0, 0, tab[1].z + 0.002 - a.z)))
    cake = S("Bake_Cake"); shift(cake, Vector((0.95, 0, 0)))
    shift(S("RoofGarden_Shrub_Trunk_3", "RoofGarden_Shrub_Canopy_3"), Vector((0, 0.75, 0)))
    pot = bpy.data.objects.get("Potting_Pot_0"); top = bpy.data.objects.get("RoofGarden_Potting_Top")
    if pot and top:
        a, b = bb(pot); ta, tb = bb(top); shift([pot], Vector((0.35, 0, tb.z + 0.002 - a.z)))
    sc["gm_item_handfix2"] = 1; done.append("shop items 2")
bpy.app.driver_namespace["gk_report"] = {"applied": done}
