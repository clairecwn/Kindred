"""Pass 11: landmark and emblem. The great tree on its terrace (the one thing seen from everywhere), the arrival arch
where the dock meets the island, and the sprout on the mailbox. The roofs get theirs in k02."""
import bpy, importlib, json
from kk import *
import kplants, kbuild, kterrain, ktone, kworld
for m in (kplants, kbuild, kterrain, ktone, kworld): importlib.reload(m)
from ktone import TB
phi, rho = kterrain.home_rho(); S = kterrain.rho_at(phi, rho, 1.5 * pi)          # the lawn's south edge, where the dock lands
W = "KINGDOM_TERRAIN"
me = kplants.great_tree("KK_Great_Tree")
o = put("K_Great_Tree", me, W, (kterrain.HILL[0], kterrain.HILL[1], kterrain.HILL_Z), rz=0.55, sc=2.2)      # 1.3 on the first island; it has to stay the tallest thing on a bigger one
o["kk_posts"] = json.dumps([[kterrain.HILL[0], kterrain.HILL[1], 2.3]])      # for the walk grid: the trunk. The crown is open puffs, so the tree cannot be tested as a closed solid
b = B(); kbuild.arch(b); ar = put("K_Arrival_Arch", kit("K_Arrival_Arch", b), "KINGDOM_WORLD", (0, -(S - 0.85), Z))
ar["kk_posts"] = json.dumps([[sx * 2.0, round(-(S - 0.85), 2), 0.46] for sx in (-1, 1)])      # for the walk grid: what of the arch stands in the way
# the pier. Codex's dock stopped where the wider beach now meets the water; this one reaches 7 m out over the sea
old = bpy.data.objects.get("K_Dock")
if old is not None and not old.get("kk_dock"): old.name = "K_Dock_Codex"; old.data.name = "K_Dock_Codex"; supersede([old])
b = TB(); info = kworld.dock(b); dk = put("K_Dock", kit("K_Dock", b), "KINGDOM_WORLD", (0, -S, Z), pi)
dk["kk_floor_top"] = 0.06                              # for the walk grid: only the deck is floor
dk["kk_dock"] = json.dumps({"from": [0.0, round(-S, 2)], "end": [0.0, round(-S - info["length"], 2)], "width": info["width"], "head": info["head"],
                            "spawn": [0.0, round(-S - info["spawn"][1], 2)], "moor": [round(-info["moor"][0], 2), round(-S - info["moor"][1], 2)],
                            "lights": [[round(-p[0], 2), round(-S - p[1], 2), round(Z + p[2], 2)] for p in info["lights"]]})
mb = bpy.data.objects["K_Mailbox"]; mb.location.x, mb.location.y = -2.0, -(S - 2.0); bpy.context.view_layer.update(); lo, hi = wbb(mb)
b = B(); kbuild.sprout(b, (0, 0, 0), 0.38); put("K_Mailbox_Sprout", kit("KK_Sprout_Small", b), "KINGDOM_DECOR", ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z - 0.02))
report(tris={"great_tree": tris(me), "arch": tris(bpy.data.objects["K_Arrival_Arch"].data), "dock": tris(dk.data)}, south_edge=round(S, 2), tree_top=round(wbb(o)[1].z, 1))
