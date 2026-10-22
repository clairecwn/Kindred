"""Refine the existing Grove master for the playable mall and park.

Run against grove_master_refined.blend only. This pass edits that one Grove
source, leaves every character source alone, and exports through the normal
Grove manifest pipeline afterwards.
"""

import bpy
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"
if Path(bpy.data.filepath).resolve() != MASTER.resolve():
    raise RuntimeError(f"Open the existing Grove master before refining: {MASTER}")

scene = bpy.context.scene
atrium = bpy.data.collections.get("GROVE_ATRIUM_REFINEMENT")
if atrium is None:
    raise RuntimeError("The approved atrium collection is missing")

# The four suspended buds were the dominant unsupported shapes at player eye
# level. The game also generated a second set, which is now removed there.
removed = []
for obj in list(atrium.all_objects):
    if obj.name.startswith("Atrium_Pendant_"):
        removed.append(obj.name)
        bpy.data.objects.remove(obj, do_unlink=True)

# A small, shared colour family gives the public mall and park one identity.
# Shop merchandise retains its own distinct colours and materials.
palette = {
    "Cream": (0.82, 0.73, 0.57),
    "WarmWhite": (0.92, 0.85, 0.71),
    "Pale": (0.88, 0.80, 0.66),
    "Coral": (0.76, 0.38, 0.34),
    "Rose": (0.82, 0.51, 0.55),
    "Gold": (0.88, 0.66, 0.31),
    "Mint": (0.40, 0.68, 0.62),
    "Leaf": (0.27, 0.48, 0.32),
    "LightLeaf": (0.47, 0.65, 0.39),
    "Wood": (0.48, 0.32, 0.22),
}
public_prefixes = ("Grove_Atrium_", "Grove_Facade_", "Grove_Circulation_", "Grove_Arrival_")
retinted = []
for mat in bpy.data.materials:
    if not mat.name.startswith(public_prefixes):
        continue
    key = next((name for name in palette if mat.name.endswith("_" + name)), None)
    if key is None:
        continue
    rgb = palette[key]
    mat.diffuse_color = (*rgb, 1)
    if mat.use_nodes:
        principled = mat.node_tree.nodes.get("Principled BSDF")
        if principled:
            principled.inputs["Base Color"].default_value = (*rgb, 1)
            principled.inputs["Roughness"].default_value = 0.77
    retinted.append(mat.name)

# The old low polygon crowns were visibly hexagonal at character height.
# One controlled subdivision level rounds their silhouette while staying
# below the Grove export's 600k triangle cap.
rounded = []
for collection_name in ("GROVE_ATRIUM_REFINEMENT", "GROVE_VEGETATION_REFINEMENT"):
    collection = bpy.data.collections.get(collection_name)
    if not collection:
        continue
    for obj in collection.all_objects:
        if obj.type != "MESH":
            continue
        if not ("Topiary" in obj.name or "_Canopy_" in obj.name):
            continue
        for face in obj.data.polygons:
            face.use_smooth = True
        if not any(mod.type == "SUBSURF" and mod.name == "GroveRoundedFoliage" for mod in obj.modifiers):
            mod = obj.modifiers.new("GroveRoundedFoliage", "SUBSURF")
            mod.levels = 1
            mod.render_levels = 1
        rounded.append(obj.name)

# One new collection holds only grounded concourse details. Re-running the
# pass updates the same collection, keeping the Grove page tidy.
old = bpy.data.collections.get("GROVE_PLAYABLE_MALL_REFINEMENT")
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
details = bpy.data.collections.new("GROVE_PLAYABLE_MALL_REFINEMENT")
scene.collection.children.link(details)

def make_box(name, location, dimensions, material, bevel=0.06):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(bpy.data.materials[material])
    if bevel:
        modifier = obj.modifiers.new("SoftConstructionEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    details.objects.link(obj)
    return obj

# The entry path joins the door to the existing atrium spokes. Its edges are
# physically backed by the floor and never interrupt the 4 m walk lane.
make_box("Concourse_Entry_Stone", (0, -14.25, 0.035), (4.5, 10.3, 0.07), "Grove_Atrium_Cream", 0.035)
make_box("Concourse_Entry_Rose", (0, -14.25, 0.079), (3.85, 10.0, 0.02), "Grove_Atrium_Rose", 0.008)
for side in (-1, 1):
    make_box(f"Concourse_Edge_{side}", (side * 2.28, -14.25, 0.07), (0.15, 10.3, 0.12), "Grove_Atrium_Gold", 0.035)
    # Flush floor medallions point toward the fountain and each shop wing.
    for index, y in enumerate((-17.4, -14.2, -11.0)):
        make_box(f"Concourse_Tick_{side}_{index}", (side * 1.55, y, 0.096), (0.38, 0.16, 0.025), "Grove_Atrium_Mint", 0.02)

# The far wall is the first surface players see across the fountain. A
# recessed botanical arcade supplies a recognizable destination silhouette
# instead of an uninterrupted beige wall. Every layer is fixed to that wall.
make_box("Concourse_Garden_Back", (0, -21.56, 2.38), (10.8, 0.20, 4.38), "Grove_Atrium_Leaf", 0.26)
make_box("Concourse_Garden_Inset", (0, -21.43, 2.37), (9.70, 0.08, 3.70), "Grove_Atrium_Mint", 0.23)
make_box("Concourse_Garden_Sill", (0, -21.22, 0.35), (11.2, 0.40, 0.46), "Grove_Atrium_Cream", 0.12)
for x in (-5.2, 5.2):
    make_box(f"Concourse_Garden_Pier_{x}", (x, -21.22, 2.19), (0.50, 0.46, 4.35), "Grove_Atrium_Cream", 0.16)

arc_data = bpy.data.curves.new("Concourse_Garden_Arch_Path", type="CURVE")
arc_data.dimensions = "3D"
arc_data.bevel_depth = 0.15
arc_data.bevel_resolution = 3
arc = arc_data.splines.new("POLY")
arc.points.add(20)
for index, point in enumerate(arc.points):
    angle = math.pi - math.pi * index / 20
    point.co = (4.95 * math.cos(angle), -21.17, 0.45 + 3.87 * math.sin(angle), 1)
arch_obj = bpy.data.objects.new("Concourse_Garden_Arch", arc_data)
details.objects.link(arch_obj)
arch_obj.data.materials.append(bpy.data.materials["Grove_Atrium_Gold"])
bpy.ops.object.select_all(action="DESELECT")
arch_obj.select_set(True)
bpy.context.view_layer.objects.active = arch_obj
bpy.ops.object.convert(target="MESH")

def make_rounded(name, location, scale, material):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(bpy.data.materials[material])
    for face in obj.data.polygons:
        face.use_smooth = True
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    details.objects.link(obj)

make_rounded("Concourse_Garden_Centre", (0, -21.08, 2.34), (0.70, 0.22, 0.70), "Grove_Atrium_Gold")
for index in range(8):
    angle = index * math.tau / 8
    make_rounded(
        f"Concourse_Garden_Petal_{index}",
        (1.42 * math.cos(angle), -21.08, 2.34 + 1.24 * math.sin(angle)),
        (0.78, 0.19, 0.48),
        "Grove_Atrium_Rose" if index % 2 else "Grove_Atrium_Cream",
    )
for x in (-3.65, 3.65):
    make_rounded(f"Concourse_Garden_Leaf_{x}", (x, -21.07, 1.70), (1.05, 0.16, 0.45), "Grove_Atrium_LightLeaf")

for level, height in enumerate((4.78, 9.78), start=2):
    make_box(f"Concourse_Level_{level}_Cornice", (0, -21.49, height), (24.0, 0.16, 0.26), "Grove_Atrium_Cream", 0.06)
    make_box(f"Concourse_Level_{level}_Accent", (0, -21.38, height - 0.21), (22.5, 0.09, 0.10), "Grove_Atrium_Gold", 0.025)

scene["grove_playable_mall_pass"] = "grounded-concourse-rounded-foliage-v2"
scene["grove_playable_mall_removed_pendants"] = len(removed)
scene["grove_playable_mall_rounded_foliage"] = len(rounded)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("GROVE_PLAYABLE_MALL_READY", {"pendantsRemoved": len(removed), "roundedFoliage": len(rounded), "retintedMaterials": len(retinted), "details": len(details.objects)})
