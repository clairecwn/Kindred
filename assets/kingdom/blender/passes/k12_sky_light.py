"""Pass 12: sky and light. A gradient sky (pale at the horizon, deep blue overhead) instead of one flat colour, and one
sun from the front-left of the arrival view, so the cottage front and the great tree are lit and shadows fall behind
them. Codex's overhead softbox is retired: with a lit sky it only flattened the shadows. Same recipe as the Grove."""
import bpy
from kk import *
sc = bpy.context.scene
SKY_LIGHT = (NS.get("kk_args") or {}).get("sky_light", "#C4DBF2")
w = sc.world or bpy.data.worlds.new("KingdomSky"); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ"); rp = nt.nodes.new("ShaderNodeValToRGB")
bg = nt.nodes.new("ShaderNodeBackground"); out = nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(tc.outputs["Generated"], sp.inputs[0]); nt.links.new(sp.outputs["Z"], rp.inputs["Fac"])
nt.links.new(bg.outputs[0], out.inputs["Surface"])
# The camera sees the gradient. What lights the island is a paler sky: under the deep blue overhead a shadow on a warm
# colour (a brick path, a wooden deck) went near black, because that blue has almost no red in it.
lp = nt.nodes.new("ShaderNodeLightPath"); mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0]); mx.inputs[6].default_value = (*lin(SKY_LIGHT), 1); nt.links.new(rp.outputs["Color"], mx.inputs[7]); nt.links.new(mx.outputs[2], bg.inputs["Color"])
el = rp.color_ramp.elements; el[0].position = 0.0; el[0].color = (*lin("#D8F3FF"), 1); el[1].position = 1.0; el[1].color = (*lin("#2E8FE6"), 1)
m = rp.color_ramp.elements.new(0.3); m.color = (*lin("#4FB4F0"), 1)
bg.inputs["Strength"].default_value = 0.7
sun = bpy.data.objects.get("Island_sun")
sun.data.energy = 4.0; sun.data.color = (1.0, 0.97, 0.9); sun.data.angle = radians(4)    # a face square to the sun shows its own colour at about pi
sun.rotation_euler = Vector((0.30, 0.48, -0.82)).normalized().to_track_quat("-Z", "Y").to_euler()
supersede([o for o in sc.objects if o.type == "LIGHT" and o.data.type == "AREA"])
vs = sc.view_settings; vs.view_transform = "Standard"; vs.look = "None"; vs.exposure = 0.0; vs.gamma = 1.0
for k, v in (("taa_samples", 32), ("taa_render_samples", 64), ("shadow_ray_count", 2), ("shadow_step_count", 6), ("use_shadow_jitter_viewport", True), ("light_threshold", 0.01)):
    try: setattr(sc.eevee, k, v)
    except Exception: pass
for o in C("KINGDOM_BACKDROP").objects: o.visible_shadow = False
report(lights=[(o.name, o.data.type, round(o.data.energy, 1)) for o in sc.objects if o.type == "LIGHT" and o.visible_get()])
