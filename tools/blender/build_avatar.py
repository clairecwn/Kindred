"""
build_avatar.py — procedural Blender script that generates a Grove base
character (body mesh + armature + accessory sockets) from parameters, and
exports it to glTF for Three.js.

Run headless, e.g.:
    blender --background --python tools/blender/build_avatar.py -- \
        --archetype fox --out /path/to/out/fox.glb

Performance rules followed throughout (see docs/grove/CHARACTER-BIBLE.md
section 7 — this is the specific fix for Claire's known per-object bpy.ops
slowdown on large scenes):
  - Mesh geometry is built with bmesh and written directly into
    bpy.data.meshes / bpy.data.objects, never via bpy.ops.mesh.primitive_*
    called once per body part.
  - The armature is built by creating EditBones directly on
    armature.edit_bones inside a single edit-mode session, never by
    entering edit mode once per bone.
  - The one interactive op this script cannot avoid — the automatic-weight
    parent (Blender has no data-API heat-map solver) — is called exactly
    once for the whole mesh, not once per body part.
  - bpy.context.view_layer.update() is called once per build stage, not
    inside any loop.

This script has no dependency on being run inside real Blender to be
syntax-checked (`python3 -m py_compile`), but every bpy call assumes the
Blender 3.x/4.x Python API and will only actually run inside Blender.
"""

import argparse
import sys

try:
    import bpy
    import bmesh
    from mathutils import Vector
    IN_BLENDER = True
except ImportError:  # allow py_compile / static checks outside Blender
    bpy = None
    bmesh = None
    Vector = None
    IN_BLENDER = False


# ── Rig specification (CHARACTER-BIBLE.md section 5) ────────────────────
# (name, parent, head_offset, tail_offset) in local space relative to parent
# head. Deform bones only; control bones (IK targets, poles) are appended
# separately since they carry no vertex weights.
DEFORM_BONES = [
    ("Hips", None, (0.0, 0.0, 1.00), (0.0, 0.0, 1.08)),
    ("Spine_01", "Hips", (0.0, 0.0, 1.08), (0.0, 0.0, 1.20)),
    ("Spine_02", "Spine_01", (0.0, 0.0, 1.20), (0.0, 0.0, 1.34)),
    ("Neck", "Spine_02", (0.0, 0.0, 1.34), (0.0, 0.0, 1.40)),
    ("Head", "Neck", (0.0, 0.0, 1.40), (0.0, 0.0, 1.60)),
    ("Back", "Spine_02", (0.0, -0.06, 1.30), (0.0, -0.14, 1.28)),

    ("Shoulder_L", "Spine_02", (0.14, 0.0, 1.32), (0.22, 0.0, 1.32)),
    ("UpperArm_L", "Shoulder_L", (0.22, 0.0, 1.32), (0.24, 0.0, 1.14)),
    ("LowerArm_L", "UpperArm_L", (0.24, 0.0, 1.14), (0.25, 0.0, 0.98)),
    ("Hand_L", "LowerArm_L", (0.25, 0.0, 0.98), (0.25, 0.0, 0.90)),

    ("Shoulder_R", "Spine_02", (-0.14, 0.0, 1.32), (-0.22, 0.0, 1.32)),
    ("UpperArm_R", "Shoulder_R", (-0.22, 0.0, 1.32), (-0.24, 0.0, 1.14)),
    ("LowerArm_R", "UpperArm_R", (-0.24, 0.0, 1.14), (-0.25, 0.0, 0.98)),
    ("Hand_R", "LowerArm_R", (-0.25, 0.0, 0.98), (-0.25, 0.0, 0.90)),

    ("Thigh_L", "Hips", (0.10, 0.0, 1.00), (0.11, 0.0, 0.56)),
    ("Shin_L", "Thigh_L", (0.11, 0.0, 0.56), (0.11, 0.0, 0.14)),
    ("Foot_L", "Shin_L", (0.11, 0.0, 0.14), (0.11, 0.08, 0.0)),

    ("Thigh_R", "Hips", (-0.10, 0.0, 1.00), (-0.11, 0.0, 0.56)),
    ("Shin_R", "Thigh_R", (-0.11, 0.0, 0.56), (-0.11, 0.0, 0.14)),
    ("Foot_R", "Shin_R", (-0.11, 0.0, 0.14), (-0.11, 0.08, 0.0)),

    ("Tail_01", "Hips", (0.0, -0.12, 0.98), (0.0, -0.28, 1.02)),
    ("Tail_02", "Tail_01", (0.0, -0.28, 1.02), (0.0, -0.42, 1.02)),
]

# Control-only bones: not weighted, animation aid only (IK targets/poles).
CONTROL_BONES = [
    ("IK_Hand_L", None, (0.25, 0.0, 0.90), (0.25, 0.0, 0.82)),
    ("IK_Hand_R", None, (-0.25, 0.0, 0.90), (-0.25, 0.0, 0.82)),
    ("IK_Foot_L", None, (0.11, 0.08, 0.0), (0.11, 0.08, -0.08)),
    ("IK_Foot_R", None, (-0.11, 0.08, 0.0), (-0.11, 0.08, -0.08)),
    ("Pole_Elbow_L", None, (0.24, 0.40, 1.06), (0.24, 0.40, 0.98)),
    ("Pole_Elbow_R", None, (-0.24, 0.40, 1.06), (-0.24, 0.40, 0.98)),
    ("Pole_Knee_L", None, (0.11, -0.40, 0.35), (0.11, -0.40, 0.27)),
    ("Pole_Knee_R", None, (-0.11, -0.40, 0.35), (-0.11, -0.40, 0.27)),
]

# Socket empties: (name, parent_bone). SOCKET_aura parents to Root, all
# others to their matching deform bone.
SOCKETS = [
    ("SOCKET_head", "Head"),
    ("SOCKET_face", "Head"),
    ("SOCKET_back", "Back"),
    ("SOCKET_hand_L", "Hand_L"),
    ("SOCKET_hand_R", "Hand_R"),
    ("SOCKET_foot_L", "Foot_L"),
    ("SOCKET_foot_R", "Foot_R"),
    ("SOCKET_aura", None),  # parented to Root
]

# Per-archetype silhouette parameters (CHARACTER-BIBLE.md section 2).
# These scale/offset the shared body-part primitives; they do not change
# topology, keeping every archetype cheap to weight-paint identically.
ARCHETYPE_PARAMS = {
    "fox": dict(head_scale=(1.00, 1.02, 0.98), ear="triangle", tail_len=0.55, body_width=1.00),
    "rabbit": dict(head_scale=(0.96, 1.00, 0.96), ear="long", tail_len=0.12, body_width=0.94),
    "bear": dict(head_scale=(1.10, 1.05, 1.05), ear="round_small", tail_len=0.10, body_width=1.18),
    "cat": dict(head_scale=(0.94, 0.98, 0.94), ear="sharp", tail_len=0.62, body_width=0.88),
    "dog": dict(head_scale=(1.02, 1.00, 1.00), ear="floppy", tail_len=0.30, body_width=1.02),
    "panda": dict(head_scale=(1.08, 1.04, 1.04), ear="round", tail_len=0.08, body_width=1.10),
    "otter": dict(head_scale=(0.98, 0.96, 1.00), ear="round_wide", tail_len=0.48, body_width=1.05),
    "hedgehog": dict(head_scale=(0.92, 0.94, 0.92), ear="round_small", tail_len=0.05, body_width=0.90),
}

STANDING_HEIGHT = 1.6  # world units, CHARACTER-BIBLE.md section 1
HEAD_TO_BODY_RATIO = 1.0 / 2.6


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    p = argparse.ArgumentParser(description="Build a Grove base avatar and export to glTF.")
    p.add_argument("--archetype", default="fox", choices=sorted(ARCHETYPE_PARAMS.keys()))
    p.add_argument("--out", default=None, help="Output .glb path")
    p.add_argument(
        "--preview", default=None,
        help="Optional PNG path: render a fast flat-shaded preview with "
             "Workbench (never EEVEE) after building, see render_preview().",
    )
    return p.parse_args(argv)


def render_preview(out_png, objects):
    """
    Fast flat-shaded preview render using Workbench, per
    CHARACTER-BIBLE.md section 7 point 2: headless EEVEE renders of
    emissive/glow materials (aura previews) are slow and inconsistent
    across GPU drivers, which is the specific timeout this pipeline
    avoids. Workbench never evaluates emission nodes at all, so it is
    always fast and deterministic for iteration; treat the actual
    exported .glb loaded in Three.js as the source of truth for what an
    emissive aura material really looks like (that is the engine that
    renders it in production), not this preview.
    """
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.filepath = out_png

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = (0, -3.2, 0.9)
    cam_obj.rotation_euler = (1.4, 0, 0)
    scene.camera = cam_obj

    bpy.ops.render.render(write_still=True)  # one batched call, whole scene


def reset_scene():
    """Clear the default scene without per-object bpy.ops calls: unlink and
    remove data blocks directly."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for arm in list(bpy.data.armatures):
        if arm.users == 0:
            bpy.data.armatures.remove(arm)


def build_body_mesh(name, params):
    """
    Build the base body mesh with bmesh (head, torso, arms, legs, ears,
    tail as one merged mesh) instead of separate bpy.ops.mesh.primitive_*
    objects merged afterward — one bmesh, one bpy.data.meshes entry, one
    bpy.data.objects entry.
    """
    bm = bmesh.new()

    body_w = params["body_width"]

    # Torso (rounded box via a subdivided cube + smoothing, all through
    # bmesh ops batched once).
    torso = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(
        bm,
        vec=(0.28 * body_w, 0.20 * body_w, 0.34),
        verts=torso["verts"],
    )
    bmesh.ops.translate(bm, vec=(0, 0, 1.10), verts=torso["verts"])

    # Head
    head_scale = params["head_scale"]
    head_radius = STANDING_HEIGHT * HEAD_TO_BODY_RATIO * 0.5
    head = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=head_radius)
    bmesh.ops.scale(bm, vec=head_scale, verts=head["verts"])
    bmesh.ops.translate(bm, vec=(0, 0, 1.42), verts=head["verts"])

    # Arms (two capsule-like cylinders)
    for side in (1, -1):
        arm = bmesh.ops.create_cone(
            bm, cap_ends=True, segments=10, radius1=0.055, radius2=0.05, depth=0.34
        )
        bmesh.ops.rotate(
            bm, verts=arm["verts"], cent=(0, 0, 0),
            matrix=_rot_x(1.5708),
        )
        bmesh.ops.translate(bm, vec=(side * 0.24, 0, 1.14), verts=arm["verts"])

    # Legs
    for side in (1, -1):
        leg = bmesh.ops.create_cone(
            bm, cap_ends=True, segments=10, radius1=0.07, radius2=0.065, depth=0.5
        )
        bmesh.ops.rotate(
            bm, verts=leg["verts"], cent=(0, 0, 0),
            matrix=_rot_x(1.5708),
        )
        bmesh.ops.translate(bm, vec=(side * 0.11, 0, 0.45), verts=leg["verts"])

    # Tail (skipped for near-zero tail_len archetypes)
    if params["tail_len"] > 0.08:
        tail = bmesh.ops.create_cone(
            bm, cap_ends=True, segments=8, radius1=0.06, radius2=0.02,
            depth=params["tail_len"],
        )
        bmesh.ops.rotate(bm, verts=tail["verts"], cent=(0, 0, 0), matrix=_rot_x(1.2))
        bmesh.ops.translate(bm, vec=(0, -0.14 - params["tail_len"] * 0.3, 1.0), verts=tail["verts"])

    # One remove-doubles pass across the whole mesh, not per part.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _rot_x(angle):
    import mathutils
    return mathutils.Matrix.Rotation(angle, 4, "X")


def assign_material_slots(obj):
    """
    Create the four tintable material slots named per wardrobe.js's
    MATERIAL_SLOTS convention (mat_skin, mat_skin_shadow, mat_trim,
    mat_main), assigned once via bpy.data.materials rather than per-face
    interactive assignment.
    """
    names = ["mat_skin", "mat_skin_shadow", "mat_trim", "mat_main"]
    for n in names:
        mat = bpy.data.materials.get(n) or bpy.data.materials.new(n)
        mat.use_nodes = True
        obj.data.materials.append(mat)
    # Whole mesh defaults to mat_skin (slot 0); trims/mains get assigned
    # per archetype's clothing geometry in build_wardrobe.py instead of
    # here, since the base body is bare skin/fur.


def build_armature(name):
    """
    Build the full deform + control bone hierarchy directly on
    armature.edit_bones inside ONE edit-mode session — never re-entering
    edit mode per bone, per the section 7 performance rule.
    """
    arm_data = bpy.data.armatures.new(f"{name}_armature")
    arm_obj = bpy.data.objects.new(f"{name}_rig", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")

    edit_bones = arm_data.edit_bones

    # Root first (control-only ground anchor).
    root = edit_bones.new("Root")
    root.head = Vector((0, 0, 0))
    root.tail = Vector((0, 0, 0.1))

    created = {"Root": root}

    def make_bone(bone_name, parent_name, head, tail):
        b = edit_bones.new(bone_name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        parent = created.get(parent_name) if parent_name else root
        b.parent = parent
        b.use_connect = False
        created[bone_name] = b
        return b

    for bone_name, parent_name, head, tail in DEFORM_BONES:
        make_bone(bone_name, parent_name, head, tail)

    for bone_name, parent_name, head, tail in CONTROL_BONES:
        make_bone(bone_name, parent_name, head, tail)

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()  # one call, end of build stage
    return arm_obj


def build_sockets(arm_obj):
    """
    Create SOCKET_* empties parented to their matching bone via bone
    parenting, built directly with bpy.data.objects.new rather than
    bpy.ops.object.empty_add called once per socket.
    """
    socket_objs = []
    for socket_name, bone_name in SOCKETS:
        empty = bpy.data.objects.new(socket_name, None)
        empty.empty_display_size = 0.05
        bpy.context.scene.collection.objects.link(empty)
        if bone_name:
            empty.parent = arm_obj
            empty.parent_type = "BONE"
            empty.parent_bone = bone_name
        else:
            empty.parent = arm_obj
            empty.parent_type = "OBJECT"
        socket_objs.append(empty)
    return socket_objs


def parent_with_automatic_weights(mesh_obj, arm_obj):
    """
    The one interactive bpy.ops call this pipeline keeps, because Blender
    has no data-API equivalent for the heat-map weight solver. Called
    exactly once for the whole mesh (not per body part, not per vertex
    group) — this is the direct fix for the per-object bpy.ops slowdown
    described in the task brief.
    """
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    # Cap influences at 4 per vertex to match glTF's JOINTS_0/WEIGHTS_0
    # format exactly (section 5), one batched call for the whole mesh.
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.mode_set(mode="OBJECT")


def export_gltf(out_path, objects):
    """One export call for the whole archetype file, not one per object."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=True,
        export_skins=True,
        export_yup=True,
    )


def main():
    args = parse_args()
    if not IN_BLENDER:
        print("build_avatar.py: not running inside Blender; syntax-only check mode.")
        return

    params = ARCHETYPE_PARAMS[args.archetype]
    reset_scene()

    mesh_obj = build_body_mesh(args.archetype, params)
    assign_material_slots(mesh_obj)

    arm_obj = build_armature(args.archetype)
    sockets = build_sockets(arm_obj)

    parent_with_automatic_weights(mesh_obj, arm_obj)

    out_path = args.out or f"/tmp/{args.archetype}.glb"
    export_gltf(out_path, [mesh_obj, arm_obj, *sockets])
    print(f"build_avatar.py: exported {args.archetype} -> {out_path}")

    if args.preview:
        render_preview(args.preview, [mesh_obj, arm_obj, *sockets])
        print(f"build_avatar.py: wrote Workbench preview -> {args.preview}")


if __name__ == "__main__":
    main()
