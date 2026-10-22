"""Entry point for a background Blender working on kindred_items.blend, so the file Claire has open is never touched:
    blender --background [kindred_items.blend] --python ibg.py -- '{"passes": "i10_items", "kw": {}, "out": "/tmp/x.json"}'
Creates the file on first use. Writes what the passes reported to "out"."""
import bpy, sys, os, json, traceback
D = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(os.path.dirname(D), "kindred_items.blend")
a = json.loads(sys.argv[sys.argv.index("--") + 1])
res = {}
try:
    if bpy.data.filepath != DST:
        if os.path.exists(DST):
            bpy.ops.wm.open_mainfile(filepath=DST)
        else:
            bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.wm.save_as_mainfile(filepath=DST); res["created"] = True
    exec(open(os.path.join(D, "irun.py")).read())
    res.update(run(a["passes"], save=a.get("save", True), **a.get("kw", {})))
    res["version"] = bpy.app.version_string
except Exception:
    res["fatal"] = traceback.format_exc()[-1500:]
json.dump(res, open(a["out"], "w"), default=str)
