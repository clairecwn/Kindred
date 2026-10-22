"""Sole Search: shoes in pairs, sized to the character's feet (0.27 wide, 0.38 long), toes to the front."""
from ii import *
from ip import *

@item("sho-cloudstep", "Cloudstep Sneakers", "sole-search", "wear", (1, 0.5))
def sneakers(b):
    """Sky-blue sneakers on puffy cloud soles, with cream laces, toe caps and a side stripe."""
    A = V("A", "sky")
    def one(sb):
        shoe(sb, A, "white", kind="sneaker")
        for x in (-0.15, -0.05, 0.05, 0.15):
            for sy in (-1, 1): sb.ball(0.036, (x, sy * 0.145, 0.03), "white", sc=(1.3, 0.6, 0.8), u=6, v=4)
        for x, z in ((0.135, 0.146), (0.095, 0.156), (0.055, 0.166)): sb.box((0.02, 0.13, 0.016), (x, 0, z), "cream", r=0.006, rot=(0, 0.24, 0))
        for sy in (-1, 1): sb.ball(1.0, (-0.06, sy * 0.137, 0.11), "cream", sc=(0.07, 0.012, 0.024), u=10, v=5, rot=(0, -0.3, 0))
    pair(b, one)

@item("sho-rainboot", "Rainpath Boots", "sole-search", "wear", (1, 0.5))
def rainboots(b):
    """Tall glossy yellow boots with a cream top band and a pull loop at the back."""
    A = V("A", "yellow")
    def one(sb):
        shoe(sb, A, "cream", kind="rain", trim=derive(A, "lt"))
        sb.lathe([(0.136, 0.455), (0.142, 0.462), (0.142, 0.492), (0.137, 0.5)], (-0.1, 0, 0), m="cream", seg=18, cap=False)    # a cream band round the top
        sb.tube([(-0.215, 0, 0.45), (-0.232, 0, 0.485), (-0.217, 0, 0.52)], 0.011, "cream", seg=6)                              # and a pull loop at the back
    pair(b, one)

@item("sho-sunsandal", "Sunloop Sandals", "sole-search", "wear", (1, 0.5))
def sandals(b):
    """Orange sandals with two fat loops, a heel strap and a bloom on the front loop."""
    A = V("A", "orange")
    def one(sb):
        shoe(sb, A, "kraft", kind="sandal"); bloom_at(sb, (0.1, 0, 0.192), 0.045, "yellow", "white", 6, "+z")
    pair(b, one)

@item("sho-ankleboot", "Moss Ankle Boots", "sole-search", "wear", (1, 0.5))
def ankleboots(b):
    """Moss-green ankle boots with cream elastic sides and a pull tab."""
    A = V("A", "leaf_dark")
    def one(sb):
        shoe(sb, A, "trunk", kind="ankle", trim=derive(A, "lt"))
        for sy in (-1, 1): sb.ball(1.0, (-0.09, sy * 0.137, 0.2), "cream", sc=(0.045, 0.012, 0.075), u=10, v=5)
        sb.box((0.026, 0.05, 0.07), (-0.226, 0, 0.3), "cream", r=0.009)
    pair(b, one)

@item("sho-sockroll", "Comfy Sock Roll", "sole-search", "wear", (0.5, 0.5))
def socks(b):
    """Three pairs of socks rolled and stacked two under one, each with a cream stripe."""
    A = V("A", "pink"); d, m, l = tri(A); R, L = 0.085, 0.2
    for x, z in ((-0.088, R), (0.088, R), (0.0, R + 0.152)):
        b.lathe([(0, 0), (0.03, 0), (0.058, 0), (0.078, 0.0), (R, 0.014), (R, L - 0.014), (0.078, L), (0.058, L), (0.03, L), (0, L)], (x, L / 2, z + 0.006),
                mats=[l, d, l, m, m, m, l, d, l], seg=18, rot=(pi / 2, 0, 0))
        b.lathe([(R - 0.003, L * 0.38), (R + 0.006, L * 0.41), (R + 0.006, L * 0.59), (R - 0.003, L * 0.62)], (x, L / 2, z + 0.006), m=V("B", "cream"), seg=18, cap=False, rot=(pi / 2, 0, 0))
