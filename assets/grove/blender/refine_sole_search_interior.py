import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "sole_search_refined_blender.png"
COLLECTION_NAME = "SOLE_SEARCH_INTERIOR_REFINEMENT"


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


def cylinder(name, loc, radius, depth, material, collection, vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
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


def shoe(name, x, y, support_z, upper, accent, collection, scale=1.0):
    sole_h = 0.13 * scale
    sole_z = support_z + sole_h / 2
    cube(f"{name}_Sole", (x, y, sole_z), (0.74 * scale, 0.38 * scale, sole_h), cream, collection, 0.06 * scale)
    cube(f"{name}_Upper", (x - 0.06 * scale, y, support_z + sole_h + 0.13 * scale), (0.54 * scale, 0.34 * scale, 0.26 * scale), upper, collection, 0.08 * scale)
    cube(f"{name}_Toe", (x + 0.25 * scale, y, support_z + sole_h + 0.09 * scale), (0.24 * scale, 0.34 * scale, 0.18 * scale), accent, collection, 0.07 * scale)
    for index in range(3):
        cube(f"{name}_Lace_{index}", (x - 0.10 * scale + index * 0.10 * scale, y - 0.18 * scale, support_z + sole_h + 0.19 * scale), (0.18 * scale, 0.025, 0.018), cream, collection, 0.006)


for old_name in ("SOLE_SEARCH_DETAIL", "SOLE_SEARCH_INDIVIDUAL_PROPS", "SOLE_SEARCH_LABELS"):
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

floor = mat("Sole_Refined_Floor", (0.24, 0.30, 0.44), 0.90)
wood = mat("Sole_Refined_Wood", (0.38, 0.17, 0.08), 0.80)
cream = mat("Sole_Refined_Cream", (0.94, 0.84, 0.65), 0.76)
lavender = mat("Sole_Refined_Lavender", (0.54, 0.36, 0.75), 0.68)
coral = mat("Sole_Refined_Coral", (0.90, 0.33, 0.27), 0.68)
blue = mat("Sole_Refined_Blue", (0.20, 0.43, 0.72), 0.68)
mint = mat("Sole_Refined_Mint", (0.32, 0.67, 0.52), 0.72)
gold = mat("Sole_Refined_Gold", (0.86, 0.52, 0.13), 0.40, 0.35)
dark = mat("Sole_Refined_Dark", (0.04, 0.06, 0.08), 0.55)
pink = mat("Sole_Refined_Pink", (0.88, 0.40, 0.54), 0.68)

# Level-2 substrate and clear arrival path.
cube("Refined_Sole_Floor", (-20, -14.0, 5.045), (11.2, 6.0, 0.09), floor, shop, 0.08)
cube("Refined_Sole_Entry_Mat", (-20, -10.95, 5.10), (3.2, 0.72, 0.12), lavender, shop, 0.10)

# Open back-wall shoe library with exact shelf contact heights.
cube("Sole_Shelf_Back", (-20.0, -17.00, 6.70), (9.6, 0.12, 2.95), dark, shop, 0.04)
for z in (5.42, 6.12, 6.82, 7.52, 8.16):
    cube(f"Sole_Shelf_{z}", (-20.0, -16.70, z), (9.6, 0.62, 0.12), wood, shop, 0.04)
for x in (-24.72, -22.35, -20.0, -17.65, -15.28):
    cube(f"Sole_Shelf_Divider_{x}", (x, -16.70, 6.79), (0.12, 0.62, 2.62), gold, shop, 0.03)

for index, (x, material, accent) in enumerate(((-23.55, coral, mint), (-21.15, blue, cream), (-18.85, lavender, pink), (-16.45, mint, gold))):
    shoe(f"Wall_Sneaker_{index}", x, -16.36, 6.18, material, accent, shop, 0.92)
for index, x in enumerate((-23.20, -21.95, -20.70, -19.45)):
    cube(f"Shoe_Box_{index}", (x, -16.36, 7.02), (0.92, 0.52, 0.28), (coral, mint, blue, lavender)[index], shop, 0.05)
    cube(f"Shoe_Box_Lid_{index}", (x, -16.36, 7.18), (0.98, 0.56, 0.06), cream, shop, 0.025)

# Boot pair sits squarely on the upper shelf.
for index, x in enumerate((-17.65, -16.85)):
    cube(f"Ankle_Boot_Sole_{index}", (x, -16.36, 7.61), (0.68, 0.38, 0.14), cream, shop, 0.06)
    cube(f"Ankle_Boot_Foot_{index}", (x - 0.05, -16.36, 7.78), (0.54, 0.34, 0.26), dark, shop, 0.08)
    cube(f"Ankle_Boot_Shaft_{index}", (x - 0.20, -16.36, 8.02), (0.30, 0.34, 0.54), (gold, coral)[index], shop, 0.06)

# Side pedestals preserve the central route and carry hero shoes.
for index, (x, y, material) in enumerate(((-23.45, -12.65, mint), (-16.55, -12.65, coral))):
    cylinder(f"Hero_Pedestal_{index}", (x, y, 5.62), 0.78, 1.14, material, shop, 28)
    shoe(f"Hero_Sneaker_{index}", x, y, 6.19, (blue, lavender)[index], (mint, pink)[index], shop, 1.18)

# Fitting bench and accessory table create useful side destinations.
cube("Sole_Fitting_Bench", (-23.20, -14.65, 5.48), (2.60, 0.94, 0.72), cream, shop, 0.12)
cube("Sole_Bench_Cushion", (-23.20, -14.65, 5.90), (2.40, 0.80, 0.16), lavender, shop, 0.08)
cube("Sock_Accessory_Table", (-16.55, -14.65, 5.62), (2.40, 0.94, 0.92), wood, shop, 0.10)
for index, x in enumerate((-17.15, -16.75, -16.35, -15.95)):
    cylinder(f"Sock_Roll_{index}", (x, -14.65, 6.18), 0.14, 0.28, (coral, mint, blue, pink)[index], shop, 18)
for index, x in enumerate((-23.80, -23.20, -22.60)):
    cube(f"Try_On_Shoe_{index}", (x, -14.65, 6.06), (0.46, 0.32, 0.14), (coral, blue, mint)[index], shop, 0.06)

# Checkout remains at the right wall, outside the 3.2 m route.
cube("Sole_Checkout", (-15.35, -11.55, 5.64), (1.55, 0.92, 1.18), wood, shop, 0.10)
cube("Sole_Register", (-15.35, -11.55, 6.39), (0.48, 0.42, 0.42), dark, shop, 0.06)

for index, (x, y, material) in enumerate(((-23.2, -12.8, coral), (-20.0, -14.0, lavender), (-16.6, -12.8, mint))):
    cylinder(f"Sole_Pendant_Cord_{index}", (x, y, 9.15), 0.025, 1.45, dark, shop, 10)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.38, radius2=0.20, depth=0.52, location=(x, y, 8.38))
    shade = bpy.context.object
    shade.name = f"Sole_Pendant_Shade_{index}"
    shade.data.materials.append(material)
    move(shade, shop)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 8.14))
    light = bpy.context.object
    light.name = f"Sole_Pendant_Light_{index}"
    light.data.energy = 90
    light.data.color = (1.0, 0.66, 0.38)
    light.data.shadow_soft_size = 0.72
    move(light, shop)

camera = bpy.data.objects.get("Sole_Search_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(-20.0, -10.05, 8.35))
    camera = bpy.context.object
    camera.name = "Sole_Search_Refined_Camera"
    move(camera, shop)
camera.location = (-20.0, -10.05, 8.35)
camera.data.lens = 15
aim(camera, (-20.0, -14.35, 5.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Sole_Search_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, -10.72, 8.28))
    key = bpy.context.object
    key.name = "Sole_Search_Refined_Key"
    move(key, shop)
key.data.energy = 720
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (-20.0, -14.2, 5.9))

fill = bpy.data.objects.get("Sole_Search_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, -14.1, 8.45))
    fill = bpy.context.object
    fill.name = "Sole_Search_Refined_Fill"
    move(fill, shop)
fill.data.energy = 330
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (-20.0, -14.1, 5.6))

scene = bpy.context.scene
scene["sole_search_refinement_pass"] = "walk-in-shop-form-v1"
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
print("SOLE_SEARCH_REFINED_READY", MASTER)
print("SOLE_SEARCH_REFINED_RENDER", RENDER)
