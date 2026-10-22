import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "cafe_canopy_refined_blender.png"
STAFF_RENDER = ROOT / "renders" / "cafe_canopy_staff_aisle_blender.png"
COLLECTION_NAME = "CAFE_CANOPY_INTERIOR_REFINEMENT"


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


for old_name in ("CAFE_CANOPY_DETAIL", "CAFE_CANOPY_INDIVIDUAL_PROPS", "CAFE_CANOPY_LABELS"):
    old_detail = bpy.data.collections.get(old_name)
    if old_detail:
        old_detail.hide_render = True
        old_detail.hide_viewport = True
old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
cafe = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(cafe)

floor = mat("Cafe_Refined_Floor", (0.34, 0.25, 0.18), 0.90)
wood = mat("Cafe_Refined_Wood", (0.42, 0.18, 0.07), 0.80)
cream = mat("Cafe_Refined_Cream", (0.95, 0.84, 0.64), 0.76)
coral = mat("Cafe_Refined_Coral", (0.90, 0.30, 0.23), 0.68)
mint = mat("Cafe_Refined_Mint", (0.32, 0.67, 0.52), 0.72)
pink = mat("Cafe_Refined_Pink", (0.90, 0.44, 0.54), 0.68)
gold = mat("Cafe_Refined_Gold", (0.87, 0.52, 0.13), 0.40, 0.35)
coffee = mat("Cafe_Refined_Coffee", (0.16, 0.055, 0.022), 0.78)
dark = mat("Cafe_Refined_Dark", (0.04, 0.06, 0.05), 0.55)
blue = mat("Cafe_Refined_Blue", (0.20, 0.48, 0.68), 0.68)
glass = mat("Cafe_Refined_Glass", (0.38, 0.75, 0.78), 0.22, 0.05)

# Shop substrate and direct 3.2 m arrival route.
cube("Refined_Cafe_Floor", (-20, 14.0, 0.045), (11.2, 6.0, 0.09), floor, cafe, 0.08)
cube("Refined_Cafe_Entry_Mat", (-20, 17.05, 0.10), (3.2, 0.72, 0.12), mint, cafe, 0.10)

# Sized against the integrated 2.12 m-tall / 1.43 m-wide cast. The counter is
# pulled forward and shortened to preserve a 1.60 m staff aisle between its
# rear edge and the structural back wall, while keeping a clear public lane.
cube("Cafe_Staff_Aisle", (-20.0, 11.70, 0.08), (6.2, 1.60, 0.06), mint, cafe, 0.04)
for index, x in enumerate((-21.35, -18.65)):
    cylinder(f"Cafe_Staff_Workspot_{index}", (x, 11.65, 0.12), 0.46, 0.025, gold, cafe, 28)
cube("Cafe_Service_Counter", (-20.0, 13.05, 0.55), (6.2, 0.90, 0.96), wood, cafe, 0.10)
cube("Cafe_Counter_Top", (-20.0, 13.05, 1.09), (6.4, 1.00, 0.12), cream, cafe, 0.04)
cube("Cafe_Menu_Back", (-20.0, 11.08, 2.82), (5.6, 0.12, 2.20), dark, cafe, 0.06)
for line, (x, material) in enumerate(((-21.8, cream), (-20.6, mint), (-19.4, coral), (-18.2, gold))):
    for row in range(3):
        cube(f"Menu_Item_{line}_{row}", (x, 11.00, 3.35 - row * 0.48), (0.76, 0.04, 0.10), material, cafe, 0.02)

# Open pastry frame with supported shelves and individually named food.
cube("Pastry_Case_Base", (-22.05, 13.15, 1.21), (2.35, 0.72, 0.12), gold, cafe, 0.03)
for side in (-1, 1):
    cube(f"Pastry_Case_Post_{side}", (-22.05 + side * 1.09, 13.15, 1.69), (0.08, 0.66, 1.04), glass, cafe, 0.02)
for z in (1.305, 1.695, 2.085):
    cube(f"Pastry_Case_Shelf_{z}", (-22.05, 13.15, z), (2.20, 0.58, 0.07), glass, cafe, 0.02)
for index, x in enumerate((-22.80, -22.30, -21.80, -21.30)):
    torus(f"Butter_Croissant_{index}", (x, 13.12, 1.40), 0.14, 0.06, gold, cafe)
for index, x in enumerate((-22.70, -22.05, -21.40)):
    cylinder(f"Berry_Tart_{index}", (x, 13.12, 1.78), 0.16, 0.10, cream, cafe, 20)
    sphere(f"Berry_Tart_Top_{index}", (x, 13.12, 1.90), (0.08, 0.08, 0.07), coral, cafe)
for index, x in enumerate((-22.65, -22.05, -21.45)):
    cube(f"Cafe_Sandwich_{index}", (x, 13.12, 2.21), (0.46, 0.34, 0.18), cream, cafe, 0.05)
    cube(f"Cafe_Sandwich_Filling_{index}", (x, 13.12, 2.21), (0.42, 0.36, 0.07), mint, cafe, 0.02)

# Espresso station, cups, and pickup service point.
cube("Espresso_Machine", (-18.35, 13.12, 1.50), (1.32, 0.68, 0.70), dark, cafe, 0.10)
for group, x in enumerate((-18.95, -18.25)):
    cylinder(f"Espresso_Group_{group}", (x + 0.25, 12.75, 1.43), 0.12, 0.34, gold, cafe, 16, (math.radians(90), 0, 0))
cylinder("Coffee_Bean_Hopper", (-18.35, 13.12, 2.02), 0.28, 0.54, glass, cafe, 20)
for index, x in enumerate((-17.65, -17.25, -16.85)):
    cylinder(f"Pickup_Cup_{index}", (x, 13.05, 1.29), 0.13, 0.28, (mint, coral, blue)[index], cafe, 18)
    cone(f"Pickup_Cup_Lid_{index}", (x, 13.05, 1.46), 0.15, 0.13, 0.08, cream, cafe)

# Queue posts sit to the right, leaving the entrance and seating route clear.
for index, y in enumerate((13.20, 14.20, 15.20)):
    cylinder(f"Cafe_Queue_Post_{index}", (-15.55, y, 0.56), 0.055, 1.12, dark, cafe, 14)
    cylinder(f"Cafe_Queue_Base_{index}", (-15.55, y, 0.06), 0.22, 0.12, dark, cafe, 20)
for index, y in enumerate((13.70, 14.70)):
    cube(f"Cafe_Queue_Rope_{index}", (-15.55, y, 1.03), (0.06, 1.00, 0.06), gold, cafe, 0.02)

# Two compact seating islands create a social pocket without blocking arrival.
for table_index, (x, y, material) in enumerate(((-23.35, 15.15, coral), (-19.05, 14.75, mint))):
    cylinder(f"Cafe_Table_Top_{table_index}", (x, y, 0.82), 0.70, 0.12, wood, cafe, 28)
    cylinder(f"Cafe_Table_Stem_{table_index}", (x, y, 0.43), 0.075, 0.76, gold, cafe, 16)
    cylinder(f"Cafe_Table_Base_{table_index}", (x, y, 0.08), 0.32, 0.10, gold, cafe, 22)
    for seat_index, offset in enumerate(((-0.95, 0.0), (0.95, 0.0))):
        cylinder(f"Cafe_Stool_{table_index}_{seat_index}", (x + offset[0], y, 0.56), 0.30, 0.16, material, cafe, 22)
        cylinder(f"Cafe_Stool_Leg_{table_index}_{seat_index}", (x + offset[0], y, 0.29), 0.055, 0.54, gold, cafe, 14)
    cylinder(f"Cafe_Table_Cup_{table_index}", (x, y, 0.99), 0.12, 0.22, cream, cafe, 18)
    torus(f"Cafe_Table_Cup_Handle_{table_index}", (x + 0.13, y, 1.00), 0.08, 0.02, cream, cafe, (math.radians(90), 0, 0))

# A planter softens the left arrival edge while staying outside the route.
cylinder("Cafe_Planter", (-24.65, 16.10, 0.38), 0.38, 0.68, coral, cafe, 24)
for index, angle in enumerate((0.0, 1.3, 2.6, 3.9, 5.2)):
    sphere(f"Cafe_Plant_Leaf_{index}", (-24.65 + math.cos(angle) * 0.30, 16.10 + math.sin(angle) * 0.22, 0.96 + 0.10 * (index % 2)), (0.25, 0.17, 0.42), mint, cafe)

# Supported canopy pendants define counter, route, and seating.
for index, (x, y, material) in enumerate(((-22.5, 12.3, coral), (-20.0, 14.0, mint), (-17.7, 13.0, blue))):
    cylinder(f"Cafe_Pendant_Cord_{index}", (x, y, 4.12), 0.025, 1.42, dark, cafe, 10)
    cone(f"Cafe_Pendant_Shade_{index}", (x, y, 3.36), 0.38, 0.20, 0.52, material, cafe)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 3.12))
    light = bpy.context.object
    light.name = f"Cafe_Pendant_Light_{index}"
    light.data.energy = 90
    light.data.color = (1.0, 0.64, 0.34)
    light.data.shadow_soft_size = 0.72
    move(light, cafe)

camera = bpy.data.objects.get("Cafe_Canopy_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(-20.0, 17.95, 3.35))
    camera = bpy.context.object
    camera.name = "Cafe_Canopy_Refined_Camera"
    move(camera, cafe)
camera.location = (-20.0, 17.95, 3.35)
camera.data.lens = 15
aim(camera, (-20.0, 13.65, 0.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Cafe_Canopy_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, 17.28, 3.28))
    key = bpy.context.object
    key.name = "Cafe_Canopy_Refined_Key"
    move(key, cafe)
key.location = (-20.0, 17.28, 3.28)
key.data.energy = 720
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (-20.0, 13.8, 0.9))

fill = bpy.data.objects.get("Cafe_Canopy_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, 14.1, 3.45))
    fill = bpy.context.object
    fill.name = "Cafe_Canopy_Refined_Fill"
    move(fill, cafe)
fill.data.energy = 330
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (-20.0, 14.1, 0.6))

scene = bpy.context.scene
scene["cafe_canopy_refinement_pass"] = "walk-in-shop-form-v1"
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

staff_camera = bpy.data.objects.get("Cafe_Canopy_Staff_Aisle_Camera")
if staff_camera is None:
    bpy.ops.object.camera_add(location=(-16.25, 11.35, 2.75))
    staff_camera = bpy.context.object
    staff_camera.name = "Cafe_Canopy_Staff_Aisle_Camera"
    move(staff_camera, cafe)
staff_camera.location = (-16.25, 11.35, 2.75)
staff_camera.data.lens = 22
aim(staff_camera, (-20.0, 12.25, 0.65))
scene.camera = staff_camera
scene.render.filepath = str(STAFF_RENDER)
bpy.ops.render.render(write_still=True)
scene.camera = camera
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("CAFE_CANOPY_REFINED_READY", MASTER)
print("CAFE_CANOPY_REFINED_RENDER", RENDER)
print("CAFE_CANOPY_STAFF_RENDER", STAFF_RENDER)
