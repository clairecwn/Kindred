"""Food Hall: dishes, each in its own bowl or on its own tray."""
from ii import *
from ip import *

def slices(b, pts, z, m="orange", r=0.03):
    for x, y, t in pts: b.cyl(r, 0.012, (x, y, z), m, seg=10, rot=(t, 0.2, 0))

@item("foo-noodlebowl", "Garden Noodle Bowl", "food-hall", "table", (0.5, 0.5))
def noodles(b):
    """A red bowl of broth with a nest of noodles, half an egg, two greens, carrot coins, and chopsticks across the rim."""
    zf = bowl(b, 0.2, 0.16, V("A", "red"), fill="broth")
    for k, (x, y, r) in enumerate(((0.0, 0.02, 0.1), (-0.04, -0.03, 0.075), (0.05, -0.01, 0.055))):
        b.tube(ring(x, y, zf + 0.012 + k * 0.016, r, 14, "xy"), 0.02, "noodle", seg=6, closed=True)
    b.ball(1.0, (0.1, 0.08, zf + 0.02), "white", sc=(0.05, 0.04, 0.03), u=10, v=6); stud(b, (0.1, 0.08, zf + 0.046), (0, 0, 1), 0.024, "yolk", 0.5)
    leaf(b, (-0.07, 0.06, zf + 0.012), 0.13, "green", 2.3, 0.3); leaf(b, (-0.03, 0.1, zf + 0.012), 0.11, "leaf_light", 1.7, 0.4)
    slices(b, ((-0.1, -0.07, 0.2), (-0.045, -0.12, -0.2)), zf + 0.008)
    for dy in (0.0, 0.035): b.tube([(-0.22, -0.11 + dy, 0.178), (0.22, -0.02 + dy, 0.178)], 0.012, "wood", seg=6)

@item("foo-ricebowl", "Sunroot Rice Bowl", "food-hall", "table", (0.5, 0.5))
def rice(b):
    """A teal bowl heaped with rice: a fried egg on top, three slices of orange sunroot, and a leaf."""
    zf = bowl(b, 0.19, 0.15, V("A", "teal"), fill="rice")
    b.ball(1.0, (0, 0, zf), tn("rice", 0.3, None), sc=(0.155, 0.155, 0.075), u=16, v=8)
    b.ball(1.0, (0.02, -0.03, zf + 0.07), "white", sc=(0.08, 0.07, 0.014), u=12, v=6); b.ball(0.032, (0.02, -0.03, zf + 0.08), tn("yolk", None, 0.6), sc=(1, 1, 0.65), u=10, v=6)
    slices(b, ((-0.09, 0.05, 0.5), (-0.105, 0.0, 0.5), (-0.085, -0.05, 0.5)), zf + 0.04, "orange", 0.036)
    leaf(b, (0.08, 0.07, zf + 0.045), 0.09, "green", 0.8, 0.5)

@item("foo-fruitcup", "Moonberry Cup", "food-hall", "table", (0.5, 0.5))
def fruitcup(b):
    """A tall glass in layers of berry, cream and lilac, topped with a swirl, three moonberries, a leaf and a wafer."""
    b.lathe([(0, 0), (0.072, 0), (0.08, 0.02), (0.09, 0.08), (0.1, 0.14), (0.108, 0.2), (0.115, 0.25), (0.12, 0.262), (0.108, 0.262), (0.104, 0.245), (0, 0.245)],
            mats=["berry_dk", "berry_dk", "berry", "cream", "lilac", "glass", "glass", "glass", "glass", "cream"], seg=24)
    top = swirl(b, 0.245, 0.085)
    for i in range(3):
        a = tau * i / 3 - 0.6; berry(b, (0.075 * cos(a), 0.075 * sin(a), 0.275), 0.034, "lilac")
    leaf(b, (0.0, -0.03, 0.3), 0.07, "leaf_light", -1.2, 0.5)
    b.tube([(-0.03, 0.05, 0.25), (-0.08, 0.09, 0.4)], 0.016, "bread", seg=8)

@item("foo-teatray", "Tea and Tart Tray", "food-hall", "table", (0.5, 0.5))
def teatray(b):
    """A wooden tray with a cup of tea on a saucer and a small berry tart."""
    A = V("A", "teal")
    b.box((0.47, 0.32, 0.03), (0, 0, 0.015), tn("wood", 0.3, None), r=0.012)
    for sy in (-1, 1): b.box((0.47, 0.022, 0.05), (0, sy * 0.149, 0.04), "wood_lt", r=0.009)
    for sx in (-1, 1): b.box((0.022, 0.32, 0.05), (sx * 0.224, 0, 0.04), "wood_lt", r=0.009)
    b.lathe([(0, 0), (0.05, 0), (0.085, 0.012), (0.09, 0.02), (0.05, 0.012), (0, 0.012)], (-0.105, 0, 0.03), m="cream", seg=20)
    b.lathe([(0, 0), (0.04, 0), (0.056, 0.02), (0.066, 0.07), (0.07, 0.08), (0.06, 0.08), (0.056, 0.066), (0, 0.066)], (-0.105, 0, 0.04),
            mats=[derive(A, "dk"), derive(A, "dk"), A, "cream", "cream", "cream", "broth"], seg=20)
    b.tube([(-0.045 + 0.03 * cos(radians(t)), 0, 0.083 + 0.026 * sin(radians(t))) for t in (80, 40, 0, -40, -80)], 0.01, A, seg=6)
    b.prism(scallop(0.085, 10, 0.1, 4), 0.04, tn("crust", 0.3, 0.85), loc=(0.11, 0, 0.03), r=0.008)
    b.cyl(0.066, 0.008, (0.11, 0, 0.066), "berry", seg=16)
    for i in range(3):
        a = tau * i / 3 + 0.5; berry(b, (0.11 + 0.03 * cos(a), 0.03 * sin(a), 0.092), 0.026, "red" if i else "plumfruit")

@item("foo-soup", "Hearth Broth", "food-hall", "table", (0.5, 0.5))
def broth(b):
    """A deep orange crock with two lug handles, full of broth with carrot coins, potato and herbs, and a wooden spoon."""
    A = V("A", "orange")
    zf = bowl(b, 0.19, 0.2, A, fill="broth", level=0.84)
    for sg in (-1, 1): b.tube([(sg * 0.165, -0.04, 0.125), (sg * 0.225, -0.035, 0.14), (sg * 0.225, 0.035, 0.14), (sg * 0.165, 0.04, 0.125)], 0.02, derive(A, "dk"), seg=8)
    slices(b, ((-0.07, -0.06, 0.2), (0.05, -0.09, -0.2), (0.0, 0.08, 0.1)), zf + 0.006)
    for x, y in ((-0.02, -0.01), (0.09, 0.02)): b.box((0.05, 0.05, 0.04), (x, y, zf + 0.008), "cream", r=0.014, rot=(0.2, 0.1, 0.5))
    leaf(b, (-0.1, 0.03, zf + 0.008), 0.07, "green", 1.2, 0.15); leaf(b, (0.04, -0.03, zf + 0.008), 0.06, "leaf_light", -0.5, 0.15)
    b.tube([(0.02, 0.03, zf - 0.01), (0.1, 0.1, zf + 0.1), (0.15, 0.145, zf + 0.19)], 0.015, "wood", seg=8)
