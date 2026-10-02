import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLENDER_DIR = ROOT / "blender"
EXPORT_DIR = ROOT / "exports"
MASTER = BLENDER_DIR / "grove_master_refined.blend"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "grove_grocer_detail.blend": [
        "GROVE_GROCER_DETAIL", "GROVE_GROCER_INDIVIDUAL_PROPS", "GROVE_GROCER_LABELS"
    ],
    "thread_and_thimble_detail.blend": [
        "THREAD_AND_THIMBLE_DETAIL", "THREAD_AND_THIMBLE_INDIVIDUAL_PROPS", "THREAD_AND_THIMBLE_LABELS"
    ],
    "home_nook_detail.blend": [
        "HOME_NOOK_DETAIL", "HOME_NOOK_INDIVIDUAL_PROPS", "HOME_NOOK_LABELS"
    ],
    "cafe_canopy_detail.blend": [
        "CAFE_CANOPY_DETAIL", "CAFE_CANOPY_INDIVIDUAL_PROPS", "CAFE_CANOPY_LABELS"
    ],
    "sole_search_detail.blend": [
        "SOLE_SEARCH_DETAIL", "SOLE_SEARCH_INDIVIDUAL_PROPS", "SOLE_SEARCH_LABELS"
    ]
}

EXPORT_GROUPS = {
    "grove_architecture": ["GROVE_ENVIRONMENT_BLOCKOUT", "GROVE_SHOP_BLOCKOUTS", "GROVE_LANDMARKS"],
    "grove_grocer": ["GROVE_GROCER_DETAIL", "GROVE_GROCER_INDIVIDUAL_PROPS"],
    "thread_and_thimble": ["THREAD_AND_THIMBLE_DETAIL", "THREAD_AND_THIMBLE_INDIVIDUAL_PROPS"],
    "home_nook": ["HOME_NOOK_DETAIL", "HOME_NOOK_INDIVIDUAL_PROPS"],
    "cafe_canopy": ["CAFE_CANOPY_DETAIL", "CAFE_CANOPY_INDIVIDUAL_PROPS"],
    "sole_search": ["SOLE_SEARCH_DETAIL", "SOLE_SEARCH_INDIVIDUAL_PROPS"],
    "pixel_pantry": ["PIXEL_PANTRY_DETAIL", "PIXEL_PANTRY_PROPS"],
    "maker_meadow": ["MAKER_MEADOW_DETAIL", "MAKER_MEADOW_PROPS"],
    "seasonal_pop_up": ["SEASONAL_POP_UP_DETAIL", "SEASONAL_POP_UP_PROPS"],
    "book_burrow": ["BOOK_BURROW_DETAIL", "BOOK_BURROW_PROPS"],
    "wellness_willow": ["WELLNESS_WILLOW_DETAIL", "WELLNESS_WILLOW_PROPS"],
    "food_hall": ["FOOD_HALL_DETAIL", "FOOD_HALL_PROPS"],
    "rooftop_garden": ["ROOFTOP_GARDEN_DETAIL", "ROOFTOP_GARDEN_PROPS"]
}

def append_collections(source_path, names):
    missing = [name for name in names if bpy.data.collections.get(name) is None]
    if not missing:
        return
    with bpy.data.libraries.load(str(source_path), link=False) as (available, incoming):
        incoming.collections = [name for name in missing if name in available.collections]
    for collection in incoming.collections:
        if collection and collection.name not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(collection)

def refine_scene():
    for collection in bpy.data.collections:
        if "LABEL" in collection.name:
            collection.hide_render = True
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        obj["grove_asset"] = True
        collection_names = {collection.name for collection in obj.users_collection}
        obj["grove_interactive"] = any("PROP" in name for name in collection_names)
        if not any(mod.type == "BEVEL" for mod in obj.modifiers):
            smallest = min(obj.dimensions) if min(obj.dimensions) > 0 else 0
            if smallest >= 0.06:
                bevel = obj.modifiers.new("grove_export_bevel", "BEVEL")
                bevel.width = min(0.025, smallest * 0.08)
                bevel.segments = 2
        for material in obj.data.materials:
            if not material or not material.use_nodes:
                continue
            bsdf = material.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                roughness = bsdf.inputs.get("Roughness")
                if roughness:
                    roughness.default_value = min(0.82, max(0.38, roughness.default_value))

def objects_for_collections(names):
    found = []
    seen = set()
    for name in names:
        collection = bpy.data.collections.get(name)
        if not collection:
            continue
        for obj in collection.all_objects:
            if obj.type == "MESH" and obj.name not in seen:
                found.append(obj)
                seen.add(obj.name)
    return found

def export_group(name, collection_names):
    bpy.ops.object.select_all(action="DESELECT")
    objects = objects_for_collections(collection_names)
    if not objects:
        print(f"EXPORT_SKIP {name}: no mesh objects")
        return
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    output = EXPORT_DIR / f"{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False
    )
    print(f"EXPORT_OK {name} objects={len(objects)} path={output}")

current = Path(bpy.data.filepath)
if current.name != "grove_upper_floors.blend" and current.name != "grove_master_refined.blend":
    raise RuntimeError(f"Expected the single Grove upper-floor page, found {current}")

for filename, collection_names in SOURCES.items():
    append_collections(BLENDER_DIR / filename, collection_names)

refine_scene()
bpy.context.scene["grove_pipeline_stage"] = "form-approved-export-candidate"
bpy.context.scene["grove_character_pipeline"] = "read-only-not-loaded"
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))

for export_name, collection_names in EXPORT_GROUPS.items():
    export_group(export_name, collection_names)

bpy.ops.object.select_all(action="DESELECT")
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print(f"GROVE_MASTER_READY {MASTER}")
