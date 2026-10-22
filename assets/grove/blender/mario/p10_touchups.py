"""Pass 10: last facade touch-ups found by the audit."""
import bpy
from gk import *
gone = supersede(named("Facade_Level_Badge", "Facade_Level_Text") + [bpy.data.objects.get(n) for n in ("Facade_Vine_Leaf_0_1", "Facade_Vine_Leaf_0_2", "Facade_Vine_Leaf_2_1", "Facade_Vine_Leaf_2_2")])
moved = 0
for shop in ("Fresh", "Style", "Home", "Taste"):
    rail = bpy.data.objects.get(shop + "_Window_Light_Rail"); ceil = bpy.data.objects.get(shop + "_Window_Ceiling")
    if rail and ceil:
        ra, rc = wbb(rail); ca, cc = wbb(ceil)
        rail.location.x += (ca.x + cc.x) / 2 - (ra.x + rc.x) / 2; rail.location.y = rail.location.y + ((ca.y + cc.y) / 2 - (ra.y + rc.y) / 2)
        rail.location.z += ca.z - rc.z + 0.012; moved += 1
bpy.app.driver_namespace["gk_report"] = {"superseded": gone, "rails_moved": moved}
