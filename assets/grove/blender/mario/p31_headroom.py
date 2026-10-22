"""Pass 31 (round 10): headroom in the food hall. The stall awnings, the noodle portal header, the garden trellis and
the noodle lanterns hung 1.9 to 2.0 m over the floor where customers stand. The game stops anything up to 2 m (the
cast's heads reach that), so the floor under them was blocked with nothing visible in the way. They go up 0.3 m and
the posts holding them grow to match; the lanterns go up 0.45 m so their bottoms clear the heads.
Idempotent: each object remembers how far it has been raised."""
import bpy
from mathutils import Vector
RAISE = {"Bake_Awning_Rail": .3, "Bake_Awning_Stripe_": .3, "Noodle_Portal_Header": .3, "Garden_Trellis_Beam": .3,
         "Garden_Trellis_Plant_": .3, "Noodle_Lantern_": .45}
POSTS = ("Bake_Awning_Post_", "Noodle_Portal_Post_", "Garden_Trellis_Post_")
rep = {"raised": [], "posts": []}
for o in bpy.data.objects:
    if o.type != "MESH": continue
    for pre, dz in RAISE.items():
        if o.name.startswith(pre):
            done = o.get("r10_raised", 0.0)
            if abs(done - dz) > 1e-6:
                mw = o.matrix_world; mi = mw.inverted(); d = dz - done
                for v in o.data.vertices:
                    w = mw @ v.co; w.z += d; v.co = mi @ w
                o.data.update(); o["r10_raised"] = dz; rep["raised"].append(o.name)
    if o.name.startswith(POSTS) and not o.get("r10_raised"):
        mw = o.matrix_world; mi = mw.inverted(); W = [mw @ v.co for v in o.data.vertices]; top = max(w.z for w in W)
        for v, w in zip(o.data.vertices, W):
            if w.z > top - 0.15: w.z += 0.3; v.co = mi @ w            # the head of the post rides up with what it carries
        o.data.update(); o["r10_raised"] = 0.3; rep["posts"].append(o.name)
bpy.app.driver_namespace["gk_report"] = rep
