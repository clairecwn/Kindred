"""Pass 10: terrain. Replaces Codex's one-piece pancake island (one flat slab with a slanted sand rim) with land built
from outlines: a checkered plateau with a striped cliff and a grass lip, a real beach that runs under the sea, and a
raised headland in the north-west for the great tree, reached by a ramp. The outline's size is kterrain.GROW."""
import bpy, importlib, json
from kk import *
import ktone; importlib.reload(ktone)          # names such as sand_dk
import kterrain; importlib.reload(kterrain)
from kterrain import *
from math import atan2, hypot
TERR = "KINGDOM_TERRAIN"; BD = "KINGDOM_BACKDROP"
phi, rho = home_rho()
pts = ring(phi, rho)
b = B(); tier(b, pts, 0.3, Z); put("K_Home_Island", kit("K_Home_Island", b, 50), TERR)
b = B(); shore = beach(b, phi, rho); put("K_Home_Beach", kit("K_Home_Beach", b, 62), TERR)
b = B(); foam(b, phi, shore); put("K_Shore_Foam", kit("K_Shore_Foam", b), BD)
# the great tree's terrace and its ramp
hx, hy = HILL
b = B(); tier(b, circle(HILL, HILL_R, 64), Z - 0.3, HILL_Z)
RX0, RX1 = hx - 0.5, hx + 2.1; Y1 = hy - HILL_R - 0.2; Y0 = Y1 - (HILL_Z - Z) / 0.375      # ramp: 2.6 m wide, rises 1.8 m over 4.8 m (about 21 degrees). It is level before it
                                                             # reaches the terrace's grass lip, so the lip never shows through the paving
b.prism([(Y0 + 0.1, Z - 0.1), (Y1 + 0.9, Z - 0.1), (Y1 + 0.9, HILL_Z - 0.06), (Y1, HILL_Z - 0.06), (Y0 + 0.1, Z - 0.02)], RX1 - RX0 - 0.04, "cliff_tex", mtx=YZ(RX0 + 0.02))
b.prism([(Y0, Z), (Y1, HILL_Z), (Y1 + 2.0, HILL_Z), (Y1 + 2.0, HILL_Z + 0.05), (Y1, HILL_Z + 0.05), (Y0, Z + 0.05)], RX1 - RX0 - 0.44, "path_tex", mtx=YZ(RX0 + 0.22))
for x0 in (RX0, RX1 - 0.22):                                  # kerbs
    b.prism([(Y0 + 0.05, Z), (Y1, HILL_Z), (Y1 + 0.7, HILL_Z), (Y1 + 0.7, HILL_Z + 0.16), (Y1, HILL_Z + 0.16), (Y0 + 0.05, Z + 0.16)], 0.22, "stone", mtx=YZ(x0))
put("K_Hill_Terrace", kit("K_Hill_Terrace", b, 50), TERR)
supersede([o for o in bpy.data.objects if o.name == "Home_Island"])
# (What stood on the old rim was moved here once. Those pieces were retired in Phase 11, so nothing is moved now.)
bpy.data.objects["K_Hill_Terrace"]["kk_terrace"] = json.dumps({"centre": list(HILL), "radius": HILL_R, "top": HILL_Z, "ramp": [round(v, 2) for v in (RX0, RX1, Y0, Y1 + 2.0)]})
report(tris={n: tris(bpy.data.objects[n].data) for n in ("K_Home_Island", "K_Home_Beach", "K_Shore_Foam", "K_Hill_Terrace")},
       edge_south=round(rho_at(phi, rho, 1.5 * pi), 2), edge_north=round(rho_at(phi, rho, 0.5 * pi), 2))
