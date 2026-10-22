"""The camp and the first build, third look (20 Oct 2026): the same sizes and origins as kbuild's, with the details
real ones have.
  tent        an A-frame of canvas on a ridge pole and two uprights, the door flaps rolled up and tied at the sides,
              guy ropes from the pole ends down to pegs, seams along the canvas.
  campfire    a ring of rounded stones of different sizes, logs leaned together in a teepee with charred ends, a bed of
              glowing embers. The flame is its own mesh (KK_Campfire_Flame): tongues in three layers, red-orange
              outside, orange, yellow in the heart, so the game can make it flicker.
  cabin frame a timber frame as it is raised: sill plates on the footing, corner posts with studs between, diagonal
              braces at the corners, top plates, rafters to a ridge with collar ties, part of the floor boarded, a
              saw horse with a board on it, a stack of boards and a ladder.
  log stool   a round of log: bark round the side, rings on the seat."""
import bpy
from math import sin, cos, pi, tau, atan2, sqrt
from mathutils import Vector, Matrix
from kk import *
import kbuild, ktrees
from kbuild import CABIN, sprout

def tent(b):
    b.box((3.7, 3.7, 0.06), (0, 0, 0.03), "sand", r=0.02)
    b.box((3.0, 3.1, 0.02), (0, 0.1, 0.07), "sand_dk", r=0.01)                                              # groundsheet
    b.prism([(-1.65, 0.05), (1.65, 0.05), (0, 3.0)], 3.2, "cream", mtx=XZ(-1.6), r=0.04)
    b.prism([(-0.88, 0.06), (0.88, 0.06), (0, 2.2)], 0.05, "trunk", mtx=XZ(-1.64))                          # the way in
    for y in (-0.55, 0.55):                                                                               # seams down the canvas
        for sg in (-1, 1): b.tube([(sg * 0.02, y, 3.0), (sg * 1.66, y, 0.06)], 0.018, "cream_dk", seg=4)
    for sg in (-1, 1):
        b.tube([(sg * 0.92, -1.66, 0.08), (0, -1.66, 2.28)], 0.055, "red", seg=6)
        b.tube([(sg * 1.62, -1.62, 0.1), (sg * 1.62, 1.62, 0.1)], 0.06, "red", seg=6)                        # hem
        b.tube([(sg * 0.95, -1.72, 0.15), (sg * 0.55, -1.72, 1.5)], 0.11, "cream_dk", seg=8)                # a door flap rolled up
        b.tube([(sg * 0.78, -1.84, 0.95), (sg * 0.76, -1.84, 1.05)], 0.12, "rope", seg=6)                   # and tied
        for y in (-1.2, 1.2): b.cyl(0.05, 0.3, (sg * 1.95, y, 0), "wood", seg=6, rot=(0, -sg * 0.5, 0))
    for y, yy in ((-1.9, -3.05), (1.9, 3.05)):                                                             # uprights and guy ropes
        b.cyl(0.05, 3.0, (0, y * 0.97, 0.0), "wood", seg=8)
        b.tube([(0, y, 3.0), (0, (y + yy) / 2, 1.55), (0, yy, 0.12)], 0.016, "rope", seg=4)
        b.cyl(0.04, 0.26, (0, yy, -0.04), "wood_dk", seg=6, rot=(0.4 if yy < 0 else -0.4, 0, 0))
    b.tube([(0, -1.9, 3.0), (0, 1.9, 3.0)], 0.06, "wood", seg=6)
    for y in (-1.9, 1.9): b.ball(0.09, (0, y, 3.0), "gold", u=8, v=5)
    sprout(b, (0, -1.72, 3.02), 0.6)

def campfire(b):
    rocks = [(0.58, 0.17), (0.6, 0.14), (0.57, 0.19), (0.62, 0.13), (0.58, 0.18), (0.6, 0.15), (0.57, 0.17), (0.61, 0.14), (0.59, 0.16), (0.6, 0.13)]
    for i, (rr, s) in enumerate(rocks):
        a = tau * i / len(rocks); b.ball(s, (rr * cos(a), rr * sin(a), s * 0.5), ("stone", "grey", "stone_dk")[i % 3], sc=(1.1, 0.85, 0.7), u=10, v=6, rot=(0.1 * (i % 2), 0, a))
    b.lathe([(0.42, 0.0), (0.36, 0.035), (0.0, 0.05)], m="soil_wet", seg=14)                                  # ash
    for k in range(7):                                                                                     # embers
        a = tau * k / 7 + 0.4; r = 0.12 + 0.12 * (k % 2)
        b.ball(0.05, (r * cos(a), r * sin(a), 0.06), "glow" if k % 2 else "orange", sc=(1, 1, 0.6), u=6, v=4)
    for i in range(5):                                                                                     # the teepee of logs
        a = tau * i / 5 + 0.3; c, s = cos(a), sin(a)
        foot = Vector((0.42 * c, 0.42 * s, 0.05)); top = Vector((0.05 * c, 0.05 * s, 0.62))
        mid = foot + (top - foot) * 0.72
        b.tube([tuple(foot), tuple(mid)], 0.06, "trunk", seg=7)
        b.tube([tuple(mid), tuple(top)], [0.06, 0.04], "plum", seg=7)                                     # charred where it burns
        b.cyl(0.058, 0.012, tuple(foot - (top - foot).normalized() * 0.005), "trunk_light", seg=7, rot=(Vector((0, 0, 1)).rotation_difference(-(top - foot)).to_euler()))

def campfire_flame(b):
    """Tongues of flame, each yellow at its root, orange up its body and red at its tip, so from any side the fire shows
    all three. Origin at the campfire's origin: the game draws it on top and flickers it."""
    for i, (x, y, r, h, lean) in enumerate(((0.0, 0.0, 0.22, 0.95, 0.0), (0.16, 0.06, 0.15, 0.62, 0.25), (-0.15, 0.08, 0.15, 0.68, -0.25),
                                            (0.04, -0.16, 0.14, 0.58, 0.2), (-0.06, 0.17, 0.13, 0.55, -0.2))):
        prof = [(0, 0.06), (r * 0.95, 0.1), (r * 1.1, h * 0.3), (r * 0.85, h * 0.55), (r * 0.4, h * 0.8), (0, h)]
        b.lathe(prof, (x, y, 0.0), mats=["gold", "gold", "gold", "orange", "red"], seg=10, rot=(lean * (y > 0) * 0.6, lean, 0))
    b.ball(0.14, (0, 0, 0.16), "glow", sc=(1.3, 1.3, 0.8), u=8, v=6)

def cabin_frame(b):
    c = CABIN; hx, y0, y1, z0 = c["hx"], c["y0"], c["y1"], c["base"]; top = z0 + c["wall"]; cy = (y0 + y1) / 2; W = c["wall"]
    b.box((5.8, 5.2, z0), (0, cy, z0 / 2), "stone", r=0.06)
    for y in (y0 + 0.11, y1 - 0.11): b.box((2 * hx, 0.22, 0.12), (0, y, z0 + 0.06), "trunk")                      # sill plates
    for x in (-hx + 0.11, hx - 0.11): b.box((0.22, y1 - y0 - 0.46, 0.11), (x, cy, z0 + 0.055), "trunk")       # between the front and back sills
    for k in range(9): b.box((2 * hx - 0.3, 0.22, 0.05), (0, y0 + 0.4 + 0.25 * k, z0 + 0.16), "wood_lt" if k % 2 else "wood", r=0.01)     # floor boards, laid half way
    for x in (-hx + 0.11, 0, hx - 0.11):                                                                           # posts
        for y in (y0 + 0.11, cy, y1 - 0.11):
            if x == 0 and y == cy: continue
            b.box((0.19, 0.19, W - 0.06), (x, y, z0 + 0.06 + (W - 0.06) / 2), "wood")
    for y in (y0 + 0.11, y1 - 0.11):                                                                               # studs between the posts, front and back
        for x in (-hx * 0.55, hx * 0.55):
            if y == y0 + 0.11 and abs(x) < 1.0: continue
            b.box((0.12, 0.14, W - 0.12), (x, y, z0 + 0.06 + (W - 0.12) / 2), "wood_lt")
    for x in (-hx + 0.11, hx - 0.11):
        for y in ((y0 + cy) / 2, (cy + y1) / 2): b.box((0.14, 0.12, W - 0.12), (x, y, z0 + 0.06 + (W - 0.12) / 2), "wood_lt")
    br = sqrt(0.9 ** 2 + 0.9 ** 2); th = atan2(0.9, 0.9)                                                          # corner braces
    for sx in (-1, 1):
        for sy, y in ((-1, y0 + 0.11), (1, y1 - 0.11)):
            b.box((br, 0.1, 0.1), (sx * (hx - 0.11 - 0.45), y, top - 0.55), "trunk_light", rot=(0, -sx * th, 0))
    for y in (y0 + 0.11, y1 - 0.11): b.box((2 * hx - 0.04, 0.22, 0.2), (0, y, top), "trunk_light")                      # top plates
    for x in (-hx + 0.11, hx - 0.11): b.box((0.22, y1 - y0, 0.2), (x, cy, top), "trunk_light")
    th = atan2(c["rise"], hx); ln = sqrt(hx * hx + c["rise"] ** 2)
    for y in (y0 + 0.11, y0 + (y1 - y0) * 0.36, y0 + (y1 - y0) * 0.64, y1 - 0.11):                              # rafters and collar ties
        for sg in (-1, 1): b.box((ln, 0.14, 0.16), (sg * hx / 2, y, top + c["rise"] / 2), "wood", rot=(0, sg * th, 0))
        b.box((hx * 0.9, 0.1, 0.12), (0, y, top + c["rise"] * 0.55), "wood_lt")
    b.box((0.18, y1 - y0 + 0.4, 0.18), (0, cy, top + c["rise"]), "trunk_light")
    for i in range(5): b.box((1.9, 0.34, 0.09), (-1.3, -0.9 + 0.02 * (i % 2), z0 + 0.2 + 0.1 * i), "trunk_light" if i % 2 else "wood", rot=(0, 0, 0.1 * (i % 2)))
    for sx in (-1, 1):                                                                                              # saw horse
        for sy in (-1, 1): b.box((0.06, 0.06, 0.62), (1.5 + sx * 0.3, -1.0 + sy * 0.12, z0 + 0.3), "wood", rot=(sy * 0.25, 0, 0))
    b.box((0.75, 0.09, 0.09), (1.5, -1.0, z0 + 0.6), "wood_lt"); b.box((1.4, 0.26, 0.05), (1.5, -1.0, z0 + 0.67), "trunk_light", rot=(0, 0, 0.15))
    for sx in (-1, 1): b.box((0.06, 0.06, 2.6), (hx - 0.6 + sx * 0.2, y1 + 0.35, z0 + 1.25), "wood", rot=(-0.2, 0, 0))      # a ladder against the back
    for k in range(6): b.box((0.42, 0.05, 0.05), (hx - 0.6, y1 + 0.35 - 0.04 - k * 0.05, z0 + 0.25 + k * 0.38), "wood_lt")

def log_stool(b):
    m = ktrees.bark()
    b.lathe([(0.36, 0), (0.35, 0.36), (0.34, 0.4)], mats=[m, m], seg=14, cap=False)
    b.lathe([(0.34, 0), (0.25, 0), (0.15, 0), (0.05, 0), (0, 0)], (0, 0, 0.4), mats=["trunk_light", "sand", "trunk_light", "trunk"], seg=14, cap=False)
