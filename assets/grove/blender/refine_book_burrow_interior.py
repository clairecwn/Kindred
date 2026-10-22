import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "book_burrow_refined_blender.png"
COLLECTION_NAME = "BOOK_BURROW_INTERIOR_REFINEMENT"


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


def cylinder(name, loc, radius, depth, material, collection, vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return move(obj, collection)


def cone(name, loc, r1, r2, depth, material, collection):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r1, radius2=r2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return move(obj, collection)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


for old_name in ("BOOK_BURROW_DETAIL", "BOOK_BURROW_PROPS", "BOOK_BURROW_LABELS"):
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

floor = mat("Book_Refined_Floor", (0.30, 0.20, 0.16), 0.92)
wood = mat("Book_Refined_Wood", (0.34, 0.14, 0.055), 0.82)
cream = mat("Book_Refined_Cream", (0.94, 0.83, 0.64), 0.78)
coral = mat("Book_Refined_Coral", (0.88, 0.30, 0.22), 0.70)
blue = mat("Book_Refined_Blue", (0.20, 0.43, 0.68), 0.70)
mint = mat("Book_Refined_Mint", (0.33, 0.65, 0.50), 0.72)
lavender = mat("Book_Refined_Lavender", (0.54, 0.37, 0.72), 0.70)
pink = mat("Book_Refined_Pink", (0.88, 0.40, 0.54), 0.70)
gold = mat("Book_Refined_Gold", (0.86, 0.51, 0.12), 0.42, 0.32)
dark = mat("Book_Refined_Dark", (0.045, 0.035, 0.035), 0.58)
glow = mat("Book_Refined_Glow", (1.0, 0.60, 0.20), 0.40, emission=(1.0, 0.36, 0.08), strength=1.5)
book_colors = (coral, blue, mint, lavender, pink, cream)

# Sealed Level-3 shell with clear atrium-facing entrance.
cube("Refined_Book_Floor", (-20, -14.0, 10.045), (11.2, 6.0, 0.09), floor, shop, 0.08)
cube("Refined_Book_Entry_Mat", (-20, -10.95, 10.10), (3.2, 0.72, 0.12), gold, shop, 0.10)
cube("Refined_Book_Back_Wall", (-20.0, -17.12, 12.50), (11.2, 0.28, 4.90), cream, shop, 0.06)
cube("Refined_Book_Left_Wall", (-25.60, -14.0, 12.50), (0.28, 6.20, 4.90), cream, shop, 0.06)
cube("Refined_Book_Right_Wall", (-14.40, -14.0, 12.50), (0.28, 6.20, 4.90), cream, shop, 0.06)
cube("Refined_Book_Ceiling", (-20.0, -14.0, 14.88), (11.2, 6.0, 0.20), cream, shop, 0.05)

# Back library with supported shelves and individually named books.
cube("Book_Library_Back", (-20.0, -16.92, 11.78), (9.5, 0.12, 3.15), dark, shop, 0.04)
for z in (10.42, 11.14, 11.86, 12.58, 13.30):
    cube(f"Book_Library_Shelf_{z}", (-20.0, -16.64, z), (9.5, 0.58, 0.12), wood, shop, 0.04)
for x in (-24.68, -22.35, -20.0, -17.65, -15.32):
    cube(f"Book_Library_Divider_{x}", (x, -16.64, 11.86), (0.12, 0.58, 2.78), gold, shop, 0.03)
for row, support_z in enumerate((10.48, 11.20, 11.92, 12.64)):
    for index, x in enumerate((-24.0, -23.35, -22.70, -21.95, -21.30, -20.65, -19.35, -18.70, -18.05, -17.30, -16.65, -16.0)):
        height = 0.48 + 0.06 * ((row + index) % 3)
        cube(f"Book_Volume_{row}_{index}", (x, -16.31, support_z + height / 2), (0.42, 0.20, height), book_colors[(row + index) % len(book_colors)], shop, 0.025)
        cube(f"Book_Spine_Label_{row}_{index}", (x, -16.195, support_z + height * 0.58), (0.24, 0.025, 0.09), cream, shop, 0.012)

# Two reading nooks face inward and remain outside the arrival route.
for index, (x, material, facing) in enumerate(((-23.35, lavender, 1), (-16.65, mint, -1))):
    cube(f"Reading_Nook_Rug_{index}", (x, -13.55, 10.10), (2.70, 2.10, 0.10), material, shop, 0.10)
    cube(f"Reading_Chair_Seat_{index}", (x, -13.65, 10.60), (1.30, 1.02, 0.48), cream, shop, 0.14)
    cube(f"Reading_Chair_Back_{index}", (x, -14.05, 11.22), (1.30, 0.26, 1.30), cream, shop, 0.14)
    cube(f"Reading_Chair_Cushion_{index}", (x, -13.45, 10.94), (0.82, 0.26, 0.62), material, shop, 0.12)
    cylinder(f"Reading_Table_Top_{index}", (x + facing * 1.05, -13.55, 10.76), 0.38, 0.10, wood, shop, 24)
    cylinder(f"Reading_Table_Stem_{index}", (x + facing * 1.05, -13.55, 10.42), 0.055, 0.66, gold, shop, 14)
    cube(f"Open_Book_Left_{index}", (x + facing * 1.05 - 0.18, -13.55, 10.87), (0.36, 0.48, 0.05), cream, shop, 0.025, (0, math.radians(8), 0))
    cube(f"Open_Book_Right_{index}", (x + facing * 1.05 + 0.18, -13.55, 10.87), (0.36, 0.48, 0.05), cream, shop, 0.025, (0, math.radians(-8), 0))

# Low recommendation tables create side discoveries without blocking the center.
cube("Book_New_Table", (-22.65, -15.35, 10.58), (2.50, 0.92, 0.86), wood, shop, 0.10)
cube("Book_Staff_Picks_Table", (-17.35, -15.35, 10.58), (2.50, 0.92, 0.86), wood, shop, 0.10)
for table_index, base_x in enumerate((-22.65, -17.35)):
    for stack in range(3):
        for layer in range(3):
            cube(f"Book_Stack_{table_index}_{stack}_{layer}", (base_x - 0.65 + stack * 0.65, -15.35, 11.04 + layer * 0.11), (0.52, 0.62, 0.10), book_colors[(table_index + stack + layer) % len(book_colors)], shop, 0.025)

# Side checkout and return basket keep the arrival lane open.
cube("Book_Checkout", (-15.25, -11.55, 10.64), (1.65, 0.92, 1.18), wood, shop, 0.10)
cube("Book_Register", (-15.25, -11.55, 11.39), (0.48, 0.42, 0.42), dark, shop, 0.06)
cylinder("Book_Staff_Workspot", (-15.25, -12.38, 10.12), 0.42, 0.025, gold, shop, 28)
cube("Book_Return_Basket", (-24.55, -11.60, 10.31), (0.70, 0.48, 0.42), coral, shop, 0.08)
cube("Book_Return_Handle", (-24.55, -11.60, 10.65), (0.54, 0.06, 0.28), dark, shop, 0.025)

for index, (x, y, material) in enumerate(((-23.2, -13.5, lavender), (-20.0, -14.3, gold), (-16.8, -13.5, mint))):
    cylinder(f"Book_Pendant_Cord_{index}", (x, y, 14.15), 0.025, 1.45, dark, shop, 10)
    cone(f"Book_Pendant_Shade_{index}", (x, y, 13.38), 0.38, 0.20, 0.52, material, shop)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 13.14))
    light = bpy.context.object
    light.name = f"Book_Pendant_Light_{index}"
    light.data.energy = 88
    light.data.color = (1.0, 0.62, 0.34)
    light.data.shadow_soft_size = 0.72
    move(light, shop)

camera = bpy.data.objects.get("Book_Burrow_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(-20.0, -10.05, 13.35))
    camera = bpy.context.object
    camera.name = "Book_Burrow_Refined_Camera"
    move(camera, shop)
camera.location = (-20.0, -10.05, 13.35)
camera.data.lens = 15
aim(camera, (-20.0, -14.35, 10.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Book_Burrow_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, -10.72, 13.28))
    key = bpy.context.object
    key.name = "Book_Burrow_Refined_Key"
    move(key, shop)
key.data.energy = 700
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (-20.0, -14.2, 10.9))

fill = bpy.data.objects.get("Book_Burrow_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, -14.1, 13.45))
    fill = bpy.context.object
    fill.name = "Book_Burrow_Refined_Fill"
    move(fill, shop)
fill.data.energy = 320
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (-20.0, -14.1, 10.6))

scene = bpy.context.scene
scene["book_burrow_refinement_pass"] = "walk-in-shop-form-v1"
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
print("BOOK_BURROW_REFINED_READY", MASTER)
print("BOOK_BURROW_REFINED_RENDER", RENDER)
