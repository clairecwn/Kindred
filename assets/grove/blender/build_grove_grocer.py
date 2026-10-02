import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BLOCKOUT = ROOT / "blender" / "grove_blockout.blend"
OUT = ROOT / "blender" / "grove_grocer_detail.blend"
RENDER = ROOT / "renders" / "grove_grocer_detail.png"

def get_collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c

def get_mat(name, color, roughness=0.7, metallic=0.0):
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
    m.diffuse_color = (*color, 1)
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return m

def move_to(o, c):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o)

def cube(name, loc, dims, material, bevel=0.03, c=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (dims[0] / 2, dims[1] / 2, dims[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b = o.modifiers.new("soft_edges", "BEVEL")
        b.width = bevel
        b.segments = 2
    o.data.materials.append(material)
    if c: move_to(o, c)
    return o

def sphere(name, loc, scale, material, c=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if c: move_to(o, c)
    return o

def cyl(name, loc, radius, depth, material, c=None, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(material)
    if c: move_to(o, c)
    return o

def cone(name, loc, r1, r2, depth, material, c=None):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r1, radius2=r2, depth=depth, location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(material)
    if c: move_to(o, c)
    return o

def label(name, body, loc, size, material, c):
    bpy.ops.object.text_add(location=loc, rotation=(math.radians(90), 0, math.radians(180)))
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.body = body
    o.data.align_x = "CENTER"
    o.data.size = size
    o.data.extrude = 0.008
    o.data.materials.append(material)
    move_to(o, c)
    return o

def point_at(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.wm.open_mainfile(filepath=str(BLOCKOUT))
scene = bpy.context.scene
shop_c = get_collection("GROVE_GROCER_DETAIL")
props = get_collection("GROVE_GROCER_INDIVIDUAL_PROPS")
labels = get_collection("GROVE_GROCER_LABELS")

floor = get_mat("Grocer_Floor", (0.34, 0.49, 0.39), 0.8)
shelf = get_mat("Grocer_Shelf", (0.78, 0.47, 0.20), 0.65)
wood = get_mat("Grocer_Wood", (0.45, 0.22, 0.10), 0.78)
cream = get_mat("Grocer_Cream", (1.0, 0.86, 0.58), 0.72)
red = get_mat("Grocer_Red", (0.86, 0.16, 0.10), 0.62)
green = get_mat("Grocer_Green", (0.18, 0.58, 0.20), 0.72)
leaf = get_mat("Grocer_Leaf", (0.08, 0.38, 0.12), 0.78)
white = get_mat("Grocer_Milk", (0.92, 0.96, 0.88), 0.55)
blue = get_mat("Grocer_Blue", (0.10, 0.38, 0.75), 0.55)
yellow = get_mat("Grocer_Yellow", (1.0, 0.64, 0.08), 0.6)
dark = get_mat("Grocer_Dark", (0.07, 0.10, 0.12), 0.5, 0.1)

# Grocery floor inset, interior aisles, and checkout.
cube("Grocer_Floor_Inset", (-20, -14, 0.04), (11.0, 5.6, 0.08), floor, 0.02, shop_c)
for x in (-23.7, -20.0, -16.3):
    cube(f"Grocer_Aisle_{x}", (x, -14.8, 1.25), (1.25, 4.8, 2.5), shelf, 0.08, shop_c)
    for y in (-16.2, -14.8, -13.4):
        cube(f"Grocer_Shelf_{x}_{y}", (x, y, 1.4), (1.35, 0.38, 0.08), wood, 0.02, shop_c)
cube("Grocer_Checkout", (-16.3, -11.2, 0.7), (2.8, 0.85, 1.3), wood, 0.08, shop_c)
cube("Grocer_Checkout_Top", (-16.3, -11.2, 1.38), (2.9, 0.9, 0.12), cream, 0.03, shop_c)
cube("Grocer_Produce_Table", (-23.5, -11.6, 0.65), (3.0, 1.1, 1.0), wood, 0.07, shop_c)
label("Grocer_Produce_Label", "FRESH", (-23.5, -11.05, 1.2), 0.32, dark, labels)
label("Grocer_Checkout_Label", "CHECKOUT", (-16.3, -10.72, 1.45), 0.25, dark, labels)

# Individual produce props on the produce table.
for i, x in enumerate((-24.5, -23.7, -22.9)):
    cone(f"Carrot_{i+1}", (x, -11.6, 1.25), 0.11, 0.018, 0.48, red, props)
    bpy.context.view_layer.objects.active.rotation_euler[1] = math.radians(90)
for i, x in enumerate((-24.2, -23.5, -22.8)):
    sphere(f"Tomato_{i+1}", (x, -11.35, 1.25), (0.13, 0.13, 0.12), red, props)
for i, x in enumerate((-24.1, -23.4, -22.7)):
    sphere(f"Lettuce_{i+1}", (x, -11.85, 1.27), (0.18, 0.18, 0.14), leaf, props)
for i, x in enumerate((-24.0, -23.3, -22.6)):
    sphere(f"Apple_{i+1}", (x, -11.62, 1.28), (0.12, 0.12, 0.14), red, props)
    cyl(f"Apple_Stem_{i+1}", (x, -11.62, 1.43), 0.018, 0.1, wood, props, 8)

# Packaged goods: each item is a separately named, readable object.
for i, x in enumerate((-24.0, -23.45, -22.9)):
    cube(f"Milk_Carton_{i+1}", (x, -15.8, 1.7), (0.22, 0.15, 0.38), white, 0.025, props)
    cone(f"Milk_Carton_Top_{i+1}", (x, -15.8, 1.92), 0.12, 0.04, 0.12, blue, props)
for i, x in enumerate((-20.25, -19.7, -19.15)):
    cube(f"Cereal_Box_{i+1}", (x, -15.8, 1.65), (0.25, 0.12, 0.5), yellow, 0.025, props)
    cube(f"Cereal_Box_Band_{i+1}", (x, -15.73, 1.67), (0.16, 0.015, 0.13), red, 0.005, props)
for i, x in enumerate((-16.55, -16.0, -15.45)):
    cyl(f"Cleaning_Spray_{i+1}", (x, -15.8, 1.63), 0.09, 0.35, blue, props, 16)
    cube(f"Cleaning_Spray_Nozzle_{i+1}", (x, -15.72, 1.85), (0.14, 0.09, 0.08), dark, 0.02, props)

# Individual carry props at the entrance.
cube("Shopping_Basket", (-18.5, -11.0, 0.55), (0.65, 0.42, 0.28), red, 0.05, props)
cube("Shopping_Basket_Handle", (-18.5, -11.0, 0.82), (0.48, 0.06, 0.25), red, 0.025, props)
cube("Shopping_Trolley_Basket", (-19.5, -10.8, 0.85), (0.85, 0.48, 0.58), dark, 0.05, props)
cube("Shopping_Trolley_Handle", (-19.5, -10.55, 1.35), (0.72, 0.06, 0.08), red, 0.025, props)
for i, x in enumerate((-19.8, -19.2)):
    cyl(f"Shopping_Trolley_Wheel_{i+1}", (x, -10.8, 0.26), 0.11, 0.07, dark, props, 16)
    bpy.context.view_layer.objects.active.rotation_euler[0] = math.radians(90)

# A detail camera aimed into the shop; existing blockout camera remains unchanged.
bpy.ops.object.camera_add(location=(-26, -7.0, 3.5))
cam = bpy.context.view_layer.objects.active
cam.name = "Grove_Grocer_Detail_Camera"
point_at(cam, (-20, -14, 1.35))
cam.data.lens = 42
scene.camera = cam

bpy.ops.object.light_add(type="AREA", location=(-20, -12, 10))
light = bpy.context.view_layer.objects.active
light.name = "Grocer_Detail_Softbox"
light.data.energy = 1200
light.data.size = 8
point_at(light, (-20, -14, 0))

bpy.ops.object.light_add(type="AREA", location=(-24, -8, 4.5))
fill = bpy.context.view_layer.objects.active
fill.name = "Grocer_Aisle_Fill"
fill.data.energy = 900
fill.data.size = 5
point_at(fill, (-20, -14, 1.0))

scene.render.resolution_x = 1200
scene.render.resolution_y = 850
scene.render.resolution_percentage = 80
scene.render.filepath = str(RENDER)
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 1.5
scene.camera = cam
bpy.ops.render.render(write_still=True)

bpy.ops.object.camera_add(location=(-27.0, -8.0, 2.8))
prop_cam = bpy.context.view_layer.objects.active
prop_cam.name = "Grove_Grocer_Props_Camera"
point_at(prop_cam, (-23.0, -11.8, 1.25))
prop_cam.data.lens = 48
scene.camera = prop_cam
scene.render.filepath = str(ROOT / "renders" / "grove_grocer_props.png")
bpy.ops.render.render(write_still=True)

scene.camera = cam
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
print(f"Saved detailed grocer scene to {OUT}")
print(f"Rendered detailed grocer preview to {RENDER}")
