"""Thread + Thimble: clothes as they stand in the shop. ON HOLD (Claire, 8 Oct 2026): these six stay as they are and no
more are added here. Wardrobe clothes for the characters are designed separately; this shop will sell those.
 Each is sized to the part of the body it goes on (see
i05_measure), so the shop model and the worn one can be the same model once the character pipeline fits it."""
from ii import *
from ip import *

@item("bou-strawhat", "Straw Hat", "thread-and-thimble", "wear", (2, 2), stand="head")
def straw_hat(b):
    """Sized to the head: 1.1 m inside the crown, 1.66 m across the brim. Hollow, so it sits over the hair. The brim
    line is the origin. A round crown, a brim that curls up at the edge, two woven rings, a wide ribbon and a big bow."""
    A = V("A", "red")
    b.lathe([(0.0, 0.30), (0.53, 0.27), (0.55, 0.03), (0.56, 0.0), (0.74, 0.005), (0.81, 0.04), (0.83, 0.075), (0.80, 0.085), (0.72, 0.05), (0.60, 0.04),
             (0.585, 0.07), (0.58, 0.24), (0.52, 0.33), (0.34, 0.385), (0.0, 0.4)],
            mats=["straw_dk", "straw_dk", "straw_dk", "straw_dk", "straw_dk", "straw", "straw", "straw", "straw", "straw", "straw", "straw", "straw_lt", "straw_lt"], seg=28)
    b.lathe([(0.652, 0.041), (0.665, 0.054), (0.678, 0.043)], m="straw_dk", seg=28, cap=False)
    b.lathe([(0.742, 0.056), (0.755, 0.074), (0.768, 0.066)], m="straw_dk", seg=28, cap=False)
    b.lathe([(0.582, 0.062), (0.602, 0.066), (0.6, 0.175), (0.578, 0.18)], m=A, seg=28, cap=False)
    sub(b, lambda sb: bow(sb, A, 1.25, tails=False), Matrix.Rotation(radians(40), 4, "Z") @ xf((0, -0.61, 0.12)))

@item("bou-scarf", "Woven Scarf", "thread-and-thimble", "wear", (0.5, 0.5))
def scarf(b):
    """A teal scarf folded in three with cream stripes over the top fold and a fringe at each end."""
    A = V("A", "teal")
    for k, w in enumerate((0.42, 0.41, 0.4)):
        b.box((w, 0.26 - 0.01 * k, 0.06), (0, 0, 0.03 + 0.055 * k), tn(A, 0.3, None) if k < 2 else tn(A, None, 0.45), r=0.028, seg=3)
    for x in (-0.12, 0.0, 0.12): b.prism(rrect(0.246, 0.066, 0.03), 0.036, "cream", mtx=YZ(x - 0.018, 0, 0.14))
    for sx in (-1, 1):
        for i in range(6): b.box((0.045, 0.03, 0.022), (sx * 0.222, -0.105 + 0.042 * i, 0.012), "cream", r=0.008)

@item("bou-cardigan", "Soft Cardigan", "thread-and-thimble", "wear", (0.5, 0.5))
def cardigan(b):
    """A rose cardigan folded flat: sleeves crossed over the front, a cream button band with three gold buttons, and
    a cream collar."""
    A = V("A", "rose")
    b.box((0.46, 0.38, 0.1), (0, 0, 0.05), tn(A, 0.3, 0.8), r=0.04, seg=3)
    for sx in (-1, 1): b.box((0.13, 0.32, 0.05), (sx * 0.15, -0.01, 0.112), tn(A, None, 0.5), r=0.024, rot=(0, 0, sx * 0.12))
    b.box((0.05, 0.36, 0.014), (0, 0, 0.102), "cream", r=0.005)
    for y in (-0.1, 0.0, 0.1): stud(b, (0, y, 0.11), (0, 0, 1), 0.02, "gold")
    for sx in (-1, 1): b.box((0.15, 0.05, 0.022), (sx * 0.05, 0.15, 0.108), "cream", r=0.009, rot=(0, 0, -sx * 0.6))

def boot_details(sb, upper, W=0.3, L=0.44, top=0.42):
    l = derive(upper, "lt"); x0 = -L / 2
    rs = W / 2 - 0.016; cx = x0 + 0.12
    sb.lathe([(rs * 1.0, top - 0.08), (rs * 1.1, top - 0.065), (rs * 1.12, top - 0.005), (rs * 1.06, top + 0.012), (rs * 0.98, top + 0.008)], (cx, 0, 0), m=l, seg=18, cap=False)   # turned-over cuff
    for z in (0.2, 0.26, 0.32):                                                     # laces across the front of the shaft, gold eyelets each side
        sb.box((0.024, 0.13, 0.02), (cx + rs - 0.004, 0, z), "cream", r=0.007)
        for sy in (-1, 1): stud(sb, (cx + rs * 0.92, sy * 0.068, z), (1, sy * 0.4, 0.1), 0.014, "gold", 0.4, 6, 4)

@item("bou-boots", "Sturdy Boots", "thread-and-thimble", "wear", (1, 0.5))
def boots(b):
    """A pair of brown lace-up boots sized to the character's feet: cream soles and toe caps, turned-over cuffs, gold eyelets."""
    A = V("A", "leather")
    def one(sb): shoe(sb, A, "cream", kind="boot"); boot_details(sb, A)
    pair(b, one)

@item("bou-pin", "Enamel Pin", "thread-and-thimble", "wear", (0.5, 0.5))
def pin(b):
    """A big bloom pin in gold and pink on its backing card, propped on a little easel."""
    b.box((0.22, 0.02, 0.28), (0, 0.02, 0.14), tn("kraft", 0.2, None), r=0.008, seg=1, rot=(-0.14, 0, 0))
    b.box((0.08, 0.12, 0.012), (0, 0.075, 0.006), "kraft_dk"); b.box((0.05, 0.012, 0.2), (0, 0.085, 0.1), "kraft_dk", rot=(0.4, 0, 0))
    stud(b, (0, 0.004, 0.16), (0, -1, 0.14), 0.078, "gold", 0.22, 14, 6)
    b.mesh(bloom_mesh(6, "pink", "yellow"), None, mtx=xf((0, -0.014, 0.16), (-0.14, 0, 0)) @ Matrix.Diagonal((0.058, 0.09, 0.058, 1)))
    ground(b)

@item("bou-shawl", "Evening Shawl", "thread-and-thimble", "wear", (0.5, 0.5))
def shawl(b):
    """A navy shawl folded with its point on top, dotted with gold and edged with cream bobbles."""
    A = V("A", "navy")
    b.box((0.46, 0.32, 0.07), (0, 0, 0.035), tn(A, 0.3, None), r=0.03, seg=3)
    b.prism([(-0.22, 0.15), (0.22, 0.15), (0, -0.14)], 0.035, derive(A, "lt"), loc=(0, 0, 0.06), r=0.012)
    for x, y in ((0, 0.09), (-0.11, 0.105), (0.11, 0.105), (0, -0.03), (-0.055, 0.035), (0.055, 0.035)): stud(b, (x, y, 0.096), (0, 0, 1), 0.015, "gold")
    for sg in (-1, 1):
        for t in (0.12, 0.34, 0.56, 0.78): b.ball(0.02, (sg * 0.22 * (1 - t), 0.15 - 0.29 * t, 0.078), "cream", u=8, v=5)
    b.ball(0.024, (0, -0.145, 0.078), "gold", u=8, v=5)
