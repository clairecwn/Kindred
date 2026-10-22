# Kingdom island home

The new Kingdom starts here. The previous Kingdom SVG scene is not used as its design or geometry.

Latest house revision: approximately **10.27 × 10.05m (103.21m²)** of open-plan interior. A hidden 2m-wide entry spine and four candidate furnishing zones support future layout design without fixed partitions. Additional storeys and construction upgrades are not implemented. The expanded geometry is in the same source file; `kingdom_expanded_home_overview.png` and `kingdom_expanded_home_plan.png` are the current review images (older renders predate this expansion).

- `blender/kingdom_island.blend` — one dedicated editable Blender source.
- `blender/build_kingdom.py` — reproducible first-scene authoring script.
- `blender/refine_kingdom_review.py`, `finish_kingdom_surfaces.py`, `prepare_kingdom_handoff.py` — review corrections, packed surface textures and placement metadata, called by the builder.
- `blender/expand_kingdom_home.py` — idempotent home enlargement and layout guides.
- `blender/finish_home_interior.py` — rear window openings, perimeter skirting, measured floor support and sampled character-envelope clearance, applied after enlargement. `renders/kingdom_home_interior_cutaway.png` shows the latest interior.
- `renders/` — overview, arrival, home, farm and actual-geometry plan.
- `docs/design-direction.md` — reference research and original design decisions.
- `docs/scene-audit.json` — measured character scale and environment budget.
- `docs/room-layout.json` — placement zones and camera contract.
- `docs/final-report.json` — first-scene checks and explicitly outstanding runtime work.

Collections separate terrain, house, garden, farm, stable, trees, dock, movable decoration, backdrop, lighting and the imported character reference. The character reference uses the current project's Kai model at original scale and must be excluded from environment exports. Grove and character source files are not modified.

This deliverable is the authored scene and visual direction. Inventory transfer, placement controls, character traversal, farming and animals are future runtime work, not implied by the render. The scene contains example crop and furniture geometry, not player ownership records.
