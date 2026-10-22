"""Pass 1: the scene of the items file. EEVEE, the Kingdom's sky and sun, and the character brought in from
kingdom_island.blend at the height it has in the game, as the thing every item is sized against. Never exported."""
import bpy, os
from math import radians
from mathutils import Vector
from ii import *
sc = bpy.context.scene; sc.name = "Items"
for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try: sc.render.engine = e; break
    except Exception: pass
sc.unit_settings.system = "METRIC"; sc.unit_settings.scale_length = 1.0
vs = sc.view_settings; vs.view_transform = "Standard"; vs.look = "None"; vs.exposure = 0.0; vs.gamma = 1.0
for k, v in (("taa_samples", 32), ("taa_render_samples", 48), ("shadow_ray_count", 2), ("shadow_step_count", 6), ("light_threshold", 0.01)):
    try: setattr(sc.eevee, k, v)
    except Exception: pass
# sky and sun: the same recipe as the Kingdom, so an item looks here as it will on the island
w = bpy.data.worlds.get("ItemsSky") or bpy.data.worlds.new("ItemsSky"); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ"); rp = nt.nodes.new("ShaderNodeValToRGB")
bg = nt.nodes.new("ShaderNodeBackground"); out = nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(tc.outputs["Generated"], sp.inputs[0]); nt.links.new(sp.outputs["Z"], rp.inputs["Fac"])
nt.links.new(rp.outputs["Color"], bg.inputs["Color"]); nt.links.new(bg.outputs[0], out.inputs["Surface"])
el = rp.color_ramp.elements; el[0].position = 0.0; el[0].color = (*lin("#D8F3FF"), 1); el[1].position = 1.0; el[1].color = (*lin("#2E8FE6"), 1)
m = rp.color_ramp.elements.new(0.3); m.color = (*lin("#4FB4F0"), 1)
bg.inputs["Strength"].default_value = 0.7
room = ccol("ITEMS_SHOWROOM")
sun = bpy.data.objects.get("Showroom_sun")
if sun is None:
    sun = bpy.data.objects.new("Showroom_sun", bpy.data.lights.new("Showroom_sun", "SUN")); room.objects.link(sun)
sun.data.energy = 4.0; sun.data.color = (1.0, 0.97, 0.9); sun.data.angle = radians(4); sun.location = (0, -6, 8)
sun.rotation_euler = Vector((0.30, 0.48, -0.82)).normalized().to_track_quat("-Z", "Y").to_euler()
cam = bpy.data.objects.get("Showroom_camera")
if cam is None:
    cam = bpy.data.objects.new("Showroom_camera", bpy.data.cameras.new("Showroom_camera")); room.objects.link(cam)
cam.data.clip_start = 0.05; cam.data.clip_end = 300; sc.camera = cam
# the character, for scale
ref = bpy.data.collections.get("SCALE_REFERENCE"); note = "kept"
if ref is None:
    src = os.path.join(ROOT, "assets", "kingdom", "blender", "kingdom_island.blend")
    with bpy.data.libraries.load(src, link=False) as (a, b): b.collections = [c for c in a.collections if c == "KINGDOM_CHARACTER_REFERENCE"]
    ref = b.collections[0]; ref.name = "SCALE_REFERENCE"; sc.collection.children.link(ref)
    bpy.context.view_layer.update()
    body = next(o for o in ref.all_objects if o.name.startswith("Kindred_Body"))
    lo, hi = wbb(body); base = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)); s = AVATAR / (hi.z - lo.z)
    target = Vector((-1.6, 0.0, 0.0))
    for o in ref.all_objects:
        if o.parent is None:
            o.location = target + (o.location - base) * s; o.scale = o.scale * s
    note = "appended, scaled %.3f, was %.2f m tall" % (s, hi.z - lo.z)
for o in ref.all_objects:            # helpers that came in with the character (a sphere round its head) are hidden where they stand, but a
    if o.hide_render: o.hide_viewport = True      # collection instance still shows them unless they are disabled in viewports
report(engine=sc.render.engine, character=note, objects=len(ref.all_objects))
