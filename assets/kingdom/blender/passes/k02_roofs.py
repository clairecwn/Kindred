"""Pass 2: roofs. Each roof was a flat two-face plane with 110 loose tile boxes laid on it (about 2,500 same-plane
overlaps, most of the flicker) and gable boards that ran past the roof. Each is now one mesh from kbuild.gable_roof.
The porch roof also stops at the house wall: it used to run 0.6 m into the room above the door."""
import bpy, importlib
from kk import *
import kbuild; importlib.reload(kbuild)
ROOFS = [  # name, collection, origin (ridge centre at eave height), W, L, H, tile, tile2, cap, boards, sprout size
    ("K_Cottage_Roof", "KINGDOM_HOUSE", (-3.0, 6.75, 5.6), 6.21, 12.0, 2.55, "red", "roof_light", "roof_dark", (True, True), 0.95),
    ("K_Porch_Roof", "KINGDOM_HOUSE", (-3.0, 0.185, 5.03), 2.18, 2.17, 0.83, "red", "roof_light", "roof_dark", (True, False), 0.0),
    ("K_Shed_Roof", "KINGDOM_FARM", (14.0, 11.0, 3.85), 1.73, 2.5, 1.0, "red", "roof_light", "roof_dark", (True, True), 0.55),
    ("K_Stable_Roof", "KINGDOM_STABLE", (12.0, -6.0, 5.03), 2.93, 4.9, 1.3, "blue", "blue", "blue", (True, True), 0.7),
]
OLD = ("Cottage_roof", "Porch_canopy", "Tool_shed_roof", "Stable_roof")
rep = {}
for name, coll, loc, W, L, H, t1, t2, cap, boards, fin in ROOFS:
    b = B()
    info = kbuild.gable_roof(b, W, L, H, KI(t1), KI(t2), KI(cap), KI("white"), boards=boards, finial=fin)
    me = kit(name, b, 50)
    put(name, me, coll, loc)
    info["tris"] = tris(me); rep[name] = info
old = [o for o in bpy.context.scene.objects if o.name.startswith(OLD) and not o.name.startswith("K_")]
rep["retired"] = supersede(old)
report(**rep)
