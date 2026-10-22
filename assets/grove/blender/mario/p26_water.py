"""Pass 26: flowing water for the two fountains (the atrium bloom and the park fountain).

Water rig. Every piece of moving water is its own object, named WATER_<Fountain>_<Part>, in MARIO_WATER_ATRIUM or
MARIO_WATER_PARK:
    Pool   the water in the basin         rings travel outward
    Bowl   the water in the upper dish    rings travel outward
    Fall   the sheet spilling off the dish, all the way round, down into the pool
    Jets   eight arcs from the collar under the bud down into the dish
The water does not move as geometry: it flows because its texture slides along the surface. Each mesh is unwrapped so
that V runs the way the water travels (down the sheet, along a jet, outward across a pool), and the two materials
GM_water_flow (streaks, see-through) and GM_water_rings (ripple bands) slide their texture along V.
  Blender: a driver on each material's Mapping node (node "Flow", Location Y) moves it with the frame number, so
           pressing play shows the water running. Frame 0 is what the glTF exporter reads.
  Game:    src/grove/scene/water.js finds the WATER_ nodes and slides texture.offset the same way.
The park fountain body is rebuilt here too (GrovePark_Fountain): Codex's was a plain drum with a pole in it."""
import bpy, bmesh, math, os
import numpy as np
from gk import *

sc_ = bpy.context.scene; FPS = sc_.render.fps / sc_.render.fps_base
TILE = 1.3                       # metres of water per repeat of the texture, along the flow
SPEED = {"flow": 1.1, "rings": 0.22}      # repeats per second (the game uses the same numbers)

# ---- textures (tileable both ways)
def image(name, px):
    h, w = px.shape[:2]; img = bpy.data.images.get(name)
    if img is None: img = bpy.data.images.new(name, w, h, alpha=True)
    elif img.size[0] != w or img.size[1] != h: img.scale(w, h)
    img.alpha_mode = "STRAIGHT"; img.pixels.foreach_set(px.astype(np.float32).ravel())
    os.makedirs(TEX, exist_ok=True); img.filepath_raw = os.path.join(TEX, name + ".png"); img.file_format = "PNG"; img.save()
    return img

h, w = 128, 64; a = np.full((h, w), 0.0); rng = np.random.default_rng(11)
for k in range(16):                                   # streaks: soft-ended dashes running along V
    x = int(rng.integers(0, w)); y0 = int(rng.integers(0, h)); L = int(rng.integers(30, 80)); wd = int(rng.integers(2, 6))
    for dy in range(L):
        f = math.sin(pi * dy / L) ** 0.6
        for dx in range(wd): a[(y0 + dy) % h, (x + dx) % w] = max(a[(y0 + dy) % h, (x + dx) % w], f)
base = np.array(srgb("#9FEAF2")); white = np.array((1.0, 1.0, 1.0)); px = np.zeros((h, w, 4))
px[..., :3] = base + (white - base) * a[..., None]; px[..., 3] = 0.46 + 0.5 * a
FLOW = image("gm_water_flow", px)
h, w = 64, 64; V, U = np.mgrid[0:h, 0:w] / 64.0
wave = 0.5 + 0.5 * np.sin(tau * (2 * V + 0.07 * np.sin(tau * 2 * U))); thin = 0.5 + 0.5 * np.sin(tau * (V + 0.05 * np.sin(tau * 3 * U) + 0.31))
m_ = np.clip((wave - 0.74) / 0.1, 0, 1) * 0.9 + np.clip((thin - 0.93) / 0.05, 0, 1) * 0.6; m_ = np.clip(m_, 0, 1)
deep = np.array(srgb("#3ED6E0")); lite = np.array(srgb("#B4F4F6")); px = np.ones((h, w, 4)); px[..., :3] = deep + (lite - deep) * m_[..., None]
RINGS = image("gm_water_rings", px)

def water_mat(key, img, see_through):
    m = bpy.data.materials.get("GM_water_" + key) or bpy.data.materials.new("GM_water_" + key); m.use_nodes = True; nt = m.node_tree
    if nt.animation_data:
        for fc in list(nt.animation_data.drivers): nt.animation_data.drivers.remove(fc)
    for n in list(nt.nodes):
        if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"): nt.nodes.remove(n)
    bs = nt.nodes["Principled BSDF"]; tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.name = "Flow"
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = img; tx.name = "GMTex"
    tc.location = (-900, 300); mp.location = (-700, 300); tx.location = (-420, 300)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"]); nt.links.new(tx.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.15; m.use_backface_culling = False; m.diffuse_color = (*lin("#3ED6E0"), 1)
    if see_through:
        nt.links.new(tx.outputs["Alpha"], bs.inputs["Alpha"])
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    # the pattern has to travel towards +V, so the texture is sampled further back as time goes on
    fc = nt.driver_add('nodes["Flow"].inputs[1].default_value', 1); fc.driver.type = "SCRIPTED"; fc.driver.expression = "-frame*%.6f" % (SPEED[key] / FPS)
    m["water_speed"] = SPEED[key]; return m
MAT = {"flow": water_mat("flow", FLOW, True), "rings": water_mat("rings", RINGS, False)}

# ---- geometry: a grid of points with its own UVs, V along the flow
def sheet(name, coll, P, UV, mat, origin, s):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap"); rows = [[bm.verts.new(p) for p in row] for row in P]
    for i in range(len(rows) - 1):
        for j in range(len(rows[i]) - 1):
            f = bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j])); f.smooth = True
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))): lp[uvl].uv = UV[ii][jj]
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.location = origin; o.scale = (s, s, s)
    o["water_rig"] = "texture slides along V: material node Flow (Blender), water.js (game)"; return o

def disc(name, coll, R, z, origin, s, r0=0.0, n=32, rings=4):
    P, UV = [], []
    for i in range(rings + 1):
        r = r0 + (R - r0) * i / rings
        P.append([(r * cos(tau * j / n), r * sin(tau * j / n), z) for j in range(n + 1)]); UV.append([(8.0 * j / n, r * s / TILE) for j in range(n + 1)])
    return sheet(name, coll, P[::-1], UV[::-1], MAT["rings"], origin, s)        # outer ring first: faces turn upward

def fall(name, coll, prof, origin, s, n=32):
    P, UV = [], []; d = 0.0
    for i, (r, z) in enumerate(prof):
        if i: d += math.hypot(r - prof[i - 1][0], z - prof[i - 1][1])
        P.append([(r * cos(tau * j / n), r * sin(tau * j / n), z) for j in range(n + 1)]); UV.append([(10.0 * j / n, d * s / TILE) for j in range(n + 1)])
    return sheet(name, coll, P[::-1], UV[::-1], MAT["flow"], origin, s)

def jets(name, coll, arcs, radius, origin, s, seg=6):
    P, UV = [], []
    for arc in arcs:                                   # one object, one strip per arc (strips are not joined to each other)
        pts = [Vector(p) for p in arc]; d = 0.0; rows, uvs = [], []; prevN = None
        for i, p in enumerate(pts):
            tan = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            if i: d += (p - pts[i - 1]).length
            ref = Vector((0, 0, 1)) if prevN is None else prevN
            N = (ref - tan * ref.dot(tan)).normalized(); Bn = tan.cross(N); prevN = N
            rows.append([tuple(p + (N * cos(tau * k / seg) + Bn * sin(tau * k / seg)) * radius) for k in range(seg + 1)])
            uvs.append([(0.6 * k / seg, d * s / TILE) for k in range(seg + 1)])
        P.append(rows); UV.append(uvs)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
    for rows, uvs in zip(P, UV):
        vs = [[bm.verts.new(p) for p in row] for row in rows]
        for i in range(len(vs) - 1):
            for j in range(seg):
                f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1])); f.smooth = True
                for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))): lp[uvl].uv = uvs[ii][jj]
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(MAT["flow"])
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.location = origin; o.scale = (s, s, s)
    o["water_rig"] = "texture slides along V: material node Flow (Blender), water.js (game)"; return o

def body(b, bowl="pink", bud="pink", ring="gold"):
    """The bloom fountain, in its own units (3.1 across the plinth, 4.2 tall): the same shape p07 builds for the atrium."""
    b.lathe([(3.1, 0), (3.1, 0.18), (2.9, 0.34), (0, 0.34)], seg=32, mats=[ring, "white", "white"])
    b.tube([(2.75 * cos(tau * i / 32), 2.75 * sin(tau * i / 32), 0.6) for i in range(32)], 0.2, ring, seg=8, closed=True)
    b.lathe([(0.75, 0.3), (0.6, 0.7), (0.36, 0.95), (0.3, 1.45), (0.5, 1.55), (1.45, 1.75), (1.55, 1.9), (1.4, 1.92), (0.45, 1.8), (0, 1.8)], seg=20,
            mats=["white", "white", "white", ring, bowl, bowl, bowl, "water", "water"])
    b.lathe([(0.3, 1.8), (0.24, 2.5), (0.42, 2.62), (0.42, 2.72), (0, 2.72)], seg=14, mats=["white", ring, ring, ring])
    b.lathe([(0, 2.7), (0.42, 2.8), (0.6, 3.25), (0.44, 3.75), (0.16, 4.1), (0, 4.2)], m=bud, seg=14)
    for i in range(5):
        a = tau * i / 5; b.ball(1.0, (0.42 * cos(a), 0.42 * sin(a), 2.86), "leaf_light", sc=(0.42, 0.24, 0.1), u=8, v=4, rot=(0, -0.55, a))

def water(tag, coll, origin, s):
    out = [disc("WATER_%s_Pool" % tag, coll, 2.62, 0.74, origin, s, r0=0.5), disc("WATER_%s_Bowl" % tag, coll, 1.47, 1.928, origin, s, r0=0.28, n=24, rings=2),
           fall("WATER_%s_Fall" % tag, coll, [(1.46, 1.93), (1.57, 1.94), (1.66, 1.84), (1.72, 1.5), (1.76, 1.1), (1.78, 0.74)], origin, s)]
    arcs = []
    for i in range(8):
        a = tau * (i + 0.5) / 8
        arcs.append([((0.43 + 0.68 * u) * cos(a), (0.43 + 0.68 * u) * sin(a), 2.67 + 0.9 * u - 1.64 * u * u) for u in [k / 7 for k in range(8)]])
    out.append(jets("WATER_%s_Jets" % tag, coll, arcs, 0.05, origin, s)); return out

# ---- atrium: water for the bloom p07 built (its own scale is 0.64), in place of Codex's flat disc
WA = fresh("MARIO_WATER_ATRIUM", "GROVE_ATRIUM_REFINEMENT")
gone = supersede(named("Atrium_Refined_Water", coll="GROVE_ATRIUM_REFINEMENT"))
made = water("Atrium", WA, (0, 0, 0), 0.64)
# ---- park: a small bloom fountain where Codex's drum stood, with the same water
WP = fresh("MARIO_WATER_PARK", "GROVE_PARK_DETAIL_REFINEMENT")
gone += supersede(named("Park_Ripple_Basin", "Park_Ripple_Water", "Park_Ripple_Sprout", coll="GROVE_PARK_ARRIVAL_REFINEMENT"))
PX, PY, PS = -15.5, 34.5, 0.8
b = B(); body(b, bowl="teal", bud="yellow"); o = b.obj("GrovePark_Fountain", WP); o.location = (PX, PY, 0); o.scale = (PS, PS, PS)
made += water("Park", WP, (PX, PY, 0), PS)
sc_.frame_set(0)
rep = {"superseded": gone, "water": [x.name for x in made], "tris": sum(len(p.vertices) - 2 for x in made + [o] for p in x.data.polygons)}
bpy.app.driver_namespace["gk_report"] = rep
print("P26", rep)
