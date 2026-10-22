"""Placement metadata, technical plan and measured checks for Kingdom only."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'blender/kingdom_island.blend'
if Path(bpy.data.filepath).resolve()!=SOURCE.resolve(): raise RuntimeError('Kingdom file required')
scene=bpy.context.scene
c=bpy.data.collections.get('KINGDOM_PLACEMENT_ZONES')
if not c:
    c=bpy.data.collections.new('KINGDOM_PLACEMENT_ZONES'); scene.collection.children.link(c)
zones=[('home',(-3,5,2.24),(7.6,6.4,.05)),('front-lawn',(2,-8,2),(5,6,.05)),('garden',(-11,-5,2),(8,9,.05)),('farm',(11.75,5,2),(6,8,.05)),('stable-yard',(12.5,-10,2),(5.5,3.5,.05))]
for name,loc,size in zones:
    ob=bpy.data.objects.get('Placement_'+name)
    if not ob:
        ob=bpy.data.objects.new('Placement_'+name,None); c.objects.link(ob)
    ob.location=loc; ob.scale=tuple(v/2 for v in size); ob.empty_display_type='CUBE'; ob.empty_display_size=1
    ob['zone_id']=name; ob['purpose']='Candidate placement region; runtime must subtract fixed objects and clear routes'
    ob['coordinates']='Blender Z-up metres'; ob.hide_render=True; ob.hide_set(True)

decor=bpy.data.collections['KINGDOM_DECOR']
bench=bpy.data.objects.get('Example_garden_bench')
if not bench:
    bench=bpy.data.objects.new('Example_garden_bench',None); decor.objects.link(bench); bench.location=(-9,-5.1,2)
    bpy.context.view_layer.update()
    for ob in list(decor.objects):
        if ob.name.startswith(('Garden_bench','Bench_back')):
            transform=ob.matrix_world.copy(); ob.parent=bench; ob.matrix_world=transform
bench['asset_id']='kingdom.example.garden-bench'
bench['ownership']='Authoring example only; not granted to player inventory'
bench['placement_footprint_m']=[2.2,.8]
bench['supports_rotation']=True

ref=bpy.data.collections['KINGDOM_CHARACTER_REFERENCE']
dg=bpy.context.evaluated_depsgraph_get()
feet=[]
for ob in ref.objects:
    if ob.type=='MESH' and not ob.hide_render:
        ev=ob.evaluated_get(dg); feet.extend((ev.matrix_world@v.co).z for v in ev.data.vertices)
audit=json.loads((ROOT/'docs/scene-audit.json').read_text())
audit['character_foot_height_m']=round(min(feet),5)
audit['character_ground_contact_error_m']=round(abs(min(feet)-2.035),5)
audit['placement_regions']=[{'id':name,'center':loc,'size':size} for name,loc,size in zones]
audit['environment_budget_passed']=audit['environment_triangles']<450000
assert audit['character_ground_contact_error_m']<.005, 'Reference character floating above the path'
(ROOT/'docs/scene-audit.json').write_text(json.dumps(audit,indent=2))

scene.camera=bpy.data.objects['Kingdom_Overview']
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))

# An actual top-down geometry projection, not a diagram of placeholder boxes.
scene.camera=bpy.data.objects['Kingdom_Plan']
scene.render.resolution_x=1200; scene.render.resolution_y=1200
clay=bpy.data.materials.get('Kingdom_plan_clay') or bpy.data.materials.new('Kingdom_plan_clay')
clay.use_nodes=True; clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.65,.65,.65,1)
clay.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
scene.view_layers[0].material_override=clay
scene.render.filepath=str(ROOT/'renders/kingdom_plan_clay.png')
if '--no-render' not in sys.argv: bpy.ops.render.render(write_still=True)
# Do not save render-only overrides into the source file.
scene.view_layers[0].material_override=None
scene.camera=bpy.data.objects['Kingdom_Overview']
print('KINGDOM_HANDOFF',json.dumps(audit))
