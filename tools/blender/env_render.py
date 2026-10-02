"""Renders a contact sheet of whatever .blend-equivalent kit script is
passed in, so kit pieces can be eyeballed without a GUI.

    python3 tools/blender/env_render.py env_kit /tmp/shots/kit.png
"""
import sys, os, math, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector

mod = sys.argv[1] if len(sys.argv) > 1 else "env_kit"
out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/shots/kit.png"
importlib.import_module(mod)

objs = [o for o in bpy.data.objects if o.type == "MESH"]
objs.sort(key=lambda o: o.name)

# Lay the pieces out on a grid, tallest-aware spacing.
cols = math.ceil(math.sqrt(len(objs)))
pitch = max(5.0, 1.35 * max(max(o.dimensions.x, o.dimensions.y) for o in objs))
for i, o in enumerate(objs):
    o.location = ((i % cols) * pitch, -(i // cols) * pitch, 0)

rows = math.ceil(len(objs) / cols)
cx = (cols - 1) * pitch / 2
cy = -(rows - 1) * pitch / 2
span = max(cols, rows) * pitch

bpy.ops.mesh.primitive_plane_add(size=span * 3, location=(cx, cy, -0.02))
ground = bpy.context.object
gm = bpy.data.materials.new("g"); gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.72, 0.79, 0.62, 1)
ground.data.materials.append(gm)

bpy.ops.object.camera_add(location=(cx + span * 0.9, cy - span * 1.2, span * 1.0))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = span * 1.35
d = Vector((cx, cy, span * 0.08)) - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam

bpy.ops.object.light_add(type="SUN", location=(cx - 10, cy - 14, 30))
sun = bpy.context.object
sun.data.energy = 2.6
sun.data.color = (1.0, 0.93, 0.78)
sun.data.angle = math.radians(12)
sun.rotation_euler = (math.radians(52), 0, math.radians(38))

w = bpy.context.scene.world
if w is None:
    w = bpy.data.worlds.new("W"); bpy.context.scene.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.72, 0.85, 0.92, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.55

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 24
sc.cycles.device = "CPU"
sc.render.resolution_x = 1400
sc.render.resolution_y = 1000
sc.render.film_transparent = False
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.render.filepath = out
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.render.render(write_still=True)
print("rendered", out)
