"""Entry point for a background Blender working on kingdom_island.blend, for when the open Blender is busy with another
file:  blender --background kingdom_island.blend --python kbg.py -- '{"steps": [["k16_house_kit", {}]], "save": true, "out": "/tmp/x.json"}'
A step is [pass name, args] or ["code", "python source that sets result"]. Writes what each step reported to "out"."""
import bpy, sys, os, json, traceback
D = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(D))), "grove", "blender", "mario")
for p in (D, G):
    if p not in sys.path: sys.path.insert(0, p)
a = json.loads(sys.argv[sys.argv.index("--") + 1]); res = {"steps": []}
try:
    exec(open(os.path.join(D, "kboot.py")).read()); ns = bpy.app.driver_namespace
    ok = True
    for name, arg in a["steps"]:
        if name == "code":
            g = {"bpy": bpy, "ns": ns, "result": None}; exec(arg, g); res["steps"].append({"result": g.get("result")})
        else:
            r = ns["kk_run"](name, **(arg or {})); res["steps"].append({name: r})
            if r.get("err"): ok = False; break
    if a.get("save") and ok: bpy.ops.wm.save_mainfile(); res["saved"] = bpy.data.filepath.split("/")[-1]
except Exception:
    res["fatal"] = traceback.format_exc()[-1500:]
json.dump(res, open(a["out"], "w"), default=str)
