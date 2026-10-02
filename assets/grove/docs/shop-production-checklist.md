# Grove shop production checklist

This is the shared refinement contract for Grove shop scenes.

## Current status

- Mall blockout: prototype complete
- Grove Grocer: design prototype complete
- Thread + Thimble: design prototype complete
- Home Nook: design prototype complete
- Cafe Canopy: design prototype complete
- Sole Search: design prototype complete
- Pixel Pantry: design prototype complete
- Maker Meadow: design prototype complete
- Seasonal Pop-Up: design prototype complete
- Book Burrow: design prototype complete
- Wellness Willow: design prototype complete
- Food Hall: design prototype complete
- Rooftop Garden: design prototype complete
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

Do not export the shop scenes into `public/models/` until the user approves:

- storefront readability
- walkability and player clearance
- individual prop silhouettes
- material and lighting direction
- performance tier and asset grouping

The final handoff will use modular exports for architecture, fixtures, and individual hero props. Prototype `.blend` scenes remain the source of truth until that approval.
