// Three.js ground plane coordinates (x,z), measured in metres.
export function footprint({ x, z, width, depth, rotation = 0 }) {
  if (![x, z, width, depth, rotation].every(Number.isFinite) || width <= 0 || depth <= 0) return null;
  const c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation));
  const halfX = (c * width + s * depth) / 2;
  const halfZ = (s * width + c * depth) / 2;
  // Conservative rotated AABB: may reject a tight fit, never clips its corners.
  return { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ };
}

function validBox(box) {
  return box && [box.minX, box.maxX, box.minZ, box.maxZ].every(Number.isFinite) &&
    box.minX < box.maxX && box.minZ < box.maxZ;
}

export function fitsPlacement(box, region, obstacles, clearance = 0.05) {
  if (!validBox(box) || !validBox(region) || !Array.isArray(obstacles) ||
      obstacles.some(obstacle => !validBox(obstacle)) || !Number.isFinite(clearance) || clearance < 0) return false;
  if (box.minX < region.minX + clearance || box.maxX > region.maxX - clearance ||
      box.minZ < region.minZ + clearance || box.maxZ > region.maxZ - clearance) return false;
  return obstacles.every(o => box.maxX + clearance <= o.minX || box.minX - clearance >= o.maxX ||
    box.maxZ + clearance <= o.minZ || box.minZ - clearance >= o.maxZ);
}
