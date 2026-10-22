import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(bpy.data.filepath).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "grove_vegetation_blender.png"
COLLECTION_NAME = "GROVE_VEGETATION_REFINEMENT"


def material(name, color, roughness=0.82):
    existing = bpy.data.materials.get(name)
    if existing:
        existing.diffuse_color = (*color, 1.0)
        if existing.use_nodes:
            bsdf = existing.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs["Base Color"].default_value = (*color, 1.0)
                bsdf.inputs["Roughness"].default_value = roughness
        return existing
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def move(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def smooth_mesh(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def uv_lobe(name, location, scale, mat, collection, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=20,
        ring_count=12,
        radius=1.0,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth_mesh(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def tapered_trunk(name, location, height, radius_bottom, radius_top, mat, collection, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(
        vertices=16,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=height,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    smooth_mesh(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def branch_between(name, start, end, radius, mat, collection):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    midpoint = (start_v + end_v) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=radius,
        radius2=radius * 0.62,
        depth=delta.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    smooth_mesh(obj)
    obj.data.materials.append(mat)
    return move(obj, collection)


def stylized_tree(name, x, y, ground_z, height, spread, collection, variant=0, interior=False):
    trunk_height = height * 0.58
    trunk_center_z = ground_z + trunk_height * 0.5
    lean_x = (0.08 if variant % 2 == 0 else -0.10) * spread
    lean_y = (0.06 if variant % 3 == 0 else -0.04) * spread
    tapered_trunk(
        name + "_Trunk",
        (x, y, trunk_center_z),
        trunk_height,
        0.34 * spread,
        0.22 * spread,
        bark,
        collection,
        rotation=(lean_y * 0.035, lean_x * 0.035, 0),
    )
    crown_z = ground_z + height * 0.72
    branch_root = (x, y, ground_z + trunk_height * 0.78)
    branch_targets = [
        (x - 0.78 * spread, y + 0.08 * spread, crown_z - 0.15 * spread),
        (x + 0.75 * spread, y - 0.12 * spread, crown_z),
        (x + 0.08 * spread, y + 0.62 * spread, crown_z + 0.18 * spread),
    ]
    for branch_index, target in enumerate(branch_targets):
        branch_between(name + f"_Branch_{branch_index}", branch_root, target, 0.13 * spread, bark, collection)

    lobe_specs = [
        ((0.0, 0.0, 0.24), (1.28, 1.02, 0.88), leaf_mid),
        ((-0.74, 0.02, 0.02), (0.94, 0.84, 0.76), leaf_dark),
        ((0.74, -0.06, 0.08), (0.96, 0.82, 0.78), leaf_mid),
        ((-0.18, 0.52, 0.14), (0.90, 0.76, 0.74), leaf_light),
        ((0.22, -0.46, 0.18), (0.86, 0.74, 0.70), leaf_dark),
        ((0.10, 0.04, 0.70), (0.76, 0.70, 0.62), leaf_light),
    ]
    for lobe_index, (offset, lobe_scale, lobe_mat) in enumerate(lobe_specs):
        ox, oy, oz = offset
        sx, sy, sz = lobe_scale
        wobble = 1.0 + 0.04 * ((variant + lobe_index) % 3 - 1)
        uv_lobe(
            name + f"_Canopy_{lobe_index}",
            (x + ox * spread, y + oy * spread, crown_z + oz * spread),
            (sx * spread * wobble, sy * spread, sz * spread),
            lobe_mat,
            collection,
            rotation=(0.05 * ((lobe_index % 2) - 0.5), 0.04 * ((lobe_index % 3) - 1), 0.14 * lobe_index),
        )

    # A few small accent clusters keep the silhouette lively without turning
    # every tree into a competing focal feature.
    if not interior:
        for fruit_index, angle in enumerate((0.4, 2.6, 4.7)):
            uv_lobe(
                name + f"_Fruit_{fruit_index}",
                (
                    x + math.cos(angle) * spread * 0.72,
                    y + math.sin(angle) * spread * 0.52,
                    crown_z + spread * (0.38 + 0.12 * fruit_index),
                ),
                (0.12 * spread, 0.12 * spread, 0.14 * spread),
                blossom,
                collection,
            )


def soft_shrub(name, x, y, z, scale, collection, flowers=True):
    specs = [(-0.42, 0.0, 0.12, 0.62), (0.38, 0.05, 0.08, 0.66), (0.0, 0.26, 0.32, 0.72)]
    for index, (ox, oy, oz, size) in enumerate(specs):
        uv_lobe(
            name + f"_Lobe_{index}",
            (x + ox * scale, y + oy * scale, z + oz * scale),
            (size * scale, size * scale * 0.82, size * scale * 0.72),
            (leaf_dark, leaf_mid, leaf_light)[index],
            collection,
        )
    if flowers:
        for flower_index, (ox, oy) in enumerate(((-0.35, 0.05), (0.1, 0.32), (0.42, -0.04))):
            uv_lobe(
                name + f"_Bloom_{flower_index}",
                (x + ox * scale, y + oy * scale, z + 0.72 * scale),
                (0.12 * scale, 0.10 * scale, 0.08 * scale),
                (blossom, sun, mint)[flower_index],
                collection,
            )


def hide_old_foliage():
    prefixes = (
        "Park_Tree_Trunk_",
        "Park_Tree_Canopy_",
        "Park_Tree_Highlight_",
        "Park_Shrub_",
        "Atrium_Garden_Trunk",
        "Atrium_Garden_Canopy",
        "Atrium_Topiary_",
        "Atrium_Topiary_Highlight_",
        "Roof_Shrub_",
    )
    for obj in bpy.data.objects:
        if obj.name.startswith(prefixes) and not obj.name.startswith("Refined_"):
            obj.hide_render = True
            obj.hide_set(True)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


if Path(bpy.data.filepath).name != MASTER.name:
    raise RuntimeError(f"Open only the dedicated Grove source before running this pass: {MASTER}")

old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)

vegetation = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(vegetation)

bark = material("Grove_Veg_Bark", (0.34, 0.17, 0.10), 0.88)
leaf_dark = material("Grove_Veg_Leaf_Dark", (0.10, 0.31, 0.16), 0.9)
leaf_mid = material("Grove_Veg_Leaf_Mid", (0.20, 0.49, 0.25), 0.88)
leaf_light = material("Grove_Veg_Leaf_Light", (0.31, 0.57, 0.24), 0.86)
blossom = material("Grove_Veg_Blossom", (0.94, 0.46, 0.58), 0.76)
sun = material("Grove_Veg_Sun", (0.96, 0.68, 0.18), 0.72)
mint = material("Grove_Veg_Mint", (0.28, 0.70, 0.58), 0.76)

hide_old_foliage()

# Outdoor canopy trees: deliberately outside the entrance and main path.
park_trees = [(-18, 30), (-13, 42), (13, 42), (18, 30), (-22, 39), (22, 39)]
for index, (x, y) in enumerate(park_trees):
    stylized_tree(f"Refined_Park_Tree_{index}", x, y, 0.0, 6.0 + 0.25 * (index % 3), 1.18, vegetation, index)

# Naturalized shrub groupings replace the single faceted balls.
park_shrubs = [(-8, 31), (8, 31), (-18, 35), (18, 35), (-9, 43), (9, 43)]
for index, (x, y) in enumerate(park_shrubs):
    soft_shrub(f"Refined_Park_Shrub_{index}", x, y, 0.45, 1.0 + 0.08 * (index % 2), vegetation)

# Interior trees preserve the fourfold atrium structure but gain real branch
# hierarchy and softer silhouettes.
for index, (x, y) in enumerate(((-7, -5), (7, -5), (-7, 5), (7, 5))):
    stylized_tree(f"Refined_Atrium_Tree_{index}", x, y, 0.0, 6.0, 1.05, vegetation, index + 7, interior=True)

# Trimmed topiary remains compact enough for circulation clearances.
for index, (x, y) in enumerate(((-6.2, -4.8), (6.2, -4.8), (-6.2, 4.8), (6.2, 4.8))):
    soft_shrub(f"Refined_Atrium_Topiary_{index}", x, y, 1.0, 0.78, vegetation, flowers=False)

# Rooftop shrubs use small cloud forms, retaining the playful skyline without
# the faceted placeholder look.
for planter_index, x in enumerate((-23, -15, -7, 7, 15, 23)):
    for shrub_index, offset_x in enumerate((-1.4, 0.0, 1.4)):
        soft_shrub(
            f"Refined_Roof_Shrub_{planter_index}_{shrub_index}",
            x + offset_x,
            20.5,
            15.9,
            0.48 + 0.04 * (shrub_index % 2),
            vegetation,
            flowers=False,
        )

# Review camera prioritizes foliage silhouette while retaining the mall and
# entrance as scale/context evidence.
camera = bpy.data.objects.get("Grove_Vegetation_Review_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(34, 61, 20))
    camera = bpy.context.object
    camera.name = "Grove_Vegetation_Review_Camera"
    move(camera, vegetation)
camera.location = (34, 61, 20)
camera.data.lens = 48
point_at(camera, (0, 33, 4.2))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Grove_Vegetation_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-12, 50, 26))
    key = bpy.context.object
    key.name = "Grove_Vegetation_Key"
    move(key, vegetation)
key.data.energy = 1550
key.data.shape = "DISK"
key.data.size = 16
point_at(key, (0, 34, 3.0))

scene = bpy.context.scene
scene["grove_vegetation_pass"] = "blender-form-refinement-v1"
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
print(f"GROVE_VEGETATION_READY {MASTER}")
print(f"GROVE_VEGETATION_RENDER {RENDER}")
