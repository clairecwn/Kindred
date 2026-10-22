"""Pass 5 (read only): the character's measurements in the showroom, so things that are worn or held are sized to the
body part they go on. Reports the box around the whole body and around the vertices each bone moves."""
import bpy
from ii import *
ref = bpy.data.collections["SCALE_REFERENCE"]; out = {}
for o in ref.all_objects:
    if o.type != "MESH": continue
    lo, hi = wbb(o); out[o.name] = "x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f" % (lo.x, hi.x, lo.y, hi.y, lo.z, hi.z)
    if o.name.startswith("Kindred_Body"):
        mw = o.matrix_world; names = {g.index: g.name for g in o.vertex_groups}; box = {}
        for v in o.data.vertices:
            if not v.groups: continue
            g = max(v.groups, key=lambda g: g.weight); n = names[g.group]; w = mw @ v.co
            b = box.setdefault(n, [list(w), list(w)])
            for i in range(3): b[0][i] = min(b[0][i], w[i]); b[1][i] = max(b[1][i], w[i])
        for n, (a, c) in sorted(box.items()):
            out["bone " + n] = "x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f" % (a[0], c[0], a[1], c[1], a[2], c[2])
report(**out)
