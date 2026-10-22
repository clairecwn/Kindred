"""Soft shadow in the corners, baked into the models (ambient occlusion), as Hay Day and the Mario games have it:
the inside of a mug, the gap under a sofa, the crease where a roof meets a wall and the foot of anything that stands
on the ground are a little darker, so a model has depth even under flat light.

bake(mesh) writes a colour attribute "kk_ao" (grey, one value per vertex). For each vertex it sends rays out over
the half sphere its normal faces and counts how many hit the model itself (or the ground at z = 0, for a thing that
stands on its origin) within a reach set by the model's size; the more that hit, the darker. A light smoothing pass
keeps it soft. The exporters write it as the glTF vertex colour (export_vertex_color="NAME"), which three.js
multiplies into the material colour, so a recoloured part keeps its shadows. Glowing, flame and water faces are left
at full light."""
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from math import sqrt, cos, sin, pi

NAME = "kk_ao"
GOLD = 2.399963                                   # the golden angle: an even spread of directions
def _dirs(n=28):
    out = []
    for i in range(n):
        u = (i + 0.5) / n; r = sqrt(u); a = GOLD * i
        out.append(Vector((r * cos(a), r * sin(a), sqrt(max(0.0, 1 - u)))))   # cosine weighted, around +Z
    return out
DIRS = _dirs()
BRIGHT = ("glow", "flame", "water", "Water", "sky", "eye", "nose")   # faces that keep full light

def bake(me, reach=None, strength=0.5, ground=None, floor=0.55, smooth=2):
    if len(me.vertices) == 0: return 0
    vs = [v.co.copy() for v in me.vertices]
    lo = Vector([min(v[i] for v in vs) for i in range(3)]); hi = Vector([max(v[i] for v in vs) for i in range(3)])
    size = (hi - lo).length
    reach = reach or max(0.04, min(0.7, size * 0.22))
    if ground is None: ground = abs(lo.z) < 0.03                     # stands on its origin: the ground shadows its foot
    bvh = BVHTree.FromPolygons(vs, [tuple(p.vertices) for p in me.polygons])
    bright = set()
    for p in me.polygons:
        m = me.materials[p.material_index] if p.material_index < len(me.materials) else None
        if m and any(k in m.name for k in BRIGHT): bright.update(p.vertices)
    val = [1.0] * len(vs)
    for i, v in enumerate(me.vertices):
        if i in bright: continue
        n = v.normal
        if n.length < 0.5: continue
        t = n.to_track_quat("Z", "Y").to_matrix()
        o = v.co + n * (reach * 0.02 + 0.0015)
        hit = 0.0
        for d0 in DIRS:
            d = t @ d0
            h = bvh.ray_cast(o, d, reach)
            if h[0] is not None: hit += 1.0 - 0.5 * (h[3] / reach)        # near walls shade more than far ones
            elif ground and d.z < -1e-3 and o.z > -0.01:
                tg = -o.z / d.z
                if tg < reach: hit += 1.0 - 0.5 * tg / reach
        occ = hit / len(DIRS)
        val[i] = max(floor, 1.0 - strength * occ)
    # soften: average with neighbours along edges
    nb = [[] for _ in vs]
    for e in me.edges:
        a, b = e.vertices; nb[a].append(b); nb[b].append(a)
    for _ in range(smooth):
        val = [val[i] if i in bright or not nb[i] else 0.5 * val[i] + 0.5 * sum(val[j] for j in nb[i]) / len(nb[i]) for i in range(len(vs))]
    at = me.color_attributes.get(NAME) or me.color_attributes.new(NAME, "BYTE_COLOR", "POINT")
    for i, x in enumerate(val):
        y = x ** 2.2                                     # the value is how dark it should look; the attribute is linear
        at.data[i].color = (y, y, y, 1.0)
    return len(vs)

def bake_all(meshes, **kw):
    done, n = 0, 0
    for me in meshes:
        if me is None or me.users == 0: continue
        n += bake(me, **kw); done += 1
    return {"meshes": done, "verts": n}

EXPORT = dict(export_vertex_color="NAME", export_vertex_color_name=NAME)
