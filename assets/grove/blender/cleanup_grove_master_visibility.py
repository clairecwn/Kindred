import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "blender" / "grove_master_refined.blend"

# These collections are retained as recoverable construction history but are
# superseded by visible refinement collections in the authored Grove master.
SUPERSEDED_COLLECTIONS = (
    "GROVE_SHOP_BLOCKOUTS",
    "GROVE_LANDMARKS",
    "GROVE_GROCER_DETAIL",
    "GROVE_GROCER_INDIVIDUAL_PROPS",
    "GROVE_GROCER_LABELS",
    "THREAD_AND_THIMBLE_DETAIL",
    "THREAD_AND_THIMBLE_INDIVIDUAL_PROPS",
    "THREAD_AND_THIMBLE_LABELS",
    "HOME_NOOK_DETAIL",
    "HOME_NOOK_INDIVIDUAL_PROPS",
    "HOME_NOOK_LABELS",
    "CAFE_CANOPY_DETAIL",
    "CAFE_CANOPY_INDIVIDUAL_PROPS",
    "CAFE_CANOPY_LABELS",
    "SOLE_SEARCH_DETAIL",
    "SOLE_SEARCH_INDIVIDUAL_PROPS",
    "SOLE_SEARCH_LABELS",
    "PIXEL_PANTRY_DETAIL",
    "PIXEL_PANTRY_PROPS",
    "PIXEL_PANTRY_LABELS",
    "MAKER_MEADOW_DETAIL",
    "MAKER_MEADOW_PROPS",
    "MAKER_MEADOW_LABELS",
    "SEASONAL_POP_UP_DETAIL",
    "SEASONAL_POP_UP_PROPS",
    "SEASONAL_POP_UP_LABELS",
    "BOOK_BURROW_DETAIL",
    "BOOK_BURROW_PROPS",
    "BOOK_BURROW_LABELS",
    "WELLNESS_WILLOW_DETAIL",
    "WELLNESS_WILLOW_PROPS",
    "WELLNESS_WILLOW_LABELS",
    "WELLNESS_WILLOW_INTERIOR_REFINEMENT",
    "FOOD_HALL_DETAIL",
    "FOOD_HALL_PROPS",
    "FOOD_HALL_LABELS",
    "ROOFTOP_GARDEN_DETAIL",
    "ROOFTOP_GARDEN_PROPS",
    "ROOFTOP_GARDEN_LABELS",
)

hidden = []
for name in SUPERSEDED_COLLECTIONS:
    collection = bpy.data.collections.get(name)
    if not collection:
        continue
    collection.hide_render = True
    collection.hide_viewport = True
    hidden.append(name)

scene = bpy.context.scene
scene["grove_visible_authoring_pass"] = "refinement-collections-only-v1"
scene["grove_superseded_collections_hidden"] = len(hidden)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
print("GROVE_VISIBILITY_CLEANUP", len(hidden), "collections")
print("GROVE_VISIBILITY_MASTER", MASTER)
