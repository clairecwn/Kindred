"""Pass 20: export to the game. Writes five files into frontend/public/models/env/kingdom/:
  kingdom_world.glb       the world and backdrop layers (always there)
  kingdom_kit.glb         every kit mesh as its own node at the origin, named as the mesh (the game makes copies)
  kingdom_collision.json  what the world itself blocks, baked from the meshes: a 0.25 m grid in the Grove's format
                          (walk, wall, overhead bits; ground height in cm) plus a surface grid (1 lawn, 2 path,
                          3 terrace and ramp, 4 dock). A 1 m cell can be built on when all of it is open lawn.
                          Also: `terrain`, the island with its beach and steps (heights below the lawn), and
                          `expansions`, a patch for each piece of land the island can grow into.
  kingdom_expansion.glb   the east and west isles and their bridges, one node each (shown when the land is opened)
  kingdom_layout.json     spawn point, the house site, the Day 1 layout and where the flights of beach steps are
Game axes: x = Blender x, y = Blender z - 2 (the lawn is the floor), z = -Blender y."""
import bpy, os, json, base64, time
import numpy as np
from mathutils.bvhtree import BVHTree
from kk import *
t0 = time.time()
OUT = os.path.join(ROOT, "frontend", "public", "models", "env", "kingdom"); os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene; vl = bpy.context.view_layer
def export(path, objs):
    for o in sc.objects:
        try: o.select_set(False)
        except RuntimeError: pass
    for o in objs: o.select_set(True)
    vl.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_cameras=False, export_lights=False, export_extras=True, **kao.EXPORT)
    return os.path.getsize(path)
import kao, importlib; importlib.reload(kao)
sizes = {}
_kit = NS.get("kk_kit_list") or [o.data.name for o in C("KINGDOM_KIT").objects if o.name.startswith("KIT_")]
import kzfix; importlib.reload(kzfix)
zf = kzfix.fix_all([bpy.data.meshes.get(n) for n in _kit])                   # no two faces fight for the same pixels (kzfix.py)
ao = kao.bake_all([bpy.data.meshes.get(n) for n in _kit if not n.startswith(("KK_Cloud",))])     # soft corner shadows on every kit piece, before the world that uses them is written
world = [o for n in ("KINGDOM_WORLD", "KINGDOM_BACKDROP") for o in C(n).objects if o.type == "MESH"]
sizes["kingdom_world.glb"] = export(os.path.join(OUT, "kingdom_world.glb"), world)
kit_names = NS.get("kk_kit_list") or [o.data.name for o in sorted(C("KINGDOM_KIT").objects, key=lambda o: (-round(o.location.y), o.location.x)) if o.name.startswith("KIT_")]      # the shelf k15 set out, in its order
tmp = bpy.data.collections.new("KINGDOM_KIT_EXPORT"); sc.collection.children.link(tmp); objs = []
for n in kit_names:
    o = bpy.data.objects.new(n + "__export", bpy.data.meshes[n]); tmp.objects.link(o); objs.append(o)
vl.update()
for o, n in zip(objs, kit_names): o.name = n if n not in bpy.data.objects else o.name
sizes["kingdom_kit.glb"] = export(os.path.join(OUT, "kingdom_kit.glb"), objs)
exported_names = [o.name for o in objs]
for o in objs: bpy.data.objects.remove(o, do_unlink=True)
bpy.data.collections.remove(tmp)

# ---- collision and surface bake
CELL = 0.25
SURF = {"K_Home_Island": 1, "K_Path_Spine": 2, "K_Hill_Terrace": 3, "K_Dock": 4, "K_Beach_Steps_S": 6, "K_Beach_Steps_E": 6, "K_Beach_Steps_W": 6, "K_Beach_Steps_N": 6}
TSURF = dict(SURF, K_Home_Beach=5, K_Exp_East_Isle="land", K_Exp_West_Isle="land", K_Exp_East_Terrace=3, K_Exp_East_Bridge=7, K_Exp_West_Bridge=7)
SOLID = ("K_Mailbox",)          # closed solids. The great tree is not one since its crown became open puffs (kgreen): its trunk is given as a circle (kk_posts). The arch is leaves, a bow and a board: counting its faces overhead closed a cell in mid-path, so its two posts are given as circles (kk_posts)
LOW = (0.24, 1.95); OVER_BASE, OVER_STEP = 1.6, 0.1; SEA = -0.3            # sand lower than SEA is under water
DOWN = Vector((0, 0, -1))
def bake(objs, box, surf_table, floor_min, sea=None, step_drop=0.35):
    """Measures what a set of objects blocks over a box (X0, X1, Y0, Y1). Returns grid (walk, wall, overhead bits),
    the floor height above the lawn in metres, and the surface under each cell. A cell with no floor above floor_min
    is closed. step_drop: the drop to a neighbour that still counts as walkable next to a flight of steps."""
    X0, X1, Y0, Y1 = box; nx = int(round((X1 - X0) / CELL)); nz = int(round((Y1 - Y0) / CELL))
    verts = []; polys = []; owner = []; names = []
    for o in objs:
        base_ = len(verts); mw = o.matrix_world; verts += [mw @ v.co for v in o.data.vertices]
        for p in o.data.polygons: polys.append([base_ + i for i in p.vertices]); owner.append(len(names))
        names.append(o.name)
    bvh = BVHTree.FromPolygons(verts, polys)
    strip = {}                                         # a flight of steps is floor only between its side walls
    for o in objs:
        if o.get("kk_steps"): strip[o.name] = (o.matrix_world.inverted(), json.loads(o["kk_steps"])["width"] / 2 + 0.01)
    ftop = {o.name: (o.matrix_world.inverted(), float(o["kk_floor_top"])) for o in objs if o.get("kk_floor_top") is not None}      # a pier is floor only on its deck, not on its bollards and pile caps
    posts = [p for o in objs if o.get("kk_posts") for p in json.loads(o["kk_posts"])]
    def cast(x, y):
        """Everything a plumb line meets at (x, y), top first: (height, is floor, object)."""
        hits = []; z = 40.0
        for _ in range(40):
            loc, nor, idx, dist = bvh.ray_cast(Vector((x, y, z)), DOWN, 60.0)
            if loc is None: break
            nm = names[owner[idx]]; fl = nm in surf_table and nor.z > 0.5
            if fl and nm in strip: fl = abs((strip[nm][0] @ loc).x) <= strip[nm][1]
            if fl and nm in ftop: fl = (ftop[nm][0] @ loc).z <= ftop[nm][1]
            hits.append((loc.z, fl, nm)); z = loc.z - 0.002
        tops = [(hz, nm) for hz, fl, nm in hits if fl]
        floor = max(tops) if tops else None
        return hits, (floor if floor and floor[0] >= floor_min else None)
    grid = np.zeros((nz, nx), dtype=np.uint8); surf = np.zeros((nz, nx), dtype=np.uint8); nofloor = np.zeros((nz, nx), dtype=bool); gh = np.zeros((nz, nx), dtype=np.float32)
    edge = np.zeros((nz, nx), dtype=bool); raw = np.full((nz, nx), -99.0, dtype=np.float32)
    for iz in range(nz):
        yc = Y1 - (iz + 0.5) * CELL
        for ix in range(nx):
            xc = X0 + (ix + 0.5) * CELL
            if sea and xc * xc / sea[0] ** 2 + (yc + 2) ** 2 / sea[1] ** 2 > 1.0: grid[iz, ix] = 1; continue      # open sea: nothing to measure
            if any((xc - px) ** 2 + (yc - py) ** 2 < (pr + 0.09) ** 2 for px, py, pr in posts): grid[iz, ix] = 1; raw[iz, ix] = 0.0; continue      # a post
            S4 = [cast(xc + dx, yc + dy) for dx in (-0.0625, 0.0625) for dy in (-0.0625, 0.0625)]
            floors = [fl for h, fl in S4 if fl]
            if not floors: grid[iz, ix] = 1; nofloor[iz, ix] = True; edge[iz, ix] = True; continue
            F, top = max(floors); b_ = False; w_ = False; ov = None; hole = False; solid = False
            for hits, fl in S4:
                if fl is None: hole = True; b_ = True; continue          # nothing underfoot at this sample
                f = fl[0] if fl[0] > F - 0.35 else F                     # a sample that fell through a gap or past an edge is judged at the cell's height
                bl = False
                for hz, isf, nm in hits:
                    if f + LOW[0] < hz < f + LOW[1] and not (isf and hz - f < 0.3): bl = True; w_ = w_ or nm == "K_Great_Tree"
                for nm in SOLID:                               # inside a closed solid: an odd number of its faces overhead
                    if sum(1 for hz, isf, n2 in hits if n2 == nm and hz > f + 1.0) % 2 == 1: bl = True; w_ = w_ or nm == "K_Great_Tree"
                b_ = b_ or bl; solid = solid or bl
                over = [hz - f for hz, isf, nm in hits if hz >= f + LOW[1]]
                if over: ov = min(over) if ov is None else min(ov, min(over))
            sid = surf_table[top]
            if sid == "land": sid = 1 if F > Z - 0.1 else 5      # one mesh holds an isle's lawn and its beach
            nofloor[iz, ix] = hole and not solid          # closed only because a sample found nothing underfoot
            edge[iz, ix] = hole or F - min(floors)[0] > 0.1    # the cell hangs over a drop
            code = 0
            if ov is not None and ov < OVER_BASE + 31 * OVER_STEP: code = int(min(31, max(1, round((ov - OVER_BASE) / OVER_STEP))))
            grid[iz, ix] = (1 if b_ else 0) | (2 if w_ else 0) | (code << 3)
            surf[iz, ix] = 0 if b_ else sid; gh[iz, ix] = 0.0 if b_ else F - Z; raw[iz, ix] = F - Z
    # a slot with no floor between two open cells (the gaps between a deck's planks) is floor: nobody falls through a crack
    open_ = (grid & 1) == 0
    for axis in (0, 1):
        a_ = np.roll(open_, 1, axis); b2 = np.roll(open_, -1, axis)
        fill = nofloor & a_ & b2; near = np.abs(np.roll(gh, 1, axis) - np.roll(gh, -1, axis)) < 0.3
        fill &= near
        gmean = (np.roll(gh, 1, axis) + np.roll(gh, -1, axis)) / 2
        grid[fill] = 0; surf[fill] = np.roll(surf, 1, axis)[fill]; gh[fill] = gmean[fill]
        nofloor &= ~fill; open_ = (grid & 1) == 0
    # the same for a slot that shows the sand under a deck: it is deck
    for axis in (0, 1):
        open_ = (grid & 1) == 0; deck = open_ & ((surf == 4) | (surf == 7))
        a_ = np.roll(gh, 1, axis); b2 = np.roll(gh, -1, axis)
        slot = np.roll(deck, 1, axis) & np.roll(deck, -1, axis) & (np.abs(a_ - b2) < 0.08) & (raw < a_ - 0.2)
        grid[slot] = 0; surf[slot] = np.roll(surf, 1, axis)[slot]; gh[slot] = ((a_ + b2) / 2)[slot]; raw[slot] = gh[slot]; nofloor &= ~slot; edge &= ~slot
    # a drop of more than 0.35 m is a cliff: the lower cell is closed, so nobody walks through the cliff face
    open_ = (grid & 1) == 0; cliff = np.zeros_like(open_); st = surf == 6
    for dz in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dz == 0 and dx == 0: continue
            sh = np.roll(np.roll(gh, dz, 0), dx, 1); so = np.roll(np.roll(open_, dz, 0), dx, 1); ss = np.roll(np.roll(st, dz, 0), dx, 1)
            cliff |= open_ & so & (sh - gh > np.where(st | ss, step_drop, 0.35))
    grid[cliff] |= 1; surf[cliff] = 0; gh[cliff] = 0.0
    return grid, gh, surf, (X0, X1, Y0, Y1, nx, nz), edge
def pack(a):
    flat = a.ravel(); edges = np.flatnonzero(np.diff(flat)) + 1; starts = np.concatenate(([0], edges)); runs = np.diff(np.concatenate((starts, [len(flat)])))
    out = bytearray()
    for value, run in zip(flat[starts], runs):
        while run > 0:
            n = min(int(run), 255); out += bytes((int(value), n)); run -= n
    return base64.b64encode(bytes(out)).decode("ascii")
def lawn_cells(grid, gh, surf, edge):
    """1 m cells that can be built on: all sixteen quarter-cells open lawn at lawn height."""
    nz, nx = grid.shape; ok = ((grid & 1) == 0) & (surf == 1) & (gh < 0.005) & ~edge; return ok.reshape(nz // 4, 4, nx // 4, 4).all(axis=(1, 3))
WORLD_OBJS = [o for o in C("KINGDOM_WORLD").objects if o.type == "MESH"]
# 1. the home island as the game has it now: the lawn, the paths, the terrace and the dock. The beach is closed here.
lo_, hi_ = world_bb([bpy.data.objects[n] for n in ("K_Home_Island", "K_Dock", "K_Home_Beach")]); R4 = lambda v, up: float(4 * (np.ceil(v / 4) if up else np.floor(v / 4)))      # boxes on whole 4 m, so 1 m cells line up
LAND = [bpy.data.objects[n] for n in ("K_Home_Island", "K_Dock")]; la, lb = world_bb(LAND)
grid, gh, surf, (X0, X1, Y0, Y1, nx, nz), edge = bake(WORLD_OBJS, (R4(la.x - 1, False), R4(lb.x + 1, True), R4(la.y - 1, False), R4(lb.y + 1, True)), SURF, Z - 0.1)
open_ = (grid & 1) == 0; lawn = lawn_cells(grid, gh, surf, edge); ground = np.where(open_, np.clip(np.round(gh * 100), 0, 255), 0).astype(np.uint8)
col = {"cell": CELL, "overBase": OVER_BASE, "overStep": OVER_STEP,
       "island": {"minX": X0, "minZ": -Y1, "nx": nx, "nz": nz, "grid": pack(grid), "ground": pack(ground), "surface": pack(surf), "seats": [],
                  "open": int(open_.sum()), "walls": int(((grid & 2) != 0).sum()), "buildable": int(lawn.sum())}}
legacy = dict(open=int(open_.sum()), buildable=int(lawn.sum()), surf={str(k): int(v) for k, v in zip(*np.unique(surf[open_], return_counts=True))},
              dock_cm=sorted(set(int(v) for v in ground[open_ & (surf == 4)]))[:6], terrace_cm=sorted(set(int(v) for v in ground[open_ & (surf == 3)]))[-3:])
# 2. the whole home island with its beach and the steps down to it. Heights go below the lawn, so they are stored as
#    heightBase + value * heightStep (metres above the lawn). Surfaces: 5 beach, 6 steps, 7 bridge.
HB, HS = -2.4, 0.02
def block(grid, gh, surf, ext, edge):
    X0, X1, Y0, Y1, nx, nz = ext; open_ = (grid & 1) == 0
    h8 = np.where(open_, np.clip(np.round((gh - HB) / HS), 0, 255), 0).astype(np.uint8)
    return {"minX": X0, "minZ": -Y1, "nx": nx, "nz": nz, "grid": pack(grid), "height": pack(h8), "surface": pack(surf),
            "open": int(open_.sum()), "buildable": int(lawn_cells(grid, gh, surf, edge).sum()),
            "cells": {str(k): int(v) for k, v in zip(*np.unique(surf[open_], return_counts=True))}}
tg, th, ts, text, tedge = bake(WORLD_OBJS, (R4(lo_.x - 2, False), R4(hi_.x + 2, True), R4(lo_.y - 2, False), R4(hi_.y + 2, True)), TSURF, SEA, step_drop=0.5)
col["heightBase"] = HB; col["heightStep"] = HS; col["surfaces"] = {"1": "lawn", "2": "path", "3": "terrace", "4": "dock", "5": "beach", "6": "steps", "7": "bridge"}
col["terrain"] = block(tg, th, ts, text, tedge)
# 3. the land the island can grow into. Each piece is a patch: the same measurements over the box the new land and its
#    bridge take, made with the home island in place. When the land is opened the game lays the patch over the terrain.
col["expansions"] = {}; EXP = bpy.data.collections.get("KINGDOM_EXPANSION")
if EXP:
    show_collection("KINGDOM_EXPANSION", True); vl.update()
    for tag in ("East", "West"):
        objs = [o for o in EXP.objects if o.type == "MESH" and o.name.startswith("K_Exp_%s_" % tag)]
        if not objs: continue
        lo, hi = world_bb(objs); bx = (np.floor(lo.x) - 1.0, np.ceil(hi.x) + 1.0, np.floor(lo.y) - 1.0, np.ceil(hi.y) + 1.0)
        g2, h2, s2, e2, ed2 = bake(WORLD_OBJS + objs, bx, TSURF, SEA, step_drop=0.5); blk = block(g2, h2, s2, e2, ed2)
        br = json.loads(bpy.data.objects["K_Exp_%s_Bridge" % tag]["kk_bridge"]); isl = json.loads(bpy.data.objects["K_Exp_%s_Isle" % tag]["kk_outline"])
        blk["bridge"] = {"from": {"x": br["from"][0], "z": -br["from"][1]}, "to": {"x": br["to"][0], "z": -br["to"][1]}, "width": br["width"]}
        blk["centre"] = {"x": isl["centre"][0], "z": -isl["centre"][1]}; blk["objects"] = sorted(o.name for o in objs)
        col["expansions"][tag.lower()] = blk
    show_collection("KINGDOM_EXPANSION", False)
json.dump(col, open(os.path.join(OUT, "kingdom_collision.json"), "w"))
sizes["kingdom_collision.json"] = os.path.getsize(os.path.join(OUT, "kingdom_collision.json"))
if EXP:
    eo = [o for o in EXP.objects if o.type == "MESH"]
    for o in eo: o.hide_set(False)
    show_collection("KINGDOM_EXPANSION", True); vl.update()
    sizes["kingdom_expansion.glb"] = export(os.path.join(OUT, "kingdom_expansion.glb"), eo); show_collection("KINGDOM_EXPANSION", False)
# ---- layout
G = lambda o: {"x": round(o.location.x, 3), "z": round(-o.location.y, 3), "rot": round(o.rotation_euler.z, 4), "scale": round(o.scale.x, 3)}
day1 = [dict(G(o), name=o.name, mesh=o.data.name) for o in sorted(C("KINGDOM_LAYOUT_DAY1").objects, key=lambda o: o.name) if o.type == "MESH"]
tent = bpy.data.objects["K_D1_Tent"]
dock = json.loads(bpy.data.objects["K_Dock"]["kk_dock"]); terr = json.loads(bpy.data.objects["K_Hill_Terrace"]["kk_terrace"])
layout = {"version": 2, "cell": 1.0, "lawnBlenderZ": Z, "spawn": {"x": dock["spawn"][0], "z": -dock["spawn"][1], "heading": round(pi, 4)},
          "dock": {"from": {"x": 0.0, "z": -dock["from"][1]}, "end": {"x": 0.0, "z": -dock["end"][1]}, "width": dock["width"], "moor": {"x": dock["moor"][0], "z": -dock["moor"][1]},
                   "lights": [{"x": p[0], "y": round(p[2] - Z, 2), "z": -p[1]} for p in dock["lights"]]},
          "terrace": {"x": terr["centre"][0], "z": -terr["centre"][1], "radius": terr["radius"], "top": round(terr["top"] - Z, 2),
                      "ramp": {"x0": terr["ramp"][0], "x1": terr["ramp"][1], "zFoot": -terr["ramp"][2], "zTop": -terr["ramp"][3]}},
          "site": {"x": round(tent.location.x, 3), "z": round(-tent.location.y, 3), "rot": 0.0, "cells": [6, 6]},
          "kit": exported_names, "day1": day1,
          "steps": [{"name": o.name, "width": t["width"], "top": {"x": t["top"][0], "z": -t["top"][1]}, "foot": {"x": t["foot"][0], "z": -t["foot"][1]}}
                    for o, t in ((o, json.loads(o["kk_steps"])) for o in sorted(C("KINGDOM_WORLD").objects, key=lambda o: o.name) if o.get("kk_steps"))],
          "showcase": "kingdom_showcase.json", "expansion": "kingdom_expansion.glb", "sections": "kingdom_sections.json"}
json.dump(layout, open(os.path.join(OUT, "kingdom_layout.json"), "w"), indent=1)
sizes["kingdom_layout.json"] = os.path.getsize(os.path.join(OUT, "kingdom_layout.json"))
report(sizes=sizes, kit=len(exported_names), island=legacy, terrain={k_: v for k_, v in col["terrain"].items() if k_ in ("nx", "nz", "open", "buildable", "cells")},
       expansions={k_: {q: v[q] for q in ("nx", "nz", "open", "buildable", "cells")} for k_, v in col["expansions"].items()}, day1=len(day1), secs=round(time.time() - t0, 1))
