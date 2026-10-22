"""Item kit helpers. One model per thing that can be bought; the same model stands in the shop, sits in the hand,
turns in the bag and is placed at home. Built with the Grove kit (gk.py) so every world shares one palette.
Nothing in this file edits the scene on import.

The standard (see claude/kingdom-design-plan.md):
  - real size, 1 unit = 1 m, front faces -Y, scale and rotation applied
  - origin: base centre on the floor (floor, table, rug, wear, pack); back centre on the wall (wall); top (hang)
  - mesh named IT_<grove id>, shared, never copied
  - colours from the palette as KI_<name>; parts the player can recolour use KV_A_<colour> / KV_B_<colour>
  - the look: fat and round, squashed and tapered, three values of each colour in clean bands (tn), cream trim, gold
    metal, one bold emblem from Kindred's own set (bloom, sprout, leaf, heart, dots, stripes, scallops)
"""
import bpy, bmesh, sys, os, math
from math import radians, sin, cos, pi, tau, sqrt
from mathutils import Vector, Matrix, Euler
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
GROVE_KIT = os.path.join(ROOT, "assets", "grove", "blender", "mario")
if GROVE_KIT not in sys.path: sys.path.insert(0, GROVE_KIT)
import gk
from gk import B, lin, text_mesh, ccol, hard_normals, XZ, YZ, wbb, _M, bloom_data
NS = bpy.app.driver_namespace
xf = _M                           # xf(loc, rot): a placement matrix, for B.mesh and B.prism
AVATAR = 1.88                      # the character's height in the game, in metres
TYPES = ("floor", "table", "wall", "hang", "rug", "wear", "pack")

# ---------------------------------------------------------------- colour
# colours the Grove table lacks
EXTRA = {"soil": "#91522E", "paper": "#FFF6E0", "kraft": "#D9A866", "cocoa": "#7A4526", "rope": "#E8C98A", "straw": "#F7D573",
         "pot": "#E8743B", "bulb": "#FFF3C2", "ink": "#3A2A4A", "choc": "#6B3A1E", "steel": "#C9CED6", "mint": "#B8F0D0",
         "peach": "#FFC09A", "butter": "#FFE48A", "lilac": "#C9B3F5", "denim": "#3F6FC2", "bread": "#F0C070", "crust": "#C97B2E",
         "wall": "#DDF3FF", "lime": "#B6E84A", "honey": "#FFB22E", "yolk": "#FFC21F", "plumfruit": "#7B4FC9", "wax": "#FFF4DC", "flame": "#FF9A2E", "berry": "#B5367A", "noodle": "#FFE08A", "broth": "#F2A93B", "rice": "#FFFBF0", "leather": "#9A5A2E"}
MATTE = {"wood", "trunk", "trunk_light", "straw", "paper", "kraft", "rope", "soil", "stone", "sand", "pot", "bread", "crust", "leather", "rice"}
GLOW = {"bulb": 3.0, "glow": 1.2, "flame": 2.5}
METAL = {"gold": 0.55, "steel": 0.7}
_DONE = set()

def hexof(name):
    return EXTRA[name] if name in EXTRA else gk.PAL[name]

def _shade(hexcol, kind):
    """The light cap and the dark foot of a colour: lighter and a little towards yellow, darker and a little towards
    violet, both still saturated. Shadows are never grey."""
    import colorsys
    h, s, v = colorsys.rgb_to_hsv(*gk.srgb(hexcol))
    def toward(h, t, k):
        d = ((t - h + 0.5) % 1.0) - 0.5
        return (h + max(-k, min(k, d))) % 1.0
    if kind == "lt": h, s, v = toward(h, 50 / 360, 0.035), s * 0.8, v + (1 - v) * 0.5
    else: h, s, v = toward(h, 265 / 360, 0.02), min(1.0, s * 1.06 + 0.02), v * 0.8
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return "#%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))

def _ensure(n, hexcol, rough, emit=0.0, metal=0.0):
    if n in _DONE: return bpy.data.materials[n]
    m = bpy.data.materials.get(n) or bpy.data.materials.new(n); m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF"); c = lin(hexcol)
    p.inputs["Base Color"].default_value = (*c, 1); m.diffuse_color = (*c, 1)
    p.inputs["Roughness"].default_value = rough; p.inputs["Metallic"].default_value = metal
    p.inputs["Emission Color"].default_value = (*c, 1); p.inputs["Emission Strength"].default_value = emit
    m["ki_hex"] = hexcol; m["ki_rough"] = rough; m["ki_metal"] = metal; _DONE.add(n); return m

def _base(name):
    """(palette name, 'lt' / 'dk' / None) of a colour name such as red_lt."""
    return (name[:-3], name[-2:]) if name.endswith(("_lt", "_dk")) else (name, None)

def M(name):
    """Palette material, named KI_<name>. <name>_lt and <name>_dk are its light cap and dark foot. Hard things are
    glossy like toys; wood, paper, straw and clay are matte."""
    base, kind = _base(name); col = hexof(base)
    return _ensure("KI_" + name, _shade(col, kind) if kind else col, 0.75 if base in MATTE else 0.32, GLOW.get(base, 0.0), METAL.get(base, 0.0))
gk.M = M          # gk.B looks colours up through gk.M

def V(channel, colour, kind=None):
    """A part the player can recolour. channel is "A" (main) or "B" (trim); colour is the palette name it shows by
    default; kind "lt" or "dk" is its light cap or dark foot. The game recolours every KV_A_* and KV_B_* material of the
    one item it is drawing (keeping the same light and dark steps), and nothing else."""
    col = hexof(colour)
    return _ensure("KV_%s_%s%s" % (channel, colour, "_" + kind if kind else ""), _shade(col, kind) if kind else col, 0.75 if colour in MATTE else 0.38)

def derive(m, kind):
    """The light or dark step of any material made here."""
    return _ensure(m.name + "_" + kind, _shade(m["ki_hex"], kind), m["ki_rough"], 0.0, m["ki_metal"])

class Tone:
    def __init__(s, main, lo, hi, tilt):
        s.main = M(main) if isinstance(main, str) else main; s.lo, s.hi, s.tilt = lo, hi, tilt
def tn(main, lo=0.24, hi=0.7, tilt=0.3):
    """Use as the material of any part: paints it in three clean bands, dark below `lo` and light above `hi` (fractions
    of the part's height; None leaves a band out). The cut leans so the light cap sits to the front."""
    return Tone(main, lo, hi, tilt)

class TB(B):
    """The builder items are drawn with: gk.B, plus tn() as a material."""
    def _add(s, t, m=None, mtx=None):
        if not isinstance(m, Tone): return super()._add(t, m, mtx)
        import gv
        if mtx is not None:
            bmesh.ops.transform(t, matrix=mtx, verts=t.verts[:])
            if mtx.to_3x3().determinant() < 0: bmesh.ops.reverse_faces(t, faces=t.faces[:])
        i0 = s.mi(m.main)
        for f in t.faces: f.material_index = i0
        cs = [v.co for v in t.verts]; z0 = min(c.z for c in cs); z1 = max(c.z for c in cs)
        cx = sum(c.x for c in cs) / len(cs); cy = sum(c.y for c in cs) / len(cs); H = max(z1 - z0, 1e-4)
        dx = max(max(c.x for c in cs) - min(c.x for c in cs), 1e-3); dy = max(max(c.y for c in cs) - min(c.y for c in cs), 1e-3)
        no = (m.tilt * 0.6 * min(1.0, H / dx), -m.tilt * min(1.0, H / dy), 1)      # the lean is a share of the part's height, so a long plank is not cut corner to corner
        if m.lo is not None: gv.band(t, (cx, cy, z0 + (z1 - z0) * m.lo), no, s.mi(derive(m.main, "dk")), above=False)
        if m.hi is not None: gv.band(t, (cx, cy, z0 + (z1 - z0) * m.hi), no, s.mi(derive(m.main, "lt")), above=True)
        super()._add(t, None, None)

# ---------------------------------------------------------------- shapes used by many items
def sub(b, fn, mtx):
    """Draw fn(builder) in its own frame, then add it to b moved by mtx. For bows, emblems and anything set at an angle."""
    sb = TB(); fn(sb); me = sb.data("_ii_sub", 50); b.mesh(me, None, mtx=mtx); bpy.data.meshes.remove(me)

def gores(b, prof, n, fm, loc=(0, 0, 0), per=3, rot=None):
    """A surface of revolution cut into n upright gores. fm(gore, ring) names the material of each face, so a lantern,
    a striped shade or a beach ball is one mesh. prof is (radius, height) from one end to the other."""
    seg = n * per; t = bmesh.new(); rings = []
    for (r, z) in prof:
        rings.append([t.verts.new((0, 0, z))] if r <= 1e-6 else [t.verts.new((r * cos(tau * i / seg), r * sin(tau * i / seg), z)) for i in range(seg)])
    for k in range(len(rings) - 1):
        p, q = rings[k], rings[k + 1]
        for i in range(seg):
            j = (i + 1) % seg
            if len(p) == 1 and len(q) == 1: continue
            f = t.faces.new((p[0], q[i], q[j])) if len(p) == 1 else t.faces.new((p[i], p[j], q[0])) if len(q) == 1 else t.faces.new((p[i], p[j], q[j], q[i]))
            f.material_index = b.mi(fm(i // per, k))
    b._add(t, None, _M(loc, rot))

def scallop(R, lobes, depth=0.14, per=6):
    """Outline of a disc with round lobes, for rosettes, rugs and trims."""
    n = lobes * per
    return [(R * (1 - depth + depth * abs(sin(lobes * pi * i / n))) * cos(tau * i / n), R * (1 - depth + depth * abs(sin(lobes * pi * i / n))) * sin(tau * i / n)) for i in range(n)]

def circle(R, n=20):
    return [(R * cos(tau * i / n), R * sin(tau * i / n)) for i in range(n)]

def heart_pts(R, n=22):
    out = []
    for i in range(n):
        t = tau * i / n; out.append((R * 16 * sin(t) ** 3 / 17, R * (13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t)) / 17 + R * 0.12))
    return out[::-1]

def leaf(b, base, L, m="leaf_light", yaw=0.0, pitch=0.5, w=0.42, th=0.1):
    """One leaf growing from `base`: yaw turns it about Z, pitch lifts its tip."""
    d = Vector((cos(pitch) * cos(yaw), cos(pitch) * sin(yaw), sin(pitch)))
    b.ball(1.0, Vector(base) + d * L / 2, m, sc=(L / 2, L * w / 2, L * th / 2 + 0.006), u=8, v=5, rot=(0, -pitch, yaw))

def sprout(b, base, s=0.1, yaw=0.0):
    """The two-leaf seedling, Kindred's own emblem. s is the length of a leaf."""
    x, y, z = base
    b.cyl(s * 0.11, s * 0.5, (x, y, z - s * 0.08), "leaf_dark", seg=6)
    leaf(b, (x, y, z + s * 0.38), s, "leaf_light", yaw, 0.6); leaf(b, (x, y, z + s * 0.38), s * 0.85, "green", yaw + pi, 0.75)

def stud(b, p, n, r, m, flat=0.35, u=8, v=5):
    """A dot, button or stud of radius r lying on a surface at p whose outward direction is n."""
    b.ball(r, p, m, sc=(1, 1, flat), u=u, v=v, rot=Vector(n).normalized().to_track_quat("Z", "Y").to_matrix())

def bow(b, m, s=1.0, tails=True, dark=None):
    """A ribbon bow about 0.46 s wide, drawn facing -Y around the origin. Place it with sub()."""
    for sg in (-1, 1):
        b.ball(1.0, (sg * 0.125 * s, -0.02 * s, 0.01 * s), m, sc=(0.115 * s, 0.045 * s, 0.08 * s), u=10, v=6, rot=(0, -sg * 0.28, 0))
        if tails: b.ball(1.0, (sg * 0.07 * s, -0.015 * s, -0.12 * s), dark or m, sc=(0.045 * s, 0.022 * s, 0.11 * s), u=8, v=5, rot=(0, sg * 0.4, 0))
    b.ball(0.055 * s, (0, -0.04 * s, 0.005 * s), m, sc=(1, 0.8, 1), u=8, v=6)

REG = {}          # grove id -> spec, filled by @item as the builder modules are imported
def item(id, label, shop, type, cells, **props):
    """Registers a builder. cells is the footprint in metres (width, depth); for a wall piece (width, height)."""
    assert type in TYPES, type
    def deco(fn):
        REG[id] = dict(id=id, label=label, shop=shop, type=type, cells=tuple(cells), build=fn, props=props); return fn
    return deco

ALIAS = {}        # grove id -> spec of an item sold under a second id in another shop: same model, never a copy
def alias(id, of, label, shop):
    ALIAS[id] = dict(id=id, of=of, label=label, shop=shop)

def kit(name, b, sharp=50):
    """Store builder b as the shared mesh `name`. Re-running rebuilds the mesh and keeps every placed instance."""
    new = b.data(name + "__new", sharp); old = bpy.data.meshes.get(name)
    if old:
        old.user_remap(new); bpy.data.meshes.remove(old)
    new.name = name; return new

def put(name, me, coll, loc=(0, 0, 0), rz=0.0):
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, me); (ccol(coll) if isinstance(coll, str) else coll).objects.link(o)
    else:
        o.data = me
    o.location = loc; o.rotation_euler = (0, 0, rz); o.scale = (1, 1, 1); return o

def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

def bounds(me):
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))

def tri_limit(spec, size):
    """2,400 for something no larger than 0.6 m, 4,500 above that, 6,000 for floor furniture of 2 x 2 m or more.
    Round things need the segments: a faceted outline reads as a prototype, not a toy."""
    if max(size) <= 0.6: return 2400
    return 6000 if spec["cells"][0] * spec["cells"][1] >= 4 and spec["type"] == "floor" else 4500

def ring(cx, cy, cz, r, n, plane="xz"):
    """Points of a circle, for a closed tube."""
    if plane == "xz": return [(cx + r * cos(tau * i / n), cy, cz + r * sin(tau * i / n)) for i in range(n)]
    return [(cx + r * cos(tau * i / n), cy + r * sin(tau * i / n), cz) for i in range(n)]

def ground(b):
    """Drop everything drawn so far so that its lowest point is on the floor. For things built at a tilt."""
    z = min(v.co.z for v in b.bm.verts); bmesh.ops.translate(b.bm, vec=(0, 0, -z), verts=b.bm.verts[:])

def report(**kw):
    NS["ii_report"] = kw; return kw
