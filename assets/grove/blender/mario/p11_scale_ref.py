"""Pass 11: scale reference. Bakes the in-game Kai model (frontend/public/models/kindred_char01.glb) into two static
meshes, standing and seated, kept in the top-level MARIO_SCALE_REFERENCE collection (not exported, not rendered).
Reports the body measurements that fixture heights are checked against."""
import bpy
from mathutils import Vector
from gk import *

REF = ccol("MARIO_SCALE_REFERENCE"); REF.hide_render = True
arm = next((o for o in REF.objects if o.type == "ARMATURE"), None)
if arm is None:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(os.path.dirname(os.path.dirname(GROVE)), "frontend", "public", "models", "kindred_char01.glb"))
    for o in [o for o in bpy.data.objects if o not in before]:
        for c in list(o.users_collection): c.objects.unlink(o)
        REF.objects.link(o)
    arm = next(o for o in REF.objects if o.type == "ARMATURE")
parts = [o for o in REF.objects if o.type == "MESH" and o.name in ("Kindred_Body", "Hair_Full", "FaceInk", "FaceWhite", "FaceBlush")]
sc = bpy.context.scene
if not arm.animation_data: arm.animation_data_create()
def bake(name, action):
    act = bpy.data.actions.get(action); arm.animation_data.action = act
    sc.frame_set(int(act.frame_range[1]) if action != "idle" else int(act.frame_range[0])); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); b = B()
    for p in parts:
        me = bpy.data.meshes.new_from_object(p.evaluated_get(dg)); me.transform(p.matrix_world)
        t = bmesh.new(); t.from_mesh(me)
        remap = [b.mi(m) if m else 0 for m in me.materials] or [0]
        for f in t.faces: f.material_index = remap[min(f.material_index, len(remap) - 1)]
        sm = _scr(); t.to_mesh(sm); t.free(); b.bm.from_mesh(sm); bpy.data.meshes.remove(me)
    new = bpy.data.meshes.new(name + "__new"); b.bm.to_mesh(new); b.bm.free()
    for m in b.mats: new.materials.append(m)
    new.polygons.foreach_set("use_smooth", [True] * len(new.polygons))
    old = bpy.data.meshes.get(name)
    if old: old.user_remap(new); bpy.data.meshes.remove(old)
    new.name = name; return new
import bmesh
from gk import _scr
stand = bake("GK_Ref_Kai_Stand", "idle"); sit = bake("GK_Ref_Kai_Sit", "sit_chair")
vs = [v.co for v in sit.vertices]
seat = min(v.z for v in vs if -0.12 < v.y < 0.35 and abs(v.x) < 0.3)
rep = {"stand_height": round(max(v.co.z for v in stand.vertices), 2), "stand_width": round(max(v.co.x for v in stand.vertices) - min(v.co.x for v in stand.vertices), 2),
       "seat_height_under_hips": round(seat, 2), "seated_top_of_head": round(max(v.z for v in vs), 2),
       "seated_knee_front_y": round(min(v.y for v in vs if v.z > 0.25), 2), "seated_back_y": round(max(v.y for v in vs if v.z < 0.7), 2),
       "hip_width_seated": round(max(v.x for v in vs if v.z < 0.5) - min(v.x for v in vs if v.z < 0.5), 2)}
for o in [o for o in REF.objects if o.type in ("ARMATURE", "MESH") and not o.name.startswith("Ref_")]:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.app.driver_namespace["gk_report"] = rep
