"""Pass 2: how the file looks when it is opened. Every 3D view shows the materials under the scene's own sun and sky
(the look the items were made for) and is aimed along the showroom row."""
import bpy
from mathutils import Vector
from ii import *
n = 0; eye, target = Vector((7.0, -30.0, 17.0)), Vector((7.0, -9.0, 0.5))
for scr in bpy.data.screens:
    for a in scr.areas:
        if a.type != "VIEW_3D": continue
        for sp in a.spaces:
            if sp.type != "VIEW_3D": continue
            sp.shading.type = "MATERIAL"; sp.shading.use_scene_lights = True; sp.shading.use_scene_world = True
            sp.overlay.show_floor = False; sp.overlay.show_axis_x = False; sp.overlay.show_axis_y = False
            sp.clip_start = 0.05; sp.clip_end = 500; sp.lens = 40
            r = sp.region_3d
            if r:
                r.view_perspective = "PERSP"; r.view_location = target; r.view_distance = (eye - target).length
                r.view_rotation = (eye - target).to_track_quat("Z", "Y")
            n += 1
report(views=n, screens=len(bpy.data.screens))
