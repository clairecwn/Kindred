"""Pass 13: paths and islets.
Paths: Codex's path was five ribbons fused by a boolean (jagged outline, and one branch ran into the house). Each walk
is now a smooth slab with rounded ends, laid in the Grove's paving. The spine (dock to porch, and the walk up to the
great tree) belongs to the world; the other walks belong to the showcase layout, because the player lays those.
Islets: the five distant islands get the same cliff, lip and beach as the home island. They are the land that later
expansions bring in."""
import bpy, bmesh, json, importlib
import numpy as np
from kk import *
import ktone; importlib.reload(ktone)
import kterrain; importlib.reload(kterrain)
from kterrain import *

def spline(pts, per=10):
    ps = [Vector((x, y, 0)) for x, y in pts]; ex = [ps[0] * 2 - ps[1]] + ps + [ps[-1] * 2 - ps[-2]]; out = []
    for i in range(1, len(ex) - 2):
        a, b_, c, d = ex[i - 1:i + 3]
        for k in range(per):
            t = k / per; out.append(0.5 * ((2 * b_) + (-a + c) * t + (2 * a - 5 * b_ + 4 * c - d) * t * t + (-a + 3 * b_ - 3 * c + d) * t * t * t))
    out.append(ps[-1]); return out

def walk(b, pts, width, z0=Z - 0.03, z1=Z + 0.045, caps=(True, True), m="path_tex"):
    """One walk: a slab along a smooth centreline, with a half-round end where caps is True."""
    c = spline(pts); n = len(c); h = width / 2; outline = []
    def side(i, sg):
        t = c[min(i + 1, n - 1)] - c[max(i - 1, 0)]; t.normalize(); return c[i] + Vector((-t.y, t.x, 0)) * h * sg
    left = [side(i, 1) for i in range(n)]; right = [side(i, -1) for i in range(n)]
    def cap(i, flip):
        t = c[min(i + 1, n - 1)] - c[max(i - 1, 0)]; t.normalize(); a0 = atan2(t.y, t.x)
        return [c[i] + Vector((cos(a0 + sg), sin(a0 + sg), 0)) * h for sg in ([pi / 2 + pi * k / 8 for k in range(1, 8)] if flip else [-pi / 2 + pi * k / 8 for k in range(1, 8)])]
    outline = right + (cap(n - 1, False) if caps[1] else []) + left[::-1] + (cap(0, True) if caps[0] else [])
    t = bmesh.new(); top = [t.verts.new((p.x, p.y, z1)) for p in outline]; bot = [t.verts.new((p.x, p.y, z0)) for p in outline]
    i_ = b.mi(m); k = len(outline)
    t.faces.new(top).material_index = i_
    for i in range(k):
        j = (i + 1) % k; t.faces.new((bot[i], bot[j], top[j], top[i])).material_index = i_
    for f in t.faces: f.smooth = True
    me = gk._scr(); t.to_mesh(me); t.free(); b.bm.from_mesh(me)
from math import atan2
hp, hr = home_rho(); S = rho_at(hp, hr, 1.5 * pi); sx, sy = SITE; rx = HILL[0] + 0.8; ry = HILL[1] - HILL_R - 0.2 - (HILL_Z - Z) / 0.375      # ry: the foot of the terrace's ramp
# arrival: dock to the house plot's front. tree: branches off it and crosses the west lawn to the foot of the ramp.
# The branch starts on the arrival walk's centre line; the paving is drawn by place, so the overlap does not show.
SPINE = [("arrival", [(0, -(S + 0.25)), (0, -(S - 6.0)), (-0.8, -(S - 14.2)), (-2.0, -(S - 21.2)), (sx, sy - 8.7)], 2.6, (False, True)),      # stops a cell short of the biggest house plot
         ("tree", [(-1.4, -(S - 17.7)), (-8.0, -(S - 18.7)), (-14.5, -(S - 21.7)), (-0.62 * abs(rx) - 2.0, -(S - 21.7) + 0.36 * (ry + S - 21.7)), (-0.84 * abs(rx), -(S - 21.7) + 0.68 * (ry + S - 21.7)),
                   (rx + 2.0, ry - 7.0), (rx, ry - 3.0), (rx, ry + 0.2)], 2.2, (False, False))]      # a long walk through the wild land to the great tree
for name, sets, coll in (("K_Path_Spine", SPINE, "KINGDOM_PATHS"),):          # the showcase's own walks are tile paths now (k26)
    b = B()
    for _, pts, w, caps in sets: walk(b, pts, w, caps=caps)
    o = put(name, kit(name, b), coll)
    o["kk_paths"] = json.dumps([{"id": i, "points": p, "width": w} for i, p, w, _ in sets])     # the placement mask reads this later
supersede([o for o in bpy.context.scene.objects if o.name == "Arrival_to_house"])
# islets
BD = "KINGDOM_BACKDROP"; made = 0
for i in range(5):
    old = bpy.data.objects.get("Distant_Island_%d" % i)
    if old is None: continue
    lo, hi = wbb(old); cx, cy, rx, ry = (lo.x + hi.x) / 2 * FAR, (lo.y + hi.y) / 2 * FAR, (hi.x - lo.x) / 2 * 0.86, (hi.y - lo.y) / 2 * 0.86
    phi = np.linspace(0, tau, 96, endpoint=False)
    rho = rx * ry / np.sqrt((ry * np.cos(phi)) ** 2 + (rx * np.sin(phi)) ** 2) * (1 + 0.05 * np.sin(3 * phi + i) + 0.03 * np.sin(5 * phi - i))
    b = B(); tier(b, ring(phi, rho), 0.3, hi.z); shore = beach(b, phi, rho); foam(b, phi, shore)
    put("K_Islet_%d" % i, kit("K_Islet_%d" % i, b, 50), BD, (cx, cy, 0)); supersede([old]); made += 1
for o in C(BD).objects: o.visible_shadow = False
report(islets=made, tris={n: tris(bpy.data.objects[n].data) for n in ("K_Path_Spine", "K_Islet_0")})
