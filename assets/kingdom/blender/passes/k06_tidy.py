"""Pass 6: tidy. Small faults left after joining.
1. The paddock's corner posts existed twice (once per fence side). The copies in the side fences are removed.
2. The pond was a sand mound with a water lens pushed into it (two squashed spheres sharing sloped faces). It is now a
   low rounded bank ring with a flat water surface inside it, on the same footprint.
3. Lily pads sat half in the pond surface. They rest on it now."""
import bpy, bmesh
from kk import *
def parts(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table(); seen = set(); out = []
    for v in bm.verts:
        if v.index in seen: continue
        stack = [v]; comp = []
        seen.add(v.index)
        while stack:
            a = stack.pop(); comp.append(a)
            for e in a.link_edges:
                w = e.other_vert(a)
                if w.index not in seen: seen.add(w.index); stack.append(w)
        cs = [o.matrix_world @ x.co for x in comp]
        key = tuple(round(f(c[i] for c in cs), 2) for f in (min, max) for i in range(3))
        out.append((key, comp))
    return bm, out
front = bpy.data.objects["K_Paddock_Fence_Front"]; bmf, pf = parts(front); keys = {k for k, _ in pf}; bmf.free()
removed = 0
for n in ("K_Paddock_Fence_Left", "K_Paddock_Fence_Right"):
    o = bpy.data.objects[n]; bm, ps = parts(o)
    dead = [v for k, comp in ps if k in keys for v in comp]
    if dead:
        removed += sum(1 for k, _ in ps if k in keys)
        bmesh.ops.delete(bm, geom=dead, context="VERTS"); bm.to_mesh(o.data); hard_normals(o.data, 50)
    bm.free()
PX, PY, RX, RY = -11.0, -11.0, 3.1, 2.0
b = B(); b.lathe([(1.0, 0.0), (0.985, 0.05), (0.95, 0.085), (0.9, 0.085), (0.87, 0.05), (0.86, -0.02)], m="sand", seg=40, cap=False)
me = kit("K_Pond_Bank", b, 62); me.transform(Matrix.Diagonal((RX, RY, 1, 1))); put("K_Pond_Bank", me, "KINGDOM_GARDEN", (PX, PY, Z))
b = B(); b.prism([(0.875 * RX * cos(tau * i / 40), 0.875 * RY * sin(tau * i / 40)) for i in range(40)], 0.045, "water")
KI("water")["gm_tile"] = 3.0                      # ripples at pond scale; the sea sets 12 for itself in k05
put("K_Pond_Water", kit("K_Pond_Water", b), "KINGDOM_GARDEN", (PX, PY, Z)); KI("water")["gm_tile"] = 12.0
bpy.context.view_layer.update()
water = bpy.data.objects["K_Pond_Water"]; top = wbb(water)[1].z; lifted = 0
for o in C("KINGDOM_GARDEN").objects:
    if o.name.startswith("K_Lily_Pad"):
        lo, hi = wbb(o)
        o.location.z += top + 0.004 - lo.z; lifted += 1
report(duplicate_fence_parts_removed=removed, lily_pads_lifted=lifted)
