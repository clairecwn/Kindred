import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(bpy.data.filepath).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "grove_grocer_refined_blender.png"
COLLECTION_NAME = "GROVE_GROCER_INTERIOR_REFINEMENT"


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


def smooth(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def cube(name, location, dimensions, mat, collection, bevel=0.05, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
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


def cylinder(name, location, radius, depth, mat, collection, vertices=20, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def sphere(name, location, scale, mat, collection):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def cone(name, location, radius1, radius2, depth, mat, collection, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def text(name, body, location, size, mat, collection):
    bpy.ops.object.text_add(location=location, rotation=(math.pi / 2, 0, math.pi))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.018
    obj.data.bevel_depth = 0.008
    obj.data.materials.append(mat)
    return move(obj, collection)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def hide_old_grocer_detail():
    for name in ("GROVE_GROCER_DETAIL", "GROVE_GROCER_INDIVIDUAL_PROPS", "GROVE_GROCER_LABELS"):
        collection = bpy.data.collections.get(name)
        if collection:
            collection.hide_render = True
            collection.hide_viewport = True
    prefixes = (
        "Grocer_Aisle_", "Grocer_Shelf_", "Grocer_Checkout", "Grocer_Produce_",
        "Carrot_", "Tomato_", "Lettuce_", "Apple_", "Milk_Carton_", "Cereal_Box_",
        "Cleaning_Spray_", "Shopping_Basket", "Shopping_Trolley_", "Grocer_Floor_Inset",
    )
    for obj in bpy.data.objects:
        if obj.name.startswith(prefixes) and not obj.name.startswith("Refined_"):
            obj.hide_render = True
            obj.hide_set(True)


def open_shelf(name, location, width, depth, height, levels, mat, collection, back=False):
    x, y, z = location
    cube(name + "_Left", (x - width / 2, y, z + height / 2), (0.12, depth, height), mat, collection, 0.035)
    cube(name + "_Right", (x + width / 2, y, z + height / 2), (0.12, depth, height), mat, collection, 0.035)
    for level in range(levels):
        shelf_z = z + 0.14 + level * ((height - 0.16) / (levels - 1))
        cube(f"{name}_Shelf_{level}", (x, y, shelf_z), (width, depth, 0.10), mat, collection, 0.025)
    if back:
        cube(name + "_Back", (x, y - depth / 2 + 0.05, z + height / 2), (width, 0.10, height), backing, collection, 0.025)


def produce_bin(name, location, item_mat, item_kind, collection):
    x, y, z = location
    cube(name + "_Crate", (x, y, z), (1.25, 0.84, 0.46), wood, collection, 0.06)
    for index, (ox, oy) in enumerate(((-0.38, -0.18), (0, -0.18), (0.38, -0.18), (-0.20, 0.18), (0.20, 0.18))):
        if item_kind == "carrot":
            cone(name + f"_Carrot_{index}", (x + ox, y + oy, z + 0.42), 0.11, 0.025, 0.46, orange, collection, rotation=(0, math.radians(72), 0))
            cylinder(name + f"_CarrotLeaf_{index}", (x + ox - 0.16, y + oy, z + 0.52), 0.018, 0.17, leaf, collection, 8, rotation=(0, math.radians(72), 0))
        elif item_kind == "pepper":
            sphere(name + f"_Pepper_{index}", (x + ox, y + oy, z + 0.35), (0.16, 0.15, 0.18), item_mat, collection)
            cylinder(name + f"_PepperStem_{index}", (x + ox, y + oy, z + 0.54), 0.018, 0.10, leaf, collection, 8)
        else:
            sphere(name + f"_{item_kind}_{index}", (x + ox, y + oy, z + 0.35), (0.16, 0.16, 0.15), item_mat, collection)


def packaged_row(prefix, shelf_y, shelf_z, xs, mat, shape, collection):
    for index, x in enumerate(xs):
        if shape == "box":
            cube(f"{prefix}_{index}", (x, shelf_y, shelf_z), (0.34, 0.24, 0.54), mat, collection, 0.035)
            cube(f"{prefix}_Label_{index}", (x, shelf_y + 0.126, shelf_z), (0.22, 0.016, 0.18), label_mats[index % len(label_mats)], collection, 0.008)
        elif shape == "bottle":
            cylinder(f"{prefix}_{index}", (x, shelf_y, shelf_z), 0.13, 0.46, mat, collection, 18)
            cone(f"{prefix}_Neck_{index}", (x, shelf_y, shelf_z + 0.29), 0.09, 0.055, 0.14, mat, collection)
            cube(f"{prefix}_Label_{index}", (x, shelf_y + 0.135, shelf_z), (0.16, 0.016, 0.16), label_mats[index % len(label_mats)], collection, 0.006)
        else:
            cylinder(f"{prefix}_{index}", (x, shelf_y, shelf_z), 0.14, 0.40, mat, collection, 18)


if Path(bpy.data.filepath).name != MASTER.name:
    raise RuntimeError(f"Open only the dedicated Grove source before running this pass: {MASTER}")

old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)

grocer = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(grocer)

floor_mat = material("Grocer_Refined_Floor", (0.25, 0.42, 0.34), 0.90)
wood = material("Grocer_Refined_Wood", (0.40, 0.19, 0.075), 0.88)
shelf_mat = material("Grocer_Refined_Shelf", (0.80, 0.61, 0.35), 0.84)
backing = material("Grocer_Refined_Backing", (0.13, 0.21, 0.16), 0.92)
cream = material("Grocer_Refined_Cream", (0.93, 0.84, 0.66), 0.82)
dark = material("Grocer_Refined_Dark", (0.035, 0.060, 0.050), 0.52, 0.12)
leaf = material("Grocer_Refined_Leaf", (0.10, 0.34, 0.14), 0.90)
green = material("Grocer_Refined_Green", (0.24, 0.56, 0.20), 0.86)
red = material("Grocer_Refined_Red", (0.76, 0.12, 0.10), 0.78)
orange = material("Grocer_Refined_Orange", (0.93, 0.40, 0.08), 0.78)
yellow = material("Grocer_Refined_Yellow", (0.95, 0.67, 0.15), 0.74)
blue = material("Grocer_Refined_Blue", (0.18, 0.48, 0.67), 0.70)
mint = material("Grocer_Refined_Mint", (0.23, 0.68, 0.56), 0.74)
rose = material("Grocer_Refined_Rose", (0.88, 0.39, 0.48), 0.74)
white = material("Grocer_Refined_White", (0.94, 0.94, 0.86), 0.80)
gold = material("Grocer_Refined_Gold", (0.94, 0.60, 0.13), 0.58, 0.08)
glow = material("Grocer_Refined_Glow", (1.0, 0.66, 0.20), 0.42, emission=(1.0, 0.40, 0.08), emission_strength=2.0)
label_mats = (red, blue, mint, yellow, rose)

hide_old_grocer_detail()

# Shop substrate and a 3.2 m unobstructed arrival lane through the center.
cube("Refined_Grocer_Floor", (-20, -14.0, 0.045), (11.2, 6.0, 0.09), floor_mat, grocer, 0.08)
cube("Refined_Grocer_Entry_Mat", (-20, -10.95, 0.10), (3.2, 0.72, 0.12), mint, grocer, 0.10)

# Back-wall departments and one low island retain broad, legible aisles.
open_shelf("Refined_Grocer_Chilled", (-23.2, -17.00, 0.18), 4.6, 0.70, 2.55, 4, shelf_mat, grocer, back=True)
open_shelf("Refined_Grocer_Pantry", (-17.2, -17.00, 0.18), 4.6, 0.70, 2.55, 4, shelf_mat, grocer, back=True)
open_shelf("Refined_Grocer_Island", (-20.2, -14.15, 0.18), 4.5, 0.82, 1.60, 3, shelf_mat, grocer, back=False)

# Produce market to the left of arrival.
cube("Refined_Produce_Table", (-23.65, -12.25, 0.64), (3.8, 1.48, 0.92), wood, grocer, 0.10)
produce_bin("Produce_Apple", (-24.80, -12.30, 1.26), red, "Apple", grocer)
produce_bin("Produce_Cabbage", (-23.40, -12.30, 1.26), green, "Cabbage", grocer)
produce_bin("Produce_Carrot", (-22.00, -12.30, 1.26), orange, "carrot", grocer)
text("Refined_Produce_Sign", "FRESH PRODUCE", (-23.65, -11.43, 2.32), 0.30, cream, grocer)

# Checkout is on the right, beyond the clear entry lane, with a readable queue.
cube("Refined_Checkout_Base", (-15.35, -12.30, 0.63), (2.20, 1.06, 1.18), wood, grocer, 0.10)
cube("Refined_Checkout_Belt", (-15.55, -12.30, 1.27), (1.55, 0.82, 0.10), dark, grocer, 0.04)
cube("Refined_Checkout_Register", (-14.72, -12.36, 1.56), (0.46, 0.44, 0.48), blue, grocer, 0.06)
cube("Refined_Checkout_Screen", (-14.72, -12.12, 1.62), (0.34, 0.04, 0.24), mint, grocer, 0.02)
for post_index, y in enumerate((-11.10, -12.15, -13.20)):
    cylinder(f"Refined_Queue_Post_{post_index}", (-17.0, y, 0.58), 0.055, 1.16, dark, grocer, 14)
    cylinder(f"Refined_Queue_Base_{post_index}", (-17.0, y, 0.06), 0.22, 0.12, dark, grocer, 20)

# Individually named chilled and pantry products rest directly on shelves.
packaged_row("Chilled_Milk", -16.62, 0.72, (-24.45, -23.95, -23.45, -22.95), white, "box", grocer)
packaged_row("Chilled_Juice", -16.62, 1.40, (-24.40, -23.85, -23.30, -22.75), orange, "bottle", grocer)
packaged_row("Chilled_Yogurt", -16.62, 2.04, (-24.40, -23.92, -23.44, -22.96), rose, "can", grocer)
packaged_row("Pantry_Cereal", -16.62, 0.72, (-18.60, -18.05, -17.50, -16.95), yellow, "box", grocer)
packaged_row("Pantry_Pasta", -16.62, 1.40, (-18.55, -18.00, -17.45, -16.90), red, "box", grocer)
packaged_row("Pantry_Bottle", -16.62, 2.04, (-18.55, -18.05, -17.55, -17.05), blue, "bottle", grocer)

# Island stock: household supplies on one side and bakery goods on the other.
packaged_row("HomeCare_Cleaner", -13.69, 0.72, (-21.55, -20.95, -20.35, -19.75), blue, "bottle", grocer)
packaged_row("HomeCare_Soap", -13.69, 1.26, (-21.50, -20.95, -20.40, -19.85), mint, "box", grocer)
for index, x in enumerate((-21.45, -20.75, -20.05, -19.35)):
    cube(f"Bakery_Loaf_{index}", (x, -14.60, 0.73), (0.52, 0.34, 0.28), gold, grocer, 0.13)
    cube(f"Bakery_Loaf_Score_{index}", (x, -14.78, 0.79), (0.27, 0.02, 0.035), cream, grocer, 0.01)
for index, x in enumerate((-21.35, -20.55, -19.75)):
    sphere(f"Bakery_Baguette_{index}", (x, -14.60, 1.28), (0.38, 0.12, 0.12), yellow, grocer)

# Carry props are parked clear of the doorway rather than blocking arrival.
for basket_index, y in enumerate((-11.30, -11.80, -12.30)):
    cube(f"Refined_Basket_{basket_index}", (-24.95, y, 0.24), (0.62, 0.40, 0.34), (rose, mint, gold)[basket_index], grocer, 0.08)
    cube(f"Refined_Basket_Handle_{basket_index}", (-24.95, y, 0.52), (0.46, 0.06, 0.26), dark, grocer, 0.025)

# Supported warm pendants clarify the produce, island, and checkout zones.
for light_index, (x, y) in enumerate(((-23.4, -12.4), (-20.0, -14.3), (-15.4, -12.4))):
    cylinder(f"Grocer_Pendant_Cord_{light_index}", (x, y, 4.15), 0.028, 1.40, dark, grocer, 10)
    cylinder(f"Grocer_Pendant_Rose_{light_index}", (x, y, 4.88), 0.16, 0.12, gold, grocer, 18)
    cone(f"Grocer_Pendant_Shade_{light_index}", (x, y, 3.38), 0.38, 0.20, 0.52, green, grocer)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 3.18))
    light = bpy.context.object
    light.name = f"Grocer_Pendant_Light_{light_index}"
    light.data.energy = 75
    light.data.color = (1.0, 0.66, 0.34)
    light.data.shadow_soft_size = 0.72
    move(light, grocer)

camera = bpy.data.objects.get("Grove_Grocer_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(-20.0, -10.05, 2.72))
    camera = bpy.context.object
    camera.name = "Grove_Grocer_Refined_Camera"
    move(camera, grocer)
camera.location = (-20.0, -10.05, 3.35)
camera.data.lens = 15
point_at(camera, (-20.0, -14.35, 0.95))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Grove_Grocer_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-20, -11.5, 4.6))
    key = bpy.context.object
    key.name = "Grove_Grocer_Refined_Key"
    move(key, grocer)
key.data.energy = 440
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
point_at(key, (-20, -14.2, 0.8))

scene = bpy.context.scene
scene["grove_grocer_refinement_pass"] = "walk-in-shop-form-v1"
scene["grove_character_pipeline"] = "read-only-not-loaded"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.resolution_percentage = 75
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(RENDER)
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.0

bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print(f"GROVE_GROCER_REFINED_READY {MASTER}")
print(f"GROVE_GROCER_REFINED_RENDER {RENDER}")
