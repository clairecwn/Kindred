// src/grove/player/collisionGrid.js
//
// The Grove's solid world, as baked from the exported models by
// assets/grove/bake_collision.py: one grid of small squares per zone (the
// park, and each mall level). Because it is measured from the models
// themselves, railings, shelves, planters, the atrium opening and every
// wall block the player without anyone hand-placing a collider.
//
// Each cell is one byte:
//   bit 0     blocked for walking (no floor there, or something stands on it)
//   bit 1     wall: the camera may neither look through it nor sit in it
//   bit 2     slim: what is overhead is narrow (a column, a lamp); the
//             camera may look past it but not come to rest in it
//   bits 3-7  overhead: 0 for open air, else the height of the underside
//             of the lowest thing above head height (awning, tree crown)
//
// A second grid, "ground", gives the height in centimetres of any mat, rug
// or kerb lying on the floor, so feet stand on it rather than in it.

export const WALK_BLOCKED = 1;
export const WALL = 2;
export const SLIM = 4;
const CAMERA_CLEARANCE = 0.3;   // keep the camera this far under an overhang

const COLLISION_FILE = "models/env/grove/grove_collision.json";

function decodeRuns(base64, length) {
  const binary = atob(base64);
  const out = new Uint8Array(length);
  let at = 0;
  for (let i = 0; i + 1 < binary.length && at < length; i += 2) {
    const value = binary.charCodeAt(i);
    const end = Math.min(length, at + binary.charCodeAt(i + 1));
    if (value) out.fill(value, at, end);
    at = end;
  }
  return out;
}

export class CollisionGrid {
  /** @param {{cell:number,minX:number,minZ:number,nx:number,nz:number,cells:Uint8Array}} spec */
  constructor({ cell, minX, minZ, nx, nz, cells, ground = null, overBase = 1.6, overStep = 0.1 }) {
    this.ground = ground;
    this.overBase = overBase;
    this.overStep = overStep;
    this.kind = "grid";
    this.cell = cell;
    this.minX = minX;
    this.minZ = minZ;
    this.nx = nx;
    this.nz = nz;
    this.cells = cells;
  }

  static fromBaked(zone, baked) {
    return new CollisionGrid({
      cell: baked.cell, overBase: baked.overBase, overStep: baked.overStep,
      minX: zone.minX, minZ: zone.minZ, nx: zone.nx, nz: zone.nz,
      cells: decodeRuns(zone.grid, zone.nx * zone.nz),
      ground: zone.ground ? decodeRuns(zone.ground, zone.nx * zone.nz) : null,
    });
  }

  /** Cell value at integer cell coordinates; everything off the grid is solid. */
  at(ix, iz) {
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return WALK_BLOCKED;
    return this.cells[iz * this.nx + ix];
  }

  valueAt(x, z) {
    return this.at(Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell));
  }

  /** True when a disc of the given radius at (x, z) touches a blocked cell. */
  circleBlocked(x, z, radius) {
    const c = this.cell;
    const ix0 = Math.floor((x - radius - this.minX) / c);
    const ix1 = Math.floor((x + radius - this.minX) / c);
    const iz0 = Math.floor((z - radius - this.minZ) / c);
    const iz1 = Math.floor((z + radius - this.minZ) / c);
    const r2 = radius * radius;
    for (let iz = iz0; iz <= iz1; iz++) {
      const cz0 = this.minZ + iz * c;
      const dz = z < cz0 ? cz0 - z : z > cz0 + c ? z - cz0 - c : 0;
      for (let ix = ix0; ix <= ix1; ix++) {
        if (!(this.at(ix, iz) & WALK_BLOCKED)) continue;
        const cx0 = this.minX + ix * c;
        const dx = x < cx0 ? cx0 - x : x > cx0 + c ? x - cx0 - c : 0;
        if (dx * dx + dz * dz < r2) return true;
      }
    }
    return false;
  }

  /** Height in metres of the mat, rug or kerb under a foot-sized patch at
   * (x, z); 0 on bare floor. The highest point under the patch wins, so a
   * step up happens as the toes reach the edge. */
  groundAt(x, z, radius = 0.16) {
    if (!this.ground) return 0;
    const c = this.cell;
    const ix0 = Math.floor((x - radius - this.minX) / c), ix1 = Math.floor((x + radius - this.minX) / c);
    const iz0 = Math.floor((z - radius - this.minZ) / c), iz1 = Math.floor((z + radius - this.minZ) / c);
    let top = 0;
    for (let iz = iz0; iz <= iz1; iz++) {
      if (iz < 0 || iz >= this.nz) continue;
      for (let ix = ix0; ix <= ix1; ix++) {
        if (ix < 0 || ix >= this.nx) continue;
        const i = iz * this.nx + ix;
        if (!(this.cells[i] & WALK_BLOCKED) && this.ground[i] > top) top = this.ground[i];
      }
    }
    return top / 100;
  }

  /** Height of the underside of whatever is overhead at (x, z); Infinity
   * under open air (and outside the zone). */
  ceilingAt(x, z) {
    const ix = Math.floor((x - this.minX) / this.cell), iz = Math.floor((z - this.minZ) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return Infinity;
    const code = this.cells[iz * this.nx + ix] >> 3;
    return code ? this.overBase + code * this.overStep : Infinity;
  }

  /** Would a camera at (x, z), `height` above the floor, be inside
   * something? `slim` says whether narrow things count. */
  _cameraHits(x, z, height, slim) {
    const ix = Math.floor((x - this.minX) / this.cell), iz = Math.floor((z - this.minZ) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return false;   // outside the zone is open air
    const value = this.cells[iz * this.nx + ix];
    if (value & WALL) return true;
    const code = value >> 3;
    if (!code || (!slim && (value & SLIM))) return false;
    return height >= this.overBase + code * this.overStep - CAMERA_CLEARANCE;
  }

  /**
   * How far back a camera can go from (x, z) along (dx, dz) before
   * something gets between it and the player. The camera travels along a
   * boom that climbs from `fromY` at the player to `toY` at `maxDistance`,
   * so an awning only counts where the boom is high enough to meet it.
   * Slim things (columns) are looked past. Returns a distance in
   * [0, maxDistance].
   */
  cameraReach(x, z, dx, dz, maxDistance, fromY = 1.5, toY = 3) {
    const step = this.cell * 0.5;
    this.reachHitWall = false;
    for (let d = step; d <= maxDistance; d += step) {
      const px = x + dx * d, pz = z + dz * d;
      const height = fromY + (toY - fromY) * (d / maxDistance);
      if (this._cameraHits(px, pz, height, false)) {
        // Lets the caller tell a solid wall from something merely overhead.
        this.reachHitWall = (this.at(Math.floor((px - this.minX) / this.cell), Math.floor((pz - this.minZ) / this.cell)) & WALL) !== 0;
        return d;
      }
    }
    return maxDistance;
  }

  /** True when a camera at (x, z) and this height would be inside a wall,
   * a column, a tree crown or an awning. */
  cameraSpotBlocked(x, z, height, radius = 0.3) {
    for (let oz = -radius; oz <= radius; oz += radius) {
      for (let ox = -radius; ox <= radius; ox += radius) {
        if (this._cameraHits(x + ox, z + oz, height, true)) return true;
      }
    }
    return false;
  }

  /** The closest spot to (x, z) where a disc of this radius fits, or null. */
  nearestOpen(x, z, radius, maxDistance = 4) {
    if (!this.circleBlocked(x, z, radius)) return { x, z };
    const step = this.cell;
    for (let r = step; r <= maxDistance; r += step) {
      const count = Math.max(8, Math.ceil((Math.PI * 2 * r) / step));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (!this.circleBlocked(px, pz, radius)) return { x: px, z: pz };
      }
    }
    return null;
  }
}

let cached = null;

/** Loads the baked collision once. Resolves to
 * { mall: [{grid, seats}, x3], park: {grid, seats} }, or null if the file
 * is missing (the game then falls back to its simple boundary boxes). */
export function loadGroveCollision() {
  if (!cached) {
    const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "http://localhost/";
    cached = fetch(new URL(COLLISION_FILE, base).href)
      .then((response) => (response.ok ? response.json() : null))
      .then((baked) => (baked ? parseGroveCollision(baked) : null))
      .catch((error) => {
        console.warn("[grove] collision data failed to load", error);
        return null;
      });
  }
  return cached;
}

export function parseGroveCollision(baked) {
  const zone = (entry) => ({ grid: CollisionGrid.fromBaked(entry, baked), seats: entry.seats ?? [] });
  return { mall: baked.mall.map(zone), park: baked.park ? zone(baked.park) : null };
}
