import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "food_hall_refined_blender.png"
STAFF_RENDER = ROOT / "renders" / "food_hall_staff_aisle_blender.png"
COLLECTION_NAME = "FOOD_HALL_INTERIOR_REFINEMENT"


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


def torus(name, loc, major, minor, material, collection, rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=24, minor_segments=8, location=loc)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
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


for old_name in ("FOOD_HALL_DETAIL", "FOOD_HALL_PROPS", "FOOD_HALL_LABELS"):
    old_detail = bpy.data.collections.get(old_name)
    if old_detail:
        old_detail.hide_render = True
        old_detail.hide_viewport = True
old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
hall = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(hall)

floor = mat("Food_Refined_Floor", (0.38, 0.29, 0.20), 0.90)
wood = mat("Food_Refined_Wood", (0.40, 0.18, 0.07), 0.80)
cream = mat("Food_Refined_Cream", (0.95, 0.84, 0.65), 0.76)
coral = mat("Food_Refined_Coral", (0.90, 0.31, 0.24), 0.68)
mint = mat("Food_Refined_Mint", (0.32, 0.67, 0.50), 0.70)
blue = mat("Food_Refined_Blue", (0.20, 0.46, 0.70), 0.68)
pink = mat("Food_Refined_Pink", (0.90, 0.41, 0.55), 0.68)
green = mat("Food_Refined_Green", (0.18, 0.47, 0.23), 0.78)
gold = mat("Food_Refined_Gold", (0.87, 0.53, 0.13), 0.40, 0.35)
dark = mat("Food_Refined_Dark", (0.045, 0.045, 0.055), 0.55)

# Sealed Level-3 shell with open atrium entrance.
cube("Refined_Food_Floor", (-20, 14.0, 10.045), (11.2, 6.0, 0.09), floor, hall, 0.08)
cube("Refined_Food_Entry_Mat", (-20, 17.05, 10.10), (3.2, 0.72, 0.12), gold, hall, 0.10)
cube("Refined_Food_Back_Wall", (-20.0, 10.88, 12.50), (11.2, 0.28, 4.90), cream, hall, 0.06)
cube("Refined_Food_Left_Wall", (-25.60, 14.0, 12.50), (0.28, 6.20, 4.90), cream, hall, 0.06)
cube("Refined_Food_Right_Wall", (-14.40, 14.0, 12.50), (0.28, 6.20, 4.90), cream, hall, 0.06)
cube("Refined_Food_Ceiling", (-20.0, 14.0, 14.88), (11.2, 6.0, 0.20), cream, hall, 0.05)

# Three vendor fronts preserve a continuous 1.35 m staff aisle while using
# different silhouettes so the room reads as a market hall, not another cafe.
stall_data = ((-23.0, coral, "Noodle"), (-20.0, mint, "Garden"), (-17.0, blue, "Bake"))
for index, (x, accent, label) in enumerate(stall_data):
    cube(f"Food_Stall_{label}_Counter", (x, 12.75, 10.70), (2.55, 1.05, 1.30), wood, hall, 0.10)
    cube(f"Food_Stall_{label}_Top", (x, 12.75, 11.40), (2.68, 1.16, 0.12), cream, hall, 0.04)
    cylinder(f"Food_Stall_{label}_StaffSpot", (x, 11.52, 10.12), 0.42, 0.025, gold, hall, 28)
    cube(f"Food_Stall_{label}_Tray", (x, 12.75, 11.50), (1.46, 0.72, 0.08), dark, hall, 0.03)

# Noodle stall: compact timber portal with hanging lanterns.
for x in (-24.18, -21.82):
    cube(f"Noodle_Portal_Post_{x}", (x, 12.62, 12.40), (0.14, 0.18, 2.10), coral, hall, 0.04)
cube("Noodle_Portal_Header", (-23.0, 12.62, 13.38), (2.50, 0.18, 0.42), coral, hall, 0.08)
for index, x in enumerate((-23.55, -22.45)):
    cylinder(f"Noodle_Lantern_Cord_{index}", (x, 12.58, 13.04), 0.018, 0.26, dark, hall, 10)
    cylinder(f"Noodle_Lantern_{index}", (x, 12.58, 12.74), 0.17, 0.34, gold, hall, 18)

# Garden stall: open trellis and a planted crown instead of a solid header.
for x in (-21.18, -18.82):
    cube(f"Garden_Trellis_Post_{x}", (x, 12.62, 12.38), (0.12, 0.18, 2.04), mint, hall, 0.04)
cube("Garden_Trellis_Beam", (-20.0, 12.62, 13.35), (2.48, 0.18, 0.18), mint, hall, 0.05)
for index, x in enumerate((-20.78, -20.26, -19.74, -19.22)):
    sphere(f"Garden_Trellis_Plant_{index}", (x, 12.58, 13.55 + 0.05 * (index % 2)), (0.22, 0.16, 0.25), green, hall)

# Bakery stall: a striped awning creates a patisserie silhouette.
for index, x in enumerate((-18.10, -17.36, -16.62, -15.88)):
    cube(f"Bake_Awning_Stripe_{index}", (x, 12.52, 13.35), (0.68, 0.58, 0.18), pink if index % 2 == 0 else cream, hall, 0.05)
for x in (-18.18, -15.82):
    cube(f"Bake_Awning_Post_{x}", (x, 12.52, 12.36), (0.12, 0.16, 1.80), pink, hall, 0.04)

# Individually modeled food at exact tray and counter support heights.
cylinder("Noodle_Bowl", (-23.20, 12.75, 11.65), 0.26, 0.22, coral, hall, 24)
torus("Noodle_Bowl_Rim", (-23.20, 12.75, 11.78), 0.24, 0.025, cream, hall)
for strand in range(4):
    torus(f"Noodle_Strand_{strand}", (-23.20 + (strand - 1.5) * 0.06, 12.75, 11.80), 0.10, 0.018, gold, hall)
cube("Noodle_Dumpling", (-22.55, 12.75, 11.64), (0.38, 0.28, 0.20), cream, hall, 0.08)

cylinder("Garden_Salad_Bowl", (-20.20, 12.75, 11.65), 0.28, 0.22, mint, hall, 24)
for index, (dx, material) in enumerate(((-0.12, green), (0.0, coral), (0.12, cream))):
    sphere(f"Garden_Salad_Item_{index}", (-20.20 + dx, 12.75, 11.82), (0.11, 0.10, 0.08), material, hall)
cube("Garden_Wrap", (-19.52, 12.75, 11.64), (0.42, 0.30, 0.20), cream, hall, 0.08)
cube("Garden_Wrap_Filling", (-19.52, 12.58, 11.66), (0.34, 0.04, 0.10), green, hall, 0.02)

for index, x in enumerate((-17.45, -17.0, -16.55)):
    torus(f"Bake_Pastry_{index}", (x, 12.75, 11.60), 0.14, 0.06, gold, hall)
cylinder("Bake_Cake", (-17.0, 12.75, 11.67), 0.24, 0.26, pink, hall, 24)
sphere("Bake_Cake_Berry", (-17.0, 12.75, 11.86), (0.07, 0.07, 0.06), coral, hall)

# Drinks are grouped on supported pickup shelves between stalls.
for index, x in enumerate((-21.55, -21.15, -18.85, -18.45)):
    cylinder(f"Food_Drink_{index}", (x, 12.75, 11.64), 0.12, 0.36, (blue, coral, mint, pink)[index], hall, 18)
    cone(f"Food_Drink_Lid_{index}", (x, 12.75, 11.86), 0.14, 0.12, 0.08, cream, hall)

# A long communal harvest table and benches create a social-hub silhouette
# unlike Cafe Canopy's small round tables. The entry route stays open on right.
cube("Food_Communal_Table", (-22.15, 15.05, 10.86), (4.35, 1.02, 0.16), wood, hall, 0.08)
for index, x in enumerate((-23.75, -20.55)):
    cube(f"Food_Communal_Table_Leg_{index}", (x, 15.05, 10.435), (0.28, 0.76, 0.69), gold, hall, 0.05)
for side, y in enumerate((14.18, 15.92)):
    cube(f"Food_Communal_Bench_{side}", (-22.15, y, 10.55), (4.05, 0.42, 0.18), coral if side == 0 else mint, hall, 0.08)
    for index, x in enumerate((-23.55, -20.75)):
        cube(f"Food_Communal_Bench_Leg_{side}_{index}", (x, y, 10.275), (0.20, 0.30, 0.37), gold, hall, 0.04)
for index, x in enumerate((-23.45, -22.15, -20.85)):
    cube(f"Food_Communal_Tray_{index}", (x, 15.05, 10.985), (0.72, 0.60, 0.09), dark, hall, 0.03)
    cylinder(f"Food_Communal_Bowl_{index}", (x - 0.16, 15.05, 11.11), 0.16, 0.16, (coral, mint, blue)[index], hall, 20)
    cylinder(f"Food_Communal_Cup_{index}", (x + 0.20, 15.05, 11.17), 0.09, 0.28, cream, hall, 18)

# Window-side standing rail offers quick dining without copying cafe seating.
cube("Food_Standing_Rail", (-16.20, 14.75, 11.02), (0.55, 2.55, 0.14), blue, hall, 0.06)
for index, y in enumerate((13.95, 15.55)):
    cube(f"Food_Standing_Rail_Leg_{index}", (-16.20, y, 10.52), (0.22, 0.22, 0.86), gold, hall, 0.04)
    cylinder(f"Food_Standing_Stool_{index}", (-17.05, y, 10.66), 0.28, 0.16, pink, hall, 22)
    cylinder(f"Food_Standing_Stool_Leg_{index}", (-17.05, y, 10.335), 0.06, 0.49, gold, hall, 14)

# Side queue posts prevent the central arrival lane from becoming a queue.
for index, y in enumerate((13.35, 14.15, 14.95)):
    cylinder(f"Food_Queue_Post_{index}", (-15.20, y, 10.56), 0.055, 1.12, dark, hall, 14)
    cylinder(f"Food_Queue_Base_{index}", (-15.20, y, 10.06), 0.22, 0.12, dark, hall, 20)

for index, (x, y, material) in enumerate(((-23.0, 12.8, coral), (-20.0, 13.2, mint), (-17.0, 12.8, blue))):
    cylinder(f"Food_Pendant_Cord_{index}", (x, y, 14.15), 0.025, 1.45, dark, hall, 10)
    cone(f"Food_Pendant_Shade_{index}", (x, y, 13.38), 0.38, 0.20, 0.52, material, hall)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 13.14))
    light = bpy.context.object
    light.name = f"Food_Pendant_Light_{index}"
    light.data.energy = 90
    light.data.color = (1.0, 0.62, 0.34)
    light.data.shadow_soft_size = 0.72
    move(light, hall)

camera = bpy.data.objects.get("Food_Hall_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(-20.0, 17.95, 13.35))
    camera = bpy.context.object
    camera.name = "Food_Hall_Refined_Camera"
    move(camera, hall)
camera.location = (-20.0, 17.95, 13.35)
camera.data.lens = 15
aim(camera, (-20.0, 13.65, 10.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Food_Hall_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, 17.28, 13.28))
    key = bpy.context.object
    key.name = "Food_Hall_Refined_Key"
    move(key, hall)
key.data.energy = 700
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (-20.0, 13.8, 10.9))

fill = bpy.data.objects.get("Food_Hall_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(-20.0, 14.0, 13.45))
    fill = bpy.context.object
    fill.name = "Food_Hall_Refined_Fill"
    move(fill, hall)
fill.data.energy = 320
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (-20.0, 13.8, 10.6))

scene = bpy.context.scene
scene["food_hall_refinement_pass"] = "market-hall-communal-layout-v2"
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

# Back-of-house evidence camera shows all three staff work positions and aisle.
staff_camera = bpy.data.objects.get("Food_Hall_Staff_Aisle_Camera")
if staff_camera is None:
    bpy.ops.object.camera_add(location=(-15.10, 11.55, 13.65))
    staff_camera = bpy.context.object
    staff_camera.name = "Food_Hall_Staff_Aisle_Camera"
    move(staff_camera, hall)
staff_camera.location = (-15.10, 11.55, 13.65)
staff_camera.data.lens = 20
aim(staff_camera, (-20.0, 11.75, 10.30))
scene.camera = staff_camera
scene.render.filepath = str(STAFF_RENDER)
bpy.ops.render.render(write_still=True)
scene.camera = camera
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("FOOD_HALL_REFINED_READY", MASTER)
print("FOOD_HALL_REFINED_RENDER", RENDER)
print("FOOD_HALL_STAFF_RENDER", STAFF_RENDER)
