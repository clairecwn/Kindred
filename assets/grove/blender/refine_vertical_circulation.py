import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(bpy.data.filepath).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "grove_vertical_circulation_blender.png"
COLLECTION_NAME = "GROVE_VERTICAL_CIRCULATION_REFINEMENT"


def material(name, color, roughness=0.76, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission and bsdf.inputs.get("Emission Color"):
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def move(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, location, dimensions, mat, collection, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("GroveSoftEdge", "BEVEL")
        mod.width = min(bevel, min(dimensions) * 0.28)
        mod.segments = 3
    obj.data.materials.append(mat)
    return move(obj, collection)


def cylinder(name, location, radius, depth, mat, collection, vertices=24, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return move(obj, collection)


def curve(name, points, bevel_depth, mat, collection):
    data = bpy.data.curves.new(name, type="CURVE")
    data.dimensions = "3D"
    data.bevel_depth = bevel_depth
    data.bevel_resolution = 3
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinates in zip(spline.bezier_points, points):
        point.co = coordinates
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    data.materials.append(mat)
    collection.objects.link(obj)
    return obj


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def hide_old_placeholders():
    for obj in bpy.data.objects:
        if obj.name.startswith(("South_Escalator_Step_", "North_Stair_Step_")):
            obj.hide_render = True
            obj.hide_set(True)


def build_escalator(collection):
    # Runs inward along the east side of the south arrival, keeping the
    # entrance-to-fountain axis completely open.
    x = 8.8
    lower_y = 18.0
    tread_count = 12
    run = 0.68
    rise = 0.39
    for index in range(tread_count):
        y = lower_y - index * run
        z = 0.24 + index * rise
        cube(f"Refined_Escalator_Tread_{index}", (x, y, z), (2.1, 0.74, 0.32), coral, collection, 0.06)
        cube(f"Refined_Escalator_Riser_{index}", (x, y + 0.31, z - 0.18), (2.1, 0.12, 0.38), dark, collection, 0.03)

    upper_y = lower_y - (tread_count - 1) * run
    upper_z = 0.24 + (tread_count - 1) * rise
    cube("Refined_Escalator_Lower_Landing", (x, lower_y + 0.72, 0.14), (3.0, 1.65, 0.28), pale, collection, 0.12)
    cube("Refined_Escalator_Upper_Landing", (x, upper_y - 0.72, upper_z + 0.02), (3.2, 1.70, 0.30), pale, collection, 0.12)
    for side in (-1.28, 1.28):
        rail_points = [
            (x + side, lower_y + 1.15, 1.0),
            (x + side, lower_y, 1.15),
            (x + side, upper_y, upper_z + 1.0),
            (x + side, upper_y - 1.1, upper_z + 1.0),
        ]
        curve(f"Refined_Escalator_Rail_{side}", rail_points, 0.10, dark, collection)
        curve(f"Refined_Escalator_Glass_Edge_{side}", [(p[0], p[1], p[2] - 0.34) for p in rail_points], 0.045, mint, collection)
    cube("Refined_Escalator_Wayfinding", (x, lower_y + 1.42, 1.16), (2.6, 0.20, 0.62), gold, collection, 0.10)


def build_north_stair(collection):
    # A conventional stair on the opposite side balances circulation without
    # repeating the escalator silhouette.
    x = -8.8
    start_y = -18.0
    tread_count = 12
    run = 0.68
    rise = 0.39
    for index in range(tread_count):
        y = start_y + index * run
        z = 0.24 + index * rise
        cube(f"Refined_North_Stair_Tread_{index}", (x, y, z), (2.5, 0.78, 0.34), warm_white, collection, 0.055)
    end_y = start_y + (tread_count - 1) * run
    end_z = 0.24 + (tread_count - 1) * rise
    cube("Refined_North_Stair_Lower_Landing", (x, start_y - 0.70, 0.14), (3.2, 1.65, 0.28), pale, collection, 0.10)
    cube("Refined_North_Stair_Upper_Landing", (x, end_y + 0.70, end_z + 0.02), (3.2, 1.65, 0.30), pale, collection, 0.10)
    for side in (-1.45, 1.45):
        points = [
            (x + side, start_y - 1.0, 1.0),
            (x + side, start_y, 1.1),
            (x + side, end_y, end_z + 1.0),
            (x + side, end_y + 1.0, end_z + 1.0),
        ]
        curve(f"Refined_North_Stair_Rail_{side}", points, 0.075, gold, collection)


def refine_lift(collection):
    # The shaft already exists structurally; doors and indicators make its
    # destination and operation readable from the atrium.
    x = 25.0
    cube("Refined_Lift_Door_Left", (x - 0.78, -2.06, 2.12), (1.45, 0.18, 3.75), mint, collection, 0.06)
    cube("Refined_Lift_Door_Right", (x + 0.78, -2.06, 2.12), (1.45, 0.18, 3.75), mint, collection, 0.06)
    cube("Refined_Lift_Header", (x, -2.14, 4.34), (3.7, 0.24, 0.56), dark, collection, 0.08)
    cube("Refined_Lift_Indicator", (x, -2.30, 4.34), (0.76, 0.12, 0.32), glow, collection, 0.04)
    cylinder("Refined_Lift_Call_Button", (x + 2.05, -2.24, 1.42), 0.12, 0.10, gold, collection, 20, rotation=(math.pi / 2, 0, 0))


if Path(bpy.data.filepath).name != MASTER.name:
    raise RuntimeError(f"Open only the dedicated Grove source before running this pass: {MASTER}")

old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)

circulation = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(circulation)

warm_white = material("Grove_Circulation_WarmWhite", (0.91, 0.82, 0.66), 0.84)
pale = material("Grove_Circulation_Pale", (0.74, 0.70, 0.61), 0.88)
coral = material("Grove_Circulation_Coral", (0.82, 0.27, 0.31), 0.72)
mint = material("Grove_Circulation_Mint", (0.18, 0.57, 0.51), 0.68, 0.04)
gold = material("Grove_Circulation_Gold", (0.94, 0.63, 0.16), 0.58, 0.12)
dark = material("Grove_Circulation_Dark", (0.035, 0.06, 0.055), 0.48, 0.18)
glow = material("Grove_Circulation_Glow", (1.0, 0.62, 0.18), 0.4, emission=(1.0, 0.38, 0.08), emission_strength=2.0)

hide_old_placeholders()
build_escalator(circulation)
build_north_stair(circulation)
refine_lift(circulation)

# Entry-facing review: fountain remains the center anchor, while the escalator
# reads clearly at the right without crossing the arrival axis.
camera = bpy.data.objects.get("Grove_Circulation_Review_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(-12.0, 18.5, 8.5))
    camera = bpy.context.object
    camera.name = "Grove_Circulation_Review_Camera"
    move(camera, circulation)
camera.location = (-12.0, 18.5, 8.5)
camera.data.lens = 38
point_at(camera, (5.0, 8.0, 2.7))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Grove_Circulation_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(0, 13, 12))
    key = bpy.context.object
    key.name = "Grove_Circulation_Key"
    move(key, circulation)
key.data.energy = 1050
key.data.shape = "DISK"
key.data.size = 11
point_at(key, (2, 6, 2))

scene = bpy.context.scene
scene["grove_vertical_circulation_pass"] = "supported-arrival-clear-v1"
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
print(f"GROVE_CIRCULATION_READY {MASTER}")
print(f"GROVE_CIRCULATION_RENDER {RENDER}")
