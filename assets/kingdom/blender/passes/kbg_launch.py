"""Run this once in the Blender that is open (any file): it registers kbg(steps, save=False), which starts a second
Blender in the background on kingdom_island.blend and returns what the steps reported.
    exec(open("/Users/clairewn/Downloads/Kindred/assets/kingdom/blender/passes/kbg_launch.py").read())
    bpy.app.driver_namespace["kbg"]([["k16_house_kit", {}]], save=True)
Only use it while kingdom_island.blend is not the file that is open."""
import bpy, subprocess, json, os, tempfile, time
def kbg(steps, save=False, timeout=170):
    P = "/Users/clairewn/Downloads/Kindred/assets/kingdom/blender"
    if bpy.data.filepath.endswith("kingdom_island.blend"): return {"refused": "kingdom_island.blend is open here; use kk_run instead"}
    out = os.path.join(tempfile.gettempdir(), "kindred_kbg.json")
    if os.path.exists(out): os.remove(out)
    cmd = [bpy.app.binary_path, "--background", P + "/kingdom_island.blend", "--python", P + "/passes/kbg.py", "--", json.dumps({"steps": steps, "save": save, "out": out})]
    t = time.time()
    try: p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired: return {"timeout": timeout}
    if not os.path.exists(out): return {"no_result": True, "tail": (p.stdout or "")[-600:] + (p.stderr or "")[-600:]}
    r = json.load(open(out)); r["secs_total"] = round(time.time() - t, 1); return r
bpy.app.driver_namespace["kbg"] = kbg

def kbg_start(steps, save=False):
    """The same, without waiting: for jobs that take longer than a call may. Read the answer later with kbg_result()."""
    P = "/Users/clairewn/Downloads/Kindred/assets/kingdom/blender"
    if bpy.data.filepath.endswith("kingdom_island.blend"): return {"refused": "kingdom_island.blend is open here; use kk_run instead"}
    out = os.path.join(tempfile.gettempdir(), "kindred_kbg.json")
    if os.path.exists(out): os.remove(out)
    log = open(os.path.join(tempfile.gettempdir(), "kindred_kbg.log"), "w")
    p = subprocess.Popen([bpy.app.binary_path, "--background", P + "/kingdom_island.blend", "--python", P + "/passes/kbg.py", "--", json.dumps({"steps": steps, "save": save, "out": out})], stdout=log, stderr=log)
    bpy.app.driver_namespace["kbg_proc"] = p; return {"started": p.pid}
def kbg_result():
    out = os.path.join(tempfile.gettempdir(), "kindred_kbg.json"); p = bpy.app.driver_namespace.get("kbg_proc")
    if os.path.exists(out) and (p is None or p.poll() is not None): return json.load(open(out))
    if p is not None and p.poll() is not None:
        return {"ended": p.returncode, "tail": open(os.path.join(tempfile.gettempdir(), "kindred_kbg.log")).read()[-800:]}
    return {"running": True}
bpy.app.driver_namespace["kbg_start"] = kbg_start; bpy.app.driver_namespace["kbg_result"] = kbg_result
