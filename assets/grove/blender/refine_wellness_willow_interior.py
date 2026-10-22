import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "alltimefitness_refined_blender.png"
COLLECTION_NAME = "ALLTIMEFITNESS_INTERIOR_REFINEMENT"


def mat(name, color, roughness=0.72, metallic=0.0, emission=None, strength=0.0):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.use_nodes = True
    value.diffuse_color = (*color, 1.0)
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return value


def move(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, loc, dims, material, collection, bevel=0.04, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value / 2 for value in dims)
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("soft_edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    obj.data.materials.append(material)
    return move(obj, collection)


def cylinder(name, loc, radius, depth, material, collection, vertices=20, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    obj.data.materials.append(material)
    return move(obj, collection)


def sphere(name, loc, scale, material, collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return move(obj, collection)


def cone(name, loc, r1, r2, depth, material, collection):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r1, radius2=r2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return move(obj, collection)


def text_label(name, body, loc, size, material, collection):
    bpy.ops.object.text_add(location=loc, rotation=(math.radians(90), 0, math.radians(180)))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.025
    obj.data.bevel_depth = 0.008
    obj.data.materials.append(material)
    return move(obj, collection)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


for old_name in (
    "WELLNESS_WILLOW_DETAIL",
    "WELLNESS_WILLOW_PROPS",
    "WELLNESS_WILLOW_LABELS",
    "WELLNESS_WILLOW_INTERIOR_REFINEMENT",
    "ALLTIMEFITNESS_DETAIL",
    "ALLTIMEFITNESS_PROPS",
    "ALLTIMEFITNESS_LABELS",
):
    old_detail = bpy.data.collections.get(old_name)
    if old_detail:
        old_detail.hide_render = True
        old_detail.hide_viewport = True
old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
shop = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(shop)

floor = mat("Wellness_Refined_Floor", (0.23, 0.38, 0.29), 0.92)
wood = mat("Wellness_Refined_Wood", (0.35, 0.17, 0.075), 0.82)
cream = mat("Wellness_Refined_Cream", (0.94, 0.86, 0.69), 0.78)
sage = mat("Wellness_Refined_Sage", (0.35, 0.61, 0.42), 0.74)
green = mat("Wellness_Refined_Green", (0.16, 0.43, 0.22), 0.80)
lavender = mat("Wellness_Refined_Lavender", (0.55, 0.40, 0.73), 0.70)
coral = mat("Wellness_Refined_Coral", (0.88, 0.33, 0.26), 0.70)
blue = mat("Wellness_Refined_Blue", (0.21, 0.46, 0.67), 0.70)
pink = mat("Wellness_Refined_Pink", (0.88, 0.42, 0.55), 0.70)
gold = mat("Wellness_Refined_Gold", (0.85, 0.52, 0.14), 0.42, 0.30)
dark = mat("Wellness_Refined_Dark", (0.04, 0.06, 0.045), 0.58)
glow = mat("Wellness_Refined_Glow", (1.0, 0.62, 0.20), 0.40, emission=(1.0, 0.38, 0.08), strength=1.5)

# Sealed Level-3 shell and broad central arrival route.
cube("Refined_Wellness_Floor", (20, -14.0, 10.045), (11.2, 6.0, 0.09), floor, shop, 0.08)
cube("Refined_Wellness_Entry_Mat", (20, -10.95, 10.10), (3.2, 0.72, 0.12), sage, shop, 0.10)
cube("Refined_Wellness_Back_Wall", (20.0, -17.12, 12.50), (11.2, 0.28, 4.90), cream, shop, 0.06)
cube("Refined_Wellness_Left_Wall", (14.40, -14.0, 12.50), (0.28, 6.20, 4.90), cream, shop, 0.06)
cube("Refined_Wellness_Right_Wall", (25.60, -14.0, 12.50), (0.28, 6.20, 4.90), cream, shop, 0.06)
cube("Refined_Wellness_Ceiling", (20.0, -14.0, 14.88), (11.2, 6.0, 0.20), cream, shop, 0.05)
cube("AllTimeFitness_Sign_Back", (20.0, -16.72, 14.08), (5.5, 0.12, 0.82), green, shop, 0.08)
text_label("AllTimeFitness_Sign", "ALLTIMEFITNESS", (20.0, -16.64, 14.08), 0.48, cream, shop)

# Supported product wall: hydration, towels, candles, and care bottles.
cube("Wellness_Product_Back", (20.0, -16.92, 11.78), (9.5, 0.12, 3.15), dark, shop, 0.04)
for z in (10.42, 11.14, 11.86, 12.58, 13.30):
    cube(f"Wellness_Product_Shelf_{z}", (20.0, -16.64, z), (9.5, 0.58, 0.12), wood, shop, 0.04)
for x in (15.32, 17.65, 20.0, 22.35, 24.68):
    cube(f"Wellness_Product_Divider_{x}", (x, -16.64, 11.86), (0.12, 0.58, 2.78), gold, shop, 0.03)

for index, x in enumerate((15.75, 16.35, 16.95, 17.55, 18.15)):
    cylinder(f"Wellness_Bottle_{index}", (x, -16.31, 10.73), 0.11, 0.50, (sage, lavender, blue, coral, pink)[index], shop, 18)
    cylinder(f"Wellness_Bottle_Cap_{index}", (x, -16.31, 11.02), 0.07, 0.08, gold, shop, 14)
for index, x in enumerate((19.15, 20.0, 20.85)):
    for layer in range(3):
        cube(f"Folded_Towel_{index}_{layer}", (x, -16.31, 11.26 + layer * 0.12), (0.68, 0.46, 0.12), (cream, sage, lavender)[index], shop, 0.05)
for index, x in enumerate((21.85, 22.55, 23.25, 23.95)):
    cylinder(f"Aroma_Candle_{index}", (x, -16.31, 11.37), 0.16, 0.34, (cream, coral, lavender, sage)[index], shop, 20)
    sphere(f"Aroma_Flame_{index}", (x, -16.31, 11.62), (0.05, 0.05, 0.08), glow, shop)
for index, x in enumerate((16.2, 17.2, 18.2, 19.2, 20.2, 21.2, 22.2, 23.2)):
    cylinder(f"Care_Jar_{index}", (x, -16.31, 12.76), 0.17, 0.24, (sage, cream, lavender, coral)[index % 4], shop, 20)
    cylinder(f"Care_Jar_Lid_{index}", (x, -16.31, 12.91), 0.18, 0.06, gold, shop, 20)

# Yoga demonstration zone on the left, with rolled stock on a side rack.
cube("Wellness_Yoga_Rug", (16.75, -13.65, 10.10), (2.80, 3.25, 0.10), sage, shop, 0.10)
for index, x in enumerate((16.15, 17.35)):
    cube(f"Yoga_Demo_Mat_{index}", (x, -13.70, 10.18), (0.92, 2.45, 0.12), (lavender, blue)[index], shop, 0.06)
    cylinder(f"Yoga_Block_A_{index}", (x - 0.22, -12.65, 10.39), 0.0 + 0.14, 0.28, coral, shop, 16)
    cube(f"Yoga_Block_B_{index}", (x + 0.23, -12.65, 10.36), (0.34, 0.24, 0.32), cream, shop, 0.06)
cube("Rolled_Mat_Rack", (15.30, -15.55, 10.54), (0.72, 1.85, 0.82), wood, shop, 0.10)
for index, y in enumerate((-16.15, -15.55, -14.95)):
    cylinder(f"Rolled_Yoga_Mat_{index}", (15.30, y, 11.03), 0.20, 0.62, (coral, lavender, blue)[index], shop, 20, (0, math.radians(90), 0))

# Meditation nook on the right faces a low willow planter.
cube("Meditation_Rug", (23.10, -14.20, 10.10), (3.05, 2.65, 0.10), lavender, shop, 0.10)
for index, (x, y, material) in enumerate(((22.35, -13.80, pink), (23.15, -13.45, blue), (23.85, -13.95, sage))):
    cylinder(f"Meditation_Cushion_{index}", (x, y, 10.24), 0.42, 0.18, material, shop, 28)
cylinder("Willow_Planter", (23.15, -15.10, 10.39), 0.48, 0.68, wood, shop, 24)
cylinder("Willow_Trunk", (23.15, -15.10, 11.05), 0.10, 0.82, wood, shop, 16)
for index, angle in enumerate((0.0, 1.25, 2.5, 3.75, 5.0)):
    sphere(f"Willow_Leaf_{index}", (23.15 + math.cos(angle) * 0.38, -15.10 + math.sin(angle) * 0.22, 11.55 + 0.12 * (index % 2)), (0.34, 0.20, 0.42), green if index % 2 == 0 else sage, shop)

# Hydration station and side reception preserve the central path.
cube("Hydration_Table", (15.40, -11.65, 10.54), (1.65, 0.92, 0.82), wood, shop, 0.10)
cylinder("Water_Dispenser", (15.40, -11.65, 11.26), 0.30, 0.62, blue, shop, 24)
for index, x in enumerate((15.05, 15.75)):
    cylinder(f"Water_Cup_{index}", (x, -11.65, 11.06), 0.10, 0.22, cream, shop, 18)
cube("Wellness_Reception", (24.55, -11.55, 10.64), (1.70, 0.92, 1.18), wood, shop, 0.10)
cube("Wellness_Register", (24.55, -11.55, 11.39), (0.48, 0.42, 0.42), dark, shop, 0.06)
cylinder("Wellness_Staff_Workspot", (24.55, -12.38, 10.12), 0.42, 0.025, gold, shop, 28)

for index, (x, y, material) in enumerate(((16.7, -13.3, sage), (20.0, -14.2, cream), (23.2, -13.8, lavender))):
    cylinder(f"Wellness_Pendant_Cord_{index}", (x, y, 14.15), 0.025, 1.45, dark, shop, 10)
    cone(f"Wellness_Pendant_Shade_{index}", (x, y, 13.38), 0.38, 0.20, 0.52, material, shop)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 13.14))
    light = bpy.context.object
    light.name = f"Wellness_Pendant_Light_{index}"
    light.data.energy = 85
    light.data.color = (1.0, 0.64, 0.38)
    light.data.shadow_soft_size = 0.72
    move(light, shop)

camera = bpy.data.objects.get("AllTimeFitness_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(20.0, -10.05, 13.35))
    camera = bpy.context.object
    camera.name = "AllTimeFitness_Refined_Camera"
    move(camera, shop)
camera.location = (20.0, -10.05, 13.35)
camera.data.lens = 15
aim(camera, (20.0, -14.35, 10.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("AllTimeFitness_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, -10.72, 13.28))
    key = bpy.context.object
    key.name = "AllTimeFitness_Refined_Key"
    move(key, shop)
key.data.energy = 700
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (20.0, -14.2, 10.9))

fill = bpy.data.objects.get("AllTimeFitness_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, -14.1, 13.45))
    fill = bpy.context.object
    fill.name = "AllTimeFitness_Refined_Fill"
    move(fill, shop)
fill.data.energy = 320
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (20.0, -14.1, 10.6))

scene = bpy.context.scene
scene["alltimefitness_refinement_pass"] = "walk-in-shop-form-v2-supported-products"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 80
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.35
scene.render.filepath = str(RENDER)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("ALLTIMEFITNESS_REFINED_READY", MASTER)
print("ALLTIMEFITNESS_REFINED_RENDER", RENDER)
