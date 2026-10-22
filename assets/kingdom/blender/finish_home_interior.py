"""Kingdom-only interior finishes and evaluated-world clearance evidence."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'blender/kingdom_island.blend'
assert Path(bpy.data.filepath).resolve() == SOURCE.resolve(), 'Dedicated Kingdom file required'
scene = bpy.context.scene
assert scene.get('kingdom_home_expansion_v1'), 'Expand the home first'
house = bpy.data.collections['KINGDOM_HOUSE']

def box(name, location, dimensions, material, bevel=.025):
    obj = bpy.data.objects.get(name)
    if obj:
        return obj
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    house.objects.link(obj)
    if material:
        obj.data.materials.append(bpy.data.materials[material])
    if bevel:
        mod = obj.modifiers.new('Soft crafted edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
    return obj

shell = bpy.data.objects['House_front_wall']
if not scene.get('kingdom_rear_windows_v1'):
    for i, x in enumerate([-6.0, 0.0]):
        cutter = box(f'Interior_rear_window_cutter_{i}', (x,12,4.04), (1.8,1.2,1.6), None, 0)
        bpy.context.view_layer.objects.active = shell
        mod = shell.modifiers.new(f'Real rear window {i}', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    scene['kingdom_rear_windows_v1'] = True

for i, x in enumerate([-6.0, 0.0]):
    box(f'Interior_rear_glass_{i}', (x,12,4.04), (1.78,.035,1.58), 'KI_glass', .01)
    for face, y in [('inside',11.73), ('outside',12.27)]:
        for side in [-1,1]:
            box(f'Interior_rear_jamb_{i}_{face}_{side}', (x+side*.96,y,4.04), (.12,.13,1.84), 'KI_white')
        for label, z in [('sill',3.18),('header',4.90)]:
            box(f'Interior_rear_{label}_{i}_{face}', (x,y,z), (2.04,.25,.12), 'KI_white')
        box(f'Interior_rear_mullion_{i}_{face}', (x,y,4.04), (.06,.07,1.60), 'KI_white', .012)

# Perimeter trims stop at the entrance instead of forming an invisible trip bar.
for side, x in [('west',-8.09),('east',2.09)]:
    box(f'Interior_skirting_{side}', (x,6.75,2.35), (.08,9.96,.18), 'KI_white', .015)
box('Interior_skirting_rear', (-3,11.73,2.35), (10.10,.08,.18), 'KI_white', .015)
for side, x in [('left',-6.32),('right',.32)]:
    box(f'Interior_skirting_front_{side}', (x,1.77,2.35), (3.45,.08,.18), 'KI_white', .015)

bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
window_tree = BVHTree.FromObject(shell,dg)
window_rays = 0
for x_center in [-6.0,0.0]:
    for dx in [-.65,0,.65]:
        for z in [3.5,4.04,4.6]:
            start = shell.matrix_world.inverted() @ Vector((x_center+dx,11,z))
            end = shell.matrix_world.inverted() @ Vector((x_center+dx,13,z))
            delta = end-start
            assert window_tree.ray_cast(start,delta.normalized(),delta.length)[0] is None, 'Rear window wall aperture blocked'
            window_rays += 1
vertices, polygons = [], []
for obj in house.objects:
    if obj.type != 'MESH' or obj.hide_render:
        continue
    evaluated = obj.evaluated_get(dg)
    mesh = evaluated.to_mesh()
    offset = len(vertices)
    vertices.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
    polygons.extend(tuple(offset+i for i in polygon.vertices) for polygon in mesh.polygons)
    evaluated.to_mesh_clear()
tree = BVHTree.FromPolygons(vertices, polygons)

# A 1.3m-wide envelope, slightly wider than Kai's measured idle silhouette.
route_hits = []
for x in [-3.65,-3.325,-3,-2.675,-2.35]:
    for z in [2.50,3.10,3.75,4.26]:
        hit = tree.ray_cast(Vector((x,-1.5,z)), Vector((0,1,0)), 12.6)
        if hit[0] is not None:
            route_hits.append([round(v,4) for v in hit[0]])
assert not route_hits, f'House route obstructed: {route_hits}'

supports = []
for x in [-6,-3,0]:
    for y in [3,6.75,10.5]:
        hit = tree.ray_cast(Vector((x,y,2.8)), Vector((0,0,-1)), 1)
        assert hit[0] is not None, 'Missing interior floor support'
        supports.append(round(hit[0].z,5))
assert max(supports)-min(supports)<.005, 'Uneven interior support'
floor_height = max(supports)
audit = {
    'revision':'interior-finish-v1', 'coordinateSystem':'Blender Z-up metres',
    'measured_floor_support_heights_m':supports,
    'runtime_floor_support_m':floor_height,
    'route_envelope_width_m':1.3, 'route_top_z_m':4.26,
    'route_rays':20, 'route_hits':route_hits,
    'method':'Evaluated world-space mesh BVH, all visible house meshes; sampled rays, not continuous capsule navigation',
    'rear_windows':2, 'rear_window_aperture_m':[1.8,1.6],
    'rear_window_shell_rays_clear':window_rays,
    'runtime_traversal_verified':False,
    'notes':'Clearance samples do not prove animated swept-volume collision, runtime camera visibility, or window watertightness.'
}
(ROOT/'docs/home-interior-audit.json').write_text(json.dumps(audit,indent=2))
layout_path = ROOT/'docs/room-layout.json'
layout = json.loads(layout_path.read_text())
for surface in layout['surfaces']:
    if surface['id'] == 'home-interior':
        surface['runtimeSupportHeight'] = floor_height
        surface['supportEvidence'] = 'home-interior-audit.json'
layout_path.write_text(json.dumps(layout,indent=2))
for obj in bpy.data.collections['KINGDOM_PLACEMENT_ZONES'].objects:
    if obj.name == 'Placement_home' or obj.name.startswith('Home_'):
        obj.location.z = floor_height
        obj['runtime_support_height_m'] = floor_height
scene.camera = bpy.data.objects['Kingdom_Overview']
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
print('KINGDOM_INTERIOR_AUDIT',json.dumps(audit))

if '--no-render' not in sys.argv:
    # Review-only roof cutaway. Restore source visibility by not saving this state.
    hidden = []
    for obj in house.objects:
        if obj.name.startswith(('Cottage_roof','Cottage_ceiling','Cottage_front_gable',
                                'Cottage_rear_gable','Chimney','Attic_','Vent_','Porch_canopy')):
            hidden.append((obj,obj.hide_render))
            obj.hide_render = True
    camera_data = bpy.data.cameras.new('Home_Interior_Review')
    camera = bpy.data.objects.new('Home_Interior_Review',camera_data)
    scene.collection.objects.link(camera)
    camera.location = (-3,-6,17)
    target = Vector((-3,6.2,2.5))
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 16
    scene.camera = camera
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1200
    scene.render.filepath = str(ROOT/'renders/kingdom_home_interior_cutaway.png')
    bpy.ops.render.render(write_still=True)
    for obj, state in hidden:
        obj.hide_render = state
    scene.camera = bpy.data.objects['Kingdom_Overview']
    bpy.data.objects.remove(camera,do_unlink=True)
    bpy.data.cameras.remove(camera_data)
