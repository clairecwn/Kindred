import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "thread_thimble_refined_blender.png"
COLLECTION_NAME = "THREAD_THIMBLE_INTERIOR_REFINEMENT"


def material(name, color, roughness=0.72, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1.0)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def move(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, location, dimensions, mat, collection, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value / 2 for value in dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("soft_edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    obj.data.materials.append(mat)
    return move(obj, collection)


def cylinder(name, location, radius, depth, mat, collection, vertices=20, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    return move(obj, collection)


def sphere(name, location, scale, mat, collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return move(obj, collection)


def cone(name, location, radius1, radius2, depth, mat, collection):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=radius1, radius2=radius2, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return move(obj, collection)


def torus(name, location, major, minor, mat, collection, rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=24, minor_segments=8, location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    return move(obj, collection)


def text(name, body, location, size, mat, collection):
    bpy.ops.object.text_add(location=location, rotation=(math.radians(90), 0, math.radians(180)))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.008
    obj.data.materials.append(mat)
    return move(obj, collection)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def hide_old_detail():
    old_collections = {
        "THREAD_AND_THIMBLE_DETAIL",
        "THREAD_AND_THIMBLE_INDIVIDUAL_PROPS",
        "THREAD_AND_THIMBLE_LABELS",
    }
    for name in old_collections:
        old = bpy.data.collections.get(name)
        if old:
            old.hide_render = True
            old.hide_viewport = True
    for obj in bpy.data.objects:
        if obj.name.startswith(("Thread_Rack_", "Thread_Display_", "Thread_Fitting_")):
            obj.hide_render = True
            obj.hide_viewport = True


def wall_bay(name, x, y, width, mat, backing, collection):
    cube(f"{name}_Back", (x, y + 0.18, 1.55), (width, 0.12, 2.72), backing, collection, 0.03)
    cube(f"{name}_Top", (x, y, 2.88), (width, 0.46, 0.13), mat, collection, 0.04)
    cube(f"{name}_Left", (x - width / 2 + 0.07, y, 1.55), (0.14, 0.46, 2.72), mat, collection, 0.04)
    cube(f"{name}_Right", (x + width / 2 - 0.07, y, 1.55), (0.14, 0.46, 2.72), mat, collection, 0.04)
    cylinder(f"{name}_Rail", (x, y - 0.19, 2.42), 0.045, width - 0.34, brass, collection, 18, (0, math.radians(90), 0))


def hanger(name, x, y, z, garment_mat, kind, collection):
    cylinder(f"{name}_Hook", (x, y, z + 0.23), 0.025, 0.28, brass, collection, 10)
    cube(f"{name}_Shoulder", (x, y, z + 0.05), (0.54, 0.07, 0.07), brass, collection, 0.02)
    if kind == "dress":
        cone(f"{name}_Dress", (x, y - 0.03, z - 0.54), 0.42, 0.21, 1.12, garment_mat, collection)
        cube(f"{name}_Bodice", (x, y - 0.03, z - 0.08), (0.46, 0.17, 0.50), garment_mat, collection, 0.06)
    elif kind == "trouser":
        for offset in (-0.14, 0.14):
            cube(f"{name}_Leg_{offset}", (x + offset, y - 0.03, z - 0.55), (0.22, 0.16, 1.02), garment_mat, collection, 0.05)
        cube(f"{name}_Waist", (x, y - 0.03, z - 0.06), (0.55, 0.18, 0.18), garment_mat, collection, 0.04)
    else:
        cube(f"{name}_Body", (x, y - 0.03, z - 0.35), (0.54, 0.18, 0.72), garment_mat, collection, 0.08)
        for offset in (-0.37, 0.37):
            cube(f"{name}_Sleeve_{offset}", (x + offset, y - 0.03, z - 0.30), (0.20, 0.16, 0.62), garment_mat, collection, 0.06)
        if kind == "jacket":
            cube(f"{name}_Lapel", (x, y - 0.14, z - 0.22), (0.16, 0.04, 0.48), cream, collection, 0.02)


def sneaker(name, x, y, z, upper, accent, collection):
    cube(f"{name}_Sole", (x, y, z), (0.68, 0.34, 0.13), cream, collection, 0.06)
    cube(f"{name}_Upper", (x - 0.05, y, z + 0.15), (0.50, 0.30, 0.25), upper, collection, 0.08)
    cube(f"{name}_Toe", (x + 0.24, y, z + 0.10), (0.22, 0.30, 0.18), accent, collection, 0.07)
    for lace in range(3):
        cube(f"{name}_Lace_{lace}", (x - 0.06 + lace * 0.10, y - 0.16, z + 0.23), (0.16, 0.025, 0.018), cream, collection, 0.006)


hide_old_detail()
old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
shop = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(shop)

floor = material("Thread_Refined_Floor", (0.36, 0.29, 0.42), 0.90)
wood = material("Thread_Refined_Wood", (0.45, 0.22, 0.12), 0.82)
brass = material("Thread_Refined_Brass", (0.76, 0.46, 0.14), 0.38, 0.40)
cream = material("Thread_Refined_Cream", (0.95, 0.88, 0.72), 0.78)
dark = material("Thread_Refined_Dark", (0.06, 0.05, 0.09), 0.52)
lavender = material("Thread_Refined_Lavender", (0.56, 0.36, 0.76), 0.70)
coral = material("Thread_Refined_Coral", (0.91, 0.30, 0.32), 0.70)
blue = material("Thread_Refined_Blue", (0.19, 0.42, 0.72), 0.68)
mint = material("Thread_Refined_Mint", (0.32, 0.68, 0.55), 0.72)
pink = material("Thread_Refined_Pink", (0.90, 0.42, 0.58), 0.68)
gold = material("Thread_Refined_Gold", (0.92, 0.62, 0.18), 0.60)
mirror = material("Thread_Refined_Mirror", (0.58, 0.73, 0.80), 0.16, 0.55)

# A broad, direct arrival lane remains open from the mall threshold to the back wall.
cube("Refined_Thread_Floor", (20, -14.0, 0.045), (11.2, 6.0, 0.09), floor, shop, 0.08)
cube("Refined_Thread_Entry_Mat", (20, -10.95, 0.10), (3.2, 0.72, 0.12), lavender, shop, 0.10)

# Back-wall apparel bays read as real fixtures rather than solid placeholder blocks.
wall_bay("Refined_Womenswear", 17.15, -16.90, 4.6, wood, dark, shop)
wall_bay("Refined_Menswear", 22.85, -16.90, 4.6, wood, dark, shop)
for index, (x, mat, kind) in enumerate(((15.8, coral, "dress"), (16.7, pink, "shirt"), (17.6, lavender, "jacket"), (18.5, blue, "trouser"))):
    hanger(f"Womenswear_{index}_{kind}", x, -16.61, 2.16, mat, kind, shop)
for index, (x, mat, kind) in enumerate(((21.5, blue, "jacket"), (22.4, mint, "shirt"), (23.3, gold, "trouser"), (24.2, coral, "shirt"))):
    hanger(f"Menswear_{index}_{kind}", x, -16.61, 2.16, mat, kind, shop)

# Low accessories table preserves cross-shop sightlines.
cube("Refined_Accessory_Table", (22.65, -13.35, 0.66), (3.10, 1.25, 0.92), wood, shop, 0.10)
for stack, mat in enumerate((coral, mint, blue)):
    cube(f"Folded_Top_{stack}", (21.85, -13.35, 1.18 + stack * 0.13), (0.76, 0.58, 0.11), mat, shop, 0.04)
cube("Handbag_Body", (23.10, -13.35, 1.36), (0.65, 0.26, 0.48), pink, shop, 0.08)
cube("Handbag_Flap", (23.10, -13.19, 1.52), (0.55, 0.05, 0.20), pink, shop, 0.03)
torus("Handbag_Handle", (23.10, -13.35, 1.74), 0.27, 0.035, brass, shop)
cylinder("Sunhat_Brim", (24.0, -13.35, 1.30), 0.45, 0.08, cream, shop, 24)
cone("Sunhat_Crown", (24.0, -13.35, 1.51), 0.29, 0.21, 0.36, cream, shop)
cube("Sunhat_Band", (24.0, -13.35, 1.50), (0.48, 0.48, 0.08), mint, shop, 0.03)

# Footwear bench and mannequins form a discovery pocket on the left, clear of arrival.
cube("Refined_Shoe_Bench", (16.55, -13.55, 0.42), (2.45, 1.00, 0.52), cream, shop, 0.12)
sneaker("Sneaker_Coral", 16.05, -13.55, 0.78, coral, pink, shop)
sneaker("Sneaker_Blue", 17.02, -13.55, 0.78, blue, mint, shop)
for mannequin_index, (x, y, mat) in enumerate(((15.55, -12.20, lavender), (18.05, -12.65, coral))):
    cylinder(f"Mannequin_Base_{mannequin_index}", (x, y, 0.12), 0.36, 0.12, wood, shop, 24)
    cylinder(f"Mannequin_Pole_{mannequin_index}", (x, y, 0.74), 0.04, 1.18, brass, shop, 14)
    cylinder(f"Mannequin_Torso_{mannequin_index}", (x, y, 1.42), 0.25, 0.62, cream, shop, 20)
    sphere(f"Mannequin_Head_{mannequin_index}", (x, y, 1.94), (0.18, 0.18, 0.22), cream, shop)
    cone(f"Mannequin_Skirt_{mannequin_index}", (x, y, 0.94), 0.52, 0.24, 1.0, mat, shop)

# Fitting room, mirror, and checkout sit on the perimeter without narrowing the route.
cube("Refined_Fitting_Room", (24.55, -15.05, 1.55), (1.55, 1.42, 3.10), lavender, shop, 0.10)
cube("Refined_Fitting_Curtain", (24.55, -14.30, 1.55), (1.30, 0.08, 2.76), pink, shop, 0.04)
text("Refined_Fitting_Label", "TRY ON", (24.55, -14.23, 2.68), 0.22, cream, shop)
cube("Refined_Full_Mirror_Frame", (15.15, -15.10, 1.58), (0.20, 1.46, 2.78), brass, shop, 0.05)
cube("Refined_Full_Mirror", (15.03, -15.10, 1.58), (0.04, 1.24, 2.52), mirror, shop, 0.02)
cube("Refined_Thread_Checkout", (24.60, -11.70, 0.65), (1.55, 0.92, 1.18), wood, shop, 0.10)
cube("Refined_Thread_Register", (24.60, -11.70, 1.40), (0.48, 0.42, 0.42), dark, shop, 0.06)

# Pendant rhythm marks the departments and makes the shop feel occupied.
for index, (x, y) in enumerate(((16.7, -12.0), (20.0, -14.1), (23.4, -12.2))):
    cylinder(f"Thread_Pendant_Cord_{index}", (x, y, 4.15), 0.025, 1.40, dark, shop, 10)
    cone(f"Thread_Pendant_Shade_{index}", (x, y, 3.38), 0.38, 0.20, 0.52, (lavender, mint, coral)[index], shop)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 3.16))
    light = bpy.context.object
    light.name = f"Thread_Pendant_Light_{index}"
    light.data.energy = 105
    light.data.color = (1.0, 0.67, 0.38)
    light.data.shadow_soft_size = 0.70
    move(light, shop)

camera = bpy.data.objects.get("Thread_Thimble_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(20.0, -10.05, 3.35))
    camera = bpy.context.object
    camera.name = "Thread_Thimble_Refined_Camera"
    move(camera, shop)
camera.location = (20.0, -10.05, 3.35)
camera.data.lens = 15
point_at(camera, (20.0, -14.35, 0.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Thread_Thimble_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(20, -11.5, 4.7))
    key = bpy.context.object
    key.name = "Thread_Thimble_Refined_Key"
    move(key, shop)
key.location = (20.0, -10.70, 3.25)
key.data.energy = 780
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
point_at(key, (20, -14.2, 0.9))

fill = bpy.data.objects.get("Thread_Thimble_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, -14.2, 3.45))
    fill = bpy.context.object
    fill.name = "Thread_Thimble_Refined_Fill"
    move(fill, shop)
fill.data.energy = 360
fill.data.shape = "DISK"
fill.data.size = 5.0
point_at(fill, (20.0, -14.2, 0.6))

scene = bpy.context.scene
scene["thread_thimble_refinement_pass"] = "walk-in-shop-form-v1"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 80
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.50
scene.render.filepath = str(RENDER)
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("THREAD_THIMBLE_REFINED_READY", MASTER)
print("THREAD_THIMBLE_REFINED_RENDER", RENDER)
