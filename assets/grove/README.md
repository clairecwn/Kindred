# Grove environment workspace

This folder is the isolated environment-design workspace for Kindred's Grove mall.

## Current milestone

The approved Form direction has been consolidated into `blender/grove_master_refined.blend` and exported as modular GLB files under `exports/`:

- one architecture module
- twelve independently loadable shop modules
- separately named merchandise objects for later interaction work
- a structural export manifest with hashes and scene statistics

The scene is environment-only. It does not load or edit the character Blender file, avatar models, or `src/avatar/`.

## Rebuild the blockout

Run Blender with `blender/build_grove_blockout.py` to regenerate the standalone `.blend` file and preview render. The script uses only procedural geometry and materials so the blockout can be revised without affecting Claude's character pipeline.

## Next gate

Integrate a copy of the validated modules into the game runtime, then complete collision, walkability, camera, and performance checks before Runtime approval. Prototype-grade merchandise still needs a later final-art silhouette and material pass.
