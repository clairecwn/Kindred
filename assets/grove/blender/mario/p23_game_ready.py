"""Pass 23: last step before export. Collects the parts of the backdrop the game should show (sea, far hills, islets)
in MARIO_BACKDROP_GAME, which the exterior export group includes; the backdrop trees and clouds stay Blender-only
(the game draws its own clouds). Sets the timeline to frame 0, the escalator rest pose."""
import bpy, re
from gk import *
G = ccol("MARIO_BACKDROP_GAME", "MARIO_BACKDROP"); B_ = bpy.data.collections["MARIO_BACKDROP"]; n = 0
for o in list(B_.objects):
    if re.match(r"Backdrop_(Sea|Hill|Islets|IsletHill)", o.name):
        B_.objects.unlink(o); G.objects.link(o); n += 1
bpy.context.scene.frame_set(0)
bpy.app.driver_namespace["gk_report"] = {"moved": n, "game_backdrop_objects": len(G.objects), "tris": sum(len(p.vertices) - 2 for o in G.objects for p in o.data.polygons)}
