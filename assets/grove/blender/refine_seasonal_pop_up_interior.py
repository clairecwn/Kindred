import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "seasonal_pop_up_refined_blender.png"
COLLECTION_NAME = "SEASONAL_POP_UP_INTERIOR_REFINEMENT"


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


for old_name in ("SEASONAL_POP_UP_DETAIL", "SEASONAL_POP_UP_PROPS", "SEASONAL_POP_UP_LABELS"):
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

floor = mat("Seasonal_Refined_Floor", (0.38, 0.25, 0.34), 0.90)
wood = mat("Seasonal_Refined_Wood", (0.43, 0.20, 0.08), 0.80)
cream = mat("Seasonal_Refined_Cream", (0.95, 0.85, 0.67), 0.76)
coral = mat("Seasonal_Refined_Coral", (0.91, 0.32, 0.25), 0.68)
pink = mat("Seasonal_Refined_Pink", (0.91, 0.42, 0.58), 0.68)
mint = mat("Seasonal_Refined_Mint", (0.34, 0.68, 0.51), 0.70)
green = mat("Seasonal_Refined_Green", (0.18, 0.47, 0.24), 0.78)
blue = mat("Seasonal_Refined_Blue", (0.21, 0.46, 0.71), 0.68)
lavender = mat("Seasonal_Refined_Lavender", (0.56, 0.39, 0.76), 0.68)
gold = mat("Seasonal_Refined_Gold", (0.88, 0.54, 0.13), 0.40, 0.35)
dark = mat("Seasonal_Refined_Dark", (0.05, 0.055, 0.08), 0.55)
glow = mat("Seasonal_Refined_Glow", (1.0, 0.65, 0.22), 0.38, emission=(1.0, 0.43, 0.12), strength=1.8)

# Sealed Level-2 shell with an open atrium-facing entrance.
cube("Refined_Seasonal_Floor", (20, 14.0, 5.045), (11.2, 6.0, 0.09), floor, shop, 0.08)
cube("Refined_Seasonal_Entry_Mat", (20, 17.05, 5.10), (3.2, 0.72, 0.12), coral, shop, 0.10)
cube("Refined_Seasonal_Back_Wall", (20.0, 10.88, 7.50), (11.2, 0.28, 4.90), cream, shop, 0.06)
cube("Refined_Seasonal_Left_Wall", (14.40, 14.0, 7.50), (0.28, 6.20, 4.90), cream, shop, 0.06)
cube("Refined_Seasonal_Right_Wall", (25.60, 14.0, 7.50), (0.28, 6.20, 4.90), cream, shop, 0.06)
cube("Refined_Seasonal_Ceiling", (20.0, 14.0, 9.88), (11.2, 6.0, 0.20), cream, shop, 0.05)

# Modular slat wall supports event-specific merchandise.
cube("Seasonal_Slat_Back", (20.0, 11.08, 6.80), (9.4, 0.12, 3.00), dark, shop, 0.04)
for index, z in enumerate((5.62, 5.98, 6.34, 6.70, 7.06, 7.42, 7.78, 8.14)):
    cube(f"Seasonal_Slat_{index}", (20.0, 11.20, z), (9.25, 0.18, 0.08), wood, shop, 0.03)
for index, x in enumerate((15.9, 17.0, 18.1)):
    cube(f"Bloom_Tote_{index}", (x, 11.43, 7.08), (0.78, 0.16, 0.92), (coral, mint, lavender)[index], shop, 0.10)
    torus(f"Bloom_Tote_Handle_{index}", (x, 11.43, 7.60), 0.26, 0.035, gold, shop, (math.radians(90), 0, 0))
for index, x in enumerate((21.45, 22.35, 23.25, 24.15)):
    torus(f"Flower_Crown_{index}", (x, 11.44, 7.48), 0.27, 0.055, (pink, coral, mint, lavender)[index], shop, (math.radians(90), 0, 0))
    for petal in range(4):
        angle = petal * math.pi / 2
        sphere(f"Flower_Crown_Petal_{index}_{petal}", (x + math.cos(angle) * 0.27, 11.39, 7.48 + math.sin(angle) * 0.27), (0.08, 0.04, 0.06), (pink, coral, mint, lavender)[index], shop)

# Postcards rest on supported ledges beneath the hanging merchandise.
for ledge_index, x in enumerate((17.0, 20.0, 23.0)):
    cube(f"Postcard_Ledge_{ledge_index}", (x, 11.45, 6.18), (2.30, 0.44, 0.10), gold, shop, 0.03)
    for card in range(3):
        cube(f"Bloom_Postcard_{ledge_index}_{card}", (x - 0.65 + card * 0.65, 11.25, 6.52), (0.46, 0.07, 0.62), (pink, blue, mint)[card], shop, 0.035)

# Restrained hero tree sits at the back-center; two 1.6 m routes pass around it.
cylinder("Bloom_Hero_Plinth", (20.0, 12.55, 5.32), 1.10, 0.44, cream, shop, 32)
cylinder("Bloom_Hero_Trunk", (20.0, 12.55, 6.18), 0.17, 1.52, wood, shop, 20)
for index, (dx, dz, scale) in enumerate(((-0.48, 1.35, 0.72), (0.0, 1.62, 0.88), (0.52, 1.34, 0.70), (-0.28, 1.90, 0.58), (0.34, 1.88, 0.56))):
    sphere(f"Bloom_Hero_Canopy_{index}", (20.0 + dx, 12.55, 6.18 + dz), (scale, scale * 0.72, scale * 0.70), green if index % 2 == 0 else mint, shop)
for index, (dx, dz) in enumerate(((-0.55, 1.52), (-0.15, 2.02), (0.30, 1.62), (0.60, 1.32))):
    sphere(f"Bloom_Hero_Flower_{index}", (20.0 + dx, 12.25, 6.18 + dz), (0.15, 0.10, 0.13), (pink, coral, lavender, pink)[index], shop)

# Four sparse side pedestals hold gift products without crowding the loop.
pedestals = ((16.65, 13.25, coral), (23.35, 13.25, mint), (16.65, 15.10, lavender), (23.35, 15.10, blue))
for index, (x, y, material) in enumerate(pedestals):
    cylinder(f"Seasonal_Pedestal_{index}", (x, y, 5.58), 0.68, 1.02, cream, shop, 28)
    cube(f"Bloom_Gift_Box_{index}", (x, y, 6.27), (0.76, 0.62, 0.36), material, shop, 0.08)
    cube(f"Bloom_Gift_Ribbon_X_{index}", (x, y, 6.46), (0.12, 0.64, 0.06), gold, shop, 0.02)
    cube(f"Bloom_Gift_Ribbon_Y_{index}", (x, y, 6.46), (0.78, 0.12, 0.06), gold, shop, 0.02)
    torus(f"Bloom_Gift_Bow_{index}", (x, y, 6.60), 0.14, 0.035, gold, shop)

# Lantern cluster and wrapping station offer interactive side destinations.
cube("Seasonal_Wrapping_Table", (15.55, 16.05, 5.64), (1.90, 0.92, 1.18), wood, shop, 0.10)
for index, x in enumerate((15.05, 15.55, 16.05)):
    cylinder(f"Wrapping_Ribbon_{index}", (x, 16.05, 6.34), 0.14, 0.22, (pink, mint, coral)[index], shop, 18)
    cylinder(f"Wrapping_Ribbon_Core_{index}", (x, 16.05, 6.34), 0.05, 0.24, cream, shop, 12)
for index, x in enumerate((18.90, 20.0, 21.10)):
    cylinder(f"Bloom_Lantern_Frame_{index}", (x, 15.55, 5.74), 0.24, 0.66, gold, shop, 20)
    sphere(f"Bloom_Lantern_Glow_{index}", (x, 15.55, 5.78), (0.15, 0.15, 0.22), glow, shop)
    torus(f"Bloom_Lantern_Handle_{index}", (x, 15.55, 6.15), 0.19, 0.028, gold, shop, (math.radians(90), 0, 0))

# Checkout and staff workspot are confined to the right edge.
cube("Seasonal_Checkout", (24.45, 16.05, 5.64), (1.80, 0.92, 1.18), wood, shop, 0.10)
cube("Seasonal_Register", (24.45, 16.05, 6.39), (0.48, 0.42, 0.42), dark, shop, 0.06)
cylinder("Seasonal_Staff_Workspot", (24.45, 15.25, 5.12), 0.42, 0.025, gold, shop, 28)

for index, (x, y, material) in enumerate(((16.7, 13.4, coral), (20.0, 13.0, mint), (23.3, 13.4, lavender))):
    cylinder(f"Seasonal_Pendant_Cord_{index}", (x, y, 9.15), 0.025, 1.45, dark, shop, 10)
    cone(f"Seasonal_Pendant_Shade_{index}", (x, y, 8.38), 0.38, 0.20, 0.52, material, shop)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 8.14))
    light = bpy.context.object
    light.name = f"Seasonal_Pendant_Light_{index}"
    light.data.energy = 88
    light.data.color = (1.0, 0.64, 0.36)
    light.data.shadow_soft_size = 0.72
    move(light, shop)

camera = bpy.data.objects.get("Seasonal_Pop_Up_Refined_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(20.0, 17.95, 8.35))
    camera = bpy.context.object
    camera.name = "Seasonal_Pop_Up_Refined_Camera"
    move(camera, shop)
camera.location = (20.0, 17.95, 8.35)
camera.data.lens = 15
aim(camera, (20.0, 13.65, 5.98))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Seasonal_Pop_Up_Refined_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, 17.28, 8.28))
    key = bpy.context.object
    key.name = "Seasonal_Pop_Up_Refined_Key"
    move(key, shop)
key.data.energy = 700
key.data.shape = "RECTANGLE"
key.data.size = 6.5
key.data.size_y = 3.2
aim(key, (20.0, 13.8, 5.9))

fill = bpy.data.objects.get("Seasonal_Pop_Up_Refined_Fill")
if fill is None:
    bpy.ops.object.light_add(type="AREA", location=(20.0, 14.0, 8.45))
    fill = bpy.context.object
    fill.name = "Seasonal_Pop_Up_Refined_Fill"
    move(fill, shop)
fill.data.energy = 320
fill.data.shape = "DISK"
fill.data.size = 5.0
aim(fill, (20.0, 13.8, 5.7))

scene = bpy.context.scene
scene["seasonal_pop_up_refinement_pass"] = "bloom-festival-form-v1"
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
print("SEASONAL_POP_UP_REFINED_READY", MASTER)
print("SEASONAL_POP_UP_REFINED_RENDER", RENDER)
