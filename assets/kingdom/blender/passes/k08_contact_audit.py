"""Pass 8: contact audit (read-only). Rule: everything touches something. An object passes if any of its vertices is
within 2 cm of another object's surface, or the other way round. Backdrop pieces out at sea are skipped."""
import bpy, bmesh
from mathutils.bvhtree import BVHTree
from kk import *
SKIPC = ("KINGDOM_BACKDROP", "KINGDOM_CHARACTER_REFERENCE", SUPERSEDED, "KINGDOM_LIGHTING", "KINGDOM_PLACEMENT_ZONES")
dg = bpy.context.evaluated_depsgraph_get(); items = []
for o in bpy.context.scene.objects:
    if o.type != "MESH" or not o.visible_get() or o.users_collection[0].name in SKIPC: continue
    bm = bmesh.new(); bm.from_object(o, dg); bm.transform(o.matrix_world)
    vs = [v.co.copy() for v in bm.verts]
    if not vs: bm.free(); continue
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    items.append((o, BVHTree.FromBMesh(bm), vs[::max(1, len(vs) // 400)], lo, hi)); bm.free()
TOL = 0.02; loose = []
for i, (o, bvh, vs, lo, hi) in enumerate(items):
    ok = False
    for j, (p, bvh2, vs2, lo2, hi2) in enumerate(items):
        if i == j or any(lo[k] > hi2[k] + TOL or lo2[k] > hi[k] + TOL for k in range(3)): continue
        if any((r := bvh2.find_nearest(v, TOL))[0] is not None for v in vs) or any(bvh.find_nearest(v, TOL)[0] is not None for v in vs2) or bvh.overlap(bvh2):
            ok = True; break
    if not ok: loose.append([o.name, [round(x, 2) for x in lo], [round(x, 2) for x in hi]])
report(checked=len(items), floating=loose)
