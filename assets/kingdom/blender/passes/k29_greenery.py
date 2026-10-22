"""Pass 29: the greenery kit in its second look (kgreen.py has the rules). Rebuilds, under their own names, the leafy
kit meshes that were made before it: the planted trees, the far tree, the bush, the rock, the grass tuft, the cloud, the
great tree, every crop and garden flower in all their stages (kcrops.py), and the sapling. Every placed instance follows, because a kit mesh is replaced in place. The trees, shrubs and ground
growth of the wild land are built by k28_sections. Run k09_zfix (report only) on KK_ afterwards."""
import bpy, importlib
from kk import *
import ktone; importlib.reload(ktone)
import kgreen; importlib.reload(kgreen)
import kplants; importlib.reload(kplants)
import ktrees; importlib.reload(ktrees)
K = {}
K["KK_Tree_Round"] = ktrees.round_tree("KK_Tree_Round", "classic")
K["KK_Tree_Apple"] = ktrees.apple_tree("KK_Tree_Apple")
K["KK_Tree_Citrus"] = ktrees.citrus_tree("KK_Tree_Citrus", True)
K["KK_Tree_Citrus_Bare"] = ktrees.citrus_tree("KK_Tree_Citrus_Bare", False)
K["KK_Tree_Round_Far"] = ktrees.far_tree("KK_Tree_Round_Far")
K["KK_Bush"] = ktrees.bush("KK_Bush"); K["KK_Rock"] = kplants.rock("KK_Rock"); K["KK_Grass_Tuft"] = kplants.grass_tuft("KK_Grass_Tuft")
K["KK_Cloud"] = kplants.cloud("KK_Cloud"); K["KK_Great_Tree"] = kplants.great_tree("KK_Great_Tree")
# every crop and garden flower in every stage (third look, kcrops.py): the same names, so beds and growth stages follow
for nm, fn in kplants.CROPS.items():
    for st in (2, 3, 4): n_ = "KK_Crop_%s%s" % (nm, "" if st == 4 else "_S%d" % st); K[n_] = fn(n_, st)
for nm, fn in kplants.FLOWERS.items():
    for st in (2, 3, 4): K["KK_%s_S%d" % (nm, st)] = fn("KK_%s_S%d" % (nm, st), st)
K["KK_Tree_Sapling"] = ktrees.sapling("KK_Tree_Sapling")
bpy.context.view_layer.update()
report(tris={k: tris(v) for k, v in K.items()}, users={k: v.users for k, v in K.items()})
