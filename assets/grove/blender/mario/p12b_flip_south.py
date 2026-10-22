"""Pass 12b (one-time, guarded): turn the five south-side shops half a turn so they open onto the central lane."""
import bpy, math
from mathutils import Matrix, Vector
sc = bpy.context.scene; n = 0
if not sc.get("gm_south_shops_flipped"):
    for key, xc in (("HOME_NOOK", 20), ("CAFE_CANOPY", -20), ("MAKER_MEADOW", -20), ("SEASONAL_POP_UP", 20), ("FOOD_HALL", -20)):
        c = Vector((xc, 14, 0)); R = Matrix.Translation(c) @ Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Translation(-c)
        for o in bpy.data.collections[key + "_INTERIOR_REFINEMENT"].all_objects:
            if o.name.startswith("Shop_"): continue
            o.matrix_world = R @ o.matrix_world; n += 1
    sc["gm_south_shops_flipped"] = 1
bpy.app.driver_namespace["gk_report"] = {"rotated_objects": n}
