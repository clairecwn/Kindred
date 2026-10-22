"""Kindred cast: give the legs a knee.

Each body's leg was one straight tube with a ring of vertices at the ankle and one up inside the shorts, and nothing
in between. With no vertices at the knee it could not bend: when the character sat, the tube sheared sideways from hip
to ankle and cut through the hem of the shorts, which showed as a torn, jagged edge where the leg comes out.

This adds three loops to each leg (just above the knee, at it, just below) and weights the leg cleanly: thigh above the
knee, shin below, half and half at the joint. The top of the tube, hidden inside the shorts, now follows the thigh
exactly as the shorts' cuff does, so the two can never cross. Safe to run twice; a body that already has its knees is
left alone.

    exec(open('/Users/clairewn/Downloads/Kindred/assets/characters/tools/kindred_knees.py').read())
    KNEES()                      # all five bodies
then PH['export_all']() from kindred_hair.py to write the GLBs."""
import bpy, bmesh
from mathutils import Vector

BODIES = ["Kindred_Body", "Juno_Kindred_Body", "Sage_Kindred_Body", "Tobi_Kindred_Body", "Wren_Kindred_Body"]

def _knee(o):
    me = o.data; arm = o.parent
    if me.get("knee_loops"): return "already done"
    to_mesh = o.matrix_world.inverted() @ arm.matrix_world
    groups = {g.name: g.index for g in o.vertex_groups}
    skin = next(i for i, m in enumerate(me.materials) if m and m.name.split(".")[0] == "skin")
    bm = bmesh.new(); bm.from_mesh(me); dl = bm.verts.layers.deform.verify(); added = 0
    for side in ("L", "R"):
        th = arm.data.bones["thigh." + side]; sh = arm.data.bones["shin." + side]
        hip = to_mesh @ th.head_local; knee = to_mesh @ th.tail_local; ankle = to_mesh @ sh.tail_local
        up = (hip - knee).length; lo = (knee - ankle).length; gap = 0.22 * min(up, lo)
        def on_leg(v):
            return ankle.z - 0.03 < v.co.z < knee.z + 0.6 * up and (Vector((v.co.x, v.co.y)) - Vector((knee.x, knee.y))).length < 0.62 * up
        def tube():
            return [f for f in bm.faces if f.material_index == skin and all(on_leg(v) for v in f.verts)]
        n0 = len(bm.verts)
        for z in (knee.z + gap, knee.z, knee.z - gap):
            faces = tube(); geom = list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts}) + faces
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=(0, 0, z), plane_no=(0, 0, 1))
        added += len(bm.verts) - n0
        gt, gs = groups["thigh." + side], groups["shin." + side]
        for v in {v for f in tube() for v in f.verts}:
            d = v[dl]; d.clear()
            if v.co.z > knee.z + gap * 0.5: d[gt] = 1.0
            elif v.co.z < knee.z - gap * 0.5: d[gs] = 1.0
            else: d[gt] = 0.5; d[gs] = 0.5
    bm.normal_update(); bm.to_mesh(me); bm.free(); me.update(); me["knee_loops"] = 1
    return "added %d vertices" % added

def KNEES():
    return {n: _knee(bpy.data.objects[n]) for n in BODIES if n in bpy.data.objects}
