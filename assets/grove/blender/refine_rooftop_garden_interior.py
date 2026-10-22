import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "rooftop_garden_refined_blender.png"
STAFF_RENDER = ROOT / "renders" / "rooftop_garden_staff_aisle_blender.png"
COLLECTION_NAME = "ROOFTOP_GARDEN_INTERIOR_REFINEMENT"


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


def cylinder(name, loc, radius, depth, material, collection, vertices=24, rotation=None):
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


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


for old_name in ("ROOFTOP_GARDEN_DETAIL", "ROOFTOP_GARDEN_PROPS", "ROOFTOP_GARDEN_LABELS"):
    old = bpy.data.collections.get(old_name)
    if old:
        old.hide_render = True
        old.hide_viewport = True
old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
garden = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(garden)

floor = mat("RoofGarden_Refined_Floor", (0.42, 0.36, 0.25), 0.90)
wood = mat("RoofGarden_Refined_Wood", (0.34, 0.17, 0.07), 0.82)
cream = mat("RoofGarden_Refined_Cream", (0.95, 0.87, 0.70), 0.76)
sage = mat("RoofGarden_Refined_Sage", (0.42, 0.66, 0.45), 0.76)
green = mat("RoofGarden_Refined_Green", (0.16, 0.45, 0.22), 0.80)
mint = mat("RoofGarden_Refined_Mint", (0.54, 0.78, 0.65), 0.72)
coral = mat("RoofGarden_Refined_Coral", (0.91, 0.36, 0.27), 0.70)
pink = mat("RoofGarden_Refined_Pink", (0.92, 0.48, 0.60), 0.70)
lavender = mat("RoofGarden_Refined_Lavender", (0.60, 0.48, 0.78), 0.70)
blue = mat("RoofGarden_Refined_Blue", (0.38, 0.66, 0.79), 0.66)
gold = mat("RoofGarden_Refined_Gold", (0.86, 0.55, 0.16), 0.42, 0.28)
dark = mat("RoofGarden_Refined_Dark", (0.045, 0.065, 0.05), 0.58)
glow = mat("RoofGarden_Refined_Glow", (1.0, 0.65, 0.24), 0.40, emission=(1.0, 0.42, 0.10), strength=1.3)

# Conservatory shell with an open atrium threshold and framed skylight rhythm.
cube("Refined_RoofGarden_Floor", (20.0, 14.0, 10.045), (11.2, 6.0, 0.09), floor, garden, 0.08)
cube("Refined_RoofGarden_Entry_Mat", (20.0, 10.95, 10.10), (3.2, 0.72, 0.12), mint, garden, 0.10)
cube("Refined_RoofGarden_Back_Wall", (20.0, 17.12, 12.50), (11.2, 0.28, 4.90), cream, garden, 0.06)
cube("Refined_RoofGarden_Left_Wall", (14.40, 14.0, 12.50), (0.28, 6.20, 4.90), cream, garden, 0.06)
cube("Refined_RoofGarden_Right_Wall", (25.60, 14.0, 12.50), (0.28, 6.20, 4.90), cream, garden, 0.06)
for x in (15.1, 17.55, 20.0, 22.45, 24.9):
    cube(f"RoofGarden_Skylight_Rib_{x}", (x, 14.0, 14.78), (0.14, 6.0, 0.16), cream, garden, 0.04)
for y in (11.2, 16.8):
    cube(f"RoofGarden_Skylight_Edge_{y}", (20.0, y, 14.78), (10.0, 0.14, 0.16), cream, garden, 0.04)

# Left planted terrace: raised soil bed, individually rooted shrubs and flowers.
cube("RoofGarden_Raised_Bed", (16.65, 14.25, 10.46), (3.45, 4.45, 0.74), wood, garden, 0.14)
cube("RoofGarden_Raised_Soil", (16.65, 14.25, 10.86), (3.12, 4.10, 0.12), dark, garden, 0.10)
for index, (x, y, scale) in enumerate(((16.0, 13.0, 0.56), (17.2, 13.5, 0.48), (16.2, 15.0, 0.52), (17.25, 15.55, 0.58))):
    cylinder(f"RoofGarden_Shrub_Trunk_{index}", (x, y, 11.12), 0.07, 0.44, wood, garden, 14)
    sphere(f"RoofGarden_Shrub_Canopy_{index}", (x, y, 11.50), (scale, scale * 0.82, scale * 0.76), green if index % 2 == 0 else sage, garden)
for index, (x, y, material) in enumerate(((15.65, 12.35, pink), (16.65, 12.45, coral), (17.60, 14.35, lavender), (15.70, 15.80, blue), (16.75, 16.05, pink))):
    cylinder(f"RoofGarden_Flower_Stem_{index}", (x, y, 11.12), 0.025, 0.42, green, garden, 10)
    for petal in range(5):
        angle = petal * math.tau / 5
        sphere(f"RoofGarden_Flower_{index}_{petal}", (x + math.cos(angle) * 0.10, y + math.sin(angle) * 0.10, 11.36), (0.10, 0.07, 0.06), material, garden)
    sphere(f"RoofGarden_Flower_Centre_{index}", (x, y, 11.38), (0.07, 0.07, 0.06), gold, garden)

# Right retail wall: every packet and pot sits on a measured shelf plane.
cube("RoofGarden_Retail_Back", (23.25, 16.92, 11.95), (3.85, 0.12, 3.25), dark, garden, 0.05)
for row, z in enumerate((10.62, 11.42, 12.22, 13.02)):
    cube(f"RoofGarden_Retail_Shelf_{row}", (23.25, 16.60, z), (3.85, 0.68, 0.12), wood, garden, 0.04)
for row, z in enumerate((10.86, 11.66, 12.46)):
    for col, x in enumerate((21.90, 22.58, 23.26, 23.94, 24.62)):
        cube(f"Seed_Packet_{row}_{col}", (x, 16.22, z), (0.42, 0.08, 0.36), (coral, mint, lavender, pink, blue)[(row + col) % 5], garden, 0.03)
for index, x in enumerate((22.05, 23.25, 24.45)):
    cone(f"Plant_Pot_{index}", (x, 16.28, 13.25), 0.22, 0.17, 0.34, (coral, blue, lavender)[index], garden)
    cylinder(f"Plant_Stem_{index}", (x, 16.28, 13.60), 0.035, 0.38, green, garden, 12)
    sphere(f"Plant_Leaf_{index}", (x, 16.28, 13.88), (0.28, 0.20, 0.28), sage, garden)

# Potting and checkout counter leaves a 1.28 m staff aisle to the back wall.
cube("RoofGarden_Potting_Counter", (19.0, 15.25, 10.72), (3.85, 0.92, 1.34), wood, garden, 0.10)
cube("RoofGarden_Potting_Top", (19.0, 15.25, 11.43), (4.02, 1.06, 0.12), cream, garden, 0.05)
cylinder("RoofGarden_Staff_Workspot", (19.0, 16.35, 10.12), 0.42, 0.025, gold, garden, 28)
for index, x in enumerate((17.75, 18.65, 19.55)):
    cone(f"Potting_Pot_{index}", (x, 15.25, 11.66), 0.20, 0.15, 0.34, (coral, blue, lavender)[index], garden)
cube("Potting_Soil_Tray", (20.35, 15.25, 11.54), (0.70, 0.58, 0.10), dark, garden, 0.03)
cube("Potting_Trowel_Blade", (20.33, 15.25, 11.62), (0.30, 0.18, 0.06), gold, garden, 0.03, (0, 0, math.radians(20)))
cube("Potting_Trowel_Handle", (20.62, 15.25, 11.66), (0.36, 0.08, 0.08), wood, garden, 0.03, (0, 0, math.radians(20)))

# Social pause nook sits right of the arrival path and faces the planted bed.
cube("RoofGarden_Bench_Seat", (23.15, 12.55, 10.55), (3.10, 0.64, 0.18), wood, garden, 0.08)
cube("RoofGarden_Bench_Back", (23.15, 12.82, 11.08), (3.10, 0.16, 0.92), mint, garden, 0.08, (math.radians(-8), 0, 0))
for index, x in enumerate((22.05, 24.25)):
    cube(f"RoofGarden_Bench_Leg_{index}", (x, 12.55, 10.275), (0.22, 0.46, 0.37), gold, garden, 0.04)
for index, x in enumerate((22.45, 23.85)):
    cylinder(f"RoofGarden_Lantern_Base_{index}", (x, 13.55, 10.24), 0.22, 0.30, gold, garden, 20)
    cylinder(f"RoofGarden_Lantern_Glass_{index}", (x, 13.55, 10.62), 0.16, 0.46, cream, garden, 20)
    sphere(f"RoofGarden_Lantern_Glow_{index}", (x, 13.55, 10.62), (0.08, 0.08, 0.12), glow, garden)

# Suspended vine trellis marks the room's destination without blocking movement.
cube("RoofGarden_Trellis_Beam", (20.0, 14.10, 13.70), (3.40, 0.20, 0.20), wood, garden, 0.05)
for index, x in enumerate((18.55, 19.25, 20.0, 20.75, 21.45)):
    cylinder(f"RoofGarden_Vine_{index}", (x, 14.10, 13.18), 0.025, 0.84 + 0.12 * (index % 2), green, garden, 10)
    sphere(f"RoofGarden_Vine_Leaf_{index}", (x, 14.10, 12.72 - 0.06 * (index % 2)), (0.18, 0.12, 0.24), sage, garden)

camera = bpy.data.objects.get("Rooftop_Garden_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(20.0, 10.05, 13.35))
    camera = bpy.context.object
    camera.name = "Rooftop_Garden_Refined_Camera"
    move(camera, garden)
camera.location = (20.0, 10.05, 13.35)
camera.data.lens = 15
aim(camera, (20.0, 14.25, 10.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Rooftop_Garden_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, 10.72, 13.55))
    key = bpy.context.object
    key.name = "Rooftop_Garden_Refined_Key"
    move(key, garden)
key.data.energy = 760
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (20.0, 14.2, 10.9))

fill = bpy.data.objects.get("Rooftop_Garden_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, 14.2, 14.10))
    fill = bpy.context.object
    fill.name = "Rooftop_Garden_Refined_Fill"
    move(fill, garden)
fill.data.energy = 360
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (20.0, 14.2, 10.6))

scene = bpy.context.scene
scene["rooftop_garden_refinement_pass"] = "conservatory-social-shop-form-v1"
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

staff_camera = bpy.data.objects.get("Rooftop_Garden_Staff_Aisle_Camera")
if staff_camera is None:
    bpy.ops.object.camera_add(location=(15.1, 16.10, 13.55))
    staff_camera = bpy.context.object
    staff_camera.name = "Rooftop_Garden_Staff_Aisle_Camera"
    move(staff_camera, garden)
staff_camera.location = (15.1, 16.10, 13.55)
staff_camera.data.lens = 24
aim(staff_camera, (19.0, 16.10, 10.45))
scene.camera = staff_camera
scene.render.filepath = str(STAFF_RENDER)
bpy.ops.render.render(write_still=True)
scene.camera = camera
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("ROOFTOP_GARDEN_REFINED_READY", MASTER)
print("ROOFTOP_GARDEN_REFINED_RENDER", RENDER)
print("ROOFTOP_GARDEN_STAFF_RENDER", STAFF_RENDER)
