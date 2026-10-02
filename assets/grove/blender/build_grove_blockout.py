import bpy
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "blender" / "grove_blockout.blend"
RENDER_DIR = ROOT / "renders"
RENDER_DIR.mkdir(parents=True, exist_ok=True)

def mat(name, color, metallic=0.0, roughness=0.7):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m

def cube(name, loc, scale, material, bevel=0.0, collection=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("soft_edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    o.data.materials.append(material)
    if collection:
        for c in list(o.users_collection): c.objects.unlink(o)
        collection.objects.link(o)
    return o

def cylinder(name, loc, radius, depth, material, collection=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(material)
    if collection:
        for c in list(o.users_collection): c.objects.unlink(o)
        collection.objects.link(o)
    return o

def text_label(name, body, loc, scale, material, collection=None):
    bpy.ops.object.text_add(location=loc, rotation=(math.radians(90), 0, 0))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.body = body
    o.data.align_x = "CENTER"
    o.data.size = scale
    o.data.extrude = 0.015
    o.data.materials.append(material)
    if collection:
        for c in list(o.users_collection): c.objects.unlink(o)
        collection.objects.link(o)
    return o

def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

# New scene only: no external character or existing asset files are loaded.
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.length_unit = "METERS"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.resolution_percentage = 70
scene.render.image_settings.file_format = "PNG"
scene.world = bpy.data.worlds.new("Grove_World")
scene.world.color = (0.025, 0.04, 0.07)

materials = {
    "floor": mat("Grove_Floor", (0.20, 0.33, 0.30), roughness=0.85),
    "wall": mat("Grove_Wall", (0.93, 0.78, 0.58), roughness=0.8),
    "trim": mat("Grove_Trim", (0.19, 0.48, 0.50), metallic=0.05, roughness=0.55),
    "coral": mat("Grove_Coral", (0.95, 0.35, 0.32), roughness=0.65),
    "yellow": mat("Grove_Sun", (1.0, 0.68, 0.20), roughness=0.6),
    "pink": mat("Grove_Blossom", (0.93, 0.42, 0.60), roughness=0.65),
    "green": mat("Grove_Leaf", (0.25, 0.64, 0.34), roughness=0.75),
    "water": mat("Grove_Water", (0.10, 0.62, 0.82), metallic=0.1, roughness=0.25),
    "glass": mat("Grove_Glass", (0.30, 0.75, 0.78), metallic=0.0, roughness=0.2),
    "sign": mat("Grove_Sign", (0.12, 0.15, 0.23), roughness=0.5),
}

shell = collection("GROVE_ENVIRONMENT_BLOCKOUT")
shops = collection("GROVE_SHOP_BLOCKOUTS")
landmarks = collection("GROVE_LANDMARKS")
labels = collection("GROVE_REVIEW_LABELS")

# Mall floor plates with a true central atrium void.
for floor_i, z in enumerate((0, 5, 10), start=1):
    cube(f"Floor_{floor_i}_NW", (-20, -13, z - 0.2), (20, 18, 0.4), materials["floor"], 0.12, shell)
    cube(f"Floor_{floor_i}_NE", (20, -13, z - 0.2), (20, 18, 0.4), materials["floor"], 0.12, shell)
    cube(f"Floor_{floor_i}_SW", (-20, 13, z - 0.2), (20, 18, 0.4), materials["floor"], 0.12, shell)
    cube(f"Floor_{floor_i}_SE", (20, 13, z - 0.2), (20, 18, 0.4), materials["floor"], 0.12, shell)

# Exterior shell walls, arranged around the open atrium and entrances.
for z in (2.5, 7.5, 12.5):
    cube(f"North_Wall_{z}", (0, -22, z), (60, 0.6, 5), materials["wall"], 0.12, shell)
    cube(f"West_Wall_{z}", (-30, 0, z), (0.6, 44, 5), materials["wall"], 0.12, shell)
    cube(f"East_Wall_{z}", (30, 0, z), (0.6, 44, 5), materials["wall"], 0.12, shell)
    cube(f"South_Wall_L_{z}", (-20, 22, z), (20, 0.6, 5), materials["wall"], 0.12, shell)
    cube(f"South_Wall_R_{z}", (20, 22, z), (20, 0.6, 5), materials["wall"], 0.12, shell)

# Atrium balcony rails and shop-front rhythm.
for z in (4.0, 9.0, 14.0):
    for x in (-18, -12, 12, 18):
        cube(f"Balcony_Rail_{z}_{x}", (x, -8, z), (5.5, 0.25, 1.0), materials["trim"], 0.08, shell)
        cube(f"Balcony_Rail_{z}_{x}_south", (x, 8, z), (5.5, 0.25, 1.0), materials["trim"], 0.08, shell)

def shop(name, x, y, z, color_key, label):
    color = materials[color_key]
    # Small storefront block; open face is indicated by a darker lintel and wide entrance gap.
    cube(f"{name}_back", (x, y - 3.3, z + 2.5), (12, 0.35, 5), materials["wall"], 0.1, shops)
    cube(f"{name}_left", (x - 5.8, y, z + 2.5), (0.35, 6.5, 5), materials["wall"], 0.1, shops)
    cube(f"{name}_right", (x + 5.8, y, z + 2.5), (0.35, 6.5, 5), materials["wall"], 0.1, shops)
    cube(f"{name}_sign", (x, y - 0.15, z + 4.8), (8.5, 0.22, 0.9), color, 0.18, shops)
    cube(f"{name}_awning", (x, y + 0.05, z + 4.0), (10.0, 0.8, 0.25), materials["trim"], 0.1, shops)
    text_label(f"{name}_label", label, (x, y - 0.4, z + 4.82), 0.52, materials["sign"], labels)

shop("Grove_Grocer", -20, -14, 0, "green", "GROVE GROCER")
shop("Thread_And_Thimble", 20, -14, 0, "pink", "THREAD + THIMBLE")
shop("Cafe_Canopy", -20, 14, 0, "coral", "CAFE CANOPY")
shop("Home_Nook", 20, 14, 0, "yellow", "HOME NOOK")

# Hero fountain: intentionally kept clear as the central orientation landmark.
cylinder("Atrium_Fountain_Base", (0, 0, 0.25), 3.0, 0.5, materials["trim"], landmarks)
cylinder("Atrium_Fountain_Water", (0, 0, 0.58), 2.45, 0.12, materials["water"], landmarks)
cylinder("Atrium_Fountain_Pillar", (0, 0, 1.35), 0.45, 1.5, materials["coral"], landmarks)
cylinder("Atrium_Fountain_Top", (0, 0, 2.15), 1.1, 0.18, materials["water"], landmarks)

# Vertical circulation placeholders with obvious destinations.
for i in range(10):
    cube(f"North_Stair_Step_{i}", (-2.5 + i * 0.55, -17, 0.25 + i * 0.45), (0.5, 5, 0.5), materials["yellow"], 0.06, landmarks)
for i in range(10):
    cube(f"South_Escalator_Step_{i}", (2.5 - i * 0.55, 17, 0.25 + i * 0.45), (0.5, 5, 0.5), materials["coral"], 0.06, landmarks)
cube("East_Lift_Shaft", (25, 0, 2.5), (4, 4, 5), materials["glass"], 0.12, landmarks)
cube("East_Lift_Shaft_Trim", (25, 0, 5.1), (4.2, 4.2, 0.25), materials["trim"], 0.08, landmarks)

# Decorative canopy and garden mass above the atrium.
for x, y in [(-7, -5), (7, -5), (-7, 5), (7, 5)]:
    cylinder("Atrium_Garden_Trunk", (x, y, 3.3), 0.25, 4.0, materials["coral"], landmarks)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.2, location=(x, y, 5.2))
    leaf = bpy.context.view_layer.objects.active
    leaf.name = "Atrium_Garden_Canopy"
    leaf.scale = (1.6, 1.1, 0.8)
    leaf.data.materials.append(materials["green"])
    for c in list(leaf.users_collection): c.objects.unlink(leaf)
    landmarks.objects.link(leaf)

text_label("Atrium_Label", "ATRIUM", (0, 0, 0.68), 0.65, materials["sign"], labels)

# Production camera and soft stylized lighting.
bpy.ops.object.camera_add(location=(39, 42, 30))
camera = bpy.context.view_layer.objects.active
camera.name = "Grove_Production_Camera"
scene.camera = camera
def point_at(obj, target): obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
point_at(camera, (0, 0, 4.0))
camera.data.lens = 28

bpy.ops.object.light_add(type="AREA", location=(0, 0, 26))
key = bpy.context.view_layer.objects.active
key.name = "Grove_Atrium_Softbox"
key.data.energy = 2500
key.data.shape = "DISK"
key.data.size = 18
point_at(key, (0, 0, 0))

bpy.ops.object.light_add(type="AREA", location=(0, -18, 11))
fill = bpy.context.view_layer.objects.active
fill.name = "Grove_Arrival_Fill"
fill.data.energy = 900
fill.data.size = 12
point_at(fill, (0, 0, 3))

scene.render.filepath = str(RENDER_DIR / "grove_blockout_production.png")
scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
bpy.ops.render.render(write_still=True)
print(f"Saved Grove blockout to {OUT}")
print(f"Rendered preview to {scene.render.filepath}")
