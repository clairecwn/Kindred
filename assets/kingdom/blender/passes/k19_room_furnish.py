"""Pass 19: furnish the five example rooms, to judge the furniture in the rooms it is for. Run after k18_room_kit
(which clears the collection). The furniture is LINKED from assets/items/blender/kindred_items.blend, not copied: the
item models have one home, and a change there shows here the next time this file is opened. Linked meshes cannot be
edited here and are never exported from this file. Objects are KRF_<room>_<item>_<n>, children of the room's empty.
A floor piece is (id, x, y, quarter turns); a piece on a surface adds its height; a wall piece is (id, wall, along, height).
Positions are in the room's own frame, on the 0.5 m grid (a piece with an odd number of half-metre cells sits on a
quarter). The pass checks that no two floor pieces overlap, that each is inside its room and clear of the built-in parts."""
import bpy, os, json
from kk import *
import kroom
ITEMS = os.path.join(ROOT, "assets", "items", "blender", "kindred_items.blend"); INFO = json.load(open(os.path.join(ROOT, "frontend", "public", "models", "items", "items.json")))["items"]
Q = pi / 2
ROOMS = kroom.FURNITURE          # the layouts live in kroom.py, so k23_export_room can write them for the game
need = sorted({"IT_" + INFO[e[0]]["model"] for r in ROOMS.values() for k in r.values() for e in k})
have = {m.name: m for m in bpy.data.meshes if m.library and m.name in need}
miss = [n for n in need if n not in have]
if miss:
    with bpy.data.libraries.load(ITEMS, link=True, relative=True) as (src, dst): dst.meshes = [n for n in src.meshes if n in miss]
    have.update({m.name: m for m in dst.meshes if m})
kc = ccol("KINGDOM_ROOM_KIT")
for o in [o for o in kc.objects if o.name.startswith("KRF_")]: bpy.data.objects.remove(o, do_unlink=True)
problems = []; placed = 0
def rect(id, x, y, q):
    w, d = INFO[id]["cells"]
    if q % 2: w, d = d, w
    return (x - w / 2, y - d / 2, x + w / 2, y + d / 2)
def hit(a, b): return a[0] < b[2] - 0.01 and b[0] < a[2] - 0.01 and a[1] < b[3] - 0.01 and b[1] < a[3] - 0.01
for root in [o for o in kc.objects if o.get("kr_example")]:
    e = json.loads(root["kr_example"]); name = e["room"]; W, D = kroom.ROOMS[name]; spec = ROOMS[name]; n = 0
    built = []                                  # floor the room's own parts take up
    for pn, wall, u, z in e["parts"]:
        me = bpy.data.meshes["KR_" + pn]; xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
        if pn.startswith(("Fireplace", "Stair_Up", "Door")) and wall != "floor":
            if wall == "back": built.append((pn, (u + min(xs), D / 2 + min(ys), u + max(xs), D / 2)))
            elif wall == "left": built.append((pn, (-W / 2, u + min(xs), -W / 2 - min(ys), u + max(xs))))
            else: built.append((pn, (W / 2 + min(ys), u - max(xs), W / 2, u - min(xs))))
            if pn == "Door": built[-1] = (pn, (built[-1][1][0] - 0.0, built[-1][1][1], built[-1][1][2] + 0.9 if wall == "left" else built[-1][1][2], built[-1][1][3]))      # room to walk through it
        elif pn in ("Stair_Down", "Doormat"): built.append((pn, (u + min(xs), z + min(ys), u + max(xs), z + max(ys))))
    def put_(id, loc, rz):
        global placed
        o = bpy.data.objects.new("KRF_%s_%s_%d" % (name, id, placed), have["IT_" + INFO[id]["model"]]); kc.objects.link(o); o.parent = root; o.location = loc; o.rotation_euler = (0, 0, rz); placed += 1
    rects = []
    for id, x, y, q in spec["floor"]:
        r = rect(id, x, y, q); put_(id, (x, y, 0.0), q * Q)
        if r[0] < -W / 2 - 0.01 or r[2] > W / 2 + 0.01 or r[1] < -D / 2 + 0.19 or r[3] > D / 2 + 0.01: problems.append("%s: %s is outside the room" % (name, id))
        if INFO[id]["type"] == "rug": continue
        for oid, orr in rects:
            if hit(r, orr): problems.append("%s: %s overlaps %s" % (name, id, oid))
        for pn, pr in built:
            if hit(r, pr): problems.append("%s: %s stands on the %s" % (name, id, pn))
        rects.append((id, r))
    for id, x, y, z in spec["on"]: put_(id, (x, y, z), 0.0)
    for id, wall, u, z in spec["wall"]:
        loc, rz = ((u, D / 2, z), 0.0) if wall == "back" else ((-W / 2, u, z), Q) if wall == "left" else ((W / 2, u, z), -Q); put_(id, loc, rz)
bpy.context.view_layer.update()
used = sorted({e[0] for r in ROOMS.values() for k in r.values() for e in k})
report(placed=placed, pieces=len(used), furniture_not_shown=sorted(i for i, v in INFO.items() if v["shop"] == "furniture" and i not in used), problems=problems)
