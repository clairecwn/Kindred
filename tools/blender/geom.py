"""geom.py — small bmesh helpers for building chunky mascot bodies.

Everything here works in THREE-space (Y up, +Z forward) and is converted
to Blender's Z-up at object-creation time, so the numbers in
build_characters.py can be read side by side with src/avatar/*.js.
"""

import math
import bmesh
import bpy
from mathutils import Vector

from rig import to_blender


def _v(p):
    return Vector(to_blender(p))


def new_mesh(name):
    me = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj


def finish(bm, name):
    obj = new_mesh(name)
    bm.to_mesh(obj.data)
    bm.free()
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def ellipsoid(name, center, radii, segs=24, rings=16):
    """A smooth ellipsoid. center/radii in three-space (x, y, z)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts:
        v.co.x *= radii[0]
        v.co.y *= radii[2]   # blender Y == three -Z; magnitude only
        v.co.z *= radii[1]
        v.co += _v(center)
    return finish(bm, name)


def loft(name, rings, close_start=True, close_end=True, segs=20):
    """Loft a watertight tube through a list of elliptical cross-sections.

    rings: list of (center(x,y,z), rx, rz). The ends are closed with flat
    n-gon caps — watertight is the only thing that matters here, because
    every body part is voxel-fused afterwards and the fuse pass is what
    rounds the joins. An open-ended tube makes the fuse produce shards.
    """
    bm = bmesh.new()
    loops = []
    for (c, rx, rz) in rings:
        loop = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            p = (c[0] + math.cos(a) * max(rx, 1e-4), c[1], c[2] + math.sin(a) * max(rz, 1e-4))
            loop.append(bm.verts.new(_v(p)))
        loops.append(loop)
    for i in range(len(loops) - 1):
        a, b = loops[i], loops[i + 1]
        for j in range(segs):
            k = (j + 1) % segs
            try:
                bm.faces.new([a[j], a[k], b[k], b[j]])
            except ValueError:
                pass
    if close_start:
        try:
            bm.faces.new(list(reversed(loops[0])))
        except ValueError:
            pass
    if close_end:
        try:
            bm.faces.new(loops[-1])
        except ValueError:
            pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name)



def tube(name, path, segs=18, cap=True, roll=None):
    """A watertight tube swept along an arbitrary 3D path.

    path: list of (point(x,y,z), ra, rb) where ra/rb are the ellipse radii
    in the two directions perpendicular to the local tangent. Frames are
    parallel-transported so a tail that curls backwards or an ear that
    sweeps outwards gets real round cross-sections instead of the
    horizontally-sliced sheared mess a fixed-plane loft produces.
    """
    pts = [Vector(p) for (p, _a, _b) in path]
    n = len(pts)
    tangents = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tangents.append(t.normalized() if t.length > 1e-6 else Vector((0, 1, 0)))

    ref = Vector((1, 0, 0))
    if abs(tangents[0].dot(ref)) > 0.9:
        ref = Vector((0, 0, 1))
    frames = []
    up = (ref - tangents[0] * ref.dot(tangents[0])).normalized()
    for i in range(n):
        t = tangents[i]
        up = (up - t * up.dot(t))
        up = up.normalized() if up.length > 1e-6 else Vector((0, 0, 1))
        side = t.cross(up).normalized()
        frames.append((up, side))

    bm = bmesh.new()
    loops = []
    for i, (pt, ra, rb) in enumerate(path):
        up, side = frames[i]
        c = Vector(pt)
        loop = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            q = c + up * (math.cos(a) * max(ra, 1e-4)) + side * (math.sin(a) * max(rb, 1e-4))
            loop.append(bm.verts.new(_v((q.x, q.y, q.z))))
        loops.append(loop)
    for i in range(n - 1):
        a, b = loops[i], loops[i + 1]
        for j in range(segs):
            k = (j + 1) % segs
            try:
                bm.faces.new([a[j], a[k], b[k], b[j]])
            except ValueError:
                pass
    if cap:
        for lp, rev in ((loops[0], True), (loops[-1], False)):
            try:
                bm.faces.new(list(reversed(lp)) if rev else lp)
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name)


def cone(name, base, tip, rx, rz, segs=16):
    """A tapered cone swept along base->tip (ears, quills)."""
    b, t = Vector(base), Vector(tip)
    return tube(name, [(tuple(b), rx, rz),
                       (tuple(b.lerp(t, 0.55)), rx * 0.58, rz * 0.58),
                       (tuple(b.lerp(t, 0.88)), rx * 0.20, rz * 0.20),
                       (tuple(t), rx * 0.06, rz * 0.06)], segs=segs)


def _cone_unused(name, base, tip, rx, rz, segs=16):
    return loft(name, [(base, rx, rz),
                       (tuple(base[i] + (tip[i] - base[i]) * 0.6 for i in range(3)), rx * 0.55, rz * 0.55),
                       (tuple(base[i] + (tip[i] - base[i]) * 0.92 for i in range(3)), rx * 0.14, rz * 0.14),
                       (tip, rx * 0.05, rz * 0.05)],
                close_start=True, close_end=True, segs=segs)


def rounded_box(name, center, size, bevel=0.03):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[2]
        v.co.z *= size[1]
    bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                    offset=bevel, segments=3, affect="VERTICES", profile=0.5)
    for v in bm.verts:
        v.co += _v(center)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name)


def join(objects, name):
    """Join a list of objects into the first one and rename it."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name + "_mesh"
    return obj


def fuse(obj, voxel=0.012, target_tris=None):
    """Voxel-remesh an assembly of overlapping parts into ONE continuous
    surface. This is the single most important step for the silhouette:
    separate spheres pushed through each other read as 'a pile of blobs',
    while a remeshed union reads as one moulded character with soft
    fillets at every joint."""
    m = obj.modifiers.new("Remesh", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = voxel
    m.adaptivity = 0.0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=m.name)
    # Smooth BEFORE decimating: voxel remesh leaves fine stair-stepping,
    # and decimating first bakes that noise into the low-poly normals,
    # which is what makes a toon shader break the body into blotches.
    sm = obj.modifiers.new("Smooth", "SMOOTH")
    sm.factor = 0.45
    sm.iterations = 4
    bpy.ops.object.modifier_apply(modifier=sm.name)
    if target_tris:
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        if tris > target_tris:
            d = obj.modifiers.new("Decimate", "DECIMATE")
            d.ratio = max(0.02, target_tris / float(tris))
            bpy.ops.object.modifier_apply(modifier=d.name)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)
