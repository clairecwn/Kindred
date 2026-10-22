"""Pass 18: the interior room kit. Builds the room shells, the parts that go on their walls and floors and the
finishes (kroom.py), and sets up five example rooms to judge them: one of each shell, each with other finishes.
Everything is in the collection KINGDOM_ROOM_KIT, south of the decor kit (y = -250). Never exported with the island;
k23_export_room writes the kit for the game.
  KR_Room_<Shed|Cabin|Cottage|Upper|Manor>   KR_Window_<Square|Round|Arch>   KR_Door  KR_Fireplace  KR_Sconce  KR_Wainscot
  KR_Stair_Up  KR_Stair_Down  KR_Doormat  KR_Beam_<4|6|8|10>   KR_Finish_<floor|wall>_<name> (a 1 m sample of each finish)
An example room is an empty (KRX_<n>) with part objects under it; its finishes are set on the objects, not on the
shared meshes, the way the game will finish one room without touching the next."""
import bpy, importlib, json
from kk import *
import ktone; importlib.reload(ktone)
import kroom; importlib.reload(kroom)
from ktone import TB, shade, paint
from kroom import H, T, ROOMS

F = kroom.finishes()
if bpy.data.materials.get("KI_roomFloor") is None:
    m = F["floor"]["planks"].copy(); m.name = "KI_roomFloor"
M("roomWall")["gm_tile"] = kroom.WALL_TILE; M("roomTrim")
K = {}
def part(name, fn, *a):
    b = TB(); info = fn(b, *a) or {}; me = kit(name, b); K[name] = me
    for k_ in [k_ for k_ in me.keys() if k_.startswith("kr_")]: del me[k_]
    for k_, v in info.items(): me["kr_" + k_] = v
    return me
for n, (W, D) in ROOMS.items(): part("KR_Room_" + n, kroom.room, W, D)
for n, fn in kroom.WINDOWS.items(): part("KR_Window_" + n, fn)
for n, fn in kroom.PARTS.items(): part("KR_" + n, fn)
for W in sorted({w for w, d in ROOMS.values()}): part("KR_Beam_%d" % W, kroom.beam, W)
for kind, table in F.items():
    for n, m in table.items():
        b = B(); b.box((1.0, 1.0, 0.06) if kind == "floor" else (1.0, 0.06, 1.0), (0, 0, 0.03) if kind == "floor" else (0, 0, 0.5), m); K["KR_Finish_%s_%s" % (kind, n)] = kit("KR_Finish_%s_%s" % (kind, n), b)

kc = ccol("KINGDOM_ROOM_KIT")
for o in list(kc.objects): bpy.data.objects.remove(o, do_unlink=True)
Y0 = -250.0
def place(name, mesh, loc, rz=0.0, parent=None):
    o = bpy.data.objects.new(name, K[mesh]); kc.objects.link(o); o.location = loc; o.rotation_euler = (0, 0, rz)
    if parent: o.parent = parent
    return o
def variant(src, tag, hexcol):
    n = "KX_%s_%s" % (src.name[3:], tag); m = bpy.data.materials.get(n) or src.copy(); m.name = n
    if src.get("ki_tint"): m.node_tree.nodes["Tint"].inputs[7].default_value = (*lin(hexcol), 1); m.diffuse_color = (*lin(hexcol), 1); m["ki_hex"] = hexcol
    else: paint(m, hexcol)
    return m
def finish(objs, floor="planks", floor_tint=None, wall=None, wall_tint="#FFF1D0", trim="#FFFAEC", tag=""):
    """Swap the finish materials on these objects only."""
    fm = F["floor"][floor]; fm = variant(fm, tag, floor_tint) if floor_tint and fm.get("ki_tint") else fm
    wm = variant(F["wall"][wall], tag, wall_tint) if wall else variant(bpy.data.materials["KI_roomWall"], tag, wall_tint)
    table = {"KI_roomFloor": fm, "KI_roomWall": wm}
    for kind in ("", "_dk", "_lt"):
        src = bpy.data.materials.get("KI_roomTrim" + kind)
        if src: table[src.name] = variant(src, tag, shade(trim, kind[1:]) if kind else trim)
    for o in objs:
        for sl in o.material_slots:
            if sl.material and sl.material.name in table: m = table[sl.material.name]; sl.link = "OBJECT"; sl.material = m
EXAMPLES = [
    dict(room="Shed", finish=dict(floor="stone", wall="boards", wall_tint="#F0C890", trim="#FFFAEC"),
         parts=[("Window_Round", "back", 0.9, 1.75), ("Sconce", "left", 0.4, 1.9), ("Beam_4", "floor", 0.0, 0.4), ("Doormat", "floor", 0.0, -1.55)]),
    dict(room="Cabin", finish=dict(floor="planks", wall=None, wall_tint="#FFF1D0", trim="#FFFAEC"),
         parts=[("Fireplace", "back", 0.0, 0.0), ("Wainscot", "back", -2.5, 0.0), ("Wainscot", "back", -1.5, 0.0), ("Wainscot", "back", 1.5, 0.0), ("Wainscot", "back", 2.5, 0.0),
                ("Window_Square", "left", 0.4, 1.75), ("Window_Square", "right", 0.4, 1.75), ("Beam_6", "floor", 0.0, 0.2), ("Doormat", "floor", 0.0, -2.55)]),
    dict(room="Cottage", finish=dict(floor="checker", floor_tint="#8FD8D0", wall="stripes", wall_tint="#FFE48A", trim="#FFFAEC"),
         parts=[("Fireplace", "back", -0.8, 0.0), ("Stair_Up", "back", 2.5, 0.0), ("Window_Arch", "back", -2.93, 1.85), ("Window_Arch", "left", 0.6, 1.85), ("Window_Arch", "right", 0.6, 1.85),
                ("Door", "left", -2.2, 0.0), ("Beam_8", "floor", 0.0, -1.4), ("Beam_8", "floor", 0.0, 1.6), ("Doormat", "floor", 0.0, -3.55)]),
    dict(room="Upper", finish=dict(floor="carpet", floor_tint="#F49AB8", wall="dots", wall_tint="#B8E8FF", trim="#C98443"),
         parts=[("Window_Round", "back", -1.5, 1.8), ("Window_Round", "back", 0.3, 1.8), ("Stair_Down", "floor", 1.9, 2.4), ("Window_Square", "left", 0.2, 1.75), ("Sconce", "right", 0.2, 1.9), ("Beam_6", "floor", 0.0, -0.4)]),
    # the Manor's hall: a lounge at the fire, a dining table for six, a kitchen along the right wall, the stair in the back corner
    dict(room="Manor", finish=dict(floor="planks", wall="stripes", wall_tint="#CFEAD6", trim="#FFFAEC"),
         parts=[("Fireplace", "back", 0.0, 0.0), ("Stair_Up", "back", 3.4, 0.0), ("Window_Arch", "back", -3.3, 1.85), ("Window_Arch", "left", -0.3, 1.85), ("Window_Arch", "right", -0.5, 1.85),
                ("Door", "left", -2.5, 0.0), ("Sconce", "left", 3.3, 1.9), ("Beam_10", "floor", 0.0, -1.6), ("Beam_10", "floor", 0.0, 1.2), ("Doormat", "floor", 0.0, -3.55)]),
]
def on_wall(W, D, wall, u, z):
    """Where a wall part goes: u runs along the wall (x on the back wall, y on a side wall), z is its height."""
    if wall == "back": return (u, D / 2, z), 0.0
    if wall == "left": return (-W / 2, u, z), pi / 2
    if wall == "right": return (W / 2, u, z), -pi / 2
    return (u, z, 0.0), 0.0                     # "floor": u = x, z = y
x = -30.0; rows = []; ref = bpy.data.collections.get("KINGDOM_CHARACTER_REFERENCE")
if ref: body_ = next(o for o in ref.all_objects if o.name.startswith("Kindred_Body")); lo_, hi_ = wbb(body_)
for i, e in enumerate(EXAMPLES):
    W, D = ROOMS[e["room"]]; cx = x + W / 2 + T; root = bpy.data.objects.new("KRX_%02d_%s" % (i, e["room"]), None); kc.objects.link(root); root.location = (cx, Y0, 0.0); root.empty_display_size = 0.5
    root["kr_example"] = json.dumps({"room": e["room"], "finish": e["finish"], "parts": [list(p) for p in e["parts"]]})
    objs = [place("KRX_%02d_Room" % i, "KR_Room_" + e["room"], (0, 0, 0), 0.0, root)]
    for j, (n, wall, u, z) in enumerate(e["parts"]):
        loc, rz = on_wall(W, D, wall, u, z); objs.append(place("KRX_%02d_%s_%d" % (i, n, j), "KR_" + n, loc, rz, root))
    finish(objs, tag=e["room"], **e["finish"])
    if ref:
        o = bpy.data.objects.new("KR_Kai_%d" % i, None); o.instance_type = "COLLECTION"; o.instance_collection = ref; kc.objects.link(o)
        kx, ky = {"Shed": (0.2, -1.0), "Cabin": (0.9, -1.4), "Cottage": (-0.3, -2.3), "Upper": (0.6, -0.9), "Manor": (-0.8, -2.7)}[e["room"]]          # clear of the furniture k19 sets out
        o.location = (cx + kx - (lo_.x + hi_.x) / 2, Y0 + ky - (lo_.y + hi_.y) / 2, -lo_.z)
    rows.append("%s %dx%d" % (e["room"], W, D)); x += W + 2 * T + 3.0
sx_ = -30.0
for kind in ("floor", "wall"):
    for n in F[kind]: place("KRP_Finish_%s_%s" % (kind, n), "KR_Finish_%s_%s" % (kind, n), (sx_ + 0.5, Y0 - 9.0, 0.0)); sx_ += 1.4
b = B(); b.box((x + 36.0, 20.0, 0.3), ((x - 30.0) / 2 - 1.5, Y0 - 2.5, -0.45), "cream", r=0.1); o = bpy.data.objects.new("KR_Display", kit("KR_Display", b)); kc.objects.link(o)
show_collection("KINGDOM_ROOM_KIT", bool((NS.get("kk_args") or {}).get("show", True)))
eye, target = Vector(((x - 30.0) / 2 - 1.5, Y0 - 26.0, 16.0)), Vector(((x - 30.0) / 2 - 1.5, Y0, 1.0))
for scr in bpy.data.screens:
    if scr.name != "Layout": continue
    for a_ in scr.areas:
        if a_.type == "VIEW_3D":
            sp = a_.spaces.active; r3 = sp.region_3d; sp.shading.type = "MATERIAL"; sp.shading.use_scene_lights = True; sp.shading.use_scene_world = True
            if r3:
                r3.view_perspective = "PERSP"; r3.view_location = target; r3.view_distance = (eye - target).length; r3.view_rotation = (eye - target).to_track_quat("Z", "Y")
            sp.clip_end = 1500
bpy.context.view_layer.update()
names = sorted(n for n in K if not n.startswith("KR_Finish"))
report(parts=len(names), finishes={k_: list(v) for k_, v in F.items()}, tris=sum(tris(K[n]) for n in names), biggest=sorted(((tris(K[n]), n) for n in names), reverse=True)[:5], examples=rows, x_end=round(x, 1))
