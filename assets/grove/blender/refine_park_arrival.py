import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(bpy.data.filepath).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "grove_park_arrival_blender.png"
COLLECTION_NAME = "GROVE_PARK_ARRIVAL_REFINEMENT"


def material(name, color, roughness=0.72, metallic=0.0):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def move_to_collection(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, location, dimensions, mat, collection, bevel=0.12):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("GroveSoftEdges", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.25)
        modifier.segments = 3
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def cylinder(name, location, radius, depth, mat, collection, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def ico(name, location, scale, mat, collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def torus(name, location, major_radius, minor_radius, mat, collection, rotation=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=40,
        minor_segments=10,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def arch_curve(name, center, radius, thickness, mat, collection):
    curve_data = bpy.data.curves.new(name, type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = thickness
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new("POLY")
    steps = 24
    spline.points.add(steps)
    for index in range(steps + 1):
        angle = math.pi - (math.pi * index / steps)
        spline.points[index].co = (
            center[0] + math.cos(angle) * radius,
            center[1],
            center[2] + math.sin(angle) * radius,
            1.0,
        )
    obj = bpy.data.objects.new(name, curve_data)
    curve_data.materials.append(mat)
    collection.objects.link(obj)
    return obj


def text(name, body, location, size, mat, collection):
    bpy.ops.object.text_add(location=location, rotation=(math.pi / 2, 0, math.pi))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.035
    obj.data.bevel_depth = 0.012
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


if Path(bpy.data.filepath).name != MASTER.name:
    raise RuntimeError(f"Open only the dedicated Grove source before running this pass: {MASTER}")

# Idempotent authored pass: replace only our own environment collection.
old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)

arrival = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(arrival)

cream = material("Grove_Arrival_Cream", (0.93, 0.79, 0.58), 0.82)
path_mat = material("Grove_Arrival_Path", (0.82, 0.55, 0.36), 0.86)
green = material("Grove_Arrival_Leaf", (0.18, 0.49, 0.25), 0.8)
light_green = material("Grove_Arrival_Grass", (0.45, 0.68, 0.31), 0.9)
coral = material("Grove_Arrival_Coral", (0.86, 0.28, 0.34), 0.7)
rose = material("Grove_Arrival_Rose", (0.94, 0.45, 0.55), 0.68)
gold = material("Grove_Arrival_Gold", (0.96, 0.68, 0.18), 0.55, 0.08)
mint = material("Grove_Arrival_Mint", (0.24, 0.69, 0.58), 0.68)
water = material("Grove_Arrival_Water", (0.16, 0.64, 0.76), 0.3, 0.08)
wood = material("Grove_Arrival_Wood", (0.42, 0.22, 0.13), 0.82)
dark = material("Grove_Arrival_Dark", (0.07, 0.12, 0.10), 0.6)

# Outdoor substrate and loop-with-spokes arrival circulation.
cube("Park_Ground", (0, 35, -0.35), (58, 26, 0.7), light_green, arrival, 0.28)
cube("Arrival_Apron", (0, 25.2, 0.03), (10.5, 6.4, 0.14), cream, arrival, 0.18)
cube("Arrival_Main_Path", (0, 34.5, 0.05), (7.2, 13.0, 0.16), path_mat, arrival, 0.32)
cube("Park_Cross_Path", (0, 39.0, 0.04), (34.0, 3.2, 0.14), cream, arrival, 0.32)

# The previous blockout left a 20 m shell gap. Fill it with a real wall
# substrate and cut the approved 8 m x 4.5 m primary arrival through it.
wall = cube("ParkArrival_SouthWallInfill", (0, 22, 2.5), (20, 0.6, 5.0), cream, arrival, 0.0)
cube("ParkArrival_OpeningCutter", (0, 22, 2.25), (8.0, 2.0, 4.5), dark, arrival, 0.0)
cutter = bpy.context.object
boolean = wall.modifiers.new("Opening_main-arrival", "BOOLEAN")
boolean.operation = "DIFFERENCE"
boolean.solver = "EXACT"
boolean.object = cutter
bpy.context.view_layer.objects.active = wall
bpy.ops.object.modifier_apply(modifier=boolean.name)
bpy.data.objects.remove(cutter, do_unlink=True)
wall_bevel = wall.modifiers.new("GroveSoftEdges", "BEVEL")
wall_bevel.width = 0.08
wall_bevel.segments = 3
wall["opening_schedule_id"] = "main-arrival"
wall["opening_width_m"] = 8.0
wall["opening_height_m"] = 4.5

# A covered, readable threshold with visible passage depth.
cube("Entrance_Left_Pier", (-5.0, 23.7, 2.45), (1.1, 4.0, 4.9), cream, arrival, 0.22)
cube("Entrance_Right_Pier", (5.0, 23.7, 2.45), (1.1, 4.0, 4.9), cream, arrival, 0.22)
cube("Entrance_Canopy", (0, 23.7, 5.0), (11.0, 4.4, 0.55), coral, arrival, 0.24)
text("Entrance_Grove_Sign", "THE GROVE", (0, 25.94, 5.08), 0.66, gold, arrival)
cube("Entrance_Threshold", (0, 23.0, 0.12), (8.0, 2.8, 0.24), mint, arrival, 0.10)
cube("Entrance_Reveal_Left", (-4.15, 22.6, 2.25), (0.28, 1.5, 4.5), gold, arrival, 0.06)
cube("Entrance_Reveal_Right", (4.15, 22.6, 2.25), (0.28, 1.5, 4.5), gold, arrival, 0.06)

# Botanical arch frames the true opening instead of pretending to be one.
arch_curve("Entrance_Botanical_Arch", (0, 24.9, 1.58), 4.15, 0.24, green, arrival)
for x in (-4.15, 4.15):
    cylinder("Entrance_Arch_Stem", (x, 24.9, 1.55), 0.22, 3.1, green, arrival)
for x, z, color in [(-3.5, 3.8, rose), (-2.2, 4.8, gold), (0, 5.35, rose), (2.2, 4.8, gold), (3.5, 3.8, rose)]:
    ico("Entrance_Arch_Bloom", (x, 24.65, z), (0.42, 0.22, 0.42), color, arrival)

# Naturalized park clusters keep the route legible and the doorway visible.
tree_positions = [(-18, 30), (-13, 42), (13, 42), (18, 30), (-22, 39), (22, 39)]
for index, (x, y) in enumerate(tree_positions):
    cylinder(f"Park_Tree_Trunk_{index}", (x, y, 1.65), 0.28, 3.3, wood, arrival, 16)
    ico(f"Park_Tree_Canopy_{index}", (x, y, 4.1), (1.8, 1.5, 1.35), green, arrival)
    ico(f"Park_Tree_Highlight_{index}", (x - 0.55, y - 0.18, 4.55), (0.85, 0.7, 0.65), light_green, arrival)

for index, (x, y) in enumerate([(-8, 31), (8, 31), (-18, 35), (18, 35), (-9, 43), (9, 43)]):
    ico(f"Park_Shrub_{index}", (x, y, 0.62), (1.15, 0.85, 0.62), green, arrival)
    for petal_index in range(3):
        angle = petal_index * (math.tau / 3)
        ico(
            f"Park_Shrub_Bloom_{index}_{petal_index}",
            (x + math.cos(angle) * 0.48, y + math.sin(angle) * 0.35, 1.12),
            (0.18, 0.14, 0.16),
            (rose, gold, mint)[petal_index],
            arrival,
        )

# Seating faces the path and social heart while preserving circulation.
for index, (x, y) in enumerate([(-9.5, 37.0), (9.5, 37.0)]):
    cube(f"Park_Bench_Seat_{index}", (x, y, 0.72), (0.7, 3.0, 0.22), wood, arrival, 0.12)
    outer_x = x + (-0.36 if x < 0 else 0.36)
    cube(f"Park_Bench_Back_{index}", (outer_x, y, 1.25), (0.18, 3.0, 1.0), wood, arrival, 0.10)
    for leg_y in (-0.9, 0.9):
        cube(f"Park_Bench_Leg_{index}_{leg_y}", (x, y + leg_y, 0.35), (0.55, 0.18, 0.65), dark, arrival, 0.05)

# Bloom Chimes: the park hero and gentle discovery marker.
cylinder("Bloom_Chimes_Plinth", (15.5, 34.5, 0.28), 3.0, 0.56, cream, arrival, 40)
cylinder("Bloom_Chimes_Soil", (15.5, 34.5, 0.6), 2.55, 0.16, dark, arrival, 40)
for index, angle in enumerate((0, math.tau / 3, math.tau * 2 / 3)):
    x = 15.5 + math.cos(angle) * 1.35
    y = 34.5 + math.sin(angle) * 1.35
    cylinder(f"Bloom_Chime_Stem_{index}", (x, y, 2.5), 0.16, 3.8, green, arrival, 16)
    for petal in range(5):
        petal_angle = petal * math.tau / 5
        px = x + math.cos(petal_angle) * 0.72
        py = y + math.sin(petal_angle) * 0.72
        ico(f"Bloom_Chime_Petal_{index}_{petal}", (px, py, 4.45), (0.72, 0.42, 0.22), (rose, coral, gold)[index], arrival)
    ico(f"Bloom_Chime_Heart_{index}", (x, y, 4.5), (0.5, 0.42, 0.34), gold, arrival)
    cylinder(f"Bloom_Chime_Bell_{index}", (x, y, 3.25), 0.24, 0.45, gold, arrival, 16)

# Small water accent rewards the cross-path without competing with the entrance.
cylinder("Park_Ripple_Basin", (-15.5, 34.5, 0.22), 2.5, 0.44, cream, arrival, 40)
cylinder("Park_Ripple_Water", (-15.5, 34.5, 0.48), 2.15, 0.10, water, arrival, 40)
cylinder("Park_Ripple_Sprout", (-15.5, 34.5, 1.15), 0.18, 1.4, green, arrival, 16)

# Arrival review camera shows park, true entrance, and mall destination together.
camera = bpy.data.objects.get("Grove_Park_Arrival_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(30, 53, 20))
    camera = bpy.context.object
    camera.name = "Grove_Park_Arrival_Camera"
    move_to_collection(camera, arrival)
camera.location = (30, 53, 20)
camera.data.lens = 38
point_at(camera, (0, 27, 2.6))
bpy.context.scene.camera = camera

light = bpy.data.objects.get("Grove_Park_Key")
if light is None:
    bpy.ops.object.light_add(type="AREA", location=(-10, 42, 24))
    light = bpy.context.object
    light.name = "Grove_Park_Key"
    move_to_collection(light, arrival)
light.data.energy = 1800
light.data.shape = "DISK"
light.data.size = 14
point_at(light, (0, 30, 0))

scene = bpy.context.scene
scene["grove_park_arrival_pass"] = "blender-form-refinement-v1"
scene["grove_character_pipeline"] = "read-only-not-loaded"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.resolution_percentage = 75
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(RENDER)
scene.view_settings.look = "AgX - Medium High Contrast"

bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print(f"GROVE_PARK_ARRIVAL_READY {MASTER}")
print(f"GROVE_PARK_ARRIVAL_RENDER {RENDER}")
