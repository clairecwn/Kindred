# Grove shop production checklist

This is the shared refinement contract for Grove shop scenes.

## Current status

- Mall blockout: prototype complete
- Grove Grocer: walk-in Form refinement complete
- Thread + Thimble: walk-in Form refinement complete
- Home Nook: walk-in Form refinement complete
- Cafe Canopy: walk-in Form refinement complete
- Sole Search: walk-in Form refinement complete
- Pixel Pantry: walk-in Form refinement complete
- Maker Meadow: walk-in Form refinement complete
- Seasonal Pop-Up: walk-in Form refinement complete
- Book Burrow: walk-in Form refinement complete
- AllTimeFitness: walk-in Form refinement complete; merchandise support heights corrected
- Food Hall: walk-in Form refinement complete
- Rooftop Garden: walk-in Form refinement complete
- Runtime export: intentionally pending until Form review

## Refinement pass

Every shop should receive:

1. A clear storefront identity and readable entrance.
2. A dedicated walkable floor plan with an unobstructed circulation loop.
3. Individual item objects with stable names and dimensions.
4. A coordinated material palette and a small number of color variants.
5. Contact points for shelves, tables, mannequins, counters, and floors.
6. A close-up review camera for item readability.
7. A wide review camera for shop circulation and composition.
8. Low-detail collision geometry separate from decorative meshes.

## Runtime handoff gate

Do not export the shop scenes into `frontend/public/models/` until the user approves:

- storefront readability
- walkability and player clearance
- individual prop silhouettes
- material and lighting direction
- performance tier and asset grouping

The final handoff will use modular exports for architecture, fixtures, and individual hero props. Prototype `.blend` scenes remain the source of truth until that approval.
