"""Pass 25: finish the world (Phase 11). Run after k10_terrain and k13_paths_islets.
  1. Steps from the lawn down to the beach at four places (K_Beach_Steps_S, _E, _W, _N), in KINGDOM_WORLD.
  2. Layered hills on the five far islets (K_Islet_Hill_n) in place of Codex's green domes, which are retired.
  3. The land the island can grow into, built now and kept unticked in KINGDOM_EXPANSION: an east isle with a
     terrace and a west isle, each joined to the home island by a footbridge.
Args: show_expansion (bool, default False)."""
import bpy, importlib, json
import numpy as np
from kk import *
import ktone; importlib.reload(ktone)
import kterrain; importlib.reload(kterrain)
import kworld; importlib.reload(kworld)
from kterrain import home_rho, rho_at, ring, tier, beach, foam, beach_width, beach_height
from math import atan2, hypot
from ktone import TB
W = C("KINGDOM_WORLD"); BD = C("KINGDOM_BACKDROP"); phi, rho = home_rho(); out = {}

# ---- 1. steps
b = TB(); info = kworld.beach_steps(b); me = kit("KK_Beach_Steps", b); STEPS = {"S": 285, "E": 350, "W": 226, "N": 62}; rows = {}
for tag, deg in STEPS.items():
    a = radians(deg); r = rho_at(phi, rho, a); o = put("K_Beach_Steps_" + tag, me, W, (r * cos(a), r * sin(a), Z), a - pi / 2)
    foot = info["foot"][1]; sand = beach_height(foot, float(np.interp(a % tau, phi, beach_width(phi), period=tau)))
    o["kk_steps"] = json.dumps({"angle": deg, "top": [round(r * cos(a), 2), round(r * sin(a), 2)], "foot": [round((r + foot) * cos(a), 2), round((r + foot) * sin(a), 2)], "width": info["width"]})
    rows[tag] = {"edge": round(r, 2), "last_tread": round(Z + info["foot"][2], 2), "sand_at_foot": round(sand, 2)}
out["steps"] = rows

# ---- 2. hills on the islets
hills = 0
for i in range(5):
    isl = bpy.data.objects.get("K_Islet_%d" % i); old = bpy.data.objects.get("Distant_Hill_%d" % i)
    if isl is None or old is None: continue
    top = max(v.co.z for v in isl.data.vertices); R = 4.4 + 0.5 * (i % 3)
    hx, hy = isl.location.x + old.location.x - isl.location.x / kterrain.FAR, isl.location.y + old.location.y - isl.location.y / kterrain.FAR      # where the dome stood on its islet
    b = B(); kworld.layered_hill(b, R, top, levels=((1.0, 2.0 + 0.3 * (i % 2)), (0.55, 1.7)) if i % 2 == 0 else ((1.0, 1.8), (0.62, 1.6), (0.3, 1.3)), seed=i)
    o = put("K_Islet_Hill_%d" % i, kit("K_Islet_Hill_%d" % i, b, 50), BD, (hx, hy, 0)); o.visible_shadow = False; supersede([old]); hills += 1
    for t in BD.objects:                                   # a far tree goes out with its islet, and steps out of the hill if it now stands inside it
        if t.name.startswith("K_Distant_Tree"):
            if "kk_home" not in t: t["kk_home"] = [t.location.x, t.location.y]
            h_ = t["kk_home"]; ox, oy = isl.location.x / kterrain.FAR, isl.location.y / kterrain.FAR
            if hypot(h_[0] - ox, h_[1] - oy) > 16.0: continue                    # another islet's tree
            t.location.x, t.location.y = h_[0] + isl.location.x - ox, h_[1] + isl.location.y - oy
            d = hypot(t.location.x - hx, t.location.y - hy)
            if d < R + 0.9: k = (R + 1.2) / max(d, 0.1); t.location.x, t.location.y = hx + (t.location.x - hx) * k, hy + (t.location.y - hy) * k
out["hills"] = hills

# ---- 3. the land the island can grow into
EX = ccol("KINGDOM_EXPANSION"); HOME_SHORE = kterrain._smooth(rho, 6) + beach_width(phi) * kterrain.SHORE
for o in list(EX.all_objects): bpy.data.objects.remove(o, do_unlink=True)
def isle(tag, centre, rx, ry, k):
    ph = np.linspace(0, tau, 128, endpoint=False)
    rh = rx * ry / np.sqrt((ry * np.cos(ph)) ** 2 + (rx * np.sin(ph)) ** 2) * (1 + 0.045 * np.sin(3 * ph + k) + 0.03 * np.sin(5 * ph - k))
    b = B(); tier(b, ring(ph, rh), 0.3, Z); shore = beach(b, ph, rh)
    fx, fy = centre[0] + (shore + 1.0) * np.cos(ph), centre[1] + (shore + 1.0) * np.sin(ph)      # no wave lines where this shore runs into the home shore
    keep = np.hypot(fx, fy) > np.interp(np.arctan2(fy, fx) % tau, phi, HOME_SHORE, period=tau) + 2.4
    foam(b, ph, shore, keep=list(keep))
    o = put("K_Exp_%s_Isle" % tag, kit("K_Exp_%s_Isle" % tag, b, 50), EX, (centre[0], centre[1], 0)); o["kk_outline"] = json.dumps({"centre": list(centre), "rx": rx, "ry": ry, "area": round(float(pi * rx * ry), 1)})
    return ph, rh
def join(tag, centre, ph, rh, home_deg):
    a = radians(home_deg); r = rho_at(phi, rho, a) - 0.3; A = Vector((r * cos(a), r * sin(a), Z))
    back = atan2(A.y - centre[1], A.x - centre[0]); r2 = float(np.interp(back % tau, ph, rh, period=tau)) - 0.3; Bp = Vector((centre[0] + r2 * cos(back), centre[1] + r2 * sin(back), Z))
    L = (Bp - A).length; b = TB(); info = kworld.bridge(b, L); o = put("K_Exp_%s_Bridge" % tag, kit("K_Exp_%s_Bridge" % tag, b, 50), EX, A, atan2(Bp.y - A.y, Bp.x - A.x))
    o["kk_bridge"] = json.dumps({"from": [round(A.x, 2), round(A.y, 2)], "to": [round(Bp.x, 2), round(Bp.y, 2)], "length": round(L, 2), "width": info["width"], "walk": info["walk"]}); return round(L, 2)
def out_from(deg, far):                                # a point `far` beyond the home lawn's edge, in a direction from the island's centre
    a = radians(deg); r = rho_at(phi, rho, a) + far; return (round(r * cos(a), 1), round(r * sin(a), 1))
E = out_from(3.2, 16.1); ph, rh = isle("East", E, 10.0, 8.5, 0.7); out["east_bridge"] = join("East", E, ph, rh, 4)
b = B(); ramp = kworld.terrace(b, (E[0] + 2.2, E[1] + 3.2), 3.2, 3.8); o = put("K_Exp_East_Terrace", kit("K_Exp_East_Terrace", b, 50), EX); o["kk_ramp"] = [round(v, 2) for v in ramp]
Wc = out_from(192.2, 13.9); ph, rh = isle("West", Wc, 7.0, 6.5, 2.1); out["west_bridge"] = join("West", Wc, ph, rh, 203)
for o in EX.objects: o.visible_shadow = o.name.endswith(("Bridge", "Terrace"))
show_collection("KINGDOM_EXPANSION", bool((NS.get("kk_args") or {}).get("show_expansion", False)))
bpy.context.view_layer.update()
out["tris"] = {o.name: tris(o.data) for o in list(EX.objects) + [bpy.data.objects["K_Beach_Steps_S"], bpy.data.objects["K_Islet_Hill_0"], bpy.data.objects["K_Home_Beach"]]}
report(**out)
