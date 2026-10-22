"""Pass 8: backdrop and lighting. Sea, distant hills, islets and clouds (viewport and render only, in the
top-level MARIO_BACKDROP collection, so they are not exported); gradient sky; one warm sun; soft shadowless
fill inside the mall; Standard colour management. Codex's review softboxes are moved to the superseded collection."""
import bpy, math
from gk import *

sc = bpy.context.scene
BD = fresh("MARIO_BACKDROP"); LG = fresh("MARIO_LIGHTS")
KM = lambda n: bpy.data.meshes[n]

b = B(); b.prism([(300 * cos(tau * i / 48), 300 * sin(tau * i / 48)) for i in range(48)], 0.2, "water_tex", loc=(0, 13, -3.6)); b.obj("Backdrop_Sea", BD)
for i, (a, d, r, h) in enumerate([(0.3, 150, 34, 20), (1.0, 175, 46, 26), (1.75, 140, 30, 17), (2.5, 180, 50, 28), (3.3, 150, 36, 19), (4.0, 170, 44, 24), (4.8, 145, 32, 18), (5.6, 185, 52, 30)]):
    inst(f"Backdrop_Hill_{i}", KM("GK_Hill"), BD, (d * cos(a), 13 + d * sin(a), -3.6), rz=a, sc=(r, r, h))
b = B()
def tier(b, x, y, z, r, h):
    b.lathe([(r, z), (r, z + h - 0.25), (r + 0.25, z + h - 0.12), (r + 0.25, z + h), (0, z + h)], (x, y, 0), seg=24, cap=False, mats=["cliff_tex", "lawn", "lawn", "lawn_tex"])
ISL = [(-66, 52, 9, 4.5), (72, 30, 11, 5.0), (58, -38, 8, 4.2), (-70, -30, 10, 4.8), (10, 92, 9, 4.4), (-28, 100, 6, 4.0)]
for (x, y, r, h) in ISL: tier(b, x, y, -5.5, r, h + 2.0)
b.obj("Backdrop_Islets", BD)
TT = ["GK_Tree_Round", "GK_Tree_Blossom", "GK_Tree_Tier", "GK_Tree_Citrus"]
for i, (x, y, r, h) in enumerate(ISL):
    for k in range(3):
        a = 2.1 * k + i; inst(f"Backdrop_Tree_{i}_{k}", KM(TT[(i + k) % 4]), BD, (x + 0.5 * r * cos(a), y + 0.5 * r * sin(a), h - 3.5), rz=a, sc=1.5 + 0.3 * k)
    inst(f"Backdrop_IsletHill_{i}", KM("GK_Hill"), BD, (x - 0.2 * r, y + 0.1 * r, h - 3.52), sc=(r * 0.4, r * 0.4, r * 0.28))
for i in range(18):
    a = tau * i / 18 + 0.3 * math.sin(i * 2.3); d = 95 + 55 * ((i * 7) % 5) / 4
    inst(f"Backdrop_Cloud_{i}", KM("GK_Cloud"), BD, (d * cos(a), 13 + d * sin(a), 30 + 9 * ((i * 3) % 4)), rz=a + pi / 2, sc=7 + 2.5 * (i % 3))
for o in BD.objects: o.visible_shadow = False

# ---- sky
w = sc.world or bpy.data.worlds.new("GroveSky"); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ"); rp = nt.nodes.new("ShaderNodeValToRGB")
bg = nt.nodes.new("ShaderNodeBackground"); out = nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(tc.outputs["Generated"], sp.inputs[0]); nt.links.new(sp.outputs["Z"], rp.inputs["Fac"])
nt.links.new(rp.outputs["Color"], bg.inputs["Color"]); nt.links.new(bg.outputs[0], out.inputs["Surface"])
el = rp.color_ramp.elements; el[0].position = 0.0; el[0].color = (*lin("#D8F3FF"), 1); el[1].position = 1.0; el[1].color = (*lin("#2E8FE6"), 1)
m = rp.color_ramp.elements.new(0.3); m.color = (*lin("#4FB4F0"), 1)
bg.inputs["Strength"].default_value = 0.85

# ---- lights
old = [o for o in sc.objects if o.type == "LIGHT" and o.data.type == "AREA" and not o.name.startswith("GM_")]
supersede(old)
for o in sc.objects:
    if o.type == "LIGHT" and o.data.type == "POINT": o.data.energy = min(o.data.energy, 60); o.data.use_shadow = False
def light(name, kind, loc, energy, color, size=None, rot=None, shadow=True):
    ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color; ld.use_shadow = shadow
    if kind == "AREA": ld.shape = "RECTANGLE"; ld.size, ld.size_y = size
    o = bpy.data.objects.new(name, ld); LG.objects.link(o); o.location = loc
    if rot is not None: o.rotation_euler = rot
    return o
sun = light("GM_Sun", "SUN", (20, 60, 60), 2.7, (1.0, 0.95, 0.84)); sun.data.angle = radians(4)
sun.rotation_euler = Vector((-0.38, -0.55, -0.74)).normalized().to_track_quat("-Z", "Y").to_euler()
for lv, z in ((1, 4.5), (2, 9.5), (3, 14.6)):
    for sx in (-1, 1):
        light(f"GM_Fill_L{lv}_{'W' if sx < 0 else 'E'}", "AREA", (sx * 20, 0, z), 1250, (1.0, 0.93, 0.82), (18, 40), shadow=False)
    light(f"GM_Fill_L{lv}_Decks", "AREA", (0, 0, z), 650, (1.0, 0.93, 0.82), (18, 40), shadow=False)
light("GM_Fill_Dome", "AREA", (0, 0, 15.3), 2200, (1.0, 0.97, 0.9), (16, 16), shadow=False)

vs = sc.view_settings; vs.view_transform = "Standard"; vs.look = "None"; vs.exposure = 0.0; vs.gamma = 1.0
ee = sc.eevee
for k, v in (("taa_samples", 32), ("taa_render_samples", 64), ("shadow_ray_count", 2), ("shadow_step_count", 6), ("use_shadow_jitter_viewport", True), ("light_threshold", 0.01)):
    try: setattr(ee, k, v)
    except Exception: pass
cam = bpy.data.objects.get("Grove_Mario_Hero_Camera")
if cam is None:
    cam = bpy.data.objects.new("Grove_Mario_Hero_Camera", bpy.data.cameras.new("Grove_Mario_Hero_Camera")); LG.objects.link(cam)
cam.location = (36, 80, 24); cam.data.lens = 32; cam.data.clip_end = 900
cam.rotation_euler = (Vector((0, 22, 5)) - Vector(cam.location)).normalized().to_track_quat("-Z", "Y").to_euler()
sc.camera = cam
rep = {"backdrop": len(BD.objects), "old_area_lights_superseded": len(old), "lights": [o.name for o in LG.objects if o.type == "LIGHT"]}
bpy.app.driver_namespace["gk_report"] = rep
