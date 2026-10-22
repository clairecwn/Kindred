"""Read-only review of the saved Grove. Only outputs a Kingdom research image."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
GROVE=ROOT.parent/'grove/blender/grove_master_refined.blend'
bpy.ops.wm.open_mainfile(filepath=str(GROVE))
scene=bpy.context.scene
scene.camera=bpy.data.objects.get('Grove_Mario_Hero_Camera') or scene.camera
scene.render.engine='CYCLES'; scene.cycles.samples=16; scene.cycles.use_denoising=True
scene.render.resolution_x=1200; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT/'renders/grove_context_readonly.png')
bpy.ops.render.render(write_still=True)
# Deliberately no save operation: Grove remains owned by Claude.
