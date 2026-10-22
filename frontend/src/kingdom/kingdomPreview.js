// src/kingdom/kingdomPreview.js
//
// Looking at the island before it is a game: what to draw and what stands in
// the way, for the two views of KingdomScene.
//
//   "day1"       the island a new player finds. The start area is the
//                player's own island (islandState.js); every section of wild
//                land is still wild.
//   "developed"  the showcase island from Blender, piece by piece
//                (kingdom_view.json), with the sections it has opened cleared.
//
// Nothing here is a rule of the game. Opening a section, its price, and
// putting a house together from kit parts belong to the game phase; this
// file only lists pieces and the ground they block. It knows nothing about
// three.js, so it can be tested in node.

/** Wild growth that stops a walker, by kit mesh. Trees: the trunk blocks and
 * the crown is overhead (metres at scale 1). Other things: a disc. */
export const GROWTH = Object.freeze({
  KK_Tree_Wild_A:  { trunk: 0.3, crown: 2.0, crownAt: 2.7 },
  KK_Tree_Wild_A2: { trunk: 0.3, crown: 2.0, crownAt: 2.7 },
  KK_Tree_Wild_B:  { trunk: 0.34, crown: 2.5, crownAt: 1.9 },
  KK_Tree_Wild_B2: { trunk: 0.34, crown: 2.5, crownAt: 1.9 },
  KK_Tree_Blossom: { trunk: 0.34, crown: 2.5, crownAt: 1.9 },
  KK_Tree_Wild_C:  { trunk: 0.28, crown: 1.45, crownAt: 1.7 },
  KK_Tree_Wild_D:  { trunk: 0.22, crown: 1.0, crownAt: 1.7 },
  KK_Tree_Wild_D2: { trunk: 0.22, crown: 1.0, crownAt: 1.7 },
  KK_Tree_Round:   { trunk: 0.42, crown: 1.7, crownAt: 2.9 },
  KK_Tree_Apple:   { trunk: 0.42, crown: 1.7, crownAt: 2.9 },
  KK_Tree_Citrus:  { trunk: 0.42, crown: 1.7, crownAt: 2.9 },
  KK_Thicket_A:    { r: 0.55 },
  KK_Thicket_B:    { r: 0.5 },
  KK_Bush:         { r: 0.5 },
  KK_Rock:         { r: 0.42 },
  KK_Log:          { r: 0.45 },
  KK_Stump:        { r: 0.36 },
  KK_Land_Sign:    { r: 0.14 },
});

/** The 1 m cells of every section that is not opened: [[cx, cz], ...] in
 * the game's axes (a cell is named by its corner with the lower x and z).
 * Closed land is not walked on: there is nothing there for the player yet,
 * and among the trees the camera would lose the character. */
export function closedCells(land, opened = []) {
  const grid = land?.grid;
  if (!grid) return [];
  const open = new Set(opened);
  const binary = typeof atob === "function" ? atob(grid.data) : Buffer.from(grid.data, "base64").toString("binary");
  const out = [];
  let at = 0;
  for (let i = 0; i + 1 < binary.length; i += 2) {
    const value = binary.charCodeAt(i), run = binary.charCodeAt(i + 1);
    if (value > 1 && !open.has(value - 1)) {
      for (let k = at; k < at + run; k++) out.push([grid.minX + (k % grid.nx), grid.minZ + Math.floor(k / grid.nx)]);
    }
    at += run;
  }
  return out;
}

/** Small growth that throws no shadow: a shadow map has no room for it. */
export const NO_SHADOW = /^(KK_Grass_Tuft|KK_Flower_|KK_Fern|KK_Mushrooms|KD_Path_|KD_Pond_Water|KD_Pond_Lily|KL_Ripple|KL_Smoke|KL_Butterfly|KK_Wet_Patch)/;

/** Changes when Blender lays Day 1 out again, so that an island saved on an
 * older layout does not keep trees where the land has since moved. */
export function layoutStamp(layout) {
  const first = layout?.day1?.[0];
  return [layout?.version ?? 0, layout?.site?.x, layout?.site?.z, layout?.spawn?.z, layout?.day1?.length ?? 0, first?.x, first?.z].join("|");
}

/** Every piece of wild growth on the sections that are still closed, and the
 * sign of each: [{ mesh, x, z, rot, scale }]. */
export function wildList(land, opened = []) {
  const open = new Set(opened);
  const out = [];
  for (const section of land?.sections ?? []) {
    if (open.has(section.id)) continue;
    out.push({ mesh: "KK_Land_Sign", x: section.sign.x, z: section.sign.z, rot: section.sign.rot, scale: 1 });
    for (const one of section.wild) out.push(one);
  }
  return out;
}

function discsOf(list) {
  const discs = [];
  for (const one of list) {
    const kind = GROWTH[one.mesh];
    if (!kind) continue;
    const scale = one.scale ?? 1;
    if (kind.trunk) discs.push({ x: one.x, z: one.z, r: kind.trunk * scale, crown: kind.crown * scale, crownAt: kind.crownAt * scale });
    else discs.push({ x: one.x, z: one.z, r: kind.r * Math.min(1.25, scale) });
  }
  return discs;
}

/** What blocks a walker in a view, on top of the world itself:
 * { closed: [[cx, cz]], discs: [{x, z, r, crown?, crownAt?}], rects: [{x0, z0, x1, z1, wall}] }.
 * Closed land is blocked whole, so its growth needs no discs of its own. Its
 * crowns are not overhead either: the camera may pass through a crown (it
 * sees nothing of it from inside) rather than duck under it.
 * `showcase` is kingdom_showcase.json, or null for Day 1 (where the start
 * area is blocked from the island's own state). */
export function blocksOf({ land, opened = [], showcase = null, houseSizes = null }) {
  const closed = closedCells(land, opened);
  const discs = [];
  const rects = [];
  if (!showcase) return { closed, discs, rects };
  for (const building of showcase.buildings ?? []) {
    const size = houseSizes?.[building.size];
    const [w, d] = size ? size.body : [building.plot[2], building.plot[3]];
    const back = size?.back ?? 0;
    const turns = ((building.turns ?? 0) % 4 + 4) % 4;
    // The body stands `back` behind the middle of its plot; behind is -z until the house is turned.
    const [ox, oz] = [[0, -back], [-back, 0], [0, back], [back, 0]][turns];
    const [hw, hd] = turns % 2 ? [d / 2, w / 2] : [w / 2, d / 2];
    rects.push({ x0: building.x + ox - hw, z0: building.z + oz - hd, x1: building.x + ox + hw, z1: building.z + oz + hd, wall: true });
  }
  for (const fence of showcase.fences ?? []) {
    const gates = new Set((fence.gates ?? []).map((gate) => gate.cell.join(",")));
    for (const [cx, cz] of fence.cells) if (!gates.has(`${cx},${cz}`)) rects.push({ x0: cx + 0.3, z0: cz + 0.3, x1: cx + 0.7, z1: cz + 0.7, wall: false, fence: [cx, cz] });
  }
  // A fence is a line: close the gap between two posts that stand side by side.
  const posts = new Set(rects.filter((rect) => rect.fence).map((rect) => rect.fence.join(",")));
  for (const rect of rects.filter((r) => r.fence)) {
    const [cx, cz] = rect.fence;
    if (posts.has(`${cx + 1},${cz}`)) rects.push({ x0: cx + 0.7, z0: cz + 0.4, x1: cx + 1.3, z1: cz + 0.6, wall: false });
    if (posts.has(`${cx},${cz + 1}`)) rects.push({ x0: cx + 0.4, z0: cz + 0.7, x1: cx + 0.6, z1: cz + 1.3, wall: false });
  }
  for (const [cx, cz] of showcase.pond ?? []) rects.push({ x0: cx, z0: cz, x1: cx + 1, z1: cz + 1, wall: false });
  const trees = [];
  for (const piece of showcase.pieces ?? []) {
    if (piece.kind !== "solid") continue;                       // an arch or a gate is walked through, a lily floats
    if (GROWTH[piece.mesh]) { trees.push(piece); continue; }
    const [w, d] = piece.turns % 2 ? [piece.cells[1], piece.cells[0]] : piece.cells;
    const inset = w === 1 && d === 1 ? 0.3 : 0.12;               // a lamp post is thinner than its cell
    rects.push({ x0: piece.x - w / 2 + inset, z0: piece.z - d / 2 + inset, x1: piece.x + w / 2 - inset, z1: piece.z + d / 2 - inset, wall: false });
  }
  discs.push(...discsOf(trees), ...discsOf((showcase.wild ?? []).filter((one) => one.takes)));
  return { closed, discs, rects };
}
