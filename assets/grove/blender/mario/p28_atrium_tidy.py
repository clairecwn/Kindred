"""Pass 28 (round 7): tidy the atrium floor once the ground escalators moved 3 m west.
- Codex's north 'runway' (a pink carpet with teal ticks on a white stone strip, leading to the garden wall) led nowhere
  and read as a catwalk: retired with its kerbs.
- The floor medallion shrinks to 0.8 so its rings stop short of the escalators (outer ring 3.56 m radius).
- The four white path ribbons (plain slabs that read as stray boards on the floor) are retired too.
Idempotent: scales and ends are set absolutely from the original shapes kept in custom properties."""
import bpy
from mathutils import Matrix, Vector
from gk import *

gone = supersede(named("Concourse_Entry_Rose", "Concourse_Entry_Stone", "Concourse_Edge_", "Concourse_Tick_", "Atrium_Path_Ribbon_"))
rep = {"retired": gone}

def keep_original(o):
    if "orig_co" not in o.data:
        o.data["orig_co"] = [c for v in o.data.vertices for c in v.co]
    co = o.data["orig_co"]
    return [Vector(co[i:i + 3]) for i in range(0, len(co), 3)]

S = 0.8
for n in ("Atrium_Medallion_Outer", "Atrium_Medallion_Middle", "Atrium_Medallion_Inner"):
    o = bpy.data.objects.get(n)
    if not o: continue
    base = keep_original(o); mw = o.matrix_world; mi = mw.inverted()
    for v, c in zip(o.data.vertices, base):
        w = mw @ c; v.co = mi @ Vector((w.x * S, w.y * S, w.z))
    o.data.update(); rep[n] = S

bpy.app.driver_namespace["gk_report"] = rep
