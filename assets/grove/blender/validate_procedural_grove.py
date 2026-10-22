import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]

REFINED_COLLECTIONS = {
    "GROVE_ATRIUM_REFINEMENT": 70,
    "GROVE_STOREFRONT_REFINEMENT": 100,
    "GROVE_VERTICAL_CIRCULATION_REFINEMENT": 45,
    "GROVE_GROCER_INTERIOR_REFINEMENT": 120,
    "THREAD_THIMBLE_INTERIOR_REFINEMENT": 80,
    "HOME_NOOK_INTERIOR_REFINEMENT": 70,
    "CAFE_CANOPY_INTERIOR_REFINEMENT": 75,
    "SOLE_SEARCH_INTERIOR_REFINEMENT": 70,
    "PIXEL_PANTRY_INTERIOR_REFINEMENT": 100,
    "MAKER_MEADOW_INTERIOR_REFINEMENT": 60,
    "SEASONAL_POP_UP_INTERIOR_REFINEMENT": 90,
    "BOOK_BURROW_INTERIOR_REFINEMENT": 130,
    "ALLTIMEFITNESS_INTERIOR_REFINEMENT": 80,
    "FOOD_HALL_INTERIOR_REFINEMENT": 85,
    "ROOFTOP_GARDEN_INTERIOR_REFINEMENT": 95,
}

SUPERSEDED = (
    "GROVE_SHOP_BLOCKOUTS", "GROVE_LANDMARKS", "GROVE_GROCER_DETAIL",
    "THREAD_AND_THIMBLE_DETAIL", "HOME_NOOK_DETAIL", "CAFE_CANOPY_DETAIL",
    "SOLE_SEARCH_DETAIL", "PIXEL_PANTRY_DETAIL", "MAKER_MEADOW_DETAIL",
    "SEASONAL_POP_UP_DETAIL", "BOOK_BURROW_DETAIL", "WELLNESS_WILLOW_DETAIL",
    "WELLNESS_WILLOW_INTERIOR_REFINEMENT", "FOOD_HALL_DETAIL", "ROOFTOP_GARDEN_DETAIL",
)

REVIEW_FILES = (
    "renders/form-suite/grove_corner_southwest.png",
    "renders/form-suite/grove_corner_southeast.png",
    "renders/form-suite/grove_corner_northeast.png",
    "renders/form-suite/grove_corner_northwest.png",
    "renders/form-suite/grove_ceiling_center_up.png",
    "renders/form-suite/grove_ceiling_oblique_south.png",
    "renders/form-suite/grove_ceiling_oblique_north.png",
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, required=True)
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(values)


def bounds_z(obj):
    values = [(obj.matrix_world @ Vector(corner)).z for corner in obj.bound_box]
    return min(values), max(values)


def support_check(errors, checks, object_name, expected_bottom, tolerance=0.005, collection_name=None):
    obj = None
    if collection_name:
        collection = bpy.data.collections.get(collection_name)
        if collection:
            obj = next((candidate for candidate in collection.all_objects if candidate.name == object_name or candidate.name.startswith(object_name + ".")), None)
    else:
        obj = bpy.data.objects.get(object_name)
    if obj is None:
        errors.append(f"missing support-audit object: {object_name}")
        return
    bottom, _ = bounds_z(obj)
    gap = bottom - expected_bottom
    checks.append({"object": object_name, "bottomZ": round(bottom, 5), "supportZ": expected_bottom, "gapMeters": round(gap, 5)})
    if abs(gap) > tolerance:
        errors.append(f"{object_name}: support gap {gap:.5f} m exceeds +/-{tolerance:.3f} m")


def main():
    options = parse_args()
    errors = []
    collection_counts = {}
    for name, minimum in REFINED_COLLECTIONS.items():
        collection = bpy.data.collections.get(name)
        if collection is None:
            errors.append(f"missing refined collection: {name}")
            continue
        meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
        collection_counts[name] = len(meshes)
        if collection.hide_render or collection.hide_viewport:
            errors.append(f"refined collection is hidden: {name}")
        if len(meshes) < minimum:
            errors.append(f"{name}: expected at least {minimum} meshes, found {len(meshes)}")

    visible_superseded = []
    for name in SUPERSEDED:
        collection = bpy.data.collections.get(name)
        if collection and (not collection.hide_render or not collection.hide_viewport):
            visible_superseded.append(name)
    if visible_superseded:
        errors.append("superseded collections remain visible: " + ", ".join(visible_superseded))

    all_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    invalid_bounds = []
    triangles = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in all_meshes:
        dimensions = tuple(float(value) for value in obj.dimensions)
        if any(not math.isfinite(value) or value <= 0 for value in dimensions):
            invalid_bounds.append({"object": obj.name, "dimensions": dimensions})
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    if invalid_bounds:
        errors.append(f"{len(invalid_bounds)} meshes have invalid or zero bounds")
    if triangles > 600000:
        errors.append(f"scene triangle budget exceeded: {triangles} > 600000")

    support_checks = []
    for layer in range(3):
        for index in range(3):
            support_check(errors, support_checks, f"Folded_Towel_{index}_{layer}", 11.20 + layer * 0.12, collection_name="ALLTIMEFITNESS_INTERIOR_REFINEMENT")
    for index in range(4):
        support_check(errors, support_checks, f"Aroma_Candle_{index}", 11.20, collection_name="ALLTIMEFITNESS_INTERIOR_REFINEMENT")
    support_check(errors, support_checks, "Water_Dispenser", 10.95, collection_name="ALLTIMEFITNESS_INTERIOR_REFINEMENT")
    for index in range(2):
        support_check(errors, support_checks, f"Water_Cup_{index}", 10.95, collection_name="ALLTIMEFITNESS_INTERIOR_REFINEMENT")

    cafe_collection = "CAFE_CANOPY_INTERIOR_REFINEMENT"
    support_check(errors, support_checks, "Cafe_Counter_Top", 1.03, collection_name=cafe_collection)
    support_check(errors, support_checks, "Pastry_Case_Base", 1.15, collection_name=cafe_collection)
    support_check(errors, support_checks, "Espresso_Machine", 1.15, collection_name=cafe_collection)
    for index in range(3):
        support_check(errors, support_checks, f"Pickup_Cup_{index}", 1.15, collection_name=cafe_collection)
        support_check(errors, support_checks, f"Berry_Tart_{index}", 1.73, collection_name=cafe_collection)
        support_check(errors, support_checks, f"Cafe_Sandwich_{index}", 2.12, collection_name=cafe_collection)
    for index in range(4):
        support_check(errors, support_checks, f"Butter_Croissant_{index}", 1.34, collection_name=cafe_collection)

    for name in ("Noodle_Dumpling", "Garden_Wrap", "Bake_Cake"):
        support_check(errors, support_checks, name, 11.54)
    for index in range(3):
        support_check(errors, support_checks, f"Bake_Pastry_{index}", 11.54)
        support_check(errors, support_checks, f"Food_Communal_Tray_{index}", 10.94)
        support_check(errors, support_checks, f"Food_Communal_Bowl_{index}", 11.03)
        support_check(errors, support_checks, f"Food_Communal_Cup_{index}", 11.03)

    for row in range(3):
        for col in range(5):
            support_check(errors, support_checks, f"Seed_Packet_{row}_{col}", 10.68 + row * 0.80)
    for index in range(3):
        support_check(errors, support_checks, f"Plant_Pot_{index}", 13.08)
        support_check(errors, support_checks, f"Potting_Pot_{index}", 11.49)
    support_check(errors, support_checks, "Potting_Soil_Tray", 11.49)
    support_check(errors, support_checks, "Potting_Trowel_Blade", 11.59)

    missing_reviews = [path for path in REVIEW_FILES if not (ROOT / path).is_file()]
    if missing_reviews:
        errors.append("missing Form review renders: " + ", ".join(missing_reviews))

    reviews_path = ROOT / "docs" / "milestone-reviews.json"
    reviews = json.loads(reviews_path.read_text(encoding="utf-8"))
    form = reviews.get("form", {})
    if form.get("status") != "approved" or not form.get("approvedBy") or not form.get("approvedAt"):
        errors.append("recorded explicit Form approval is missing")

    report = {
        "schema": "kindred.grove-procedural-form-validation.v1",
        "roomId": "grove-mall",
        "source": bpy.data.filepath,
        "policy": "locally-authored-procedural-blender-no-paid-generation",
        "status": "passed" if not errors else "failed",
        "collectionMeshCounts": collection_counts,
        "scene": {"meshObjects": len(all_meshes), "triangles": triangles, "triangleBudget": 600000},
        "supportToleranceMeters": 0.005,
        "supportChecks": support_checks,
        "reviewFiles": list(REVIEW_FILES),
        "invalidBounds": invalid_bounds,
        "errors": errors,
    }
    options.report.parent.mkdir(parents=True, exist_ok=True)
    options.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("GROVE_PROCEDURAL_VALIDATION " + json.dumps({"status": report["status"], "triangles": triangles, "supportChecks": len(support_checks), "errors": len(errors)}))
    if errors:
        for error in errors:
            print("FAIL", error)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
