# Grove prototype review index

The full three-story Grove mall and twelve shop concepts now exist as isolated Blender prototypes. This package does not modify the Kindred character pipeline.

## Core scenes

- `blender/grove_blockout.blend` — three-story shell, atrium, circulation, and ground-floor shop zoning
- `blender/grove_grocer_detail.blend` — grocery shop and individual grocery props
- `blender/thread_and_thimble_detail.blend` — clothing, shoes, accessories, and mannequins
- `blender/home_nook_detail.blend` — household items and small furniture
- `blender/cafe_canopy_detail.blend` — café counter, seating, food, and drink props
- `blender/sole_search_detail.blend` — Level 2 footwear shop
- `blender/grove_upper_floors.blend` — all remaining Level 2 and Level 3 shops
- `blender/grove_master_refined.blend` — single refined Grove master scene used for modular export

## Runtime exports

- `exports/grove_architecture.glb` — mall shell and circulation
- `exports/*.glb` — twelve independently loadable shop modules
- `exports/manifest.json` — structural validation results, file sizes, scene counts, and SHA-256 digests

## Shop review renders

### Ground floor

- `renders/grove_grocer_detail.png`
- `renders/thread_and_thimble_detail.png`
- `renders/home_nook_detail.png`
- `renders/cafe_canopy_detail.png`

### Level 2

- `renders/sole_search_detail.png`
- `renders/pixel_pantry_detail.png`
- `renders/maker_meadow_detail.png`
- `renders/seasonal_pop_up_detail.png`

### Level 3

- `renders/book_burrow_detail.png`
- `renders/wellness_willow_detail.png`
- `renders/food_hall_detail.png`
- `renders/rooftop_garden_detail.png`

## Audit summary

- Blockout: 105 visible meshes, 18,796 triangles, bounds 60.6 × 44.6 × 15.4 m
- Upper floors: 297 visible meshes, 47,592 triangles, bounds 60.6 × 44.6 × 15.4 m
- Merchandise objects are separately named for later interaction and modular export.
- All JSON manifests parse successfully.
- The local Kindred runtime loads all 13 modules and switches safely between all three floors.
- The current local preview measures 238 draw calls and 58,788 rendered triangles after active-floor shop culling, down from a 403-call / 97,892-triangle baseline. This is a geometry snapshot, not a sustained frame-rate approval.
- The shell and circulation remain visible across the mall while only the current floor's four detailed shop modules render.
- Upper-floor connector decks now include an atrium-edge rail and inactive connector decks are hidden.
- The runtime derives 37 broad-phase fixture blockers from named meshes: 16 on Level 1, 10 on Level 2, and 11 on Level 3.
- The mall-only camera is kept below the next five-metre floor slab so upper-level decks do not clip the view.
- Twelve shop zones are connected to 85 unique purchasable catalog items.

## Known issues before Form approval

- Several products still use primitive silhouettes and need an authored final-art pass.
- Home Nook's review composition remains partially obstructed by fixtures and needs a cleaner production camera.
- Pairwise upper-floor overview cameras are obstructed by mall circulation geometry; individual shop renders should be used instead.
- Collision, manifold geometry, Boolean openings, UVs, material tiers, and lightmaps have not been finalized.
- Complete corner and ceiling review suites have not been produced.

## Gate status

- Function: approved
- Form direction: approved by the user on 2026-10-01
- Runtime: local integration and browser load pass complete; deployment remains blocked pending detailed fixture collision, frame-rate measurement, final-art refinement, and explicit Runtime approval

Validated GLBs are staged under `public/models/env/grove/` for the local runtime.
