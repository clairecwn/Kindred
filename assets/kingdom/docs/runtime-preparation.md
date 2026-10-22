# Kingdom runtime preparation — 2026-10-07

## Implemented, not yet connected to the app

- `src/kingdom/ownership.js`: read-only Grove inventory adapter; reservations across Grove and Kingdom; move/store operations; no ownership inferred from old Kingdom layout or authored example props.
- `src/kingdom/placement.js`: conservative rotated furniture footprints, region containment, obstacle and reserved-route clearance. Scene-derived regions, support heights and obstacles must still be supplied.
- Eight automated tests pass (`node --test src/kingdom/__tests__/ownership.test.js`).

No Grove files, avatar files, existing inventory records, or Blender source files were changed in this pass. No app route has been switched. These helpers are not proof of completed gameplay.

## Export gate check

The room validator was run against `assets/kingdom/docs` with `--gate form` and failed:

- Missing `plan-metadata.json`.
- `props.json` is a project-specific family list, not the expected `game-room.prop-manifest.v1` schema.

These are the first reported failures, not an exhaustive list. Complete the review package using actual measurements and evidence, rerun the validator, and obtain explicit Form approval before exporting. Do not claim approval or mark unperformed checks as passing merely to satisfy the validator.

## Next integration steps

1. Complete technical review evidence and schema mapping for the existing authored island.
2. Export static meshes in material batches while retaining separate cottage roof/wall visibility groups; exclude the character reference.
3. Add a Kingdom-only scene with the user's selected avatar, scene-derived walkable surfaces and colliders, camera-relative movement and interior visibility.
4. Connect ownership helpers to verified furniture models, support heights and reserved routes. Unknown or unmapped items remain in storage, not generic placeholder shapes.
5. Add persistent, versioned placement storage, with visible write errors and reload tests. Keep old Kingdom data intact but unused by the new scene.
6. Test the loaded scene, including arrival, doorway, porch steps, farm aisles and object occlusion before replacing the old Kingdom presentation.

## Ownership boundary still requiring coordination

Grove and the old app inventory are separate stores. This adapter reads only Grove's current aggregate records and does not migrate either store. Grove itself does not consult Kingdom reservations, so simultaneous placement in Grove and Kingdom is not yet protected globally. Reconciliation and a shared ownership contract are required before presenting this as a complete cross-world inventory feature; changing Grove remains outside this task's authority.
