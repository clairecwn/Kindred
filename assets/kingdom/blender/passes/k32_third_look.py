"""Pass 32: trees, wild growth and the camp in their third look (ktrees.py, kcamp.py have the rules). Rebuilds every
one of these kit meshes in place under its own name, so every placed instance follows, and adds the campfire's flame
(KK_Campfire_Flame) to the kit shelf beside the campfire. Run k09_zfix (report only) afterwards."""
import bpy, importlib
from kk import *
import ktone; importlib.reload(ktone)
from ktone import TB
import kgreen; importlib.reload(kgreen)
import kcrops; importlib.reload(kcrops)
import ktrees; importlib.reload(ktrees)
import kbuild; importlib.reload(kbuild)
import kcamp; importlib.reload(kcamp)
K = {}
def one(name, fn, *a):
    b = TB(); fn(b, *a); K[name] = kit(name, b, 62)
K["KK_Tree_Round"] = ktrees.round_tree("KK_Tree_Round", "classic")
K["KK_Tree_Round_Far"] = ktrees.far_tree("KK_Tree_Round_Far")
K["KK_Tree_Apple"] = ktrees.apple_tree("KK_Tree_Apple")
K["KK_Tree_Citrus"] = ktrees.citrus_tree("KK_Tree_Citrus", True)
K["KK_Tree_Citrus_Bare"] = ktrees.citrus_tree("KK_Tree_Citrus_Bare", False)
K["KK_Tree_Sapling"] = ktrees.sapling("KK_Tree_Sapling")
K["KK_Bush"] = ktrees.bush("KK_Bush")
for n, args in (("A", ("A", "classic")), ("A2", ("A", "deep")), ("B", ("B", "classic")), ("B2", ("B", "warm")), ("C", ("C", "deep")), ("D", ("D", "warm")), ("D2", ("D", "classic"))):
    one("KK_Tree_Wild_" + n, ktrees.wild_tree, *args)
one("KK_Tree_Blossom", ktrees.wild_tree, "B", "blossom")
one("KK_Thicket_A", ktrees.shrub, "A", "classic", "pink"); one("KK_Thicket_B", ktrees.shrub, "B", "deep")
one("KK_Fern", ktrees.fern); one("KK_Mushrooms", ktrees.mushrooms); one("KK_Log", ktrees.log); one("KK_Stump", ktrees.stump)
for pc, core in (("pink", "gold"), ("yellow", "white"), ("purple", "gold"), ("white", "gold")):
    K["KK_Flower_" + pc] = ktrees.wild_flower("KK_Flower_" + pc, pc, core)
one("KK_Tent", kcamp.tent); one("KK_Campfire", kcamp.campfire); one("KK_Campfire_Flame", kcamp.campfire_flame)
one("KK_Cabin_Frame", kcamp.cabin_frame); one("KK_Log_Stool", kcamp.log_stool)
one("KK_Fence_Post", kbuild.fence_post); one("KK_Fence_Rail", kbuild.fence_rail)
kitc = bpy.data.collections["KINGDOM_KIT"]; fire = bpy.data.objects.get("KIT_Campfire")
o = bpy.data.objects.get("KIT_Campfire_Flame") or bpy.data.objects.new("KIT_Campfire_Flame", K["KK_Campfire_Flame"])
if o.name not in kitc.objects: kitc.objects.link(o)
o.data = K["KK_Campfire_Flame"]
if fire: o.location = fire.location.copy(); o.rotation_euler = fire.rotation_euler.copy()
bpy.context.view_layer.update()
report(tris={k: tris(v) for k, v in K.items()}, users={k: v.users for k, v in K.items()})
