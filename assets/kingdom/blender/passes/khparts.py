"""House kit parts that go on a body's sockets. Each is drawn in its own frame with the wall (or the roof) at the
origin, the outside towards -Y, so the same part fits any wall once it is turned.
  doors      origin on the floor line in the middle of the doorway (the body's door socket)
  windows    origin at the middle of the window, on the wall
  porches    origin on the ground under the door
  chimneys   origin on the roof; the stack runs 1.6 m down so it meets any slope
The frame of a door is 1.9 m wide and 2.6 m tall (the double door 2.6 m wide); a window is 1.35 m across."""
import bpy, bmesh
from kk import *
from ktone import TB, tn, derive
import kbuild, gk
from khouse import BASE

def arch_pts(w, h, n=12):
    """A doorway outline with a round top, standing on y = 0."""
    r = w / 2; hs = h - r
    return [(-r, 0), (r, 0)] + [(r * cos(pi * i / n), hs + r * sin(pi * i / n)) for i in range(n + 1)]

def heart_pts(R, n=22):
    out = []
    for i in range(n):
        t = tau * i / n; out.append((R * 16 * sin(t) ** 3 / 17, R * (13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t)) / 17 + R * 0.12))
    return out[::-1]

def _knob(b, x, z, y=-0.2): 
    b.cyl(0.07, 0.03, (x, y + 0.02, z), "gold", seg=10, rot=(pi / 2, 0, 0)); b.ball(0.085, (x, y - 0.07, z), "gold", u=10, v=7)
def _threshold(b, w): b.box((w + 0.3, 0.52, 0.1), (0, -0.2, 0.0), "wallC_lt", r=0.04)
def _frame(b, w=1.9, h=2.6): b.box((w, 0.2, h), (0, -0.03, h / 2), tn("trimA", 0.12, 0.9), r=0.07, seg=3)
def _pane(b, w, h, x, z, y=-0.19, bars=True):
    b.box((w, 0.05, h), (x, y, z), "glass", r=0.012)
    if bars: b.box((0.06, 0.05, h - 0.012), (x, y - 0.012, z), "trimA_lt"); b.box((w - 0.012, 0.05, 0.06), (x, y - 0.012, z), "trimA_lt")

# ---------------------------------------------------------------- doors
def door_plank(b):
    """Three fat planks on two ledges and a brace, a round gold knob."""
    _frame(b); _threshold(b, 1.9)
    b.box((1.4, 0.12, 2.3), (0, -0.1, 1.17), "doorA_dk", r=0.04)
    for x in (-0.47, 0.0, 0.47): b.box((0.44, 0.07, 2.24), (x, -0.16, 1.17), tn("doorA", 0.16, 0.88), r=0.03)
    for z in (0.5, 1.85): b.box((1.36, 0.05, 0.2), (0, -0.21, z), "doorA_dk", r=0.02)
    b.box((1.5, 0.05, 0.17), (0, -0.21, 1.175), "doorA_dk", r=0.02, rot=(0, -0.74, 0))
    _knob(b, 0.5, 1.12, -0.22)

def door_arch(b):
    """A round-topped door with a heart window and two gold strap hinges."""
    b.prism(arch_pts(1.9, 2.6), 0.2, tn("trimA", 0.12, 0.9), mtx=XZ(-0.13), r=0.05); _threshold(b, 1.9)
    b.prism(arch_pts(1.42, 2.34), 0.14, tn("doorA", 0.16, 0.88), mtx=XZ(-0.19, 0, 0.02), r=0.04)
    b.prism(heart_pts(0.25), 0.05, "trimA_lt", mtx=XZ(-0.215, 0, 1.72)); b.prism(heart_pts(0.19), 0.05, "glass", mtx=XZ(-0.23, 0, 1.72))
    for z in (0.55, 1.2): b.box((0.55, 0.035, 0.09), (-0.4, -0.2, z), "gold", r=0.012)
    _knob(b, 0.47, 1.05, -0.21)

def door_dutch(b):
    """A door in two halves with a shelf between them and a four-pane window in the top half."""
    _frame(b); _threshold(b, 1.9)
    b.box((1.4, 0.14, 1.1), (0, -0.11, 0.57), tn("doorA", 0.2, None), r=0.04); b.box((1.4, 0.14, 1.1), (0, -0.11, 1.77), derive(M("doorA"), "lt"), r=0.04)
    b.box((1.56, 0.3, 0.09), (0, -0.17, 1.17), "trimA_lt", r=0.03)
    b.box((0.98, 0.04, 0.72), (0, -0.185, 1.78), "trimA", r=0.03); _pane(b, 0.82, 0.56, 0, 1.78, -0.2)
    for x in (-0.38, 0.38): b.box((0.36, 0.04, 0.6), (x, -0.185, 0.56), "doorA_dk", r=0.03)
    _knob(b, 0.5, 0.95, -0.21)

def door_double(b):
    """Two glazed leaves under a fanlight; 2.6 m wide, for the cottage and the house."""
    _frame(b, 2.6, 2.6); _threshold(b, 2.6)
    for sx in (-1, 1):
        b.box((1.03, 0.14, 1.96), (sx * 0.53, -0.11, 1.0), tn("doorA", 0.16, 0.88), r=0.04)
        _pane(b, 0.66, 0.9, sx * 0.53, 1.35, -0.2); b.box((0.7, 0.04, 0.42), (sx * 0.53, -0.185, 0.42), "doorA_dk", r=0.03)
        _knob(b, sx * 0.14, 1.0, -0.21)
    b.box((2.1, 0.06, 0.4), (0, -0.16, 2.24), "glass", r=0.02)
    for x in (-0.52, 0.0, 0.52): b.box((0.06, 0.05, 0.388), (x, -0.185, 2.24), "trimA_lt")

DOORS = {"Plank": door_plank, "Arch": door_arch, "Dutch": door_dutch, "Double": door_double}

# ---------------------------------------------------------------- windows
def _sill(b, w=1.62, z=-0.72): b.box((w, 0.36, 0.12), (0, -0.13, z), derive(M("trimA"), "lt"), r=0.04)

def win_square(b):
    """A square window in four panes with a deep sill."""
    b.box((1.35, 0.2, 1.35), (0, -0.03, 0), tn("trimA", 0.12, 0.9), r=0.07, seg=3)
    b.box((1.02, 0.1, 1.02), (0, -0.1, 0), "glass", r=0.02)
    b.box((0.08, 0.06, 1.008), (0, -0.14, 0), "trimA_lt"); b.box((1.008, 0.06, 0.08), (0, -0.14, 0), "trimA_lt"); _sill(b)

def win_round(b):
    """A porthole with a fat ring and a cross."""
    b.lathe([(0, 0), (0.7, 0), (0.74, 0.06), (0.7, 0.2), (0.54, 0.2), (0.54, 0.1), (0, 0.1)], (0, 0.07, 0),
            mats=["trimA_dk", "trimA", "trimA", "trimA_lt", "trimA_dk", "glass"], seg=24, rot=(pi / 2, 0, 0))
    b.box((0.08, 0.06, 1.1), (0, -0.07, 0), "trimA_lt"); b.box((1.1, 0.06, 0.08), (0, -0.07, 0), "trimA_lt")

def win_arch(b):
    """A tall round-topped window with a keystone and a sill."""
    b.prism(arch_pts(1.25, 1.6), 0.2, tn("trimA", 0.12, 0.9), mtx=XZ(-0.13, 0, -0.8), r=0.05)
    b.prism(arch_pts(0.93, 1.3), 0.08, "glass", mtx=XZ(-0.17, 0, -0.66))
    b.box((0.07, 0.06, 1.26), (0, -0.19, -0.03), "trimA_lt"); b.box((0.918, 0.06, 0.07), (0, -0.19, -0.1), "trimA_lt")
    b.box((0.24, 0.1, 0.26), (0, -0.14, 0.72), "trimA_lt", r=0.04); _sill(b, 1.5, -0.84)

def win_flower(b):
    """A square window under a striped awning, with a planted box below."""
    win_square(b)
    b.box((1.5, 0.36, 0.3), (0, -0.3, -0.86), tn("trimA", 0.3, 0.8), r=0.05); b.box((1.36, 0.26, 0.04), (0, -0.3, -0.7), "soil", r=0.01)
    for i, x in enumerate((-0.45, 0.0, 0.45)):
        b.tube([(x, -0.3, -0.7), (x + 0.02, -0.32, -0.5)], 0.02, "leaf_dark", seg=5)
        gk.bloom(b, (x + 0.02, -0.36, -0.46), 0.15, "-y", ("pink", "yellow", "pink")[i], "yellow" if i != 1 else "white", 6)
        b.ball(1.0, (x - 0.14, -0.3, -0.62), "green", sc=(0.13, 0.06, 0.05), u=8, v=5, rot=(0, 0.5, 0.4))
    for i in range(5):
        b.prism([(0.0, 0.14), (-0.62, -0.2), (-0.62, -0.28), (0.0, 0.0)], 0.3, "roofA" if i % 2 == 0 else "cream", mtx=YZ(-0.75 + 0.3 * i, 0, 0.8))

WINDOWS = {"Square": win_square, "Round": win_round, "Arch": win_arch, "Flower": win_flower}

# ---------------------------------------------------------------- porches
def _steps(b, w=2.6):
    b.box((w, 1.1, 0.15), (0, -0.62, 0.075), tn("wallC", 0.3, None), r=0.05); b.box((w - 0.4, 0.62, 0.15), (0, -0.4, 0.225), "wallC_lt", r=0.05)

def porch_steps(b):
    """Two broad stone steps."""
    _steps(b)

def porch_awning(b):
    """Steps under a little tiled gable on two posts."""
    _steps(b, 3.0)
    for sx in (-1, 1):
        b.cyl(0.11, 2.72, (sx * 1.2, -1.0, 0.15), tn("trimA", 0.1, 0.9), seg=12); b.lathe([(0.15, 0), (0.17, 0.04), (0.15, 0.1), (0.11, 0.12)], (sx * 1.2, -1.0, 0.15), m="wallC_lt", seg=12)
    b.box((2.7, 0.16, 0.16), (0, -1.0, 2.9), "trimA", r=0.04)
    for sx in (-1, 1): b.box((0.16, 1.1, 0.16), (sx * 1.2, -0.48, 2.9), "trimA", r=0.04)
    tb = B(); kbuild.gable_roof(tb, 1.62, 1.5, 0.82, "roofA", "roofB", "roofC", "cream", tile_w=0.7, course=0.5, boards=(True, False), finial=0.36, ridge=0.11)
    me = tb.data("_kh_tmp_awn"); b.mesh(me, loc=(0, -0.72, 2.94)); bpy.data.meshes.remove(me)

def porch_deck(b):
    """A plank deck across the front with a railing, a step down in the middle and a lantern on each gatepost."""
    b.box((4.6, 1.7, 0.3), (0, -0.95, 0.15), tn("wood", 0.3, 0.85), r=0.04)
    for i in range(6): b.box((0.03, 1.62, 0.02), (-1.9 + 0.76 * i, -0.95, 0.3), "wood_dk")
    b.box((1.9, 0.55, 0.15), (0, -2.02, 0.075), "wood_dk", r=0.04)
    posts = [(sx * 2.18, y, 1.0) for sx in (-1, 1) for y in (-0.3, -1.68)] + [(sx * 1.02, -1.68, 1.75) for sx in (-1, 1)]
    for x, y, h in posts:
        b.cyl(0.08, h, (x, y, 0.3), tn("trimA", 0.1, 0.9), seg=10)
        if h < 1.5: b.ball(0.11, (x, y, 0.3 + h + 0.05), "trimA_lt", sc=(1, 1, 1.15), u=10, v=6)
        else:
            b.lathe([(0, 0), (0.16, 0), (0.13, 0.05), (0.13, 0.27), (0.17, 0.3), (0.05, 0.4), (0, 0.42)], (x, y, 0.3 + h), mats=["gold", "gold", "glow", "gold", "gold", "gold"], seg=10)
    for sx in (-1, 1):
        for z in (0.78, 1.18):
            b.box((0.09, 1.38, 0.09), (sx * 2.18, -0.99, z), "trimA", r=0.03); b.box((1.16, 0.09, 0.09), (sx * 1.6, -1.68, z), "trimA", r=0.03)

PORCHES = {"Steps": porch_steps, "Awning": porch_awning, "Deck": porch_deck}

# ---------------------------------------------------------------- chimneys
def chimney_brick(b):
    """A square terracotta stack with a cream cap and two pots."""
    b.box((0.8, 0.8, 2.9), (0, 0, -0.15), tn("terracotta", None, 0.86), r=0.05)
    for x, y, z in ((0.405, -0.15, 0.5), (-0.405, 0.1, 0.9), (0.2, -0.405, 0.75), (-0.15, -0.405, 1.05), (0.405, 0.2, 1.0)):
        b.box((0.26 if abs(y) > 0.4 else 0.04, 0.04 if abs(y) > 0.4 else 0.26, 0.12), (x, y, z), "terracotta_lt", r=0.012)
    b.box((1.02, 1.02, 0.18), (0, 0, 1.38), tn("cream", 0.4, None), r=0.05)
    for x in (-0.2, 0.2): b.lathe([(0, 0), (0.13, 0), (0.15, 0.24), (0.11, 0.28), (0.1, 0.1), (0, 0.1)], (x, 0, 1.46), mats=["terracotta_dk", "terracotta", "terracotta", "plum", "plum"], seg=10)

def chimney_stone(b):
    """A round stone stack with a few proud stones and a little tiled hat."""
    b.lathe([(0, -1.6), (0.44, -1.6), (0.46, 0.6), (0.5, 0.9), (0.56, 1.0), (0.56, 1.12), (0.42, 1.18), (0.3, 1.18), (0.3, 1.0), (0, 1.0)],
            mats=["wallC_dk", "wallC", "wallC", "wallC_lt", "wallC_lt", "wallC_lt", "wallC", "plum", "plum"], seg=16)
    for a, z, r in ((0.3, 0.3, 0.13), (1.6, 0.62, 0.11), (2.9, 0.2, 0.12), (4.2, 0.7, 0.1), (5.3, 0.4, 0.13), (-1.2, 0.85, 0.1)):
        b.ball(r, (0.44 * cos(a), 0.44 * sin(a), z), "wallC_dk" if z < 0.5 else "wallC_lt", sc=(0.5, 1, 0.75), u=8, v=5, rot=(0, 0, a))
    for i in range(4):
        a = tau * i / 4 + 0.78; b.cyl(0.045, 0.26, (0.4 * cos(a), 0.4 * sin(a), 1.16), "trimA", seg=6)
    b.lathe([(0.62, 1.4), (0.64, 1.45), (0.3, 1.66), (0.0, 1.74)], mats=["roofC", "roofA", "roofA"], seg=16); b.cyl(0.6, 0.03, (0, 0, 1.4), "roofC", seg=16)

def chimney_pipe(b):
    """A steel stovepipe with a collar where it leaves the roof and a pointed hat."""
    b.cyl(0.2, 3.1, (0, 0, -1.6), tn("steel", None, 0.8), seg=14)
    b.lathe([(0.2, -0.06), (0.4, -0.04), (0.3, 0.12), (0.2, 0.16)], m="roofC", seg=14, cap=False)
    for z in (0.75, 1.2): b.lathe([(0.2, z), (0.235, z + 0.02), (0.235, z + 0.08), (0.2, z + 0.1)], m="steel_dk", seg=14, cap=False)
    for i in range(3):
        a = tau * i / 3; b.cyl(0.025, 0.2, (0.15 * cos(a), 0.15 * sin(a), 1.48), "steel_dk", seg=5)
    b.lathe([(0.0, 1.64), (0.38, 1.64), (0.4, 1.68), (0.0, 1.95)], mats=["steel_dk", "steel", "steel_lt"], seg=14)

CHIMNEYS = {"Brick": chimney_brick, "Stone": chimney_stone, "Pipe": chimney_pipe}

# ---------------------------------------------------------------- extras (origin on the wall, like a window)
def _lamp(b, top, metal):
    """A carriage lantern hanging from a bracket: a small square roof with a finial, four corner posts round a
    glowing glass box and a base with a drip knob, as a storybook street or porch lamp is drawn. (The old one, a
    bell turned on a lathe, read as a yellow cone.)"""
    x, y, z = top
    b.cyl(0.02, 0.05, (x, y, z - 0.03), metal, seg=6)
    b.lathe([(0.0, 0.02), (0.035, 0.0), (0.15, -0.09), (0.13, -0.11), (0.0, -0.11)], (x, y, z - 0.03), m=metal, seg=4, rot=(0, 0, pi / 4))
    b.box((0.17, 0.17, 0.2), (x, y, z - 0.25), "glow")
    for sx in (-1, 1):
        for sy in (-1, 1): b.box((0.03, 0.03, 0.22), (x + sx * 0.09, y + sy * 0.09, z - 0.25), metal, r=0.006)
    b.box((0.22, 0.22, 0.04), (x, y, z - 0.37), metal, r=0.012); b.ball(0.035, (x, y, z - 0.41), metal, u=8, v=5)
def lantern(b):
    """A wall lantern on a curled bracket."""
    b.box((0.2, 0.06, 0.3), (0, -0.02, 0.1), "trimA", r=0.02)
    b.tube([(0, -0.04, 0.16), (0, -0.2, 0.26), (0, -0.36, 0.2), (0, -0.38, 0.08)], 0.03, "trimA", seg=6)
    _lamp(b, (0, -0.38, 0.12), "gold")

def sign(b):
    """A hanging name board with two leaves on it."""
    b.box((0.2, 0.06, 0.3), (0.5, -0.02, 0.2), "trimA", r=0.02); b.tube([(0.5, -0.04, 0.25), (0.3, -0.1, 0.3), (-0.5, -0.1, 0.3)], 0.035, "trimA", seg=6)
    for x in (-0.38, 0.22): b.cyl(0.015, 0.16, (x, -0.1, 0.12), "gold", seg=5)
    b.box((1.0, 0.08, 0.5), (-0.08, -0.1, -0.12), tn("cream", 0.25, None), r=0.05)
    for sg in (-1, 1): b.ball(1.0, (-0.08 + sg * 0.17, -0.15, -0.08), "leaf_light", sc=(0.18, 0.02, 0.085), u=10, v=6, rot=(0, -sg * 0.55, 0))
    b.box((0.05, 0.03, 0.22), (-0.08, -0.15, -0.2), "leaf_dark", r=0.01)

EXTRAS = {"Lantern": lantern, "Sign": sign}

# ---------------------------------------------------------------- small buildings that come whole (origin on the ground, front to -Y)
def well(b):
    """A round stone well under a little tiled roof, with a bucket on a rope. 2 x 2 cells."""
    b.lathe([(0, 0), (0.95, 0), (1.0, 0.08), (0.98, 0.7), (1.05, 0.76), (1.05, 0.9), (0.72, 0.9), (0.72, 0.55), (0, 0.55)],
            mats=["wallC_dk", "wallC_dk", "wallC", "wallC_lt", "wallC_lt", "wallC_lt", "wallC_dk", "water"], seg=20)
    for a, z, r in ((0.4, 0.3, 0.14), (1.9, 0.5, 0.12), (3.3, 0.25, 0.13), (4.6, 0.48, 0.12), (5.6, 0.2, 0.11)):
        b.ball(r, (0.98 * cos(a), 0.98 * sin(a), z), "wallC_lt" if z > 0.3 else "wallC_dk", sc=(0.45, 1, 0.75), u=8, v=5, rot=(0, 0, a))
    for sx in (-1, 1): b.cyl(0.09, 2.0, (sx * 0.88, 0, 0.85), tn("trimA", 0.1, 0.9), seg=10)
    b.cyl(0.06, 1.9, (-0.95, 0, 2.3), "trimA", seg=8, rot=(0, pi / 2, 0)); b.tube([(0.95, 0, 2.3), (1.2, 0, 2.3), (1.2, 0, 2.05)], 0.035, "steel", seg=6)
    b.cyl(0.02, 0.9, (0.15, 0, 1.4), "cream", seg=5)
    b.lathe([(0, 0), (0.15, 0), (0.2, 0.3), (0.17, 0.3), (0.13, 0.05), (0, 0.05)], (0.15, 0, 1.1), mats=["trimA_dk", "trimA", "trimA_lt", "trimA_dk", "water"], seg=12)
    tb = B(); kbuild.gable_roof(tb, 1.35, 1.7, 0.72, "roofA", "roofB", "roofC", "cream", tile_w=0.7, course=0.5, finial=0.36, ridge=0.11)
    me = tb.data("_kh_tmp_well"); b.mesh(me, loc=(0, 0, 2.75)); bpy.data.meshes.remove(me)

def stable(b):
    """An open-fronted stable for two animals: three walls, posts and a stall rail under a tiled gable, a hay bale and a
    trough. 6 x 4 cells."""
    import khouse
    hx, hy, h = 2.75, 1.6, 2.5; T = BASE + h
    b.box((2 * hx + 0.3, 2 * hy + 0.3, BASE), (0, 0, BASE / 2), tn("wallC", 0.3, None), r=0.06)
    b.box((2 * hx, 0.3, h - 0.04), (0, hy - 0.15, BASE + (h - 0.04) / 2), tn("wallA", 0.16, None), r=0.05)
    for sx in (-1, 1): b.box((0.3, 2 * hy, h - 0.07), (sx * (hx - 0.15), 0, BASE + (h - 0.07) / 2), tn("wallA", 0.16, None), r=0.05)
    for x in (-hx + 0.16, 0.0, hx - 0.16): b.cyl(0.14, h - 0.1, (x, -hy + 0.16, BASE), tn("trimA", 0.1, 0.9), seg=12)
    b.box((2 * hx + 0.1, 0.28, 0.26), (0, -hy + 0.16, T - 0.13), "trimA", r=0.05); b.box((2 * hx + 0.1, 0.3, 0.26), (0, hy - 0.15, T - 0.13), "trimA", r=0.05)
    b.box((0.14, 2 * hy - 0.5, 1.1), (0, 0.1, BASE + 0.55), tn("trimA", 0.2, None), r=0.04)
    for sx in (-1, 1):
        for z in (0.5, 0.95): b.box((1.1, 0.1, 0.12), (sx * 2.05, -hy + 0.16, BASE + z), "trimA_lt", r=0.03)
    b.box((0.9, 0.6, 0.55), (-1.7, 0.85, BASE + 0.275), tn("straw" if bpy.data.materials.get("KI_straw") else "sand", 0.3, 0.8), r=0.08)
    b.box((1.2, 0.45, 0.4), (1.5, 0.9, BASE + 0.2), tn("trimA", 0.3, None), r=0.06); b.box((1.04, 0.3, 0.05), (1.5, 0.9, BASE + 0.39), "water")
    S = dict(hx=hx, hy=hy, plot=6); tb = TB(); khouse.roof_gable(tb, S)
    me = tb.data("_kh_tmp_stable"); b.mesh(me, loc=(0, 0, T)); bpy.data.meshes.remove(me)

WHOLE = {"Well": (well, 2, 2), "Stable": (stable, 6, 4)}
