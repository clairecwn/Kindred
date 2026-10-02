"""Shared Blender helpers for Kindred environment kit authoring.

Run headless via the `bpy` python module (Blender 5.x as a library), not
through the Blender GUI:  python3 tools/blender/env_kit.py

Doctrine (Design Bible s2/s10): chunky silhouette-first forms, rounded
edges (bevel everywhere), hand-painted warmth via VERTEX COLOURS only —
no textures, no image files. The runtime re-materialises every mesh with
one shared toon material reading those vertex colours, so the whole kit
costs a handful of draw calls.
"""
import bpy, bmesh, math, os
from mathutils import Vector, Euler

# ── Palette ────────────────────────────────────────────────────────────
# Warm, low-saturation, Nintendo-adjacent. Never pure white or black.
P = {
    "wood":        (0.66, 0.46, 0.29),
    "wood_dark":   (0.48, 0.32, 0.20),
    "wood_light":  (0.79, 0.61, 0.39),
    "leaf":        (0.45, 0.69, 0.35),
    "leaf_dark":   (0.33, 0.56, 0.29),
    "leaf_warm":   (0.58, 0.76, 0.41),
    "leaf_gold":   (0.83, 0.70, 0.33),
    "stone":       (0.85, 0.79, 0.67),
    "stone_dark":  (0.72, 0.64, 0.53),
    "clay":        (0.77, 0.45, 0.29),
    "cream":       (0.95, 0.89, 0.78),
    "sage":        (0.56, 0.72, 0.60),
    "teal":        (0.36, 0.61, 0.54),
    "gold":        (0.85, 0.66, 0.31),
    "lilac":       (0.66, 0.55, 0.82),
    "rose":        (0.85, 0.54, 0.60),
    "glass":       (0.75, 0.88, 0.89),
    "glow":        (1.00, 0.85, 0.54),
    "roof_terra":  (0.77, 0.40, 0.25),
    "roof_teal":   (0.31, 0.55, 0.52),
    "roof_plum":   (0.54, 0.42, 0.61),
    "roof_moss":   (0.40, 0.53, 0.36),
    "fabric_rose": (0.88, 0.62, 0.61),
    "fabric_gold": (0.90, 0.76, 0.45),
    "fabric_sage": (0.62, 0.76, 0.64),
    "soil":        (0.42, 0.31, 0.23),
    "water":       (0.51, 0.78, 0.80),
    "sand":        (0.90, 0.82, 0.64),
}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _mesh_objects():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def paint(obj, color):
    """Assign one flat vertex colour to every loop of `obj`."""
    me = obj.data
    if not me.color_attributes:
        me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    ca = me.color_attributes[0]
    r, g, b = color
    for i in range(len(ca.data)):
        ca.data[i].color = (r, g, b, 1.0)
    return obj


def bevel(obj, width=0.02, segments=2, angle=40):
    m = obj.modifiers.new("bev", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    return obj


def _apply_mods(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception:
            obj.modifiers.remove(m)


def box(size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), color="wood", bev=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(scale=True)
    if bev:
        bevel(o, bev)
    return paint(o, P[color])


def cyl(r=0.5, h=1.0, loc=(0, 0, 0), rot=(0, 0, 0), verts=12, color="wood", bev=0.02, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.object
    if bev:
        bevel(o, bev)
    return paint(o, P[color])


def cone(r=0.5, h=1.0, loc=(0, 0, 0), rot=(0, 0, 0), verts=8, color="leaf", bev=0.02):
    bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=0, depth=h, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.object
    if bev:
        bevel(o, bev)
    return paint(o, P[color])


def blob(r=0.5, loc=(0, 0, 0), color="leaf", sub=1, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=sub + 1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return paint(o, P[color])


def sphere(r=0.5, loc=(0, 0, 0), color="leaf", segs=12, rings=8, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=segs, ring_count=rings, location=loc)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return paint(o, P[color])


def wedge(size=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0), color="roof_terra", bev=0.02):
    """A pitched-roof prism: a box whose +Z edge is collapsed to a ridge."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for v in bm.verts:
        if v.co.z > 0:
            v.co.x = 0.0
    bm.to_mesh(o.data)
    bm.free()
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.location = loc
    o.rotation_euler = Euler(rot)
    if bev:
        bevel(o, bev)
    return paint(o, P[color])


def torus(r=0.5, minor=0.06, loc=(0, 0, 0), rot=(0, 0, 0), color="wood", major_segs=16, minor_segs=6):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, location=loc,
                                     rotation=rot, major_segments=major_segs, minor_segments=minor_segs)
    return paint(bpy.context.object, P[color])


def arc(r=0.5, minor=0.08, loc=(0, 0, 0), rot=(0, 0, 0), color="wood", segs=14):
    """Half-torus (a lintel / bridge rail)."""
    o = torus(r, minor, (0, 0, 0), (0, 0, 0), color, segs * 2, 6)
    bm = bmesh.new(); bm.from_mesh(o.data)
    doomed = [v for v in bm.verts if v.co.z < -0.001]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(o.data); bm.free()
    o.location = loc
    o.rotation_euler = Euler(rot)
    return o


def finish(name, objs, origin_to_base=True, center_xy=True):
    """Join `objs` into one mesh named `name` (modifiers applied), then move
    its geometry so the footprint is centred on X/Y and its base sits at
    z=0 — the runtime can then place a kit piece at ground level without
    per-asset fudge factors."""
    for o in objs:
        _apply_mods(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vs = [v.co for v in obj.data.vertices]
    if vs:
        dx = (max(v.x for v in vs) + min(v.x for v in vs)) / 2 if center_xy else 0.0
        dy = (max(v.y for v in vs) + min(v.y for v in vs)) / 2 if center_xy else 0.0
        dz = min(v.z for v in vs) if origin_to_base else 0.0
        for v in obj.data.vertices:
            v.co.x -= dx; v.co.y -= dy; v.co.z -= dz
    bpy.ops.object.shade_flat()
    return obj


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_vertex_color="MATERIAL",
        export_normals=False,
        export_texcoords=False,
        export_skins=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    print("exported", path, os.path.getsize(path), "bytes")


def base_material():
    """One shared vertex-colour material so the GLB carries a single
    material and the runtime swap is trivial."""
    m = bpy.data.materials.new("kindred_vcol")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    return m


def assign_shared_material():
    m = base_material()
    for o in _mesh_objects():
        o.data.materials.clear()
        o.data.materials.append(m)
