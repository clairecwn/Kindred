"""Pass 14: stand the reference character in every shop and seat it on real seats, for eyeballing scale.
Everything lands in MARIO_SCALE_REFERENCE (top level: not exported, not rendered). Hide or delete it freely."""
import bpy, math
from gk import *

REF = ccol("MARIO_SCALE_REFERENCE"); REF.hide_render = True
for o in [o for o in REF.objects if o.name.startswith("Ref_")]: bpy.data.objects.remove(o, do_unlink=True)
ST, SI = bpy.data.meshes["GK_Ref_Kai_Stand"], bpy.data.meshes["GK_Ref_Kai_Sit"]
SHOPS = {"GROVE_GROCER": (-20, -14, 0, 1), "THREAD_THIMBLE": (20, -14, 0, 1), "HOME_NOOK": (20, 14, 0, -1), "CAFE_CANOPY": (-20, 14, 0, -1),
         "SOLE_SEARCH": (-20, -14, 5, 1), "PIXEL_PANTRY": (20, -14, 5, 1), "MAKER_MEADOW": (-20, 14, 5, -1), "SEASONAL_POP_UP": (20, 14, 5, -1),
         "BOOK_BURROW": (-20, -14, 10, 1), "ALLTIMEFITNESS": (20, -14, 10, 1), "FOOD_HALL": (-20, 14, 10, -1), "ROOFTOP_GARDEN": (20, 14, 10, -1)}
n = 0
for key, (xc, yc, z0, fd) in SHOPS.items():
    inst("Ref_Stand_" + key.title().replace("_", ""), ST, REF, (xc + 1.3, yc + fd * 2.3, z0 + 0.03), rz=0 if fd > 0 else pi); n += 1
for name, loc, rz in (("Atrium", (2.6, 8.0, 0), 0), ("Escalator", (-3.4, -1.15, 0.14), -pi / 2), ("Lift", (21.8, 0, 0), pi / 2), ("Lift_L2", (21.8, 0, 5), pi / 2),
                      ("Deck_L2", (0, 12.5, 5), 0), ("Entrance", (0, 24.2, 0.06), 0), ("Park", (1.2, 40, 0.06), 0), ("Stair", (-9.35, -15.6, 0), 0)):
    inst("Ref_Stand_" + name, ST, REF, loc, rz=rz); n += 1
def seat_on(name, obj_name, face_name=None, dx=0.0):
    o = bpy.data.objects.get(obj_name)
    if not o: return 0
    a, c = wbb(o); cx, cy = (a.x + c.x) / 2 + dx, (a.y + c.y) / 2; rz = 0.0
    f = bpy.data.objects.get(face_name) if face_name else None
    if f:
        fa, fc = wbb(f); ddx, ddy = (fa.x + fc.x) / 2 - cx, (fa.y + fc.y) / 2 - cy; rz = math.atan2(ddx, -ddy)
    inst("Ref_Sit_" + name, SI, REF, (cx, cy, c.z - 0.20), rz=rz); return 1
n += seat_on("CafeStool", "Cafe_Stool_0_0", "Cafe_Table_Top_0") + seat_on("FoodBench", "Food_Communal_Bench_0", "Food_Communal_Table", -1.0)
n += seat_on("ReadingChair", "Reading_Chair_Seat_0", "Reading_Table_Top_0") + seat_on("MakerStool", "Maker_Stool_0", "Maker_Workbench_Top")
n += seat_on("Armchair", "Armchair_Seat") + seat_on("RoofBench", "RoofGarden_Bench_Seat", None, -0.8) + seat_on("SoleBench", "Sole_Bench_Cushion.001", None, -0.6)
for name, bn, off in (("AtriumBench", "Atrium_Bench_Kit_0", -0.66), ("ParkBench", "GrovePark_Bench_0", 0.66)):
    bo = bpy.data.objects.get(bn)
    if bo:
        rz = bo.rotation_euler.z; inst("Ref_Sit_" + name, SI, REF, (bo.location.x + off * cos(rz), bo.location.y + off * sin(rz), bo.location.z + 0.02), rz=rz); n += 1
bpy.app.driver_namespace["gk_report"] = {"reference_figures": n}
