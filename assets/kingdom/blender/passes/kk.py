"""Kingdom kit helpers. Reuses the Grove kit (gk.py, gv.py) so both worlds share one palette and one way of building.
Nothing in this file edits the scene on import."""
import bpy, bmesh, sys, os, math
import numpy as np
from math import radians, sin, cos, pi, tau, sqrt
from mathutils import Vector, Matrix, Euler
HERE = os.path.dirname(os.path.abspath(__file__))
BLEND_DIR = os.path.dirname(HERE)
KINGDOM = os.path.dirname(BLEND_DIR)
ROOT = os.path.dirname(os.path.dirname(KINGDOM))
GROVE_KIT = os.path.join(ROOT, "assets", "grove", "blender", "mario")
if GROVE_KIT not in sys.path: sys.path.insert(0, GROVE_KIT)
import gk, gv
from gk import *
from gv import weld, band, crown, dot
gk.TEX = os.path.join(KINGDOM, "textures")     # new Kingdom textures are written here, not into the Grove folder

Z = 2.0            # height of the lawn, the one walk height of the home island
CELL = 1.0         # outdoor placement cell in metres (0.5 indoors)
SUPERSEDED = "KINGDOM_SUPERSEDED"
NS = bpy.app.driver_namespace

ALIAS = {"orange": "carrot", "dirt": "cliff", "dirt2": "cliff_light"}

# textured surfaces: the Grove's own tiling textures, so lawn, cliff and paving match across both worlds
TEXMATS = {"lawn_tex": ("#5CC83C", 0.8, "gm_lawn.png", 4.0), "cliff_tex": ("#C9783A", 0.8, "gm_cliff.png", 3.0),
           "path_tex": ("#FFE9B8", 0.7, "gm_path.png", 1.6)}

# colours the Grove table lacks. roofA/B/C are the three roof tones of a kit house: the game recolours exactly these
# materials when the player picks a roof colour, so nothing else may use them.
EXTRA = {"roofA": "#E52521", "roofB": "#F05236", "roofC": "#B5211B",
         # petalA / petalB: the petals and the centre of a flower the player plants. The game recolours exactly these
         # two when a colour is chosen, so one mesh serves every colour of a species.
         "petalA": "#FF7EB6", "petalB": "#FFB91F", "soil_wet": "#6E3C22",
         # the house kit: wallA (walls), wallC (plinth), trimA (beams, frames, posts) and doorA (doors) are what the player
         # recolours, with their light and dark steps (<name>_lt, <name>_dk, made by ktone); nothing else may use them.
         "wallA": "#FFF1D0", "wallC": "#DDCFB6", "trimA": "#C98443", "doorA": "#049CD8", "steel": "#C9CED6",
         # the decor kit
         "rope": "#E8C98A", "pot": "#E8743B", "soil": "#91522E", "rock": "#D6C7A8",
         # the room kit: roomWall (paint), roomTrim (skirting, frames, caps) are what the player recolours indoors
         "roomWall": "#FFF1D0", "roomTrim": "#FFFAEC",
         # greenery, second look (kgreen.py): the light patch and the shade of the three greens and of the blossom pink.
         # canopyHi is about as light as the lawn and no lighter: a crown must not glow against the grass.
         "canopyHi": "#6ECB4E", "canopyDeep": "#2FA257", "canopyDeepHi": "#55BF62", "canopyDeepLo": "#237F4C",
         "canopyWarm": "#62BC3C", "canopyWarmLo": "#45A03A", "blossom": "#FF9CC4", "blossomHi": "#FFC6DC", "blossomLo": "#F2709F",
         "canopy": "#43B047", "canopyLo": "#2E9A45", "canopyWarmHi": "#8FDC4E",
         "grassHi": "#86E05A", "grassLo": "#5FCB45", "cabbage": "#A6DE68", "cabbageHi": "#C8EE90", "rockA": "#BCAE94", "rockHi": "#D6C7A8", "rockLo": "#9C8F78", "cloudLo": "#DCE9F5",
         # the plant kit, third look (kcrops.py): true plant colours, kept bright
         "carrotTop": "#7FB33A", "carrotLeaf": "#3FAE3A", "cropStalk": "#5FA83E", "cropLeaf": "#3E9E3E", "cropLeafLt": "#62B84A",
         "tomatoRed": "#E8352B", "tomatoOrange": "#F2862A", "tomatoGreen": "#8CC63F", "tomatoFlower": "#FFD93A", "starYellow": "#FFC21F",
         "cornLeaf": "#5DB84A", "cornStalk": "#7CBF4E", "cornJoint": "#5E9E3C", "cornSilk": "#E8C46A", "cornTassel": "#D8C36A",
         "pumpkinLeaf": "#3D8F3A", "pumpkinGreen": "#4E8F3A", "pumpkinStem": "#8A7A3A", "pumpkinFlower": "#FFB21F", "strawberryUnripe": "#D8E8A8",
         "tulipLeaf": "#6DAA84", "tulipStem": "#6FAE6A", "sunStem": "#6AA83E", "sunLeaf": "#4E9E38", "bract": "#4F8F36",
         "roseLeaf": "#2F7F3F", "roseCane": "#4E7A34", "lavLeaf": "#8DAE8C", "lavBud": "#8A79B8",
         # trees, third look (ktrees.py): an orange tree's dark leathery leaves, a fir's blue-green
         "citrusLeaf": "#2E8B3E", "citrusLeafHi": "#4FAE4C", "citrusLeafLo": "#1F6E35", "firLeaf": "#2F8A5A", "firLeafHi": "#4CA86A", "firLeafLo": "#226B48",
         # fire (kprops.py): the bands of a cartoon flame, root to tip
         "flameCore": "#FFE680", "flameMid": "#FFA41C", "flameTip": "#F2552C",
         "eyeInk": "#2E2238", "eyeShine": "#FFFFFF", "noseRose": "#C9707A", "noseBrown": "#5A3A2E", "nosePink": "#E89AA0",
         "waterFlow": "#8FE8F5", "foam": "#F2FDFF"}

def M(name):
    """Palette material by name. This file keeps ONE prefix, KI_: Codex's materials already use the Grove palette,
    and any colour they lack is made from the Grove table and named KI_ as well."""
    name = ALIAS.get(name, name)
    m = bpy.data.materials.get("KI_" + name)
    if m is None:
        if name in TEXMATS:
            col, rough, img, tile = TEXMATS[name]
            m = gk.mat(name, col, rough=rough, tex=bpy.data.images.load(os.path.join(ROOT, "assets", "grove", "textures", img), check_existing=True), tile=tile)
        elif name in EXTRA:
            m = gk.mat(name, EXTRA[name])
        else:
            m = gk.mat(name)
        m.name = "KI_" + name
    return m
gk.M = M          # gk.B looks colours up through gk.M, so builders in this file get KI_ materials

def KI(name):
    """Codex's material of that name (same palette as the Grove's GM_ set)."""
    return bpy.data.materials["KI_" + name]

def C(name):
    return bpy.data.collections[name]

def supersede(objs):
    """Retire objects without deleting them: they move to a hidden collection that is never exported."""
    c = bpy.data.collections.get(SUPERSEDED)
    if c is None:
        c = bpy.data.collections.new(SUPERSEDED); bpy.context.scene.collection.children.link(c)
    c.hide_viewport = True; c.hide_render = True
    n = 0
    for o in objs:
        if o is None or c in o.users_collection: continue
        for u in list(o.users_collection): u.objects.unlink(o)
        c.objects.link(o); n += 1
    return n

def kit(name, b, sharp=50):
    """Store builder b as the shared mesh `name`. Re-running rebuilds the mesh and keeps every placed instance."""
    new = b.data(name + "__new", sharp); old = bpy.data.meshes.get(name)
    if old:
        old.user_remap(new); bpy.data.meshes.remove(old)
    new.name = name; return new

def put(name, me, coll, loc=(0, 0, 0), rz=0.0, sc=1.0):
    """Place (or update) the object `name`. A new object goes into `coll`; an existing one stays in whatever
    collection it is in now, so re-running a builder pass never undoes the layout pass."""
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, me)
        (ccol(coll) if isinstance(coll, str) else coll).objects.link(o)
    else:
        o.data = me
    o.location = loc; o.rotation_euler = (0, 0, rz)
    o.scale = sc if isinstance(sc, (tuple, list)) else (sc, sc, sc)
    return o

def apply_scale(o):
    s = o.scale.copy()
    if all(abs(x - 1) < 1e-5 for x in s): return False
    if o.data.users > 1: o.data = o.data.copy()
    o.data.transform(Matrix.Diagonal((s.x, s.y, s.z, 1))); o.scale = (1, 1, 1)
    if s.x * s.y * s.z < 0: o.data.flip_normals()
    return True

def world_bb(objs):
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in objs:
        a, b = wbb(o)
        for i in range(3): lo[i] = min(lo[i], a[i]); hi[i] = max(hi[i], b[i])
    return lo, hi

def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

def report(**kw):
    NS["kk_report"] = kw; return kw

def join(name, objs, coll, share=True):
    """Make ONE mesh object from several: modifiers applied, world positions kept, origin at the base centre.
    The originals are retired. If an identical mesh was already made this way it is shared, not copied, so repeats
    (beds, bales, stones) become instances."""
    import hashlib
    objs = [o for o in objs if o.type in ("MESH", "CURVE")]
    if not objs: return None
    dg = bpy.context.evaluated_depsgraph_get(); bm = bmesh.new(); mats = []
    for o in sorted(objs, key=lambda o: o.name):
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        if o.matrix_world.to_3x3().determinant() < 0: me.flip_normals()
        remap = []
        for m in (list(me.materials) or [None]):
            if m not in mats: mats.append(m)
            remap.append(mats.index(m))
        n0 = len(bm.faces); bm.from_mesh(me); bm.faces.ensure_lookup_table()
        for f in bm.faces[n0:]: f.material_index = remap[min(f.material_index, len(remap) - 1)]
        bpy.data.meshes.remove(me)
    xs = [v.co for v in bm.verts]
    lo = Vector((min(c.x for c in xs), min(c.y for c in xs), min(c.z for c in xs)))
    hi = Vector((max(c.x for c in xs), max(c.y for c in xs), max(c.z for c in xs)))
    org = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    bmesh.ops.translate(bm, vec=-org, verts=bm.verts[:])
    sig = hashlib.md5(repr((sorted((round(v.co.x, 3), round(v.co.y, 3), round(v.co.z, 3)) for v in bm.verts),
                            [m.name if m else "-" for m in mats])).encode()).hexdigest()
    cache = NS.setdefault("kk_join_cache", {})
    me = bpy.data.meshes.get(cache.get(sig, "")) if share else None
    if me is None:
        me = bpy.data.meshes.new(name); bm.to_mesh(me)
        for m in mats: me.materials.append(m)
        hard_normals(me, 50); me["kk_sig"] = sig; cache[sig] = me.name
    bm.free()
    o = put(name, me, coll, org)
    supersede(objs)
    return o

def show_collection(name, on):
    """Tick or untick a collection (and its children) in the view layer, without rebuilding anything."""
    def find(lc):
        if lc.collection.name == name: return lc
        for ch in lc.children:
            r = find(ch)
            if r: return r
    def set_(lc, v):
        lc.exclude = v
        for ch in lc.children: set_(ch, v)
    lc = find(bpy.context.view_layer.layer_collection)
    if lc: set_(lc, not on)
    return bool(lc)
