import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(bpy.data.filepath).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "grove_park_detail_blender.png"
COLLECTION_NAME = "GROVE_PARK_DETAIL_REFINEMENT"


def material(name, color, roughness=0.8, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
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


def cube(name, location, dimensions, mat, collection, bevel=0.2):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("GroveRoundedEdge", "BEVEL")
        mod.width = min(bevel, min(dimensions) * 0.3)
        mod.segments = 4
    obj.data.materials.append(mat)
    return move(obj, collection)


def cylinder(name, location, radius, depth, mat, collection, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
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


def ribbon(name, points, width, z, mat, collection):
    """Create a flat, solid path ribbon from a centerline without sharp box joins."""
    left = []
    right = []
    for index, point in enumerate(points):
        current = Vector((point[0], point[1]))
        previous = Vector(points[max(0, index - 1)])
        following = Vector(points[min(len(points) - 1, index + 1)])
        tangent = following - previous
        if tangent.length == 0:
            tangent = Vector((0.0, 1.0))
        tangent.normalize()
        normal = Vector((-tangent.y, tangent.x)) * (width * 0.5)
        left.append(current + normal)
        right.append(current - normal)

    outline = left + list(reversed(right))
    bottom_z = z - 0.12
    vertices = [(p.x, p.y, z) for p in outline] + [(p.x, p.y, bottom_z) for p in outline]
    count = len(outline)
    faces = [tuple(range(count)), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("GrovePathSoftEdge", "BEVEL")
    bevel.width = 0.24
    bevel.segments = 5
    return obj


def flower(name, location, radius, petal_mat, center_mat, collection, petals=5):
    x, y, z = location
    cylinder(name + "_Stem", (x, y, z - 0.2), 0.025, 0.4, stem, collection, 10)
    for index in range(petals):
        angle = math.tau * index / petals
        sphere(
            name + f"_Petal_{index}",
            (x + math.cos(angle) * radius, y + math.sin(angle) * radius, z),
            (radius * 0.74, radius * 0.46, radius * 0.20),
            petal_mat,
            collection,
        )
    sphere(name + "_Center", (x, y, z + 0.035), (radius * 0.42,) * 3, center_mat, collection)


def lantern(name, location, collection):
    x, y = location
    cylinder(name + "_Post", (x, y, 1.35), 0.07, 2.7, dark_metal, collection, 16)
    cylinder(name + "_Cap", (x, y, 2.75), 0.22, 0.12, dark_metal, collection, 20)
    sphere(name + "_Glow", (x, y, 2.55), (0.28, 0.28, 0.38), warm_light, collection)


def hide_previous_substrates():
    for name in ("Park_Ground", "Arrival_Main_Path", "Park_Cross_Path"):
        obj = bpy.data.objects.get(name)
        if obj:
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

detail = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(detail)

grass = material("Grove_Detail_Grass", (0.30, 0.51, 0.22), 0.94)
grass_light = material("Grove_Detail_Grass_Light", (0.43, 0.63, 0.29), 0.92)
path = material("Grove_Detail_Path", (0.77, 0.60, 0.43), 0.88)
path_edge = material("Grove_Detail_Path_Edge", (0.91, 0.78, 0.59), 0.88)
mulch = material("Grove_Detail_Mulch", (0.23, 0.105, 0.055), 0.96)
stone = material("Grove_Detail_Stone", (0.42, 0.46, 0.39), 0.9)
stone_light = material("Grove_Detail_Stone_Light", (0.61, 0.64, 0.54), 0.9)
stem = material("Grove_Detail_Stem", (0.12, 0.37, 0.17), 0.9)
pink = material("Grove_Detail_Pink", (0.89, 0.34, 0.48), 0.76)
yellow = material("Grove_Detail_Yellow", (0.98, 0.67, 0.18), 0.72)
blue = material("Grove_Detail_Blue", (0.24, 0.60, 0.72), 0.76)
warm_light = material("Grove_Detail_Lantern", (1.0, 0.64, 0.25), 0.34)
dark_metal = material("Grove_Detail_Dark_Metal", (0.055, 0.075, 0.065), 0.5, 0.25)

hide_previous_substrates()

# A softened terrain slab keeps the park edge intentional while the mounds
# produce layered, hand-shaped terrain instead of a single flat rectangle.
cube("Refined_Park_Ground", (0, 35, -0.34), (58, 26, 0.68), grass, detail, 1.8)
for index, (x, y, sx, sy, height) in enumerate(
    [(-22, 30, 8.5, 5.0, 0.30), (-16, 42, 10.0, 4.8, 0.34), (17, 42, 11.0, 5.2, 0.30), (23, 31, 7.8, 4.6, 0.28)]
):
    sphere(f"Park_Terrain_Mound_{index}", (x, y, -0.02), (sx, sy, height), grass_light, detail)

# Continuous, gently bending routes replace the temporary cross-shaped slabs.
ribbon("Park_Main_Curved_Path", [(0, 23.0), (0, 28), (-0.8, 32), (0.4, 36), (0, 44.5)], 7.2, 0.10, path, detail)
ribbon("Park_Left_Loop_Path", [(0, 37.8), (-7, 38.6), (-14, 37.0), (-18, 34.5)], 3.0, 0.11, path_edge, detail)
ribbon("Park_Right_Loop_Path", [(0, 38.2), (7, 39.1), (13, 37.0), (15.5, 34.5)], 3.0, 0.11, path_edge, detail)

# Tree wells and root collars visually seat the refined vegetation in terrain.
tree_positions = [(-18, 30), (-13, 42), (13, 42), (18, 30), (-22, 39), (22, 39)]
for index, (x, y) in enumerate(tree_positions):
    sphere(f"Tree_Well_{index}", (x, y, 0.04), (2.15, 1.75, 0.12), mulch, detail)
    for rock_index, angle in enumerate((0.4, 2.2, 4.3)):
        sphere(
            f"Tree_Well_Rock_{index}_{rock_index}",
            (x + math.cos(angle) * 1.65, y + math.sin(angle) * 1.25, 0.25),
            (0.42, 0.30, 0.24),
            stone_light if rock_index == 1 else stone,
            detail,
        )

# Small authored flower drifts add close-range detail and color rhythm.
flower_groups = [(-10.5, 31.0), (-8.6, 42.2), (9.0, 42.0), (10.8, 31.2), (-19.2, 36.8), (19.0, 36.8)]
for group_index, (gx, gy) in enumerate(flower_groups):
    for flower_index, (ox, oy) in enumerate(((0, 0), (0.46, 0.22), (-0.42, 0.18), (0.16, -0.38))):
        flower(
            f"Park_Flower_{group_index}_{flower_index}",
            (gx + ox, gy + oy, 0.58 + 0.05 * (flower_index % 2)),
            0.16 + 0.02 * (flower_index % 2),
            (pink, yellow, blue)[(group_index + flower_index) % 3],
            yellow,
            detail,
        )

# Warm lamps punctuate the route without becoming competing landmarks.
for index, location in enumerate(((-4.7, 29.6), (4.7, 33.2), (-4.8, 40.6), (5.0, 42.0))):
    lantern(f"Park_Lantern_{index}", location, detail)

# A discoverable stepping-stone nook is visible at the edge of the main loop.
# It suggests a secret without copying a Mario collectible or level motif.
for index, (x, y, scale) in enumerate(((-18.5, 40.2, 0.72), (-20.0, 42.0, 0.66), (-21.0, 44.0, 0.58))):
    sphere(f"Park_Secret_Step_{index}", (x, y, 0.18), (scale, scale * 0.76, 0.20), stone_light, detail)
flower("Park_Secret_Bloom", (-21.5, 45.0, 0.72), 0.34, pink, yellow, detail, petals=6)

# Review camera keeps the true entrance, hero activity, and richer ground plane
# in one composition for the Form pass.
camera = bpy.data.objects.get("Grove_Park_Detail_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(35, 61, 18.5))
    camera = bpy.context.object
    camera.name = "Grove_Park_Detail_Camera"
    move(camera, detail)
camera.location = (35, 61, 18.5)
camera.data.lens = 46
point_at(camera, (0, 34, 2.7))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Grove_Park_Detail_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-10, 50, 25))
    key = bpy.context.object
    key.name = "Grove_Park_Detail_Key"
    move(key, detail)
key.data.energy = 1300
key.data.shape = "DISK"
key.data.size = 18
point_at(key, (0, 35, 0))

scene = bpy.context.scene
scene["grove_park_detail_pass"] = "nintendo-inspired-stylized-realism-v1"
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
print(f"GROVE_PARK_DETAIL_READY {MASTER}")
print(f"GROVE_PARK_DETAIL_RENDER {RENDER}")
