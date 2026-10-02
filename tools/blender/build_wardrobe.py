"""
build_wardrobe.py — procedural Blender script that generates Grove
wardrobe item meshes and socket-aligned attachments, exporting each as its
own glTF for AvatarRig.js to load at runtime.

Run headless, e.g.:
    blender --background --python tools/blender/build_wardrobe.py -- \
        --item beanie --out /path/to/out/wardrobe/head_beanie.glb

    # or build every item in src/grove/avatar/wardrobe.js's catalogue:
    blender --background --python tools/blender/build_wardrobe.py -- \
        --all --out-dir /path/to/out/wardrobe

Mirrors the performance discipline in build_avatar.py (see
docs/grove/CHARACTER-BIBLE.md section 7): bmesh + direct data-API mesh
construction, one batched export call per item rather than per sub-part,
no per-object interactive bpy.ops in a loop.

Item ids and slot/tier/tint metadata here intentionally mirror
src/grove/avatar/wardrobe.js's WARDROBE_ITEMS so the two stay in sync;
this file does not import that one (Blender's Python has no access to the
project's JS files), so any change to the catalogue must be mirrored by
hand in both places.
"""

import argparse
import sys

try:
    import bpy
    import bmesh
    from mathutils import Matrix
    IN_BLENDER = True
except ImportError:
    bpy = None
    bmesh = None
    Matrix = None
    IN_BLENDER = False


# ── Wardrobe catalogue (mirrors src/grove/avatar/wardrobe.js) ─────────
# Each entry: model_id -> (slot, attach_mode, build_fn_key, tintable)
# attach_mode: "rigid" (parent to socket empty) or "deform" (skinned to
# the base archetype's armature — body-slot items only).
WARDROBE_CATALOGUE = {
    # Common tier
    "body_hoodie": ("body", "deform", "garment_torso", True),
    "body_linen": ("body", "deform", "garment_torso", True),
    "body_overalls": ("body", "deform", "garment_torso", True),
    "head_beanie": ("head", "rigid", "hat_dome", True),
    "head_felt_hat": ("head", "rigid", "hat_brimmed", True),
    "face_round_glasses": ("face", "rigid", "glasses", True),
    "feet_sneakers": ("feet", "rigid", "shoe", True),
    "feet_sandals": ("feet", "rigid", "shoe", True),
    "back_scarf": ("back", "rigid", "scarf", True),
    "back_heart_pin": ("back", "rigid", "pin", False),
    "back_satchel": ("back", "rigid", "bag", True),
    "face_blush_markings": ("face", "rigid", "decal", False),
    "body_spot_markings": ("body", "deform", "decal", False),
    "body_soft_fur": ("body", "deform", "decal", False),
    "back_plain_collar": ("back", "rigid", "collar", True),

    # Seasonal tier
    "body_floral_hoodie": ("body", "deform", "garment_torso", True),
    "body_forest_vest": ("body", "deform", "garment_torso", True),
    "head_stargazer_cap": ("head", "rigid", "hat_brimmed", True),
    "head_cherry_blossom_crown": ("head", "rigid", "circlet", False),
    "back_firefly_lantern_charm": ("back", "rigid", "charm", False),
    "back_coral_branch_pin": ("back", "rigid", "pin", False),
    "face_moon_earrings": ("face", "rigid", "earrings", False),
    "back_golden_leaf_brooch": ("back", "rigid", "pin", False),
    "back_snow_scarf": ("back", "rigid", "scarf", True),
    "head_sunrise_beret": ("head", "rigid", "hat_dome", True),

    # Earned tier
    "head_crown": ("head", "rigid", "circlet", False),
    "back_explorer_pack": ("back", "rigid", "bag", True),
    "body_kimono": ("body", "deform", "garment_torso", True),
    "face_star_glasses": ("face", "rigid", "glasses", False),
    "feet_boots": ("feet", "rigid", "shoe", True),
    "back_listener_badge": ("back", "rigid", "pin", False),
    "aura_steady": ("aura", "rigid", "aura_ring", False),
    "aura_warm": ("aura", "rigid", "aura_ring", False),
    "back_first_friend_scarf": ("back", "rigid", "scarf", False),
}

SLOT_SOCKET = {
    "head": "SOCKET_head",
    "face": "SOCKET_face",
    "back": "SOCKET_back",
    "hands": "SOCKET_hand_L",  # secondary hand attached separately if needed
    "feet": "SOCKET_foot_L",   # mirrored for _R at runtime by AvatarRig.js
    "aura": "SOCKET_aura",
    "body": None,
}


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(description="Build a Grove wardrobe item and export to glTF.")
    p.add_argument("--item", default=None, choices=sorted(WARDROBE_CATALOGUE.keys()))
    p.add_argument("--all", action="store_true", help="Build every catalogued item")
    p.add_argument("--out", default=None, help="Output .glb path (single-item mode)")
    p.add_argument("--out-dir", default="/tmp/wardrobe", help="Output directory (--all mode)")
    p.add_argument(
        "--preview", default=None,
        help="Optional PNG path (single-item mode only): fast flat-shaded "
             "Workbench preview, never EEVEE — see build_avatar.py's "
             "render_preview() for why (this matters most here, since "
             "aura_ring items carry emissive materials).",
    )
    return p.parse_args(argv)


def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


# ── Shape builders — each returns a bmesh-built bpy object, no per-part
# interactive bpy.ops calls. Shapes are deliberately simple primitives:
# wardrobe items ride on the silhouette-first design language (section 1)
# and do not need dense geometry to read clearly. ────────────────────────

def _new_bmesh_obj(name):
    bm = bmesh.new()
    return bm, name


def _finish(bm, name):
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_hat_dome(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=8, radius=0.22)
    bmesh.ops.scale(bm, vec=(1.0, 1.0, 0.7), verts=res["verts"])
    bmesh.ops.translate(bm, vec=(0, 0, 0.10), verts=res["verts"])
    return _finish(bm, name)


def build_hat_brimmed(name):
    bm, _ = _new_bmesh_obj(name)
    dome = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=8, radius=0.20)
    bmesh.ops.scale(bm, vec=(1.0, 1.0, 0.65), verts=dome["verts"])
    bmesh.ops.translate(bm, vec=(0, 0, 0.10), verts=dome["verts"])
    brim = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.26, radius2=0.26, depth=0.015)
    bmesh.ops.translate(bm, vec=(0, 0, -0.02), verts=brim["verts"])
    return _finish(bm, name)


def build_glasses(name):
    bm, _ = _new_bmesh_obj(name)
    for side in (1, -1):
        lens = bmesh.ops.create_circle(bm, cap_ends=True, segments=16, radius=0.045)
        bmesh.ops.translate(bm, vec=(side * 0.06, 0.02, 0), verts=lens["verts"])
    return _finish(bm, name)


def build_shoe(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.07, 0.11, 0.06), verts=res["verts"])
    return _finish(bm, name)


def build_scarf(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_circle(bm, cap_ends=False, segments=24, radius=0.16)
    bmesh.ops.translate(bm, vec=(0, 0, 0), verts=res["verts"])
    return _finish(bm, name)


def build_pin(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.02)
    return _finish(bm, name)


def build_bag(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.10, 0.06, 0.12), verts=res["verts"])
    return _finish(bm, name)


def build_decal(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_circle(bm, cap_ends=True, segments=12, radius=0.03)
    return _finish(bm, name)


def build_collar(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_circle(bm, cap_ends=False, segments=20, radius=0.13)
    return _finish(bm, name)


def build_circlet(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_circle(bm, cap_ends=False, segments=24, radius=0.19)
    return _finish(bm, name)


def build_charm(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=8, radius=0.035)
    return _finish(bm, name)


def build_earrings(name):
    bm, _ = _new_bmesh_obj(name)
    for side in (1, -1):
        res = bmesh.ops.create_circle(bm, cap_ends=False, segments=12, radius=0.025)
        bmesh.ops.translate(bm, vec=(side * 0.08, 0, -0.04), verts=res["verts"])
    return _finish(bm, name)


def build_garment_torso(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.30, 0.22, 0.30), verts=res["verts"])
    bmesh.ops.translate(bm, vec=(0, 0, 1.14), verts=res["verts"])
    return _finish(bm, name)


def build_aura_ring(name):
    bm, _ = _new_bmesh_obj(name)
    res = bmesh.ops.create_circle(bm, cap_ends=False, segments=32, radius=0.34)
    return _finish(bm, name)


SHAPE_BUILDERS = {
    "hat_dome": build_hat_dome,
    "hat_brimmed": build_hat_brimmed,
    "glasses": build_glasses,
    "shoe": build_shoe,
    "scarf": build_scarf,
    "pin": build_pin,
    "bag": build_bag,
    "decal": build_decal,
    "collar": build_collar,
    "circlet": build_circlet,
    "charm": build_charm,
    "earrings": build_earrings,
    "garment_torso": build_garment_torso,
    "aura_ring": build_aura_ring,
}


def assign_material_slots(obj, tintable):
    """
    Tintable items get mat_main + mat_trim (matching wardrobe.js's
    MATERIAL_SLOTS); fixed-appearance items get a single mat_fixed slot
    instead so AvatarRig.js's tint pass correctly skips them.
    """
    names = ["mat_main", "mat_trim"] if tintable else ["mat_fixed"]
    for n in names:
        mat = bpy.data.materials.get(n) or bpy.data.materials.new(n)
        mat.use_nodes = True
        obj.data.materials.append(mat)


def add_socket_alignment_empty(obj, slot):
    """
    Add a SOCKET_<slot>_align empty at the object's origin, used by
    AvatarRig.js as a sanity-check anchor when parenting into the live
    rig's socket (the item's own local origin is already authored at the
    socket's expected offset by each build_* function above).
    """
    empty = bpy.data.objects.new(f"SOCKET_{slot}_align", None)
    empty.empty_display_size = 0.02
    bpy.context.scene.collection.objects.link(empty)
    empty.parent = obj
    return empty


def export_gltf(out_path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )


def render_preview(out_png, objects):
    """
    Flat-shaded Workbench preview — never headless EEVEE. Emissive
    aura_ring materials in particular are the exact case
    CHARACTER-BIBLE.md section 7 calls out as slow/inconsistent under
    headless EEVEE across GPU drivers; Workbench skips emission
    evaluation entirely so this is always fast. The real look of an
    emissive aura is only verified by loading the exported .glb in
    Three.js, since that is the engine it actually renders in.
    """
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "FLAT"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 384
    scene.render.resolution_y = 384
    scene.render.filepath = out_png

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = (0, -0.9, 0.15)
    cam_obj.rotation_euler = (1.4, 0, 0)
    scene.camera = cam_obj

    bpy.ops.render.render(write_still=True)  # one batched call


def build_item(model_id, out_path, preview_path=None):
    slot, attach_mode, shape_key, tintable = WARDROBE_CATALOGUE[model_id]
    builder = SHAPE_BUILDERS[shape_key]

    reset_scene()
    obj = builder(model_id)
    assign_material_slots(obj, tintable)
    align = add_socket_alignment_empty(obj, slot)

    export_gltf(out_path, [obj, align])
    print(f"build_wardrobe.py: exported {model_id} ({slot}, {attach_mode}) -> {out_path}")

    if preview_path:
        render_preview(preview_path, [obj, align])
        print(f"build_wardrobe.py: wrote Workbench preview -> {preview_path}")


def main():
    args = parse_args()
    if not IN_BLENDER:
        print("build_wardrobe.py: not running inside Blender; syntax-only check mode.")
        return

    if args.all:
        import os
        os.makedirs(args.out_dir, exist_ok=True)
        for model_id in WARDROBE_CATALOGUE:
            out_path = os.path.join(args.out_dir, f"{model_id}.glb")
            build_item(model_id, out_path)
        return

    if not args.item:
        print("build_wardrobe.py: pass --item <id> or --all")
        return

    out_path = args.out or f"/tmp/{args.item}.glb"
    build_item(args.item, out_path, preview_path=args.preview)


if __name__ == "__main__":
    main()
