"""Run this once in the Blender that has kingdom_island.blend open: it registers kexp(steps), which runs passes in a
second Blender in the background on the SAVED file and does not save it. For exports and bakes: the answer is short and
the open Blender is not held up. Save the open file first.
    exec(open("/Users/clairewn/Downloads/Kindred/assets/kingdom/blender/passes/kexp_launch.py").read())
    bpy.app.driver_namespace["kexp"]([["k20_export", {}]])"""
import bpy, subprocess, json, os, tempfile
def kexp(steps, timeout=55):
    P = "/Users/clairewn/Downloads/Kindred/assets/kingdom/blender"
    out = os.path.join(tempfile.gettempdir(), "kindred_kexp.json")
    if os.path.exists(out): os.remove(out)
    log = open(os.path.join(tempfile.gettempdir(), "kindred_kexp.log"), "w")
    subprocess.run([bpy.app.binary_path, "--background", P + "/kingdom_island.blend", "--python", P + "/passes/kbg.py", "--", json.dumps({"steps": steps, "save": False, "out": out})], stdout=log, stderr=log, timeout=timeout)
    return json.load(open(out)) if os.path.exists(out) else {"tail": open(log.name).read()[-1500:]}
bpy.app.driver_namespace["kexp"] = kexp

def kexp_start(steps, tag="job"):
    """The same without waiting, for a check that takes minutes. Read the answer later with kexp_result(tag)."""
    P = "/Users/clairewn/Downloads/Kindred/assets/kingdom/blender"
    out = os.path.join(tempfile.gettempdir(), "kindred_kexp_%s.json" % tag)
    if os.path.exists(out): os.remove(out)
    log = open(os.path.join(tempfile.gettempdir(), "kindred_kexp_%s.log" % tag), "w")
    p = subprocess.Popen([bpy.app.binary_path, "--background", P + "/kingdom_island.blend", "--python", P + "/passes/kbg.py", "--", json.dumps({"steps": steps, "save": False, "out": out})], stdout=log, stderr=log)
    bpy.app.driver_namespace["kexp_proc_" + tag] = p; return {"started": p.pid}
def kexp_result(tag="job"):
    out = os.path.join(tempfile.gettempdir(), "kindred_kexp_%s.json" % tag); p = bpy.app.driver_namespace.get("kexp_proc_" + tag)
    if os.path.exists(out) and (p is None or p.poll() is not None): return json.load(open(out))
    if p is not None and p.poll() is not None: return {"ended": p.returncode, "tail": open(os.path.join(tempfile.gettempdir(), "kindred_kexp_%s.log" % tag)).read()[-800:]}
    return {"running": True}
bpy.app.driver_namespace["kexp_start"] = kexp_start; bpy.app.driver_namespace["kexp_result"] = kexp_result
