"""Pass 15: dress the mall's inside walls. A level-coloured wainscot with a white rail on every floor and
arched windows on the inside faces, so the wings no longer read as blank cream boxes."""
import bpy
from gk import *

Wc = fresh("MARIO_WALLS", "GROVE_ATRIUM_REFINEMENT"); WIN = bpy.data.meshes["GK_Window"]; ACC = {0: "yellow", 5: "blue", 10: "pink"}
b = B(); k = 0
for z, acc in ACC.items():
    for (p0, p1) in (((-29.7, -21.7), (-29.62, 21.7)), ((29.62, -21.7), (29.7, 21.7)), ((-29.7, -21.7), (29.7, -21.62)), ((-29.7, 21.62), (-10, 21.7)), ((10, 21.62), (29.7, 21.7))):
        b.box2((p0[0], p0[1], z + 0.0), (p1[0], p1[1], z + 0.9), acc)
        hz = abs(p1[0] - p0[0]) > abs(p1[1] - p0[1])
        b.box2((p0[0] - (0 if hz else 0.04), p0[1] - (0.04 if hz else 0), z + 0.9), (p1[0] + (0 if hz else 0.04), p1[1] + (0.04 if hz else 0), z + 1.02), "white", r=0.03, seg=1)
    for x in range(-25, 26, 5):
        if x in (-10,) or (z == 0 and abs(x) <= 5): continue
        inst(f"Mall_InWindow_{k}", WIN, Wc, (x, -21.7, z + 1.35), rz=pi); k += 1
    for y in (-18, -12, -6, 6, 12, 18):
        inst(f"Mall_InWindow_{k}", WIN, Wc, (-29.7, y, z + 1.35), rz=pi / 2); k += 1
        inst(f"Mall_InWindow_{k}", WIN, Wc, (29.7, y, z + 1.35), rz=-pi / 2); k += 1
    for x in (-26, -20, -14, 14, 20, 26):
        inst(f"Mall_InWindow_{k}", WIN, Wc, (x, 21.7, z + 1.35)); k += 1
b.obj("Mall_Wainscot", Wc)
bpy.app.driver_namespace["gk_report"] = {"windows": k}
