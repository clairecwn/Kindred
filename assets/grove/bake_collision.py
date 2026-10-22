#!/usr/bin/env python3
"""Bake the Grove's walk grid, camera grid and seats from the staged GLBs.

Run after validate_and_stage_exports.mjs, from the project root:

    python3 assets/grove/bake_collision.py

Needs only numpy (Blender's bundled Python has it too). Reads
frontend/public/models/env/grove/*.glb, writes frontend/public/models/env/grove/grove_collision.json.

Each zone (the park, and each of the three mall levels) becomes one grid
of CELL-sized squares in game coordinates (x, z; y is up). Every cell is
one byte:
  bit 0     blocked for walking: no floor under it, or something stands on it
  bit 1     wall: blocked from the floor up past head height and wide, so
            the camera may neither look through it nor sit in it
  bit 2     slim: the thing overhead here is narrow (a column, a lamp, a
            hanging sign); the camera may look past it but not sit in it
  bits 3-7  overhead: 0 for open air, else the underside of the lowest thing
            above head height is at OVER_BASE + n * OVER_STEP metres
Beside it each zone carries a second grid, "ground": the height in centimetres of whatever low thing lies on the
floor there (a doormat, a rug, a kerb), so feet land on top of it instead of sinking in.

Seats are found by name (Bench, Stool, Chair, Armchair, Sofa, Beanbag). Each place on a seat records where it is,
how high the seat is, its depth, and which way a sitter faces, decided in this order: away from a backrest; else
toward the table or counter the seat is pulled up to; else left to the game (face the way you walked up).
The game reads all of this in src/grove/player/collisionGrid.js.
"""
import base64, json, os, re, struct, sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "frontend", "public", "models", "env", "grove")
OUT = os.path.join(MODELS, "grove_collision.json")

CELL = 0.125
STEP = 0.05                 # surface sampling spacing, well under one cell
FLOOR_BAND = (-0.15, 0.21)  # an up-facing surface here is floor
LOW_BAND = (0.24, 1.95)     # anything here is in the player's way (the cast is a little under 2 m tall, hair included)
TALL_BAND = (1.9, 3.8)      # walls: solid through this band
OVER_BAND = (1.9, 4.3)      # overhead: anything the camera could run into
OVER_BASE, OVER_STEP = 1.6, 0.1
TABLE_BAND = (0.6, 1.2)     # a table, counter or bar top a seat can be pulled up to
TABLE_REACH = 0.8           # ...if it is within this of the seat's edge
SMALL_BLOCKER = 2.3         # tall things narrower than this never stop the camera

SHOP_FLOORS = {
    "grove_grocer": 0, "thread_and_thimble": 0, "home_nook": 0, "cafe_canopy": 0,
    "sole_search": 1, "pixel_pantry": 1, "maker_meadow": 1, "seasonal_pop_up": 1,
    "book_burrow": 2, "alltimefitness": 2, "food_hall": 2, "rooftop_garden": 2,
}
MALL_BOUNDS = (-30.5, 30.5, -24.5, 22.5)    # minX, maxX, minZ, maxZ
PARK_BOUNDS = (-31.0, 31.0, -49.0, -20.5)  # inside the hedges; the gate stays shut

# The mall doors are where one zone hands over to the other, so each zone
# treats everything past the doorway as solid wall. Otherwise the camera
# backs out through the open door and looks in at the player through the
# frame. (zone attribute, comparison, z)
SEALS = {"mall": ("max_z_below", -21.7), "park": ("min_z_above", -22.6)}

# Moving parts and hanging or flat dressing never block.
IGNORE = re.compile(r"^ESC_|Pendant|Backdrop_|_Label|Ribbon|Medallion", re.I)
# Things that stand on the ground but are light overhead: flowers, balloon stands, the signpost with its bunting.
# Their lower part stops the player like anything else; their strings and tops are not something the camera has
# to duck under, so they never count as overhead or as a wall.
LOW_ONLY = re.compile(r"Bunting|Balloon|GrovePark_Flower", re.I)
# Things a character can sit on. Legs and arms are left out of the measuring.
SEAT = re.compile(r"Bench|Stool|Chair|Armchair|Sofa|Beanbag", re.I)
SEAT_SKIP = re.compile(r"_Leg|_Arm_|Workbench", re.I)
# Planters, vending machines and other dressing are table-height too, but nobody pulls a seat up to them.
NOT_A_TABLE = re.compile(r"^Fill_|Planter|Bush|Tree|Plant|Hedge|Balustrade|Queue", re.I)

# ── GLB reading ───────────────────────────────────────────────────────────
CT = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def _accessor(doc, blob, index):
    a = doc["accessors"][index]
    view = doc["bufferViews"][a["bufferView"]]
    fmt, size = CT[a["componentType"]]
    n = NC[a["type"]]
    offset = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = view.get("byteStride", 0)
    if stride and stride != size * n:
        raw = np.frombuffer(blob, dtype=np.uint8, count=stride * (a["count"] - 1) + size * n, offset=offset)
        pick = np.arange(a["count"])[:, None] * stride + np.arange(size * n)[None, :]
        return raw[pick].copy().view("<" + fmt).reshape(a["count"], n)
    return np.frombuffer(blob, dtype="<" + fmt, count=a["count"] * n, offset=offset).reshape(a["count"], n)


def _local_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=float).reshape(4, 4).T
    t = node.get("translation", [0, 0, 0])
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    s = node.get("scale", [1, 1, 1])
    r = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])
    m = np.eye(4)
    m[:3, :3] = r * np.array(s)[None, :]
    m[:3, 3] = t
    return m


def read_glb(name):
    """Every mesh node as (node name, triangles[n,3,3]) in game coordinates."""
    with open(os.path.join(MODELS, name + ".glb"), "rb") as fh:
        data = fh.read()
    json_len = struct.unpack("<I", data[12:16])[0]
    doc = json.loads(data[20:20 + json_len])
    start = 20 + json_len
    blob = data[start + 8:start + 8 + struct.unpack("<I", data[start:start + 4])[0]]
    out = []

    def walk(index, parent):
        node = doc["nodes"][index]
        world = parent @ _local_matrix(node)
        if "mesh" in node:
            for prim in doc["meshes"][node["mesh"]]["primitives"]:
                pos = _accessor(doc, blob, prim["attributes"]["POSITION"]).astype(float)
                pos = pos @ world[:3, :3].T + world[:3, 3]
                if "indices" in prim:
                    idx = _accessor(doc, blob, prim["indices"]).reshape(-1, 3).astype(np.int64)
                else:
                    idx = np.arange(len(pos)).reshape(-1, 3)
                out.append((node.get("name", ""), pos[idx]))
        for child in node.get("children", []):
            walk(child, world)

    for root in doc["scenes"][doc.get("scene", 0)]["nodes"]:
        walk(root, np.eye(4))
    return out


# ── Surface sampling ──────────────────────────────────────────────────────
def sample(tris):
    """Points spread over every triangle no further apart than STEP.
    Returns (points[m,3], up[m]) where up marks points on up-facing faces."""
    if not len(tris):
        return np.zeros((0, 3)), np.zeros(0, dtype=bool)
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    normal = np.cross(b - a, c - a)
    length = np.linalg.norm(normal, axis=1)
    up = normal[:, 1] > 0.7 * np.maximum(length, 1e-12)
    edge = np.maximum.reduce([
        np.linalg.norm(b - a, axis=1), np.linalg.norm(c - b, axis=1), np.linalg.norm(a - c, axis=1)])
    n = np.clip(np.ceil(edge / STEP).astype(int), 1, None)
    points, flags = [], []
    for k in np.unique(n):
        pick = np.nonzero(n == k)[0]
        i, j = np.meshgrid(np.arange(k + 1), np.arange(k + 1), indexing="ij")
        keep = i + j <= k
        u = (i[keep] / k)[None, :, None]
        v = (j[keep] / k)[None, :, None]
        per = u.shape[1]
        chunk = max(1, 1_500_000 // per)
        for s in range(0, len(pick), chunk):
            p = pick[s:s + chunk]
            pts = a[p][:, None, :] * (1 - u - v) + b[p][:, None, :] * u + c[p][:, None, :] * v
            points.append(pts.reshape(-1, 3))
            flags.append(np.repeat(up[p], per))
    return np.concatenate(points), np.concatenate(flags)


class Zone:
    def __init__(self, name, bounds, y0):
        self.name, self.y0 = name, y0
        self.min_x, self.max_x, self.min_z, self.max_z = bounds
        self.nx = int(round((self.max_x - self.min_x) / CELL))
        self.nz = int(round((self.max_z - self.min_z) / CELL))
        self.floor = np.zeros((self.nz, self.nx), dtype=bool)
        self.low = np.zeros_like(self.floor)
        self.tall = np.zeros_like(self.floor)
        self.over = np.full(self.floor.shape, np.inf)
        self.ground = np.zeros(self.floor.shape)
        self.table = np.zeros_like(self.floor)

    def add(self, tris, seat=False, low_only=False):
        y = tris[:, :, 1] - self.y0
        near = (y.max(axis=1) >= FLOOR_BAND[0]) & (y.min(axis=1) <= TALL_BAND[1])
        x, z = tris[:, :, 0], tris[:, :, 2]
        near &= (x.max(axis=1) >= self.min_x) & (x.min(axis=1) <= self.max_x)
        near &= (z.max(axis=1) >= self.min_z) & (z.min(axis=1) <= self.max_z)
        pts, up = sample(tris[near])
        if not len(pts):
            return
        ix = np.floor((pts[:, 0] - self.min_x) / CELL).astype(int)
        iz = np.floor((pts[:, 2] - self.min_z) / CELL).astype(int)
        inside = (ix >= 0) & (ix < self.nx) & (iz >= 0) & (iz < self.nz)
        y = pts[:, 1] - self.y0
        if low_only:
            hit = inside & (y >= LOW_BAND[0]) & (y <= LOW_BAND[1])
            self.low[iz[hit], ix[hit]] = True
            return
        for mask, band, extra in ((self.floor, FLOOR_BAND, up), (self.low, LOW_BAND, True), (self.tall, TALL_BAND, True)):
            hit = inside & (y >= band[0]) & (y <= band[1]) & extra
            mask[iz[hit], ix[hit]] = True
        hit = inside & (y >= OVER_BAND[0]) & (y <= OVER_BAND[1])
        np.minimum.at(self.over, (iz[hit], ix[hit]), y[hit])
        hit = inside & up & (y > 0.004) & (y < LOW_BAND[0])
        np.maximum.at(self.ground, (iz[hit], ix[hit]), y[hit])
        if not seat:
            hit = inside & up & (y >= TABLE_BAND[0]) & (y <= TABLE_BAND[1])
            self.table[iz[hit], ix[hit]] = True

    def ground_cm(self):
        """Height of mats, rugs and kerbs, in whole centimetres (0 on bare floor)."""
        return np.clip(np.round(self.ground * 100), 0, 255).astype(np.uint8)

    def table_dir(self, x, z, reach):
        """Unit vector from (x, z) to the nearest table-height surface within reach, or None."""
        r = int(np.ceil(reach / CELL)); ix = int((x - self.min_x) / CELL); iz = int((z - self.min_z) / CELL)
        z0, z1, x0, x1 = max(iz - r, 0), min(iz + r + 1, self.nz), max(ix - r, 0), min(ix + r + 1, self.nx)
        zs, xs = np.nonzero(self.table[z0:z1, x0:x1])
        if not len(zs):
            return None
        dx = (xs + x0 + 0.5) * CELL + self.min_x - x; dz = (zs + z0 + 0.5) * CELL + self.min_z - z
        d = np.hypot(dx, dz); k = int(np.argmin(d))
        if d[k] > reach or d[k] < 1e-6:
            return None
        near = d <= d[k] + 0.3                      # average the closest edge, so a round table gives its centre line
        v = np.array([dx[near].mean(), dz[near].mean()]); n = np.linalg.norm(v)
        return v / n if n > 1e-6 else None

    def grid(self):
        floor = close(self.floor)
        blocked = ~largest_region(floor & ~self.low)
        overhead = np.isfinite(self.over)
        wall = wide_only(self.low & self.tall)
        slim = overhead & ~wide_only(overhead) & ~wall
        code = np.zeros(self.floor.shape, dtype=np.uint8)
        code[overhead] = np.clip(np.round((self.over[overhead] - OVER_BASE) / OVER_STEP), 1, 31).astype(np.uint8)
        out = (blocked.astype(np.uint8) | (wall.astype(np.uint8) << 1) | (slim.astype(np.uint8) << 2) | (code << 3)).astype(np.uint8)
        rule, edge = SEALS["park" if self.name == "park" else "mall"]
        row = int(round((edge - self.min_z) / CELL))
        if rule == "max_z_below":
            out[:row, :] = 3
        else:
            out[row:, :] = 3
        return out


def shift(mask, dz, dx):
    out = np.zeros_like(mask)
    h, w = mask.shape
    out[max(dz, 0):h + min(dz, 0), max(dx, 0):w + min(dx, 0)] = mask[max(-dz, 0):h + min(-dz, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def close(mask):
    """Fill pinholes between floor tiles (grow by one cell, then shrink back)."""
    grown = mask.copy()
    for dz in (-1, 0, 1):
        for dx in (-1, 0, 1):
            grown |= shift(mask, dz, dx)
    shrunk = grown.copy()
    for dz in (-1, 0, 1):
        for dx in (-1, 0, 1):
            shrunk &= shift(grown, dz, dx)
    return shrunk | mask


def wide_only(mask):
    """Columns, lamp posts and tree trunks should not shove the camera about:
    keep only tall blockers wider than SMALL_BLOCKER in some direction."""
    keep = np.zeros_like(mask)
    seen = np.zeros_like(mask)
    h, w = mask.shape
    for z0, x0 in zip(*np.nonzero(mask)):
        if seen[z0, x0]:
            continue
        stack, cells = [(z0, x0)], []
        seen[z0, x0] = True
        while stack:
            z, x = stack.pop()
            cells.append((z, x))
            for dz in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    zz, xx = z + dz, x + dx
                    if 0 <= zz < h and 0 <= xx < w and mask[zz, xx] and not seen[zz, xx]:
                        seen[zz, xx] = True
                        stack.append((zz, xx))
        zs, xs = np.array(cells).T
        if max(np.ptp(zs), np.ptp(xs)) * CELL >= SMALL_BLOCKER:
            keep[zs, xs] = True
    return keep


def largest_region(mask):
    """Only the main connected area is walkable: drops treetops that read
    as floor from above, the insides of hollow props and sealed rooms."""
    label = np.zeros(mask.shape, dtype=np.int32)
    h, w = mask.shape
    best, best_size, current = 0, 0, 0
    for z0, x0 in zip(*np.nonzero(mask)):
        if label[z0, x0]:
            continue
        current += 1
        label[z0, x0] = current
        stack, size = [(z0, x0)], 0
        while stack:
            z, x = stack.pop()
            size += 1
            for zz, xx in ((z + 1, x), (z - 1, x), (z, x + 1), (z, x - 1)):
                if 0 <= zz < h and 0 <= xx < w and mask[zz, xx] and not label[zz, xx]:
                    label[zz, xx] = current
                    stack.append((zz, xx))
        if size > best_size:
            best, best_size = current, size
    return label == best if best else mask


def pack(grid):
    """Run-length bytes (value, run) as base64; rows run along x."""
    flat = grid.ravel()
    edges = np.flatnonzero(np.diff(flat)) + 1
    starts = np.concatenate(([0], edges))
    runs = np.diff(np.concatenate((starts, [len(flat)])))
    out = bytearray()
    for value, run in zip(flat[starts], runs):
        while run > 0:
            n = min(int(run), 255)
            out += bytes((int(value), n))
            run -= n
    return base64.b64encode(bytes(out)).decode("ascii")


# ── Seats ─────────────────────────────────────────────────────────────────
def seats_from(parts, y0, floor, zone):
    """Group seat parts that touch, then read the seat top, its long axis
    and (when it has a back) which way a sitter faces."""
    boxes = [(t[:, :, 0].min(), t[:, :, 0].max(), t[:, :, 2].min(), t[:, :, 2].max()) for _, t in parts]
    group = list(range(len(parts)))

    def find(i):
        while group[i] != i:
            group[i] = group[group[i]]
            i = group[i]
        return i

    for i in range(len(parts)):
        for j in range(i):
            a, b = boxes[i], boxes[j]
            if a[0] <= b[1] + 0.02 and b[0] <= a[1] + 0.02 and a[2] <= b[3] + 0.02 and b[2] <= a[3] + 0.02:
                group[find(i)] = find(j)
    seats = []
    for root in sorted({find(i) for i in range(len(parts))}):
        tris = np.concatenate([parts[i][1] for i in range(len(parts)) if find(i) == root])
        label = parts[root][0]
        pts, up = sample(tris)
        y = pts[:, 1] - y0
        top = pts[up & (y > 0.1) & (y < 0.7)]
        if len(top) < 60:                 # too small to sit on (a shoe left beside a bench, say)
            continue
        heights = np.round((top[:, 1] - y0) / 0.02).astype(int)
        values, counts = np.unique(heights, return_counts=True)
        # The seat is the highest broad flat level: an armchair's cushion, not the base hidden under it.
        # (Chair arms are broad and flat too, so prefer a level at ordinary seat height when there is one.)
        broad = values[counts >= 0.45 * counts.max()]
        seat_y = (broad[broad <= 31].max() if (broad <= 31).any() else broad.max()) * 0.02
        if seat_y < 0.28:
            continue
        pad = top[np.abs(top[:, 1] - y0 - seat_y) < 0.035][:, [0, 2]]
        centre = pad.mean(axis=0)
        cov = np.cov((pad - centre).T)
        w, v = np.linalg.eigh(cov)
        long_axis = v[:, 1]
        along = (pad - centre) @ long_axis
        across = (pad - centre) @ v[:, 0]
        length, depth = np.ptp(along), np.ptp(across)
        if length < depth * 1.25:      # round or square: no meaningful long axis
            long_axis = np.array([1.0, 0.0])
            along = (pad - centre) @ long_axis
            length = np.ptp(along)
        side = np.array([-long_axis[1], long_axis[0]])
        elongated = length >= depth * 1.25
        beanbag = "beanbag" in label.lower()
        if beanbag:                                   # no flat top: sit in the hollow, two thirds of the way up
            seat_y = round(float((pts[:, 1] - y0).max()) * 0.62, 2)
        back = pts[(y > seat_y + 0.12)][:, [0, 2]]
        heading = None
        if len(back) > 20:
            offset = centre - back.mean(axis=0)
            if elongated and abs(offset @ side) > 0.08:
                facing = side * np.sign(offset @ side)
                heading = float(np.arctan2(facing[0], facing[1]))
            elif not elongated and np.linalg.norm(offset) > 0.05:
                heading = float(np.arctan2(offset[0], offset[1]))
        places = max(1, int(length // 0.95)) if length > 1.5 else 1
        mid = (along.max() + along.min()) / 2
        span = length / places
        for k in range(places):
            slot = mid + (k - (places - 1) / 2) * span
            here = pad[np.abs(along - slot) <= span / 2 + 1e-6]
            if len(here) < 8:
                continue
            p = here.mean(axis=0)
            slot_depth = 0.0 if beanbag else float(np.ptp((here - p) @ side))
            face, at_table = heading, False
            if face is None:                           # no backrest: is this seat pulled up to a table or counter?
                toward = zone.table_dir(p[0], p[1], slot_depth / 2 + TABLE_REACH)
                if toward is not None:
                    if elongated:                      # a bench sits square to its table
                        toward = side * (1.0 if toward @ side >= 0 else -1.0)
                    face, at_table = float(np.arctan2(toward[0], toward[1])), True
            seats.append({
                "name": label, "floor": floor,
                # centre of this place on the seat, and the seat top above the floor
                "x": round(float(p[0]), 3), "z": round(float(p[1]), 3), "y": round(float(seat_y), 3),
                # which way a sitter faces: away from a backrest, or toward the table the seat is at
                "heading": None if face is None else round(face, 4),
                "table": at_table,
                # backless, long and free-standing (a bench): sit facing one of its two long sides
                "side": round(float(np.arctan2(side[0], side[1])), 4) if face is None and elongated else None,
                # front-to-back size of the seat, so the game can sit the
                # character at the front edge with the legs clear of it
                "depth": round(slot_depth, 3),
            })
    return seats


def main():
    mall = [Zone(f"mall-{f + 1}", MALL_BOUNDS, 5.0 * f) for f in range(3)]
    park = Zone("park", PARK_BOUNDS, 0.0)
    seat_parts = {"park": [], 0: [], 1: [], 2: []}

    def feed(module, zones, seat_key=None):
        for name, tris in read_glb(module):
            if SEAT.search(name) and not SEAT_SKIP.search(name):
                if seat_key is not None:
                    seat_parts[seat_key].append((name, tris))
                else:   # the shared building: file each seat under the level it stands on
                    seat_parts[int(np.clip(round(tris[:, :, 1].min() / 5.0), 0, 2))].append((name, tris))
            if IGNORE.search(name):
                continue
            for zone in zones:
                is_seat = bool(SEAT.search(name)) and not SEAT_SKIP.search(name)
                zone.add(tris, seat=is_seat or bool(NOT_A_TABLE.search(name)), low_only=bool(LOW_ONLY.search(name)))

    feed("grove_architecture", mall)
    for module, floor in SHOP_FLOORS.items():
        feed(module, [mall[floor]], floor)
    feed("grove_exterior", [park], "park")

    def export(zone, seats):
        grid = zone.grid()
        return {
            "minX": zone.min_x, "minZ": zone.min_z, "nx": zone.nx, "nz": zone.nz,
            "grid": pack(grid), "ground": pack(zone.ground_cm()), "seats": seats,
            "open": int(((grid & 1) == 0).sum()), "walls": int(((grid & 2) != 0).sum()),
        }, grid

    result = {"cell": CELL, "overBase": OVER_BASE, "overStep": OVER_STEP, "mall": [], "park": None}
    grids = {}
    for f, zone in enumerate(mall):
        entry, grids[zone.name] = export(zone, seats_from(seat_parts[f], zone.y0, f, zone))
        result["mall"].append(entry)
    park_seats = [s for s in seats_from(seat_parts["park"], 0.0, 0, park) if s["z"] < -22.5]
    result["park"], grids["park"] = export(park, park_seats)
    with open(OUT, "w") as fh:
        json.dump(result, fh, separators=(",", ":"))
    print(f"wrote {OUT} ({os.path.getsize(OUT)} bytes)")
    for key in ("mall", ):
        for f, entry in enumerate(result[key]):
            print(f"  level {f + 1}: {entry['open']} open cells, {entry['walls']} wall cells, {len(entry['seats'])} seats")
    print(f"  park: {result['park']['open']} open cells, {result['park']['walls']} wall cells, {len(result['park']['seats'])} seats")
    if "--debug" in sys.argv:
        np.savez_compressed(os.path.join(os.path.dirname(OUT), "..", "..", "..", "..", "_collision_debug.npz"), **grids)


if __name__ == "__main__":
    main()
