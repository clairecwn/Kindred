"""Pass 1: setup. EEVEE, a hidden collection for retired objects, and scale applied on every Codex mesh so that
bevels are the same width on every edge (1,154 objects had a stretched bevel)."""
import bpy
from kk import *
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
supersede([])
skip = set(C("KINGDOM_CHARACTER_REFERENCE").all_objects) | set(C("KINGDOM_PLACEMENT_ZONES").all_objects)
n = 0
for o in sc.objects:
    if o.type != "MESH" or o in skip or o.children: continue
    if any(m.type == "ARMATURE" for m in o.modifiers): continue
    if apply_scale(o): n += 1
left = sum(1 for o in sc.objects if o.type == "MESH" and o not in skip and any(abs(x - 1) > 1e-4 for x in o.scale))
report(scale_applied=n, still_scaled=left, engine=sc.render.engine)
