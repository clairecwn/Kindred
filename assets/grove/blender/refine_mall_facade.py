import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(bpy.data.filepath).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
RENDER = ROOT / "renders" / "grove_mall_facade_blender.png"
COLLECTION_NAME = "GROVE_MALL_FACADE_REFINEMENT"


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


def move_to_collection(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, location, dimensions, mat, collection, bevel=0.1):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("GroveSoftEdges", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.25)
        modifier.segments = 3
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def cylinder(name, location, radius, depth, mat, collection, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def ico(name, location, scale, mat, collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def text(name, body, location, size, mat, collection, extrude=0.035):
    bpy.ops.object.text_add(location=location, rotation=(math.pi / 2, 0, math.pi))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = extrude
    obj.data.bevel_depth = 0.012
    obj.data.materials.append(mat)
    return move_to_collection(obj, collection)


def curve(name, points, bevel_depth, mat, collection):
    data = bpy.data.curves.new(name, type="CURVE")
    data.dimensions = "3D"
    data.bevel_depth = bevel_depth
    data.bevel_resolution = 3
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinates in zip(spline.bezier_points, points):
        point.co = coordinates
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    data.materials.append(mat)
    collection.objects.link(obj)
    return obj


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def display_bay(name, x, z, accent, collection):
    # A complete wall-mounted display bay: visible backing, 0.7 m depth,
    # frame, sill and canopy. It does not pretend to be a passage.
    y_surface = 22.31
    cube(f"{name}_Backing", (x, y_surface + 0.05, z), (5.2, 0.18, 2.55), dark, collection, 0.08)
    cube(f"{name}_Glass", (x, y_surface + 0.72, z), (4.55, 0.10, 2.1), glass, collection, 0.05)
    cube(f"{name}_Sill", (x, y_surface + 0.72, z - 1.35), (5.5, 0.95, 0.24), accent, collection, 0.10)
    cube(f"{name}_Header", (x, y_surface + 0.72, z + 1.35), (5.5, 0.95, 0.24), accent, collection, 0.10)
    cube(f"{name}_Left", (x - 2.65, y_surface + 0.72, z), (0.24, 0.95, 2.55), cream, collection, 0.08)
    cube(f"{name}_Right", (x + 2.65, y_surface + 0.72, z), (0.24, 0.95, 2.55), cream, collection, 0.08)
    awning = cube(f"{name}_Awning", (x, y_surface + 1.05, z - 1.68), (4.8, 1.15, 0.22), accent, collection, 0.10)
    awning.rotation_euler.x = math.radians(-8)
    for prop_index, prop_x in enumerate((-1.2, 0.0, 1.2)):
        cube(
            f"{name}_DisplayProp_{prop_index}",
            (x + prop_x, y_surface + 0.42, z - 0.55 + 0.18 * (prop_index % 2)),
            (0.52, 0.38, 0.72 + 0.15 * prop_index),
            (rose, gold, mint)[prop_index],
            collection,
            0.14,
        )
    backing = bpy.data.objects.get(f"{name}_Backing")
    backing["semantic_type"] = "backed-display-bay"
    backing["depth_m"] = 0.70


if Path(bpy.data.filepath).name != MASTER.name:
    raise RuntimeError(f"Open only the dedicated Grove source before running this pass: {MASTER}")

old = bpy.data.collections.get(COLLECTION_NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)

facade = bpy.data.collections.new(COLLECTION_NAME)
bpy.context.scene.collection.children.link(facade)

cream = material("Grove_Facade_Cream", (0.91, 0.77, 0.57), 0.82)
warm_white = material("Grove_Facade_WarmWhite", (0.98, 0.90, 0.73), 0.78)
coral = material("Grove_Facade_Coral", (0.86, 0.28, 0.34), 0.68)
rose = material("Grove_Facade_Rose", (0.93, 0.46, 0.56), 0.68)
gold = material("Grove_Facade_Gold", (0.96, 0.68, 0.18), 0.55, 0.08)
mint = material("Grove_Facade_Mint", (0.25, 0.68, 0.57), 0.68)
green = material("Grove_Facade_Leaf", (0.18, 0.48, 0.24), 0.82)
light_green = material("Grove_Facade_LightLeaf", (0.43, 0.68, 0.31), 0.82)
glass = material("Grove_Facade_Glass", (0.25, 0.63, 0.67), 0.3, 0.05)
dark = material("Grove_Facade_Dark", (0.07, 0.11, 0.10), 0.63)
glow = material(
    "Grove_Facade_Glow",
    (1.0, 0.73, 0.26),
    0.5,
    0.0,
    emission=(1.0, 0.48, 0.12),
    emission_strength=2.0,
)

# Horizontal floor bands clarify the three-storey stack without blocking
# the central aperture or the park-to-atrium sightline.
for level, z in enumerate((4.95, 9.95, 14.95), start=1):
    cube(f"Facade_Band_{level}_Left", (-20.0, 22.54, z), (20.0, 0.38, 0.42), mint, facade, 0.10)
    cube(f"Facade_Band_{level}_Right", (20.0, 22.54, z), (20.0, 0.38, 0.42), mint, facade, 0.10)

# Attached pilasters give the broad shell a readable bay rhythm.
for index, x in enumerate((-28.4, -21.0, -12.0, 12.0, 21.0, 28.4)):
    cube(f"Facade_Pilaster_{index}", (x, 22.55, 7.5), (0.72, 0.55, 15.0), cream, facade, 0.15)
    cube(f"Facade_Pilaster_Cap_{index}", (x, 22.62, 14.9), (1.25, 0.72, 0.42), gold, facade, 0.12)

# Four honest, backed display bays per upper storey.
bay_positions = [(-24, rose), (-16, gold), (16, mint), (24, coral)]
for floor_index, z in enumerate((7.45, 12.45), start=2):
    for bay_index, (x, accent) in enumerate(bay_positions):
        display_bay(f"Facade_L{floor_index}_Bay_{bay_index}", x, z, accent, facade)

# Ground-floor identity panels sit over real shop zones and never imply doors.
for panel_index, (x, accent, label) in enumerate([
    (-22, green, "FRESH"),
    (-14, rose, "STYLE"),
    (14, gold, "HOME"),
    (22, coral, "TASTE"),
]):
    cube(f"Ground_Identity_{panel_index}", (x, 22.68, 3.55), (5.2, 0.42, 1.05), accent, facade, 0.20)
    text(f"Ground_Identity_Label_{panel_index}", label, (x, 22.91, 3.55), 0.42, warm_white, facade, 0.025)

# Central crown resolves the entrance as the hierarchy anchor.
cube("Mall_Crown_Back", (0, 22.6, 15.95), (15.0, 0.7, 2.1), coral, facade, 0.35)
cube("Mall_Crown_Trim", (0, 23.0, 15.95), (13.8, 0.22, 1.55), warm_white, facade, 0.24)
text("Mall_Crown_Title", "THE GROVE", (0, 23.14, 16.0), 0.92, green, facade, 0.05)
for x in (-6.2, 6.2):
    ico("Mall_Crown_Leaf", (x, 23.02, 16.82), (1.3, 0.3, 0.55), green, facade)

# Floor markers make vertical navigation legible from the park.
for floor, z in enumerate((3.25, 8.25, 13.25), start=1):
    cylinder(f"Facade_Level_Badge_{floor}", (-7.0, 22.82, z), 0.62, 0.24, gold, facade, 32)
    badge = bpy.context.object
    badge.rotation_euler.x = math.pi / 2
    text(f"Facade_Level_Text_{floor}", str(floor), (-7.0, 22.98, z), 0.48, dark, facade, 0.025)

# Deliberate vine rhythm softens the shell while keeping every bay visible.
for vine_index, x in enumerate((-27.2, -10.7, 10.7, 27.2)):
    points = [
        (x, 22.92, 1.2),
        (x + (0.45 if vine_index % 2 == 0 else -0.45), 23.0, 5.0),
        (x - (0.35 if vine_index % 2 == 0 else -0.35), 23.0, 9.5),
        (x, 23.0, 14.7),
    ]
    curve(f"Facade_Vine_{vine_index}", points, 0.12, green, facade)
    for leaf_index, z in enumerate((3.3, 6.8, 10.7, 13.5)):
        offset = 0.38 if leaf_index % 2 == 0 else -0.38
        ico(f"Facade_Vine_Leaf_{vine_index}_{leaf_index}", (x + offset, 23.05, z), (0.46, 0.18, 0.24), light_green, facade)

# Rooftop garden silhouette gives the upper edge a playful destination.
for planter_index, x in enumerate((-23, -15, -7, 7, 15, 23)):
    cube(f"Roof_Planter_{planter_index}", (x, 20.5, 15.45), (5.0, 2.2, 0.72), cream, facade, 0.24)
    for shrub_index, shrub_x in enumerate((-1.4, 0.0, 1.4)):
        ico(
            f"Roof_Shrub_{planter_index}_{shrub_index}",
            (x + shrub_x, 20.5, 16.35 + 0.22 * (shrub_index % 2)),
            (0.72, 0.62, 0.68),
            (green, light_green, green)[shrub_index],
            facade,
        )

# Warm entry lanterns emphasize navigation rather than decoration.
for lantern_index, x in enumerate((-5.8, 5.8)):
    cube(f"Entrance_Lantern_Bracket_{lantern_index}", (x, 23.05, 4.1), (0.18, 0.72, 0.18), dark, facade, 0.04)
    cylinder(f"Entrance_Lantern_{lantern_index}", (x, 23.48, 3.72), 0.30, 0.72, glow, facade, 20)
    bpy.ops.object.light_add(type="POINT", location=(x, 24.0, 3.75))
    light = bpy.context.object
    light.name = f"Entrance_Lantern_Light_{lantern_index}"
    light.data.energy = 90
    light.data.color = (1.0, 0.52, 0.22)
    light.data.shadow_soft_size = 1.1
    move_to_collection(light, facade)

# Front-quarter camera shows storey hierarchy, arrival, and park landmarks.
camera = bpy.data.objects.get("Grove_Facade_Review_Camera")
if camera is None:
    bpy.ops.object.camera_add(location=(48, 82, 36))
    camera = bpy.context.object
    camera.name = "Grove_Facade_Review_Camera"
    move_to_collection(camera, facade)
camera.location = (48, 82, 36)
camera.data.lens = 48
point_at(camera, (0, 23, 7.0))
bpy.context.scene.camera = camera

key = bpy.data.objects.get("Grove_Facade_Key")
if key is None:
    bpy.ops.object.light_add(type="AREA", location=(-18, 50, 30))
    key = bpy.context.object
    key.name = "Grove_Facade_Key"
    move_to_collection(key, facade)
key.data.energy = 2300
key.data.shape = "DISK"
key.data.size = 18
point_at(key, (0, 22, 7.0))

scene = bpy.context.scene
scene["grove_mall_facade_pass"] = "blender-form-refinement-v1"
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
print(f"GROVE_MALL_FACADE_READY {MASTER}")
print(f"GROVE_MALL_FACADE_RENDER {RENDER}")
