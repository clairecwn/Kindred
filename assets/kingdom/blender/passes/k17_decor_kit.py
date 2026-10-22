"""Pass 17: the outdoor decor kit. Builds every part in kdecor.KIT as one shared mesh (KD_<name>), writes its facts
on the mesh (kd_group, kd_cells and whatever its builder returned), sets the parts out in rows and lays out a small
garden from them by the same rules the game will use, to judge how they go together.
Everything is in the collection KINGDOM_DECOR_KIT, south of the house kit (y = -175 and beyond). Never exported with
the island; k22_export_decor writes the kit for the game."""
import bpy, importlib, json
from kk import *
import ktone; importlib.reload(ktone)
import kdecor; importlib.reload(kdecor)
from ktone import TB

K = {}; INFO = {}
for name, fn, group, cells in kdecor.KIT:
    b = kdecor.SmoothTB(); info = fn(b) or {}; me = kit("KD_" + name, b); K[name] = me; INFO[name] = (group, cells)
    for k_ in [k_ for k_ in me.keys() if k_.startswith("kd_")]: del me[k_]
    me["kd_group"] = group; me["kd_cells"] = list(cells)
    for k_, v in info.items(): me["kd_" + k_] = v

kc = ccol("KINGDOM_DECOR_KIT")
for o in list(kc.objects): bpy.data.objects.remove(o, do_unlink=True)
N = [0]
def place(mesh, loc, rz=0.0, tag="KDP"):
    N[0] += 1; o = bpy.data.objects.new("%s_%s_%03d" % (tag, mesh, N[0]), K[mesh]); kc.objects.link(o); o.location = loc; o.rotation_euler = (0, 0, rz); return o
Y0 = -175.0

# ---------------------------------------------------------------- the parts in rows
SIDES = [((0, -1), 0.0), ((1, 0), pi / 2), ((0, 1), pi), ((-1, 0), -pi / 2)]      # a side of a cell, and the turn that brings a part drawn on -Y to it
RAILS = [((1, 0), 0.0), ((0, 1), pi / 2), ((-1, 0), pi), ((0, -1), -pi / 2)]      # a neighbour, and the turn that points a Rail (drawn towards +X) at it
def fence(style, cells, at, joins=(), tag="KDP"):
    """Posts and rails for a set of fence cells. joins: other cells a rail should also reach (a gate, an arch)."""
    link = set(cells) | set(joins)
    for (i, j) in cells:
        c = (at[0] + i + 0.5, at[1] + j + 0.5, at[2]); place("Fence_%s_Post" % style, c, 0.0, tag)
        for (dx, dy), rz in RAILS:
            if (i + dx, j + dy) in link: place("Fence_%s_Rail" % style, c, rz, tag)
def lay(cells, tile, edge, corner, at, inner=None, joined=None, tag="KDP"):
    """Tiles for a set of cells, an edge on every open side, a corner where two open sides meet and, if the kit has
    one, an inner corner where two filled sides meet round an empty cell."""
    full = set(joined or cells)
    for (i, j) in sorted(cells):
        c = (at[0] + i + 0.5, at[1] + j + 0.5, at[2]); place(tile, c, 0.0, tag)
        if not edge: continue
        open_ = [(i + dx, j + dy) not in full for (dx, dy), rz in SIDES]
        for k_, ((dx, dy), rz) in enumerate(SIDES):
            if open_[k_]: place(edge, c, rz, tag)
            (ex, ey), _ = SIDES[k_ - 1]
            if open_[k_] and open_[k_ - 1]: place(corner, c, rz, tag)
            elif inner and not open_[k_] and not open_[k_ - 1] and (i + dx + ex, j + dy + ey) not in full: place(inner, c, rz, tag)
rows = [["path", "bed"], ["fence", "sign", "lamp"], ["seat", "arch"], ["pond", "bridge"]]; y = Y0; xmax = 0.0
for row in rows:
    x = -30.0; depth = max(INFO[n][1][1] for n in K if INFO[n][0] in row)
    for g in row:
        for n in [n for n, f, gg, c in kdecor.KIT if gg == g]:
            cw, cd = INFO[n][1]; o = place(n, (x + cw / 2, y - depth / 2, 0.0)); x += cw + (0.7 if g in ("path", "fence") else 1.3)
            if K[n].get("kd_leaf"): place(K[n]["kd_leaf"][3:], (o.location.x + K[n]["kd_hinge"][0], o.location.y, 0.0))
        if g == "path":      # a short run of each surface with its edges, as it is laid
            for t in ("Stone", "Brick", "Wood", "Sand"):
                lay({(0, 0), (1, 0), (2, 0), (2, 1)}, "Path_" + t, "Path_%s_Edge" % t, "Path_%s_Corner" % t, (x, y - 2.0, 0.0)); x += 4.0
        if g == "fence":     # a short run of each fence
            for st in ("Picket", "Ranch", "Wall", "Hedge", "Rope"):
                fence(st, [(0, 0), (1, 0), (2, 0), (2, 1)], (x, y - 1.5, 0.0)); x += 4.0
        if g == "pond":
            lay({(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (2, 2)}, "Pond_Water", "Pond_Edge", "Pond_Corner", (x, y - 3.0, 0.0), inner="Pond_Inner"); x += 4.5
        x += 1.6
    xmax = max(xmax, x); y -= depth + 3.5
b = B(); b.box((xmax + 34.0, Y0 - y + 3.0, 0.3), ((xmax - 30.0) / 2, (Y0 + y) / 2 + 1.5, -0.15), "lawn_tex", r=0.1); place_ground = kit("KD_Display", b)
o = bpy.data.objects.new("KD_Display", place_ground); kc.objects.link(o)

# ---------------------------------------------------------------- a garden laid out from the kit, 16 x 12 cells
GX, GY = -30.0, y - 16.0; AT = (GX, GY, 0.0); G = "KDG"
def cell(i, j, w=1, d=1): return (GX + i + w / 2, GY + j + d / 2, 0.0)
def rect(i0, i1, j0, j1): return {(i, j) for i in range(i0, i1 + 1) for j in range(j0, j1 + 1)}
brick = rect(7, 8, 1, 5) | rect(9, 14, 5, 5); stone = rect(7, 8, 6, 10); sand = rect(1, 3, 1, 2); steps = rect(4, 6, 5, 5)
paths = brick | stone | {(7, 0), (8, 0), (7, 11), (8, 11), (15, 5)}
lay(brick, "Path_Brick", "Path_Brick_Edge", "Path_Brick_Corner", AT, joined=paths, tag=G); lay(stone, "Path_Stone", "Path_Stone_Edge", "Path_Stone_Corner", AT, joined=paths, tag=G)
lay(sand, "Path_Sand", "Path_Sand_Edge", "Path_Sand_Corner", AT, tag=G); lay(steps, "Path_Step", None, None, AT, tag=G)
lay({(7, 0), (8, 0), (7, 11), (8, 11), (15, 5)}, "Path_Brick", None, None, AT, tag=G)
water = rect(9, 13, 7, 8) | rect(12, 13, 9, 9)
lay(water, "Pond_Water", "Pond_Edge", "Pond_Corner", AT, inner="Pond_Inner", tag=G)
border = [(i, j) for i in range(16) for j in range(12) if i in (0, 15) or j in (0, 11)]; gaps = {(7, 0), (8, 0), (7, 11), (8, 11), (15, 5)}
fence("Picket", [c for c in border if c not in gaps], AT, joins=gaps, tag=G)
SET = [("Arch_Wood", cell(7, 0, 2), 0), ("Arch_Stone", cell(7, 11, 2), 0), ("Gate_Picket", cell(15, 5), pi / 2), ("Arch_Rose", cell(7, 3, 2), 0),
       ("Seat_Deckchair", cell(2, 1, 1, 2), 0.25), ("Bed_Stone_2x2", cell(4, 1, 2, 2), 0), ("Planter_Urn", cell(6, 1), 0), ("Planter_Urn", cell(9, 1), 0),
       ("Lamp_Lantern", cell(6, 3), 0), ("Lamp_Lantern", cell(9, 3), 0), ("Sign_Easel", cell(6, 4), 0.3), ("Bed_Wood_2x1", cell(10, 1, 2), 0),
       ("Bed_Wood_2x2", cell(13, 1, 2, 2), 0), ("Bed_Brick_2x1", cell(10, 3, 2), 0), ("Sign_Board", cell(12, 4, 2), pi), ("Seat_Bench", cell(9, 4, 2), pi),
       ("Lamp_Post", cell(6, 6), 0), ("Sign_Arrow", cell(9, 6), 0), ("Bridge_Arch", cell(10, 6, 2, 4), 0), ("Planter_Tub", cell(14, 9), 0), ("Lamp_Double", cell(14, 6), 0),
       ("Pond_Reeds", cell(9, 9), 0), ("Pond_Rock", cell(14, 7), 0), ("Pond_Lily", cell(12, 8), 0), ("Pond_Lily", cell(9, 7), 2.0), ("Seat_Swing", cell(12, 10, 3), 0),
       ("Pergola", cell(1, 7, 4, 3), 0), ("Seat_Picnic", cell(2, 7, 2, 2), 0), ("Seat_Stump", cell(5, 8), 0), ("Lamp_Garland", cell(1, 10, 4), 0),
       ("Seat_Hammock", cell(1, 5, 3), 0), ("Planter_Tub", cell(5, 6), 0), ("Bed_Wood_1x1", cell(5, 4), 0), ("Bed_Wood_1x1", cell(4, 4), 0)]
for n, loc, rz in SET:
    o = place(n, loc, rz, G)
    if K[n].get("kd_leaf"):
        h = K[n]["kd_hinge"]; place(K[n]["kd_leaf"][3:], (loc[0] + h[0] * cos(rz) - h[1] * sin(rz), loc[1] + h[0] * sin(rz) + h[1] * cos(rz), 0.0), rz + 0.9, G)
b = B(); b.box((22.0, 18.0, 0.3), (GX + 8.0, GY + 6.0, -0.15), "lawn_tex", r=0.1); o = bpy.data.objects.new("KD_Garden_Ground", kit("KD_Garden_Ground", b)); kc.objects.link(o)
ref = bpy.data.collections.get("KINGDOM_CHARACTER_REFERENCE")
if ref:
    body_ = next(o for o in ref.all_objects if o.name.startswith("Kindred_Body")); lo_, hi_ = wbb(body_)
    for i, (xk, yk) in enumerate(((GX + 8.0, GY + 2.0), (GX + 5.5, GY + 9.5), (-32.0, Y0 - 1.0), (-32.0, Y0 - 16.0))):
        o = bpy.data.objects.new("KD_Kai_%d" % i, None); o.instance_type = "COLLECTION"; o.instance_collection = ref; kc.objects.link(o)
        o.location = (xk - (lo_.x + hi_.x) / 2, yk - (lo_.y + hi_.y) / 2, -lo_.z)
show_collection("KINGDOM_DECOR_KIT", bool((NS.get("kk_args") or {}).get("show", True)))
eye, target = Vector((GX + 8.0, GY - 16.0, 15.0)), Vector((GX + 8.0, GY + 6.0, 0.5))
for scr in bpy.data.screens:
    if scr.name != "Layout": continue
    for a_ in scr.areas:
        if a_.type == "VIEW_3D":
            sp = a_.spaces.active; r3 = sp.region_3d; sp.shading.type = "MATERIAL"; sp.shading.use_scene_lights = True; sp.shading.use_scene_world = True
            if r3:
                r3.view_perspective = "PERSP"; r3.view_location = target; r3.view_distance = (eye - target).length; r3.view_rotation = (eye - target).to_track_quat("Z", "Y")
            sp.clip_end = 1500
bpy.context.view_layer.update()         # so a check run straight after this pass sees the parts where they were put
names = sorted(K); NS["kd_garden"] = [GX, GY]
report(parts=len(names), tris=sum(tris(K[n]) for n in names), biggest=sorted(((tris(K[n]), n) for n in names), reverse=True)[:8], placed=N[0], garden=[GX, GY])
