"""Pass 9 (read only): the bounds of the named items, to find what an audit line is about. Args: ids=[...]."""
import bpy
from ii import *
out = {}
for id in NS.get("ii_args", {}).get("ids", []):
    me = bpy.data.meshes.get("IT_" + id)
    if me: lo, hi = bounds(me); out[id] = [[round(v, 3) for v in lo], [round(v, 3) for v in hi], tris(me), list(me["ki_cells"])]
report(bounds=out)
