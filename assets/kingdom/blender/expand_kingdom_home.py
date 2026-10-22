"""Enlarge only the Kingdom home, preserving the reviewed arrival anchor.

Run on kingdom_island.blend; idempotent. No export or Grove mutations.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'blender/kingdom_island.blend'
if Path(bpy.data.filepath).resolve() != SOURCE.resolve():
    raise RuntimeError('Open the dedicated Kingdom source before expanding it')
scene = bpy.context.scene
if not scene.get('kingdom_home_expansion_v1'):
    # Anchor the front wall and doorway so the existing arrival still connects.
    # Keep vertical dimensions unchanged: the current character remains 2m tall.
    anchor = Vector((-3, 1.5, 2.24))
    transform = Matrix.Translation(anchor) @ Matrix.Diagonal((1.3, 1.5, 1, 1)) @ Matrix.Translation(-anchor)
    house = bpy.data.collections['KINGDOM_HOUSE']
    for obj in house.objects:
        obj.matrix_world = transform @ obj.matrix_world
    # Move nearby tree families as a whole, never detach foliage or fruit.
    for obj in bpy.data.collections['KINGDOM_TREES'].objects:
        if obj.name.startswith('Orchard_2_'):
            obj.location.x += 3
            obj.location.y += 1
        if obj.name.startswith('Island_tree_2_'):
            obj.location.x -= 3
    scene['kingdom_home_expansion_v1'] = True

bpy.context.view_layer.update()
zone = bpy.data.objects['Placement_home']
# Interior wall faces: x +/- 3.95 * 1.3; y front 1.65, rear 8.35,
# with Y stretched about 1.5. Inset 0.15m for fitting furniture safely.
usable_width = 7.9 * 1.3
usable_depth = 6.7 * 1.5
zone.location = (-3, 6.75, 2.24)
zone.scale = ((usable_width - .30) / 2, (usable_depth - .30) / 2, .025)
zone['purpose'] = 'Open-plan home; keep a clear entry route; subtract wall/door footprints at runtime'
zone['interior_clear_area_m2'] = usable_width * usable_depth
zone['future_design'] = 'Movable furnishings and optional partitions; no fixed room divisions'

# Authoring guides only, deliberately excluded from renders and future exports.
# The entry spine remains clear even if the user eventually adds partitions.
guides = bpy.data.collections['KINGDOM_PLACEMENT_ZONES']
for name, center, size, purpose in [
    ('Home_entry_spine', (-3, 6.75, 2.24), (2.0, 9.75, .05), 'Reserved continuous doorway-to-rear circulation'),
    ('Home_living_candidate', (-6.0, 4.15, 2.24), (3.6, 4.4, .05), 'Possible living / dining zone, not a fixed room'),
    ('Home_kitchen_candidate', (0.0, 4.15, 2.24), (3.6, 4.4, .05), 'Possible kitchen / crafting zone, not a fixed room'),
    ('Home_bedroom_candidate', (-6.0, 9.2, 2.24), (3.6, 4.4, .05), 'Possible bedroom zone, not a fixed room'),
    ('Home_flex_candidate', (0.0, 9.2, 2.24), (3.6, 4.4, .05), 'Possible study / hobby zone, not a fixed room'),
]:
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, None)
        guides.objects.link(obj)
    obj.location = center
    obj.scale = tuple(v / 2 for v in size)
    obj.empty_display_type = 'CUBE'
    obj.empty_display_size = 1
    obj.hide_render = True
    obj.hide_set(True)
    obj['purpose'] = purpose
    obj['export'] = False

audit_path = ROOT / 'docs/home-expansion-audit.json'
dg = bpy.context.evaluated_depsgraph_get()
shell = bpy.data.objects['House_front_wall']
from mathutils.bvhtree import BVHTree
tree = BVHTree.FromObject(shell, dg)
clear = True
for x in [-4.2, -3.6, -3, -2.4, -1.8]:
    for z in [2.5, 3.4, 4.7]:
        origin = shell.matrix_world.inverted() @ Vector((x, .8, z))
        direction = shell.matrix_world.to_3x3().inverted() @ Vector((0, 1, 0))
        direction.normalize()
        if tree.ray_cast(origin, direction, 1.0)[0] is not None:
            clear = False
assert clear, 'Expanded cottage wall blocks the entrance'
audit = {
    'revision': 'home-expansion-v1', 'units': 'metres',
    'interior_clear_dimensions': [round(usable_width, 3), round(usable_depth, 3)],
    'interior_clear_area_m2': round(usable_width * usable_depth, 2),
    'ceiling_height_approx_m': 3.37,
    'wall_aperture_width_m': 3.12, 'wall_aperture_height_m': 2.8,
    'entrance_wall_ray_samples_clear': clear,
    'floor_height_m': 2.24, 'character_scale_changed': False,
    'fixed_partitions': False,
    'runtime_integrated': False,
    'future_features_not_implemented': ['User-built partitions', 'Additional floors', 'Structural expansion upgrades'],
}
audit_path.write_text(json.dumps(audit, indent=2))
# Keep downstream layout metadata aligned when this pass is rerun by the builder.
layout_path = ROOT / 'docs/room-layout.json'
layout = json.loads(layout_path.read_text())
for surface in layout['surfaces']:
    if surface['id'] == 'home-interior':
        surface['center'] = [-3, 6.75, 2.24]
        surface['size'] = [round(usable_width, 3), round(usable_depth, 3)]
layout_path.write_text(json.dumps(layout, indent=2))
scene_audit_path = ROOT / 'docs/scene-audit.json'
scene_audit = json.loads(scene_audit_path.read_text())
scene_audit['house_door_clearance_m'] = [3.12, 2.8]
scene_audit['home_expansion_audit'] = 'home-expansion-audit.json'
for region in scene_audit['placement_regions']:
    if region['id'] == 'home':
        region['center'] = [-3, 6.75, 2.24]
        region['size'] = [9.97, 9.75, .05]
scene_audit_path.write_text(json.dumps(scene_audit, indent=2))
scene.camera = bpy.data.objects['Kingdom_Overview']
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
print('KINGDOM_HOME_EXPANSION', json.dumps(audit))

if '--no-render' not in sys.argv:
    # Updated visual review; save source before any render-only camera changes.
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 1080
    scene.render.filepath = str(ROOT / 'renders/kingdom_expanded_home_overview.png')
    bpy.ops.render.render(write_still=True)

    # Roof-off plan from actual meshes makes the usable floor area inspectable.
    hidden = []
    for obj in bpy.data.collections['KINGDOM_HOUSE'].objects:
        if obj.name.startswith(('Cottage_roof', 'Cottage_ceiling', 'Cottage_front_gable',
                                'Cottage_rear_gable', 'Chimney', 'Attic_', 'Vent_', 'Porch_canopy')):
            hidden.append((obj, obj.hide_render))
            obj.hide_render = True
    scene.camera = bpy.data.objects['Kingdom_Plan']
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1200
    scene.render.filepath = str(ROOT / 'renders/kingdom_expanded_home_plan.png')
    bpy.ops.render.render(write_still=True)
    for obj, state in hidden:
        obj.hide_render = state
