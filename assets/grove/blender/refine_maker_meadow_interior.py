import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "maker_meadow_refined_blender.png"
COLLECTION_NAME = "MAKER_MEADOW_INTERIOR_REFINEMENT"


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


for old_name in ("MAKER_MEADOW_DETAIL", "MAKER_MEADOW_PROPS", "MAKER_MEADOW_LABELS"):
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

floor = mat("Maker_Refined_Floor", (0.26, 0.42, 0.32), 0.90)
wood = mat("Maker_Refined_Wood", (0.42, 0.20, 0.08), 0.80)
cream = mat("Maker_Refined_Cream", (0.94, 0.84, 0.66), 0.76)
mint = mat("Maker_Refined_Mint", (0.32, 0.67, 0.50), 0.70)
coral = mat("Maker_Refined_Coral", (0.90, 0.32, 0.25), 0.68)
pink = mat("Maker_Refined_Pink", (0.89, 0.42, 0.56), 0.68)
blue = mat("Maker_Refined_Blue", (0.20, 0.45, 0.72), 0.68)
lavender = mat("Maker_Refined_Lavender", (0.55, 0.38, 0.75), 0.68)
gold = mat("Maker_Refined_Gold", (0.87, 0.53, 0.13), 0.40, 0.35)
dark = mat("Maker_Refined_Dark", (0.045, 0.065, 0.055), 0.56)

# Level-2 floor and open arrival lane from the south atrium edge.
cube("Refined_Maker_Floor", (-20, 14.0, 5.045), (11.2, 6.0, 0.09), floor, shop, 0.08)
cube("Refined_Maker_Entry_Mat", (-20, 17.05, 5.10), (3.2, 0.72, 0.12), mint, shop, 0.10)
cube("Refined_Maker_Back_Wall", (-20.0, 10.88, 7.50), (11.2, 0.28, 4.90), cream, shop, 0.06)
cube("Refined_Maker_Left_Wall", (-25.60, 14.0, 7.50), (0.28, 6.20, 4.90), cream, shop, 0.06)
cube("Refined_Maker_Right_Wall", (-14.40, 14.0, 7.50), (0.28, 6.20, 4.90), cream, shop, 0.06)
cube("Refined_Maker_Ceiling", (-20.0, 14.0, 9.88), (11.2, 6.0, 0.20), cream, shop, 0.05)

# Back craft wall with exact shelf contact planes.
cube("Maker_Supply_Back", (-20.0, 11.00, 6.70), (9.5, 0.12, 2.95), dark, shop, 0.04)
for z in (5.42, 6.12, 6.82, 7.52, 8.16):
    cube(f"Maker_Supply_Shelf_{z}", (-20.0, 11.30, z), (9.5, 0.62, 0.12), wood, shop, 0.04)
for x in (-24.68, -22.35, -20.0, -17.65, -15.32):
    cube(f"Maker_Supply_Divider_{x}", (x, 11.30, 6.79), (0.12, 0.62, 2.62), gold, shop, 0.03)

# Yarn rests directly on the lower shelf.
for index, x in enumerate((-23.70, -22.85, -22.00, -21.15)):
    sphere(f"Yarn_Ball_{index}", (x, 11.64, 6.46), (0.24, 0.24, 0.22), (pink, lavender, mint, coral)[index], shop)
    torus(f"Yarn_Wrap_{index}", (x, 11.64, 6.46), 0.17, 0.025, cream, shop, (math.radians(90), 0, 0))

# Fabric bolts stand on the next shelf, with visible cores and labels.
for index, x in enumerate((-20.55, -19.75, -18.95, -18.15)):
    cylinder(f"Fabric_Bolt_{index}", (x, 11.64, 7.06), 0.18, 0.36, (blue, coral, mint, lavender)[index], shop, 20)
    cylinder(f"Fabric_Core_{index}", (x, 11.64, 7.06), 0.055, 0.38, cream, shop, 14)

# Paint, glue and tool boxes occupy the upper shelf without floating.
for index, x in enumerate((-17.15, -16.55, -15.95)):
    cylinder(f"Paint_Can_{index}", (x, 11.64, 7.74), 0.17, 0.32, (blue, coral, mint)[index], shop, 20)
    torus(f"Paint_Handle_{index}", (x, 11.64, 7.98), 0.15, 0.02, gold, shop, (math.radians(90), 0, 0))
for index, x in enumerate((-23.2, -22.0, -20.8)):
    cube(f"Craft_Kit_{index}", (x, 11.64, 8.32), (0.82, 0.48, 0.20), (coral, blue, lavender)[index], shop, 0.05)

# Sewing station on the left perimeter.
cube("Sewing_Table", (-23.15, 13.45, 5.64), (2.55, 1.18, 0.98), wood, shop, 0.10)
cube("Sewing_Table_Top", (-23.15, 13.45, 6.16), (2.65, 1.28, 0.10), cream, shop, 0.04)
cube("Sewing_Machine_Base", (-23.15, 13.45, 6.30), (1.20, 0.62, 0.20), dark, shop, 0.06)
cube("Sewing_Machine_Arm", (-23.48, 13.45, 6.68), (0.54, 0.52, 0.72), lavender, shop, 0.09)
cube("Sewing_Machine_Nose", (-22.98, 13.45, 6.82), (0.72, 0.46, 0.22), lavender, shop, 0.06)
cylinder("Sewing_Spool", (-23.45, 13.45, 7.12), 0.10, 0.20, pink, shop, 18)
cylinder("Sewing_Thread", (-22.72, 13.45, 6.48), 0.025, 0.46, gold, shop, 10)

# Art and tool station on the right perimeter.
cube("Maker_Workbench", (-16.85, 13.50, 5.64), (2.70, 1.20, 0.98), wood, shop, 0.10)
cube("Maker_Workbench_Top", (-16.85, 13.50, 6.16), (2.80, 1.30, 0.10), cream, shop, 0.04)
for index, x in enumerate((-17.55, -17.00, -16.45)):
    cylinder(f"Workbench_Paint_{index}", (x, 13.50, 6.34), 0.14, 0.30, (coral, blue, mint)[index], shop, 18)
cube("Maker_Toolbox", (-15.85, 13.50, 6.36), (0.72, 0.46, 0.34), coral, shop, 0.06)
torus("Maker_Toolbox_Handle", (-15.85, 13.50, 6.62), 0.22, 0.035, gold, shop, (math.radians(90), 0, 0))

# Two workshop stools face their respective activity tables and keep center clear.
for index, (x, y, material) in enumerate(((-23.15, 15.00, pink), (-16.85, 15.00, blue))):
    cylinder(f"Maker_Stool_{index}", (x, y, 5.56), 0.34, 0.16, material, shop, 22)
    cylinder(f"Maker_Stool_Leg_{index}", (x, y, 5.29), 0.055, 0.54, gold, shop, 14)

# Compact checkout and carry baskets stay outside the arrival route.
cube("Maker_Checkout", (-15.25, 16.10, 5.64), (1.60, 0.92, 1.18), wood, shop, 0.10)
cube("Maker_Register", (-15.25, 16.10, 6.39), (0.48, 0.42, 0.42), dark, shop, 0.06)
for index, x in enumerate((-24.50, -23.82)):
    cube(f"Maker_Basket_{index}", (x, 16.05, 5.30), (0.56, 0.42, 0.34), (coral, mint)[index], shop, 0.07)
    cube(f"Maker_Basket_Handle_{index}", (x, 16.05, 5.58), (0.42, 0.06, 0.26), dark, shop, 0.025)

for index, (x, y, material) in enumerate(((-23.1, 13.4, lavender), (-20.0, 14.1, mint), (-16.8, 13.5, coral))):
    cylinder(f"Maker_Pendant_Cord_{index}", (x, y, 9.15), 0.025, 1.45, dark, shop, 10)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.38, radius2=0.20, depth=0.52, location=(x, y, 8.38))
    shade = bpy.context.object
    shade.name = f"Maker_Pendant_Shade_{index}"
    shade.data.materials.append(material)
    move(shade, shop)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 8.14))
    light = bpy.context.object
    light.name = f"Maker_Pendant_Light_{index}"
    light.data.energy = 88
    light.data.color = (1.0, 0.66, 0.38)
    light.data.shadow_soft_size = 0.72
    move(light, shop)

camera = bpy.data.objects.get("Maker_Meadow_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(-20.0, 17.95, 8.35))
    camera = bpy.context.object
    camera.name = "Maker_Meadow_Refined_Camera"
    move(camera, shop)
camera.location = (-20.0, 17.95, 8.35)
camera.data.lens = 15
aim(camera, (-20.0, 13.65, 5.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Maker_Meadow_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, 17.28, 8.28))
    key = bpy.context.object
    key.name = "Maker_Meadow_Refined_Key"
    move(key, shop)
key.data.energy = 700
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (-20.0, 13.8, 5.9))

fill = bpy.data.objects.get("Maker_Meadow_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, 14.1, 8.45))
    fill = bpy.context.object
    fill.name = "Maker_Meadow_Refined_Fill"
    move(fill, shop)
fill.data.energy = 320
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (-20.0, 14.1, 5.6))

scene = bpy.context.scene
scene["maker_meadow_refinement_pass"] = "walk-in-shop-form-v1"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 80
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.40
scene.render.filepath = str(RENDER)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("MAKER_MEADOW_REFINED_READY", MASTER)
print("MAKER_MEADOW_REFINED_RENDER", RENDER)
