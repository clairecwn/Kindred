import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLENDER_DIR = ROOT / "blender"
EXPORT_DIR = ROOT / "exports"
MASTER = BLENDER_DIR / "grove_master_refined.blend"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# Export only the approved visible refinement collections. The legacy blockout
# and prototype collections remain in the master as recoverable history, but
# exporting them would replace the reviewed rooms with older geometry.
EXPORT_GROUPS = {
    "grove_exterior": [
        "GROVE_ENVIRONMENT_BLOCKOUT",
        "GROVE_MALL_FACADE_REFINEMENT",
        "GROVE_PARK_ARRIVAL_REFINEMENT",
        "GROVE_PARK_DETAIL_REFINEMENT",
        "GROVE_VEGETATION_REFINEMENT",
        "MARIO_BACKDROP_GAME",   # sea, far hills and islets around the island
    ],
    "grove_architecture": [
        "GROVE_ENVIRONMENT_BLOCKOUT",
        "GROVE_ATRIUM_REFINEMENT",
        "GROVE_STOREFRONT_REFINEMENT",
        "GROVE_VERTICAL_CIRCULATION_REFINEMENT",
        "GROVE_PLAYABLE_MALL_REFINEMENT",
    ],
    "grove_grocer": ["GROVE_GROCER_INTERIOR_REFINEMENT"],
    "thread_and_thimble": ["THREAD_THIMBLE_INTERIOR_REFINEMENT"],
    "home_nook": ["HOME_NOOK_INTERIOR_REFINEMENT"],
    "cafe_canopy": ["CAFE_CANOPY_INTERIOR_REFINEMENT"],
    "sole_search": ["SOLE_SEARCH_INTERIOR_REFINEMENT"],
    "pixel_pantry": ["PIXEL_PANTRY_INTERIOR_REFINEMENT"],
    "maker_meadow": ["MAKER_MEADOW_INTERIOR_REFINEMENT"],
    "seasonal_pop_up": ["SEASONAL_POP_UP_INTERIOR_REFINEMENT"],
    "book_burrow": ["BOOK_BURROW_INTERIOR_REFINEMENT"],
    "alltimefitness": ["ALLTIMEFITNESS_INTERIOR_REFINEMENT"],
    "food_hall": ["FOOD_HALL_INTERIOR_REFINEMENT"],
    "rooftop_garden": ["ROOFTOP_GARDEN_INTERIOR_REFINEMENT"],
}

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
        raise RuntimeError(f"EXPORT_BLOCKED {name}: no mesh objects in {collection_names}")
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

for export_name, collection_names in EXPORT_GROUPS.items():
    export_group(export_name, collection_names)

bpy.ops.object.select_all(action="DESELECT")
print(f"GROVE_EXPORTS_READY {EXPORT_DIR}")
