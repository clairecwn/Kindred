"""Pass 2: one Mario-style palette. Builds GM_ materials and tiling textures, remaps every public-area
material onto the palette, and lifts saturation on shop-interior materials. Safe to re-run."""
import bpy, colorsys
from gk import *

for k in PAL:
    mat(k)
mat("glass", alpha=0.32, rough=0.15); mat("water", rough=0.2); mat("water_light", rough=0.2)
mat("glow", emit=2.5); mat("gold", rough=0.35, metal=0.25)
mat("tile_l1", "#F6A860", tex=tex_tiles("gm_tile_l1", "#F6A860", "#FFE6B8", "#E08A3C"), tile=2.4)
mat("tile_l2", "#8FD3F4", tex=tex_tiles("gm_tile_l2", "#8FD3F4", "#FFF1D0", "#5DB7E8"), tile=2.4)
mat("tile_l3", "#FFB3D1", tex=tex_tiles("gm_tile_l3", "#FFB3D1", "#FFF1D0", "#F58DB6"), tile=2.4)
mat("lawn_tex", "#5CC83C", rough=0.8, tex=tex_checker("gm_lawn", "#5CC83C", "#4FBC37"), tile=4.0)
mat("path_tex", "#FFE9B8", rough=0.7, tex=tex_brick("gm_path", "#FFE9B8", "#F8DCA0", "#E6C27A"), tile=1.6)
mat("cliff_tex", "#C9783A", rough=0.8, tex=tex_strata("gm_cliff", ["#C9783A", "#E09A52", "#C9783A", "#B5652E", "#E09A52", "#D98C48"]), tile=3.0)
mat("water_tex", "#3ED6E0", rough=0.15, tex=tex_waves("gm_water", "#3ED6E0", "#63DEE8"), tile=9.0)
mat("roof_tex", "#E8483C", rough=0.6, tex=tex_tiles("gm_roof", "#E8483C", "#DA3B31", "#C22E26", n=4), tile=2.0)

CHROMA = ["cream", "sand", "terracotta", "orange", "red", "pink", "rose", "yellow", "gold", "green", "leaf_dark",
          "leaf_light", "teal", "blue", "sky", "navy", "purple", "trunk", "wood"]
HSV = {k: colorsys.rgb_to_hsv(*srgb(PAL[k])) for k in CHROMA}

def to_srgb(c):
    f = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * (max(x, 0) ** (1 / 2.4)) - 0.055
    return tuple(min(1, max(0, f(x))) for x in c[:3])

def base(m):
    b = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
    return b

def pick(m):
    n = m.name.lower(); b = base(m)
    if b is None: return "cream"
    col = to_srgb(b.inputs["Base Color"].default_value); h, s, v = colorsys.rgb_to_hsv(*col)
    if "glass" in n or b.inputs["Alpha"].default_value < 0.95: return "glass"
    if "water" in n: return "water"
    if "glow" in n or b.inputs["Emission Strength"].default_value > 0.2: return "glow"
    if s < 0.15:
        return "white" if v > 0.85 else "stone" if v > 0.6 else "grey" if v > 0.35 else "slate" if v > 0.2 else "plum"
    if v < 0.2: return "plum"
    best = min(CHROMA, key=lambda k: min(abs(h - HSV[k][0]), 1 - abs(h - HSV[k][0])) * 3 + abs(v - HSV[k][2]) * 0.8 + abs(s - HSV[k][1]) * 0.4)
    return best

PUBLIC = ["GROVE_ENVIRONMENT_BLOCKOUT", "GROVE_PARK_ARRIVAL_REFINEMENT", "GROVE_MALL_FACADE_REFINEMENT", "GROVE_ATRIUM_REFINEMENT",
          "GROVE_VEGETATION_REFINEMENT", "GROVE_PARK_DETAIL_REFINEMENT", "GROVE_STOREFRONT_REFINEMENT",
          "GROVE_VERTICAL_CIRCULATION_REFINEMENT", "GROVE_PLAYABLE_MALL_REFINEMENT"]
cache = {}; remapped = 0; pub_objs = set()
for cn in PUBLIC:
    c = bpy.data.collections.get(cn)
    if not c: continue
    for o in c.all_objects:
        if o.type != "MESH": continue
        pub_objs.add(o.name)
        for slot in o.material_slots:
            m = slot.material
            if m is None or m.name.startswith("GM_"): continue
            if m.name not in cache: cache[m.name] = M(pick(m))
            slot.material = cache[m.name]; remapped += 1

# shop interiors keep their own colours, lifted to the same brightness and saturation family
lifted = 0
for m in bpy.data.materials:
    if m.name.startswith("GM_") or m.users == 0 or m.name in cache or m.get("gm_lifted"): continue
    b = base(m)
    if b is None or b.inputs["Base Color"].is_linked: continue
    h, s, v = colorsys.rgb_to_hsv(*to_srgb(b.inputs["Base Color"].default_value))
    if s > 0.12: s = min(1.0, s * 1.2 + 0.04)
    if v < 0.22: h, s, v = 0.75, 0.42, 0.29
    r, g, bl = colorsys.hsv_to_rgb(h, s, min(1.0, v * 1.04))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    b.inputs["Base Color"].default_value = (f(r), f(g), f(bl), 1); m.diffuse_color = (f(r), f(g), f(bl), 1)
    b.inputs["Roughness"].default_value = min(max(b.inputs["Roughness"].default_value, 0.42), 0.7)
    b.inputs["Metallic"].default_value = min(b.inputs["Metallic"].default_value, 0.25)
    m["gm_lifted"] = 1; lifted += 1
rep = {"palette_materials": sum(1 for m in bpy.data.materials if m.name.startswith("GM_")), "public_slots_remapped": remapped,
       "codex_public_materials_replaced": len(cache), "interior_materials_lifted": lifted}
bpy.app.driver_namespace["gk_report"] = rep
print("P02", rep)
