"""Pass 27: the life kit. Builds every part in klife.KIT as one shared mesh (KL_<name>), writes its facts on the mesh
(kl_group and whatever its builder returned) and sets the parts out in rows on a strip of lawn and on the sea beside it, with the
character beside them for size. Everything is in the collection KINGDOM_LIFE_KIT, south of the room kit (y = -320).
Never exported with the island; k24_export_life writes the kit for the game."""
import bpy, importlib, json
from kk import *
import ktone; importlib.reload(ktone)
import klife; importlib.reload(klife)
from ktone import TB
K = {}
for name, fn, group in klife.KIT:
    b = TB(); info = fn(b) or {}; me = kit("KL_" + name, b); K[name] = me
    for k_ in [k_ for k_ in me.keys() if k_.startswith("kl_")]: del me[k_]
    me["kl_group"] = group
    for k_, v in info.items(): me["kl_" + k_] = v
kc = ccol("KINGDOM_LIFE_KIT")
for o in list(kc.objects): bpy.data.objects.remove(o, do_unlink=True)
Y0 = -320.0; x = -14.0; where = {}; SEA = -0.15          # the sea's surface: the last row floats on the real sea, south of the strip of lawn
ROWS = [(["Pony", "Pony_Graze", "Cow", "Cow_Graze", "Sheep", "Sheep_Graze"], 0.0, 0.0), (["Chicken", "Chicken_Peck", "Chick", "Duck", "Cat_Sit", "Bird", "Bird_Fly", "Butterfly", "Butterfly_Body", "Butterfly_Wing", "Smoke_Puff"], -4.0, 0.0),
        (["Duck_Swim", "Ripple", "Boat"], -9.0, SEA)]
for names, dy, dz in ROWS:
    x = -14.0
    for n in names:
        me = K[n]; xs = [v.co.x for v in me.vertices]; w = max(max(xs) - min(xs), 0.5); lift = {"Bird_Fly": 1.2, "Butterfly": 0.9, "Butterfly_Body": 0.9, "Butterfly_Wing": 0.9, "Smoke_Puff": 0.6}.get(n, 0.0)
        o = bpy.data.objects.new("KLP_" + n, me); kc.objects.link(o); o.location = (x + w / 2, Y0 + dy, dz + lift); where[n] = [round(x + w / 2, 2), Y0 + dy]; x += w + (1.2 if dy == 0 else 0.8)
b = B(); b.box((34.0, 9.0, 0.3), (0, Y0 - 2.0, -0.15), "lawn_tex", r=0.1)
o = bpy.data.objects.new("KL_Display", kit("KL_Display", b)); kc.objects.link(o)
ref = bpy.data.collections.get("KINGDOM_CHARACTER_REFERENCE")
if ref:
    body_ = next(o for o in ref.all_objects if o.name.startswith("Kindred_Body")); lo_, hi_ = wbb(body_)
    for i, (xk, yk) in enumerate(((-15.5, Y0), (-15.5, Y0 - 4.0))):
        o = bpy.data.objects.new("KL_Kai_%d" % i, None); o.instance_type = "COLLECTION"; o.instance_collection = ref; kc.objects.link(o)
        o.location = (xk - (lo_.x + hi_.x) / 2, yk - (lo_.y + hi_.y) / 2, -lo_.z)
show_collection("KINGDOM_LIFE_KIT", bool((NS.get("kk_args") or {}).get("show", True)))
bpy.context.view_layer.update(); NS["kl_where"] = where
names = sorted(K)
report(parts=len(names), tris={n: tris(K[n]) for n in names}, total=sum(tris(K[n]) for n in names), where=where)
