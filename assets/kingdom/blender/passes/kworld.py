"""World pieces for Phase 11: steps from the lawn down to the beach, layered hills for the far islets, the bridges
and the terrace of the land the island can grow into. Each builder draws in its own frame; k25 places them."""
import bpy, bmesh
import numpy as np
from kk import *
from ktone import TB, tn, derive
import kterrain
from kterrain import tier, circle, bands, offset

def beach_steps(b, width=2.2, n=8, rise=0.2, tread=0.36, drop=2.3):
    """Stone steps down a cliff. Origin on the lawn's edge at lawn height; +Y runs out towards the sea. A landing sits
    0.75 m into the lawn and covers the grass lip; the treads go down `rise` at a time; the block reaches `drop` below the
    lawn so the sand always buries its foot."""
    b.box((width + 0.56, 1.0, 0.4), (0, -0.25, -0.16), "rock", r=0.04)
    for i in range(n):
        z = -(i + 1) * rise; y0 = 0.25 + i * tread
        b.box((width, tread, drop + z - 0.05), (0, y0 + tread / 2, (z - 0.05 - drop) / 2), "rock" if i % 2 else "rock_dk")
        b.box((width + 0.04, tread + 0.03, 0.05), (0, y0 + tread / 2 - 0.015, z - 0.025), "rock_lt", r=0.012)
    L = 0.25 + n * tread
    for sx in (-1, 1):
        x = sx * (width / 2 + 0.14)
        b.prism([(-0.75, -drop), (L + 0.3, -drop), (L + 0.3, -n * rise + 0.22), (0.25, 0.3), (-0.75, 0.3)], 0.28, tn("rock", 0.25, None), mtx=YZ(x - 0.14, 0, 0))
        b.prism([(-0.78, 0.3), (0.26, 0.3), (L + 0.33, -n * rise + 0.22), (L + 0.33, -n * rise + 0.3), (0.26, 0.38), (-0.78, 0.38)], 0.34, "cream", mtx=YZ(x - 0.17, 0, 0))
        for y, z in ((-0.6, 0.38), (L + 0.14, -n * rise + 0.3)):
            b.cyl(0.1, 0.5, (x, y, z), tn("wood", 0.12, 0.88), seg=10); b.ball(0.13, (x, y, z + 0.56), "cream", u=10, v=6)
        b.tube([(x, -0.6, 0.78), (x, 0.6, 0.6), (x, L * 0.55, -n * rise * 0.5 + 0.52), (x, L + 0.14, -n * rise + 0.7)], 0.03, "rope", seg=6)
    return dict(top=[0.0, -0.25, 0.04], foot=[0.0, L, -n * rise], width=width)

def layered_hill(b, R=5.0, z0=0.0, levels=((1.0, 2.2), (0.56, 1.9)), shift=(0.5, 0.4), seed=0.0):
    """A Mario hill: two or three flat-topped tiers, each with the striped cliff and the grass lip, stepping up and in."""
    z = z0; cx = cy = 0.0
    for k, (f, h) in enumerate(levels):
        tier(b, circle((cx, cy), R * f, 40, 0.05 + 0.02 * k), z - 0.3, z + h); z += h; cx += shift[0] * R * 0.18 * (1 if k % 2 == 0 else -1); cy += shift[1] * R * 0.18
    return z

def terrace(b, centre, R, z1, z0=Z):
    """A raised round terrace with a paved ramp on its south side, as the great tree's. Returns the ramp's box
    (x0, x1, y0, y1) for the layout and the collision bake."""
    cx, cy = centre; tier(b, circle(centre, R, 56), z0 - 0.3, z1)
    X0, X1 = cx - 0.5, cx + 2.1; Y1 = cy - R - 0.2; Y0 = Y1 - (z1 - z0) / 0.375
    b.prism([(Y0 + 0.1, z0 - 0.1), (Y1 + 0.9, z0 - 0.1), (Y1 + 0.9, z1 - 0.06), (Y1, z1 - 0.06), (Y0 + 0.1, z0 - 0.02)], X1 - X0 - 0.04, "cliff_tex", mtx=YZ(X0 + 0.02))
    b.prism([(Y0, z0), (Y1, z1), (Y1 + 2.0, z1), (Y1 + 2.0, z1 + 0.05), (Y1, z1 + 0.05), (Y0, z0 + 0.05)], X1 - X0 - 0.44, "path_tex", mtx=YZ(X0 + 0.22))
    for x0 in (X0, X1 - 0.22): b.prism([(Y0 + 0.05, z0), (Y1, z1), (Y1 + 0.7, z1), (Y1 + 0.7, z1 + 0.16), (Y1, z1 + 0.16), (Y0 + 0.05, z0 + 0.16)], 0.22, "stone", mtx=YZ(x0))
    return [X0, X1, Y0, Y1 + 2.0]

def bridge(b, L, width=2.4, rise=0.3, sand=0.45):
    """A plank footbridge of length L along +X from the origin, deck at z = 0 at both ends and `rise` higher in the
    middle, on stone piers that go down into the sand. Posts with a rope each side."""
    n = max(4, round(L / 0.3)); zf = lambda x: rise * (1 - (2 * x / L - 1) ** 2)
    for i in range(n):
        x = L * (i + 0.5) / n; sl = rise * -4 * (2 * x / L - 1) / L
        b.box((L / n - 0.012, width, 0.07), (x, 0, zf(x) + 0.005), ("wood", "wood_lt", "wood", "wood_dk")[i % 4], r=0.014, rot=(0, -atan(sl), 0))
    top = [(L * i / 16, zf(L * i / 16) - 0.03) for i in range(17)]
    for sy in (-1, 1):
        b.prism(top[::-1] + [(p[0], p[1] - 0.24) for p in top], 0.14, "wood_dk", mtx=XZ(sy * (width / 2 - 0.2) - 0.07, 0, 0))
    k = max(2, round(L / 3.2)) + 1
    for i in range(k):
        x = L * i / (k - 1); x = min(max(x, 0.5), L - 0.5)
        b.box((0.7, width + 0.5, sand + 2.0), (x, 0, zf(x) - 0.3 - (sand + 2.0) / 2), tn("rock", 0.4, None), r=0.06); b.box((0.84, width + 0.64, 0.1), (x, 0, zf(x) - 0.3), "cream", r=0.035)
        for sy in (-1, 1):
            y = sy * (width / 2 + 0.02); b.cyl(0.075, 1.0, (x, y, zf(x) - 0.1), tn("wood", 0.12, 0.9), seg=10); b.ball(0.11, (x, y, zf(x) + 0.95), "cream", u=10, v=6)
    for sy in (-1, 1):
        y = sy * (width / 2 + 0.02); pts = []
        for i in range(k - 1):
            x0 = min(max(L * i / (k - 1), 0.5), L - 0.5); x1 = min(max(L * (i + 1) / (k - 1), 0.5), L - 0.5)
            for t in (0.0, 0.25, 0.5, 0.75): xx = x0 + (x1 - x0) * t; pts.append((xx, y, zf(xx) + 0.74 - 0.22 * sin(pi * t)))
        pts.append((L - 0.5, y, zf(L - 0.5) + 0.74)); b.tube(pts, 0.032, "rope", seg=6)
    return dict(length=L, width=width - 0.4, walk=[round(v, 3) for i in range(9) for v in (L * i / 8, zf(L * i / 8) + 0.04)])
from math import atan

def dock(b, L=12.0, width=3.2, head=(6.4, 3.6), drop=3.7):
    """The arrival pier. Origin on the lawn's edge at lawn height; +Y runs out to sea. A plank walkway `width` wide on
    round piles with a rope rail each side, and at the sea end a wider landing (head: across, along). The landing's +X
    side is left open for a boat: two bollards and a ladder down to the water. Two lantern posts stand where the
    walkway meets the landing."""
    from kdecor import slab, lantern
    hw, hl = head; y0 = -0.5; y1 = L - hl; top = 0.04; cols = ("wood", "wood_lt", "wood", "wood_dk")
    n = round((y1 - y0) / 0.4); d = (y1 - y0) / n
    for i in range(n): slab(b, width, d - 0.03, 0.08, (0, y0 + d * (i + 0.5), top - 0.08), cols[i % 4], ch=0.014)
    m = round(hl / 0.4); d2 = hl / m
    for i in range(m): slab(b, hw, d2 - 0.03, 0.08, (0, y1 + d2 * (i + 0.5), top - 0.08), cols[(i + 2) % 4], ch=0.014)
    for sx in (-1, 1): b.box((0.2, L - y0 - 0.3, 0.2), (sx * (width / 2 - 0.4), (y0 + L) / 2, top - 0.185), "trunk_dk")      # bearers
    for y in (y1 + 0.35, L - 0.35): b.box((hw - 0.3, 0.2, 0.18), (0, y, top - 0.385), "trunk_dk")
    post = tn("wood", 0.55, 0.93); rail = 0.95; piles = {1: [], -1: []}
    def pile(x, y, h=rail, r=0.15):
        b.cyl(r, drop + h, (x, y, -drop), post, seg=12); b.ball(r * 1.25, (x, y, h + 0.04), "cream", u=10, v=6)
    k = max(2, round((y1 - 0.6) / 2.8)) + 1
    for sx in (-1, 1):
        x = sx * (width / 2 + 0.06)
        for i in range(k):
            y = 0.6 + (y1 - 1.2) * i / (k - 1); pile(x, y); piles[sx].append((x, y))
    xh = hw / 2 + 0.06
    corners = [(-xh, y1 + 0.3), (-xh, L - 0.3), (0.0, L + 0.06), (xh, L - 0.3), (xh, y1 + 0.3)]
    for i, (x, y) in enumerate(corners):
        if i in (0, 1, 2): pile(x, y)
        else: pile(x, y, h=0.12, r=0.15)                                         # the open side: piles stop at the deck
    def rope(pts):
        out = []
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            for t in (0.0, 0.25, 0.5, 0.75): out.append((xa + (xb - xa) * t, ya + (yb - ya) * t, rail - 0.2 - 0.2 * sin(pi * t)))
        out.append((pts[-1][0], pts[-1][1], rail - 0.2)); b.tube(out, 0.034, "rope", seg=6)
    rope(piles[1]); rope(piles[-1] + [corners[0], corners[1], corners[2]])
    lights = []
    for sx in (-1, 1):                                                              # lantern posts at the head of the walkway
        x = sx * (width / 2 + 0.06); y = y1 - 0.02
        b.cyl(0.085, 2.5, (x, y, 0.3), tn("wood", 0.1, 0.9), seg=10); b.ball(0.12, (x, y, 2.84), "cream", u=10, v=6)
        b.box((0.56, 0.08, 0.08), (x - sx * 0.22, y, 2.6), "wood", r=0.02); lights.append(lantern(b, (x - sx * 0.44, y, 2.56), 1.0))
    for y in (y1 + 0.8, L - 0.8):                                                   # bollards
        b.lathe([(0, 0), (0.17, 0), (0.19, 0.04), (0.15, 0.3), (0.21, 0.34), (0.21, 0.42), (0.12, 0.47), (0, 0.47)], (hw / 2 - 0.4, y, top), mats=["steel", "steel", "steel", "steel", "cream", "cream", "cream"], seg=12)
    ym = y1 + hl / 2                                                                # ladder
    for sy in (-1, 1): b.box((0.08, 0.08, 2.9), (hw / 2 + 0.09, ym + sy * 0.27, -1.05), "wood_dk", r=0.02)
    for i in range(8): b.cyl(0.03, 0.54, (hw / 2 + 0.09, ym - 0.27, 0.2 - 0.32 * i), "wood_lt", seg=6, rot=(-pi / 2, 0, 0))
    return dict(length=L, width=width, head=[hw, hl], spawn=[0.0, L - 2.0], moor=[hw / 2 + 1.7, ym], lights=lights)

# ---------------------------------------------------------------- wild land (k28_sections)
# the trees, shrubs and ground growth of the wild land are in kgreen.py (second look, 9 Oct)
def land_sign(b):
    """The sign on a piece of wild land that can be opened: a post, a cream board with the leaf pair on it and a red
    band across the board (sealed). No words. Front to -Y."""
    from kdecor import leaf_pair, foot
    foot(b, 0, 0, 0.07, "wood"); b.cyl(0.07, 1.3, (0, 0, 0.3), tn("wood", 0.1, 0.92), seg=10); b.ball(0.105, (0, 0, 1.66), "cream", u=8, v=6)
    b.box((0.98, 0.09, 0.66), (0, -0.09, 1.12), "cream", r=0.035); b.box((1.06, 0.07, 0.74), (0, -0.07, 1.12), tn("wood", None, None), r=0.03)
    leaf_pair(b, (0, -0.145, 1.2), 1.15, y=-1)
    b.box((0.94, 0.12, 0.1), (0, -0.09, 0.9), "red", r=0.02)        # shorter than the boards: its rounded ends must not line up with theirs

