"""Pass 4: vertical circulation. Two escalator pairs (ground to 2, 2 to 3) with full bodies, side panels,
handrails and piers; a switchback stair for all three levels; a glass lift tower with doors on every level.

Escalator rig. The body (truss, panels, handrails, landing plates) is one static object per pair. The moving part is a
chain of separate step objects in MARIO_ESCALATOR_RIG, named ESC_<pair>_<Up|Down>_Step_<nn>, all sharing the mesh
GK_Escalator_Step (origin at the middle of the tread, nose towards +X, the downhill side). Index 00 is where a step
enters its run: the bottom for the up lane, the top for the down lane, so every step always travels towards the next
index. The first and the last step of a chain rest hidden under the landing plates; the 19 between them are in view.
Steps are one tread apart in X and stay level; their height follows the path (flat at each landing, 40 degrees in
between), so the rest positions of a chain are an exact sampling of the path a rider follows. The game reads the chain
from the exported nodes and needs no extra data (src/grove/interiors/escalators.js). In Blender each step has two
drivers on frame, so pressing play shows the chain running (one tread every FPT frames). Frame 0 is the rest pose, and
it is also the frame the glTF exporter uses."""
import bpy, math
from gk import *

C = fresh("MARIO_CIRCULATION", "GROVE_VERTICAL_CIRCULATION_REFINEMENT")
gone = supersede(named("Refined_Escalator", "Refined_North_Stair", "Refined_Lift", coll="GROVE_VERTICAL_CIRCULATION_REFINEMENT"))
TH = radians(40); TREAD_LIFT = 0.012; RIG = []

def escalator(b, xt, zt, zb, yc, accent, up):
    zc = zb + 0.12; ft = 0.9
    x1 = xt + ft; x2 = x1 + (zt - zc) / math.tan(TH); x3 = x2 + ft; d = 1.0
    tn = (zt - zc) / (x2 - x1); xf = x2 - (d + 0.12) / tn
    body = [(xt, zt), (x1, zt), (x2, zc), (x3, zc), (x3, zb), (xf, zb), (x1, zt - d), (xt, zt - d)]
    b.prism(body, 1.8, "white", mtx=XZ(yc - 0.9))
    n = 18; run = (x2 - x1) / n; rise = (zt - zc) / n
    b.box2((xt, yc - 0.7, zt), (x1, yc + 0.7, zt + 0.03), "grey"); b.box2((x2 + run, yc - 0.7, zc), (x3, yc + 0.7, zc + 0.03), "grey")   # landing plates: the chain runs under them
    b.box2((x1 - 0.07, yc - 0.7, zt + 0.004), (x1, yc + 0.7, zt + 0.034), "yellow"); b.box2((x2 + run, yc - 0.7, zc + 0.004), (x2 + run + 0.07, yc + 0.7, zc + 0.034), "yellow")   # comb edges
    rest = []
    for k in range(-1, 20):                                    # 21 steps: one hidden under each landing plate, 19 in view
        x = x1 + (k + 0.5) * run; rest.append((x, zc + min(max((x2 + run / 2 - x) * tn, 0.0), zt - zc) + TREAD_LIFT))
    RIG.append({"up": up, "yc": yc, "rest": rest, "run": run, "lo": x1 - run, "loop": 21 * run, "xc": x2 + run / 2, "zc": zc, "h": zt - zc, "tn": tn})
    b.box2((x3, yc - 0.9, zb), (x3 + 0.3, yc + 0.9, zb + 0.12), "yellow", r=0.05)
    hh = 0.95; rr = hh / 2
    # Newel ends: a true half-round at each end of the balustrade, and the handrail follows the whole outline,
    # round both newels and down to the landing, the way a real handrail returns into the skirt.
    arcE = [(x3 + rr * cos(a), zc + rr + rr * sin(a)) for a in [radians(t) for t in range(-90, 91, 15)]]
    arcW = [(xt + rr * cos(a), zt + rr + rr * sin(a)) for a in [radians(t) for t in range(90, 271, 15)]]
    panel = [(xt, zt), (x1, zt), (x2, zc)] + arcE + [(x2, zc + hh), (x1, zt + hh)] + arcW[:-1]
    rail = arcW[::-1] + [(x1, zt + hh), (x2, zc + hh)] + arcE[::-1]
    ang = (pi - TH) if up else -TH
    chev = [(0.26, 0), (-0.04, 0.3), (-0.26, 0.3), (0.04, 0), (-0.26, -0.3), (-0.04, -0.3)]
    for sy in (-1, 1):
        yo = yc + sy * 0.8
        b.prism(panel, 0.16, accent, mtx=XZ(yo - 0.08))
        b.tube([(x, yo, z) for x, z in rail], 0.075, "plum", seg=8)
        for k in range(4):
            f = (k + 1) / 5; px = x2 + (x1 - x2) * f; pz = zc + (zt - zc) * f + hh * 0.5
            y0 = yo + 0.08 if sy > 0 else yo - 0.11
            b.prism(chev, 0.03, "white", mtx=XZ(y0) @ Matrix.Translation((px, pz, 0)) @ Matrix.Rotation(ang, 4, "Z"))
    return x1, x2, zc, tn

R = fresh("MARIO_ESCALATOR_RIG", "MARIO_CIRCULATION"); sc = bpy.context.scene
FPT = max(4, round(0.323 / (0.86 / (sc.render.fps / sc.render.fps_base))))      # frames for a step to travel one tread at about 0.86 m/s
def step_mesh(run):
    sb = B(); sb.box((run, 1.4, 0.30), (0, 0, -0.15), "slate"); sb.box((0.05, 1.4, 0.012), (run / 2 - 0.025, 0, 0.002), "yellow")
    for sy in (-1, 1): sb.box((run - 0.05, 0.03, 0.012), (-0.025, sy * 0.685, 0.002), "yellow")
    new = sb.data("GK_Escalator_Step__new", 50); old = bpy.data.meshes.get("GK_Escalator_Step")
    if old: old.user_remap(new); bpy.data.meshes.remove(old)
    new.name = "GK_Escalator_Step"; return new
def drive(o, idx, expr):
    fc = o.driver_add("location", idx); fc.driver.type = "SCRIPTED"; fc.driver.expression = expr; return fc.driver
STEP = None; simple = 0; steps = 0
# The two pairs criss-cross, as in a department store: ground to 2 climbs west, 2 to 3 climbs back east. Stepping off
# one never lines the rider up with the next, and the two landings on level 2 are about nine metres apart. The upper
# pair is built like the lower one and then turned half a turn about the middle of its floor opening (x = TURN).
TURN = (-25.1 - 16.0) / 2      # round 7: both pairs moved 3 m west so the ground escalators stand well clear of the fountain
for name, pair, xt, zt, zb, turn in (("Mall_Escalator_L1_L2", "L1L2", -15.0, 5.0, 0.0, None), ("Mall_Escalator_L2_L3", "L2L3", -25.1, 10.0, 5.0, TURN)):
    b = B(); n0 = len(RIG)
    x1, x2, zc, tn = escalator(b, xt, zt, zb, -1.15, "pink", True)
    escalator(b, xt, zt, zb, 1.15, "sky", False)
    xm = (x1 + x2) / 2; zu = zc + (x2 - xm) * tn - 1.0
    b.box2((xm - 0.45, -1.8, zb), (xm + 0.45, 1.8, zu - 0.3), "white", r=0.2)
    b.box2((xm - 0.7, -2.1, zu - 0.42), (xm + 0.7, 2.1, zu + 0.25), "gold", r=0.14)
    body = b.obj(name, C); body["esc_pair"] = pair; body["esc_rig"] = "steps: MARIO_ESCALATOR_RIG / ESC_%s_<Up|Down>_Step_<nn>" % pair
    if turn is not None:
        body.data.transform(Matrix.Translation((2 * turn, 0, 0)) @ Matrix.Rotation(pi, 4, "Z")); hard_normals(body.data, 50)
    for g in RIG[n0:]:
        STEP = STEP or step_mesh(g["run"]); d = "Up" if g["up"] else "Down"; sgn = -1.0 if g["up"] else 1.0; bstep = g["run"] / FPT
        order = g["rest"][::-1] if g["up"] else g["rest"]          # index 00 = where a step enters its run
        for i, (x, z) in enumerate(order):
            o = bpy.data.objects.new("ESC_%s_%s_Step_%02d" % (pair, d, i), STEP); R.objects.link(o); o.location = (x, g["yc"], z)
            o["esc_pair"] = pair; o["esc_dir"] = d.lower(); o["esc_index"] = i
            A = x - g["lo"]; X = "%.5f+((%.5f%+.6f*frame)-floor((%.5f%+.6f*frame)/%.5f)*%.5f)" % (g["lo"], A, sgn * bstep, A, sgn * bstep, g["loop"], g["loop"])
            dx = drive(o, 0, X); dz = drive(o, 2, "%.5f+min(max((%.5f-(%s))*%.5f,0),%.5f)" % (g["zc"] + TREAD_LIFT, g["xc"], X, g["tn"], g["h"]))
            if turn is not None:      # same chain, turned half a turn: x mirrors about TURN, the lane swaps side, height is unchanged
                o.location = (2 * turn - x, -g["yc"], z); o.rotation_euler = (0, 0, pi); dx.expression = "%.5f-(%s)" % (2 * turn, X)
            simple += int(dx.is_simple_expression) + int(dz.is_simple_expression); steps += 1
sc.frame_start = 1; sc.frame_end = FPT * 28; sc.frame_set(0)      # frame 0 is the rest pose, and the frame the glTF exporter reads

# ---- switchback stair in the north-west of the atrium, one mesh per storey
h, d = 2.5 / 14, 0.27; YS = -16.3; YL = YS - 13 * d; slope = h / d
RAIN = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"]
def flight(b, x0, z0, flip, k0):
    P = [(0, 0)]
    for i in range(14):
        P.append((i * d, (i + 1) * h))
        if i < 13: P.append(((i + 1) * d, (i + 1) * h))
    P += [(13 * d, slope * 13 * d - 0.45), (0, -0.45)]
    ys = YS if flip else YL; sg = -1 if flip else 1
    b.prism(P, 1.6, "white", mtx=YZ(x0, ys, z0, flip))
    for i in range(13):
        b.box((1.5, d + 0.02, 0.05), (x0 + 0.8, ys + sg * (i + 0.5) * d, z0 + (i + 1) * h + 0.02), RAIN[(i + k0) % 8], r=0.02, seg=1)
    pan = [(-0.05, 0.1), (13 * d, 2.6), (13 * d, 3.5), (-0.05, 1.0)]
    for xo in (x0 - 0.05, x0 + 1.55):
        # glass, like the balustrades: the game watches the stairs from the side, and a solid panel hid the climber up to the neck
        b.prism(pan, 0.05, "glass", mtx=YZ(xo + 0.025, ys, z0, flip))
        b.tube([(xo + 0.05, ys, z0 + 1.02), (xo + 0.05, ys + sg * 13 * d, z0 + 3.52)], 0.06, "teal", seg=8)

for k, z0 in enumerate((0.0, 5.0)):
    b = B()
    flight(b, -10.15, z0, True, 0)             # west lane, rising north
    flight(b, -8.45, z0 + 2.5, False, 5)       # east lane, rising south to the deck edge
    slab(b, -10.2, -21.7, -6.8, YL, z0 + 2.2, z0 + 2.5, "white", "teal")
    for xo in (-10.2, -6.9):
        b.box2((xo + 0.025, -21.7, z0 + 2.5), (xo + 0.075, YL, z0 + 3.5), "glass"); b.tube([(xo + 0.05, -21.7, z0 + 3.52), (xo + 0.05, YL, z0 + 3.52)], 0.06, "teal", seg=8)
    zb = 0.0 if k == 0 else 2.5
    for xo in (-10.02, -6.98): b.cyl(0.15, z0 + 2.2 - zb, (xo, YL - 0.2, zb), "gold", seg=10)
    b.obj(f"Mall_Stair_L{k+1}_L{k+2}", C)

# ---- lift: a static glass shaft with a doorway on every level, and a rig the game animates
# (src/grove/interiors/transit.js): LIFT_Car, and LIFT_L<level>_Door_A / _B. Rest pose: car on level 1, doors shut.
b = B(); LX = 25.0
b.lathe([(2.0, z) for z in (0.0, 2.9, 5.0, 7.9, 10.0, 12.9, 15.7)], (LX, 0, 0), "glass", seg=24, cap=False)
def west_gap(bm, n0, xmax, band=None, ymax=1.1):
    """Remove the faces added since n0 that face the doors (west), leaving a 2 m doorway."""
    bm.faces.ensure_lookup_table(); kill = []
    for f in bm.faces[n0:]:
        c = f.calc_center_median()
        if c.x < xmax and abs(c.y) < ymax and (band is None or (c.z % 5.0 < band and c.z < 13)): kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
west_gap(b.bm, 0, LX - 1.6, 2.9)
for z in (0.12, 4.8, 9.8, 14.9):
    # Open across the doors (round 8): closed, the ground-floor ring was an ankle-high bar the rider walked through.
    b.tube([(LX + 2.05 * cos(radians(t)), 2.05 * sin(radians(t)), z) for t in range(-144, 145, 12)], 0.14, "gold", seg=8)
for a in (pi / 4, 3 * pi / 4, 5 * pi / 4, 7 * pi / 4):
    b.tube([(LX + 2.03 * cos(a), 2.03 * sin(a), 0), (LX + 2.03 * cos(a), 2.03 * sin(a), 15.7)], 0.09, "white", seg=6)
b.lathe([(2.25, 15.6), (2.25, 15.9), (2.0, 16.6), (1.3, 17.3), (0.5, 17.7), (0, 17.8)], (LX, 0, 0), "red", seg=24)
b.ball(0.32, (LX, 0, 18.0), "gold", u=10, v=6)
LR = fresh("MARIO_LIFT_RIG", "MARIO_CIRCULATION")
for lv, z in ((1, 0.0), (2, 5.0), (3, 10.0)):
    for sy, tag in ((-1, "A"), (1, "B")):
        b.box((0.6, 0.22, 2.9), (23.1, sy * 1.2, z + 1.45), "gold", r=0.08)
        d = B(); d.box((0.08, 1.0, 2.7), (0, 0, 0), "teal", r=0.03, seg=1); d.box((0.03, 0.56, 0.9), (-0.035, 0, 0.45), "glass", r=0.01, seg=1)
        o = d.obj("LIFT_L%d_Door_%s" % (lv, tag), LR); o.location = (22.98, sy * 0.52, z + 1.35); o["lift_level"] = lv; o["lift_side"] = sy
    b.box((0.6, 2.62, 0.3), (23.1, 0, z + 2.92), "gold", r=0.08)
    b.box((0.14, 0.9, 0.62), (22.95, 0, z + 3.5), ["yellow", "blue", "pink"][lv - 1], r=0.1)
    b.text(str(lv), 0.42, (22.86, 0, z + 3.5), "white", face="-x", extrude=0.02, bevel=0.006)
    b.cyl(0.09, 0.72, (22.7, 1.8, z), "white", seg=8); b.ball(0.13, (22.7, 1.8, z + 0.77), "yellow", u=8, v=5)
lift = b.obj("Mall_Lift_Tower", C); lift.visible_shadow = False
# The car: a round platform with a waist-high wall, glass above and a domed roof, open towards the doors so the
# rider can be seen. Origin on the floor at the shaft centre; the game moves it in Z only.
c = B()
# Round 8: the floor of the car sits only 1 cm proud of the landing (no step to walk through at the door), and the
# waist-high wall is open across the whole front, so nothing of it shows in or beside the doorway.
c.lathe([(0, -0.22), (1.8, -0.22), (1.86, -0.12), (1.86, 0.01), (0, 0.01)], seg=24, mats=["gold", "gold", "gold", "cream"])
n0 = len(c.bm.faces)
c.lathe([(1.86, 0.01), (1.86, 0.92), (1.8, 0.98), (1.72, 0.98), (1.72, 0.01), (1.86, 0.01)], seg=24, cap=False, mats=["yellow", "white", "white", "yellow", "yellow"])
c.lathe([(1.8, 0.98), (1.8, 2.62)], seg=24, m="glass", cap=False)
west_gap(c.bm, n0, -0.95, ymax=1.75)
c.lathe([(1.9, 2.62), (1.9, 2.8), (1.5, 3.02), (0.6, 3.16), (0, 3.18)], seg=24, mats=["white", "yellow", "yellow", "yellow", "yellow"])
for sy in (-1, 1): c.box((0.12, 0.12, 2.6), (-1.56, sy * 1.07, 1.33), "gold", r=0.03, seg=1)
c.tube([(1.66 * cos(radians(t)), 1.66 * sin(radians(t)), 1.02) for t in range(-115, 116, 23)], 0.035, "gold", seg=6)
car = c.obj("LIFT_Car", LR); car.location = (LX, 0, 0); car["lift_rig"] = "moves in Z: 0, 5, 10"
# The shaft passes through the upper floors: cut it out of the slabs so the car has somewhere to go.
holes = 0
for name, z in (("Mall_Floor_L2", 4.8), ("Mall_Floor_L3", 9.8)):
    fl = bpy.data.objects.get(name)
    if fl is None: continue
    t = B(); t.cyl(1.98, 2.0, (LX, 0, z - 1.0), "white", seg=24); cut = t.obj("_lift_cut", C)
    md = fl.modifiers.new("lift_hole", "BOOLEAN"); md.operation = "DIFFERENCE"; md.object = cut; md.solver = "EXACT"
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(fl.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    fl.modifiers.remove(md); old = fl.data; fl.data = me; me.name = old.name + "_cut"
    if old.users == 0: bpy.data.meshes.remove(old)
    # The slab is several overlapping boxes and the boolean can hand one back inside out, which would make that
    # stretch of floor invisible from above in the game: put every face the right way round again.
    fb = bmesh.new(); fb.from_mesh(me); bmesh.ops.recalc_face_normals(fb, faces=fb.faces[:]); fb.to_mesh(me); fb.free()
    me.name = name; cm = cut.data; bpy.data.objects.remove(cut); bpy.data.meshes.remove(cm); hard_normals(me, 50); holes += 1
rep = {"superseded": gone, "objects": [o.name for o in C.objects]}
_esc = {"steps": steps, "simple_drivers": simple, "frames_per_tread": FPT, "chains": [{"dir": "up" if g["up"] else "down", "run": round(g["run"], 4), "first": [round(v, 3) for v in g["rest"][0]], "last": [round(v, 3) for v in g["rest"][-1]]} for g in RIG]}
rep = dict(rep) if isinstance(rep, dict) else {"report": rep}; rep["escalators"] = _esc; rep["lift"] = {"rig": [o.name for o in LR.objects], "floor_holes": holes}
bpy.app.driver_namespace["gk_report"] = rep
print("P04", rep)
