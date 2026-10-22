"""Registers the helpers used while working on the Kingdom file: kk_run(pass name, **args) and kk_view(eye, target)."""
import bpy, sys, time, importlib, traceback
from mathutils import Vector
D = "/Users/clairewn/Downloads/Kindred/assets/kingdom/blender/passes"
G = "/Users/clairewn/Downloads/Kindred/assets/grove/blender/mario"          # the Grove kit (gk, gv) the Kingdom builds on
for p_ in (D, G):
    if p_ not in sys.path: sys.path.insert(0, p_)
def kk_run(name, **kw):
    ns = bpy.app.driver_namespace; ns["kk_report"] = None; ns["kk_err"] = None; ns["kk_args"] = kw; t = time.time()
    try:
        import gk, gv, kk
        importlib.reload(gk); importlib.reload(gv); importlib.reload(kk)
        p = D + "/" + name + ".py"; exec(compile(open(p).read(), p, "exec"), {"__file__": p, "__name__": "__main__"})
    except Exception:
        ns["kk_err"] = traceback.format_exc()[-1800:]
    return {"report": ns.get("kk_report"), "err": ns.get("kk_err"), "secs": round(time.time() - t, 1)}
def kk_view(eye, target, shading="MATERIAL", lens=35, overlays=False):
    for w in bpy.context.window_manager.windows:
        for a in w.screen.areas:
            if a.type == "VIEW_3D":
                sp = a.spaces.active; r = sp.region_3d; e, t = Vector(eye), Vector(target)
                r.view_perspective = "PERSP"; r.view_location = t; r.view_distance = (e - t).length
                r.view_rotation = (e - t).to_track_quat("Z", "Y"); sp.lens = lens
                sp.clip_start = 0.1; sp.clip_end = 1500
                sp.shading.type = shading; sp.overlay.show_overlays = overlays
                try: sp.shading.use_scene_world = True; sp.shading.use_scene_lights = True
                except Exception: pass
                a.tag_redraw()
                return True
    return False
bpy.app.driver_namespace["kk_run"] = kk_run; bpy.app.driver_namespace["kk_view"] = kk_view
