"""Grove Grocer: food for the pantry and the table."""
from ii import *
from ip import *

@item("gro-breadloaf", "Warm Loaf", "grove-grocer", "table", (0.5, 0.5))
def loaf(b):
    """A bloomer loaf as a storybook bakery draws it: a low dark-crusted base, a high golden dome, four slashes that have
    opened in the oven to show the pale crumb with a raised lip each side, and a dusting of flour."""
    b.box((0.38, 0.22, 0.09), (0, 0, 0.045), tn("crust", 0.35, None), r=0.045, seg=4)
    b.ball(1.0, (0, 0, 0.1), tn("crust", 0.18, 0.62), sc=(0.2, 0.118, 0.095), u=22, v=12)
    for x in (-0.12, -0.04, 0.04, 0.12):
        h = 0.18 - 0.9 * (x * x) / 0.2 * 0.3
        b.ball(1.0, (x, 0, h - 0.006), "bread", sc=(0.024, 0.08, 0.014), u=12, v=6, rot=(0, 0, 0.55))
    for x, y in ((-0.09, 0.05), (0.06, -0.06), (0.15, 0.03), (-0.16, -0.03), (0.0, 0.07), (0.1, 0.07)):
        b.ball(0.011, (x, y, 0.19 - 2.2 * x * x - 3.0 * y * y), "white", sc=(1, 1, 0.4), u=6, v=4)

@item("gro-honeyjar", "Honey Jar", "grove-grocer", "table", (0.5, 0.5))
def honey(b):
    """A round jar of honey under a red cloth cap tied with a cream ribbon and a bow; a bloom on the label."""
    d, m, l = tri("honey"); cd, cm, cl = tri(V("A", "red"))
    b.lathe([(0, 0), (0.095, 0), (0.118, 0.02), (0.128, 0.09), (0.122, 0.16), (0.1, 0.195), (0.095, 0.21), (0, 0.21)], mats=[d, d, m, m, l, l, l], seg=24)
    band(b, 0.128, 0.055, 0.135, "cream", seg=24)
    bloom_at(b, (0, -0.136, 0.095), 0.03, "orange", "cream", 6)
    b.lathe([(0, 0.262), (0.07, 0.258), (0.11, 0.238), (0.112, 0.205), (0.15, 0.168), (0.143, 0.16), (0.1, 0.2), (0, 0.2)], mats=[cl, cl, cm, cm, cd, cd, cd], seg=24)
    band(b, 0.112, 0.196, 0.218, "cream", seg=24)
    sub(b, lambda sb: bow(sb, "cream", 0.24, tails=False), xf((0, -0.12, 0.207)))

@item("gro-fruitbowl", "Bowl of Plums", "grove-grocer", "table", (0.5, 0.5))
def plums(b):
    """Seven plums piled in a teal bowl, the top two with a leaf."""
    zf = bowl(b, 0.2, 0.14, V("A", "teal"))
    for i in range(5):
        a = tau * i / 5 + 0.3; berry(b, (0.105 * cos(a), 0.105 * sin(a), zf + 0.04), 0.07, "plumfruit")
    berry(b, (0.035, -0.02, zf + 0.13), 0.07, "plumfruit", True); berry(b, (-0.05, 0.05, zf + 0.115), 0.066, "plumfruit", True)

@item("gro-teatin", "Tin of Leaves", "grove-grocer", "table", (0.5, 0.5))
def teatin(b):
    """A tall green tea tin with a cream lid, a gold knob, and a label with two leaves."""
    tin(b, 0.105, 0.27, V("A", "leaf_dark"), "cream", seg=24)
    band(b, 0.105, 0.07, 0.18, "cream", seg=24)
    leaves_at(b, -0.114, 0.125, 0.085, "green")
    b.ball(0.03, (0, 0, 0.283), "gold", u=10, v=6)

@item("gro-eggbasket", "Egg Basket", "grove-grocer", "table", (0.5, 0.5))
def eggs(b):
    """A straw basket with a high handle and six eggs."""
    b.lathe([(0, 0), (0.13, 0), (0.16, 0.02), (0.19, 0.11), (0.2, 0.132), (0.185, 0.136), (0.17, 0.1), (0, 0.06)],
            mats=["straw_dk", "straw_dk", "straw", "straw_lt", "straw_lt", "straw_dk", "kraft"], seg=24)
    for z, r in ((0.045, 0.171), (0.08, 0.183)): band(b, r, z, z + 0.014, "straw_dk", proud=0.004, seg=24)
    b.tube([(-0.185, 0, 0.12), (-0.165, 0, 0.24), (-0.085, 0, 0.32), (0, 0, 0.345), (0.085, 0, 0.32), (0.165, 0, 0.24), (0.185, 0, 0.12)], 0.021, "straw_dk", seg=8)
    for i in range(5):
        a = tau * i / 5 + 0.9; b.ball(1.0, (0.095 * cos(a), 0.095 * sin(a), 0.125), tn("peach" if i % 2 else "cream", None, 0.6), sc=(0.055, 0.055, 0.072), u=10, v=6)
    b.ball(1.0, (0.0, 0.0, 0.165), tn("cream", None, 0.6), sc=(0.055, 0.055, 0.072), u=10, v=6)

@item("gro-seedpack", "Packet of Seeds", "grove-grocer", "pack", (0.5, 0.5))
def seedpack(b):
    seed_packet(b, lambda b, y, z: sprout(b, (0, y - 0.012, z - 0.035), 0.1), "leaf_dark")

@item("gro-plantpot", "Little Plant Pot", "grove-grocer", "table", (0.5, 0.5))
def plantpot(b):
    """A small glazed pot with one big two-leaf sprout."""
    zs = pot(b, 0.15, 0.19, V("A", "teal"))
    sprout(b, (0, 0, zs + 0.03), 0.2, 0.3)
