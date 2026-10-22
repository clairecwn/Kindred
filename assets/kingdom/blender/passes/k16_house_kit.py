"""Pass 16: the house kit. Builds every part as one shared mesh (KH_*), writes each body's sockets onto it, sets the
parts out on a display wall and a shelf, and puts together example houses from them, to judge the designs.
Everything is in the collection KINGDOM_HOUSE_KIT, south of the plant shelf (y = -100 and beyond). Never exported with
the island; k21_export_house writes the kit for the game.
  KH_Body_<Size>  KH_Frame_<Size>  KH_Timber_<Size>  KH_Roof_<Gable|Hip|Barn>_<Size>
  KH_Door_<Plank|Arch|Dutch|Double>  KH_Window_<Square|Round|Arch|Flower>  KH_Porch_<Steps|Awning|Deck>
  KH_Chimney_<Brick|Stone|Pipe>  KH_Lantern  KH_Sign  KH_Well  KH_Stable
An example house is an empty (KHX_<n>) with part objects under it. Its colours are set on the objects, not on the
shared meshes, the way the game will recolour one house without touching the next."""
import bpy, importlib, json
from kk import *
import ktone; importlib.reload(ktone)
import khouse; importlib.reload(khouse)
import khparts; importlib.reload(khparts)
from ktone import TB, shade, paint
from khouse import SIZES, BASE, sockets

K = {}
def part(name, fn, *a):
    b = TB(); info = fn(b, *a); me = kit(name, b); K[name] = me
    for k_, v in (info or {}).items(): me["kh_" + k_] = v
    return me
for sz, S in SIZES.items():
    me = part("KH_Body_" + sz, khouse.body, S); sk = sockets(S)
    me["kh_plot"] = S["plot"]; me["kh_back"] = S["back"]; me["kh_size"] = [2 * S["hx"], 2 * S["hy"], BASE + S["h"]]
    me["kh_door"] = sk["door"]; me["kh_porch"] = sk["porch"]; me["kh_roof"] = sk["roof"]; me["kh_windows"] = [v for w in sk["windows"] for v in w]
    part("KH_Frame_" + sz, khouse.frame, S); part("KH_Timber_" + sz, khouse.timber, S)
    for rn, fn in khouse.ROOFS.items(): part("KH_Roof_%s_%s" % (rn, sz), fn, S)
for group, table in (("Door", khparts.DOORS), ("Window", khparts.WINDOWS), ("Porch", khparts.PORCHES), ("Chimney", khparts.CHIMNEYS)):
    for n, fn in table.items(): part("KH_%s_%s" % (group, n), fn)
for n, fn in khparts.EXTRAS.items(): part("KH_" + n, fn)
for n, (fn, cw, cd) in khparts.WHOLE.items(): part("KH_" + n, fn)["kh_cells"] = [cw, cd]

# ---------------------------------------------------------------- display
kc = ccol("KINGDOM_HOUSE_KIT")
for o in list(kc.objects): bpy.data.objects.remove(o, do_unlink=True)
def place(name, mesh, loc, rz=0.0, parent=None):
    o = bpy.data.objects.new(name, K[mesh] if isinstance(mesh, str) else mesh); kc.objects.link(o)
    o.location = loc; o.rotation_euler = (0, 0, rz)
    if parent: o.parent = parent
    return o
Y0 = -100.0
b = B(); b.box((64, 9, 0.3), (0, Y0 - 3.5, -0.15), "cream", r=0.1); b.box((40, 0.4, 3.6), (-11, Y0 + 0.2, 1.8), "wallA"); place("KH_Display", kit("KH_Display", b), (0, 0, 0))
x = -30.0
for n in list(khparts.DOORS): place("KHP_Door_" + n, "KH_Door_" + n, (x, Y0, 0.0)); x += 3.4
for n in list(khparts.WINDOWS): place("KHP_Window_" + n, "KH_Window_" + n, (x, Y0, 1.75)); x += 2.6
for n in list(khparts.EXTRAS): place("KHP_" + n, "KH_" + n, (x, Y0, 2.2)); x += 2.2
x = -30.0
for n in list(khparts.PORCHES): place("KHP_Porch_" + n, "KH_Porch_" + n, (x + 2.5, Y0 - 4.0, 0.0)); x += 6.5
for n in list(khparts.CHIMNEYS): place("KHP_Chimney_" + n, "KH_Chimney_" + n, (x, Y0 - 5.0, 1.6)); x += 2.4

# colours an example can take: the materials a house is recoloured by, and what each choice sets them to
ROOF, WALL, TRIM, DOOR = (khouse.COLOURS[k_] for k_ in ("roof", "wall", "trim", "door"))
def variant(base, tag, hexcol):
    """A copy of a kit material in another colour, for an example house only (KX_...)."""
    src = bpy.data.materials["KI_" + base]; n = "KX_%s_%s" % (base, tag); m = bpy.data.materials.get(n) or src.copy(); m.name = n; paint(m, hexcol); return m
def colours(roof="red", wall="cream", trim="wood", door="blue"):
    t = {}
    for k_, hx_ in zip(("roofA", "roofB", "roofC"), ROOF[roof]): t["KI_" + k_] = variant(k_, roof, hx_)
    for base, tag, hx_ in (("wallA", wall, WALL[wall]), ("trimA", trim, TRIM[trim]), ("doorA", door, DOOR[door])):
        t["KI_" + base] = variant(base, tag, hx_)
        for kind in ("dk", "lt"):
            if bpy.data.materials.get("KI_%s_%s" % (base, kind)): t["KI_%s_%s" % (base, kind)] = variant(base + "_" + kind, tag, shade(hx_, kind))
    return t
def recolour(o, table):
    for sl in o.material_slots:
        if sl.material and sl.material.name in table:
            m = table[sl.material.name]; sl.link = "OBJECT"; sl.material = m

EXAMPLES = [
    dict(size="Cabin", roof="Gable", door="Plank", window="Square", porch="Steps", chimney="Brick", timber=False, col=dict()),
    dict(size="Cabin", roof="Barn", door="Dutch", window="Round", porch="Awning", chimney="Pipe", timber=True, col=dict(roof="green", wall="butter", trim="walnut", door="red")),
    dict(size="Cottage", roof="Hip", door="Arch", window="Round", porch="Awning", chimney="Stone", timber=False, col=dict(roof="blue", wall="pink", trim="white", door="purple")),
    dict(size="Cottage", roof="Gable", door="Double", window="Flower", porch="Deck", chimney="Brick", timber=True, col=dict(roof="orange", wall="white", trim="wood", door="green")),
    dict(size="House", roof="Gable", door="Double", window="Arch", porch="Deck", chimney="Brick", timber=False, col=dict(roof="red", wall="butter", trim="white", door="blue")),
    dict(size="House", roof="Hip", door="Arch", window="Square", porch="Awning", chimney="Stone", timber=True, col=dict(roof="teal", wall="cream", trim="walnut", door="yellow")),
    dict(size="House", roof="Barn", door="Dutch", window="Flower", porch="Steps", chimney="Pipe", timber=False, col=dict(roof="purple", wall="mint", trim="white", door="pink")),
    dict(size="Shed", roof="Barn", door="Plank", window="Round", porch="Steps", chimney=None, timber=False, col=dict(roof="red", wall="sky", trim="white", door="red")),
    dict(size="Shed", roof="Hip", door="Arch", window="Square", porch="Steps", chimney=None, timber=True, col=dict(roof="green", wall="cream", trim="wood", door="yellow")),
    dict(size="Manor", roof="Hip", door="Double", window="Arch", porch="Deck", chimney="Brick", timber=False, col=dict(roof="red", wall="cream", trim="white", door="blue")),
    dict(size="Manor", roof="Gable", door="Double", window="Flower", porch="Deck", chimney="Stone", timber=True, col=dict(roof="blue", wall="butter", trim="walnut", door="red")),
    dict(size="Manor", roof="Barn", door="Arch", window="Round", porch="Awning", chimney="Pipe", timber=False, col=dict(roof="green", wall="white", trim="wood", door="yellow")),
]
def assemble(i, e, at):
    S = SIZES[e["size"]]; sk = sockets(S); root = bpy.data.objects.new("KHX_%02d_%s" % (i, e["size"]), None); kc.objects.link(root); root.location = at
    root.empty_display_size = 0.5; root["kh_example"] = json.dumps(e); objs = []   # with its colours, so the game can show the example as it is here
    def add(mesh, sock, tag):
        o = place("KHX_%02d_%s" % (i, tag), mesh, sock[:3], sock[3] if len(sock) > 3 else 0.0, root); objs.append(o); return o
    add("KH_Body_" + e["size"], [0, 0, 0, 0], "Body")
    if e["timber"]: add("KH_Timber_" + e["size"], [0, 0, 0, 0], "Timber")
    rm = "KH_Roof_%s_%s" % (e["roof"], e["size"]); add(rm, sk["roof"], "Roof")
    add("KH_Door_" + e["door"], sk["door"], "Door"); add("KH_Porch_" + e["porch"], sk["porch"], "Porch")
    for j, w in enumerate(sk["windows"]): add("KH_Window_" + e["window"], w, "Window_%d" % j)
    if e["chimney"]:
        c = K[rm]["kh_chimney"]; add("KH_Chimney_" + e["chimney"], [c[0], c[1], sk["roof"][2] + c[2], 0.0], "Chimney")
    dh = 1.3 if e["door"] == "Double" else 0.95; wi = (min(abs(u) for u in S["front"]) - 0.68) if S["front"] else S["hx"] - S["rc"]
    if wi - dh >= 0.45: add("KH_Lantern", [(dh + wi) / 2, sk["door"][1], BASE + 1.9, 0.0], "Lantern")
    table = colours(**e["col"])
    for o in objs: recolour(o, table)
    return root
gx = -34.0; rows = []
lawn = B()
for i, e in enumerate(EXAMPLES):
    S = SIZES[e["size"]]; w = S["plot"] + 3.0
    assemble(i, e, (gx + w / 2, Y0 - 24.0, 0.0)); rows.append("%s %s roof, %s door" % (e["size"], e["roof"], e["door"])); gx += w
x = -34.0
for sz, S in SIZES.items():
    place("KHP_Frame_" + sz, "KH_Frame_" + sz, (x + S["plot"] / 2 + 1, Y0 - 44.0, 0.0)); x += S["plot"] + 3.0
    for rn in khouse.ROOFS:
        place("KHP_Roof_%s_%s" % (rn, sz), "KH_Roof_%s_%s" % (rn, sz), (x + S["plot"] / 2 + 1, Y0 - 44.0, 0.6)); x += S["plot"] + 2.0
for n in khparts.WHOLE: place("KHP_" + n, "KH_" + n, (gx + 4.0, Y0 - 24.0, 0.0)); gx += 9.0
b = B(); b.box((gx + 38.0, 14.0, 0.3), ((gx - 34.0) / 2, Y0 - 24.0, -0.15), "lawn_tex", r=0.1); b.box((x + 38.0, 12.0, 0.3), ((x - 34.0) / 2, Y0 - 44.0, -0.15), "cream", r=0.1)
place("KH_Ground", kit("KH_Ground", b), (0, 0, 0))
ref = bpy.data.collections.get("KINGDOM_CHARACTER_REFERENCE")
if ref:
    body_ = next(o for o in ref.all_objects if o.name.startswith("Kindred_Body")); lo_, hi_ = wbb(body_)
    for i, xk in enumerate((-36.0, -18.0, 2.0, 30.0, gx + 1.0)):
        o = bpy.data.objects.new("KH_Kai_%d" % i, None); o.instance_type = "COLLECTION"; o.instance_collection = ref; kc.objects.link(o)
        o.location = (xk - (lo_.x + hi_.x) / 2, Y0 - 30.0 - (lo_.y + hi_.y) / 2, -lo_.z)
show = bool((NS.get("kk_args") or {}).get("show", True))
show_collection("KINGDOM_HOUSE_KIT", show)
eye, target = Vector((-6.0, Y0 - 62.0, 22.0)), Vector((-6.0, Y0 - 24.0, 2.0)); views = 0
for scr in bpy.data.screens:
    if scr.name != "Layout": continue
    for a_ in scr.areas:
        if a_.type == "VIEW_3D":
            sp = a_.spaces.active; r3 = sp.region_3d; sp.shading.type = "MATERIAL"; sp.shading.use_scene_lights = True; sp.shading.use_scene_world = True
            if r3:
                r3.view_perspective = "PERSP"; r3.view_location = target; r3.view_distance = (eye - target).length; r3.view_rotation = (eye - target).to_track_quat("Z", "Y")
            sp.clip_end = 1500; views += 1
names = sorted(K)
report(parts=len(names), tris=sum(tris(K[n]) for n in names), biggest=sorted(((tris(K[n]), n) for n in names), reverse=True)[:6], examples=rows)
