"""Runs item passes. Used from a background Blender opened on kindred_items.blend:
    exec(open(".../passes/irun.py").read()); result = run("i10_items,i08_audit")
Each pass reports through ii.report(). The file is saved after a run unless a pass failed."""
import bpy, sys, time, traceback
D = "/Users/clairewn/Downloads/Kindred/assets/items/blender/passes"
if D not in sys.path: sys.path.insert(0, D)
def run(names, save=True, **kw):
    ns = bpy.app.driver_namespace; out = {}
    for name in names.split(","):
        ns["ii_report"] = None; ns["ii_args"] = kw; t = time.time(); err = None
        try:
            p = D + "/" + name + ".py"; exec(compile(open(p).read(), p, "exec"), {"__file__": p, "__name__": "__main__"})
        except Exception:
            err = traceback.format_exc()[-1500:]
        out[name] = {"report": ns.get("ii_report"), "err": err, "secs": round(time.time() - t, 1)}
        if err: save = False; break
    if save:
        bpy.ops.wm.save_mainfile(); out["saved"] = bpy.data.filepath.split("/")[-1]
    return out
