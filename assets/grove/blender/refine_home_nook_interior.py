import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "home_nook_refined_blender.png"
COLLECTION_NAME = "HOME_NOOK_INTERIOR_REFINEMENT"


def mat(name, color, roughness=0.72, metallic=0.0):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.use_nodes = True
    value.diffuse_color = (*color, 1.0)
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return value


def move(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, loc, dims, material, collection, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value / 2 for value in dims)
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


def cone(name, loc, radius1, radius2, depth, material, collection):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=radius1, radius2=radius2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return move(obj, collection)


def torus(name, loc, major, minor, material, collection, rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=24, minor_segments=8, location=loc)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    obj.data.materials.append(material)
    return move(obj, collection)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def shelf(name, x, width, collection):
    cube(f"{name}_Back", (x, 16.92, 1.52), (width, 0.12, 2.68), sage_dark, collection, 0.03)
    for z in (0.36, 1.02, 1.68, 2.34, 2.86):
        cube(f"{name}_Shelf_{z}", (x, 16.67, z), (width, 0.58, 0.12), wood, collection, 0.04)
    for side in (-1, 1):
        cube(f"{name}_Side_{side}", (x + side * (width / 2 - 0.07), 16.67, 1.58), (0.14, 0.58, 2.56), wood, collection, 0.04)


for old_name in ("HOME_NOOK_DETAIL", "HOME_NOOK_INDIVIDUAL_PROPS", "HOME_NOOK_LABELS"):
    old = bpy.data.collections.get(old_name)
    if old:
        old.hide_render = True
        old.hide_viewport = True
old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
shop = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(shop)

floor = mat("Home_Refined_Floor", (0.50, 0.40, 0.30), 0.90)
wood = mat("Home_Refined_Wood", (0.43, 0.20, 0.09), 0.80)
cream = mat("Home_Refined_Cream", (0.94, 0.84, 0.65), 0.78)
sage = mat("Home_Refined_Sage", (0.35, 0.60, 0.39), 0.74)
sage_dark = mat("Home_Refined_Sage_Dark", (0.10, 0.20, 0.14), 0.90)
coral = mat("Home_Refined_Coral", (0.88, 0.31, 0.22), 0.70)
teal = mat("Home_Refined_Teal", (0.10, 0.45, 0.50), 0.68)
pink = mat("Home_Refined_Pink", (0.90, 0.42, 0.53), 0.70)
blue = mat("Home_Refined_Blue", (0.24, 0.46, 0.70), 0.70)
gold = mat("Home_Refined_Gold", (0.86, 0.53, 0.14), 0.40, 0.35)
dark = mat("Home_Refined_Dark", (0.05, 0.07, 0.06), 0.56)

# Continuous shop floor and a generous arrival lane from the mall.
cube("Refined_Home_Floor", (20, 14.0, 0.045), (11.2, 6.0, 0.09), floor, shop, 0.08)
cube("Refined_Home_Entry_Mat", (20, 10.95, 0.10), (3.2, 0.72, 0.12), sage, shop, 0.10)

# Back-wall kitchen, storage, and decor departments.
shelf("Kitchenware_Bay", 16.85, 4.7, shop)
shelf("Decor_Bay", 22.80, 4.7, shop)
for index, x in enumerate((15.55, 16.15, 16.75, 17.35)):
    cylinder(f"Ceramic_Mug_{index}", (x, 16.34, 1.20), 0.14, 0.24, (coral, teal, cream, pink)[index], shop, 18)
    torus(f"Ceramic_Mug_Handle_{index}", (x + 0.14, 16.34, 1.22), 0.09, 0.022, (coral, teal, cream, pink)[index], shop, (math.radians(90), 0, 0))
for index, x in enumerate((15.70, 16.55, 17.40)):
    cylinder(f"Dinner_Plate_{index}", (x, 16.34, 1.82), 0.28, 0.05, (cream, blue, coral)[index], shop, 28, (math.radians(90), 0, 0))
cube("Kettle_Body", (18.0, 16.32, 1.29), (0.52, 0.42, 0.42), cream, shop, 0.09)
torus("Kettle_Handle", (18.0, 16.32, 1.63), 0.24, 0.038, gold, shop, (math.radians(90), 0, 0))
cone("Kettle_Spout", (18.35, 16.32, 1.41), 0.12, 0.035, 0.38, cream, shop)

for index, (x, z, material) in enumerate(((21.55, 1.26, teal), (22.25, 1.26, coral), (22.95, 1.26, sage), (23.65, 1.26, pink))):
    cube(f"Storage_Box_{index}", (x, 16.34, z), (0.56, 0.42, 0.36), material, shop, 0.06)
    cube(f"Storage_Box_Lid_{index}", (x, 16.34, z + 0.21), (0.62, 0.46, 0.07), cream, shop, 0.03)
for index, (x, material) in enumerate(((21.65, blue), (22.55, cream), (23.45, coral))):
    cone(f"Decor_Vase_{index}", (x, 16.34, 2.69), 0.22, 0.13, 0.58, material, shop)
    for flower in (-0.10, 0.10):
        cylinder(f"Vase_Stem_{index}_{flower}", (x + flower, 16.34, 3.02), 0.018, 0.38, sage, shop, 10)
        sphere(f"Vase_Flower_{index}_{flower}", (x + flower, 16.34, 3.18), (0.12, 0.12, 0.10), pink, shop)

# Living-room vignette sits to the left, entirely outside the central route.
cube("Living_Rug", (16.80, 13.15, 0.09), (3.30, 2.30, 0.10), teal, shop, 0.10)
cube("Armchair_Seat", (16.55, 13.45, 0.62), (1.20, 1.00, 0.44), cream, shop, 0.14)
cube("Armchair_Back", (16.55, 13.88, 1.20), (1.20, 0.26, 1.20), cream, shop, 0.14)
for side in (-1, 1):
    cube(f"Armchair_Arm_{side}", (16.55 + side * 0.64, 13.45, 0.88), (0.22, 1.00, 0.62), cream, shop, 0.10)
cube("Armchair_Cushion", (16.55, 13.25, 0.92), (0.78, 0.28, 0.62), coral, shop, 0.12)
cylinder("Side_Table_Top", (18.15, 13.30, 0.78), 0.48, 0.12, wood, shop, 28)
cylinder("Side_Table_Stem", (18.15, 13.30, 0.42), 0.07, 0.70, gold, shop, 16)
cylinder("Table_Lamp_Base", (18.15, 13.30, 0.91), 0.20, 0.09, gold, shop, 24)
cylinder("Table_Lamp_Stem", (18.15, 13.30, 1.25), 0.035, 0.68, gold, shop, 14)
cone("Table_Lamp_Shade", (18.15, 13.30, 1.68), 0.34, 0.20, 0.46, pink, shop)

# Low central display remains visually open and carries individual textiles and decor.
cube("Home_Center_Table", (22.10, 13.70, 0.62), (2.80, 1.12, 0.92), wood, shop, 0.10)
for index, material in enumerate((pink, sage, cream)):
    cube(f"Folded_Throw_{index}", (21.45, 13.70, 1.135 + index * 0.11), (0.84, 0.66, 0.11), material, shop, 0.05)
cylinder("Center_Vase", (22.35, 13.70, 1.25), 0.18, 0.44, blue, shop, 22)
for index, x in enumerate((22.95, 23.28, 23.61)):
    cylinder(f"Scented_Candle_{index}", (x, 13.70, 1.18), 0.12, 0.24, (coral, cream, teal)[index], shop, 20)

# Checkout and plant form a service pocket on the right edge of arrival.
cube("Home_Checkout", (24.55, 11.70, 0.64), (1.62, 0.94, 1.18), wood, shop, 0.10)
cube("Home_Register", (24.55, 11.70, 1.40), (0.50, 0.42, 0.42), dark, shop, 0.06)
cylinder("Home_Planter", (23.35, 11.70, 0.36), 0.34, 0.62, coral, shop, 24)
for index, offset in enumerate(((-0.22, 0.0), (0.0, 0.12), (0.22, 0.0), (-0.10, -0.12), (0.12, -0.10))):
    sphere(f"Home_Plant_Leaf_{index}", (23.35 + offset[0], 11.70 + offset[1], 0.92 + 0.10 * (index % 2)), (0.24, 0.16, 0.42), sage, shop)

# Supported pendant fixtures clarify the living, route, and service zones.
for index, (x, y, material) in enumerate(((16.7, 13.2, coral), (20.0, 14.2, sage), (23.5, 12.2, teal))):
    cylinder(f"Home_Pendant_Cord_{index}", (x, y, 4.12), 0.025, 1.42, dark, shop, 10)
    cone(f"Home_Pendant_Shade_{index}", (x, y, 3.36), 0.38, 0.20, 0.52, material, shop)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 3.12))
    light = bpy.context.object
    light.name = f"Home_Pendant_Light_{index}"
    light.data.energy = 90
    light.data.color = (1.0, 0.68, 0.40)
    light.data.shadow_soft_size = 0.72
    move(light, shop)

# Positive-Y shops face the atrium from the opposite edge; mirror the authored
# layout so shelving sits against the real back wall and the threshold stays open.
for obj in list(shop.objects):
    obj.location.y = 28.0 - obj.location.y

camera = bpy.data.objects.get("Home_Nook_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(20.0, 17.95, 3.35))
    camera = bpy.context.object
    camera.name = "Home_Nook_Refined_Camera"
    move(camera, shop)
camera.location = (20.0, 17.95, 3.35)
camera.data.lens = 15
aim(camera, (20.0, 13.65, 0.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Home_Nook_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, 17.28, 3.28))
    key = bpy.context.object
    key.name = "Home_Nook_Refined_Key"
    move(key, shop)
key.location = (20.0, 17.28, 3.28)
key.data.energy = 720
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (20.0, 13.8, 0.9))

fill = bpy.data.objects.get("Home_Nook_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, 14.2, 3.45))
    fill = bpy.context.object
    fill.name = "Home_Nook_Refined_Fill"
    move(fill, shop)
fill.data.energy = 330
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (20.0, 14.2, 0.6))

scene = bpy.context.scene
scene["home_nook_refinement_pass"] = "walk-in-shop-form-v1"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 80
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.45
scene.render.filepath = str(RENDER)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("HOME_NOOK_REFINED_READY", MASTER)
print("HOME_NOOK_REFINED_RENDER", RENDER)
