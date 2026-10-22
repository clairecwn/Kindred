"""Pass 8 (read only): checks every item mesh against the standard. Origin where its type says, inside its cells,
inside its triangle limit, at least 0.18 m, palette materials only, properties present, placed at scale 1."""
import bpy
from ii import *
bad = []; n = 0
for me in sorted(bpy.data.meshes, key=lambda m: m.name):
    if not me.name.startswith("IT_"): continue
    n += 1; t = me.get("ki_type"); cells = me.get("ki_cells"); lo, hi = bounds(me); size = hi - lo; p = []
    if not me.get("ki_id") or t not in TYPES or cells is None or not me.get("ki_shop") or not me.get("ki_label"):
        p.append("properties missing")
    else:
        e = 1e-3
        if t == "wall":
            if abs(hi.y) > 0.005: p.append("back is not on the wall (y %.3f)" % hi.y)
            if max(-lo.x, hi.x) > cells[0] / 2 + e or max(-lo.z, hi.z) > cells[1] / 2 + e: p.append("outside its cells")
        else:
            if t == "hang":
                if abs(hi.z) > 0.005: p.append("top is not at the origin (z %.3f)" % hi.z)
            elif abs(lo.z) > 0.005: p.append("base is not on the floor (z %.3f)" % lo.z)
            if max(-lo.x, hi.x) > cells[0] / 2 + e or max(-lo.y, hi.y) > cells[1] / 2 + e: p.append("outside its cells")
        lim = tri_limit({"cells": cells, "type": t}, size)
        if tris(me) > lim: p.append("%d triangles, limit %d" % (tris(me), lim))
        if max(size) < 0.18: p.append("smaller than 0.18 m")
    if any((m is None) or not m.name.startswith(("KI_", "KV_")) for m in me.materials): p.append("material outside the palette")
    for o in bpy.data.objects:
        if o.data == me and any(abs(s - 1) > 1e-5 for s in o.scale): p.append("placed at a scale other than 1")
    if p: bad.append(me.name + ": " + "; ".join(p))
report(items=n, problems=bad)
