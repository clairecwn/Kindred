"""Pass 9: z-fight fix. Run it LAST in a round. This is the Grove's p29_zfix.py with the Kingdom's ground height:
overlapping same-plane faces of different colours are separated by 4 mm, smaller piece moved. The character reference is skipped (it is not part of the island and its
face decals must not move). Args: apply (bool); only (list of object name prefixes: check just those objects, which is quick for a kit); debug (an object name: report the pairs that move it)."""
import os
from kk import GROVE_KIT
p = os.path.join(GROVE_KIT, "p29_zfix.py")
src = open(p).read().replace("FLOORS = (0.0, 5.0, 10.0)", "FLOORS = (2.0, 0.0)").replace('SKIP = ("ESC_", "WATER_", "LIFT_")', 'SKIP = ("Face", "Hair_", "Kindred_Body", "Tongue", "Icosphere", "KRF_")').replace('"gk_args"', '"kk_args"').replace("o.name.startswith(SKIP) or o.modifiers", "o.name.startswith(SKIP) or o.modifiers or (ONLY and not o.name.startswith(ONLY))").replace("FLOORS = ", "ONLY = tuple(args.get('only') or ()); FLOORS = ", 1).replace('"gk_report"', '"kk_report"')
# The Grove's check calls two faces one plane when their normals round alike and their planes pass the origin at the same
# distance. Away from the origin a face tilted by a degree can pass that test from 30 cm off, so here a pair also has to
# be near in fact: a corner of one face within 1 cm of the other face's plane.
old = "            if abs(D[gi] - D[gj]) > GAP or np.dot(N[gi], N[gj]) < 0.99: continue\n"
assert old in src
src = src.replace(old, old + "            if np.abs((V[gj] - V[gi][0]) @ N[gi]).min() > 4 * GAP and np.abs((V[gi] - V[gj][0]) @ N[gj]).min() > 4 * GAP: continue\n")
exec(compile(src, p, "exec"), {"__name__": "__main__"})
