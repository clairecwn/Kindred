# Interior finish pass

The existing Kingdom source now contains two actual rear-wall window openings with glazing, inside/outside surrounds, and perimeter skirting that stops at the front doorway. The approximately 103m² floor remains open-plan; no partitions or owned furniture are imposed on the user.

The current cutaway review is `../renders/kingdom_home_interior_cutaway.png`. The roof is hidden only during that review render; the saved source retains its full roof and ceiling.

Geometry checks are in `home-interior-audit.json`:

- Nine downward support samples find the finished floor at Blender Z=2.2605m, rather than the structural datum of 2.24m. Future placement must use the finished surface.
- Twenty horizontal rays check a 1.3m-wide route from the porch through the interior, with the upper sample at Z=4.26m. This includes visible house geometry, not just the structural shell.
- Eighteen shell-only rays verify the new rear window apertures before glazing is considered.

These checks are sampled authoring evidence, not a continuous swept-body test or proof of in-game traversal. Export, live camera occlusion, interactive furnishing, persistence, and construction upgrades remain unfinished. Grove and the character source are unchanged.
