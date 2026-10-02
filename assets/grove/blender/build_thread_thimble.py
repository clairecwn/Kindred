import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BLOCKOUT = ROOT / "blender" / "grove_blockout.blend"
OUT = ROOT / "blender" / "thread_and_thimble_detail.blend"
WIDE_RENDER = ROOT / "renders" / "thread_and_thimble_detail.png"
PROP_RENDER = ROOT / "renders" / "thread_and_thimble_props.png"

def collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c

def material(name, color, roughness=0.7, metallic=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m

def move(o, c):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o)

def cube(name, loc, dims, mat, c, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.scale = (dims[0]/2, dims[1]/2, dims[2]/2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b = o.modifiers.new("soft_edges", "BEVEL")
        b.width, b.segments = bevel, 3
    o.data.materials.append(mat)
    move(o, c)
    return o

def sphere(name, loc, scale, mat, c):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=loc)
    o = bpy.context.view_layer.objects.active
    o.name, o.scale = name, scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    move(o, c)
    return o

def cone(name, loc, r1, r2, depth, mat, c):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r1, radius2=r2, depth=depth, location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(mat)
    move(o, c)
    return o

def cylinder(name, loc, radius, depth, mat, c, vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(mat)
    move(o, c)
    return o

def torus(name, loc, major, minor, mat, c):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=24, minor_segments=8, location=loc)
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.materials.append(mat)
    move(o, c)
    return o

def label(name, text, loc, size, mat, c):
    bpy.ops.object.text_add(location=loc, rotation=(math.radians(90), 0, math.radians(180)))
    o = bpy.context.view_layer.objects.active
    o.name, o.data.body = name, text
    o.data.align_x, o.data.size, o.data.extrude = "CENTER", size, 0.008
    o.data.materials.append(mat)
    move(o, c)

def point_at(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.wm.open_mainfile(filepath=str(BLOCKOUT))
scene = bpy.context.scene
shop, props, labels = collection("THREAD_AND_THIMBLE_DETAIL"), collection("THREAD_AND_THIMBLE_INDIVIDUAL_PROPS"), collection("THREAD_AND_THIMBLE_LABELS")

floor = material("Thread_Floor", (0.55, 0.50, 0.58), 0.8)
wood = material("Thread_Wood", (0.38, 0.18, 0.10), 0.75)
brass = material("Thread_Brass", (0.83, 0.52, 0.16), 0.34, 0.55)
lavender = material("Thread_Lavender", (0.58, 0.40, 0.78), 0.62)
coral = material("Thread_Coral", (0.94, 0.38, 0.38), 0.62)
blue = material("Thread_Blue", (0.25, 0.45, 0.76), 0.62)
mint = material("Thread_Mint", (0.44, 0.70, 0.58), 0.68)
cream = material("Thread_Cream", (0.96, 0.85, 0.67), 0.72)
pink = material("Thread_Pink", (0.95, 0.47, 0.56), 0.62)
dark = material("Thread_Dark", (0.08, 0.08, 0.12), 0.5)

cube("Thread_Floor_Inset", (20, -14, 0.04), (11, 5.6, 0.08), floor, shop, 0.02)
for x in (17, 20, 23):
    cube(f"Thread_Rack_{x}", (x, -14.8, 1.55), (1.9, 0.35, 2.8), wood, shop, 0.06)
    cylinder(f"Thread_Rack_Rod_{x}", (x, -14.55, 2.8), 0.06, 1.7, brass, shop, 16).rotation_euler[1] = math.radians(90)
cube("Thread_Display_Table", (23.4, -11.5, 0.65), (2.8, 1, 1), wood, shop, 0.07)
cube("Thread_Mirror", (16, -11.1, 2), (0.12, 1.2, 2.3), brass, shop, 0.04)
cube("Thread_Fitting_Room", (25, -15.8, 1.6), (1.8, 1.2, 3.2), lavender, shop, 0.08)
label("Thread_Fitting_Label", "TRY ON", (25, -15.15, 2.7), 0.25, dark, labels)
label("Thread_Table_Label", "NEW SEASON", (23.4, -10.95, 1.2), 0.22, dark, labels)

for i, mat in enumerate((coral, mint, blue, lavender)):
    z = 1.2 + i * 0.16
    cube(f"Folded_Shirt_{i+1}", (23.4, -11.5, z), (0.9, 0.62, 0.14), mat, props, 0.05)
    cube(f"Folded_Shirt_Collar_{i+1}", (23.4, -11.12, z+0.01), (0.28, 0.08, 0.02), cream, props, 0.015)
    for j in range(3): cylinder(f"Folded_Shirt_Button_{i+1}_{j+1}", (23.15+j*0.12, -11.08, z+0.03), 0.018, 0.02, brass, props, 8)

cylinder("Dress_Stand", (17, -12.9, 0.25), 0.42, 0.12, wood, props)
cylinder("Dress_Pole", (17, -12.9, 1), 0.05, 1.45, brass, props)
cylinder("Dress_Torso", (17, -12.9, 1.45), 0.28, 0.6, cream, props)
sphere("Dress_Head", (17, -12.9, 1.95), (0.18, 0.18, 0.22), cream, props)
cone("Dress_Skirt", (17, -12.9, 0.95), 0.58, 0.25, 1.1, lavender, props)
cube("Dress_Belt", (17, -12.62, 1.47), (0.62, 0.06, 0.12), pink, props, 0.025)
for x in (16.78, 17.22): cube("Dress_Strap", (x, -12.9, 1.72), (0.08, 0.18, 0.42), lavender, props, 0.02)
cube("Dress_Bow", (17, -12.56, 1.49), (0.25, 0.08, 0.18), pink, props, 0.04)

for i, x in enumerate((19.8, 20.55)):
    cube(f"Sneaker_{i+1}_Sole", (x, -15.2, 0.45), (0.62, 0.34, 0.12), cream, props, 0.06)
    cube(f"Sneaker_{i+1}_Upper", (x, -15.12, 0.57), (0.48, 0.28, 0.24), blue, props, 0.08)
    cube(f"Sneaker_{i+1}_Toe", (x+0.18, -15.12, 0.56), (0.22, 0.28, 0.16), pink, props, 0.07)
    for j in range(3): cube(f"Sneaker_{i+1}_Lace_{j+1}", (x-0.06, -15.29, 0.67+j*0.035), (0.2, 0.025, 0.02), cream, props, 0.008)

cube("Handbag_Body", (22.5, -11.5, 1.45), (0.6, 0.22, 0.46), pink, props, 0.08)
cube("Handbag_Flap", (22.5, -11.37, 1.63), (0.5, 0.05, 0.18), pink, props, 0.04)
cube("Handbag_Buckle", (22.5, -11.33, 1.54), (0.12, 0.025, 0.1), brass, props, 0.02)
torus("Handbag_Handle", (22.5, -11.5, 1.82), 0.25, 0.035, pink, props)
cylinder("Sun_Hat_Brim", (24, -11.5, 1.65), 0.48, 0.08, cream, props)
cone("Sun_Hat_Crown", (24, -11.5, 1.84), 0.30, 0.22, 0.34, cream, props)
cube("Sun_Hat_Band", (24, -11.5, 1.84), (0.48, 0.48, 0.08), mint, props, 0.03)

cylinder("Scarf_Rack_Pole", (21, -11.3, 1.2), 0.04, 1.6, brass, props)
cylinder("Scarf_Rack_Base", (21, -11.3, 0.35), 0.32, 0.10, wood, props)
for i, mat in enumerate((coral, blue, mint)):
    y = -11.3 + (i-1)*0.18
    cube(f"Scarf_{i+1}", (21, y, 1.25), (0.12, 0.22, 1.0), mat, props, 0.04)

bpy.ops.object.camera_add(location=(26.5, -7, 3.4))
cam = bpy.context.view_layer.objects.active
cam.name = "Thread_And_Thimble_Detail_Camera"
point_at(cam, (20, -14, 1.35))
cam.data.lens = 42
scene.camera = cam
bpy.ops.object.light_add(type="AREA", location=(20, -11, 8))
light = bpy.context.view_layer.objects.active
light.name = "Thread_Detail_Softbox"
light.data.energy, light.data.size = 1400, 7
point_at(light, (20, -14, 1))
bpy.ops.object.light_add(type="AREA", location=(25, -8, 4))
fill = bpy.context.view_layer.objects.active
fill.name = "Thread_Aisle_Fill"
fill.data.energy, fill.data.size = 900, 5
point_at(fill, (20, -14, 1.2))

scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1200, 850, 80
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 1.2
scene.render.filepath = str(WIDE_RENDER)
bpy.ops.render.render(write_still=True)
bpy.ops.object.camera_add(location=(26.5, -8.5, 2.6))
prop_cam = bpy.context.view_layer.objects.active
prop_cam.name = "Thread_And_Thimble_Props_Camera"
point_at(prop_cam, (23, -11.8, 1.35))
prop_cam.data.lens = 48
scene.camera = prop_cam
scene.render.filepath = str(PROP_RENDER)
bpy.ops.render.render(write_still=True)
scene.camera = cam
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
print(f"Saved Thread + Thimble scene to {OUT}")
