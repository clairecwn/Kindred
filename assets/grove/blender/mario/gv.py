"""Vegetation shapes. A crown, bush or cloud used to be a pile of low-poly balls pushed into each other: polygonal
outlines, hard creases where the balls met, and triangles wasted inside the pile. weld() turns the same balls into one
closed, evenly meshed, smooth surface with a triangle count we choose; band() then paints clean scalloped colour bands
across it by cutting the surface with a plane, the way stylised trees are shaded (dark underside, light cap)."""
import bpy, bmesh, math
from mathutils import Vector
from gk import *

def weld(blobs, tris, voxel=0.07, relax=4, seg=(28, 18)):
    """blobs: [(centre, radius, (sx, sy, sz))]. Returns a bmesh: the union of the blobs as one surface of about `tris` triangles."""
    t = bmesh.new()
    for c, r, sc in blobs:
        ret = bmesh.ops.create_uvsphere(t, u_segments=seg[0], v_segments=seg[1], radius=r)
        bmesh.ops.scale(t, vec=Vector(sc), verts=ret["verts"]); bmesh.ops.translate(t, vec=Vector(c), verts=ret["verts"])
    me = bpy.data.meshes.new("_weld"); t.to_mesh(me); t.free()
    ob = bpy.data.objects.new("_weld", me); bpy.context.scene.collection.objects.link(ob)
    md = ob.modifiers.new("r", "REMESH"); md.mode = "VOXEL"; md.voxel_size = voxel; md.adaptivity = 0
    bpy.context.view_layer.update()
    m2 = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    ob.modifiers.remove(md)
    bm = bmesh.new(); bm.from_mesh(m2)
    for _ in range(relax): bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:]); n = len(bm.faces); bm.to_mesh(m2); bm.free()
    ob.data = m2; md = ob.modifiers.new("d", "DECIMATE"); md.ratio = min(1.0, tris / max(n, 1))
    bpy.context.view_layer.update()
    m3 = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    out = bmesh.new(); out.from_mesh(m3)
    bpy.data.objects.remove(ob)
    for m in (me, m2, m3): bpy.data.meshes.remove(m)
    return out

def band(bm, co, no, index, above=True):
    """Cut the surface with a plane and give everything on one side of it a material index. The cut follows the lobes
    of the crown, which is what makes the scalloped edge."""
    co, no = Vector(co), Vector(no).normalized()
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=co, plane_no=no)
    for f in bm.faces:
        d = (f.calc_center_median() - co).dot(no)
        if (d > 0) == above: f.material_index = index

def crown(b, blobs, tris, main, dark=None, light=None, lo=None, hi=None, voxel=0.07, mtx=None):
    """Adds a welded crown to builder b. lo / hi: (height, tilt) of the planes below which it is `dark` and above which
    it is `light`; tilt leans the cut so the light cap sits towards the front and the sun."""
    bm = weld(blobs, tris, voxel)
    i0 = b.mi(main)
    for f in bm.faces: f.material_index = i0
    if dark and lo: band(bm, (0, 0, lo[0]), (lo[1] * 0.6, -lo[1], 1), b.mi(dark), above=False)
    if light and hi: band(bm, (0, 0, hi[0]), (hi[1] * 0.6, -hi[1], 1), b.mi(light), above=True)
    b._add(bm, None, mtx)

def dot(b, loc, r, m, squash=1.0, rot=None):
    """A small round fruit or blossom: enough segments to stay round at this size."""
    b.ball(r, loc, m, sc=(1, 1, squash), u=8, v=4, rot=rot)
