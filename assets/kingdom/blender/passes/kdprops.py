"""Decor pieces that move (22 Oct 2026), rigged like the camp pieces (kprops.py) so the game plays them. Each takes
the place of its decor kit mesh (KD_*), in the same frame: origin on the ground in the middle of its cells, front to
-Y, the same paint materials (so the player's colours still apply).

Water itself is not rigged here: the fountain, the round pond and the pond tiles carry the Grove's moving water
(kwater.py), whose textures slide along the surface. What is rigged here moves as a body:
  - Pond plants bob: lily pads ride the water, reeds sway from the root with the tip moving most and last.
  - Things on ropes swing: the swing seat on its bar, the hammock between its posts, the bulbs on a garland, the
    lanterns on the double lamp.
Loops are short (2 to 4 s) and every motion is a whole number of cycles in its loop, so nothing jumps."""
import bpy, bmesh
from math import sin, cos, pi, tau
from mathutils import Vector
from kk import *
import kanimals, kprops, kdecor
from kanimals import Rig, smooth
prop = kprops.prop
STANDS = {}
def stands(kd):
    def deco(fn): STANDS[fn.__name__.capitalize()] = kd; return prop(fn)
    return deco

# ---------------------------------------------------------------- the lilies
def _pads(r, at, parent="root"):
    for k, (x, y, rr, rz, m) in enumerate(at):
        pb = r.bone("pad%d" % k, (x, y, kdecor.WATER), (x, y, kdecor.WATER + 0.05), parent)
        kdecor._pad(pb, x, y, rr, rz, m)
        if k == len(at) - 1: kdecor._lily(pb, x, y, kdecor.WATER + 0.016, 1.25, kdecor.P("pink"))
def _bob(v, n, u, amp=0.008, turn=0.12):
    for k in range(n):
        v["pad%d" % k] = {"z": amp * sin(tau * u + k * 2.1), "y": turn * sin(tau * u + k * 1.3), "p": 0.04 * sin(tau * u + k)}

@stands("KD_Pond_Lily")
def lily():
    r = Rig("Lily"); weights = {}
    r.bone("root", (0, 0, 0), (0, 0, 0.1))
    _pads(r, [(-0.18, 0.1, 0.2, 0.4, "leaf_light"), (0.2, 0.22, 0.14, 2.9, "green"), (0.14, -0.2, 0.17, 4.4, "leaf_light")])
    @r.clip("Bob", 3.0)
    def bob(t):
        v = {}; _bob(v, 3, t / 3.0); return v
    return r, weights, "Bob"

# ---------------------------------------------------------------- reeds
@stands("KD_Pond_Reeds")
def reeds():
    """The bulrushes, each on two bones from its root, so it bends and its head nods last."""
    r = Rig("Reeds"); weights = {}
    b = r.bone("root", (0, 0, 0), (0, 0, 0.1))
    STALKS = ((-0.12, 0.05, 1.25, -0.08), (0.08, 0.12, 1.05, 0.1), (0.14, -0.1, 0.85, 0.16), (-0.05, -0.14, 0.95, -0.12), (0.0, 0.0, 1.4, 0.02))
    for i, (x, y, h, lean) in enumerate(STALKS):
        lo = r.bone("st%da" % i, (x, y, 0), (x + lean * 0.5, y, h * 0.55), "root"); r.bone("st%db" % i, (x + lean * 0.5, y, h * 0.55), (x + lean, y, h), "st%da" % i)
        lo.tube([(x, y, 0), (x + lean * 0.5, y, h * 0.6), (x + lean, y, h)], 0.016, "leaf_dark", seg=5)
        lo.cyl(0.042, 0.2, (x + lean * 0.86, y, h - 0.28), "trunk", seg=7, bev=0.015, rot=(0, lean * 0.4, 0))
        def rule(q, i=i, h=h):
            u = smooth(max(0.0, min(1.0, (q.z - h * 0.35) / (h * 0.4)))); return {"st%da" % i: 1 - u, "st%db" % i: u}
        weights["st%da" % i] = rule
    for i in range(7):
        t = tau * i / 7 + 0.3; h = 0.6 + 0.12 * (i % 3)
        lb = r.bone("lf%d" % i, (0.08 * cos(t), 0.08 * sin(t), 0.0), (0.2 * cos(t), 0.2 * sin(t), h * 0.6), "root")
        lb.tube([(0.08 * cos(t), 0.08 * sin(t), 0.012), (0.2 * cos(t), 0.2 * sin(t), h * 0.6), (0.36 * cos(t), 0.36 * sin(t), h)], [0.03, 0.024, 0.006], ("green", "leaf_light")[i % 2], seg=4)
        weights["lf%d" % i] = (lambda q, i=i, h=h: {"root": 1 - smooth(min(1.0, q.z / (h * 0.7))), "lf%d" % i: smooth(min(1.0, q.z / (h * 0.7)))})
    S = 4.0
    @r.clip("Sway", S)
    def sway(t):
        u = t / S; v = {}
        for i in range(5):
            a = tau * u + i * 1.1
            v["st%da" % i] = {"r": 0.045 * sin(a), "p": 0.02 * sin(a + 0.7)}
            v["st%db" % i] = {"r": 0.08 * sin(a - 0.8), "p": 0.03 * sin(a - 0.2)}
        for i in range(7): v["lf%d" % i] = {"r": 0.05 * sin(tau * u * 2 + i), "p": 0.03 * sin(tau * u * 2 + i * 0.6)}
        return v
    return r, weights, "Sway"

# ---------------------------------------------------------------- things that swing
def _from_decor(r, name):
    b = r.bone("root", (0, 0, 0), (0, 0, 0.2)); b.__class__ = kdecor.SmoothTB                 # built exactly as the kit piece it stands for
    fn = [f for n, f, g, c in kdecor.KIT if n == name][0]; fn(b); return b

@stands("KD_Seat_Swing")
def swing():
    r = Rig("Swing"); weights = {}; _from_decor(r, "Seat_Swing")
    r.bone("seat", (0, 0, 2.25), (0, 0, 2.0), "root")
    weights["root"] = lambda q: {"seat": 1.0} if abs(q.x) < 1.05 and q.z < 2.17 else {"root": 1.0}
    @r.clip("Swing", 3.0)
    def go(t): return {"seat": {"p": 0.16 * sin(tau * t / 3.0)}}
    return r, weights, "Swing"

@stands("KD_Seat_Hammock")
def hammock():
    r = Rig("Hammock"); weights = {}; _from_decor(r, "Seat_Hammock")
    r.bone("bed", (-1.2, 0, 1.15), (1.2, 0, 1.15), "root")
    def rule(q):
        ax = abs(q.x)
        if q.z > 1.28 or (abs(q.y) < 0.11 and abs(ax - (1.25 + 0.085 * q.z)) < 0.11): return {"root": 1.0}     # the posts and their knobs
        u = smooth(max(0.0, min(1.0, (1.33 - ax) / 0.28)))                                                   # the ropes ease from post to bed
        return {"root": 1 - u, "bed": u}
    weights["root"] = rule
    @r.clip("Sway", 4.0)
    def go(t): return {"bed": {"p": 0.09 * sin(tau * t / 4.0)}}
    return r, weights, "Sway"

@stands("KD_Lamp_Garland")
def garland():
    r = Rig("Garland"); weights = {}; _from_decor(r, "Lamp_Garland")
    n = 9; pts = [(-1.8 + 3.6 * i / (n - 1), 0, 2.6 - 0.5 * sin(pi * i / (n - 1))) for i in range(n)]
    for i in range(1, n - 1):
        x, _, z = pts[i]; r.bone("bulb%d" % i, (x, 0, z - 0.02), (x, 0, z - 0.25), "root")
    def rule(q):
        for i in range(1, n - 1):
            x, _, z = pts[i]
            if abs(q.x - x) < 0.12 and z - 0.27 < q.z < z - 0.035: return {"bulb%d" % i: 1.0}
        return {"root": 1.0}
    weights["root"] = rule
    @r.clip("Breeze", 3.0)
    def go(t):
        return {"bulb%d" % i: {"p": 0.22 * sin(tau * t / 3.0 - i * 0.5), "r": 0.08 * sin(tau * 2 * t / 3.0 + i)} for i in range(1, n - 1)}
    return r, weights, "Breeze"

@stands("KD_Lamp_Double")
def lampdouble():
    """The two lanterns on the double lamp swing a little from their hooks, out of step."""
    r = Rig("Lampdouble"); weights = {}; _from_decor(r, "Lamp_Double")
    for k, sx in enumerate((-1, 1)): r.bone("lantern%d" % k, (sx * 0.6, 0, 2.72), (sx * 0.6, 0, 2.3), "root")
    def rule(q):
        for k, sx in enumerate((-1, 1)):
            if abs(q.x - sx * 0.6) < 0.22 and 2.15 < q.z < 2.715: return {"lantern%d" % k: 1.0}
        return {"root": 1.0}
    weights["root"] = rule
    @r.clip("Breeze", 3.0)
    def go(t): return {"lantern0": {"p": 0.1 * sin(tau * t / 3.0), "r": 0.05 * sin(tau * 2 * t / 3.0)}, "lantern1": {"p": 0.1 * sin(tau * t / 3.0 + 1.9), "r": 0.05 * sin(tau * 2 * t / 3.0 + 1)}}
    return r, weights, "Breeze"
