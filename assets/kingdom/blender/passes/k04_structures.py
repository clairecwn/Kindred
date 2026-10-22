"""Pass 4: structures. Every building and prop was a loose set of boxes. Each becomes one mesh (or a few, where a
part must be hidden or animated on its own: the roof, the ceiling, water). Identical pieces share one mesh."""
import bpy, re, collections
from kk import *
NS.pop("kk_join_cache", None)
def base(n): return re.sub(r"(?:[_\.]-?\d+)+$", "", n)
def pick(coll, *prefixes):
    return [o for o in C(coll).objects if not o.name.startswith(("K_", "KK_")) and o.name.startswith(prefixes)]
G = [
 ("KINGDOM_HOUSE", "K_House_Shell", ("House_foundation", "House_floor", "Floor_board", "House_front_wall", "House_corner_trim", "Cottage_front_gable_shell", "Cottage_rear_gable_shell", "Door_jamb", "Door_header", "Interior_skirting")),
 ("KINGDOM_HOUSE", "K_House_Ceiling", ("Cottage_ceiling",)),
 ("KINGDOM_HOUSE", "K_House_Windows", ("Side_glass", "Side_frame", "Side_sill", "Front_glass", "Window_jamb", "Window_frame", "Window_cross", "Interior_rear")),
 ("KINGDOM_HOUSE", "K_House_Shutters", ("Blue_shutter", "Shutter_slat")),
 ("KINGDOM_HOUSE", "K_House_WindowBoxes", ("Window_box",)),
 ("KINGDOM_HOUSE", "K_House_Door", ("Open_blue_door", "Door_knob")),
 ("KINGDOM_HOUSE", "K_House_Porch", ("Porch",)),
 ("KINGDOM_HOUSE", "K_House_Chimney", ("Chimney",)),
 ("KINGDOM_HOUSE", "K_House_Vent", ("Attic_vent", "Vent_louver")),
 ("KINGDOM_FARM", "K_Tool_Shed", ("Tool_shed_body", "Tool_shed_door", "Shed_jamb", "Shed_door_lintel")),
 ("KINGDOM_FARM", "K_Garden_Rake", ("Garden_rake", "Rake_tine")),
 ("KINGDOM_STABLE", "K_Stable", ("Stable_floor", "Stable_back", "Stable_side", "Stable_post", "Stable_front_header")),
 ("KINGDOM_STABLE", "K_Trough", ("Trough_base",)),
 ("KINGDOM_STABLE", "K_Trough_Water", ("Trough_water",)),
 ("KINGDOM_STABLE", "K_Paddock_Fence_Left", ("Paddock_left",)),
 ("KINGDOM_STABLE", "K_Paddock_Fence_Front", ("Paddock_front",)),
 ("KINGDOM_STABLE", "K_Paddock_Fence_Right", ("Paddock_right",)),
 ("KINGDOM_DOCK", "K_Dock", ("Dock_",)),
 ("KINGDOM_DECOR", "K_Garden_Bench", ("Garden_bench", "Bench_back")),
 ("KINGDOM_DECOR", "K_Mailbox", ("Arrival_mailbox", "Mailbox_slot")),
 ("KINGDOM_GARDEN", "K_Pond_Bank", ("Pond_bank",)),
 ("KINGDOM_GARDEN", "K_Pond_Water", ("Pond_water",)),
 ("KINGDOM_BACKDROP", "K_Sea_Glints", ("Sea_glint",)),
 ("KINGDOM_BACKDROP", "K_Shore_Foam", ("Shore_foam",)),
]
rep = collections.OrderedDict()
for coll, name, pre in G:
    objs = pick(coll, *pre)
    if objs:
        o = join(name, objs, coll); rep[name] = [len(objs), tris(o.data)]
# repeated pieces: one object each, mesh shared where identical
for coll, pre, new in (("KINGDOM_GARDEN", "Pond_stone", "K_Pond_Stone"), ("KINGDOM_GARDEN", "Lily_pad", "K_Lily_Pad"),
                       ("KINGDOM_STABLE", "Hay_bale", "K_Hay_Bale"), ("KINGDOM_TERRAIN", "Shore_rock", "K_Shore_Rock")):
    for i, o in enumerate(sorted(pick(coll, pre), key=lambda o: o.name)): join("%s_%d" % (new, i), [o], coll)
for i in range(3):
    join("K_Garden_Bed_%d" % i, pick("KINGDOM_GARDEN", "Garden_bed_%d" % i, "Garden_soil_%d" % i), "KINGDOM_GARDEN")
for o in list(C("KINGDOM_FARM").objects):
    m = re.match(r"Plot_(\d+)_(\d+)_border$", o.name)
    if m: join("K_Crop_Bed_%s_%s" % m.groups(), pick("KINGDOM_FARM", "Plot_%s_%s_" % m.groups()), "KINGDOM_FARM")
supersede([o for o in C("KINGDOM_DECOR").objects if o.type == "EMPTY"])
sc = bpy.context.scene
live = [o for o in sc.objects if o.type == "MESH" and o.visible_get() and o.users_collection[0].name not in ("KINGDOM_CHARACTER_REFERENCE",)]
report(joined=rep, objects=len(live), meshes=len({o.data.name for o in live}),
       tris=sum(tris(o.data) for o in live), left=[o.name for o in live if not o.name.startswith("K_")])
