"""Pass 12: bring the 12 shop interiors to character scale (one-time; guarded by scene['gm_shops_scaled']).
Measured on the in-game Kai model: seated surface 0.20 m, standing hands 0.6 to 0.8 m, head top 2.0 m.
Rules, applied per touching cluster of fixtures, measured from the shop floor:
  seats        -> sitting surface at 0.22 m
  tables beside seats -> top at 0.50 m
  everything else that stands below head height -> heights x 0.6 (counters land near 0.65 m)
  overhead pieces (starting above 1.9 m), walls, floors, mats -> unchanged
  small loose merchandise -> uniform x 0.68, kept resting on its lowered surface"""
import bpy, re, collections
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from gk import *

sc = bpy.context.scene
if sc.get("gm_shops_scaled"):
    raise RuntimeError("shops already scaled; restore the pre-shops backup before running this again")
for o in [o for o in bpy.data.objects if o.name.startswith("Support_")]: bpy.data.objects.remove(o, do_unlink=True)
FLOOR = {"GROVE_GROCER": 0, "THREAD_THIMBLE": 0, "HOME_NOOK": 0, "CAFE_CANOPY": 0, "SOLE_SEARCH": 5, "PIXEL_PANTRY": 5, "MAKER_MEADOW": 5,
         "SEASONAL_POP_UP": 5, "BOOK_BURROW": 10, "ALLTIMEFITNESS": 10, "FOOD_HALL": 10, "ROOFTOP_GARDEN": 10}
SEAT = re.compile(r"(Seat|Stool|Bench|Chair|Sofa|Pouf|Cushion)"); NOTSEAT = re.compile(r"(Back|Leg|Arm|Rolled|Table|Rack)")
TABLE = re.compile(r"(Table|Top|Workbench|Counter|Desk)")
F_DEF, SEAT_H, TABLE_H, ITEM_S = 0.6, 0.22, 0.50, 0.68
rep = {}
for key, z0 in FLOOR.items():
    col = bpy.data.collections.get(key + "_INTERIOR_REFINEMENT")
    if not col: continue
    objs = []
    for o in col.all_objects:
        if o.type != "MESH" or not len(o.data.polygons): continue
        a, c = wbb(o)
        if c.z <= z0 + 0.3 or (c.z - a.z) >= 3.8 or c.z >= z0 + 4.3 and (c.x - a.x) * (c.y - a.y) > 20: continue      # floor things, walls, ceilings
        objs.append([o, a, c])
    n = len(objs); trees = []
    for o, a, c in objs:
        mw = o.matrix_world
        trees.append(BVHTree.FromPolygons([mw @ v.co for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons], epsilon=0.015))
    adj = collections.defaultdict(set)
    for i in range(n):
        ai, ci = objs[i][1], objs[i][2]
        for j in range(i + 1, n):
            aj, cj = objs[j][1], objs[j][2]
            if aj.x > ci.x + 0.02 or cj.x < ai.x - 0.02 or aj.y > ci.y + 0.02 or cj.y < ai.y - 0.02 or aj.z > ci.z + 0.02 or cj.z < ai.z - 0.02: continue
            if trees[i].overlap(trees[j]): adj[i].add(j); adj[j].add(i)
    seen = set(); clusters = []
    for i in range(n):
        if i in seen: continue
        st = [i]; seen.add(i); cl = []
        while st:
            k = st.pop(); cl.append(k)
            for m in adj[k]:
                if m not in seen: seen.add(m); st.append(m)
        clusters.append(cl)
    def cbox(cl):
        return (min(objs[k][1].x for k in cl), min(objs[k][1].y for k in cl), min(objs[k][1].z for k in cl),
                max(objs[k][2].x for k in cl), max(objs[k][2].y for k in cl), max(objs[k][2].z for k in cl))
    area = lambda k: (objs[k][2].x - objs[k][1].x) * (objs[k][2].y - objs[k][1].y)
    # leaf = nothing rests on it
    leaf = [True] * n
    for i in range(n):
        ai, ci = objs[i][1], objs[i][2]
        for j in adj[i]:
            aj, cj = objs[j][1], objs[j][2]
            if aj.z >= ci.z - 0.06 and cj.z > ci.z + 0.02:
                leaf[i] = False; break
    info = []; kinds = collections.Counter()
    for cl in clusters:
        bx = cbox(cl); kind = "default"; f = F_DEF; surf = None
        if bx[2] >= z0 + 1.9: kind = "overhead"; f = 1.0
        else:
            seats = [k for k in cl if SEAT.search(objs[k][0].name) and not NOTSEAT.search(objs[k][0].name)]
            if seats and bx[2] <= z0 + 0.2 and bx[5] <= z0 + 2.0:
                s = max(seats, key=area)
                if objs[s][2].z <= z0 + 1.25:
                    top = objs[s][2].z
                    for k in seats:      # a cushion lying on the seat raises the sitting surface
                        if k != s and objs[k][1].z >= objs[s][2].z - 0.08 and area(k) > 0.5 * area(s): top = max(top, objs[k][2].z)
                    kind = "seat"; f = SEAT_H / max(top - z0, 0.05); surf = s
        info.append([cl, bx, kind, f, surf])
    seat_boxes = [bx for cl, bx, kind, f, s in info if kind == "seat"]
    for it in info:
        cl, bx, kind, f, s = it
        if kind != "default" or bx[2] > z0 + 0.25: continue
        tabs = [k for k in cl if TABLE.search(objs[k][0].name)]
        if not tabs: continue
        near = any(not (sb[0] > bx[3] + 1.5 or sb[3] < bx[0] - 1.5 or sb[1] > bx[4] + 1.5 or sb[4] < bx[1] - 1.5) for sb in seat_boxes)
        if near:
            top = objs[max(tabs, key=area)][2].z - z0
            if 0.5 < top < 1.4: it[2] = "seated_table"; it[3] = TABLE_H / top
    for cl, bx, kind, f, s in info:
        kinds[kind] += 1
        if kind == "overhead": continue
        for k in cl:
            o, a, c = objs[k]
            small = max(c.x - a.x, c.y - a.y) <= 1.0 and (c.z - a.z) <= 0.9
            if leaf[k] and small and not (kind == "seat" and SEAT.search(o.name)) and a.z > z0 + 0.03:
                piv = Vector(((a.x + c.x) / 2, (a.y + c.y) / 2, a.z)); new = Vector((piv.x, piv.y, z0 + f * (a.z - z0)))
                o.matrix_world = Matrix.Translation(new) @ Matrix.Scale(ITEM_S, 4) @ Matrix.Translation(-piv) @ o.matrix_world
            else:
                if o.data.users > 1: o.data = o.data.copy()
                me = o.data; me.transform(o.matrix_world)
                me.transform(Matrix.Translation((0, 0, z0)) @ Matrix.Diagonal((1, 1, f, 1)) @ Matrix.Translation((0, 0, -z0)))
                o.matrix_world = Matrix.Identity(4)
                mods = {m.type for m in o.modifiers}
                if not (mods & {"BEVEL", "SUBSURF"}) and (len(me.vertices), len(me.polygons)) != (8, 6): hard_normals(me, 40)
    rep[key] = dict(kinds)
sc["gm_shops_scaled"] = 1
bpy.app.driver_namespace["gk_report"] = rep
