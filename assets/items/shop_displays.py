#!/usr/bin/env python3
"""Where the buyable item models stand in each Grove shop. Run from the project root:  python3 assets/items/shop_displays.py
Writes frontend/public/models/items/shop_displays.json. Nothing in the Grove file or its exports is touched: the stands
(shop_display_kit.glb) and the items (items_<shop>.glb) are drawn on top of the mall by the game.

Everything is in the shop's own frame, the one the Grove was built in: x to the right as seen from the lane,
y towards the back wall (the open front is at y = -3.4, the back wall at +3.45), z up from the shop floor.
A stand is placed by hand below; the items on it are spaced from their real sizes. The script then checks every
layout against the mall's baked collision grid: a stand may only cover free floor, every part of the shop a player
could walk to before can still be walked to, and next to every stand there is a place to stand inside the shop."""
import json, os, sys, base64, math, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(HERE, "blender", "passes"))
import sdspec
from sdspec import STANDS, ROWS, RING, CROWN, TIERS, PLINTH, HOOK, BOARD
ITEMS = json.load(open(os.path.join(ROOT, "frontend", "public", "models", "items", "items.json")))["items"]
GRID = json.load(open(os.path.join(ROOT, "frontend", "public", "models", "env", "grove", "grove_collision.json")))
PLAYER = 0.36                     # the player's radius in the game
FRONT, BACK, HALF = -3.4, 3.45, 5.75

# shop id: floor, centre in the game (x, z), accent colour. Thread + Thimble is on hold and has no display yet.
SHOPS = {"grove-grocer": (0, -20, 14, "green"), "home-nook": (0, 20, -14, "terracotta"), "cafe-canopy": (0, -20, -14, "red"),
         "sole-search": (1, -20, 14, "blue"), "pixel-pantry": (1, 20, 14, "purple"), "maker-meadow": (1, -20, -14, "gold"),
         "seasonal-pop-up": (1, 20, -14, "rose"), "book-burrow": (2, -20, 14, "teal"), "alltimefitness": (2, 20, 14, "sky"),
         "food-hall": (2, -20, -14, "orange"), "rooftop-garden": (2, 20, -14, "leaf_dark")}

# ---------------------------------------------------------------- the layouts, by hand
# a stand: (kind of stand, x, y, what stands where)
#   table   front=[ids], back=[ids]          plinth / stage   at={id: (x, y) on the stand}
#   round   ring=[ids], top=id                rack             tiers=[[ids], [ids], [ids]] from the front step up
#   head    item=id                           floor            an item with no stand, lying or standing on the shop floor
LAYOUT = {
    "grove-grocer": [("SD_Table_M", -0.85, -1.7, dict(front=["gro-breadloaf", "gro-fruitbowl", "gro-eggbasket", "gro-honeyjar"], back=["gro-teatin", "gro-plantpot", "gro-seedpack"]))],
    "home-nook": [("SD_Stage", -0.65, -1.95, dict(at={"fur-lamp": (-1.0, 0.28), "fur-shelf": (0.02, 0.3), "fur-birdhouse": (1.05, 0.3), "fur-planter": (-0.5, -0.38), "fur-stool": (0.72, -0.34)})),
                  ("floor", 3.6, -2.45, dict(item="fur-rug"))],
    "cafe-canopy": [("SD_Table_S", -2.45, -2.4, dict(front=["eat-mug", "eat-tart", "eat-teapot"], back=["eat-honeyjar"])),
                    ("floor", -4.45, -2.65, dict(item="eat-picnicmat"))],
    "sole-search": [("SD_Table_M", 0.0, -1.75, dict(front=["sho-cloudstep", "sho-sockroll", "sho-sunsandal"], back=["sho-ankleboot", "sho-rainboot"]))],
    "pixel-pantry": [("SD_Table_S", -0.9, -1.75, dict(front=["gam-handheld", "gam-controller", "gam-collectible"], back=["gam-adventure"])),
                     ("SD_Head", 0.55, -1.75, dict(item="gam-headphones"))],
    "maker-meadow": [("SD_Table_M", -0.9, -1.75, dict(front=["mak-paint", "mak-yarn", "mak-toolbox"], back=["mak-birdhouse", "mak-sewing"])),
                     ("SD_Plinth", 1.35, -1.75, dict(at={"mak-fence": (0.0, 0.26), "mak-wood": (0.0, -0.2)}))],
    "seasonal-pop-up": [("SD_Table_S", 0.0, -1.8, dict(front=["sea-gift", "sea-tree"], back=["sea-lantern", "sea-ribbon"]))],
    "book-burrow": [("SD_Table_S", 0.0, -1.9, dict(front=["boo-storybook", "boo-cookbook", "boo-fieldguide"], back=["boo-journal", "boo-sketchbook"]))],
    "alltimefitness": [("SD_Table_S", -0.75, -1.9, dict(front=["wel-candle", "wel-bathoil", "wel-balmbottle"], back=["wel-yogamat"])),
                       ("SD_Plinth", 1.15, -1.9, dict(at={"wel-cushion": (0.0, 0.0)}))],
    "food-hall": [("SD_Round", -0.4, -1.8, dict(ring=["foo-soup", "foo-noodlebowl", "foo-teatray", "foo-ricebowl"], top="foo-fruitcup"))],
    "rooftop-garden": [("SD_Rack", -3.5, -2.45, dict(tiers=[["gar-wateringcan", "gar-strawberryseed", "gar-fern", "gar-flowerpot"],
                                                             ["gar-cabbageseed", "gar-carrotseed", "gar-cornseed", "gar-daisyseed", "gar-lavenderseed", "gar-pumpkinseed"],
                                                             ["gar-seeds", "gar-sunflowerseed", "gar-tomatoseed", "gar-tulipbulb", "gar-acorn", "gar-rosebush"]])),
                       ("floor", -5.1, -2.45, dict(item="gar-applesapling")), ("floor", -1.95, -2.45, dict(item="gar-orangesapling")),
                       ("SD_Plinth_Wide", 3.25, -2.45, dict(at={"gar-bench": (0.0, 0.0)})), ("floor", 4.97, -2.45, dict(item="gar-planter"))],
}

# ---------------------------------------------------------------- placing items on a stand
def spread(ids, width):
    """Centres along x for items set side by side across `width`, with equal gaps."""
    ws = [ITEMS[i]["size"][0] for i in ids]; gap = (width - sum(ws)) / (len(ids) + 1)
    if gap < 0.02: raise SystemExit("too wide for %.2f m: %s" % (width, ", ".join(ids)))
    out = []; x = -width / 2
    for w in ws: x += gap + w; out.append(x - w / 2)
    return out
def origin_z(id, surface):
    """Height of the item's origin so that its lowest point rests on the surface."""
    return surface - ITEMS[id]["min"][2]
def build(shop):
    stands, extras, spots, solids = [], [], {}, []
    def spot(id, x, y, surface, n, tag=True):
        it = ITEMS[id]; z = origin_z(id, surface); e = {"x": round(x, 3), "y": round(y, 3), "z": round(z, 3), "rz": 0, "stand": n}
        if it["type"] == "hang":          # hangs from a hook that stands on the surface
            extras.append({"mesh": "SD_Hook", "x": round(x, 3), "y": round(y, 3), "z": round(surface, 3), "rz": 0}); e["z"] = round(surface + HOOK["height"], 3)
        elif it["type"] == "wall":        # leans on a small board
            extras.append({"mesh": "SD_Board", "x": round(x, 3), "y": round(y + 0.06, 3), "z": round(surface, 3), "rz": 0})
            e["y"] = round(y + 0.06 + BOARD["face"] - (it["min"][1] + it["size"][1]), 3); e["z"] = round(surface + BOARD["height"] - (it["min"][2] + it["size"][2] / 2), 3)
        if tag: e["tag"] = [round(x, 3), round(y + min(it["min"][1], -0.1) - 0.07, 3), round(surface, 3)]
        spots[id] = e
    for n, (stand, sx, sy, what) in enumerate(LAYOUT[shop]):
        if stand == "floor":
            id = what["item"]; it = ITEMS[id]; spot(id, sx, sy, 0.0, None, tag=False); spots[id]["tag"] = [round(sx + it["min"][0] + 0.12, 3), round(sy + it["min"][1] + 0.1, 3), 0.0] if it["type"] == "rug" else [round(sx, 3), round(sy + it["min"][1] - 0.1, 3), 0.0]
            if it["type"] != "rug": solids.append({"x0": sx + it["min"][0], "x1": sx + it["min"][0] + it["size"][0], "y0": sy + it["min"][1], "y1": sy + it["min"][1] + it["size"][1], "item": id})
            continue
        S = STANDS[stand]; w, d, h = S["size"]; k = len(stands); stands.append({"stand": stand, "x": sx, "y": sy, "z": 0, "rz": 0})
        solids.append({"x0": sx - w / 2, "x1": sx + w / 2, "y0": sy - d / 2, "y1": sy + d / 2, "stand": k} if S["kind"] != "round" and stand != "SD_Plinth" else {"cx": sx, "cy": sy, "r": w / 2, "stand": k})
        if S["kind"] == "table":
            for row in ("front", "back"):
                ids = what.get(row, []); y, z = ROWS[row]
                for id, x in zip(ids, spread(ids, w - (0.16 if row == "front" else 0.3)) if ids else []): spot(id, sx + x, sy + y, z, k, tag=row == "front")
                if row == "back":       # a back-row tag stands on the front lip of the riser
                    for id in ids: spots[id]["tag"] = [spots[id]["x"], round(sy + sdspec.RISER[0] - sdspec.RISER[1] / 2 + 0.05, 3), z]
        elif S["kind"] == "round":
            ids = what["ring"]; r, z = RING
            for i, id in enumerate(ids):
                a = -math.pi / 2 + 2 * math.pi * (i + 0.5) / len(ids) - math.pi / len(ids) * (len(ids) % 2 == 0) * 0 ; a = math.radians({4: (-135, -45, 45, 135), 3: (-90, 30, 150), 5: (-90, -18, 54, 126, 198), 2: (-150, -30)}[len(ids)][i])
                spot(id, sx + r * math.cos(a), sy + r * math.sin(a), z, k, tag=False)
                spots[id]["tag"] = [round(sx + (r + 0.15) * math.cos(a), 3), round(sy + (r + 0.15) * math.sin(a), 3), z]; spots[id]["tag_rz"] = round(a + math.pi / 2, 3)
            if what.get("top"): spot(what["top"], sx, sy, CROWN, k, tag=False); spots[what["top"]]["tag"] = [round(sx, 3), round(sy - 0.2, 3), CROWN]
        elif S["kind"] == "plinth":
            for id, (x, y) in what["at"].items():
                it = ITEMS[id]; spot(id, sx + x, sy + y, PLINTH, k, tag=False); spots[id]["tag"] = [round(sx + x, 3), round(sy - d / 2 + 0.07, 3), PLINTH] if stand != "SD_Plinth" else [round(sx, 3), round(sy - d / 2 + 0.09, 3), PLINTH]
                if abs(x) + it["size"][0] / 2 > w / 2 + 0.005 or y + it["min"][1] < -d / 2 - 0.005 or y + it["min"][1] + it["size"][1] > d / 2 + 0.005: raise SystemExit("%s hangs over %s in %s" % (id, stand, shop))
        elif S["kind"] == "rack":
            for (y, z), ids in zip(TIERS, what["tiers"]):
                for id, x in zip(ids, spread(ids, w - 0.16)): spot(id, sx + x, sy + y, z, k, tag=False); spots[id]["tag"] = [spots[id]["x"], round(sy + y - 0.105, 3), z]
        elif S["kind"] == "head":
            id = what["item"]; e = {"x": sx, "y": sy, "z": round(ITEMS[id].get("lift", sdspec.HEAD_SHOWROOM) - (sdspec.HEAD_SHOWROOM - sdspec.HEAD_Z), 3), "rz": 0, "stand": k, "tag": [round(sx + 0.2, 3), round(sy - 0.22, 3), 0.05]}; spots[id] = e
    for e in spots.values():
        t = e.pop("tag"); extras.append({"mesh": "SD_Tag", "x": t[0], "y": t[1], "z": round(t[2], 3), "rz": e.pop("tag_rz", 0), "for": next(i for i, s in spots.items() if s is e)})
    return stands, extras, spots, solids

# ---------------------------------------------------------------- checking against the mall's collision grid
def decode(s, n):
    b = base64.b64decode(s); out = bytearray(n); at = 0
    for i in range(0, len(b) - 1, 2):
        end = min(n, at + b[i + 1])
        if b[i]: out[at:end] = bytes([b[i]]) * (end - at)
        at = end
    return out
_G = {}
def grid(floor):
    if floor not in _G:
        z = GRID["mall"][floor]; _G[floor] = (decode(z["grid"], z["nx"] * z["nz"]), z["nx"], z["nz"], z["minX"], z["minZ"])
    return _G[floor]
C = GRID["cell"]; NX = int(round(2 * HALF / C)); NY = int(round((BACK - FRONT + 0.5) / C)); Y0 = FRONT - 0.5      # the local map starts half a metre out in the lane
def to_game(shop, lx, ly):
    fl, gx, gz, _ = SHOPS[shop]; k = 1 if gz > 0 else -1; return gx - k * lx, gz + k * ly
def local_map(shop):
    fl = SHOPS[shop][0]; g, nx, nz, mx, mz = grid(fl); m = [[False] * NX for _ in range(NY)]
    for j in range(NY):
        for i in range(NX):
            x, z = to_game(shop, -HALF + (i + 0.5) * C, Y0 + (j + 0.5) * C); ix = int((x - mx) / C); iz = int((z - mz) / C)
            m[j][i] = not (0 <= ix < nx and 0 <= iz < nz) or bool(g[iz * nx + ix] & 1)
    return m
def inside(s, x, y, pad=0.0):
    if "r" in s: return (x - s["cx"]) ** 2 + (y - s["cy"]) ** 2 <= (s["r"] + pad) ** 2
    dx = max(s["x0"] - x, 0, x - s["x1"]); dy = max(s["y0"] - y, 0, y - s["y1"]); return dx * dx + dy * dy <= pad * pad if pad else (dx == 0 and dy == 0)
def reach(blocked, solids):
    """Cells a player's middle can be in, walking in from the lane: clear of walls and stands by the player's radius."""
    R = int(math.ceil(PLAYER / C)); disc = [(a, b) for a in range(-R, R + 1) for b in range(-R, R + 1) if (abs(a) - 0.5) ** 2 + (abs(b) - 0.5) ** 2 <= (PLAYER / C) ** 2 or a == 0 or b == 0 and abs(a) <= R]
    ok = [[True] * NX for _ in range(NY)]
    for j in range(NY):
        for i in range(NX):
            x = -HALF + (i + 0.5) * C; y = Y0 + (j + 0.5) * C
            if any(inside(s, x, y, PLAYER) for s in solids): ok[j][i] = False; continue
            for a, b in disc:
                jj, ii = j + b, i + a
                if 0 <= jj < NY and 0 <= ii < NX and blocked[jj][ii]: ok[j][i] = False; break
    seen = set(); q = collections.deque((i, 0) for i in range(NX) if ok[0][i]); seen.update(q)
    while q:
        i, j = q.popleft()
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ii, jj = i + a, j + b
            if 0 <= ii < NX and 0 <= jj < NY and ok[jj][ii] and (ii, jj) not in seen: seen.add((ii, jj)); q.append((ii, jj))
    return seen
def check(shop, stands, spots, solids):
    blocked = local_map(shop); problems = []
    for s in solids:
        x0, x1, y0, y1 = (s["cx"] - s["r"], s["cx"] + s["r"], s["cy"] - s["r"], s["cy"] + s["r"]) if "r" in s else (s["x0"], s["x1"], s["y0"], s["y1"])
        hit = 0
        for j in range(NY):
            for i in range(NX):
                x = -HALF + (i + 0.5) * C; y = Y0 + (j + 0.5) * C
                if blocked[j][i] and inside(s, x, y): hit += 1
        if hit: problems.append("%s covers %d blocked cells" % (s.get("item") or stands[s["stand"]]["stand"], hit))
        if y0 < -2.69 and x0 < 1.6 and x1 > -1.6: problems.append("%s stands on the entry mat" % (s.get("item") or stands[s["stand"]]["stand"]))
    before = reach(blocked, []); after = reach(blocked, solids)
    lost = [(i, j) for (i, j) in before - after if not any(inside(s, -HALF + (i + 0.5) * C, Y0 + (j + 0.5) * C, PLAYER + 0.4) for s in solids)]
    if lost: problems.append("%d walkable cells are cut off" % len(lost))
    def gap(s, x, y):
        if "r" in s: return max(0.0, math.hypot(x - s["cx"], y - s["cy"]) - s["r"])
        return math.hypot(max(s["x0"] - x, 0, x - s["x1"]), max(s["y0"] - y, 0, y - s["y1"]))
    inside_shop = [(-HALF + (i + 0.5) * C, Y0 + (j + 0.5) * C) for (i, j) in after if Y0 + (j + 0.5) * C > -3.3]
    for id, e in spots.items():
        own = [s for s in solids if (e["stand"] is not None and s.get("stand") == e["stand"]) or s.get("item") == id]
        near = min((gap(own[0], x, y) if own else math.hypot(x - e["x"], y - e["y"]) - 0.55 for x, y in inside_shop), default=9)
        if near > 0.9: problems.append("%s cannot be walked up to (nearest standing point is %.2f m from its stand)" % (id, near))
    return problems, len(before), len(after)

def main():
    doc = {"version": 1, "note": "written by assets/items/shop_displays.py", "kit": "shop_display_kit.glb",
           "frame": {"local": "x to the right seen from the lane, y to the back wall (front -3.4, back +3.45), z up from the shop floor; rz turns about z; an item or stand drawn with its front to -Y faces the lane",
                     "to_game": "k = sign(shop z). game x = shop x - k * local x; game y = floor * 5 + 0.03 + local z; game z = shop z + k * local y; add half a turn about the up axis when k > 0"},
           "stands": STANDS, "shops": {}}
    bad = 0
    for shop in LAYOUT:
        fl, gx, gz, accent = SHOPS[shop]; stands, extras, spots, solids = build(shop)
        want = sorted(i for i, v in ITEMS.items() if v["shop"] == shop); have = sorted(spots)
        problems, n0, n1 = check(shop, stands, spots, solids)
        if want != have: problems.append("items without a spot: %s; spots without an item: %s" % (sorted(set(want) - set(have)), sorted(set(have) - set(want))))
        for s in solids:
            for k_ in ("x0", "x1", "y0", "y1", "cx", "cy", "r"):
                if k_ in s: s[k_] = round(s[k_], 3)
        doc["shops"][shop] = {"accent": accent, "floor": fl, "game": {"x": gx, "z": gz, "k": 1 if gz > 0 else -1}, "stands": stands, "extras": extras, "spots": spots, "solids": solids}
        print("%-16s %d stands, %2d items, walkable %d -> %d cells%s" % (shop, len(stands), len(spots), n0, n1, "".join("\n     ! " + p for p in problems))); bad += len(problems)
    if bad and "--force" not in sys.argv: raise SystemExit("%d problems; nothing written" % bad)
    json.dump(doc, open(os.path.join(ROOT, "frontend", "public", "models", "items", "shop_displays.json"), "w"), indent=1, sort_keys=True); print("written")
if __name__ == "__main__": main()
