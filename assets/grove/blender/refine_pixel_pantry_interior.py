import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "pixel_pantry_refined_blender.png"
COLLECTION_NAME = "PIXEL_PANTRY_INTERIOR_REFINEMENT"


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


def controller(name, x, y, support_z, body_mat, accent_mat, collection, scale=1.0):
    body_h = 0.17 * scale
    cube(name, (x, y, support_z + body_h / 2), (0.62 * scale, 0.34 * scale, body_h), body_mat, collection, 0.09 * scale)
    cylinder(f"{name}_Stick_L", (x - 0.15 * scale, y - 0.10 * scale, support_z + body_h + 0.035), 0.05 * scale, 0.05, dark, collection, 16)
    cylinder(f"{name}_Stick_R", (x + 0.05 * scale, y - 0.10 * scale, support_z + body_h + 0.035), 0.05 * scale, 0.05, dark, collection, 16)
    for index, offset in enumerate(((0.17, -0.08), (0.23, -0.02), (0.17, 0.04), (0.11, -0.02))):
        cylinder(f"{name}_Button_{index}", (x + offset[0] * scale, y + offset[1] * scale, support_z + body_h + 0.035), 0.025 * scale, 0.04, accent_mat, collection, 12)


for old_name in ("PIXEL_PANTRY_DETAIL", "PIXEL_PANTRY_PROPS", "PIXEL_PANTRY_LABELS"):
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

floor = mat("Pixel_Refined_Floor", (0.16, 0.21, 0.36), 0.90)
wood = mat("Pixel_Refined_Wood", (0.32, 0.15, 0.07), 0.80)
cream = mat("Pixel_Refined_Cream", (0.94, 0.84, 0.65), 0.76)
dark = mat("Pixel_Refined_Dark", (0.025, 0.035, 0.065), 0.52)
blue = mat("Pixel_Refined_Blue", (0.16, 0.42, 0.78), 0.66)
cyan = mat("Pixel_Refined_Cyan", (0.18, 0.70, 0.77), 0.62)
violet = mat("Pixel_Refined_Violet", (0.52, 0.30, 0.76), 0.66)
coral = mat("Pixel_Refined_Coral", (0.91, 0.31, 0.28), 0.66)
mint = mat("Pixel_Refined_Mint", (0.32, 0.68, 0.52), 0.70)
pink = mat("Pixel_Refined_Pink", (0.89, 0.40, 0.57), 0.68)
gold = mat("Pixel_Refined_Gold", (0.88, 0.54, 0.13), 0.40, 0.35)
screen = mat("Pixel_Refined_Screen", (0.08, 0.35, 0.55), 0.28, emission=(0.08, 0.58, 0.90), strength=1.6)

# Level-2 substrate and reserved entrance lane.
cube("Refined_Pixel_Floor", (20, -14.0, 5.045), (11.2, 6.0, 0.09), floor, shop, 0.08)
cube("Refined_Pixel_Entry_Mat", (20, -10.95, 5.10), (3.2, 0.72, 0.12), cyan, shop, 0.10)

# Back-wall games library, fully dressed with supported cases and cartridges.
cube("Pixel_Gamewall_Back", (20.0, -17.00, 6.70), (9.5, 0.12, 2.95), dark, shop, 0.04)
for z in (5.42, 6.12, 6.82, 7.52, 8.16):
    cube(f"Pixel_Gamewall_Shelf_{z}", (20.0, -16.70, z), (9.5, 0.62, 0.12), wood, shop, 0.04)
for x in (15.32, 17.65, 20.0, 22.35, 24.68):
    cube(f"Pixel_Gamewall_Divider_{x}", (x, -16.70, 6.79), (0.12, 0.62, 2.62), gold, shop, 0.03)

case_colors = (coral, cyan, violet, mint, pink, blue)
for row, support_z in enumerate((6.18, 6.88, 7.58)):
    for index, x in enumerate((15.85, 16.65, 17.45, 18.25, 19.05, 20.95, 21.75, 22.55, 23.35, 24.15)):
        cube(f"Game_Case_{row}_{index}", (x, -16.36, support_z + 0.31), (0.48, 0.20, 0.62), case_colors[(row + index) % len(case_colors)], shop, 0.04)
        cube(f"Game_Case_Label_{row}_{index}", (x, -16.245, support_z + 0.34), (0.32, 0.025, 0.14), cream, shop, 0.02)
for index, x in enumerate((17.1, 18.25, 21.75, 22.9)):
    cube(f"Game_Cartridge_{index}", (x, -16.35, 8.26), (0.48, 0.20, 0.20), dark, shop, 0.04)
    cube(f"Game_Cartridge_Label_{index}", (x, -16.235, 8.27), (0.24, 0.025, 0.10), case_colors[index], shop, 0.015)

# Low center island keeps the doorway-to-back-wall sightline open.
cube("Pixel_Center_Island", (20.0, -14.10, 5.62), (4.20, 1.18, 0.92), wood, shop, 0.10)
cube("Pixel_Center_Island_Top", (20.0, -14.10, 6.11), (4.34, 1.28, 0.10), cream, shop, 0.04)
for index, x in enumerate((18.75, 19.55, 20.45, 21.25)):
    cube(f"Handheld_Console_{index}", (x, -14.10, 6.22), (0.66, 0.38, 0.16), dark, shop, 0.07)
    cube(f"Handheld_Screen_{index}", (x, -14.31, 6.24), (0.34, 0.025, 0.09), screen, shop, 0.015)
    cylinder(f"Handheld_Button_{index}", (x + 0.22, -14.31, 6.28), 0.025, 0.03, case_colors[index], shop, 12, (math.radians(90), 0, 0))

# Playable demo station sits to the left, with screen, console and two controllers.
cube("Pixel_Demo_Rug", (16.40, -12.85, 5.10), (2.90, 2.20, 0.10), violet, shop, 0.10)
cube("Pixel_Demo_Stand", (16.25, -13.15, 5.68), (2.15, 0.78, 1.12), wood, shop, 0.10)
cube("Pixel_Demo_Screen_Frame", (16.25, -13.50, 7.10), (2.35, 0.16, 1.45), dark, shop, 0.08)
cube("Pixel_Demo_Screen", (16.25, -13.405, 7.10), (2.02, 0.035, 1.12), screen, shop, 0.03)
cube("Pixel_Demo_Console", (16.25, -12.98, 6.32), (0.92, 0.42, 0.22), blue, shop, 0.07)
controller("Demo_Controller_A", 15.72, -12.86, 6.25, coral, cyan, shop, 0.85)
controller("Demo_Controller_B", 16.78, -12.86, 6.25, cyan, coral, shop, 0.85)

# Headphone and accessory display remains on the right perimeter.
cube("Pixel_Accessory_Table", (23.55, -14.45, 5.62), (2.25, 1.00, 0.92), wood, shop, 0.10)
for index, x in enumerate((22.95, 23.55, 24.15)):
    cylinder(f"Headphone_Stand_{index}", (x, -14.45, 6.38), 0.035, 0.46, gold, shop, 12)
    torus(f"Gaming_Headphones_{index}", (x, -14.45, 6.54), 0.20, 0.045, (pink, cyan, coral)[index], shop, (math.radians(90), 0, 0))
for index, x in enumerate((23.15, 23.95)):
    cylinder(f"Cable_Coil_{index}", (x, -14.45, 6.18), 0.16, 0.10, dark, shop, 24)

# Compact service counter leaves a 1.2 m employee pocket against the side wall.
cube("Pixel_Service_Counter", (24.35, -11.80, 5.64), (1.90, 0.92, 1.18), wood, shop, 0.10)
cube("Pixel_Register", (24.35, -11.80, 6.39), (0.50, 0.42, 0.42), dark, shop, 0.06)
cylinder("Pixel_Staff_Workspot", (24.35, -12.62, 5.12), 0.42, 0.025, gold, shop, 28)

for index, (x, y, material) in enumerate(((16.3, -12.8, blue), (20.0, -14.1, violet), (23.5, -13.2, cyan))):
    cylinder(f"Pixel_Pendant_Cord_{index}", (x, y, 9.15), 0.025, 1.45, dark, shop, 10)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.38, radius2=0.20, depth=0.52, location=(x, y, 8.38))
    shade = bpy.context.object
    shade.name = f"Pixel_Pendant_Shade_{index}"
    shade.data.materials.append(material)
    move(shade, shop)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 8.14))
    light = bpy.context.object
    light.name = f"Pixel_Pendant_Light_{index}"
    light.data.energy = 85
    light.data.color = (0.60, 0.76, 1.0)
    light.data.shadow_soft_size = 0.72
    move(light, shop)

camera = bpy.data.objects.get("Pixel_Pantry_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(20.0, -10.05, 8.35))
    camera = bpy.context.object
    camera.name = "Pixel_Pantry_Refined_Camera"
    move(camera, shop)
camera.location = (20.0, -10.05, 8.35)
camera.data.lens = 13
aim(camera, (20.0, -14.35, 5.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Pixel_Pantry_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, -10.72, 8.28))
    key = bpy.context.object
    key.name = "Pixel_Pantry_Refined_Key"
    move(key, shop)
key.data.energy = 700
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (20.0, -14.2, 5.9))

fill = bpy.data.objects.get("Pixel_Pantry_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, -14.1, 8.45))
    fill = bpy.context.object
    fill.name = "Pixel_Pantry_Refined_Fill"
    move(fill, shop)
fill.data.energy = 320
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (20.0, -14.1, 5.6))

scene = bpy.context.scene
scene["pixel_pantry_refinement_pass"] = "walk-in-shop-form-v1"
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
print("PIXEL_PANTRY_REFINED_READY", MASTER)
print("PIXEL_PANTRY_REFINED_RENDER", RENDER)
