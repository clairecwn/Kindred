"""First review corrections in the single Kingdom source; no Grove edits."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'blender/kingdom_island.blend'
if Path(bpy.data.filepath).resolve()!=SOURCE.resolve(): raise RuntimeError('Kingdom file required')
scene=bpy.context.scene
if not scene.get('farm_aisles_widened'):
    for row in range(3):
        for col in range(2):
            cx=10+col*3.5; cy=2+row*3
            for ob in bpy.data.collections['KINGDOM_FARM'].objects:
                if ob.name.startswith(f'Plot_{row}_{col}_'):
                    ob.location.x=cx+(ob.location.x-cx)*(1.9/2.3)
                    ob.location.y=cy+(ob.location.y-cy)*(1.4/1.7)
                    ob.scale.x*=1.9/2.3; ob.scale.y*=1.4/1.7
    scene['farm_aisles_widened']=True
paths=bpy.data.collections['KINGDOM_PATHS']
base=bpy.data.objects.get('Arrival_to_house')
if base and not base.get('unified_paths'):
    for o in list(paths.objects):
        if o.type=='CURVE': bpy.data.objects.remove(o,do_unlink=True)
    meshes=[o for o in paths.objects if o.type=='MESH']
    for o in meshes:
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    for o in meshes:
        if o==base: continue
        bpy.context.view_layer.objects.active=base
        mod=base.modifiers.new('Join branch without overlapping surfaces','BOOLEAN')
        mod.operation='UNION'; mod.solver='EXACT'; mod.object=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(o,do_unlink=True)
    base['unified_paths']=True
    bevel=base.modifiers.new('Path rim','BEVEL'); bevel.width=.025; bevel.segments=2

bank=bpy.data.objects['Pond_bank']; bank.location.z=1.98; bank.scale.z=.15
pond=bpy.data.objects['Pond_water']; pond.location.z=2.14; pond.scale.z=.03
sea=bpy.data.objects['Sea']; sea.data.materials.clear(); sea.data.materials.append(bpy.data.materials['KI_water'])
for o in bpy.data.collections['KINGDOM_STABLE'].objects:
    if o.name.startswith('Stable_roof_tile'):
        o.data.materials.clear(); o.data.materials.append(bpy.data.materials['KI_blue'])

# Trees belong in front of the distant hill, never embedded in its volume.
islets=[(-52,35,10,8,2.4),(48,40,13,9,3),(4,68,11,8,2),(-58,-23,8,7,1.4),(63,-18,10,8,2)]
if not scene.get('distant_trees_repositioned'):
    for i,(x,y,rx,ry,h) in enumerate(islets):
        for k in range(3):
            dx=(k-1)*rx*.50-(k-1)*3; dy=-ry*.43-(k%2)*2
            for o in bpy.data.collections['KINGDOM_BACKDROP'].objects:
                if o.name.startswith(f'Distant_Tree_{i}_{k}_'):
                    o.location.x+=dx; o.location.y+=dy
    scene['distant_trees_repositioned']=True

# Complete both gables up to the pitched roof underside and add a flat ceiling.
house=bpy.data.collections['KINGDOM_HOUSE']
shell=bpy.data.objects['House_front_wall']
if not shell.get('unified_shell'):
    for name in ['House_side_-1','House_side_1','House_back_wall']:
        wall=bpy.data.objects.get(name)
        if not wall: continue
        bpy.context.view_layer.objects.active=wall
        for mod in list(wall.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.context.view_layer.objects.active=shell
        mod=shell.modifiers.new('Continuous wall shell','BOOLEAN'); mod.operation='UNION'; mod.solver='EXACT'; mod.object=wall
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(wall,do_unlink=True)
    shell['unified_shell']=True
    mod=shell.modifiers.new('Soft wall edges','BEVEL'); mod.width=.025; mod.segments=2
    shell.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
old=bpy.data.objects.get('Front_gable')
if old: bpy.data.objects.remove(old,do_unlink=True)
if not bpy.data.objects.get('Cottage_front_gable_shell'):
    for side,y in [('front',1.50),('rear',8.50)]:
        x=-3; z=2.24+3.48; shoulder=z+2.45*(1-4.25/4.8)
        verts=[(x-4.25,y,z),(x+4.25,y,z),(x+4.25,y,shoulder),(x,y,z+2.45),(x-4.25,y,shoulder)]
        me=bpy.data.meshes.new('Gable_shell'); me.from_pydata(verts,[],[(0,1,2,3,4)]); me.update()
        ob=bpy.data.objects.new('Cottage_'+side+'_gable_shell',me); house.objects.link(ob)
        me.materials.append(bpy.data.materials['KI_cream']); mod=ob.modifiers.new('Wall thickness','SOLIDIFY'); mod.thickness=.3
    bpy.ops.mesh.primitive_cube_add(size=1,location=(-3,5,2.24+3.43)); ob=bpy.context.object
    ob.name='Cottage_ceiling'; ob.dimensions=(8.2,7,.12)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(ob.users_collection): c.objects.unlink(ob)
    house.objects.link(ob); ob.data.materials.append(bpy.data.materials['KI_white'])
ref=bpy.data.collections['KINGDOM_CHARACTER_REFERENCE']
allowed={'Kindred_Body','Hair_Full','FaceInk','FaceWhite','FaceBlush','Tongue'}
for o in ref.objects:
    if o.type=='MESH' and o.name not in allowed:
        o.hide_render=True; o.hide_set(True)
dg=bpy.context.evaluated_depsgraph_get(); points=[]
for o in ref.objects:
    if o.type=='MESH' and not o.hide_render:
        ev=o.evaluated_get(dg); points.extend(ev.matrix_world@v.co for v in ev.data.vertices)
lo=Vector(tuple(min(v[i] for v in points) for i in range(3)))
hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
foot_shift=2.035-lo.z
for o in ref.objects:
    if o.parent not in set(ref.objects): o.location.z+=foot_shift
bpy.context.view_layer.update()
audit=json.loads((ROOT/'docs/scene-audit.json').read_text())
audit['character_dimensions_m']=[round(v,3) for v in hi-lo]
audit['character_reference_notes']='Current Kai GLB, idle pose, original scale; alternate hat hair and unrelated Icosphere helper are hidden in this reference only.'
audit['door_headroom_m']=round(2.8-(hi.z-lo.z),3)
audit['farm_aisle_minimum_m']=1.6
audit['character_foot_height_m']=2.035
audit['character_support']='Arrival path top; evaluated feet aligned after excluding helper mesh'
audit['review_corrections']=['Unified overlapping path surfaces','Pond water raised to bank','Stable blue roof unified','Distant trees separated from hills','House gables and ceiling sealed']
audit['collections']={c.name:len(c.objects) for c in bpy.data.collections if c.name.startswith('KINGDOM_')}
from mathutils.bvhtree import BVHTree
tree=BVHTree.FromObject(shell,bpy.context.evaluated_depsgraph_get())
clear=True
for x in [-4,-3.5,-3,-2.5,-2]:
    for z in [2.5,3.4,4.7]:
        local=shell.matrix_world.inverted()@Vector((x,.8,z))
        direction=shell.matrix_world.to_3x3().inverted()@Vector((0,1,0))
        hit=tree.ray_cast(local,direction,1.0)
        if hit[0] is not None: clear=False
audit['house_aperture_15_rays_clear']=clear
audit['environment_triangles']=0
dg=bpy.context.evaluated_depsgraph_get()
for o in scene.objects:
    if o.type=='MESH' and o not in set(ref.objects):
        ev=o.evaluated_get(dg); me=ev.to_mesh(); me.calc_loop_triangles()
        audit['environment_triangles']+=len(me.loop_triangles); ev.to_mesh_clear()
assert clear, 'House doorway blocked'
assert audit['environment_triangles']<450000, 'Environment triangle budget exceeded'
(ROOT/'docs/scene-audit.json').write_text(json.dumps(audit,indent=2))
print('KINGDOM_REFERENCE',json.dumps(audit))
scene.camera=bpy.data.objects['Kingdom_Overview']
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
