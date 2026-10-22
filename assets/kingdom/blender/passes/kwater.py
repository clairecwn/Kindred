"""Moving water for the Kingdom, rigged the way the Grove's fountains are (assets/grove/blender/mario/p26_water.py),
because that is what reads as real water in this game: the water does not move as geometry, its texture slides along
the surface. Every piece of water is its own object, WATER_<Piece>_<Part>, unwrapped so that V runs the way the water
travels:
    Pool, Bowl   standing water: ripple bands travelling outward from the middle (GM_water_rings)
    Fall         a see-through sheet spilling over a rim, streaks running down it (GM_water_flow)
    Jets         arcs of water from a spout, streaks running along them (GM_water_flow)
    Tile         a pond tile: the ripple bands drift slowly across it, lined up from tile to tile (GM_water_rings)
The two materials and their pictures are the Grove's own (assets/grove/textures/gm_water_flow.png and
gm_water_rings.png), so the water in the Kingdom and the Grove is the same water. In the game, src/grove/scene/water.js
finds the WATER_ nodes and slides the textures (the Kingdom calls it through src/kingdom/water.js).

The pieces with water (PIECES) get their WATER_ objects as children of the part when the decor kit is written
(k22_export_decor.py), and on the display shelf when it is built (k17_decor_kit.py)."""
import bpy, bmesh, os, math
from math import cos, sin, tau, pi
from mathutils import Vector
import gk

TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "grove", "textures"); TILE = 1.3                     # metres of water per repeat of the texture, along the flow (as p26)
SPEED = {"flow": 1.1, "rings": 0.22}

def _img(name):
    p = os.path.join(TEX, name + ".png"); img = bpy.data.images.get(name)
    if img is None or img.filepath_raw != p:
        img = bpy.data.images.load(p, check_existing=True); img.name = name
    img.alpha_mode = "STRAIGHT"; return img

def material(key):
    """GM_water_flow (see-through streaks) or GM_water_rings (ripple bands), made as p26 makes them."""
    see = key == "flow"; m = bpy.data.materials.get("GM_water_" + key)
    if m and m.get("water_speed"): return m
    m = m or bpy.data.materials.new("GM_water_" + key); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"): nt.nodes.remove(n)
    bs = nt.nodes["Principled BSDF"]; tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.name = "Flow"
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = _img("gm_water_" + key); tx.name = "GMTex"
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"]); nt.links.new(tx.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.15; m.use_backface_culling = False; m.diffuse_color = (*gk.lin("#3ED6E0"), 1)
    if see:
        nt.links.new(tx.outputs["Alpha"], bs.inputs["Alpha"])
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    fc = nt.driver_add('nodes["Flow"].inputs[1].default_value', 1); fc.driver.type = "SCRIPTED"
    fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base; fc.driver.expression = "-frame*%.6f" % (SPEED[key] / fps)
    m["water_speed"] = SPEED[key]; return m

def _mesh(name, P, UV, key, up=True):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap"); rows = [[bm.verts.new(p) for p in row] for row in P]
    for i in range(len(rows) - 1):
        for j in range(len(rows[i]) - 1):
            f = bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j])); f.smooth = True
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))): lp[uvl].uv = UV[ii][jj]
    me = bpy.data.meshes.get(name)
    if me: bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(material(key)); return me

def disc(name, R, z, r0=0.0, n=32, rings=4, waves=5.0):
    """Standing water in a round basin: concentric rings of points, V outward, so the bands spread from the middle."""
    P, UV = [], []
    for i in range(rings + 1):
        r = max(r0, 1e-4) + (R - max(r0, 1e-4)) * i / rings
        P.append([(r * cos(tau * j / n), r * sin(tau * j / n), z) for j in range(n + 1)]); UV.append([(waves * j / n, r / TILE) for j in range(n + 1)])     # waves: how many times the bands wobble round
    return _mesh(name, P[::-1], UV[::-1], "rings")             # outer ring first: faces turn upward

def fall(name, prof, n=32):
    """A sheet of water all the way round, through the points prof [(r, z)] from where it leaves the rim down to where
    it lands; V runs down it."""
    P, UV = [], []; d = 0.0
    for i, (r, z) in enumerate(prof):
        if i: d += math.hypot(r - prof[i - 1][0], z - prof[i - 1][1])
        P.append([(r * cos(tau * j / n), r * sin(tau * j / n), z) for j in range(n + 1)]); UV.append([(10.0 * j / n, d / TILE) for j in range(n + 1)])
    return _mesh(name, P[::-1], UV[::-1], "flow")

def jets(name, arcs, radius, seg=6):
    """Arcs of water, each a thin tube along its points; V runs along it from the spout."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
    for arc in arcs:
        pts = [Vector(p) for p in arc]; d = 0.0; rows, uvs = [], []; prevN = None
        for i, p in enumerate(pts):
            tan = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            if i: d += (p - pts[i - 1]).length
            ref = Vector((0, 0, 1)) if prevN is None else prevN
            N = (ref - tan * ref.dot(tan)).normalized(); Bn = tan.cross(N); prevN = N
            rr = radius * (1.0 - 0.35 * i / (len(pts) - 1))                   # a jet thins as it falls
            rows.append([tuple(p + (N * cos(tau * k / seg) + Bn * sin(tau * k / seg)) * rr) for k in range(seg + 1)])
            uvs.append([(0.6 * k / seg, d / TILE) for k in range(seg + 1)])
        vs = [[bm.verts.new(p) for p in row] for row in rows]
        for i in range(len(vs) - 1):
            for j in range(seg):
                f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1])); f.smooth = True
                for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))): lp[uvl].uv = uvs[ii][jj]
    me = bpy.data.meshes.get(name)
    if me: bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(material("flow")); return me

def tile(name, z, n=4):
    """A 1 x 1 m pond tile of standing water. U and V are the cell's own x and y in metres (V scaled as the Grove's), so
    the bands line up across every tile of a pond and drift slowly one way."""
    P, UV = [], []
    for i in range(n + 1):
        y = 0.5 - i / n
        P.append([(-0.5 + j / n, y, z) for j in range(n + 1)]); UV.append([((-0.5 + j / n), (y + 0.5) / TILE) for j in range(n + 1)])
    return _mesh(name, P, UV, "rings")

# ---------------------------------------------------------------- which decor parts carry water
def _fountain():
    from kdecor import FOUNTAIN as F
    arcs = []
    for i in range(8):
        a = tau * (i + 0.5) / 8
        arcs.append([((F["jet_r"] + (F["bowl_land"] - F["jet_r"]) * u) * cos(a), (F["jet_r"] + (F["bowl_land"] - F["jet_r"]) * u) * sin(a),
                      F["jet_z"] + 0.22 * u - (F["jet_z"] + 0.22 - F["bowl_z"]) * u * u) for u in [k / 8 for k in range(9)]])
    return [("Pool", disc("KW_Fountain_Pool", F["basin_r"], F["pool_z"], r0=F["foot_r"], n=64, rings=6)),
            ("Bowl", disc("KW_Fountain_Bowl", F["bowl_r"], F["bowl_z"], r0=F["neck_r"], n=56, rings=5)),
            ("Fall", fall("KW_Fountain_Fall", F["fall"], n=48)),
            ("Jets", jets("KW_Fountain_Jets", arcs, 0.028))]
def _round():
    from kdecor import WATER
    return [("Pool", disc("KW_Pondround_Pool", 0.76, WATER, n=56, rings=6))]
def _tile():
    from kdecor import WATER
    return [("Pool", tile("KW_Pondtile_Pool", WATER))]
PIECES = {"KD_Pond_Fountain": ("Fountain", _fountain), "KD_Pond_Round": ("Pondround", _round), "KD_Pond_Water": ("Pondtile", _tile)}

def attach(o, coll, piece=None):
    """Give object o (a decor part) its water as children named WATER_<Piece>_<Part>. Returns the new objects."""
    piece = piece or o.data.name
    if piece not in PIECES: return []
    tag, make = PIECES[piece]; out = []
    for part, me in make():
        nm = "WATER_%s_%s" % (tag, part)
        old = bpy.data.objects.get(nm)
        if old: bpy.data.objects.remove(old, do_unlink=True)
        w = bpy.data.objects.new(nm, me); coll.objects.link(w); w.parent = o; w["water_rig"] = "texture slides along V: material node Flow (Blender), water.js (game)"
        out.append(w)
    return out
