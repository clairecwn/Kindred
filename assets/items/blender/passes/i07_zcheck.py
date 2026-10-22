"""Pass 7 (read only): looks for faces of different colours that lie in the same plane, face the same way and overlap,
which flicker in the game. This is the Grove's p29_zfix.py, reporting only, on the showroom objects whose names start
with one of `zonly` (default: every ITEM_). Fix what it finds in the item's builder.
Args: zonly=[name prefixes]; explain=[object names]: also say, for each of these, which pieces meet and where (in the
item's own frame)."""
import os, bpy
from ii import GROVE_KIT, NS
a = dict(NS.get("ii_args", {})); p = os.path.join(GROVE_KIT, "p29_zfix.py")
src = open(p).read().replace("FLOORS = (0.0, 5.0, 10.0)", "ONLY = tuple(args.get('only') or ()); FLOORS = (0.0, 0.8)").replace('SKIP = ("ESC_", "WATER_", "LIFT_")', 'SKIP = ("SR_",)') \
    .replace("o.name.startswith(SKIP) or o.modifiers", "o.name.startswith(SKIP) or o.modifiers or (ONLY and not o.name.startswith(ONLY))").replace('"gk_args"', '"ii_args"').replace('"gk_report"', '"ii_report"')
code = compile(src, p, "exec"); why = {}
for name in a.get("explain", []):
    NS["ii_args"] = dict(apply=False, only=[name], debug=name); exec(code, {"__name__": "__main__"}); o = bpy.data.objects[name]; seen = set(); rows = []
    for d in NS["ii_report"]["debug"]:
        at = [round(d["at"][i] - o.location[i], 3) for i in range(3)]; key = (tuple(d["n"]), round(at[2], 2), round(at[1], 2))
        if key not in seen: seen.add(key); rows.append({"n": d["n"], "at": at})
    why[name] = rows[:5]
NS["ii_args"] = dict(apply=False, only=a.get("zonly") or ["ITEM_"]); exec(code, {"__name__": "__main__"})
r = NS["ii_report"]; NS["ii_report"] = {"pairs": r["pairs"], "items": r["moved_by_object"], "why": why, "secs": r["secs"]}
