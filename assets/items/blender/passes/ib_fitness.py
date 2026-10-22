"""AllTimeFitness: things for calm, for the bath and for the mat."""
from ii import *
from ip import *

@item("wel-candle", "Willow Candle", "alltimefitness", "table", (0.5, 0.5))
def candle(b):
    """A candle poured into a mint jar with a leaf label; lit."""
    d, m, l = tri(V("A", "mint"))
    b.lathe([(0, 0), (0.11, 0), (0.125, 0.02), (0.125, 0.2), (0.118, 0.212), (0.105, 0.212), (0.105, 0.185), (0, 0.185)], mats=[d, d, m, l, "cream", "cream", "wax"], seg=24)
    band(b, 0.125, 0.06, 0.14, "cream", seg=24); leaves_at(b, -0.134, 0.1, 0.07, "leaf_dark")
    b.cyl(0.007, 0.04, (0, 0, 0.18), "ink", seg=5)
    b.lathe([(0, 0), (0.022, 0.012), (0.03, 0.04), (0.015, 0.075), (0, 0.095)], (0, 0, 0.212), "flame", seg=10)
    b.lathe([(0, 0), (0.011, 0.008), (0.014, 0.022), (0, 0.045)], (0, -0.012, 0.222), "bulb", seg=8)

@item("wel-yogamat", "Quiet Yoga Mat", "alltimefitness", "pack", (1, 0.5))
def yogamat(b):
    """A lilac mat rolled up and held by two cream straps with a carrying loop; the loose end lies in front."""
    A = V("A", "lilac"); d, m, l = tri(A); L, R = 0.66, 0.125
    b.lathe([(0, 0), (0.035, 0.0), (0.07, 0.0), (0.105, 0.0), (R, 0.012), (R, L - 0.012), (0.105, L), (0.07, L), (0.035, L), (0, L)], (-L / 2, 0, R + 0.008),
            mats=[l, d, l, m, m, m, l, d, l], seg=20, rot=(0, pi / 2, 0))
    for x in (-0.17, 0.17): b.lathe([(0.122, -0.026), (0.133, -0.02), (0.133, 0.02), (0.122, 0.026)], (x, 0, R + 0.008), m="cream", seg=20, cap=False, rot=(0, pi / 2, 0))
    b.tube([(-0.17, 0, 0.25), (-0.12, 0, 0.35), (0, 0, 0.39), (0.12, 0, 0.35), (0.17, 0, 0.25)], 0.018, "cream", seg=8)
    b.box((L - 0.03, 0.12, 0.014), (0, -0.15, 0.007), d, r=0.005, seg=1)

@item("wel-cushion", "Meditation Cushion", "alltimefitness", "floor", (1, 1), seat=(0, 0, 0.22, 0))
def zafu(b):
    """A round pleated floor cushion with cream piping and a gold button. 0.22 m high."""
    A = V("A", "purple"); d, m, l = tri(A)
    gores(b, [(0, 0), (0.22, 0), (0.31, 0.04), (0.335, 0.11), (0.31, 0.18), (0.22, 0.215), (0, 0.222)], 14, lambda g, k: d if k == 0 else l if k == 5 else (m if g % 2 else d), per=2)
    for z in (0.03, 0.17): b.lathe([(0.3, z), (0.325, z - 0.004), (0.335, z + 0.012), (0.32, z + 0.026), (0.3, z + 0.022)], m="cream", seg=28, cap=False)
    b.ball(0.042, (0, 0, 0.222), "gold", sc=(1, 1, 0.5), u=10, v=6)

@item("wel-bathoil", "Willow Bath Oil", "alltimefitness", "table", (0.5, 0.5))
def bathoil(b):
    """A round-shouldered teal bottle with a cork, a leaf label and a rose bow at the neck."""
    d, m, l = tri(V("A", "teal"))
    b.lathe([(0, 0), (0.075, 0), (0.09, 0.015), (0.095, 0.12), (0.085, 0.19), (0.045, 0.235), (0.032, 0.245), (0.032, 0.28), (0.042, 0.285), (0.042, 0.3), (0, 0.3)],
            mats=[d, d, m, m, l, l, l, "cream", "cream", "cream"], seg=20)
    b.cyl(0.028, 0.05, (0, 0, 0.292), "kraft", seg=12, bev=0.008)
    band(b, 0.095, 0.05, 0.125, "cream", seg=20); leaves_at(b, -0.103, 0.088, 0.058, "leaf_dark")
    sub(b, lambda sb: bow(sb, "rose", 0.2), xf((0, -0.04, 0.262)))

@item("wel-balmbottle", "Calm Balm", "alltimefitness", "table", (0.5, 0.5))
def balm(b):
    """A squat cream tin with a lilac lid, a gold ring and a bloom on top."""
    tin(b, 0.12, 0.1, "cream", V("A", "lilac"), seg=24)
    band(b, 0.126, 0.078, 0.09, "gold", proud=0.004, seg=24)
    bloom_at(b, (0, 0, 0.103), 0.06, "cream", "gold", 6, "+z", thick=0.08)
