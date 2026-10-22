// Read-only adapter: never writes to Grove or imports the old Kingdom layout.
export const GROVE_STORAGE_KEY = "kindred.grove.mall.v1";
export const KINGDOM_STORAGE_KEY = "kindred.kingdom.island.v1";

export function readGroveSnapshot(storage) {
  try {
    const value = JSON.parse(storage.getItem(GROVE_STORAGE_KEY));
    return { ok: true, snapshot: value && typeof value === "object" ? value : {} };
  } catch {
    // Unavailable is distinct from empty: do not erase placements on read failure.
    return { ok: false, snapshot: null };
  }
}

export function availableQuantity(snapshot, placements, itemId, movingId = null) {
  const rows = Array.isArray(snapshot?.inventory) ? snapshot.inventory : [];
  // Grove stores one aggregate row per item. Duplicate/corrupt rows must not
  // multiply ownership; conservatively take the largest valid aggregate.
  const owned = rows.reduce((qty, row) => row?.itemId === itemId &&
    Number.isSafeInteger(row.qty) && row.qty > 0 ? Math.max(qty, row.qty) : qty, 0);
  const rooms = snapshot?.placedObjects;
  const inGrove = rooms && typeof rooms === "object"
    ? Object.values(rooms).flatMap(rows => Array.isArray(rows) ? rows : []) : [];
  const reserved = inGrove.filter(row => row?.itemId === itemId).length +
    placements.filter(row => row.itemId === itemId && row.id !== movingId).length;
  return Math.max(0, owned - reserved);
}

export function placeOwnedItem({ snapshot, placements, item, validate }) {
  if (!item || typeof item.id !== "string" || !item.id ||
      typeof item.itemId !== "string" ||
      ![item.x, item.z, item.rotation].every(Number.isFinite)) {
    return { ok: false, reason: "invalid-placement" };
  }
  const previous = placements.find(row => row.id === item.id);
  if (previous && previous.itemId !== item.itemId) {
    return { ok: false, reason: "instance-item-mismatch" };
  }
  if (availableQuantity(snapshot, placements, item.itemId, item.id) < 1) {
    return { ok: false, reason: "no-unplaced-owned-copy" };
  }
  // Fail closed until geometry and support validation is supplied by the scene.
  if (typeof validate !== "function" || validate(item) !== true) {
    return { ok: false, reason: "blocked-or-unsupported" };
  }
  const clean = { id: item.id, itemId: item.itemId, x: item.x, z: item.z,
    rotation: ((item.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) };
  return { ok: true, placements: [...placements.filter(row => row.id !== item.id), clean] };
}

export function storeItem(placements, instanceId) {
  // Ownership stays in Grove; removing a placement releases the reservation.
  return placements.filter(row => row.id !== instanceId);
}
