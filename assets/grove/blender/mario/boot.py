"""Registers the helpers used while working on the Grove file: gk_run(script name) and gk_view(eye, target, ...)."""
import bpy, sys, time, importlib, traceback
from mathutils import Vector
D = "/Users/clairewn/Downloads/Kindred/assets/grove/blender/mario"
if D not in sys.path: sys.path.insert(0, D)
def gk_run(name, **kw):
    ns = bpy.app.driver_namespace; ns["gk_report"] = None; ns["gk_err"] = None; ns["gk_args"] = kw; t = time.time()
    try:
        import gk; importlib.reload(gk)
        p = D + "/" + name + ".py"; exec(compile(open(p).read(), p, "exec"), {"__file__": p, "__name__": "__main__"})
    except Exception:
        ns["gk_err"] = traceback.format_exc()[-1800:]
    ns["gk_secs"] = round(time.time() - t, 1)
    return {"report": ns.get("gk_report"), "err": ns.get("gk_err"), "secs": ns["gk_secs"]}
def gk_view(eye, target, shading="MATERIAL", lens=20, overlays=False):
    for w in bpy.context.window_manager.windows:
        for a in w.screen.areas:
            if a.type == "VIEW_3D":
                sp = a.spaces.active; r = sp.region_3d; e, t = Vector(eye), Vector(target)
                r.view_perspective = "PERSP"; r.view_location = t; r.view_distance = (e - t).length
                r.view_rotation = (e - t).to_track_quat("Z", "Y"); sp.lens = lens; sp.clip_start = 0.05
                sp.shading.type = shading; sp.overlay.show_overlays = overlays
                return True
    return False
bpy.app.driver_namespace["gk_run"] = gk_run; bpy.app.driver_namespace["gk_view"] = gk_view
