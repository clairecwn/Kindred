"""Run this once in the Blender that is open (any file): it registers ibg(passes, **args), which starts a second
Blender in the background on kindred_items.blend, runs the named passes there and returns what they reported.
    exec(open("/Users/clairewn/Downloads/Kindred/assets/items/blender/passes/ibg_launch.py").read())
    bpy.app.driver_namespace["ibg"]("i10_items,i08_audit")
    bpy.app.driver_namespace["ibg"]("i30_render", save=False, mode="items")
The open file is never touched."""
import bpy, subprocess, json, os, tempfile, time
def ibg(passes, timeout=150, save=True, **kw):
    P = "/Users/clairewn/Downloads/Kindred/assets/items/blender"
    out = os.path.join(tempfile.gettempdir(), "kindred_ibg.json")
    if os.path.exists(out): os.remove(out)
    blend = P + "/kindred_items.blend"
    cmd = [bpy.app.binary_path, "--background"] + ([blend] if os.path.exists(blend) else ["--factory-startup"]) + \
          ["--python", P + "/passes/ibg.py", "--", json.dumps({"passes": passes, "kw": kw, "out": out, "save": save})]
    t = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return {"timeout": timeout}
    if not os.path.exists(out): return {"no_result": True, "tail": (p.stdout or "")[-600:] + (p.stderr or "")[-600:]}
    r = json.load(open(out)); r["secs_total"] = round(time.time() - t, 1); return r
bpy.app.driver_namespace["ibg"] = ibg
