"""Pass 24: seating and tables at body scale.

The cast is chibi: about 2 m tall with legs only 0.4 m long. Furniture sized to those legs (seats at 0.22 m, tables at
0.5 m) reads as doll's-house stools beside a 2 m character. Games with the same proportions (Animal Crossing, Mii
games) size furniture to the body and let the feet hang, so that is the rule here:

    seat top 0.42 m    side table 0.62 m    dining table 0.78 m    standing bar 1.0 m with 0.64 m bar stools

This pass replaces the low Codex seats and tables in the shops with kit-style pieces at those heights, at the same
places, rebuilds the shared bench and umbrella-table kit meshes (atrium and park), and re-lays the Food Hall floor:
a clear path from the entry mat to the stalls, the communal table to one side, a wall bar with stools on the other
and a roped queue line between them. Names keep the words the game looks for (Bench, Stool, Chair, Armchair), so
every seat stays sittable after the next collision bake. Run p20_merch for the touched shops afterwards: cups and
trays are placed on the new table tops."""
import bpy, re
from gk import *

SEAT, SIDE, TABLE, BAR, BAR_SEAT = 0.42, 0.62, 0.78, 1.0, 0.64
rep = {"retired": 0, "built": [], "kit": []}

def shop(key): return bpy.data.collections[key + "_INTERIOR_REFINEMENT"]
def clear_mine(c):
    for o in [o for o in c.objects if o.get("seating_pass")]:
        me = o.data; bpy.data.objects.remove(o, do_unlink=True)
        if me.users == 0: bpy.data.meshes.remove(me)
def retire(c, pat):
    rx = re.compile(pat); gone = [o for o in c.objects if o.type == "MESH" and rx.search(o.name) and not o.get("seating_pass")]
    for o in gone: o.name = "Old_" + o.name          # free the name for its replacement
    rep["retired"] += supersede(gone)
def done(b, name, c):
    o = b.obj(name, c, 55); o["seating_pass"] = 1; rep["built"].append(name); return o

def stool(b, x, y, z0, cushion, h=SEAT, r=0.3, stem="white", ring=None):
    b.lathe([(r * .85, 0), (r * .85, .035), (.07, .08), (.07, h - .1), (r * .8, h - .075), (r, h - .065), (r, h - .02), (r - .03, h), (0, h)],
            (x, y, z0), seg=10, mats=[stem, stem, stem, stem, stem, cushion, cushion, cushion])
    if ring: b.tube([(x + r * .7 * cos(tau * i / 10), y + r * .7 * sin(tau * i / 10), z0 + h * .42) for i in range(10)], .018, ring, seg=4, closed=True)
def round_table(b, x, y, z0, R, h, top, stem="white"):
    b.lathe([(R * .55, 0), (R * .55, .04), (.08, .09), (.08, h - .09), (R * .3, h - .06), (R, h - .06), (R, h - .015), (R - .03, h), (0, h)],
            (x, y, z0), seg=14, mats=[stem, stem, stem, stem, top, top, top, top])
def plank_bench(b, x0, y0, x1, y1, z0, top, leg="white", h=SEAT):
    L = x1 - x0; b.box2((x0, y0, z0 + h - .1), (x1, y1, z0 + h), top, r=.04, seg=1)
    for f in (.16, .84):
        xc = x0 + L * f; b.box2((xc - .08, y0 + .05, z0), (xc + .08, y1 - .05, z0 + h - .09), leg)
def long_table(b, x0, y0, x1, y1, z0, top, leg="white", h=TABLE):
    L = x1 - x0; b.box2((x0, y0, z0 + h - .08), (x1, y1, z0 + h), top, r=.03, seg=1)
    for f in (.14, .86):
        xc = x0 + L * f; b.box2((xc - .09, y0 + .12, z0), (xc + .09, y1 - .12, z0 + h - .07), leg)
    b.box2((x0 + L * .14, (y0 + y1) / 2 - .05, z0 + .2), (x0 + L * .86, (y0 + y1) / 2 + .05, z0 + .3), leg)
def armchair(b, cx, cy, z0, w, d, back, col, pad):
    """Upholstered chair. back = +1 puts the backrest on the +Y side (the sitter faces -Y)."""
    x0, x1 = cx - w / 2, cx + w / 2; yb = cy + back * d / 2; yf = cy - back * d / 2; lo = lambda a, c: (min(a, c), max(a, c))
    for sx in (x0 + .14, x1 - .14):
        for sy in (yb - back * .14, yf + back * .14): b.cyl(.06, .11, (sx, sy, z0), "wood", seg=8)
    ya, yc_ = lo(yb, yf); b.box2((x0, ya, z0 + .1), (x1, yc_, z0 + .33), col, r=.07, seg=1)
    ya, yc_ = lo(yb - back * .22, yf); b.box2((x0 + .17, ya, z0 + .3), (x1 - .17, yc_ - (0 if back > 0 else 0), z0 + SEAT), pad, r=.05, seg=1)
    for sx in (x0, x1 - .16):
        ya, yc_ = lo(yb, yf + back * .06); b.box2((sx, ya, z0 + .1), (sx + .16, yc_, z0 + .68), col, r=.07, seg=1)
    ya, yc_ = lo(yb, yb - back * .22); b.box2((x0, ya, z0 + .1), (x1, yc_, z0 + 1.06), col, r=.08, seg=1)
    ya, yc_ = lo(yb - back * .2, yb - back * .3); b.box2((x0 + .2, ya, z0 + .5), (x1 - .2, yc_, z0 + .95), pad, r=.04, seg=1)
def back_bench(b, x0, y0, x1, y1, z0, back, top, leg="white", slat="wood"):
    plank_bench(b, x0, y0, x1, y1, z0, top, leg); yb = y1 if back > 0 else y0
    for f in (.1, .9):
        xc = x0 + (x1 - x0) * f; b.box2((xc - .05, yb - .06, z0 + SEAT - .02), (xc + .05, yb + .06, z0 + 1.0), leg, r=.02, seg=1)
    b.box2((x0, yb - .05, z0 + .62), (x1, yb + .05, z0 + 1.04), slat, r=.04, seg=1)
def post(b, x, y, z0):
    b.lathe([(.2, 0), (.2, .03), (.05, .07), (.05, .9), (.085, .93), (.085, .98), (.05, 1.02), (0, 1.03)], (x, y, z0), seg=8,
            mats=["gold", "gold", "white", "gold", "gold", "gold", "gold"])
def rope(b, p0, p1, z):
    pts = [(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, z - .18 * (1 - (2 * t - 1) ** 2)) for t in (0, .25, .5, .75, 1)]
    b.tube(pts, .024, "red", seg=5)

# ---- Cafe Canopy: two round tables, three stools each
c = shop("CAFE_CANOPY"); clear_mine(c); retire(c, r"Cafe_(Stool|Table_(Base|Stem|Top))"); z0 = 0.03
for k, (tx, ty) in enumerate(((-16.65, 12.85), (-20.95, 13.25))):
    b = B(); round_table(b, tx, ty, z0, .7, TABLE, "wood"); done(b, "Cafe_Table_Top_%d" % k, c)
    for j, (dx, dy) in enumerate(((.98, 0), (-.98, 0), (0, -.98))):
        b = B(); stool(b, tx + dx, ty + dy, z0, "red", ring="gold"); done(b, "Cafe_Stool_%d_%d" % (k, j), c)

# ---- Food Hall: entry path kept clear, table to the east, wall bar to the west, queue line between
c = shop("FOOD_HALL"); clear_mine(c); retire(c, r"Food_(Communal_(Bench|Table)|Queue|Standing)"); z0 = 10.03
b = B(); long_table(b, -18.55, 12.0, -15.25, 13.0, z0, "wood"); done(b, "Food_Communal_Table", c)
for k, (y0, y1) in enumerate(((13.24, 13.66), (11.34, 11.76))):
    b = B(); plank_bench(b, -18.4, y0, -15.4, y1, z0, "teal"); done(b, "Food_Communal_Bench_%d" % k, c)
b = B(); b.box2((-25.62, 11.3, z0 + BAR - .08), (-25.05, 13.9, z0 + BAR), "sky", r=.03, seg=2)
for y in (11.6, 13.6): b.box2((-25.5, y - .08, z0), (-25.2, y + .08, z0 + BAR - .07), "yellow", r=.03, seg=1)
b.tube([(-25.02, 11.6, z0 + .26), (-25.02, 13.6, z0 + .26)], .025, "gold", seg=5)
for y in (11.6, 13.6): b.box2((-25.3, y - .03, z0 + .23), (-25.02, y + .03, z0 + .29), "gold")
done(b, "Food_Standing_Rail", c)
for k, y in enumerate((11.8, 12.6, 13.4)):
    b = B(); stool(b, -24.55, y, z0, "orange", h=BAR_SEAT, r=.27, ring="gold"); done(b, "Food_Standing_Stool_%d" % k, c)
Q = [(-22.0, 11.7), (-22.0, 12.7), (-22.0, 13.7)]
for k, (x, y) in enumerate(Q):
    b = B(); post(b, x, y, z0); done(b, "Food_Queue_Post_%d" % k, c)
b = B()
for k in range(2): rope(b, Q[k], Q[k + 1], z0 + .93)
done(b, "Food_Queue_Rope", c)

# ---- Grove Grocer: its three queue posts had no rope, so they read as stray poles
c = shop("GROVE_GROCER"); clear_mine(c)
qp = sorted((o for o in c.objects if re.match(r"Refined_Queue_Post", o.name)), key=lambda o: wbb(o)[0].y)
if len(qp) >= 2:
    b = B()
    for o0, o1 in zip(qp, qp[1:]):
        (a0, a1), (c0, c1) = wbb(o0), wbb(o1); rope(b, ((a0.x + a1.x) / 2, (a0.y + a1.y) / 2), ((c0.x + c1.x) / 2, (c0.y + c1.y) / 2), a1.z - .06)
    for o in qp:
        lo, hi = wbb(o); b.ball(.075, ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z + .03), "gold", u=8, v=5)
    done(b, "Grocer_Queue_Rope", c)

# ---- Maker Meadow
c = shop("MAKER_MEADOW"); clear_mine(c); retire(c, r"Maker_Stool")
for k, (x, y) in enumerate(((-16.85, 13.0), (-23.15, 13.0))):
    b = B(); stool(b, x, y, 5.03, "gold", ring="white", stem="slate"); done(b, "Maker_Stool_%d" % k, c)

# ---- Book Burrow: reading chairs with a side table each
c = shop("BOOK_BURROW"); clear_mine(c); retire(c, r"Reading_(Chair|Table)")
for k, (cx, tx, z0) in enumerate(((-23.35, -22.3, 10.02), (-16.65, -17.7, 10.05))):
    b = B(); armchair(b, cx, -13.65, z0, 1.3, 1.02, -1, "teal", "cream"); done(b, "Reading_Chair_%d" % k, c)
    b = B(); round_table(b, tx, -13.55, z0, .38, SIDE, "wood"); done(b, "Reading_Table_Top_%d" % k, c)

# ---- Home Nook: armchair, side table, and the lamp that stands on it
c = shop("HOME_NOOK"); clear_mine(c); retire(c, r"Armchair|Side_Table"); z0 = 0.02
b = B(); armchair(b, 23.45, 13.45, z0, 1.2, 1.0, 1, "terracotta", "cream"); done(b, "Armchair", c)
lamp = [o for o in c.objects if o.name.startswith("Table_Lamp")]
if lamp:
    low = min(wbb(o)[0].z for o in lamp); dz = (z0 + SIDE) - low
    for o in lamp: o.location.z += dz
b = B(); round_table(b, 21.85, 13.3, z0, .48, SIDE, "wood"); done(b, "Side_Table_Top", c)

# ---- Sole Search: fitting bench
c = shop("SOLE_SEARCH"); clear_mine(c); retire(c, r"Sole_(Fitting_Bench|Bench_Cushion)")
b = B(); plank_bench(b, -24.5, -15.1, -21.9, -14.2, 5.02, "blue"); done(b, "Sole_Fitting_Bench", c)

# ---- Rooftop Garden: bench with a back
c = shop("ROOFTOP_GARDEN"); clear_mine(c); retire(c, r"RoofGarden_Bench")
b = B(); back_bench(b, 21.6, 12.23, 24.7, 12.87, 10.03, 1, "leaf_light"); done(b, "RoofGarden_Bench", c)

# ---- shared kit: bench (atrium, park) and umbrella table (park). The source is p05a_kit.py.
def kit(name, b, sharp=50):
    new = b.data(name + "__new", sharp); old = bpy.data.meshes.get(name)
    if old: old.user_remap(new); bpy.data.meshes.remove(old)
    new.name = name; rep["kit"].append(name); return new
src = open(os.path.join(HERE, "p05a_kit.py")).read()
for part in src.split("# >>> seating kit")[1:]:
    exec(part.split("# <<< seating kit")[0].split("\n", 1)[1], globals())

bpy.context.view_layer.update()
rep["tris"] = sum(len(p.vertices) - 2 for n in rep["built"] for p in bpy.data.objects[n].data.polygons)
bpy.app.driver_namespace["gk_report"] = rep
print("P24", rep)
