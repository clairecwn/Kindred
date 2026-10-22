import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(bpy.data.filepath).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "grove_storefronts_blender.png"
COLLECTION_NAME = "GROVE_STOREFRONT_REFINEMENT"


def material(name, color, roughness=0.75, metallic=0.0, transmission=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if bsdf.inputs.get("Transmission Weight"):
            bsdf.inputs["Transmission Weight"].default_value = transmission
        if bsdf.inputs.get("Alpha"):
            bsdf.inputs["Alpha"].default_value = alpha
    return mat


def move(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def smooth(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def cube(name, location, dimensions, mat, collection, bevel=0.08, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("GroveSoftEdge", "BEVEL")
        mod.width = min(bevel, min(dimensions) * 0.28)
        mod.segments = 3
    obj.data.materials.append(mat)
    return move(obj, collection)


def cylinder(name, location, radius, depth, mat, collection, vertices=24, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def sphere(name, location, scale, mat, collection):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def cone(name, location, radius1, radius2, depth, mat, collection, vertices=20):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def torus(name, location, major_radius, minor_radius, mat, collection, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=28,
        minor_segments=10,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def display_shell(shop_id, x, accent, collection):
    # A visibly backed 1.2 m-deep display alcove. These are windows, not doors;
    # the central park entrance remains the exterior circulation route.
    cube(f"{shop_id}_Backdrop", (x, 22.47, 1.92), (5.6, 0.24, 2.86), warm_back, collection, 0.10)
    cube(f"{shop_id}_Floor", (x, 23.12, 0.56), (5.6, 1.54, 0.22), pale_stone, collection, 0.08)
    cube(f"{shop_id}_Ceiling", (x, 23.12, 3.28), (5.6, 1.54, 0.22), warm_white, collection, 0.08)
    cube(f"{shop_id}_Left_Frame", (x - 2.72, 23.30, 1.92), (0.24, 1.22, 2.92), accent, collection, 0.08)
    cube(f"{shop_id}_Right_Frame", (x + 2.72, 23.30, 1.92), (0.24, 1.22, 2.92), accent, collection, 0.08)
    cube(f"{shop_id}_Top_Frame", (x, 23.30, 3.30), (5.68, 1.22, 0.22), accent, collection, 0.08)
    cube(f"{shop_id}_Plinth", (x, 23.48, 0.69), (5.14, 0.62, 0.34), accent, collection, 0.10)
    glass_obj = cube(f"{shop_id}_Glass", (x, 23.82, 1.96), (5.12, 0.035, 2.44), glass, collection, 0.015)
    glass_obj["semantic_type"] = "display-glazing"
    glass_obj["display_depth_m"] = 1.2
    cube(f"{shop_id}_Light_Rail", (x, 23.06, 3.11), (4.6, 0.10, 0.10), gold, collection, 0.04)
    for light_index, offset in enumerate((-1.65, 0.0, 1.65)):
        bpy.ops.object.light_add(type="POINT", location=(x + offset, 23.35, 2.88))
        light = bpy.context.object
        light.name = f"{shop_id}_Display_Light_{light_index}"
        light.data.energy = 22
        light.data.color = (1.0, 0.72, 0.42)
        light.data.shadow_soft_size = 0.8
        move(light, collection)


def grocery_display(x, collection):
    # Produce crates, varied fruit/vegetables, and two distinct household goods.
    for crate_index, offset in enumerate((-1.55, 0.0, 1.55)):
        cube(f"Fresh_Crate_{crate_index}", (x + offset, 23.28, 1.02), (1.18, 0.72, 0.54), wood, collection, 0.07)
        for item_index in range(5):
            ix = x + offset - 0.38 + (item_index % 3) * 0.36
            iy = 23.30 + (item_index // 3) * 0.16
            iz = 1.40 + 0.10 * (item_index // 3)
            if crate_index == 0:
                sphere(f"Fresh_Apple_{item_index}", (ix, iy, iz), (0.15, 0.15, 0.14), red, collection)
                cylinder(f"Fresh_Apple_Stem_{item_index}", (ix, iy, iz + 0.16), 0.018, 0.10, leaf, collection, 8)
            elif crate_index == 1:
                sphere(f"Fresh_Orange_{item_index}", (ix, iy, iz), (0.16, 0.16, 0.16), orange, collection)
            else:
                sphere(f"Fresh_Cabbage_{item_index}", (ix, iy, iz), (0.19, 0.18, 0.16), leaf_light, collection)
    # Cleaning bottle and paper roll communicate broader grocery inventory.
    cylinder("Fresh_Cleaner_Bottle", (x - 0.42, 23.22, 2.26), 0.18, 0.68, mint, collection, 20)
    cone("Fresh_Cleaner_Neck", (x - 0.42, 23.22, 2.66), 0.12, 0.08, 0.18, mint, collection)
    cube("Fresh_Cleaner_Nozzle", (x - 0.28, 23.22, 2.79), (0.34, 0.16, 0.12), coral, collection, 0.04)
    cylinder("Fresh_Paper_Roll", (x + 0.55, 23.22, 2.25), 0.30, 0.64, warm_white, collection, 28)
    cylinder("Fresh_Paper_Core", (x + 0.55, 23.22, 2.25), 0.095, 0.66, brown, collection, 20)


def clothing_display(x, collection):
    # Two supported mannequins plus distinct shoes and accessories.
    for mannequin_index, offset in enumerate((-1.25, 0.55)):
        cylinder(f"Style_Stand_{mannequin_index}", (x + offset, 23.12, 0.92), 0.08, 0.52, dark, collection, 16)
        cylinder(f"Style_Stand_Base_{mannequin_index}", (x + offset, 23.12, 0.67), 0.30, 0.08, dark, collection, 24)
        cone(f"Style_Torso_{mannequin_index}", (x + offset, 23.12, 1.78), 0.40, 0.30, 1.18, (rose, mint)[mannequin_index], collection)
        sphere(f"Style_Head_{mannequin_index}", (x + offset, 23.12, 2.62), (0.25, 0.24, 0.29), warm_white, collection)
        for side in (-1, 1):
            cube(
                f"Style_Sleeve_{mannequin_index}_{side}",
                (x + offset + side * 0.43, 23.12, 2.05),
                (0.48, 0.28, 0.26),
                (rose, mint)[mannequin_index],
                collection,
                0.10,
                rotation=(0, side * math.radians(18), 0),
            )
    # Shoe pair and handbag sit on a dedicated side shelf.
    cube("Style_Shoe_Left_Sole", (x + 1.65, 23.18, 1.03), (0.62, 0.32, 0.10), gold, collection, 0.05)
    cube("Style_Shoe_Left_Upper", (x + 1.55, 23.18, 1.17), (0.42, 0.30, 0.22), coral, collection, 0.08)
    cube("Style_Shoe_Right_Sole", (x + 2.08, 23.18, 1.03), (0.62, 0.32, 0.10), gold, collection, 0.05)
    cube("Style_Shoe_Right_Upper", (x + 1.98, 23.18, 1.17), (0.42, 0.30, 0.22), coral, collection, 0.08)
    cube("Style_Bag_Body", (x + 1.82, 23.14, 2.05), (0.82, 0.30, 0.66), violet, collection, 0.12)
    torus("Style_Bag_Handle", (x + 1.82, 23.14, 2.42), 0.27, 0.055, gold, collection, rotation=(math.pi / 2, 0, 0))


def home_display(x, collection):
    # Lamp, stacked cushions, planter, and vase all have visible support/contact.
    cube("Home_Table_Top", (x, 23.18, 1.13), (2.0, 0.74, 0.16), wood, collection, 0.08)
    for side in (-0.72, 0.72):
        cylinder(f"Home_Table_Leg_{side}", (x + side, 23.18, 0.86), 0.06, 0.54, dark, collection, 14)
    cylinder("Home_Lamp_Base", (x - 0.52, 23.16, 1.33), 0.22, 0.08, gold, collection, 24)
    cylinder("Home_Lamp_Stem", (x - 0.52, 23.16, 1.70), 0.045, 0.72, gold, collection, 14)
    cone("Home_Lamp_Shade", (x - 0.52, 23.16, 2.14), 0.46, 0.28, 0.62, yellow, collection)
    for cushion_index, (cx, cz, angle) in enumerate(((0.52, 1.43, -8), (0.78, 1.78, 9))):
        cube(
            f"Home_Cushion_{cushion_index}",
            (x + cx, 23.16, cz),
            (0.78, 0.30, 0.58),
            (mint, rose)[cushion_index],
            collection,
            0.18,
            rotation=(0, math.radians(angle), 0),
        )
    cylinder("Home_Planter", (x + 1.72, 23.16, 1.00), 0.38, 0.56, pale_stone, collection, 24)
    for leaf_index, angle in enumerate((0.2, 2.3, 4.4)):
        sphere(
            f"Home_Plant_Leaf_{leaf_index}",
            (x + 1.72 + math.cos(angle) * 0.34, 23.16, 1.55 + math.sin(angle) * 0.08),
            (0.38, 0.18, 0.18),
            leaf if leaf_index % 2 == 0 else leaf_light,
            collection,
        )
    cone("Home_Vase", (x - 1.65, 23.16, 1.58), 0.28, 0.16, 0.78, blue, collection)


def taste_display(x, collection):
    # A bakery counter with individual pastries, cups, and cake stand.
    cube("Taste_Counter", (x - 0.25, 23.16, 1.04), (3.55, 0.72, 0.72), wood, collection, 0.10)
    for pastry_index, offset in enumerate((-1.35, -0.72, -0.08, 0.58)):
        torus(f"Taste_Pastry_{pastry_index}", (x + offset, 23.22, 1.47), 0.18, 0.075, (gold, orange, rose, gold)[pastry_index], collection, rotation=(math.pi / 2, 0, 0))
    cylinder("Taste_Cake_Stand", (x + 1.35, 23.15, 1.34), 0.42, 0.10, pale_stone, collection, 28)
    cylinder("Taste_Cake", (x + 1.35, 23.15, 1.55), 0.34, 0.34, pink_cream, collection, 28)
    sphere("Taste_Cake_Berry", (x + 1.35, 23.15, 1.77), (0.10, 0.10, 0.09), red, collection)
    for cup_index, offset in enumerate((-0.75, 0.15)):
        cylinder(f"Taste_Cup_{cup_index}", (x + offset, 23.16, 2.35), 0.18, 0.42, (mint, coral)[cup_index], collection, 24)
        torus(f"Taste_Cup_Handle_{cup_index}", (x + offset + 0.19, 23.16, 2.35), 0.12, 0.035, (mint, coral)[cup_index], collection, rotation=(math.pi / 2, 0, 0))
    cube("Taste_Upper_Shelf", (x, 22.75, 2.85), (3.6, 0.46, 0.12), gold, collection, 0.05)


if Path(bpy.data.filepath).name != MASTER.name:
    raise RuntimeError(f"Open only the dedicated Grove source before running this pass: {MASTER}")

old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)

storefronts = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(storefronts)

warm_white = material("Grove_Store_Warm_White", (0.95, 0.86, 0.69), 0.78)
warm_back = material("Grove_Store_Warm_Back", (0.20, 0.13, 0.09), 0.88)
pale_stone = material("Grove_Store_Pale_Stone", (0.78, 0.70, 0.58), 0.88)
wood = material("Grove_Store_Wood", (0.36, 0.17, 0.08), 0.88)
dark = material("Grove_Store_Dark", (0.04, 0.065, 0.055), 0.55, 0.1)
gold = material("Grove_Store_Gold", (0.95, 0.61, 0.13), 0.58, 0.08)
coral = material("Grove_Store_Coral", (0.82, 0.24, 0.30), 0.70)
rose = material("Grove_Store_Rose", (0.88, 0.38, 0.53), 0.72)
mint = material("Grove_Store_Mint", (0.20, 0.61, 0.49), 0.72)
blue = material("Grove_Store_Blue", (0.20, 0.47, 0.62), 0.70)
violet = material("Grove_Store_Violet", (0.50, 0.27, 0.62), 0.72)
yellow = material("Grove_Store_Yellow", (0.95, 0.67, 0.18), 0.70)
orange = material("Grove_Store_Orange", (0.92, 0.40, 0.10), 0.76)
red = material("Grove_Store_Red", (0.70, 0.08, 0.08), 0.76)
brown = material("Grove_Store_Brown", (0.26, 0.12, 0.05), 0.9)
leaf = material("Grove_Store_Leaf", (0.10, 0.34, 0.16), 0.9)
leaf_light = material("Grove_Store_Leaf_Light", (0.34, 0.59, 0.26), 0.88)
pink_cream = material("Grove_Store_Pink_Cream", (0.93, 0.60, 0.66), 0.8)
glass = material("Grove_Store_Glass", (0.48, 0.79, 0.80), 0.18, transmission=0.72, alpha=0.22)

shops = [
    ("Fresh_Window", -22.0, leaf, grocery_display),
    ("Style_Window", -14.0, rose, clothing_display),
    ("Home_Window", 14.0, gold, home_display),
    ("Taste_Window", 22.0, coral, taste_display),
]
for shop_id, x, accent, builder in shops:
    display_shell(shop_id, x, accent, storefronts)
    builder(x, storefronts)

# A closer review angle makes product silhouettes and honest alcove depth clear
# while preserving the open central entrance as the circulation anchor.
camera = bpy.data.objects.get("Grove_Storefront_Review_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(0, 82, 18.0))
    camera = bpy.context.object
    camera.name = "Grove_Storefront_Review_Camera"
    move(camera, storefronts)
camera.location = (0, 82, 18.0)
camera.data.lens = 38
point_at(camera, (0, 23.2, 3.2))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Grove_Storefront_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-8, 47, 20))
    key = bpy.context.object
    key.name = "Grove_Storefront_Key"
    move(key, storefronts)
key.data.energy = 1150
key.data.shape = "DISK"
key.data.size = 15
point_at(key, (0, 23, 3))

scene = bpy.context.scene
scene["grove_storefront_pass"] = "nintendo-inspired-merchandise-form-v1"
scene["grove_character_pipeline"] = "read-only-not-loaded"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.resolution_percentage = 75
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(RENDER)
scene.view_settings.look = "AgX - Medium High Contrast"

bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print(f"GROVE_STOREFRONTS_READY {MASTER}")
print(f"GROVE_STOREFRONTS_RENDER {RENDER}")
