"""Runs pass scripts on the Grove file in a background Blender, so an open Blender session is left alone.
blender --background grove_master_refined.blend --python bg.py -- job.json
job = {"steps": [{"run": "p20_merch", "args": {...}} or {"code": "..."} or {"shot": {...}}], "save": false, "out": "path.json"}"""
import bpy, sys, json, time, traceback, math
from mathutils import Vector
D = "/Users/clairewn/Downloads/Kindred/assets/grove/blender/mario"
exec(open(D + "/boot.py").read()); ns = bpy.app.driver_namespace
job = json.load(open(sys.argv[sys.argv.index("--") + 1])); out = {"file": bpy.data.filepath, "steps": []}; t0 = time.time()
def shot(path, eye, target, lens=24, size=(720, 450), hide=()):
    """Quick Workbench still for checking placement. Nothing here is saved unless the job says so."""
    sc = bpy.context.scene; cam = bpy.data.cameras.new("_bg_cam"); ob = bpy.data.objects.new("_bg_cam", cam); sc.collection.objects.link(ob)
    e, t = Vector(eye), Vector(target); ob.location = e; ob.rotation_euler = (t - e).to_track_quat("-Z", "Y").to_euler(); cam.lens = lens; cam.clip_start = .05; cam.clip_end = 400
    old = (sc.camera, sc.render.engine, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage, sc.render.filepath)
    hid = [c for c in bpy.data.collections if c.name in hide and not c.hide_render]
    for c in hid: c.hide_render = True
    sc.camera = ob; sc.render.engine = "BLENDER_WORKBENCH"; sc.render.resolution_x, sc.render.resolution_y = size; sc.render.resolution_percentage = 100
    sh = sc.display.shading; sh.light = "STUDIO"; sh.color_type = "MATERIAL"; sh.show_shadows = False; sh.show_cavity = True
    sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 80; sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for c in hid: c.hide_render = False
    sc.camera, sc.render.engine, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage, sc.render.filepath = old
    bpy.data.objects.remove(ob); bpy.data.cameras.remove(cam)
for st in job["steps"]:
    try:
        if "run" in st: out["steps"].append(ns["gk_run"](st["run"], **st.get("args", {})))
        elif "shot" in st: shot(**st["shot"]); out["steps"].append({"shot": st["shot"]["path"]})
        else:
            g = {"bpy": bpy, "ns": ns, "result": None, "Vector": Vector, "math": math}; exec(st["code"], g); out["steps"].append({"result": g.get("result")})
    except Exception:
        out["steps"].append({"err": traceback.format_exc()[-1500:]})
if job.get("save"): bpy.ops.wm.save_mainfile(); out["saved"] = True
out["secs"] = round(time.time() - t0, 1)
json.dump(out, open(job["out"], "w"), default=str)
