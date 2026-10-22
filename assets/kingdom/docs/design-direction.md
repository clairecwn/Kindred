# Kingdom — island home

Status: first authored Blender scene. This is a complete redesign, not an extension of the previous SVG Kingdom. Grove is owned by Claude; this work does not edit Grove or character sources.

## Research and decisions

- Nintendo's [Super Mario 3D World developer interview](https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-Super-Mario-3D-World/Super-Mario-3D-World/3-An-Instinctively-Good-Feeling-/3-An-Instinctively-Good-Feeling--829583.html) describes choosing the camera early and using a consistent direction/distance to help orientation. Kingdom therefore reserves a clear arrival-to-house sightline, broad paths and lower planting in the foreground. Its eventual walk camera must be tested before filling those spaces.
- Nintendo's [Bowser's Fury overview](https://www.nintendo.com/us/store/products/super-mario-3d-world-plus-bowsers-fury-switch/) describes free exploration across Lake Lapcat's islands. The adaptation here is a continuous home island surrounded by water, with distant land as context and visible landmarks within the playable island.
- Nintendo's [Jamboree island and board overview](https://www.nintendo.com/sg/switch/a7hl/index.html) supplies visual references for bright resort water, distinct island silhouettes and legible routes. Rounded terrain, broad colour areas and compact activity clusters are our visual interpretation, not a claim about Nintendo's internal rendering technology.
- Supercell's [Hay Day Farm Patch guidelines](https://make.supercell.com/en/create/hayday/farm-corner/submission-guidelines) explicitly combine inventory decorations, paths, fences, buildings and crops inside clear borders. Kingdom uses separate garden, farm, paddock and free-decoration regions with navigable space between them.
- Playrix's [Homescapes Tasks & Areas documentation](https://playrix.helpshift.com/hc/en/14-homescapes/section/148-tasks-areas/) describes area renovation and Design Mode changes. Kingdom's house, garden and farm are distinct editable destinations, with replaceable furniture kept separate from the architectural shell.

Research checked 2026-10-06. No Nintendo, Supercell or Playrix models, textures, logos or characters are copied. All island geometry is locally authored; the reference character is the project's current Kai GLB.

## First scene

One approximately 44 × 38 m island. A cream cottage with a red tiled roof is the principal landmark. The house has a real doorway, windows, an empty interior floor and a porch with shallow steps. The front lawn remains spacious for owned furniture. A curved cream path connects the arrival dock, house, flower garden, farm and stable.

West: flower beds, a seating nook and a small pond. East: six crop beds, a tool shed and an orchard. Southeast: an open stable, fenced paddock, hay and a trough. Shore: sand, rocks, water, foam and distant vegetated islands. Furniture and crop examples are authoring examples, not items granted to a player's inventory.

Colour family follows the newer Grove palette read from Claude's existing files: cream #FFF1D0, warm white #FFFAEC, red #E52521, lawn #5CC83C, dark leaf #2E9A45, light leaf #8FDC4E, turquoise #3ED6E0, blue #049CD8, yellow #FBD000. Large areas use a controlled subset; high-chroma accents mark flowers, produce and architectural details.

Rendering: physically lit stylized materials, rounded edges, smooth foliage silhouettes, soft directional shadows and gentle skylight. Rough wood/soil contrast with smoother leaves, glazed windows and water. This is an implementation choice informed by the reference images, not a reconstruction of a proprietary Nintendo renderer.

## Interaction and runtime contract

- Permanent: island, shoreline, house shell, water and distant islands.
- Editable zones: house interior, porch, front lawn, flower garden, crop beds, stable yard.
- Movable: furniture and decoration instances with stable item IDs, dimensions and placement footprints.
- Player scale: import the current Kai asset at its original metre scale, measure the evaluated pose, record height/width, and keep the character in a separate reference collection.
- Arrival path: at least 2.4 m wide. House door: 2.4 m clear width × 2.8 m high. Farm aisles: 1.6 m after measuring the current character. Main exterior surfaces share one walk height; porch steps are 0.12 m.
- Camera: a wide island review view, a closer arrival view, and an orthographic plan derived from the actual scene. Runtime camera and collision remain a separate integration check.
- Budget: aim for <450k environment triangles after modifiers; character and authoring cameras are not part of the eventual environment export. Paid-service budget: zero.
- Readiness: this phase produces the source scene, measured audit and review images. It does not claim inventory, farming, animal AI or runtime navigation are implemented.

## Inventory integration finding

The previous Kingdom receives `kindred.inventory` through App, while Grove currently persists `kindred.grove.mall.v1` with `{itemId, label, qty}` entries. They are separate stores. The redesign must introduce one owned-item ledger (or an explicit migration) rather than fabricate a second copy of purchases. A placed item reserves one owned quantity; moving preserves its instance ID; returning it to storage releases that reservation. Scene examples must never become ownership records. This integration will be implemented when the new Kingdom enters the app; the existing Kingdom presentation is not a design constraint.
