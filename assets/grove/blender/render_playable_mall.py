"""Render a review image from the existing Grove master without saving a new page."""

import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "renders" / "grove_playable_mall.png"

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 70
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUTPUT)
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.10

bpy.ops.object.camera_add(location=(0, 16.2, 5.2))
camera = bpy.context.object
camera.name = "Grove_Playable_Mall_Review_Camera"
camera.rotation_euler = (Vector((0, -8.5, 2.2)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.lens = 24
scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(0, -2, 13.5))
light = bpy.context.object
light.name = "Grove_Playable_Mall_Review_Light"
light.data.energy = 1900
light.data.shape = "DISK"
light.data.size = 16
light.rotation_euler = (Vector((0, 0, 1.2)) - light.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.render.render(write_still=True)
print("GROVE_PLAYABLE_MALL_RENDER", OUTPUT)
