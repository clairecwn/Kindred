"""Pass 15: the slice kit. The pieces the first playable loop needs, each one mesh at its own origin:
  house ladder   KK_Tent (day 1), KK_Cabin_Frame (being built), KK_Cabin (6 x 6 cells)
  growth         KK_Seedling (stage 1 of everything), carrot stages 2 to 4, daisy stages 2 to 4
  decor          KK_Bench (2 x 1 cells), KK_Fence_Post and KK_Fence_Rail (1 cell, joins to its neighbours)
They are also set out on a shelf south of the island (collection KINGDOM_KIT, unticked) so they can be looked at.
Every run rebuilds the kit meshes, so run k09_zfix after it with the shelf showing (show=True), then hide the shelf
with kk.show_collection("KINGDOM_KIT", False). Running this pass again would undo the z-fix."""
import bpy, importlib
from kk import *
import kbuild, kplants
importlib.reload(kbuild); importlib.reload(kplants)
import kcrops, ktrees, kcamp; importlib.reload(kcrops); importlib.reload(ktrees); importlib.reload(kcamp)
K = kplants.build_all()
def one(name, fn):
    b = B(); fn(b); K[name] = kit(name, b); return K[name]
for name, fn in (("KK_Tent", kcamp.tent), ("KK_Cabin_Frame", kcamp.cabin_frame), ("KK_Cabin", kbuild.cabin), ("KK_Bench", kbuild.bench),
                 ("KK_Fence_Post", kbuild.fence_post), ("KK_Fence_Rail", kbuild.fence_rail), ("KK_Campfire", kcamp.campfire),
                 ("KK_Log_Stool", kcamp.log_stool), ("KK_Sign_Sprout", kbuild.sign)):
    one(name, fn)
SHELF = (["KK_Tent", "KK_Cabin_Frame", "KK_Cabin", "KK_Bench", "KK_Fence_Post", "KK_Fence_Rail", "KK_Campfire", "KK_Log_Stool", "KK_Sign_Sprout",
          "KK_Seedling", "KK_Wet_Patch"]
         + [n for c in kplants.CROPS for n in ("KK_Crop_%s_S2" % c, "KK_Crop_%s_S3" % c, "KK_Crop_" + c)]
         + ["KK_%s_S%d" % (f, s_) for f in kplants.FLOWERS for s_ in (2, 3, 4)]
         + ["KK_Tree_Sapling", "KK_Tree_Round", "KK_Tree_Apple", "KK_Tree_Citrus_Bare", "KK_Tree_Citrus",
            "KK_Bush", "KK_Rock", "KK_Grass_Tuft", "KK_Flower_pink", "KK_Flower_yellow", "KK_Flower_white", "KK_Flower_purple"])
for stale in ("KK_Flower_S2", "KK_Flower_pink_S3"):          # the daisy's old single-colour stages
    m_ = bpy.data.meshes.get(stale)
    if m_ and m_.users == 0: bpy.data.meshes.remove(m_)
kc = ccol("KINGDOM_KIT")
for o in list(kc.objects): bpy.data.objects.remove(o, do_unlink=True)
x = -24.0; row = 0; right = -24.0
for n in SHELF:
    me = bpy.data.meshes[n]; xs = [v.co.x for v in me.vertices]; w = max(max(xs) - min(xs), 1.0)
    if x + w > 24.0: x = -24.0; row += 1
    o = bpy.data.objects.new("KIT_" + n[3:], me); kc.objects.link(o); o.location = (x + w / 2, -60 - 8.0 * row, 0); x += w + 1.0; right = max(right, x)
b = B(); b.box((right + 26.0, 8.0 * (row + 1) + 2.0, 0.3), ((right - 24.0) / 2 - 0.5, -60 - 4.0 * row, -0.16), "cream", r=0.1)        # something for the shelf to stand on
o = bpy.data.objects.new("K_Kit_Shelf", kit("K_Kit_Shelf", b)); kc.objects.link(o)
def layer(c, lc=None):
    lc = lc or bpy.context.view_layer.layer_collection
    if lc.collection == c: return lc
    for ch in lc.children:
        r = layer(c, ch)
        if r: return r
show = bool((NS.get("kk_args") or {}).get("show", False))
layer(kc).exclude = not show
NS["kk_kit_list"] = SHELF
report(pieces=len(SHELF), kit_tris=sum(tris(bpy.data.meshes[n]) for n in SHELF), biggest=sorted(((tris(bpy.data.meshes[n]), n) for n in SHELF), reverse=True)[:5])
