"""Grove kit: shared helpers for the Mario-style finishing pass on grove_master_refined.blend.
Every pass script in this folder imports from here. Nothing in this file edits the scene on import."""
import bpy, bmesh, math, os, colorsys
from math import radians, sin, cos, pi, tau
from mathutils import Vector, Matrix, Euler
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GROVE = os.path.dirname(os.path.dirname(HERE))
TEX = os.path.join(GROVE, "textures")

PAL = {
    "cream": "#FFF1D0", "white": "#FFFAEC", "sand": "#F2D08A", "terracotta": "#F29A4A", "orange": "#FF8A2A",
    "red": "#E52521", "pink": "#FF7EB6", "rose": "#F45C8C", "yellow": "#FBD000", "gold": "#FFB91F",
    "green": "#43B047", "lawn": "#5CC83C", "lawn2": "#4CBA36", "leaf_dark": "#2E9A45", "leaf_light": "#8FDC4E",
    "teal": "#1CC7B5", "blue": "#049CD8", "sky": "#4FB4F0", "navy": "#3246A8", "purple": "#8B5FD9",
    "plum": "#3A2A4A", "slate": "#5A5478", "trunk": "#A8622B", "trunk_light": "#D08A45", "wood": "#C98443",
    "water": "#3ED6E0", "water_light": "#A8F2F2", "glass": "#BFEFFF", "stone": "#E9DCC3", "grey": "#B9AFA3",
    "dirt": "#C9783A", "dirt2": "#E09A52", "glow": "#FFE9A0",
}

def srgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

def lin(h):
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(f(c) for c in srgb(h))

def mat(name, color=None, rough=0.5, metal=0.0, alpha=1.0, emit=0.0, tex=None, tile=2.0):
    n = "GM_" + name
    m = bpy.data.materials.get(n)
    if m is None:
        m = bpy.data.materials.new(n)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    c = lin(color or PAL[name])
    b.inputs["Base Color"].default_value = (*c, 1)
    m.diffuse_color = (*c, alpha)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    if emit:
        b.inputs["Emission Color"].default_value = (*c, 1)
        b.inputs["Emission Strength"].default_value = emit
    if tex is not None:
        tn = nt.nodes.get("GMTex") or nt.nodes.new("ShaderNodeTexImage")
        tn.name = "GMTex"; tn.image = tex; tn.location = (-320, 300)
        nt.links.new(tn.outputs["Color"], b.inputs["Base Color"])
        m["gm_tile"] = tile
    return m

def M(name):
    return bpy.data.materials.get("GM_" + name) or mat(name)

# ---------------------------------------------------------------- textures
def _img(name, arr):
    h, w = arr.shape[:2]
    img = bpy.data.images.get(name)
    if img is None:
        img = bpy.data.images.new(name, w, h, alpha=False)
    elif img.size[0] != w or img.size[1] != h:
        img.scale(w, h)
    px = np.ones((h, w, 4), dtype=np.float32); px[..., :3] = arr
    img.pixels.foreach_set(px.ravel())
    os.makedirs(TEX, exist_ok=True)
    img.filepath_raw = os.path.join(TEX, name + ".png"); img.file_format = "PNG"
    img.save()
    return img

def tex_checker(name, a, b, n=2, size=64):
    a, b = np.array(srgb(a)), np.array(srgb(b))
    yy, xx = np.mgrid[0:size, 0:size]
    k = ((xx * n // size) + (yy * n // size)) % 2
    return _img(name, np.where(k[..., None] == 0, a, b).astype(np.float32))

def tex_tiles(name, a, b, grout, n=2, size=128, g=3):
    arr = np.array(tex_checker("_tmp", a, b, n, size).pixels[:]).reshape(size, size, 4)[..., :3].copy()
    step = size // n
    for i in range(n):
        arr[i * step:i * step + g, :, :] = srgb(grout); arr[:, i * step:i * step + g, :] = srgb(grout)
    return _img(name, arr.astype(np.float32))

def tex_strata(name, cols, size=64):
    cols = [np.array(srgb(c)) for c in cols]
    arr = np.zeros((size, size, 3), dtype=np.float32)
    for x in range(size):
        off = 2.2 * sin(tau * x / size * 2) + 1.2 * sin(tau * x / size * 5)
        for y in range(size):
            arr[y, x] = cols[int(((y + off) % size) * len(cols) / size) % len(cols)]
    return _img(name, arr)

def tex_brick(name, a, b, grout, rows=4, size=128, g=3):
    arr = np.zeros((size, size, 3), dtype=np.float32); rh = size // rows; bw = size // 2
    for y in range(size):
        r = y // rh
        for x in range(size):
            xx = (x + (bw // 2 if r % 2 else 0)) % size
            col = a if ((xx // bw) + r) % 2 == 0 else b
            arr[y, x] = srgb(grout) if (y % rh < g or xx % bw < g) else srgb(col)
    return _img(name, arr)

def tex_waves(name, a, b, size=64):
    a, b = np.array(srgb(a)), np.array(srgb(b))
    yy, xx = np.mgrid[0:size, 0:size]
    k = (np.sin(tau * (xx + 6 * np.sin(tau * yy / size)) / size * 2 + tau * yy / size * 2) > 0.72).astype(np.float32)
    return _img(name, (a + (b - a) * k[..., None]).astype(np.float32))

# ---------------------------------------------------------------- mesh finishing
def hard_normals(me, angle=50):
    n = len(me.polygons)
    if n == 0: return
    N = np.empty(n * 3, dtype=np.float32); me.polygons.foreach_get("normal", N); N = N.reshape(n, 3)
    A = np.empty(n, dtype=np.float32); me.polygons.foreach_get("area", A)
    nl = len(me.loops); LV = np.empty(nl, dtype=np.int32); me.loops.foreach_get("vertex_index", LV)
    LT = np.empty(n, dtype=np.int32); me.polygons.foreach_get("loop_total", LT)
    LP = np.repeat(np.arange(n), LT)
    cosT = math.cos(math.radians(angle)); WN = N * A[:, None]
    order = np.argsort(LV, kind="stable"); lv = LV[order]
    out = np.zeros((nl, 3), dtype=np.float32)
    for g in np.split(order, np.flatnonzero(np.diff(lv)) + 1):
        fs = LP[g]; nf = N[fs]
        out[g] = ((nf @ nf.T) >= cosT).astype(np.float32) @ WN[fs]
    L = np.linalg.norm(out, axis=1); L[L == 0] = 1; out /= L[:, None]
    me.polygons.foreach_set("use_smooth", [True] * n)
    me.normals_split_custom_set(out.tolist())

def box_uv(me):
    uvl = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    tiles = [((m.get("gm_tile") or 2.0) if m else 2.0) for m in me.materials] or [2.0]
    vs = me.vertices; loops = me.loops; data = uvl.data
    for p in me.polygons:
        t = tiles[min(p.material_index, len(tiles) - 1)]; nrm = p.normal
        ax = max(range(3), key=lambda i: abs(nrm[i]))
        for li in p.loop_indices:
            c = vs[loops[li].vertex_index].co
            u, v = (c.x, c.y) if ax == 2 else ((c.x, c.z) if ax == 1 else (c.y, c.z))
            data[li].uv = (u / t, v / t)

def _M(loc=None, rot=None):
    m = Matrix.Identity(4)
    if rot is not None:
        m = rot.to_4x4() if isinstance(rot, Matrix) else Euler(rot, "XYZ").to_matrix().to_4x4()
    if loc is not None:
        m = Matrix.Translation(Vector(loc)) @ m
    return m

def _scr():
    return bpy.data.meshes.get("_gk_scratch") or bpy.data.meshes.new("_gk_scratch")

_FONT = [None, False]
def font():
    if not _FONT[1]:
        _FONT[1] = True
        for p in ("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
            if os.path.exists(p):
                _FONT[0] = bpy.data.fonts.load(p, check_existing=True); break
    return _FONT[0]

def text_mesh(txt, size=1.0, extrude=0.05, bevel=0.012):
    cu = bpy.data.curves.new("_gk_txt", "FONT")
    cu.body = txt; cu.size = size; cu.extrude = extrude; cu.bevel_depth = 0.0   # bevelled glyphs cost about 4x the triangles
    cu.align_x = "CENTER"; cu.align_y = "CENTER"; cu.resolution_u = 2
    f = font()
    if f: cu.font = f
    ob = bpy.data.objects.new("_gk_txt", cu); bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    return me

FACE = {"+y": (pi / 2, 0, pi), "-y": (pi / 2, 0, 0), "+x": (pi / 2, 0, pi / 2), "-x": (pi / 2, 0, -pi / 2), "+z": (0, 0, 0)}

class B:
    """Builds one joined mesh from rounded primitives. Coordinates are world space unless the object is moved after."""
    def __init__(s):
        s.bm = bmesh.new(); s.mats = []
    def mi(s, m):
        if isinstance(m, str): m = M(m)
        if m not in s.mats: s.mats.append(m)
        return s.mats.index(m)
    def _add(s, t, m=None, mtx=None):
        if m is not None:
            i = s.mi(m)
            for f in t.faces: f.material_index = i
        for f in t.faces: f.smooth = True
        bmesh.ops.recalc_face_normals(t, faces=t.faces[:])
        if mtx is not None:
            bmesh.ops.transform(t, matrix=mtx, verts=t.verts[:])
            if mtx.to_3x3().determinant() < 0: bmesh.ops.reverse_faces(t, faces=t.faces[:])
        me = _scr(); t.to_mesh(me); t.free(); s.bm.from_mesh(me)
    def box(s, size, loc=(0, 0, 0), m="cream", r=0.0, seg=2, rot=None):
        t = bmesh.new(); bmesh.ops.create_cube(t, size=1.0)
        bmesh.ops.scale(t, vec=Vector(size), verts=t.verts[:])
        if r > 0:
            r = min(r, min(size) * 0.49)
            bmesh.ops.bevel(t, geom=t.edges[:], offset=r, segments=seg, profile=0.5, affect="EDGES", clamp_overlap=True)
        s._add(t, m, _M(loc, rot))
    def box2(s, p0, p1, m="cream", r=0.0, seg=2):
        s.box([abs(p1[i] - p0[i]) for i in range(3)], [(p0[i] + p1[i]) / 2 for i in range(3)], m, r, seg)
    def cyl(s, r, h, loc=(0, 0, 0), m="cream", seg=16, r2=None, rot=None, bev=0.0):
        t = bmesh.new()
        bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
        bmesh.ops.translate(t, vec=(0, 0, h / 2), verts=t.verts[:])
        if bev > 0:
            ed = [e for e in t.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
            bmesh.ops.bevel(t, geom=ed, offset=bev, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
        s._add(t, m, _M(loc, rot))
    def ball(s, r, loc=(0, 0, 0), m="green", sc=(1, 1, 1), u=12, v=8, rot=None):
        t = bmesh.new(); bmesh.ops.create_uvsphere(t, u_segments=u, v_segments=v, radius=r)
        bmesh.ops.scale(t, vec=Vector(sc), verts=t.verts[:])
        s._add(t, m, _M(loc, rot))
    def lathe(s, prof, loc=(0, 0, 0), m="cream", seg=16, rot=None, mats=None, cap=True):
        t = bmesh.new(); rings = []
        for (r, z) in prof:
            rings.append([t.verts.new((0, 0, z))] if r <= 1e-6 else
                         [t.verts.new((r * cos(tau * i / seg), r * sin(tau * i / seg), z)) for i in range(seg)])
        idx = [s.mi(x) for x in mats] if mats else None
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            for i in range(seg):
                j = (i + 1) % seg
                if len(a) == 1 and len(b) == 1: continue
                if len(a) == 1: f = t.faces.new((a[0], b[i], b[j]))
                elif len(b) == 1: f = t.faces.new((a[i], a[j], b[0]))
                else: f = t.faces.new((a[i], a[j], b[j], b[i]))
                if idx: f.material_index = idx[min(k, len(idx) - 1)]
        if cap and len(rings[0]) > 1:
            f = t.faces.new(rings[0][::-1])
            if idx: f.material_index = idx[0]
        if cap and len(rings[-1]) > 1:
            f = t.faces.new(rings[-1])
            if idx: f.material_index = idx[-1]
        s._add(t, None if mats else m, _M(loc, rot))
    def tube(s, pts, r, m="white", seg=8, closed=False):
        pts = [Vector(p) for p in pts]; n = len(pts); t = bmesh.new(); rings = []; prevN = None; up = Vector((0, 0, 1))
        for i, p in enumerate(pts):
            a = pts[i - 1] if (i > 0 or closed) else p
            b = pts[(i + 1) % n] if (i < n - 1 or closed) else p
            tan = (b - a).normalized()
            if prevN is None:
                ref = up if abs(tan.dot(up)) < 0.95 else Vector((1, 0, 0))
                Nn = (ref - tan * ref.dot(tan)).normalized()
            else:
                Nn = prevN - tan * prevN.dot(tan)
                Nn = Nn.normalized() if Nn.length > 1e-6 else prevN
            Bn = tan.cross(Nn); prevN = Nn
            rr = r[i] if isinstance(r, (list, tuple)) else r
            rings.append([t.verts.new(p + (Nn * cos(tau * k / seg) + Bn * sin(tau * k / seg)) * rr) for k in range(seg)])
        for i in range(n if closed else n - 1):
            a, b = rings[i], rings[(i + 1) % n]
            for k in range(seg):
                j = (k + 1) % seg; t.faces.new((a[k], a[j], b[j], b[k]))
        if not closed:
            t.faces.new(rings[0][::-1]); t.faces.new(rings[-1])
        s._add(t, m)
    def prism(s, pts, h, m="cream", loc=None, rot=None, mtx=None, r=0.0):
        t = bmesh.new(); f = t.faces.new([t.verts.new((p[0], p[1], 0)) for p in pts])
        ret = bmesh.ops.extrude_face_region(t, geom=[f])
        bmesh.ops.translate(t, vec=(0, 0, h), verts=[e for e in ret["geom"] if isinstance(e, bmesh.types.BMVert)])
        if r > 0:
            ed = [e for e in t.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
            bmesh.ops.bevel(t, geom=ed, offset=r, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
        s._add(t, m, mtx if mtx is not None else _M(loc, rot))
    def mesh(s, me, m=None, loc=None, rot=None, mtx=None, sc=None):
        t = bmesh.new(); t.from_mesh(me)
        if m is None:
            remap = [s.mi(x) for x in me.materials] or [0]
            for f in t.faces: f.material_index = remap[min(f.material_index, len(remap) - 1)]
        if sc: bmesh.ops.scale(t, vec=Vector(sc), verts=t.verts[:])
        s._add(t, m, mtx if mtx is not None else _M(loc, rot))
    def text(s, txt, size, loc, m="white", face="+y", extrude=0.05, bevel=0.012):
        me = text_mesh(txt, size, extrude, bevel); s.mesh(me, m, loc, FACE[face]); bpy.data.meshes.remove(me)
    def data(s, name, sharp=50):
        me = bpy.data.meshes.new(name); s.bm.to_mesh(me); s.bm.free()
        for m in s.mats: me.materials.append(m)
        if any(m.get("gm_tile") for m in s.mats): box_uv(me)
        hard_normals(me, sharp)
        return me
    def obj(s, name, coll, sharp=50):
        o = bpy.data.objects.new(name, s.data(name, sharp)); coll.objects.link(o); return o

# ---------------------------------------------------------------- scene helpers
def ccol(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (bpy.data.collections[parent] if parent else bpy.context.scene.collection).children.link(c)
    return c

def wipe(c):
    for o in list(c.objects):
        me = o.data; bpy.data.objects.remove(o, do_unlink=True)
        if isinstance(me, bpy.types.Mesh) and me.users == 0 and not me.name.startswith("GK_"): bpy.data.meshes.remove(me)

def fresh(name, parent=None):
    c = ccol(name, parent); wipe(c); return c

def supersede(objs):
    c = ccol("GROVE_SUPERSEDED_BY_MARIO_PASS"); c.hide_viewport = True; c.hide_render = True
    n = 0
    for o in objs:
        if o is None or c in o.users_collection: continue
        for u in list(o.users_collection): u.objects.unlink(o)
        c.objects.link(o); n += 1
    return n

def named(*prefixes, coll=None):
    src = bpy.data.collections[coll].all_objects if coll else bpy.context.scene.objects
    return [o for o in src if o.name.startswith(prefixes)]

def inst(name, me, coll, loc, rz=0.0, sc=1.0):
    o = bpy.data.objects.new(name, me); coll.objects.link(o)
    o.location = loc; o.rotation_euler = (0, 0, rz)
    o.scale = sc if isinstance(sc, (tuple, list)) else (sc, sc, sc)
    return o

def wbb(o):
    vs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))), Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))

def slab(b, x0, y0, x1, y1, z0, z1, top, side, bottom=None):
    """Box with a different material on top, sides and underside."""
    t = bmesh.new(); bmesh.ops.create_cube(t, size=1.0)
    bmesh.ops.scale(t, vec=(x1 - x0, y1 - y0, z1 - z0), verts=t.verts[:])
    bmesh.ops.translate(t, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=t.verts[:])
    it, is_, ib = b.mi(top), b.mi(side), b.mi(bottom or side)
    t.normal_update()
    for f in t.faces:
        f.material_index = it if f.normal.z > 0.5 else ib if f.normal.z < -0.5 else is_
    b._add(t, None)

def bloom_data(n=8, petal="pink", core="yellow"):
    """The Grove signature emblem: a flat flower of radius 1 in the XZ plane, front facing -Y."""
    name = f"GK_Bloom_{petal}_{n}"
    me = bpy.data.meshes.get(name)
    if me: return me
    b = B()
    for i in range(n):
        a = tau * i / n
        b.ball(1.0, (0.62 * sin(a), 0, 0.62 * cos(a)), petal, sc=(0.3, 0.09, 0.42), u=10, v=6, rot=(0, a, 0))
    b.ball(0.3, (0, -0.06, 0), core, sc=(1, 0.45, 1), u=12, v=6)
    return b.data(name)

def bloom(b, loc, radius=1.0, face="+y", petal="pink", core="yellow", n=8):
    rot = {"+y": (0, 0, pi), "-y": (0, 0, 0), "+z": (-pi / 2, 0, 0), "+x": (0, 0, pi / 2), "-x": (0, 0, -pi / 2)}[face]
    b.mesh(bloom_data(n, petal, core), None, mtx=_M(loc, rot) @ Matrix.Scale(radius, 4))

def XZ(y0=0.0, x0=0.0, z0=0.0):
    """Maps a prism drawn in local XY onto the world XZ plane; its extrusion runs along +Y from y0."""
    return Matrix(((1, 0, 0, x0), (0, 0, 1, y0), (0, 1, 0, z0), (0, 0, 0, 1)))

def YZ(x0=0.0, y0=0.0, z0=0.0, flip=False):
    """Maps a prism drawn in local XY onto the world YZ plane (local X runs along -Y if flip); extrusion along +X from x0."""
    return Matrix(((0, 0, 1, x0), (-1 if flip else 1, 0, 0, y0), (0, 1, 0, z0), (0, 0, 0, 1)))
