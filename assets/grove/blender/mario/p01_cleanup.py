"""Pass 1: geometry clean-up. Converts curves/text to mesh, applies stray scale, fixes inverted solids,
smooths curved shapes and hardens bevel normals. Safe to re-run."""
import bpy, bmesh, time
from mathutils import Matrix
from gk import *

t0 = time.time(); sc = bpy.context.scene; rep = {}
vis = [o for o in sc.objects if o.visible_get()]

# 1. curves and text never reach the GLB export, so bake them to mesh in place
conv = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in [o for o in vis if o.type in ("CURVE", "FONT")]:
    if any(c.name.endswith("LABELS") for c in o.users_collection): continue
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    if len(me.polygons) == 0:
        bpy.data.meshes.remove(me); continue
    name = o.name; o.name = name + "_src"
    n = bpy.data.objects.new(name, me); n.matrix_world = o.matrix_world.copy()
    for c in o.users_collection: c.objects.link(n)
    supersede([o]); conv += 1
rep["curves_text_to_mesh"] = conv

# 2. apply stray object scale so bevels are even
app = 0
for o in sc.objects:
    if o.type != "MESH": continue
    s = o.scale
    if max(abs(s.x - 1), abs(s.y - 1), abs(s.z - 1)) < 1e-4: continue
    if o.data.users > 1: o.data = o.data.copy()
    o.data.transform(Matrix.Diagonal(s).to_4x4())
    if s.x * s.y * s.z < 0: o.data.flip_normals()
    o.scale = (1, 1, 1); app += 1
rep["scale_applied"] = app

# 3. inverted closed solids
flip = 0
for o in vis:
    if o.type != "MESH" or len(o.data.polygons) < 4: continue
    bm = bmesh.new(); bm.from_mesh(o.data)
    if all(e.is_manifold for e in bm.edges) and bm.calc_volume(signed=True) < 0:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(o.data); flip += 1
    bm.free()
rep["inverted_fixed"] = flip

# 4. shading
hardened = smoothed = subd = 0
for o in sc.objects:
    if o.type != "MESH": continue
    me = o.data; nv, nf = len(me.vertices), len(me.polygons)
    if nf == 0 or me.name.startswith("GK_") or o.name.startswith(("Shop_", "Support_")) or any(c.name.startswith("MARIO_") for c in o.users_collection): continue
    mods = {m.type for m in o.modifiers}
    for m in o.modifiers:
        if m.type == "BEVEL":
            m.harden_normals = True; m.segments = 1 if max(o.dimensions) < 1.2 else min(m.segments, 2)
    if "BEVEL" in mods:
        me.polygons.foreach_set("use_smooth", [True] * nf); hardened += 1
    elif "SUBSURF" in mods:
        me.polygons.foreach_set("use_smooth", [True] * nf)
    elif (nv, nf) != (8, 6):
        if (nv, nf) == (42, 80) and max(o.dimensions) > 0.5:
            m = o.modifiers.new("GroveRound", "SUBSURF"); m.levels = 1; m.render_levels = 1
            me.polygons.foreach_set("use_smooth", [True] * nf); subd += 1
        else:
            hard_normals(me, 40); smoothed += 1
rep.update(bevel_hardened=hardened, curved_smoothed=smoothed, ico_rounded=subd, secs=round(time.time() - t0, 1))
bpy.app.driver_namespace["gk_report"] = rep
print("P01", rep)
