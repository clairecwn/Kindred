import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(bpy.data.filepath).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "grove_atrium_blender.png"
COLLECTION_NAME = "GROVE_ATRIUM_REFINEMENT"


def material(name, color, roughness=0.72, metallic=0.0, emission=None, emission_strength=0.0):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission and bsdf.inputs.get("Emission Color"):
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def move(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, location, dimensions, mat, collection, bevel=0.1, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("GroveSoftEdges", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.25)
        modifier.segments = 3
    obj.data.materials.append(mat)
    return move(obj, collection)


def cylinder(name, location, radius, depth, mat, collection, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return move(obj, collection)


def ico(name, location, scale, mat, collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return move(obj, collection)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def bench(name, x, y, rotation_z, collection):
    seat = cube(name + "_Seat", (x, y, 0.62), (2.8, 0.72, 0.22), wood, collection, 0.12, (0, 0, rotation_z))
    # The back remains on the outer edge, leaving the sitter facing the fountain.
    offset = Vector((0, -0.42, 0))
    offset.rotate(Vector((0, 0, 1)).rotation_difference(Vector((math.sin(rotation_z), math.cos(rotation_z), 0))))
    back_x = x - math.sin(rotation_z) * 0.42
    back_y = y + math.cos(rotation_z) * 0.42
    cube(name + "_Back", (back_x, back_y, 1.15), (2.8, 0.18, 0.92), wood, collection, 0.10, (0, 0, rotation_z))
    for leg in (-0.85, 0.85):
        leg_x = x + math.cos(rotation_z) * leg
        leg_y = y + math.sin(rotation_z) * leg
        cube(name + f"_Leg_{leg}", (leg_x, leg_y, 0.30), (0.18, 0.48, 0.52), dark, collection, 0.04, (0, 0, rotation_z))
    return seat


if Path(bpy.data.filepath).name != MASTER.name:
    raise RuntimeError(f"Open only the dedicated Grove source before running this pass: {MASTER}")

old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)

atrium = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(atrium)

cream = material("Grove_Atrium_Cream", (0.94, 0.82, 0.64), 0.82)
coral = material("Grove_Atrium_Coral", (0.88, 0.34, 0.34), 0.68)
rose = material("Grove_Atrium_Rose", (0.94, 0.47, 0.58), 0.68)
gold = material("Grove_Atrium_Gold", (0.97, 0.69, 0.19), 0.54, 0.08)
mint = material("Grove_Atrium_Mint", (0.25, 0.68, 0.58), 0.68)
green = material("Grove_Atrium_Leaf", (0.18, 0.48, 0.24), 0.82)
light_green = material("Grove_Atrium_LightLeaf", (0.44, 0.68, 0.32), 0.82)
water = material("Grove_Atrium_Water", (0.14, 0.63, 0.78), 0.26, 0.08)
wood = material("Grove_Atrium_Wood", (0.43, 0.23, 0.14), 0.82)
dark = material("Grove_Atrium_Dark", (0.07, 0.11, 0.10), 0.62)
glow = material(
    "Grove_Atrium_Glow",
    (1.0, 0.74, 0.27),
    0.45,
    emission=(1.0, 0.49, 0.15),
    emission_strength=2.4,
)

# Thin path ribbons make the loop-and-spokes circulation legible without
# adding collision height or crowding the reserved fountain silhouette.
for path_index, (location, dimensions, mat) in enumerate([
    ((0, 5.6, 0.025), (4.0, 6.2, 0.05), rose),
    ((0, -5.6, 0.025), (4.0, 6.2, 0.05), rose),
    ((5.8, 0, 0.025), (6.6, 3.2, 0.05), mint),
    ((-5.8, 0, 0.025), (6.6, 3.2, 0.05), mint),
]):
    cube(f"Atrium_Path_Ribbon_{path_index}", location, dimensions, mat, atrium, 0.16)

# A low medallion defines the social heart while retaining a broad walk ring.
cylinder("Atrium_Medallion_Outer", (0, 0, 0.035), 4.45, 0.07, cream, atrium, 64)
cylinder("Atrium_Medallion_Middle", (0, 0, 0.075), 3.75, 0.06, gold, atrium, 64)
cylinder("Atrium_Medallion_Inner", (0, 0, 0.115), 3.22, 0.05, mint, atrium, 64)

# Refine the existing fountain rather than replacing its function.
cylinder("Atrium_Refined_Basin", (0, 0, 0.46), 2.75, 0.28, cream, atrium, 64)
cylinder("Atrium_Refined_Water", (0, 0, 0.63), 2.38, 0.08, water, atrium, 64)
cylinder("Atrium_Refined_Stem", (0, 0, 1.42), 0.34, 1.7, coral, atrium, 32)
for petal_index in range(6):
    angle = petal_index * math.tau / 6
    ico(
        f"Atrium_Fountain_Petal_{petal_index}",
        (math.cos(angle) * 0.72, math.sin(angle) * 0.72, 2.35),
        (0.72, 0.48, 0.22),
        (rose, gold, mint)[petal_index % 3],
        atrium,
    )
ico("Atrium_Fountain_Heart", (0, 0, 2.42), (0.52, 0.52, 0.42), gold, atrium)

# Four compact planting anchors reinforce the existing bilateral layout.
for planter_index, (x, y) in enumerate(((-6.2, -4.8), (6.2, -4.8), (-6.2, 4.8), (6.2, 4.8))):
    cylinder(f"Atrium_Planter_{planter_index}", (x, y, 0.48), 0.92, 0.96, cream, atrium, 32)
    ico(f"Atrium_Topiary_{planter_index}", (x, y, 1.52), (1.05, 0.92, 0.88), green, atrium)
    ico(f"Atrium_Topiary_Highlight_{planter_index}", (x - 0.28, y - 0.14, 1.82), (0.45, 0.38, 0.34), light_green, atrium)

# Conversation seating faces the fountain and leaves the spokes clear.
bench("Atrium_Bench_West", -8.1, 0, -math.pi / 2, atrium)
bench("Atrium_Bench_East", 8.1, 0, math.pi / 2, atrium)

# Flower boxes soften upper balcony edges while keeping the open void legible.
for level_index, z in enumerate((4.45, 9.45), start=2):
    for box_index, (x, y) in enumerate(((-6.2, -7.6), (6.2, -7.6), (-6.2, 7.6), (6.2, 7.6))):
        cube(f"Atrium_L{level_index}_FlowerBox_{box_index}", (x, y, z), (3.0, 0.55, 0.52), cream, atrium, 0.16)
        for bloom_index, offset_x in enumerate((-0.8, 0.0, 0.8)):
            ico(
                f"Atrium_L{level_index}_Bloom_{box_index}_{bloom_index}",
                (x + offset_x, y, z + 0.52),
                (0.32, 0.27, 0.28),
                (rose, gold, mint)[bloom_index],
                atrium,
            )

# Suspended buds provide a vertical rhythm and have explicit cords/roses.
pendant_positions = [(-6, -4), (6, -4), (-6, 4), (6, 4)]
for pendant_index, (x, y) in enumerate(pendant_positions):
    cylinder(f"Atrium_Pendant_Cord_{pendant_index}", (x, y, 12.8), 0.035, 4.0, dark, atrium, 12)
    cylinder(f"Atrium_Pendant_Rose_{pendant_index}", (x, y, 14.82), 0.24, 0.18, gold, atrium, 20)
    ico(f"Atrium_Pendant_Bud_{pendant_index}", (x, y, 10.75), (0.46, 0.46, 0.62), (rose, gold, mint, coral)[pendant_index], atrium)
    bpy.ops.object.light_add(type="POINT", location=(x, y, 10.55))
    light = bpy.context.object
    light.name = f"Atrium_Pendant_Light_{pendant_index}"
    light.data.energy = 105
    light.data.color = (1.0, 0.58, 0.28)
    light.data.shadow_soft_size = 1.2
    move(light, atrium)

# Entry-facing review camera sits just inside the mall and avoids the south
# escalator, proving that the arrival opens onto the central landmark.
camera = bpy.data.objects.get("Grove_Atrium_Review_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(10.5, 17.6, 5.8))
    camera = bpy.context.object
    camera.name = "Grove_Atrium_Review_Camera"
    move(camera, atrium)
camera.location = (10.5, 17.6, 5.8)
camera.data.lens = 35
point_at(camera, (0, 0, 3.1))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Grove_Atrium_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(0, 1, 14.2))
    key = bpy.context.object
    key.name = "Grove_Atrium_Key"
    move(key, atrium)
key.data.energy = 2100
key.data.shape = "DISK"
key.data.size = 12
point_at(key, (0, 0, 0.5))

scene = bpy.context.scene
scene["grove_atrium_pass"] = "blender-form-refinement-v1"
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
print(f"GROVE_ATRIUM_READY {MASTER}")
print(f"GROVE_ATRIUM_RENDER {RENDER}")
